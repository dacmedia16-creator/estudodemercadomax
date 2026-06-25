import { geckoPlp, geckoPdp } from "@/lib/gecko.functions";
import { geckoItemToProperty, mapTipoToPropertyType, normalizeText } from "@/lib/gecko-adapter";
import { generateStudy } from "@/lib/study-engine";
import type { StudyInput, StudyResult, SearchOverrides } from "@/lib/study-types";
import type { MockProperty } from "@/lib/mock-properties";
import type { GeckoItem } from "@/lib/gecko-types";

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
  parkingSpots?: number[];
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
};

/** Fetches up to `maxPages` PLP pages sequentially; stops early on empty page. */
async function fetchPlpPages(
  params: PlpParams,
  maxPages: number,
): Promise<{ ok: boolean; items: GeckoItem[]; pagesFetched: number; errorMessage?: string }> {
  const all: GeckoItem[] = [];
  const seen = new Set<string>();
  let pagesFetched = 0;
  let firstError: string | undefined;
  let anyOk = false;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const res = await geckoPlp({ data: { ...params, page } });
      pagesFetched++;
      if (!res.ok) {
        if (!firstError) firstError = res.errorMessage || res.errorCode || `HTTP_${res.status}`;
        if (page === 1) break;
        continue;
      }
      anyOk = true;
      const items = res.data?.items ?? [];
      if (items.length === 0) break;
      for (const it of items) {
        const key = (it as any).url || (it as any).id || JSON.stringify(it).slice(0, 64);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(it);
      }
    } catch (e) {
      if (!firstError) firstError = (e as Error).message;
      if (page === 1) break;
    }
  }

  return { ok: anyOk, items: all, pagesFetched, errorMessage: firstError };
}

