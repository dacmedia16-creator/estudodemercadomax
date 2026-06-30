import { mockProperties, type MockProperty } from "./mock-properties";
import type { ComparableProperty, StudyInput, StudyResult, FieldMode, FieldKey, StudyStats } from "./study-types";
import { DEFAULT_FIELD_MODES, DEFAULT_ACM, type AcmAdjustments } from "./study-types";

const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);

/** Percentil simples (interpolação linear) sobre uma lista já ordenada asc. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Score de confiança 0–100 por comparável.
 * Combina:
 *  - Completude (área, preço, condomínio, fotos)        → até 50 pts
 *  - Frescor do anúncio (DOM)                            → até 25 pts
 *  - Match estrutural (mesmo prédio/endereço, similaridade) → até 25 pts
 */
export function computeConfidence(p: Partial<MockProperty> & { similaridade?: number; mesmoCondominio?: boolean; mesmoEndereco?: boolean }): { score: number; factors: string[] } {
  const factors: string[] = [];
  let s = 0;
  // Completude (50)
  if (p.areaUtil && p.areaUtil > 0) s += 15; else factors.push("sem área");
  if (p.preco && p.preco > 0) s += 15; else factors.push("sem preço");
  if (p.condominio && p.condominio > 0) s += 8;
  if (p.imagem) s += 7;
  if (p.quartos && p.quartos > 0) s += 5;
  // DOM (25)
  if (typeof p.diasMercado === "number") {
    if (p.diasMercado <= 30) s += 25;
    else if (p.diasMercado <= 90) s += 18;
    else if (p.diasMercado <= 180) { s += 8; factors.push(`anúncio com ${p.diasMercado} dias`); }
    else { s += 0; factors.push(`anúncio antigo (${p.diasMercado}d)`); }
  } else {
    s += 12; // sem info, neutro
  }
  // Match (25)
  if (p.mesmoCondominio) s += 25;
  else if (p.mesmoEndereco) s += 18;
  else if (typeof p.similaridade === "number") s += Math.min(25, Math.round(p.similaridade * 0.25));
  if (p.incomplete) { s -= 10; factors.push("dados incompletos"); }
  if (p.aproximado) { s -= 5; factors.push("valores aproximados"); }
  s = Math.max(0, Math.min(100, Math.round(s)));
  return { score: s, factors };
}

/**
 * Deduplica anúncios que apontam para o mesmo imóvel — mesma área ±1m²,
 * mesmo preço ±2% e mesmo bairro. Mantém o representante com maior
 * confiança e anota `dedupCount`/`dedupAnunciantes` nele.
 */
function dedupComparables(list: ComparableProperty[]): ComparableProperty[] {
  if (list.length <= 1) return list;
  const used = new Set<string>();
  const out: ComparableProperty[] = [];
  for (const a of list) {
    if (used.has(a.id)) continue;
    const group = [a];
    // Só agrupa duplicatas óbvias: mesmo prédio/endereço + mesma área exata
    // + preço ±1%. Sem âncora de prédio/endereço, não deduplica.
    const aAnchor = a.mesmoCondominio || a.mesmoEndereco;
    if (aAnchor) {
      for (const b of list) {
        if (b.id === a.id || used.has(b.id)) continue;
        const bAnchor = b.mesmoCondominio || b.mesmoEndereco;
        if (!bAnchor) continue;
        const sameArea = a.areaUtil > 0 && b.areaUtil > 0 && a.areaUtil === b.areaUtil;
        const samePrice = a.preco > 0 && b.preco > 0 && Math.abs(a.preco - b.preco) / a.preco <= 0.01;
        if (sameArea && samePrice) group.push(b);
      }
    }
    group.sort((x, y) => (y.confidenceScore ?? 0) - (x.confidenceScore ?? 0));
    const rep = group[0];
    group.forEach((g) => used.add(g.id));
    if (group.length > 1) {
      rep.dedupCount = group.length;
      rep.dedupAnunciantes = Array.from(new Set(group.map((g) => g.anunciante).filter(Boolean))).slice(0, 3);
    }
    out.push(rep);
  }
  return out;
}

