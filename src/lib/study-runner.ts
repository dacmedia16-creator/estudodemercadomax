import { geckoPlp, geckoPdp } from "@/lib/gecko.functions";
import { geocodeAddress } from "@/lib/geocode.functions";
import { geckoItemToProperty, enrichWithPdp, mapTipoToPropertyType, mapTipoToChavesAlias, normalizeText, isSameTipoFamily, mapDiferenciaisToZapAmenities, isStructuralDiferencial, detectPortalFromUrl } from "@/lib/gecko-adapter";
import { generateStudy, computeAcm } from "@/lib/study-engine";
import type { StudyInput, StudyResult, SearchOverrides, FieldMode, FieldKey } from "@/lib/study-types";
import { DEFAULT_FIELD_MODES, DEFAULT_ACM } from "@/lib/study-types";
import { analisarMercadoIa } from "@/lib/ai-analysis.functions";
import type { MockProperty } from "@/lib/mock-properties";

const PORTAL_TARGETS = {
  "zapimoveis.com.br": "Zap Imóveis",
  "chavesnamao.com.br": "Chaves na Mão",
  "olx.com.br": "OLX",
} as const;
type PortalTarget = keyof typeof PORTAL_TARGETS;
const PORTAL_NAME_TO_TARGET: Record<string, PortalTarget> = {
  "Zap Imóveis": "zapimoveis.com.br",
  "Chaves na Mão": "chavesnamao.com.br",
  "OLX": "olx.com.br",
};

export function isChavesEnabled(): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    const v = localStorage.getItem("portal.chavesnamao");
    if (v === null) return true; // default ON
    return v === "1" || v === "true";
  } catch { return true; }
}

export function isOlxEnabled(): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    const v = localStorage.getItem("portal.olx");
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
  const hasOlxInStudy = portais.some((p) => p.toLowerCase() === "olx" || p.toLowerCase().includes("olx"));
  const olxOn = portais.length > 0 ? hasOlxInStudy : isOlxEnabled();
  if (olxOn) list.push("olx.com.br");
  return list;
}

/** Maps "Apartamento"/"Venda" → "imoveis/venda-de-apartamentos" for OLX PLP. */
function mapTipoToOlxCategory(tipo: string, businessType: "sale" | "rent"): string {
  const t = normalizeText(tipo);
  const slugByTipo: Record<string, string> = {
    apartamento: "apartamentos",
    apto: "apartamentos",
    cobertura: "apartamentos",
    casa: "casas",
    sobrado: "casas",
    "casa de condominio": "casas",
    studio: "apartamentos",
    kitnet: "apartamentos",
    terreno: "terrenos",
    comercial: "comerciais",
    sala: "comerciais",
  };
  const slug = slugByTipo[t];
  if (!slug) return "imoveis";
  const prefix = businessType === "rent" ? "aluguel" : "venda";
  return `imoveis/${prefix}-de-${slug}`;
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
  neighborhood?: string;
  propertyTypes?: string[];
  amenities?: string[];
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
  includeLaunches?: boolean;
  /** OLX PLP — category slug (e.g. "imoveis/venda-de-apartamentos"). */
  categoryPath?: string;
  /** OLX PLP — textual region (e.g. "Regiao de Bauru e Marilia"). */
  region?: string;
};

/**
 * Orchestrates the full PLP + PDP pipeline (adaptive — stops as soon as it
 * has enough comparables) and returns a StudyResult.
 */
