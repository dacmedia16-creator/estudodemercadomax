import { computeAcm, formatBRL } from "@/lib/study-engine";
import { DEFAULT_ACM, type ComparableProperty, type StudyResult } from "@/lib/study-types";
import { brandingStore } from "@/lib/branding-store";

/**
 * Página única estilo ACM (Análise Comparativa de Mercado) — A4 paisagem.
 * Visível somente em `@media print` quando `<html>` tem a classe `print-mode-slides`.
 * Layout inspirado no template VIP7 Imóveis: tabela de imóveis similares,
 * definição do imóvel e bloco de resumo de avaliação com valor sugerido em destaque.
 */
export function PrintSlides({
  study,
  sorted,
  variant = "print",
}: {
  study: StudyResult;
  sorted: StudyResult["comparaveis"];
  variant?: "print" | "screen";
}) {
  const { input } = study;
  const a = study.acm ?? DEFAULT_ACM;
  const acm = computeAcm(study, a);
  const branding = brandingStore.get();

  // Até 10 comparáveis, priorizando os de maior similaridade.
  const top = sorted.slice(0, 10);
  const pctImovel = acm.valorSugerido > 0
    ? Math.round((input.valorPretendido / acm.valorSugerido) * 100)
    : 0;

  // CSS vars injetadas para colorir as faixas a partir da marca do usuário.
  const styleVars = {
    ["--acm-brand" as string]: branding.brandColor,
    ["--acm-accent" as string]: branding.accentColor,
  } as React.CSSProperties;

  const data = new Date(study.createdAt).toLocaleDateString("pt-BR");

  return (
    <section
      className={`print-slides${variant === "screen" ? " print-slides-screen" : ""}`}
      style={styleVars}
    >
      <div className="slide-page acm-page">
        {/* Cabeçalho com logo + título */}
        <div className="acm-header">
          <div className="acm-logo">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.brandName} />
            ) : (
              <div className="acm-logo-placeholder">
                <span>{initials(branding.brandName)}</span>
              </div>
            )}
            <div className="acm-brand-name">{branding.brandName}</div>
          </div>
          <div className="acm-title">Análise Comparativa de Mercado</div>
        </div>

        {/* Faixa amarela separadora */}
        <div className="acm-stripe" />

        {/* Tabela: Imóveis Similares */}
        <table className="acm-table acm-table-similares">
          <thead>
            <tr>
              <th className="acm-th-main">Imóveis Similares</th>
              <th>M²</th>
              <th>Nº DORM</th>
              <th>Nº SUÍTES</th>
              <th>Nº VAGAS</th>
              <th>VALOR CONDOMÍNIO</th>
              <th>VALOR DE VENDA</th>
              <th>VALOR DO M²</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c, i) => (
              <tr key={c.id}>
                <td className="acm-link-cell">
                  <span className="acm-row-num">{i + 1}</span>
                  {c.url ? (
                    <a href={c.url} className="acm-link" target="_blank" rel="noreferrer">{c.url}</a>
                  ) : (
                    <span className="acm-link">{c.titulo}</span>
                  )}
                </td>
                <td className="num">{c.areaUtil > 0 ? c.areaUtil : "—"}</td>
                <td className="num">{c.quartos > 0 ? c.quartos : "—"}</td>
                <td className="num">{c.suites && c.suites > 0 ? c.suites : "—"}</td>
                <td className="num">{c.vagas && c.vagas > 0 ? c.vagas : "—"}</td>
                <td className="num">{c.condominio ? formatBRL(c.condominio) : "R$ 0,00"}</td>
                <td className="num">{formatBRL(c.preco)}</td>
                <td className="num acm-bold">{c.precoM2 > 0 ? formatBRL(c.precoM2) : "—"}</td>
              </tr>
            ))}
            {top.length === 0 && (
              <tr>
                <td colSpan={8} className="acm-empty">Nenhum comparável encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Tabela: Definição do imóvel analisado */}
        <table className="acm-table acm-table-definicao">
          <thead>
            <tr>
              <th className="acm-th-main">Definição do Imóvel</th>
              <th>M²</th>
              <th>Dorms</th>
              <th>Suítes</th>
              <th>Vagas</th>
              <th>Condomínio</th>
              <th>Cond por m²</th>
              <th>Andar</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="acm-link-cell acm-definicao-nome">
                <span className="acm-row-num">1</span>
                <span>{input.edificio ? input.edificio : `${input.tipo} · ${input.bairro}`}</span>
              </td>
              <td className="num acm-bold">{input.areaUtil}</td>
              <td className="num acm-bold">{input.quartos}</td>
              <td className="num acm-bold">{input.suites ?? 0}</td>
              <td className="num acm-bold">{input.vagas ?? 0}</td>
              <td className="num">{input.condominio ? formatBRL(input.condominio) : "R$ —"}</td>
              <td className="num">{input.condominio && input.areaUtil > 0 ? formatBRL(input.condominio / input.areaUtil) : "R$ —"}</td>
              <td className="num">{input.andar ?? 0}</td>
            </tr>
          </tbody>
        </table>

        {/* Bloco resumo: esquerda (reforma + nº similares) + direita (avaliação) */}
        <div className="acm-resumo">
          <div className="acm-resumo-left">
            <div className="acm-resumo-left-row acm-resumo-head">Valor do m² para Reforma</div>
            <div className="acm-resumo-left-row">{a.reformaPorM2 > 0 ? formatBRL(a.reformaPorM2) : "R$ 0,00"}</div>
            <div className="acm-resumo-left-row acm-resumo-head">Número de Imóveis Similares</div>
            <div className="acm-resumo-left-row acm-similares-count">{study.comparaveis.length}</div>
          </div>

          <div className="acm-resumo-right">
            <div className="acm-resumo-right-title">RESUMO — AVALIAÇÃO PARA VENDA</div>
            <ResumoRow label="Média do m²" value={formatBRL(study.precoM2Medio)} />
            <ResumoRow label="% do imóvel" value={`${pctImovel}%`} />
            <ResumoRow label="Valor avaliado para o m²" value={formatBRL(acm.valorM2Avaliado)} />
            <ResumoRow
              label="Valor de Reforma/Atualização"
              value={acm.descontoReforma > 0 ? `- ${formatBRL(acm.descontoReforma)}` : "R$ —"}
            />
            <ResumoRow
              label="Valor sugerido (considerando estado)"
              value={formatBRL(acm.valorSugerido)}
              variant="highlight"
            />
            <ResumoRow
              label="Valor Máximo de Publicação"
              value={formatBRL(acm.valorMaximoPublicacao)}
              variant="success"
            />
          </div>
        </div>

        {/* Rodapé com legenda de reforma + fatores ACM */}
        <div className="acm-footer">
          <div className="acm-legend">
            <div>Reforma estética: R$ 200 – R$ 500/m²</div>
            <div>Reforma estrutural: R$ 1.000 – R$ 2.000/m²</div>
          </div>
          <div className="acm-fatores">
            <Fator label="Localização" value={a.localizacao} />
            <Fator label="Estado de Conservação" value={a.conservacao} />
            <Fator label="Idade" value={a.idade} />
            <Fator label="Padrão" value={a.padrao} />
          </div>
        </div>

        <div className="acm-page-meta">
          {branding.brandName} · estudo {study.id.slice(0, 8)} · {data}
        </div>
      </div>

      <OwnerPersuasionPage study={study} sorted={sorted} acm={acm} dataStr={data} brandName={branding.brandName} />

      <OwnerLetterPage study={study} acm={acm} dataStr={data} brandName={branding.brandName} />
    </section>
  );
}