/** Percentil ponderado: cada valor recebe seu peso (default 1). */
function weightedPercentile(pairs: { v: number; w: number }[], p: number): number {
  const arr = pairs.filter((x) => Number.isFinite(x.v) && x.v > 0 && x.w > 0).sort((a, b) => a.v - b.v);
  if (arr.length === 0) return 0;
  if (arr.length === 1) return arr[0].v;
  const totalW = arr.reduce((s, x) => s + x.w, 0);
  const target = p * totalW;
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += arr[i].w;
    if (acc >= target) {
      if (i === 0) return arr[0].v;
      // interpolação linear entre arr[i-1] e arr[i]
      const prev = acc - arr[i].w;
      const frac = (target - prev) / arr[i].w;
      return arr[i - 1].v + frac * (arr[i].v - arr[i - 1].v);
    }
  }
  return arr[arr.length - 1].v;
}

/**
 * Estatísticas ponderadas: cada comparável contribui com peso baseado em
 * confiança e DOM (>120 dias → ×0.7). Itens com confiança < 30 não entram.
 */
export function computeStats(items: Array<{ precoM2: number; preco: number; confidenceScore?: number; diasMercado?: number }>): StudyStats | undefined {
  const pairs = items
    .filter((i) => Number.isFinite(i.precoM2) && i.precoM2 > 0)
    .map((i) => {
      const conf = typeof i.confidenceScore === "number" ? i.confidenceScore : 60;
      // Nunca excluir por confiança — só ajustar peso.
      let w = conf >= 60 ? 1 : conf >= 30 ? 0.75 : 0.5;
      if (typeof i.diasMercado === "number" && i.diasMercado > 120) w *= 0.7;
      return { v: i.precoM2, w };
    })
    .filter(Boolean) as { v: number; w: number }[];
  if (pairs.length === 0) return undefined;
  const totals = items.map((i) => i.preco).filter((n) => Number.isFinite(n) && n > 0);
  const weightedMean =
    pairs.reduce((s, x) => s + x.v * x.w, 0) / pairs.reduce((s, x) => s + x.w, 0);
  const variance =
    pairs.reduce((s, x) => s + x.w * Math.pow(x.v - weightedMean, 2), 0) /
    Math.max(1, pairs.reduce((s, x) => s + x.w, 0));
  const stdM2 = Math.sqrt(variance);
  const cv = weightedMean > 0 ? stdM2 / weightedMean : 0;
  const dispersao: "baixa" | "media" | "alta" = cv < 0.12 ? "baixa" : cv < 0.22 ? "media" : "alta";
  const sortedVals = pairs.map((x) => x.v).sort((a, b) => a - b);
  return {
    p10: Math.round(weightedPercentile(pairs, 0.1)),
    p25: Math.round(weightedPercentile(pairs, 0.25)),
    median: Math.round(weightedPercentile(pairs, 0.5)),
    p75: Math.round(weightedPercentile(pairs, 0.75)),
    p90: Math.round(weightedPercentile(pairs, 0.9)),
    minM2: sortedVals[0],
    maxM2: sortedVals[sortedVals.length - 1],
    minTotal: totals.length ? Math.min(...totals) : 0,
    stdM2: Math.round(stdM2),
    effectiveN: Math.round(pairs.reduce((s, x) => s + x.w, 0)),
    dispersao,
  };
}

/**
 * Sugere estratégia ACM (agressivo/equilibrado/premium) a partir do perfil
 * da amostra: alta dispersão → mediana; amostra pequena → P25 conservador;
 * DOM médio alto → P25.
 */
export function suggestEstrategia(
  stats: StudyStats | undefined,
  comparaveis: Array<{ diasMercado?: number }>,
): { estrategia: "agressivo" | "equilibrado" | "premium"; motivo: string } {
  if (!stats) return { estrategia: "equilibrado", motivo: "Amostra ausente — estratégia padrão." };
  const n = stats.effectiveN ?? 0;
  const domVals = comparaveis.map((c) => c.diasMercado).filter((v): v is number => typeof v === "number");
  const domAvg = domVals.length ? domVals.reduce((a, b) => a + b, 0) / domVals.length : 0;
  if (n < 5) return { estrategia: "agressivo", motivo: `Amostra pequena (${n} efetivos) — P25 reduz risco de superestimar.` };
  if (stats.dispersao === "alta") return { estrategia: "equilibrado", motivo: "Dispersão alta entre os comparáveis — mediana é mais robusta." };
  if (domAvg > 120) return { estrategia: "agressivo", motivo: `DOM médio ${Math.round(domAvg)}d — concorrência está parada no portal, preço mais agressivo acelera a venda.` };
  if (stats.dispersao === "baixa" && n >= 8) return { estrategia: "equilibrado", motivo: "Amostra robusta e dispersão baixa — mediana é referência segura." };
  return { estrategia: "equilibrado", motivo: "Mediana — equilíbrio entre velocidade de venda e teto da concorrência." };
}