/**
 * Orchestrates the full PLP + PDP pipeline and returns a StudyResult.
 * `overrides` lets the UI re-run the search with adjusted criteria.
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

  try {
    onStep?.(1);
    const businessType: "sale" | "rent" = finalidade === "Aluguel" ? "rent" : "sale";
    const propertyType = mapTipoToPropertyType(tipo);

    const bedroomsArr: number[] = [];
    for (let q = quartosMin; q <= quartosMax; q++) if (q > 0) bedroomsArr.push(q);

    // Layer 0 (optional): same-building search by name. Less restrictive on
    // price/area so we don't miss a different unit in the same property.
    let condoMatches: MockProperty[] = [];
    if (priorizarEdificio) {
      try {
        const condoFetch = await fetchPlpPages({
          city: cidade,
          state: estado.toUpperCase(),
          businessType,
          keyword: `${edificio} ${bairro}`.trim(),
          propertyType,
        }, maxPages);
        if (condoFetch.items.length || condoFetch.pagesFetched > 0) {
          const condoNorm = condoFetch.items
            .map((it) => geckoItemToProperty(it))
            .filter((p): p is MockProperty => p !== null);
          condoMatches = condoNorm.filter((p) => matchEdificio(p, edificio));
          condoMatches.forEach((p) => mesmoCondominioIds.add(p.id));
          funilBusca.push({ etapa: `Mesmo condomínio (${condoFetch.pagesFetched} pág.)`, total: condoMatches.length });
        }
      } catch {
        /* ignore — layer is best-effort */
      }
    }

    // Layer 0.5 (optional): same-street search by address. Runs after building
    // and before the broader neighborhood PLP.
    let enderecoMatches: MockProperty[] = [];
    if (usarEndereco) {
      try {
        const addrFetch = await fetchPlpPages({
          city: cidade,
          state: estado.toUpperCase(),
          businessType,
          keyword: `${enderecoRaw} ${bairro}`.trim(),
          propertyType,
        }, maxPages);
        if (addrFetch.items.length || addrFetch.pagesFetched > 0) {
          const addrNorm = addrFetch.items
            .map((it) => geckoItemToProperty(it))
            .filter((p): p is MockProperty => p !== null);
          enderecoMatches = addrNorm.filter((p) => matchEndereco(p, enderecoRaw));
          enderecoMatches.forEach((p) => mesmoEnderecoIds.add(p.id));
          funilBusca.push({ etapa: `Mesmo endereço (${addrFetch.pagesFetched} pág.)`, total: enderecoMatches.length });
        }
      } catch {
        /* ignore — layer is best-effort */
      }
    }

    const mainFetch = await fetchPlpPages({
      city: cidade,
      state: estado.toUpperCase(),
      businessType,
      keyword,
      propertyType,
      bedrooms: bedroomsArr.length ? bedroomsArr : undefined,
      parkingSpots: input.vagas > 0 ? [input.vagas] : undefined,
      priceMin,
      priceMax,
      areaMin,
      areaMax,
    }, maxPages);

    if (!mainFetch.ok && mainFetch.items.length === 0) {
      if (condoMatches.length === 0 && enderecoMatches.length === 0) {
        throw new Error(mainFetch.errorMessage || "Falha GeckoAPI");
      }
    }

    const items: GeckoItem[] = mainFetch.items;
    funilBusca.push({ etapa: `Páginas consultadas (bairro)`, total: mainFetch.pagesFetched });
    if (items.length === 0 && condoMatches.length === 0 && enderecoMatches.length === 0) {
      throw new Error("Nenhum imóvel encontrado");
    }

    onStep?.(2);
    const normalized = items
      .map((it) => geckoItemToProperty(it))
      .filter((p): p is MockProperty => p !== null);
    // Also flag any item from the main PLP that matches the building / address.
    if (priorizarEdificio) {
      normalized.forEach((p) => {
        if (matchEdificio(p, edificio)) mesmoCondominioIds.add(p.id);
      });
    }
    if (usarEndereco) {
      normalized.forEach((p) => {
        if (matchEndereco(p, enderecoRaw)) mesmoEnderecoIds.add(p.id);
      });
    }
    funilBusca.push({ etapa: "Retornados pela API", total: items.length });
    funilBusca.push({ etapa: "Com dados completos", total: normalized.length });

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

    type Layer = { label: string; fn: (p: MockProperty) => boolean };
    const strict: Layer = {
      label: "Filtro estrito (critérios definidos)",
      fn: (p) => matchesType(p) && inBairro(p) && quartosOk(p, 0) && areaInRange(p, 0) && priceInRange(p, 0),
    };
    const layers: Layer[] = autoExpand
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
    // If priority building has ≥3 matches, use only those — no fallback to bairro.
    if (priorizarEdificio && condoMatches.length >= 3) {
      chosen = condoMatches;
      chosenLayer = "Apenas imóveis do mesmo condomínio";
    } else if (enderecoMatches.length >= 3 && condoMatches.length < 3) {
      // Endereço tem cobertura suficiente — usa só endereço + âncoras de condomínio na frente.
      const seen = new Set(enderecoMatches.map((p) => p.id));
      const anchors = condoMatches.filter((p) => !seen.has(p.id));
      chosen = [...anchors, ...enderecoMatches];
      chosenLayer = "Apenas imóveis do mesmo endereço";
    } else {
      for (const layer of layers) {
        const sub = normalized.filter(layer.fn);
        if (sub.length >= 4) {
          chosen = sub;
          chosenLayer = layer.label;
          break;
        }
        chosen = sub;
        chosenLayer = layer.label;
      }
      // Prepend condo anchors then endereço anchors (deduped) so they rank first.
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

    // Enrich top 6 via PDP in parallel.
    const top = properties.slice(0, 6).filter((p) => p.url);
    await Promise.allSettled(
      top.map(async (p) => {
        try {
          const pdp = await geckoPdp({ data: { url: p.url } });
          if (pdp.ok && pdp.data && typeof pdp.data === "object") {
            const d = pdp.data as Record<string, any>;
            if (typeof d.condominium === "number") p.condominio = d.condominium;
            if (typeof d.iptu === "number") p.iptu = d.iptu;
            if (Array.isArray(d.amenities)) p.diferenciais = d.amenities;
          }
        } catch {
          /* ignore */
        }
      }),
    );
  } catch (err) {
    const msg = (err as Error).message ?? "Erro desconhecido";
    const code = String(msg);
    if (code.includes("NO_TOKEN")) {
      warningMsg = "Token GeckoAPI não configurado — usando dados de demonstração.";
    } else if (code.includes("401") || code.toUpperCase().includes("UNAUTHORIZED")) {
      warningMsg = "Token GeckoAPI inválido — usando dados de demonstração.";
    } else if (code.includes("402") || code.includes("INSUFFICIENT")) {
      warningMsg = "Sem créditos GeckoAPI — usando dados de demonstração.";
    } else {
      warningMsg = `Falha na GeckoAPI (${msg}) — usando dados de demonstração.`;
    }
    fellBack = true;
    properties = [];
  }

  onStep?.(3);
  const result = generateStudy(input, properties);
  // Re-flag mesmoCondominio on the final comparables (engine may reorder/slice).
  if (mesmoCondominioIds.size > 0) {
    result.comparaveis.forEach((c) => {
      if (mesmoCondominioIds.has(c.id)) c.mesmoCondominio = true;
    });
  }
  if (mesmoEnderecoIds.size > 0) {
    result.comparaveis.forEach((c) => {
      if (mesmoEnderecoIds.has(c.id)) c.mesmoEndereco = true;
    });
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

/**
 * Returns true if the property's title/description/address mentions the building name.
 * Strips generic stopwords and requires every significant token to be present.
 */
function matchEdificio(p: MockProperty, nome: string): boolean {
  const STOP = new Set(["edificio", "ed", "residencial", "condominio", "cond", "torre", "bloco"]);
  const tokens = normalizeText(nome)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
  if (tokens.length === 0) return false;
  const hay = normalizeText(`${p.titulo} ${p.descricao} ${p.bairro}`);
  return tokens.every((t) => hay.includes(t));
}

/**
 * Returns true if the property's title/description/address mentions the street name.
 * Strips address stopwords and requires every significant token to be present.
 */
function matchEndereco(p: MockProperty, endereco: string): boolean {
  const STOP = new Set([
    "rua", "r", "avenida", "av", "travessa", "tv", "alameda", "al",
    "estrada", "rodovia", "rod", "praca", "praça", "largo", "via",
  ]);
  const tokens = normalizeText(endereco)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
  if (tokens.length === 0) return false;
  const hay = normalizeText(`${p.titulo} ${p.descricao} ${p.endereco ?? ""} ${p.bairro}`);
  return tokens.every((t) => hay.includes(t));
}