/* -------------------------------------------------------------------------
 * Página 2 — "Argumentos para o Proprietário"
 * Material pronto para o corretor defender uma redução / ajuste de preço.
 * Usa apenas dados já presentes no estudo (stats, comparaveis, acm,
 * aiAnalysis). Quando não há aiAnalysis, gera bullets determinísticos.
 * ----------------------------------------------------------------------- */
function OwnerPersuasionPage({
  study,
  sorted,
  acm,
  dataStr,
  brandName,
}: {
  study: StudyResult;
  sorted: ComparableProperty[];
  acm: ReturnType<typeof computeAcm>;
  dataStr: string;
  brandName: string;
}) {
  const { input, comparaveis, stats } = study;
  const pretendido = input.valorPretendido;
  const sugerido = acm.valorSugerido;
  const gap = pretendido - sugerido;
  const gapPct = sugerido > 0 ? (gap / sugerido) * 100 : 0;

  const baratos = [...comparaveis]
    .filter((c) => c.preco > 0)
    .sort((a, b) => {
      // mesmo prédio/endereço primeiro
      const rank = (c: ComparableProperty) =>
        (c.mesmoCondominio ? 0 : c.mesmoEndereco ? 1 : 2);
      const r = rank(a) - rank(b);
      return r !== 0 ? r : a.preco - b.preco;
    })
    .slice(0, 5);

  const abaixoCount = comparaveis.filter((c) => c.preco > 0 && c.preco < pretendido).length;
  const totalComps = comparaveis.length;
  const menorPreco = comparaveis.reduce(
    (min, c) => (c.preco > 0 && (min === 0 || c.preco < min) ? c.preco : min),
    0,
  );

  // Posição percentil aproximada do preço pretendido
  let percentilPos: string | null = null;
  if (stats && pretendido > 0) {
    if (pretendido >= stats.p90) percentilPos = "topo 10%";
    else if (pretendido >= stats.p75) percentilPos = "topo 25%";
    else if (pretendido >= stats.median) percentilPos = "metade superior";
    else if (pretendido >= stats.p25) percentilPos = "metade inferior";
    else percentilPos = "25% mais baratos";
  }

  const precoM2Pretendido = input.areaUtil > 0 ? pretendido / input.areaUtil : 0;
  const acimaMedianaM2 =
    stats && stats.median > 0 && precoM2Pretendido > 0
      ? ((precoM2Pretendido - stats.median) / stats.median) * 100
      : 0;

  // Faixa recomendada: usa IA quando existe; senão deriva dos percentis
  const faixa = study.aiAnalysis?.faixaRecomendada ?? (stats
    ? { entrada: stats.p25 * (input.areaUtil || 1), ideal: stats.median * (input.areaUtil || 1), teto: stats.p75 * (input.areaUtil || 1) }
    : { entrada: sugerido * 0.95, ideal: sugerido, teto: sugerido * 1.05 });

  // Argumentos prontos — usa IA ou fallback determinístico
  const argumentos =
    study.aiAnalysis?.argumentosChave && study.aiAnalysis.argumentosChave.length > 0
      ? study.aiAnalysis.argumentosChave
      : buildFallbackArgs({ abaixoCount, totalComps, menorPreco, pretendido, acimaMedianaM2, sugerido, gapPct });

  const riscos = study.aiAnalysis?.riscos && study.aiAnalysis.riscos.length > 0
    ? study.aiAnalysis.riscos
    : buildFallbackRiscos(gapPct);

  const discurso = study.aiAnalysis?.discursoProprietario;

  const statusLabel = gapPct > 5 ? "ACIMA DO MERCADO" : gapPct < -5 ? "ABAIXO DO MERCADO" : "DENTRO DO MERCADO";
  const statusClass = gapPct > 5 ? "owner-status-alto" : gapPct < -5 ? "owner-status-baixo" : "owner-status-ok";

  return (
    <div className="slide-page acm-page owner-page">
      <div className="acm-header">
        <div className="acm-title">Argumentos para o Proprietário</div>
        <div className={`owner-status ${statusClass}`}>{statusLabel}</div>
      </div>
      <div className="acm-stripe" />

      {/* Tese: pretendido vs sugerido */}
      <div className="owner-tese">
        <div className="owner-tese-box">
          <div className="owner-tese-lbl">Valor pretendido</div>
          <div className="owner-tese-val">{formatBRL(pretendido)}</div>
        </div>
        <div className="owner-tese-arrow">→</div>
        <div className="owner-tese-box owner-tese-target">
          <div className="owner-tese-lbl">Valor sugerido (ACM)</div>
          <div className="owner-tese-val">{formatBRL(sugerido)}</div>
        </div>
        <div className="owner-tese-box owner-tese-gap">
          <div className="owner-tese-lbl">Diferença</div>
          <div className="owner-tese-val">
            {gap >= 0 ? "+" : "−"} {formatBRL(Math.abs(gap))}
            <span className="owner-tese-pct"> ({gap >= 0 ? "+" : "−"}{Math.abs(gapPct).toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Fatos de mercado + Top 5 mais baratos */}
      <div className="owner-grid">
        <div className="owner-block">
          <div className="owner-block-title">Por que o preço atual afasta compradores</div>
          <ul className="owner-facts">
            {percentilPos && (
              <li>Entre os comparáveis, seu preço está no <b>{percentilPos}</b> da faixa observada.</li>
            )}
            {acimaMedianaM2 > 1 && (
              <li>O R$/m² pretendido (<b>{formatBRL(precoM2Pretendido)}</b>) está <b>{acimaMedianaM2.toFixed(1)}%</b> acima da mediana do bairro (<b>{formatBRL(stats?.median || 0)}/m²</b>).</li>
            )}
            {totalComps > 0 && abaixoCount > 0 && (
              <li><b>{abaixoCount} de {totalComps}</b> imóveis semelhantes hoje custam menos que o valor pretendido.</li>
            )}
            {menorPreco > 0 && menorPreco < pretendido && (
              <li>Há concorrente equivalente anunciado por <b>{formatBRL(menorPreco)}</b> — diferença de <b>{formatBRL(pretendido - menorPreco)}</b>.</li>
            )}
            {stats && (
              <li>Faixa observada de R$/m² no estudo: <b>{formatBRL(stats.p10)}</b> (P10) a <b>{formatBRL(stats.p90)}</b> (P90); mediana <b>{formatBRL(stats.median)}</b>.</li>
            )}
          </ul>
        </div>

        <div className="owner-block">
          <div className="owner-block-title">Os 5 concorrentes diretos mais baratos</div>
          <table className="owner-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Imóvel</th>
                <th className="num">m²</th>
                <th className="num">Dorm</th>
                <th className="num">Preço</th>
                <th className="num">R$/m²</th>
                <th className="num">vs. você</th>
              </tr>
            </thead>
            <tbody>
              {baratos.map((c, i) => {
                const diff = pretendido > 0 ? ((c.preco - pretendido) / pretendido) * 100 : 0;
                const tag = c.mesmoCondominio ? "mesmo prédio" : c.mesmoEndereco ? "mesmo endereço" : "";
                return (
                  <tr key={c.id}>
                    <td>{i + 1}</td>
                    <td className="owner-imovel-cell">
                      <div className="owner-imovel-titulo">{c.titulo || `Comparável ${i + 1}`}</div>
                      {tag && <div className="owner-imovel-tag">{tag}</div>}
                    </td>
                    <td className="num">{c.areaUtil || "—"}</td>
                    <td className="num">{c.quartos || "—"}</td>
                    <td className="num">{formatBRL(c.preco)}</td>
                    <td className="num">{c.precoM2 > 0 ? formatBRL(c.precoM2) : "—"}</td>
                    <td className={`num ${diff < 0 ? "owner-diff-neg" : "owner-diff-pos"}`}>
                      {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              {baratos.length === 0 && (
                <tr><td colSpan={7} className="acm-empty">Sem comparáveis.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Faixa recomendada */}
      <div className="owner-faixa">
        <div className="owner-faixa-title">Faixa recomendada de publicação</div>
        <div className="owner-faixa-row">
          <div className="owner-faixa-cell">
            <div className="owner-faixa-lbl">Entrada (vende rápido)</div>
            <div className="owner-faixa-val">{formatBRL(faixa.entrada)}</div>
          </div>
          <div className="owner-faixa-cell owner-faixa-ideal">
            <div className="owner-faixa-lbl">Ideal (sugerido)</div>
            <div className="owner-faixa-val">{formatBRL(faixa.ideal)}</div>
          </div>
          <div className="owner-faixa-cell">
            <div className="owner-faixa-lbl">Teto (com margem)</div>
            <div className="owner-faixa-val">{formatBRL(faixa.teto)}</div>
          </div>
          <div className="owner-faixa-cell owner-faixa-pub">
            <div className="owner-faixa-lbl">Máx. de publicação (ACM)</div>
            <div className="owner-faixa-val">{formatBRL(acm.valorMaximoPublicacao)}</div>
          </div>
        </div>
      </div>

      {/* Argumentos prontos + Riscos */}
      <div className="owner-grid">
        <div className="owner-block owner-block-args">
          <div className="owner-block-title">Argumentos prontos para a conversa</div>
          <ul className="owner-args">
            {argumentos.slice(0, 6).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
        <div className="owner-block owner-block-risks">
          <div className="owner-block-title">Riscos de manter o preço atual</div>
          <ul className="owner-args">
            {riscos.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      </div>

      {discurso && (
        <div className="owner-discurso">
          <div className="owner-discurso-title">Roteiro sugerido para o proprietário</div>
          <p>{discurso}</p>
        </div>
      )}

      <div className="acm-page-meta">
        {brandName} · estudo {study.id.slice(0, 8)} · {dataStr} · página 2
      </div>
    </div>
  );
}

function buildFallbackArgs(p: {
  abaixoCount: number; totalComps: number; menorPreco: number;
  pretendido: number; acimaMedianaM2: number; sugerido: number; gapPct: number;
}): string[] {
  const out: string[] = [];
  if (p.abaixoCount > 0 && p.totalComps > 0) {
    out.push(`Hoje, ${p.abaixoCount} de ${p.totalComps} imóveis equivalentes já estão anunciados por menos que o valor pretendido.`);
  }
  if (p.menorPreco > 0 && p.menorPreco < p.pretendido) {
    out.push(`O concorrente mais agressivo está em ${formatBRL(p.menorPreco)} — comprador racional começa por ele.`);
  }
  if (p.acimaMedianaM2 > 1) {
    out.push(`Seu R$/m² está ${p.acimaMedianaM2.toFixed(1)}% acima da mediana da região; portais penalizam anúncios fora da curva.`);
  }
  if (p.gapPct > 3) {
    out.push(`Ajustar para ${formatBRL(p.sugerido)} alinha o imóvel ao centro do mercado e amplia o público qualificado.`);
  }
  out.push("Anúncios competitivos recebem mais visitas nas primeiras semanas — é quando o imóvel realmente vende.");
  out.push("Reduzir agora preserva a margem; reduzir depois de meses parado custa mais e queima o anúncio.");
  return out;
}

function buildFallbackRiscos(gapPct: number): string[] {
  const base = [
    "Baixa relevância nos portais — anúncios acima da curva caem no ranking de busca.",
    "Queda de visitas e poucas propostas qualificadas nos primeiros 30 dias.",
    "Risco de descontos maiores depois, quando o imóvel já 'envelheceu' no mercado.",
  ];
  if (gapPct > 10) {
    base.unshift("Diferença atual >10% acima do mercado tende a eliminar o imóvel das comparações dos compradores.");
  }
  return base;
}

function ResumoRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "highlight" | "success";
}) {
  const cls =
    variant === "highlight" ? "acm-resumo-row acm-highlight-yellow"
    : variant === "success" ? "acm-resumo-row acm-highlight-green"
    : "acm-resumo-row";
  return (
    <div className={cls}>
      <span className="acm-resumo-label">{label}</span>
      <span className="acm-resumo-value">{value}</span>
    </div>
  );
}

function Fator({ label, value }: { label: string; value: number }) {
  return (
    <div className="acm-fator">
      <div className="acm-fator-label">{label}</div>
      <div className="acm-fator-value">{value}%</div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}