/** Marca outliers de preço (R$/m² fora da banda P10×0.7..P90×1.3). */
function flagOutliers(list: ComparableProperty[], stats?: StudyStats): ComparableProperty[] {
  if (!stats) return list;
  const lo = stats.p10 * 0.7;
  const hi = stats.p90 * 1.3;
  return list.map((c) => ({
    ...c,
    outlier: c.precoM2 > 0 ? c.precoM2 < lo || c.precoM2 > hi : false,
  }));
}

function similarity(
  input: StudyInput,
  p: MockProperty,
  modes: Record<FieldKey, FieldMode>,
): { score: number; preferenciaAtendida: boolean } {
  let score = 0;
  let total = 0;
  let preferTotal = 0;
  let preferMet = 0;
  const w = (weight: number, match: number) => {
    score += weight * match;
    total += weight;
  };
  /**
   * Modo "ignore" zera o peso. "soft"/"hard" usam o peso normal.
   * "prefer" dobra o peso e adiciona bônus de até +5 pts quando o match >= 0.85,
   * sem penalizar quando o critério não é atendido (não elimina, só prioriza).
   */
  const wf = (key: FieldKey, weight: number, match: number) => {
    const mode = modes[key];
    if (mode === "ignore") return;
    if (mode === "prefer") {
      const boosted = weight * 2;
      score += boosted * match;
      total += boosted;
      preferTotal++;
      if (match >= 0.85) {
        score += 5;
        preferMet++;
      }
      return;
    }
    w(weight, match);
  };
  w(20, p.bairro === input.bairro ? 1 : input.bairrosProximos.includes(p.bairro) ? 0.6 : 0.1);
  w(10, p.cidade === input.cidade ? 1 : 0);
  // Area gets the highest weight — "mesmo tamanho" é o critério mais pedido.
  // Bônus extra quando a diferença é menor que 5% (basicamente o mesmo imóvel em metragem).
  const areaDiffPct = p.areaUtil > 0 ? Math.abs(p.areaUtil - input.areaUtil) / Math.max(input.areaUtil, 1) : 1;
  const areaScore = Math.max(0, 1 - areaDiffPct) + (areaDiffPct <= 0.05 ? 0.15 : 0);
  w(30, Math.min(1, areaScore));
  w(15, p.quartos === input.quartos ? 1 : Math.max(0, 1 - Math.abs(p.quartos - input.quartos) * 0.3));
  wf("vagas", 8, p.vagas === input.vagas ? 1 : Math.max(0, 1 - Math.abs(p.vagas - input.vagas) * 0.4));
  wf("suites", 7, p.suites === input.suites ? 1 : 0.5);
  // Banheiros / andar / ano / condo / IPTU only contribute when user enables them.
  if (typeof p.banheiros === "number") {
    wf("banheiros", 5, p.banheiros === input.banheiros ? 1 : Math.max(0, 1 - Math.abs(p.banheiros - input.banheiros) * 0.3));
  }
  if (typeof (p as any).andar === "number" && typeof input.andar === "number") {
    const diff = Math.abs((p as any).andar - input.andar);
    wf("andar", 4, diff === 0 ? 1 : Math.max(0, 1 - diff * 0.15));
  }
  if (typeof (p as any).anoConstrucao === "number" && typeof input.anoConstrucao === "number" && input.anoConstrucao > 0) {
    const diff = Math.abs((p as any).anoConstrucao - input.anoConstrucao);
    wf("anoConstrucao", 5, diff === 0 ? 1 : Math.max(0, 1 - diff / 20));
  }
  if (typeof p.condominio === "number" && input.condominio > 0) {
    const diffPct = Math.abs(p.condominio - input.condominio) / input.condominio;
    wf("condominio", 4, Math.max(0, 1 - diffPct));
  }
  if (typeof p.iptu === "number" && input.iptu > 0) {
    const diffPct = Math.abs(p.iptu - input.iptu) / input.iptu;
    wf("iptu", 3, Math.max(0, 1 - diffPct));
  }
  const diffMatch = input.diferenciais.length
    ? input.diferenciais.filter((d) => p.diferenciais.includes(d)).length /
      input.diferenciais.length
    : 0.5;
  wf("diferenciais", 15, diffMatch);
  w(10, 1 - Math.min(Math.abs(p.preco - input.valorPretendido) / Math.max(input.valorPretendido, 1), 1));
  return {
    score: Math.round((score / total) * 100),
    preferenciaAtendida: preferTotal > 0 && preferMet === preferTotal,
  };
}

