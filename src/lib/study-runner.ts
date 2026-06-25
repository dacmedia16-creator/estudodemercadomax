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

  try {
    onStep?.(1);
    const businessType: "sale" | "rent" = finalidade === "Aluguel" ? "rent" : "sale";
    const propertyType = mapTipoToPropertyType(tipo);

    const bedroomsArr: number[] = [];
    for (let q = quartosMin; q <= quartosMax; q++) if (q > 0) bedroomsArr.push(q);

    const plpRes = await geckoPlp({
      data: {
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
        page: 1,
      },
    });

    if (!plpRes.ok) {
      throw new Error(plpRes.errorMessage || plpRes.errorCode || "Falha GeckoAPI");
    }

    const items: GeckoItem[] = plpRes.data?.items ?? [];
    if (items.length === 0) throw new Error("Nenhum imóvel encontrado");

    onStep?.(2);
    const normalized = items
      .map((it) => geckoItemToProperty(it))
      .filter((p): p is MockProperty => p !== null);
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
  if (criteriosAplicados.length) result.criteriosAplicados = criteriosAplicados;
  if (funilBusca.length) result.funilBusca = funilBusca;
  result.overridesAplicados = overrides;
  if (fellBack) {
    result.diagnostico = `[Dados de demonstração] ${result.diagnostico}`;
  } else if (warningMsg) {
    result.diagnostico = `[${warningMsg}] ${result.diagnostico}`;
  }

  return { result, warning: warningMsg, fellBack };
}