export async function runStudy(
  input: StudyInput,
  overrides: SearchOverrides = {},
  onStep?: RunStudyProgress,
  studyId?: string,
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
  type LayerKey = "condominio" | "endereco" | "bairro";
  const perPortal: Record<string, Record<LayerKey, { recebidos: number; aproveitados: number; descartados: number }>> = {};
  for (const t of targets) {
    perPortal[t] = {
      condominio: { recebidos: 0, aproveitados: 0, descartados: 0 },
      endereco: { recebidos: 0, aproveitados: 0, descartados: 0 },
      bairro: { recebidos: 0, aproveitados: 0, descartados: 0 },
    };
  }
  // Persisted across all adaptivePaginate() calls — if a portal exhausts
  // on layer 1, layers 2/3 don't burn credits hitting it again.
  const exhaustedGlobal = new Set<PortalTarget>();
  // True once we add the funnel line "Chaves: skipped on keyword layers".
  let chavesKeywordSkipNoted = false;
  // Portals that returned a 5xx (GeckoAPI/upstream down) at least once.
  const upstream5xxPortals = new Set<PortalTarget>();
  const totalResultsPerTarget: Record<string, number> = {};
  for (const t of targets) totalResultsPerTarget[t] = 0;
  const loggedShape = new Set<string>();
  const plpNotFoundPerTarget: Record<string, number> = {};
  for (const t of targets) plpNotFoundPerTarget[t] = 0;
  // Chaves-only counters exposed by the PLP response.
  const launchesFilteredPerTarget: Record<string, number> = {};
  const coordFilteredPerTarget: Record<string, number> = {};
  for (const t of targets) {
    launchesFilteredPerTarget[t] = 0;
    coordFilteredPerTarget[t] = 0;
  }
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
  // Combine endereço + número (se ambos vieram do form em campos separados,
  // o número vira parte do endereço completo para o matcher).
  const enderecoBase = (input.endereco ?? "").trim();
  const numeroBase = (input.numero ?? "").trim();
  const jaTemNumero = /\b\d{1,6}\b/.test(enderecoBase);
  const enderecoRaw = numeroBase && !jaTemNumero
    ? `${enderecoBase}, ${numeroBase}`.trim()
    : enderecoBase;
  const usarEndereco = enderecoRaw.replace(/\s+/g, " ").length >= 4;
  const maxPages = Math.min(3, Math.max(1, overrides.maxPages ?? 3));
  const radiusKm = Math.min(5, Math.max(1, overrides.radiusKm ?? 2));
  const filtrarAncoras = overrides.filtrarAncoras ?? true;
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
      return isSameTipoFamily(p, tipo);
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

    // ---- Finalidade × preço sanity guards ----
    // Anúncios de aluguel vazam em camadas de keyword livre (ex.: nome de
    // condomínio) e contaminam médias. Descartamos por finalidade declarada
    // e, como fallback, por faixa de preço incompatível.
    let removidosFinalidade = 0;
    let removidosPrecoFaixa = 0;
    const passesFinalidadeGuard = (p: MockProperty): boolean => {
      if (p.finalidade && p.finalidade !== finalidade) {
        removidosFinalidade++;
        return false;
      }
      if (finalidade === "Venda") {
        if (p.preco > 0 && p.preco < 50_000) { removidosPrecoFaixa++; return false; }
        if (p.areaUtil > 0 && p.preco / p.areaUtil < 500) { removidosPrecoFaixa++; return false; }
      } else if (finalidade === "Aluguel") {
        if (p.preco > 50_000) { removidosPrecoFaixa++; return false; }
      }
      return true;
    };

    // ---- Anchor (mesmo prédio / endereço) typology filter ----
    // Para itens com dado, exige quartos ±1 e área dentro do range.
    // Itens sem área/quartos passam — são enriquecidos via PDP antes do filtro.
    const enrichAndFilterAnchors = async (
      items: MockProperty[],
      layerLabel: "Mesmo prédio" | "Mesmo endereço",
    ): Promise<MockProperty[]> => {
      if (!filtrarAncoras || items.length === 0) return items;
      const needsEnrich = items
        .filter((p) => !!p.url && (p.incomplete || !p.areaUtil || !p.quartos))
        .slice(0, 6);
      if (needsEnrich.length > 0) {
        await Promise.allSettled(
          needsEnrich.map(async (p) => {
            try {
              pdpCalls++;
              const pdpTarget = PORTAL_NAME_TO_TARGET[p.portal] ?? "zapimoveis.com.br";
              const pdp = await geckoPdp({ data: { url: p.url, target: pdpTarget, studyId } });
              if (pdp.ok && pdp.data && typeof pdp.data === "object" && !pdp.notFound) {
                Object.assign(p, enrichWithPdp(p, pdp.data));
                if (p.areaUtil && p.quartos) p.incomplete = false;
              }
            } catch { /* ignore */ }
          }),
        );
      }
      const before = items.length;
      const kept = items.filter((p) => {
        const areaOk = !p.areaUtil
          ? true
          : p.areaUtil >= areaMin && p.areaUtil <= areaMax;
        const qOk = !p.quartos
          ? true
          : quartosMin === 0 && quartosMax === 0
          ? true
          : p.quartos >= quartosMin - 1 && p.quartos <= quartosMax + 1;
        return areaOk && qOk;
      });
      const removed = before - kept.length;
      if (removed > 0) {
        const qLabel = quartosMin === quartosMax ? `${quartosMin}±1` : `${quartosMin}-${quartosMax}±1`;
        funilBusca.push({
          etapa: `${layerLabel}: removidos por quartos (${qLabel}) ou área (${areaMin}-${areaMax} m²)`,
          total: removed,
        });
      }
      return kept;
    };

    // Adaptive pagination across all active portals — stops when
    // shouldStop(collected) is true OR every portal returned an empty page.
    const adaptivePaginate = async (
      params: PlpParams,
      shouldStop: (collected: MockProperty[]) => boolean,
      layerKey: LayerKey,
    ): Promise<{ properties: MockProperty[]; pages: number; errorMessage?: string }> => {
      const all: MockProperty[] = [];
      const seen = new Set<string>();
      let pages = 0;
      let firstError: string | undefined;
      // Chaves na Mão PLP doesn't accept `keyword` — skip it on layers
      // that depend on building name or street.
      const keywordOnlyLayer = layerKey === "condominio" || layerKey === "endereco";
      for (let page = 1; page <= maxPages; page++) {
        const remaining = targets.filter((t) => {
          if (exhaustedGlobal.has(t)) return false;
          if (keywordOnlyLayer && t === "chavesnamao.com.br") {
            // Chaves não aceita `keyword`, mas se temos `neighborhood` ou
            // `city` montamos uma chamada paralela só com esses campos —
            // alimenta a base do bairro mesmo nas camadas de prédio/endereço
            // e evita que Chaves fique zerada na maioria dos estudos.
            if (!params.neighborhood && !params.city) {
              if (!chavesKeywordSkipNoted) {
                funilBusca.push({
                  etapa: `Chaves na Mão: pulado em camadas de keyword (sem bairro/cidade)`,
                  total: 1,
                });
                chavesKeywordSkipNoted = true;
              }
              return false;
            }
          }
          return true;
        });
        if (remaining.length === 0) break;
        // Per-query exhaustion — items=[] only stops THIS paginate loop, not
        // every future layer. (Empty result for a building keyword does not
        // mean the portal has nothing in the city.)
        const exhaustedThisQuery = new Set<PortalTarget>();
        const calls = await Promise.all(
          remaining.map(async (t) => {
            if (exhaustedThisQuery.has(t)) return { t, res: null as any };
            plpCalls++;
            try {
              // Per-portal params. Chaves needs `neighborhood`/`propertyTypes`
              // and accepts native filters; only `keyword` and `propertyType`
              // (singular) are Zap-specific.
              const portalParams: PlpParams =
                t === "chavesnamao.com.br"
                  ? {
                      city: params.city,
                      state: params.state,
                      businessType: params.businessType,
                      neighborhood: params.neighborhood,
                      propertyTypes: params.propertyTypes,
                      // Chaves também aceita `amenities` (mesma chave).
                      amenities: params.amenities,
                      // Chaves limits to 1 value per filter — pick the first.
                      bedrooms: params.bedrooms?.length ? [params.bedrooms[0]] : undefined,
                      bathrooms: params.bathrooms?.length ? [params.bathrooms[0]] : undefined,
                      parkingSpots: params.parkingSpots?.length ? [params.parkingSpots[0]] : undefined,
                      priceMin: params.priceMin,
                      priceMax: params.priceMax,
                      areaMin: params.areaMin,
                      areaMax: params.areaMax,
                      latitude: params.latitude,
                      longitude: params.longitude,
                      // Chaves worker applies a fixed 2 km radius when lat/lng are sent — no `radius` field.
                      // Doc default is already false; we send explicitly so launches never
                      // contaminate the comparable median.
                      includeLaunches: false,
                    }
                  : t === "olx.com.br"
                  ? ({
                      city: params.city,
                      state: params.state,
                      businessType: params.businessType,
                      keyword: params.keyword,
                      priceMin: params.priceMin,
                      priceMax: params.priceMax,
                      // OLX-specific: classify under the right real-estate path
                      // to avoid noise from other categories.
                      ...({ categoryPath: mapTipoToOlxCategory(tipo, params.businessType) } as Record<string, unknown>),
                    } as PlpParams)
                  : params;
              const res = await geckoPlp({ data: { ...portalParams, target: t, page, studyId } });
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
            // Distinguish transient upstream errors (5xx) from real auth /
            // quota errors. 5xx already foi tentado 3x dentro do callGecko
            // — não marca exhaustedGlobal (próxima camada/keyword pode pegar
            // o portal já recuperado) e registra no funil pra ficar visível.
            if (res.status >= 500 && res.status < 600) {
              upstream5xxPortals.add(t);
              funilBusca.push({
                etapa: `${PORTAL_TARGETS[t]}: GeckoAPI indisponível (HTTP ${res.status}) — tentado 3x`,
                total: 0,
              });
            } else {
              // 401/402/4xx reais → não adianta queimar crédito de novo.
              exhaustedGlobal.add(t);
            }
            continue;
          }
          if (res.notFound) {
            plpNotFoundPerTarget[t] = (plpNotFoundPerTarget[t] ?? 0) + 1;
            // notFound = "no results for THIS query" (filtros muito apertados
            // ou keyword sem match). NÃO marcar exhaustedGlobal — outra
            // camada com keyword/filtros diferentes pode trazer itens.
            exhaustedThisQuery.add(t);
            continue;
          }
          const rawData = (res.data ?? {}) as any;
          if (typeof rawData.totalResults === "number") {
            totalResultsPerTarget[t] = Math.max(totalResultsPerTarget[t] ?? 0, rawData.totalResults);
          }
          if (typeof rawData.launchesFilteredOut === "number") {
            launchesFilteredPerTarget[t] += rawData.launchesFilteredOut;
          }
          if (typeof rawData.coordinateFilteredOut === "number") {
            coordFilteredPerTarget[t] += rawData.coordinateFilteredOut;
          }
          // Tolerate alternative payload shapes (Chaves na Mão may return
          // `results`/`properties`/`ads` instead of `items`).
          const items: any[] =
            rawData.items ??
            rawData.results ??
            rawData.properties ??
            rawData.ads ??
            rawData.listings ??
            [];
          // Stop THIS paginate loop when items=[] — but DO NOT globally ban
          // the portal: the same portal may have plenty of results for the
          // next layer with different keyword/filters.
          if (items.length === 0) {
            exhaustedThisQuery.add(t);
          }
          // Only mark globally exhausted when the portal explicitly signals
          // no more pages exist for this query AND we've consumed them all.
          const hasNextField = "nextPage" in rawData || "hasNextPage" in rawData;
          const nextIsFalsy = rawData.nextPage == null || rawData.hasNextPage === false;
          if (hasNextField && nextIsFalsy) {
            exhaustedThisQuery.add(t);
          }
          if (typeof rawData.totalPages === "number" && page >= rawData.totalPages) {
            exhaustedThisQuery.add(t);
          }
          if (items.length === 0) continue;
          anyItems = true;
          const portalName = PORTAL_TARGETS[t];
          perPortal[t][layerKey].recebidos += items.length;
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
            if (p && passesFinalidadeGuard(p)) {
              all.push(p);
              perPortal[t][layerKey].aproveitados++;
            } else {
              perPortal[t][layerKey].descartados++;
            }
          }
        }
        pages++;
        if (!anyItems) break;
        // If every remaining portal exhausted THIS query, stop paginating.
        if (remaining.every((t) => exhaustedThisQuery.has(t))) break;
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
          "condominio",
        );
        const condoRawAll = res.properties.filter((p) => matchEdificio(p, edificio));
        // Some portals devolvem condomínios homônimos em outras cidades — descarta.
        const condoRaw = condoRawAll.filter((p) => !p.cidade || inCidade(p));
        const removidosCidadeCondo = condoRawAll.length - condoRaw.length;
        if (removidosCidadeCondo > 0) {
          funilBusca.push({ etapa: `Mesmo prédio: removidos por cidade diferente`, total: removidosCidadeCondo });
        }
        const condoTipoOk = condoRaw.filter((p) => isSameTipoFamily(p, tipo));
        const removidosTipoCondo = condoRaw.length - condoTipoOk.length;
        if (removidosTipoCondo > 0) {
          funilBusca.push({ etapa: `Mesmo prédio: removidos por tipo (${tipo})`, total: removidosTipoCondo });
        }
        condoMatches = condoTipoOk
          .map((p) => {
            // Mark incomplete same-building items as approximate so the UI
            // can show "—" / a badge. Do NOT copy the user's own values —
            // that masks the real listing data and breaks R$/m².
            if (p.incomplete) p.aproximado = true;
            return p;
          });
        condoMatches = await enrichAndFilterAnchors(condoMatches, "Mesmo prédio");
        condoMatches.forEach((p) => mesmoCondominioIds.add(p.id));
        funilBusca.push({ etapa: `Mesmo condomínio (${res.pages} pág.)`, total: condoMatches.length });
      } catch { /* best-effort */ }
    }

    // ---- Layer 2: same street (skip if condo already covers target) ----
    let enderecoMatches: MockProperty[] = [];
    if (usarEndereco && !buscaLivre && condoMatches.length < TARGET) {
      try {
        // Strip trailing street number from the keyword — Zap relevance
        // drops to zero when a specific number is in the query.
        const enderecoSemNumero = enderecoRaw.replace(/,?\s*\d+\s*$/, "").trim() || enderecoRaw;
        const res = await adaptivePaginate(
          { city: cidade, state: estado.toUpperCase(), businessType, keyword: `${enderecoSemNumero} ${bairro}`.trim(), propertyType },
          (collected) => {
            const matched = collected.filter((p) => matchEndereco(p, enderecoRaw)).length;
            return matched + condoMatches.length >= TARGET;
          },
          "endereco",
        );
        const enderecoAll = res.properties.filter((p) => matchEndereco(p, enderecoRaw));
        enderecoMatches = enderecoAll.filter((p) => !p.cidade || inCidade(p));
        const removidosCidadeEnd = enderecoAll.length - enderecoMatches.length;
        if (removidosCidadeEnd > 0) {
          funilBusca.push({ etapa: `Mesmo endereço: removidos por cidade diferente`, total: removidosCidadeEnd });
        }
        const enderecoTotal = enderecoMatches.length;
        enderecoMatches = enderecoMatches.filter((p) => isSameTipoFamily(p, tipo));
        const removidosTipoEnd = enderecoTotal - enderecoMatches.length;
        if (removidosTipoEnd > 0) {
          funilBusca.push({ etapa: `Mesmo endereço: removidos por tipo (${tipo})`, total: removidosTipoEnd });
        }
        enderecoMatches = await enrichAndFilterAnchors(enderecoMatches, "Mesmo endereço");
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
      // Push filters to the upstream com cautela — quando o anúncio não
      // declara o campo no formato esperado, o PLP zera a página inteira.
      // Por isso:
      //   - bedrooms só sobe se o usuário ajustou manualmente (override).
      //   - area só sobe se o usuário ajustou range manual (override).
      //   - price sobe com faixa larga (±40%) — strictLocal segue ±30%.
      const userAdjustedQuartos = overrides.quartosMin !== undefined || overrides.quartosMax !== undefined;
      const userAdjustedArea = overrides.areaMin !== undefined || overrides.areaMax !== undefined;
      // Bedrooms: sempre que o imóvel-alvo tem quartos > 0, mandamos faixa
      // [q-1, q, q+1] — ajuda relevância sem zerar a página por mismatch único.
      const bedroomsList = !buscaLivre && quartosMin > 0
        ? (() => {
            const base = userAdjustedQuartos
              ? [quartosMin, quartosMax].filter((n) => n > 0)
              : [quartosMin];
            const set = new Set<number>();
            for (const q of base) {
              if (q - 1 > 0) set.add(q - 1);
              set.add(q);
              set.add(q + 1);
            }
            return Array.from(set).sort((a, b) => a - b);
          })()
        : undefined;
      // Preço: só sobe ao PLP quando o usuário explicitamente apertou no
      // editor de critérios. ±40% automático estava cortando muito imóvel
      // legítimo (anúncios fora dessa faixa, mas dentro do mercado real).
      const priceMinSend = overrides.priceMin ?? 0;
      const priceMaxSend = overrides.priceMax ?? 0;
      // ---- Diferenciais nativos (amenities) ----
      const fieldModesEff: Record<FieldKey, FieldMode> = { ...DEFAULT_FIELD_MODES, ...(overrides.fieldModes ?? {}) };
      const allAmenities = mapDiferenciaisToZapAmenities(input.diferenciais ?? []);
      let amenitiesToSend: string[] | undefined;
      if (fieldModesEff.diferenciais === "hard" && allAmenities.length > 0) {
        amenitiesToSend = allAmenities;
      } else if (fieldModesEff.diferenciais === "prefer" && allAmenities.length >= 3) {
        // Em "prefer" mandamos só os 2 amenities mais decisivos — guia sem
        // eliminar. Em "soft" (default) NÃO enviamos nada nativo: diferenciais
        // pesam apenas na similaridade local e o Zap não corta a página.
        const priority = ["POOL", "GYM", "FURNISHED", "GOURMET_BALCONY", "BARBECUE_GRILL"];
        const sorted = [...allAmenities].sort(
          (a, b) => (priority.indexOf(a) === -1 ? 99 : priority.indexOf(a)) - (priority.indexOf(b) === -1 ? 99 : priority.indexOf(b)),
        );
        amenitiesToSend = sorted.slice(0, 2);
      }
      if (amenitiesToSend && amenitiesToSend.length) {
        funilBusca.push({
          etapa: `Diferenciais enviados ao PLP (${fieldModesEff.diferenciais}): ${amenitiesToSend.join(", ")}`,
          total: amenitiesToSend.length,
        });
      }
      const res = await adaptivePaginate(
        {
          city: buscaLivre ? "" : cidade,
          state: buscaLivre ? "" : estado.toUpperCase(),
          businessType,
          keyword,
          propertyType,
          neighborhood: buscaLivre ? undefined : bairro || undefined,
          propertyTypes: (() => {
            const a = mapTipoToChavesAlias(tipo);
            return a ? [a] : undefined;
          })(),
          amenities: amenitiesToSend,
          bedrooms: bedroomsList,
          priceMin: !buscaLivre && priceMinSend > 0 ? Math.round(priceMinSend) : undefined,
          priceMax: !buscaLivre && priceMaxSend > 0 ? Math.round(priceMaxSend) : undefined,
          areaMin: !buscaLivre && userAdjustedArea && areaMin > 0 ? Math.round(areaMin) : undefined,
          areaMax: !buscaLivre && userAdjustedArea && areaMax > 0 ? Math.round(areaMax) : undefined,
          latitude: geoLat,
          longitude: geoLng,
          radius: geoLat && geoLng ? radiusKm : undefined,
        },
        (collected) => {
          const strict = collected.filter(buscaLivre ? matchesType : strictLocal).length;
          return strict + anchorsCount >= TARGET;
        },
        "bairro",
      );
      mainProperties = res.properties;
      mainPages = res.pages;
      mainError = res.errorMessage;
      // ---- Retry escalonado por portal (Zap e Chaves) ----
      // Para cada portal ativo que terminou a camada bairro com 0 itens
      // recebidos, tenta de novo afrouxando filtros em 2 passos:
      //   passo A) tira amenities + radius (mantém bedrooms/price/area)
      //   passo B) tira tudo nativo (city/state/keyword/propertyType/neighborhood)
      if (!buscaLivre) {
        const retryTargets: PortalTarget[] = (["zapimoveis.com.br", "chavesnamao.com.br"] as PortalTarget[])
          .filter((t) =>
            targets.includes(t)
            // Antes era "=== 0" — agora reagimos a qualquer portal que veio
            // bem abaixo do esperado (< 3), pra evitar dominância silenciosa
            // do OLX.
            && (perPortal[t]?.bairro.recebidos ?? 0) < 3
            // Não adianta afrouxar filtro quando a GeckoAPI caiu — o retry
            // só ajuda quando o portal respondeu mas devolveu lista vazia.
            && !upstream5xxPortals.has(t));
        for (const t of retryTargets) {
          // Solta exhaustedGlobal pra esse portal — vamos tentar com filtros relaxados.
          exhaustedGlobal.delete(t);
          const recebidosAntes = perPortal[t]?.bairro.recebidos ?? 0;
          funilBusca.push({
            etapa: `${PORTAL_TARGETS[t]}: ${recebidosAntes} item(ns) com filtros nativos — tentando retry afrouxado`,
            total: 1,
          });
          const savedTargets = targets.slice();
          targets.length = 0;
          targets.push(t);
          try {
            // ----- Passo A: sem amenities, sem radius -----
            const retryA = await adaptivePaginate(
              {
                city: cidade,
                state: estado.toUpperCase(),
                businessType,
                keyword,
                propertyType,
                neighborhood: bairro || undefined,
                propertyTypes: (() => { const a = mapTipoToChavesAlias(tipo); return a ? [a] : undefined; })(),
                bedrooms: bedroomsList,
                priceMin: priceMinSend > 0 ? Math.round(priceMinSend) : undefined,
                priceMax: priceMaxSend > 0 ? Math.round(priceMaxSend) : undefined,
                areaMin: userAdjustedArea && areaMin > 0 ? Math.round(areaMin) : undefined,
                areaMax: userAdjustedArea && areaMax > 0 ? Math.round(areaMax) : undefined,
              },
              (collected) => collected.filter(strictLocal).length + anchorsCount >= TARGET,
              "bairro",
            );
            if (retryA.properties.length > 0) {
              const seen = new Set(mainProperties.map((p) => p.id));
              for (const p of retryA.properties) if (!seen.has(p.id)) mainProperties.push(p);
              mainPages += retryA.pages;
              funilBusca.push({
                etapa: `${PORTAL_TARGETS[t]}: retry afrouxando amenities/raio`,
                total: retryA.properties.length,
              });
              continue;
            }
            // ----- Passo B: só keyword + cidade -----
            exhaustedGlobal.delete(t);
            const retryB = await adaptivePaginate(
              {
                city: cidade,
                state: estado.toUpperCase(),
                businessType,
                keyword,
                propertyType,
                neighborhood: bairro || undefined,
                propertyTypes: (() => { const a = mapTipoToChavesAlias(tipo); return a ? [a] : undefined; })(),
              },
              (collected) => collected.filter(strictLocal).length + anchorsCount >= TARGET,
              "bairro",
            );
            if (retryB.properties.length > 0) {
              const seen = new Set(mainProperties.map((p) => p.id));
              for (const p of retryB.properties) if (!seen.has(p.id)) mainProperties.push(p);
              mainPages += retryB.pages;
              funilBusca.push({
                etapa: `${PORTAL_TARGETS[t]}: retry sem filtros nativos`,
                total: retryB.properties.length,
              });
            }
          } finally {
            targets.length = 0;
            for (const x of savedTargets) targets.push(x);
          }
        }
      }
      // ---- Passe de rebalanceamento por dominância ----
      // Se um único portal está com > 70% do bruto E o total ainda é < 8,
      // roda 1 chamada extra nos outros portais sem amenities, sem radius,
      // com bedrooms ±1, só pra equilibrar o mix.
      if (!buscaLivre && mainProperties.length < 8) {
        const totalBruto = mainProperties.length;
        if (totalBruto >= 3) {
          const byPortal = new Map<string, number>();
          for (const p of mainProperties) byPortal.set(p.portal, (byPortal.get(p.portal) ?? 0) + 1);
          let dominante: PortalTarget | null = null;
          for (const [name, n] of byPortal) {
            if (n / totalBruto > 0.7) {
              const found = (Object.entries(PORTAL_TARGETS) as [PortalTarget, string][])
                .find(([, label]) => label === name);
              if (found) dominante = found[0];
            }
          }
          if (dominante) {
            const outros = targets.filter((t) => t !== dominante && !upstream5xxPortals.has(t));
            for (const t of outros) {
              if ((perPortal[t]?.bairro.recebidos ?? 0) >= 3) continue; // já trouxe o suficiente
              exhaustedGlobal.delete(t);
              const savedTargets = targets.slice();
              targets.length = 0;
              targets.push(t);
              try {
                const rebal = await adaptivePaginate(
                  {
                    city: cidade,
                    state: estado.toUpperCase(),
                    businessType,
                    keyword,
                    propertyType,
                    neighborhood: bairro || undefined,
                    propertyTypes: (() => { const a = mapTipoToChavesAlias(tipo); return a ? [a] : undefined; })(),
                    bedrooms: bedroomsList,
                  },
                  (collected) => collected.length >= TARGET,
                  "bairro",
                );
                if (rebal.properties.length > 0) {
                  const seen = new Set(mainProperties.map((p) => p.id));
                  let added = 0;
                  for (const p of rebal.properties) if (!seen.has(p.id)) { mainProperties.push(p); added++; }
                  if (added > 0) {
                    mainPages += rebal.pages;
                    funilBusca.push({
                      etapa: `${PORTAL_TARGETS[t]}: passe de rebalanceamento (${PORTAL_TARGETS[dominante]} dominava)`,
                      total: added,
                    });
                  }
                }
              } finally {
                targets.length = 0;
                for (const x of savedTargets) targets.push(x);
              }
            }
          }
        }
      }
      // Avisa explicitamente quando Chaves está desativado nas configurações.
      if (!targets.includes("chavesnamao.com.br") && !buscaLivre) {
        funilBusca.push({
          etapa: `Chaves na Mão: desativado (Configurações ou seleção de portais)`,
          total: 1,
        });
      }
    }

    if (mainProperties.length === 0 && condoMatches.length === 0 && enderecoMatches.length === 0) {
      // Quando todos os portais ativos caíram com 5xx, deixa claro pro
      // usuário que é instabilidade da GeckoAPI, não filtro nosso.
      if (upstream5xxPortals.size >= targets.length && upstream5xxPortals.size > 0) {
        throw new Error("GECKOAPI_UNAVAILABLE");
      }
      throw new Error(mainError || "Nenhum imóvel encontrado para a busca informada");
    }

    onStep?.(2);
    // Sanity: descarta imóveis de outras cidades (bairros homônimos, condomínios em rede).
    if (!buscaLivre) {
      const beforeCidade = mainProperties.length;
      mainProperties = mainProperties.filter((p) => !p.cidade || inCidade(p));
      const removidosCidade = beforeCidade - mainProperties.length;
      if (removidosCidade > 0) {
        funilBusca.push({ etapa: `Removidos por cidade diferente`, total: removidosCidade });
      }
    }
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
    for (const t of targets) {
      const tr = totalResultsPerTarget[t] ?? 0;
      if (tr > 0) {
        funilBusca.push({ etapa: `${PORTAL_TARGETS[t]}: total disponível no portal`, total: tr });
      }
    }
    funilBusca.push({ etapa: "Retornados pela API", total: mainProperties.length });
    if (removidosFinalidade > 0) {
      funilBusca.push({
        etapa: `Removidos por finalidade incompatível (estudo de ${finalidade})`,
        total: removidosFinalidade,
      });
    }
    if (removidosPrecoFaixa > 0) {
      funilBusca.push({
        etapa: `Removidos por preço fora da faixa de ${finalidade.toLowerCase()}`,
        total: removidosPrecoFaixa,
      });
    }
    funilBusca.push({ etapa: "Com dados completos", total: normalizedComplete.length });
    if (descartadosIncompletos > 0) {
      funilBusca.push({ etapa: "Sem área/quartos na listagem (descartados do filtro estrito)", total: descartadosIncompletos });
    }
    for (const t of targets) {
      const nf = plpNotFoundPerTarget[t] ?? 0;
      if (nf > 0) {
        funilBusca.push({ etapa: `${PORTAL_TARGETS[t]}: PLP notFound (cidade/UF não reconhecida)`, total: nf });
      }
      if (exhaustedGlobal.has(t)) {
        funilBusca.push({ etapa: `${PORTAL_TARGETS[t]}: portal esgotado (sem mais páginas)`, total: 1 });
      }
      const lf = launchesFilteredPerTarget[t] ?? 0;
      if (lf > 0) {
        funilBusca.push({ etapa: `${PORTAL_TARGETS[t]}: lançamentos removidos (worker)`, total: lf });
      }
      const cf = coordFilteredPerTarget[t] ?? 0;
      if (cf > 0) {
        funilBusca.push({ etapa: `${PORTAL_TARGETS[t]}: fora do raio 2 km (worker)`, total: cf });
      }
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
    // Hard filter de tipo (apartamento ≠ casa, etc.) — derruba qualquer
    // imóvel da família errada que tenha escapado das camadas anteriores.
    {
      const before = chosen.length;
      chosen = chosen.filter((p) => isSameTipoFamily(p, tipo));
      const removed = before - chosen.length;
      if (removed > 0) {
        funilBusca.push({ etapa: `Tipo incompatível (${tipo}) — removidos`, total: removed });
      }
    }
    // ---- Hard filters (campos extras marcados como "Obrigatório") ----
    {
      const modes: Record<FieldKey, FieldMode> = { ...DEFAULT_FIELD_MODES, ...(overrides.fieldModes ?? {}) };
      const hardChecks: { key: FieldKey; label: string; pass: (p: MockProperty) => boolean }[] = [];
      if (modes.suites === "hard" && input.suites > 0) {
        hardChecks.push({ key: "suites", label: `Suítes obrigatório (${input.suites} ±1)`, pass: (p) => Math.abs(p.suites - input.suites) <= 1 });
      }
      if (modes.banheiros === "hard" && input.banheiros > 0) {
        hardChecks.push({ key: "banheiros", label: `Banheiros obrigatório (${input.banheiros} ±1)`, pass: (p) => typeof p.banheiros !== "number" || Math.abs(p.banheiros - input.banheiros) <= 1 });
      }
      if (modes.vagas === "hard" && input.vagas > 0) {
        hardChecks.push({ key: "vagas", label: `Vagas obrigatório (${input.vagas} ±1)`, pass: (p) => Math.abs(p.vagas - input.vagas) <= 1 });
      }
      if (modes.andar === "hard" && typeof input.andar === "number" && input.andar > 0) {
        hardChecks.push({ key: "andar", label: `Andar obrigatório (${input.andar} ±3)`, pass: (p) => typeof (p as any).andar !== "number" || Math.abs((p as any).andar - input.andar!) <= 3 });
      }
      if (modes.anoConstrucao === "hard" && typeof input.anoConstrucao === "number" && input.anoConstrucao > 0) {
        hardChecks.push({ key: "anoConstrucao", label: `Ano obrigatório (${input.anoConstrucao} ±10)`, pass: (p) => typeof (p as any).anoConstrucao !== "number" || Math.abs((p as any).anoConstrucao - input.anoConstrucao!) <= 10 });
      }
      if (modes.condominio === "hard" && input.condominio > 0) {
        const limite = input.condominio * 1.3;
        hardChecks.push({ key: "condominio", label: `Condomínio obrigatório (até ${Math.round(limite)})`, pass: (p) => typeof p.condominio !== "number" || p.condominio === 0 || p.condominio <= limite });
      }
      if (modes.iptu === "hard" && input.iptu > 0) {
        const limite = input.iptu * 1.3;
        hardChecks.push({ key: "iptu", label: `IPTU obrigatório (até ${Math.round(limite)})`, pass: (p) => typeof p.iptu !== "number" || p.iptu === 0 || p.iptu <= limite });
      }
      if (modes.diferenciais === "hard" && input.diferenciais.length > 0) {
        // Só exige os diferenciais ESTRUTURAIS (Piscina, Academia, etc.).
        // Itens subjetivos ("Vista livre", "Próximo ao metrô", "Reformado",
        // "Novo") raramente aparecem na lista de amenities do anúncio e
        // derrubariam comparáveis legítimos.
        const required = input.diferenciais.filter(isStructuralDiferencial);
        if (required.length > 0) {
          const min = Math.max(1, Math.ceil(required.length * 0.5));
          const reqNorm = required.map((d) => d.toLowerCase());
          hardChecks.push({
            key: "diferenciais",
            label: `Diferenciais obrigatório (≥${min} de ${required.length} estruturais)`,
            pass: (p) => {
              const have = (p.diferenciais ?? []).map((d) => d.toLowerCase());
              const hits = reqNorm.filter((d) => have.some((h) => h.includes(d) || d.includes(h))).length;
              return hits >= min;
            },
          });
        }
      }
      for (const check of hardChecks) {
        const before = chosen.length;
        chosen = chosen.filter(check.pass);
        const removed = before - chosen.length;
        if (removed > 0) {
          funilBusca.push({ etapa: `Removidos por ${check.label}`, total: removed });
        }
      }
    }
    // Por portal — mostra exatamente quantos do Zap e Chaves entraram no
    // conjunto final, para diagnosticar "sumiço" silencioso.
    {
      const porPortal = new Map<string, number>();
      for (const p of chosen) porPortal.set(p.portal, (porPortal.get(p.portal) ?? 0) + 1);
      for (const [portal, n] of porPortal) {
        funilBusca.push({ etapa: `Selecionados de ${portal}`, total: n });
      }
      // Avisa quando um portal trouxe dados mas foi totalmente filtrado.
      for (const t of targets) {
        const recebidos =
          (perPortal[t]?.condominio.aproveitados ?? 0) +
          (perPortal[t]?.endereco.aproveitados ?? 0) +
          (perPortal[t]?.bairro.aproveitados ?? 0);
        const selecionados = porPortal.get(PORTAL_TARGETS[t]) ?? 0;
        if (recebidos > 0 && selecionados === 0) {
          funilBusca.push({
            etapa: `${PORTAL_TARGETS[t]}: ${recebidos} recebidos, mas TODOS removidos no filtro local (área/preço/quartos/raio)`,
            total: 0,
          });
        }
        if (recebidos === 0 && selecionados === 0) {
          funilBusca.push({
            etapa: `${PORTAL_TARGETS[t]}: consultado, 0 resultados retornados pelo portal`,
            total: 0,
          });
        }
      }
    }
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

    // PDP enrichment:
    //  - Always for items missing core fields (área/quartos) — usually
    //    "mesmo prédio" da OLX, que vinha mascarado com os valores do usuário.
    //  - Para os 3 primeiros, também enriquece condomínio / DOM / contato.
    const needsCore = (p: typeof properties[number]) =>
      !!p.url && (!p.areaUtil || p.areaUtil <= 0 || !p.quartos || p.incomplete);
    const needsExtras = (p: typeof properties[number]) =>
      !!p.url && (!p.condominio || p.condominio === 0 || !p.diasMercado || !p.advertiserPhone);
    const coreTargets = properties.filter(needsCore).slice(0, 6);
    const extraTargets = properties.slice(0, 3).filter((p) => needsExtras(p) && !coreTargets.includes(p));
    const top = [...coreTargets, ...extraTargets];
    let pdpNotFound = 0;
    await Promise.allSettled(
      top.map(async (p) => {
        try {
          pdpCalls++;
          const pdpTarget = PORTAL_NAME_TO_TARGET[p.portal] ?? "zapimoveis.com.br";
          const pdp = await geckoPdp({ data: { url: p.url, target: pdpTarget, studyId } });
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
    } else if (code.includes("GECKOAPI_UNAVAILABLE")) {
      warningMsg = "GeckoAPI indisponível no momento (todos os portais retornaram 5xx). Tente novamente em alguns minutos. Usando dados de demonstração.";
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
  const result = generateStudy(input, properties, overrides.fieldModes);
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
      const byLayer = perPortal[t];
      const recebidos = byLayer.condominio.recebidos + byLayer.endereco.recebidos + byLayer.bairro.recebidos;
      const aproveitados = byLayer.condominio.aproveitados + byLayer.endereco.aproveitados + byLayer.bairro.aproveitados;
      const descartados = byLayer.condominio.descartados + byLayer.endereco.descartados + byLayer.bairro.descartados;
      const label = PORTAL_TARGETS[t];
      const parts: string[] = [];
      if (byLayer.condominio.recebidos) parts.push(`cond:${byLayer.condominio.recebidos}`);
      if (byLayer.endereco.recebidos) parts.push(`end:${byLayer.endereco.recebidos}`);
      if (byLayer.bairro.recebidos) parts.push(`bairro:${byLayer.bairro.recebidos}`);
      const breakdown = parts.length ? ` [${parts.join(", ")}]` : "";
      funilBusca.push({
        etapa: `${label}: ${recebidos} recebidos / ${aproveitados} aproveitados${descartados ? ` / ${descartados} descartados` : ""}${breakdown}`,
        total: aproveitados,
      });
      // Per-layer zero recebidos — surfaces silent misses for debugging.
      const zeroLayers: string[] = [];
      if (byLayer.condominio.recebidos === 0 && priorizarEdificio) zeroLayers.push("condomínio");
      if (byLayer.endereco.recebidos === 0 && usarEndereco) zeroLayers.push("endereço");
      if (byLayer.bairro.recebidos === 0) zeroLayers.push("bairro");
      if (zeroLayers.length > 0) {
        funilBusca.push({ etapa: `${label}: 0 retornados em ${zeroLayers.join(", ")}`, total: 0 });
      }
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

  // Auto-gerar análise da IA junto com o estudo (best-effort: falha não bloqueia)
  if (!fellBack && result.comparaveis.length > 0) {
    try {
      onStep?.(4);
      const acm = computeAcm(result, result.acm ?? DEFAULT_ACM);
      const aiPayload = {
        imovel: {
          tipo: input.tipo,
          finalidade: input.finalidade,
          bairro: input.bairro,
          cidade: input.cidade,
          estado: input.estado,
          areaUtil: input.areaUtil,
          quartos: input.quartos,
          suites: input.suites,
          vagas: input.vagas,
          condominio: input.condominio,
          iptu: input.iptu,
          valorPretendido: input.valorPretendido,
          diferenciais: input.diferenciais ?? [],
          edificio: input.edificio,
        },
        mercado: {
          precoMedio: result.precoMedio,
          precoM2Medio: result.precoM2Medio,
          menorPreco: result.menorPreco,
          maiorPreco: result.maiorPreco,
          p10: result.stats?.p10,
          p25: result.stats?.p25,
          median: result.stats?.median,
          p75: result.stats?.p75,
          p90: result.stats?.p90,
          valorPiso: acm.valorPiso,
          valorSugerido: acm.valorSugerido,
        },
        comparaveis: result.comparaveis.slice(0, 15).map((c) => ({
          titulo: c.titulo,
          bairro: c.bairro,
          areaUtil: c.areaUtil,
          quartos: c.quartos,
          preco: c.preco,
          precoM2: c.precoM2,
          similaridade: c.similaridade,
          portal: c.portal,
        })),
      };
      const aiRes = await analisarMercadoIa({ data: aiPayload });
      if (aiRes.ok && aiRes.data?.resumo && aiRes.data?.faixaRecomendada && aiRes.data?.discursoProprietario) {
        result.aiAnalysis = aiRes.data;
      } else if (!aiRes.ok) {
        console.warn("[runStudy] análise da IA falhou:", aiRes.error);
      }
    } catch (e) {
      console.warn("[runStudy] análise da IA exceção:", (e as Error).message);
    }
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
  const allTokens = normalizeText(endereco).split(/[\s,]+/).filter(Boolean);
  // Name tokens: alphabetic, ≥3 chars, not a stopword. Number is optional.
  const nameTokens = allTokens.filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
  if (nameTokens.length === 0) return false;
  const hay = normalizeText(`${p.titulo} ${p.descricao} ${p.bairro}`);
  return nameTokens.every((t) => hay.includes(t));
}

/** Haversine distance in kilometers between two lat/lng pairs. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Busca um único imóvel pela URL do anúncio (Zap, Chaves na Mão ou OLX) via PDP.
 * Usada quando o usuário adiciona manualmente um imóvel ao estudo.
 */
export async function fetchPropertyByUrl(url: string): Promise<MockProperty> {
  const trimmed = (url ?? "").trim();
  if (!trimmed) throw new Error("Informe a URL do anúncio.");
  const detected = detectPortalFromUrl(trimmed);
  if (!detected) {
    throw new Error("URL não reconhecida. Use um link de Zap Imóveis, Chaves na Mão ou OLX.");
  }
  const res = await geckoPdp({ data: { url: trimmed, target: detected.target } });
  if (!res.ok) {
    throw new Error(res.errorMessage || res.errorCode || `Falha na PDP (${res.status})`);
  }
  if (res.notFound) {
    throw new Error("Anúncio não encontrado (PDP retornou notFound). O link pode estar inativo.");
  }
  if (!res.data || typeof res.data !== "object") {
    throw new Error("PDP não retornou dados utilizáveis.");
  }
  const outer = res.data as Record<string, unknown>;
  const inner = (outer.data && typeof outer.data === "object" ? outer.data : outer) as Record<string, unknown>;
  const property = geckoItemToProperty(inner as any, detected.portal);
  if (!property) {
    throw new Error("Não foi possível extrair preço/área do anúncio.");
  }
  if (!property.url) property.url = trimmed;
  return property;
}