/** Versão pública do cálculo de similaridade (para imóveis adicionados manualmente). */
export function computeSimilarity(
  input: StudyInput,
  p: MockProperty,
  fieldModes?: Partial<Record<FieldKey, FieldMode>>,
): number {
  const modes: Record<FieldKey, FieldMode> = { ...DEFAULT_FIELD_MODES, ...(fieldModes ?? {}) };
  return similarity(input, p, modes).score;
}

export function generateStudy(
  input: StudyInput,
  properties?: MockProperty[],
  fieldModes?: Partial<Record<FieldKey, FieldMode>>,
): StudyResult {
  const modes: Record<FieldKey, FieldMode> = { ...DEFAULT_FIELD_MODES, ...(fieldModes ?? {}) };
  const allBairros = [input.bairro, ...input.bairrosProximos];
  const usingExternal = !!(properties && properties.length > 0);
  const source = usingExternal ? properties! : mockProperties;
  const filtered = source
    .filter((p) => (usingExternal ? true : allBairros.includes(p.bairro) || p.cidade === input.cidade))
    .map<ComparableProperty>((p) => {
      const sim = similarity(input, p, modes);
      const base = {
        ...p,
        precoM2: Math.round(p.preco / p.areaUtil),
        similaridade: sim.score,
        preferenciaAtendida: sim.preferenciaAtendida,
      } as ComparableProperty;
      const conf = computeConfidence(base);
      base.confidenceScore = conf.score;
      base.confidenceFactors = conf.factors;
      return base;
    })
    .sort((a, b) => b.similaridade - a.similaridade);

  // Deduplicação semântica: agrupa anúncios que apontam para o mesmo imóvel.
  const dedupd = dedupComparables(filtered);

  // Portal interleaving: when more than one portal returned results, ensure
  // each portal contributes to the top 10 instead of one portal dominating.
  const top10 = (() => {
    if (!usingExternal || dedupd.length <= 10) return dedupd.slice(0, 10);
    const byPortal = new Map<string, ComparableProperty[]>();
    for (const p of dedupd) {
      const k = p.portal || "—";
      if (!byPortal.has(k)) byPortal.set(k, []);
      byPortal.get(k)!.push(p);
    }
    if (byPortal.size <= 1) return dedupd.slice(0, 10);
    const out: ComparableProperty[] = [];
    const queues = Array.from(byPortal.values());
    while (out.length < 10) {
      let added = false;
      for (const q of queues) {
        if (out.length >= 10) break;
        const next = q.shift();
        if (next) { out.push(next); added = true; }
      }
      if (!added) break;
    }
    return out.sort((a, b) => b.similaridade - a.similaridade);
  })();

  const stats = computeStats(top10);
  const top10WithFlags = flagOutliers(top10, stats);

  const precos = top10WithFlags.map((p) => p.preco);
  const precosM2 = top10WithFlags.filter((p) => p.precoM2 > 0).map((p) => p.precoM2);
  const precoMedio = precos.length ? Math.round(avg(precos)) : 0;
  const precoM2Medio = precosM2.length ? Math.round(avg(precosM2)) : 0;
  const menorPreco = precos.length ? Math.min(...precos) : 0;
  const maiorPreco = precos.length ? Math.max(...precos) : 0;
  const faixaMin = Math.round(precoMedio * 0.93);
  const faixaMax = Math.round(precoMedio * 1.07);
  const precoM2Pretendido = input.areaUtil > 0 ? Math.round(input.valorPretendido / input.areaUtil) : 0;

  const diff = precoMedio > 0 ? (input.valorPretendido - precoMedio) / precoMedio : 0;
  const status: StudyResult["status"] =
    diff < -0.08 ? "Abaixo da média" : diff > 0.08 ? "Acima da média" : "Dentro da média";

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Valor Ideal determinístico = mediana × área (quando há percentis); cai na média.
  const valorIdealDet = stats && stats.median > 0 && input.areaUtil > 0
    ? Math.round(stats.median * input.areaUtil)
    : precoMedio;

  const diagnostico = top10.length === 0
    ? `Nenhum imóvel compatível foi encontrado nesta busca. Tente ampliar os critérios (área, preço, bairros próximos) no painel "Ajustar critérios" abaixo.`
    : status === "Acima da média"
      ? `Com base nos ${top10.length} imóveis concorrentes em ${input.bairro} e região, o valor pretendido está acima da faixa praticada no mercado. Anúncios nessa faixa tendem a ficar mais tempo no portal, perder visibilidade e receber pouquíssimas visitas qualificadas. O valor ideal de mercado é ${fmt(valorIdealDet)} — para se manter competitivo e acelerar a venda, recomenda-se posicionar entre ${fmt(faixaMin)} e ${fmt(faixaMax)}.`
      : status === "Abaixo da média"
      ? `O valor pretendido está alinhado e competitivo frente ao mercado de ${input.bairro}. A faixa de referência da concorrência vai de ${fmt(faixaMin)} a ${fmt(faixaMax)} — manter o anúncio nesse patamar tende a gerar mais visitas qualificadas e encurtar o tempo de venda.`
      : `O valor pretendido está dentro da faixa praticada hoje em ${input.bairro}, porém próximo do teto da concorrência. O valor ideal de mercado é ${fmt(valorIdealDet)} — para garantir visitas qualificadas nas primeiras semanas e evitar que o anúncio esfrie no portal, a faixa mais competitiva está entre ${fmt(faixaMin)} e ${fmt(faixaMax)}.`;

  const pontosFortes: string[] = [];
  const areas = top10.filter((p) => p.areaUtil > 0).map((p) => p.areaUtil);
  const quartosArr = top10.filter((p) => p.quartos > 0).map((p) => p.quartos);
  const avgArea = areas.length ? avg(areas) : input.areaUtil;
  const avgQuartos = quartosArr.length ? avg(quartosArr) : input.quartos;
  if (input.areaUtil >= avgArea) pontosFortes.push("Metragem acima da média da região");
  if (input.quartos >= avgQuartos) pontosFortes.push("Quantidade de quartos competitiva");
  if (input.diferenciais.length >= 4) pontosFortes.push("Boa quantidade de diferenciais");
  if (input.vagas >= 2) pontosFortes.push("Vagas de garagem valorizam o imóvel");
  if (pontosFortes.length === 0) pontosFortes.push("Localização em bairro consolidado");

  const pontosAtencao: string[] = [];
  if (status === "Acima da média") pontosAtencao.push("Preço acima da média de mercado");
  if (status === "Dentro da média") pontosAtencao.push("Próximo do teto da faixa praticada — risco de tempo de venda mais longo");
  if (input.condominio > 900) pontosAtencao.push("Condomínio elevado em relação à concorrência");
  if (input.diferenciais.length < 3) pontosAtencao.push("Poucos diferenciais em relação à concorrência");
  if (input.areaUtil < avgArea * 0.85) pontosAtencao.push("Metragem abaixo da média");
  if (pontosAtencao.length === 0) pontosAtencao.push("Necessário destacar melhor o anúncio para se diferenciar");

  const tituloSugerido = `${input.tipo} ${input.quartos > 0 ? `${input.quartos} quartos` : ""} no ${input.bairro}${input.diferenciais.includes("Piscina") ? " com lazer completo" : ""}`.trim();

  const descricaoSugerida = `Este ${input.tipo.toLowerCase()} de ${input.areaUtil}m² no ${input.bairro} reúne ${input.quartos} quartos, ${input.vagas} vaga(s) e diferenciais como ${input.diferenciais.slice(0, 3).join(", ") || "ótima localização"}. Ideal para quem busca conforto, praticidade e uma região consolidada.`;

  const argumentoProprietario = `Com base nos imóveis semelhantes anunciados em ${input.bairro}, o valor ideal de mercado é ${fmt(valorIdealDet)} e a faixa competitiva de publicação fica entre ${fmt(faixaMin)} e ${fmt(faixaMax)}. Posicionar nessa faixa aumenta as chances de atrair interessados qualificados sem desvalorizar o imóvel.`;

  // Valor Ideal range + estratégia sugerida
  const valorIdealDetCalc = stats && stats.median > 0 && input.areaUtil > 0
    ? Math.round(stats.median * input.areaUtil)
    : precoMedio;
  const valorIdealRange = stats && input.areaUtil > 0
    ? (() => {
        // Intervalo: ± 1 desvio-padrão × área, com piso em P25 e teto em P75
        const ds = (stats.stdM2 ?? 0) * input.areaUtil;
        const min = Math.max(stats.p25 * input.areaUtil, valorIdealDetCalc - ds);
        const max = Math.min(stats.p75 * input.areaUtil, valorIdealDetCalc + ds);
        const confianca: "alta" | "media" | "baixa" =
          stats.dispersao === "baixa" && (stats.effectiveN ?? 0) >= 6 ? "alta"
          : stats.dispersao === "alta" || (stats.effectiveN ?? 0) < 4 ? "baixa"
          : "media";
        return { min: Math.round(min), ideal: valorIdealDetCalc, max: Math.round(max), confianca };
      })()
    : undefined;
  const estrategiaSugerida = suggestEstrategia(stats, top10WithFlags);

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    input,
    comparaveis: top10WithFlags,
    stats,
    precoMedio,
    precoM2Medio,
    menorPreco,
    maiorPreco,
    faixaMin,
    faixaMax,
    precoM2Pretendido,
    status,
    diagnostico,
    pontosFortes,
    pontosAtencao,
    tituloSugerido,
    descricaoSugerida,
    argumentoProprietario,
    valorIdealRange,
    estrategiaSugerida,
  };
}

