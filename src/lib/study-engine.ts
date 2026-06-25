import { mockProperties, type MockProperty } from "./mock-properties";
import type { ComparableProperty, StudyInput, StudyResult } from "./study-types";

const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);

function similarity(input: StudyInput, p: MockProperty): number {
  let score = 0;
  let total = 0;
  const w = (weight: number, match: number) => {
    score += weight * match;
    total += weight;
  };
  w(20, p.bairro === input.bairro ? 1 : input.bairrosProximos.includes(p.bairro) ? 0.6 : 0.1);
  w(10, p.cidade === input.cidade ? 1 : 0);
  w(15, 1 - Math.min(Math.abs(p.areaUtil - input.areaUtil) / Math.max(input.areaUtil, 1), 1));
  w(15, p.quartos === input.quartos ? 1 : Math.max(0, 1 - Math.abs(p.quartos - input.quartos) * 0.3));
  w(8, p.vagas === input.vagas ? 1 : Math.max(0, 1 - Math.abs(p.vagas - input.vagas) * 0.4));
  w(7, p.suites === input.suites ? 1 : 0.5);
  const diffMatch = input.diferenciais.length
    ? input.diferenciais.filter((d) => p.diferenciais.includes(d)).length /
      input.diferenciais.length
    : 0.5;
  w(15, diffMatch);
  w(10, 1 - Math.min(Math.abs(p.preco - input.valorPretendido) / Math.max(input.valorPretendido, 1), 1));
  return Math.round((score / total) * 100);
}

export function generateStudy(input: StudyInput): StudyResult {
  const allBairros = [input.bairro, ...input.bairrosProximos];
  const filtered = mockProperties
    .filter((p) => allBairros.includes(p.bairro) || p.cidade === input.cidade)
    .map<ComparableProperty>((p) => ({
      ...p,
      precoM2: Math.round(p.preco / p.areaUtil),
      similaridade: similarity(input, p),
    }))
    .sort((a, b) => b.similaridade - a.similaridade)
    .slice(0, 10);

  const precos = filtered.map((p) => p.preco);
  const precosM2 = filtered.map((p) => p.precoM2);
  const precoMedio = Math.round(avg(precos));
  const precoM2Medio = Math.round(avg(precosM2));
  const menorPreco = Math.min(...precos);
  const maiorPreco = Math.max(...precos);
  const faixaMin = Math.round(precoMedio * 0.93);
  const faixaMax = Math.round(precoMedio * 1.07);
  const precoM2Pretendido = Math.round(input.valorPretendido / input.areaUtil);

  const diff = (input.valorPretendido - precoMedio) / precoMedio;
  const status: StudyResult["status"] =
    diff < -0.08 ? "Abaixo da média" : diff > 0.08 ? "Acima da média" : "Dentro da média";

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const diagnostico =
    status === "Acima da média"
      ? `Com base nos ${filtered.length} imóveis encontrados em ${input.bairro} e região, este imóvel está posicionado acima da média de mercado. Para aumentar a competitividade, recomenda-se trabalhar uma faixa entre ${fmt(faixaMin)} e ${fmt(faixaMax)}, destacando metragem, localização e diferenciais.`
      : status === "Abaixo da média"
      ? `Seu imóvel está abaixo da média de mercado em ${input.bairro}. Há espaço para reajuste de valor — a faixa recomendada vai de ${fmt(faixaMin)} a ${fmt(faixaMax)}, o que pode aumentar a margem sem comprometer a velocidade de venda.`
      : `Seu imóvel está bem posicionado em relação ao mercado de ${input.bairro}. A faixa competitiva está entre ${fmt(faixaMin)} e ${fmt(faixaMax)}. Reforce os diferenciais para acelerar a negociação.`;

  const pontosFortes: string[] = [];
  const avgArea = avg(filtered.map((p) => p.areaUtil));
  const avgQuartos = avg(filtered.map((p) => p.quartos));
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
    comparaveis: filtered,
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

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });