import { geckoPlp, geckoPdp } from "@/lib/gecko.functions";
import { geocodeAddress } from "@/lib/geocode.functions";
import { geckoItemToProperty, enrichWithPdp, mapTipoToPropertyType, normalizeText } from "@/lib/gecko-adapter";
import { generateStudy } from "@/lib/study-engine";
import type { StudyInput, StudyResult, SearchOverrides } from "@/lib/study-types";
import type { MockProperty } from "@/lib/mock-properties";

const PORTAL_TARGETS = {
  "zapimoveis.com.br": "Zap Imóveis",
  "chavesnamao.com.br": "Chaves na Mão",
} as const;
type PortalTarget = keyof typeof PORTAL_TARGETS;

export function isChavesEnabled(): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    const v = localStorage.getItem("portal.chavesnamao");
    if (v === null) return true; // default ON
    return v === "1" || v === "true";
  } catch { return true; }
}

function activeTargets(input?: StudyInput): PortalTarget[] {
  const list: PortalTarget[] = ["zapimoveis.com.br"];
  // Per-study selection wins over the global toggle.
  const portais = input?.portais ?? [];
  const hasChavesInStudy = portais.some((p) => p.toLowerCase().includes("chaves"));
  const enabled = portais.length > 0 ? hasChavesInStudy : isChavesEnabled();
  if (enabled) list.push("chavesnamao.com.br");
  return list;
}

export interface RunStudyOutcome {
  result: StudyResult;
  warning: string | null;
  fellBack: boolean;
}

export interface RunStudyProgress {
  (step: number): void;
}

type PlpParams = {
  city: string;
  state: string;
  businessType: "sale" | "rent";
  keyword?: string;
  propertyType?: string;
  bedrooms?: number[];
  bathrooms?: number[];
  parkingSpots?: number[];
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
};

/**
 * Orchestrates the full PLP + PDP pipeline (adaptive — stops as soon as it
 * has enough comparables) and returns a StudyResult.
 */
export async function runStudy(
  input: StudyInput,
  overrides: SearchOverrides = {},
  onStep?: RunStudyProgress,
): Promise<RunStudyOutcome> {
  let properties: MockProperty[] = [];
  let fellBack = false;
  let criteriosAplicados: string[] = [];
  const funilBusca: { etapa: string; total: number }[] = [];
  let warningMsg: string | null = null;
  const mesmoCondominioIds = new Set<string>();
  const mesmoEnderecoIds = new Set<string>();
  let plpCalls = 0;
  let pdpCalls = 0;
  let descartadosIncompletos = 0;
  const targets = activeTargets(input);
  const perPortal: Record<string, { recebidos: number; aproveitados: number; descartados: number }> = {};
  for (const t of targets) perPortal[t] = { recebidos: 0, aproveitados: 0, descartados: 0 };
  const loggedShape = new Set<string>();
  let totalResultsUpstream = 0;
  let plpNotFoundCount = 0;
  let geoLat: number | undefined;
  let geoLng: number | undefined;
  let geoLabel: string | undefined;

  // Effective parameters (overrides win over input).
  const finalidade = overrides.finalidade ?? input.finalidade;
  const tipo = overrides.tipo ?? input.tipo;
  const cidade = overrides.cidade ?? input.cidade;
  const estado = overrides.estado ?? input.estado;
  const bairro = overrides.bairro ?? input.bairro;
  const bairrosProximos = overrides.bairrosProximos ?? input.bairrosProximos;
  const quartosMin = overrides.quartosMin ?? input.quartos;
  const quartosMax = overrides.quartosMax ?? input.quartos;
  const areaMin = overrides.areaMin ?? Math.round(input.areaUtil * 0.75);
  const areaMax = overrides.areaMax ?? Math.round(input.areaUtil * 1.25);
  const priceMin = overrides.priceMin ?? Math.round(input.valorPretendido * 0.7);
  const priceMax = overrides.priceMax ?? Math.round(input.valorPretendido * 1.3);
  const keyword = (overrides.keyword ?? `${tipo.toLowerCase()} ${bairro}`).trim();
  const autoExpand = overrides.autoExpand ?? true;
  const edificio = (overrides.edificio ?? input.edificio ?? "").trim();
  const priorizarEdificio = (overrides.priorizarEdificio ?? !!edificio) && !!edificio;
  const enderecoRaw = (input.endereco ?? "").trim();
  const usarEndereco = enderecoRaw.replace(/\s+/g, " ").length >= 4;
  const maxPages = Math.min(3, Math.max(1, overrides.maxPages ?? 3));
  const radiusKm = Math.min(5, Math.max(1, overrides.radiusKm ?? 2));
  const TARGET = 8;
  const buscaLivre = !cidade || cidade.trim().length === 0;

  try {
    onStep?.(1);
    const businessType: "sale" | "rent" = finalidade === "Aluguel" ? "rent" : "sale";
    const propertyType = mapTipoToPropertyType(tipo);

    // ---- Local filter predicates ----
    const bairrosAlvo = [bairro, ...bairrosProximos].filter(Boolean).map(normalizeText);
    const tipoNorm = normalizeText(tipo);
    const matchesType = (p: MockProperty) => {
      if (!tipoNorm) return true;
      const hay = normalizeText(`${p.titulo} ${p.descricao}`);
      return hay.includes(tipoNorm);
    };
    const inBairro = (p: MockProperty) =>
      bairrosAlvo.length === 0 || bairrosAlvo.includes(normalizeText(p.bairro));
    const inCidade = (p: MockProperty) => normalizeText(p.cidade) === normalizeText(cidade);
    const areaInRange = (p: MockProperty, expand: number) =>
      p.areaUtil >= areaMin * (1 - expand) && p.areaUtil <= areaMax * (1 + expand);
    const priceInRange = (p: MockProperty, expand: number) =>
      p.preco >= priceMin * (1 - expand) && p.preco <= priceMax * (1 + expand);
    const quartosOk = (p: MockProperty, tol: number) =>
      quartosMin === 0 && quartosMax === 0
        ? true
        : p.quartos >= quartosMin - tol && p.quartos <= quartosMax + tol;
    const strictLocal = (p: MockProperty) =>
      matchesType(p) && inBairro(p) && quartosOk(p, 0) && areaInRange(p, 0) && priceInRange(p, 0);

    // Adaptive pagination across all active portals — stops when
    // shouldStop(collected) is true OR every portal returned an empty page.
    const adaptivePaginate = async (
      params: PlpParams,
      shouldStop: (collected: MockProperty[]) => boolean,
    ): Promise<{ properties: MockProperty[]; pages: number; errorMessage?: string }> => {
      const all: MockProperty[] = [];
      const seen = new Set<string>();
      let pages = 0;
      let firstError: string | undefined;
      // Track per-target last seen `nextPage` so we can stop paginating a
      // portal that already exhausted its results (saves credits).
      const exhausted = new Set<PortalTarget>();
      for (let page = 1; page <= maxPages; page++) {
        const remaining = targets.filter((t) => !exhausted.has(t));
        if (remaining.length === 0) break;
        const calls = await Promise.all(
          remaining.map(async (t) => {
            plpCalls++;
            try {
              const res = await geckoPlp({ data: { ...params, target: t, page } });
              return { t, res };
            } catch (e) {
              if (!firstError) firstError = (e as Error).message;
              return { t, res: null as any };
            }
          }),
        );
        let anyItems = false;
        for (const { t, res } of calls) {
          if (!res) continue;
          if (!res.ok) {
            if (!firstError) firstError = res.errorMessage || res.errorCode || `HTTP_${res.status}`;
            continue;
          }
          if (res.notFound) {
            plpNotFoundCount++;
            exhausted.add(t);
            continue;
          }
          if (typeof res.data?.totalResults === "number") {
            totalResultsUpstream = Math.max(totalResultsUpstream, res.data.totalResults);
          }
          // No next page → don't ask this portal again on later iterations.
          if (res.data?.nextPage == null) exhausted.add(t);
          const items = res.data?.items ?? [];
          if (items.length === 0) continue;
          anyItems = true;
          const portalName = PORTAL_TARGETS[t];
          perPortal[t].recebidos += items.length;
          if (!loggedShape.has(t) && items[0]) {
            loggedShape.add(t);
            try {
              // eslint-disable-next-line no-console
              console.debug(`[gecko:${t}] sample item keys =`, Object.keys(items[0] as object));
              // eslint-disable-next-line no-console
              console.debug(`[gecko:${t}] sample item =`, items[0]);
            } catch { /* ignore */ }
          }
          for (const it of items) {
            const key = (it as any).url || (it as any).id || JSON.stringify(it).slice(0, 64);
            if (seen.has(key)) continue;
            seen.add(key);
            const p = geckoItemToProperty(it, portalName);
            if (p) {
              all.push(p);
              perPortal[t].aproveitados++;
            } else {
              perPortal[t].descartados++;
            }
          }
        }
        pages++;
        if (!anyItems) break;
        if (shouldStop(all)) break;
      }
      return { properties: all, pages, errorMessage: firstError };
    };

    // ---- Layer 1: same building ----
    let condoMatches: MockProperty[] = [];
    if (priorizarEdificio && !buscaLivre) {
      try {
        const res = await adaptivePaginate(
          { city: cidade, state: estado.toUpperCase(), businessType, keyword: edificio, propertyType },
          (collected) => collected.filter((p) => matchEdificio(p, edificio)).length >= TARGET,
        );
        condoMatches = res.properties
          .filter((p) => matchEdificio(p, edificio))
          .map((p) => {
            // Same-building proxy: if PLP lacked area/quartos, use the
            // user's own values — apartments in the same condo usually
            // share floor plans.
            if (p.incomplete) {
              if (!p.areaUtil) p.areaUtil = input.areaUtil;
              if (!p.quartos) p.quartos = input.quartos;
              p.aproximado = true;
            }
            return p;
          });
        condoMatches.forEach((p) => mesmoCondominioIds.add(p.id));
        funilBusca.push({ etapa: `Mesmo condomínio (${res.pages} pág.)`, total: condoMatches.length });
      } catch { /* best-effort */ }
    }

    // ---- Layer 2: same street (skip if condo already covers target) ----
    let enderecoMatches: MockProperty[] = [];
    if (usarEndereco && !buscaLivre && condoMatches.length < TARGET) {
      try {
        const res = await adaptivePaginate(
          { city: cidade, state: estado.toUpperCase(), businessType, keyword: `${enderecoRaw} ${bairro}`.trim(), propertyType },
          (collected) => {
            const matched = collected.filter((p) => matchEndereco(p, enderecoRaw)).length;
            return matched + condoMatches.length >= TARGET;
          },
        );
        enderecoMatches = res.properties.filter((p) => matchEndereco(p, enderecoRaw));
        enderecoMatches.forEach((p) => mesmoEnderecoIds.add(p.id));
        funilBusca.push({ etapa: `Mesmo endereço (${res.pages} pág.)`, total: enderecoMatches.length });
      } catch { /* best-effort */ }
    }

    // ---- Layer 3: neighborhood — PLP wide, local filter ----
    const anchorsCount = condoMatches.length + enderecoMatches.length;
    let mainProperties: MockProperty[] = [];
    let mainPages = 0;
    let mainError: string | undefined;
    if (anchorsCount < TARGET) {
      // Geocode the address to enable upstream 2 km radius filter (PLP doc).
      // Cached per session to spare Nominatim's 1 req/s limit.
      if (!buscaLivre && (enderecoRaw || bairro || cidade)) {
        const parts = [enderecoRaw, bairro, cidade, estado].filter(Boolean).join(", ");
        if (parts.length >= 4) {
          try {
            const cacheKey = `geo:${normalizeText(parts)}`;
            const cached = typeof localStorage !== "undefined" ? localStorage.getItem(cacheKey) : null;
            if (cached) {
              const obj = JSON.parse(cached);
              geoLat = obj.lat; geoLng = obj.lng; geoLabel = obj.label;
            } else {
              const g = await geocodeAddress({ data: { query: parts } });
              if (g.ok && typeof g.latitude === "number" && typeof g.longitude === "number") {
                geoLat = g.latitude; geoLng = g.longitude; geoLabel = g.displayName;
                try { localStorage.setItem(cacheKey, JSON.stringify({ lat: geoLat, lng: geoLng, label: geoLabel })); } catch { /* ignore */ }
              }
            }
          } catch { /* best-effort */ }
        }
      }
      // Push as many filters as possible to the upstream — saves credits by
      // avoiding pages full of out-of-range listings (doc says PLP supports
      // bedrooms/bathrooms/parkingSpots/priceMin/Max/areaMin/Max natively).
      const bedroomsList = !buscaLivre && quartosMin > 0
        ? Array.from(new Set([quartosMin, quartosMax].filter((n) => n > 0)))
        : undefined;
      const res = await adaptivePaginate(
        {
          city: buscaLivre ? "" : cidade,
          state: buscaLivre ? "" : estado.toUpperCase(),
          businessType,
          keyword,
          propertyType,
          bedrooms: bedroomsList,
          priceMin: !buscaLivre && priceMin > 0 ? Math.round(priceMin) : undefined,
          priceMax: !buscaLivre && priceMax > 0 ? Math.round(priceMax) : undefined,
          areaMin: !buscaLivre && areaMin > 0 ? Math.round(areaMin) : undefined,
          areaMax: !buscaLivre && areaMax > 0 ? Math.round(areaMax) : undefined,
          latitude: geoLat,
          longitude: geoLng,
          radius: geoLat && geoLng ? radiusKm : undefined,
        },
        (collected) => {
          const strict = collected.filter(buscaLivre ? matchesType : strictLocal).length;
          return strict + anchorsCount >= TARGET;
        },
      );
      mainProperties = res.properties;
      mainPages = res.pages;
      mainError = res.errorMessage;
    }

    if (mainProperties.length === 0 && condoMatches.length === 0 && enderecoMatches.length === 0) {
      throw new Error(mainError || "Nenhum imóvel encontrado para a busca informada");
    }

    onStep?.(2);
    // Apply user-controlled radius filter (when geocoding succeeded).
    let removidosRaio = 0;
    if (geoLat && geoLng) {
      const before = mainProperties.length;
      mainProperties = mainProperties.filter((p) => {
        if (typeof p.latitude !== "number" || typeof p.longitude !== "number") return true;
        return haversineKm(geoLat!, geoLng!, p.latitude, p.longitude) <= radiusKm;
      });
      removidosRaio = before - mainProperties.length;
    }
    const normalized = mainProperties;
    descartadosIncompletos = normalized.filter((p) => p.incomplete).length;
    // For the strict/expanded layers, only keep items with real area+quartos.
    const normalizedComplete = normalized.filter((p) => !p.incomplete);
    if (priorizarEdificio) {
      normalized.forEach((p) => { if (matchEdificio(p, edificio)) mesmoCondominioIds.add(p.id); });
    }
    if (usarEndereco) {
      normalized.forEach((p) => { if (matchEndereco(p, enderecoRaw)) mesmoEnderecoIds.add(p.id); });
    }
    if (mainPages > 0) funilBusca.push({ etapa: `Páginas consultadas (bairro)`, total: mainPages });
    if (geoLat && geoLng) {
      funilBusca.push({
        etapa: `Geocoding ativo (raio ${radiusKm} km${geoLabel ? ` · ${geoLabel.split(",").slice(0, 2).join(",")}` : ""})`,
        total: 1,
      });
      if (removidosRaio > 0) {
        funilBusca.push({ etapa: `Fora do raio (${radiusKm} km) — removidos`, total: removidosRaio });
      }
    }
    if (totalResultsUpstream > 0) funilBusca.push({ etapa: `Total disponível no portal (totalResults)`, total: totalResultsUpstream });
    funilBusca.push({ etapa: "Retornados pela API", total: mainProperties.length });
    funilBusca.push({ etapa: "Com dados completos", total: normalizedComplete.length });
    if (descartadosIncompletos > 0) {
      funilBusca.push({ etapa: "Sem área/quartos na listagem (descartados do filtro estrito)", total: descartadosIncompletos });
    }
    if (plpNotFoundCount > 0) {
      funilBusca.push({ etapa: "PLP notFound (cidade/UF não reconhecida pelo portal)", total: plpNotFoundCount });
    }
    const agregados = mainProperties.filter((p) => (p.agregadoCount ?? 0) > 0).length;
    if (agregados > 0) {
      funilBusca.push({ etapa: `Anúncios agregados (vários imóveis em 1 card)`, total: agregados });
    }

    type Layer = { label: string; fn: (p: MockProperty) => boolean };
    const strict: Layer = { label: "Filtro estrito (critérios definidos)", fn: strictLocal };
    const layers: Layer[] = buscaLivre
      ? [{ label: "Busca livre (apenas keyword)", fn: matchesType }]
      : autoExpand
      ? [
          strict,
          {
            label: "Quartos ampliados (±1)",
            fn: (p) => matchesType(p) && inBairro(p) && quartosOk(p, 1) && areaInRange(p, 0) && priceInRange(p, 0),
          },
          {
            label: "Sem restrição de bairro (cidade inteira)",
            fn: (p) => matchesType(p) && inCidade(p) && quartosOk(p, 1) && areaInRange(p, 0.15) && priceInRange(p, 0.15),
          },
          {
            label: "Faixa ampla (área/preço +30%)",
            fn: (p) => inCidade(p) && quartosOk(p, 1) && areaInRange(p, 0.3) && priceInRange(p, 0.3),
          },
        ]
      : [strict];

    let chosen: MockProperty[] = [];
    let chosenLayer = layers[0].label;
    if (priorizarEdificio && condoMatches.length >= 1) {
      chosen = condoMatches;
      chosenLayer = "Apenas imóveis do mesmo condomínio";
    } else if (enderecoMatches.length >= 3 && condoMatches.length < 1) {
      const seen = new Set(enderecoMatches.map((p) => p.id));
      const anchors = condoMatches.filter((p) => !seen.has(p.id));
      chosen = [...anchors, ...enderecoMatches];
      chosenLayer = "Apenas imóveis do mesmo endereço";
    } else {
      for (const layer of layers) {
        const sub = normalizedComplete.filter(layer.fn);
        if (sub.length >= 4) {
          chosen = sub;
          chosenLayer = layer.label;
          break;
        }
        chosen = sub;
        chosenLayer = layer.label;
      }
      if (condoMatches.length > 0 || enderecoMatches.length > 0) {
        const seen = new Set(chosen.map((p) => p.id));
        const condoAnchors = condoMatches.filter((p) => !seen.has(p.id));
        condoAnchors.forEach((p) => seen.add(p.id));
        const addrAnchors = enderecoMatches.filter((p) => !seen.has(p.id));
        chosen = [...condoAnchors, ...addrAnchors, ...chosen];
      }
    }

    funilBusca.push({ etapa: chosenLayer, total: chosen.length });
    if (chosen.length === 0) throw new Error("Nenhum imóvel compatível com os critérios informados");

    properties = chosen;
    const quartosLabel = quartosMin === quartosMax ? `${quartosMin}` : `${quartosMin}–${quartosMax}`;
    criteriosAplicados = [
      `Keyword: "${keyword}"`,
      `Tipo: ${tipo}`,
      `Finalidade: ${finalidade}`,
      bairrosAlvo.length ? `Bairro: ${bairro}${bairrosProximos.length ? " + adjacentes" : ""}` : `Cidade: ${cidade}`,
      `Quartos: ${quartosLabel}`,
      `Área: ${areaMin}–${areaMax} m²`,
      `Preço: ${priceMin.toLocaleString("pt-BR")}–${priceMax.toLocaleString("pt-BR")}`,
    ];
    if (priorizarEdificio) {
      criteriosAplicados.unshift(`Edifício: ${edificio} (prioridade)`);
    }
    if (chosenLayer !== layers[0].label) {
      warningMsg = `Critério ampliado para encontrar comparáveis: ${chosenLayer}.`;
    }

    // PDP only for top 3 comparables missing condominium data.
    const top = properties
      .slice(0, 3)
      .filter((p) => p.url && (!p.condominio || p.condominio === 0 || !p.diasMercado || !p.advertiserPhone));
    let pdpNotFound = 0;
    await Promise.allSettled(
      top.map(async (p) => {
        try {
          pdpCalls++;
          const pdp = await geckoPdp({ data: { url: p.url } });
          if (pdp.ok && pdp.notFound) {
            p.removido = true;
            pdpNotFound++;
            return;
          }
          if (pdp.ok && pdp.data && typeof pdp.data === "object") {
            // PDP payload shape: { source, type, parser, data: { ...real fields... } }
            const enriched = enrichWithPdp(p, pdp.data);
            Object.assign(p, enriched);
          }
        } catch { /* ignore */ }
      }),
    );
    if (pdpNotFound > 0) {
      funilBusca.push({ etapa: "Anúncios removidos (PDP notFound)", total: pdpNotFound });
    }
  } catch (err) {
    const msg = (err as Error).message ?? "Erro desconhecido";
    const code = String(msg);
    if (code.includes("NO_TOKEN")) {
      warningMsg = "Token GeckoAPI não configurado — usando dados de demonstração.";
    } else if (code.includes("401") || code.toUpperCase().includes("UNAUTHORIZED")) {
      warningMsg = "Token GeckoAPI inválido — usando dados de demonstração.";
    } else if (code.includes("402") || code.includes("INSUFFICIENT")) {
      warningMsg = "Sem créditos GeckoAPI (402 INSUFFICIENT_CREDITS) — recarregue sua conta. Usando dados de demonstração.";
    } else if (code.includes("429") || code.toUpperCase().includes("RATE_LIMIT") || code.toUpperCase().includes("TOO_MANY")) {
      warningMsg = "Limite de requisições GeckoAPI atingido (429) — aguarde e tente novamente. Usando dados de demonstração.";
    } else {
      warningMsg = `Falha na GeckoAPI (${msg}) — usando dados de demonstração.`;
    }
    fellBack = true;
    properties = [];
  }

  onStep?.(3);
  const result = generateStudy(input, properties);
  if (mesmoCondominioIds.size > 0) {
    result.comparaveis.forEach((c) => { if (mesmoCondominioIds.has(c.id)) c.mesmoCondominio = true; });
  }
  if (mesmoEnderecoIds.size > 0) {
    result.comparaveis.forEach((c) => { if (mesmoEnderecoIds.has(c.id)) c.mesmoEndereco = true; });
  }
  if (!fellBack) {
    criteriosAplicados.push(`Requisições: ${plpCalls} PLP + ${pdpCalls} PDP = ${plpCalls + pdpCalls}`);
    funilBusca.push({ etapa: `Requisições GeckoAPI (PLP+PDP)`, total: plpCalls + pdpCalls });
    for (const t of targets) {
      const stats = perPortal[t];
      const label = PORTAL_TARGETS[t];
      funilBusca.push({
        etapa: `${label}: ${stats.recebidos} recebidos / ${stats.aproveitados} aproveitados${stats.descartados ? ` / ${stats.descartados} descartados` : ""}`,
        total: stats.aproveitados,
      });
    }
    criteriosAplicados.push(`Portais consultados: ${targets.map((t) => PORTAL_TARGETS[t]).join(", ")}`);
  }
  if (criteriosAplicados.length) result.criteriosAplicados = criteriosAplicados;
  if (funilBusca.length) result.funilBusca = funilBusca;
  result.overridesAplicados = overrides;
  const noCondo = priorizarEdificio ? result.comparaveis.filter((c) => c.mesmoCondominio).length : 0;
  const noEnd = usarEndereco ? result.comparaveis.filter((c) => c.mesmoEndereco && !c.mesmoCondominio).length : 0;
  if (priorizarEdificio && !fellBack) {
    const prefix = noCondo > 0
      ? `${noCondo} de ${result.comparaveis.length} comparáveis estão no mesmo condomínio. `
      : `Nenhum imóvel do edifício "${edificio}" foi encontrado — busca ampliada para o bairro. `;
    result.diagnostico = prefix + result.diagnostico;
  }
  if (usarEndereco && !fellBack && noEnd > 0) {
    result.diagnostico = `${noEnd} comparável(is) no mesmo endereço. ` + result.diagnostico;
  }
  if (fellBack) {
    result.diagnostico = `[Dados de demonstração] ${result.diagnostico}`;
  } else if (warningMsg) {
    result.diagnostico = `[${warningMsg}] ${result.diagnostico}`;
  }

  return { result, warning: warningMsg, fellBack };
}

/** Building-name match: strip generic tokens, require all significant tokens present. */
function matchEdificio(p: MockProperty, nome: string): boolean {
  const STOP = new Set(["edificio", "ed", "residencial", "condominio", "cond", "torre", "bloco"]);
  const tokens = normalizeText(nome).split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));
  if (tokens.length === 0) return false;
  const hay = normalizeText(`${p.titulo} ${p.descricao} ${p.bairro}`);
  // Loose match: at least one significant token must appear. Avoids losing
  // listings that only mention the building name in the title (not in the
  // description) or vice-versa.
  return tokens.some((t) => hay.includes(t));
}

/** Street-name match: strip address stopwords, require all significant tokens present. */
function matchEndereco(p: MockProperty, endereco: string): boolean {
  const STOP = new Set([
    "rua", "r", "avenida", "av", "travessa", "tv", "alameda", "al",
    "estrada", "rodovia", "rod", "praca", "praça", "largo", "via",
  ]);
  const tokens = normalizeText(endereco).split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));
  if (tokens.length === 0) return false;
  const hay = normalizeText(`${p.titulo} ${p.descricao} ${p.bairro}`);
  return tokens.every((t) => hay.includes(t));
}