export const formatBRL = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

/**
 * Valor Ideal de mercado — referência única para todo discurso de "ajuste sugerido".
 * Prioridade:
 *   1) faixaRecomendada.ideal da IA (quando rodou);
 *   2) mediana × área (quando há percentis);
 *   3) acm.valorSugerido (compatibilidade).
 */
export function getValorIdeal(
  study: { aiAnalysis?: { faixaRecomendada?: { ideal?: number } } | null; stats?: { median?: number } | null; input: { areaUtil: number } },
  acm: { valorSugerido: number },
): number {
  // Sanidade: a IA tem prioridade, MAS se divergir mais de 15% da mediana×área,
  // o motor descarta o número da IA e usa o determinístico. Evita que a IA
  // "viaje" no PDF.
  const median = study.stats?.median;
  const area = study.input.areaUtil;
  const det = typeof median === "number" && median > 0 && area > 0 ? Math.round(median * area) : 0;
  const ia = study.aiAnalysis?.faixaRecomendada?.ideal;
  if (typeof ia === "number" && ia > 0) {
    if (det > 0) {
      const diff = Math.abs(ia - det) / det;
      if (diff > 0.25) {
        // marca metadata para a UI saber que a IA foi sobrescrita
        try {
          (study as { iaSobrescrita?: boolean }).iaSobrescrita = true;
        } catch { /* readonly: ignore */ }
        return det;
      }
    }
    return Math.round(ia);
  }
  if (det > 0) return det;
  return acm.valorSugerido;
}

