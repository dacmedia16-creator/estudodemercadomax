import { mockProperties, type MockProperty } from "./mock-properties";
import type { ComparableProperty, StudyInput, StudyResult, FieldMode, FieldKey } from "./study-types";
import { DEFAULT_FIELD_MODES } from "./study-types";

const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);

function similarity(
  input: StudyInput,
  p: MockProperty,
  modes: Record<FieldKey, FieldMode>,
): number {
  let score = 0;
  let total = 0;
  const w = (weight: number, match: number) => {
    score += weight * match;
    total += weight;
  };
  /** Modo "ignore" zera o peso do campo. Soft/Hard usam o peso normal. */
  const wf = (key: FieldKey, weight: number, match: number) => {
    if (modes[key] === "ignore") return;
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
  return Math.round((score / total) * 100);
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
    .map<ComparableProperty>((p) => ({
      ...p,
      precoM2: Math.round(p.preco / p.areaUtil),
      similaridade: similarity(input, p, modes),
    }))
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

  const precos = top10.map((p) => p.preco);
  const precosM2 = top10.map((p) => p.precoM2);
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

  const diagnostico = top10.length === 0
    ? `Nenhum imóvel compatível foi encontrado nesta busca. Tente ampliar os critérios (área, preço, bairros próximos) no painel "Ajustar critérios" abaixo.`
    : status === "Acima da média"
      ? `Com base nos ${top10.length} imóveis encontrados em ${input.bairro} e região, este imóvel está posicionado acima da média de mercado. Para aumentar a competitividade, recomenda-se trabalhar uma faixa entre ${fmt(faixaMin)} e ${fmt(faixaMax)}, destacando metragem, localização e diferenciais.`
      : status === "Abaixo da média"
      ? `Seu imóvel está abaixo da média de mercado em ${input.bairro}. Há espaço para reajuste de valor — a faixa recomendada vai de ${fmt(faixaMin)} a ${fmt(faixaMax)}, o que pode aumentar a margem sem comprometer a velocidade de venda.`
      : `Seu imóvel está bem posicionado em relação ao mercado de ${input.bairro}. A faixa competitiva está entre ${fmt(faixaMin)} e ${fmt(faixaMax)}. Reforce os diferenciais para acelerar a negociação.`;

  const pontosFortes: string[] = [];
  const avgArea = top10.length ? avg(top10.map((p) => p.areaUtil)) : input.areaUtil;
  const avgQuartos = top10.length ? avg(top10.map((p) => p.quartos)) : input.quartos;
  if (input.areaUtil >= avgArea) pontosFortes.push("Metragem acima da média da região");
  if (input.quartos >= avgQuartos) pontosFortes.push("Quantidade de quartos competitiva");
  if (input.diferenciais.length >= 4) pontosFortes.push("Boa quantidade de diferenciais");
  if (input.vagas >= 2) pontosFortes.push("Vagas de garagem valorizam o imóvel");
  if (pontosFortes.length === 0) pontosFortes.push("Localização em bairro consolidado");

  const pontosAtencao: string[] = [];
  if (status === "Acima da média") pontosAtencao.push("Preço acima da média de mercado");
  if (input.condominio > 900) pontosAtencao.push("Condomínio elevado em relação à concorrência");
  if (input.diferenciais.length < 3) pontosAtencao.push("Poucos diferenciais em relação à concorrência");
  if (input.areaUtil < avgArea * 0.85) pontosAtencao.push("Metragem abaixo da média");
  if (pontosAtencao.length === 0) pontosAtencao.push("Necessário destacar melhor o anúncio para se diferenciar");

  const tituloSugerido = `${input.tipo} ${input.quartos > 0 ? `${input.quartos} quartos` : ""} no ${input.bairro}${input.diferenciais.includes("Piscina") ? " com lazer completo" : ""}`.trim();

  const descricaoSugerida = `Este ${input.tipo.toLowerCase()} de ${input.areaUtil}m² no ${input.bairro} reúne ${input.quartos} quartos, ${input.vagas} vaga(s) e diferenciais como ${input.diferenciais.slice(0, 3).join(", ") || "ótima localização"}. Ideal para quem busca conforto, praticidade e uma região consolidada.`;

  const argumentoProprietario = `Com base nos imóveis semelhantes anunciados em ${input.bairro}, o preço ideal para gerar competitividade está entre ${fmt(faixaMin)} e ${fmt(faixaMax)}. Essa faixa aumenta as chances de atrair interessados qualificados sem desvalorizar o imóvel.`;

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    input,
    comparaveis: top10,
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