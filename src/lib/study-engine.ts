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

/** Calcula a distribuição de R$/m² e mínimo de preço total. */
export function computeStats(items: { precoM2: number; preco: number }[]): StudyStats | undefined {
  const m2 = items.map((i) => i.precoM2).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const totals = items.map((i) => i.preco).filter((n) => Number.isFinite(n) && n > 0);
  if (m2.length === 0) return undefined;
  return {
    p10: Math.round(percentile(m2, 0.1)),
    p25: Math.round(percentile(m2, 0.25)),
    median: Math.round(percentile(m2, 0.5)),
    p75: Math.round(percentile(m2, 0.75)),
    p90: Math.round(percentile(m2, 0.9)),
    minM2: m2[0],
    maxM2: m2[m2.length - 1],
    minTotal: totals.length ? Math.min(...totals) : 0,
  };
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
      return {
        ...p,
        precoM2: Math.round(p.preco / p.areaUtil),
        similaridade: sim.score,
        preferenciaAtendida: sim.preferenciaAtendida,
      };
    })
    .sort((a, b) => b.similaridade - a.similaridade);

  // Portal interleaving: when more than one portal returned results, ensure
  // each portal contributes to the top 10 instead of one portal dominating.
  const top10 = (() => {
    if (!usingExternal || filtered.length <= 10) return filtered.slice(0, 10);
    const byPortal = new Map<string, ComparableProperty[]>();
    for (const p of filtered) {
      const k = p.portal || "—";
      if (!byPortal.has(k)) byPortal.set(k, []);
      byPortal.get(k)!.push(p);
    }
    if (byPortal.size <= 1) return filtered.slice(0, 10);
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
  const ia = study.aiAnalysis?.faixaRecomendada?.ideal;
  if (typeof ia === "number" && ia > 0) return Math.round(ia);
  const median = study.stats?.median;
  const area = study.input.areaUtil;
  if (typeof median === "number" && median > 0 && area > 0) return Math.round(median * area);
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
  const stats = computeStats(list);
  const listFlag = flagOutliers(list, stats);
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
  };
}