export interface AcmComputed {
  multiplicador: number;
  valorM2Avaliado: number;
  descontoReforma: number;
  valorSugerido: number;
  valorMaximoPublicacao: number;
  valorMinimoFechamento: number;
  /** Piso competitivo (R$ total) — quanto o sugerido pode no mínimo ficar acima do menor preço. */
  valorPiso: number;
  /** Quando true, o piso clampeou o sugerido para cima. */
  pisoAplicado: boolean;
  /** R$/m² base usado conforme a estratégia (mediana/P25/P75) — cai na média quando não há stats. */
  baseM2: number;
}

/** Calcula o resumo no estilo da ACM clássica usada por corretores. */
export function computeAcm(study: StudyResult, adj?: Partial<AcmAdjustments>): AcmComputed {
  const a: AcmAdjustments = { ...DEFAULT_ACM, ...(study.acm ?? {}), ...(adj ?? {}) };
  const mult = (a.localizacao / 100) * (a.conservacao / 100) * (a.idade / 100) * (a.padrao / 100);
  // Estratégia: mediana (default), P25 (agressivo) ou P75 (premium). Cai na média se não houver stats.
  const stats = study.stats;
  const baseM2 = stats
    ? a.estrategia === "agressivo" ? stats.p25
      : a.estrategia === "premium" ? stats.p75
      : stats.median
    : study.precoM2Medio;
  const valorM2Avaliado = Math.round(baseM2 * mult);
  const area = study.input.areaUtil || 0;
  const descontoReforma = Math.round(a.reformaPorM2 * area);
  const valorSugeridoRaw = Math.max(0, valorM2Avaliado * area - descontoReforma);

  // Piso competitivo: max(P10 × área, menorPreço × 1.02). Garante que o sugerido
  // não fica "muito longe" do mais barato do mercado.
  let valorPiso = 0;
  if (area > 0 && stats) {
    const pisoPorM2 = Math.max(stats.p10, stats.minM2 * 1.02);
    valorPiso = Math.round(pisoPorM2 * area);
  }
  if (study.menorPreco > 0) {
    valorPiso = Math.max(valorPiso, Math.round(study.menorPreco * 1.02));
  }

  let valorSugerido = valorSugeridoRaw;
  let pisoAplicado = false;
  if (a.respeitarPiso && valorPiso > 0) {
    const teto = valorPiso * (1 + (a.maxAcimaPisoPct ?? 8) / 100);
    if (valorSugerido > teto) {
      valorSugerido = teto;
      pisoAplicado = true;
    }
    // Garante que não cai abaixo do piso também — não faz sentido sugerir abaixo do mais barato.
    if (valorSugerido < valorPiso) valorSugerido = valorPiso;
  }

  const margem = (a.margemPublicacaoPct || 0) / 100;
  return {
    multiplicador: mult,
    valorM2Avaliado,
    descontoReforma,
    valorSugerido: Math.round(valorSugerido),
    valorMaximoPublicacao: Math.round(valorSugerido * (1 + margem)),
    valorMinimoFechamento: Math.round(valorSugerido * (1 - margem)),
    valorPiso,
    pisoAplicado,
    baseM2: Math.round(baseM2),
  };
}

/**
 * Recalcula médias, faixa, status, diagnóstico e pontos fortes/atenção a partir
 * da lista de comparáveis fornecida, preservando o restante do estudo (id,
 * input, ACM, overrides, etc.). Usado quando o usuário remove ou adiciona
 * imóveis manualmente no relatório.
 */
export function recomputeStudy(prev: StudyResult, comparaveis: ComparableProperty[]): StudyResult {
  const input = prev.input;
  const list = comparaveis.map((c) => ({
    ...c,
    precoM2: c.areaUtil > 0 ? Math.round(c.preco / c.areaUtil) : c.precoM2 ?? 0,
  }));
  // (re)calcula confiança caso o item ainda não tenha
  for (const c of list) {
    if (typeof c.confidenceScore !== "number") {
      const conf = computeConfidence(c);
      c.confidenceScore = conf.score;
      c.confidenceFactors = conf.factors;
    }
  }
  const dedupd = dedupComparables(list);
  const stats = computeStats(dedupd);
  const listFlag = flagOutliers(dedupd, stats);
  const precos = listFlag.map((p) => p.preco);
  const precosM2 = listFlag.filter((p) => p.precoM2 > 0).map((p) => p.precoM2);
  const precoMedio = precos.length ? Math.round(avg(precos)) : 0;
  const precoM2Medio = precosM2.length ? Math.round(avg(precosM2)) : 0;
  const menorPreco = precos.length ? Math.min(...precos) : 0;
  const maiorPreco = precos.length ? Math.max(...precos) : 0;
  const faixaMin = Math.round(precoMedio * 0.93);
  const faixaMax = Math.round(precoMedio * 1.07);
  const precoM2Pretendido = input.areaUtil > 0 ? Math.round(input.valorPretendido / input.areaUtil) : 0;
  const diff = precoMedio > 0 ? (input.valorPretendido - precoMedio) / precoMedio : 0;
  const status: StudyResult["status"] =
    diff < -0.08 ? "Abaixo da média" : diff > 0.08 ? "Acima da média" : "Dentro da média";

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const diagnostico = list.length === 0
    ? `Nenhum imóvel compatível foi encontrado nesta busca. Tente ampliar os critérios (área, preço, bairros próximos) no painel "Ajustar critérios" abaixo.`
    : status === "Acima da média"
      ? `Com base nos ${list.length} imóveis concorrentes em ${input.bairro} e região, o valor pretendido está acima da faixa praticada no mercado. Anúncios nessa faixa tendem a ficar mais tempo no portal, perder visibilidade e receber pouquíssimas visitas qualificadas. Para se manter competitivo e acelerar a venda, recomenda-se posicionar entre ${fmt(faixaMin)} e ${fmt(faixaMax)}.`
      : status === "Abaixo da média"
        ? `O valor pretendido está alinhado e competitivo frente ao mercado de ${input.bairro}. A faixa de referência da concorrência vai de ${fmt(faixaMin)} a ${fmt(faixaMax)} — manter o anúncio nesse patamar tende a gerar mais visitas qualificadas e encurtar o tempo de venda.`
        : `O valor pretendido está dentro da faixa praticada hoje em ${input.bairro}, porém próximo do teto da concorrência. Para garantir visitas qualificadas nas primeiras semanas e evitar que o anúncio esfrie no portal, a faixa mais competitiva está entre ${fmt(faixaMin)} e ${fmt(faixaMax)}.`;

  const areas = list.filter((p) => p.areaUtil > 0).map((p) => p.areaUtil);
  const avgArea = areas.length ? avg(areas) : input.areaUtil;
  const avgQuartos = list.length ? avg(list.map((p) => p.quartos)) : input.quartos;
  const pontosFortes: string[] = [];
  if (input.areaUtil >= avgArea) pontosFortes.push("Metragem acima da média da região");
  if (input.quartos >= avgQuartos) pontosFortes.push("Quantidade de quartos competitiva");
  if (input.diferenciais.length >= 4) pontosFortes.push("Boa quantidade de diferenciais");
  if (input.vagas >= 2) pontosFortes.push("Vagas de garagem valorizam o imóvel");
  if (pontosFortes.length === 0) pontosFortes.push("Localização em bairro consolidado");

  const pontosAtencao: string[] = [];
  if (status === "Acima da média") pontosAtencao.push("Preço acima da média de mercado");
  if (status === "Dentro da média") pontosAtencao.push("Próximo do teto da faixa praticada — risco de tempo de venda mais longo");
  if (input.condominio > 900) pontosAtencao.push("Condomínio elevado em relação à concorrência");
  if (input.diferenciais.length < 3) pontosAtencao.push("Poucos diferenciais em relação à concorrência");
  if (input.areaUtil < avgArea * 0.85) pontosAtencao.push("Metragem abaixo da média");
  if (pontosAtencao.length === 0) pontosAtencao.push("Necessário destacar melhor o anúncio para se diferenciar");

  const valorIdealDetCalc = stats && stats.median > 0 && input.areaUtil > 0
    ? Math.round(stats.median * input.areaUtil)
    : precoMedio;
  const valorIdealRange = stats && input.areaUtil > 0
    ? (() => {
        const ds = (stats.stdM2 ?? 0) * input.areaUtil;
        const min = Math.max(stats.p25 * input.areaUtil, valorIdealDetCalc - ds);
        const max = Math.min(stats.p75 * input.areaUtil, valorIdealDetCalc + ds);
        const confianca: "alta" | "media" | "baixa" =
          stats.dispersao === "baixa" && (stats.effectiveN ?? 0) >= 6 ? "alta"
          : stats.dispersao === "alta" || (stats.effectiveN ?? 0) < 4 ? "baixa"
          : "media";
        return { min: Math.round(min), ideal: valorIdealDetCalc, max: Math.round(max), confianca };
      })()
    : undefined;
  const estrategiaSugerida = suggestEstrategia(stats, listFlag);

  return {
    ...prev,
    comparaveis: listFlag,
    stats,
    precoMedio,
    precoM2Medio,
    menorPreco,
    maiorPreco,
    faixaMin,
    faixaMax,
    precoM2Pretendido,
    status,
    diagnostico,
    pontosFortes,
    pontosAtencao,
    valorIdealRange,
    estrategiaSugerida,
  };
}