import { computeAcm, formatBRL, getValorIdeal, rewriteCurrencyInText } from "@/lib/study-engine";
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

    </section>
  );
}

/**
 * Wrapper extra usado pelo botão "Exportar PDF" (one-pager A4): renderiza
 * apenas as páginas "Argumentos para o Proprietário" e "Carta ao Proprietário"
 * para que entrem no PDF padrão. Reutiliza a classe `.print-slides` para
 * herdar todos os estilos existentes; a classe extra `.print-owner-pages`
 * controla visibilidade no @media print/screen (ver `src/styles.css`).
 */
export function PrintOwnerPages({
  study,
  sorted,
}: {
  study: StudyResult;
  sorted: StudyResult["comparaveis"];
}) {
  const acm = computeAcm(study, study.acm ?? DEFAULT_ACM);
  const branding = brandingStore.get();
  const data = new Date(study.createdAt).toLocaleDateString("pt-BR");
  const styleVars = {
    ["--acm-brand" as string]: branding.brandColor,
    ["--acm-accent" as string]: branding.accentColor,
  } as React.CSSProperties;
  return (
    <section className="print-slides print-owner-pages" style={styleVars}>
      <CoverPage study={study} branding={branding} dataStr={data} acm={acm} />
      <OwnerPersuasionPage study={study} sorted={sorted} acm={acm} dataStr={data} brandName={branding.brandName} />
      <OwnerLetterPage study={study} sorted={sorted} acm={acm} dataStr={data} brandName={branding.brandName} />
      <BackCoverPage study={study} branding={branding} dataStr={data} />
    </section>
  );
}

/* -------------------------------------------------------------------------
 * Página 0 — Capa
 * Identidade do corretor + endereço do imóvel + data + Valor Ideal grande.
 * ----------------------------------------------------------------------- */
function CoverPage({
  study,
  branding,
  dataStr,
  acm,
}: {
  study: StudyResult;
  branding: ReturnType<typeof brandingStore.get>;
  dataStr: string;
  acm: ReturnType<typeof computeAcm>;
}) {
  const { input } = study;
  const valorIdeal = getValorIdeal(study, acm);
  const range = study.valorIdealRange;
  const enderecoLinha = [input.endereco, input.numero].filter(Boolean).join(", ");
  return (
    <div className="slide-page acm-page cover-page">
      <div className="cover-top">
        <div className="cover-brand">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.brandName} className="cover-logo" />
          ) : (
            <div className="cover-logo-placeholder">{initials(branding.brandName)}</div>
          )}
          <div className="cover-brand-name">{branding.brandName}</div>
        </div>
        <div className="cover-tag">ESTUDO DE MERCADO</div>
      </div>
      <div className="cover-stripe" />
      <div className="cover-body">
        <div className="cover-eyebrow">Análise Comparativa de Mercado</div>
        <h1 className="cover-title">
          {input.tipo} em {input.bairro}
        </h1>
        <div className="cover-sub">
          {[input.cidade, input.estado].filter(Boolean).join(" / ")}
          {enderecoLinha ? ` · ${enderecoLinha}` : ""}
          {input.edificio ? ` · ${input.edificio}` : ""}
        </div>
        <div className="cover-specs">
          <span>{input.areaUtil} m²</span>
          <span>{input.quartos} dorm{input.suites > 0 ? ` · ${input.suites} suíte${input.suites > 1 ? "s" : ""}` : ""}</span>
          <span>{input.vagas} vaga{input.vagas !== 1 ? "s" : ""}</span>
          <span>{input.finalidade}</span>
        </div>

        <div className="cover-hero">
          <div className="cover-hero-lbl">Valor ideal de publicação</div>
          <div className="cover-hero-val">{formatBRL(valorIdeal)}</div>
          {range && (
            <div className="cover-hero-range">
              faixa de confiança ({range.confianca}): {formatBRL(range.min)} – {formatBRL(range.max)}
            </div>
          )}
          {study.iaSobrescrita && (
            <div className="cover-hero-warn">
              ⚠ Valor da IA ajustado para a mediana de mercado (divergência &gt; 15%).
            </div>
          )}
        </div>

        <div className="cover-meta">
          <div>
            <span className="cover-meta-lbl">Pretendido</span>
            <span className="cover-meta-val">{formatBRL(input.valorPretendido)}</span>
          </div>
          <div>
            <span className="cover-meta-lbl">Comparáveis analisados</span>
            <span className="cover-meta-val">{study.comparaveis.length}</span>
          </div>
          <div>
            <span className="cover-meta-lbl">Data do estudo</span>
            <span className="cover-meta-val">{dataStr}</span>
          </div>
        </div>
      </div>
      <div className="cover-footer">
        <div>{branding.brandName} · ESTUDO DE MERCADO</div>
        <div>#{study.id.slice(0, 8).toUpperCase()}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Última página — Contracapa
 * Próximos passos + contato do corretor.
 * ----------------------------------------------------------------------- */
function BackCoverPage({
  study,
  branding,
  dataStr,
}: {
  study: StudyResult;
  branding: ReturnType<typeof brandingStore.get>;
  dataStr: string;
}) {
  return (
    <div className="slide-page acm-page backcover-page">
      <div className="cover-top">
        <div className="cover-brand">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.brandName} className="cover-logo" />
          ) : (
            <div className="cover-logo-placeholder">{initials(branding.brandName)}</div>
          )}
          <div className="cover-brand-name">{branding.brandName}</div>
        </div>
        <div className="cover-tag">PRÓXIMOS PASSOS</div>
      </div>
      <div className="cover-stripe" />

      <div className="backcover-body">
        <h2 className="backcover-title">Vamos transformar este estudo em uma venda.</h2>
        <p className="backcover-lede">
          Este material reúne dados reais de imóveis anunciados nos principais portais.
          O próximo passo é alinhar a estratégia de publicação, fotos e divulgação ativa.
        </p>

        <div className="backcover-steps">
          <div className="backcover-step">
            <div className="backcover-step-num">1</div>
            <div>
              <div className="backcover-step-title">Definir o valor de publicação</div>
              <div className="backcover-step-body">Confirmar o valor ideal e a margem de negociação aceitável.</div>
            </div>
          </div>
          <div className="backcover-step">
            <div className="backcover-step-num">2</div>
            <div>
              <div className="backcover-step-title">Assinar o contrato e capturar o material</div>
              <div className="backcover-step-body">Fotos profissionais, vídeo curto e descrição otimizada para os portais.</div>
            </div>
          </div>
          <div className="backcover-step">
            <div className="backcover-step-num">3</div>
            <div>
              <div className="backcover-step-title">Publicar com destaque</div>
              <div className="backcover-step-body">Distribuição nos portais, divulgação para nossa carteira de compradores e acompanhamento semanal.</div>
            </div>
          </div>
        </div>

        <div className="backcover-cta">
          <div className="backcover-cta-title">Agende uma conversa</div>
          <p>
            Fale com seu corretor responsável para revisar a estratégia e iniciar a divulgação ativa do imóvel.
          </p>
          <div className="backcover-sign">— {branding.brandName}</div>
        </div>
      </div>

      <div className="acm-page-meta">
        {branding.brandName} · estudo {study.id.slice(0, 8)} · {dataStr} · contracapa
      </div>
    </div>
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
  const valorIdeal = getValorIdeal(study, acm);
  const gap = pretendido - valorIdeal;
  const gapPct = valorIdeal > 0 ? (gap / valorIdeal) * 100 : 0;

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

  // Faixa Entrada / Ideal / Teto é a MESMA do painel ACM (única fonte da
  // verdade). Mantemos os pares para reescrever números absolutos no texto
  // da IA, garantindo coerência entre cards e Carta ao Proprietário.
  const faixa = {
    entrada: acm.valorMinimoFechamento,
    ideal: acm.valorSugerido,
    teto: acm.valorMaximoPublicacao,
  };
  const ajustePairs = study.aiAnalysis?.faixaRecomendada
    ? [
        { original: study.aiAnalysis.faixaRecomendada.entrada, ajustado: faixa.entrada },
        { original: study.aiAnalysis.faixaRecomendada.ideal, ajustado: faixa.ideal },
        { original: study.aiAnalysis.faixaRecomendada.teto, ajustado: faixa.teto },
      ]
    : [];

  // Argumentos prontos — usa IA ou fallback determinístico
  const argumentos = (
    study.aiAnalysis?.argumentosChave && study.aiAnalysis.argumentosChave.length > 0
      ? study.aiAnalysis.argumentosChave
      : buildFallbackArgs({ abaixoCount, totalComps, menorPreco, pretendido, acimaMedianaM2, valorIdeal, gapPct })
  ).map((a) => rewriteCurrencyInText(a, ajustePairs));

  const riscos = study.aiAnalysis?.riscos && study.aiAnalysis.riscos.length > 0
    ? study.aiAnalysis.riscos
    : buildFallbackRiscos(gapPct);

  const discurso = study.aiAnalysis?.discursoProprietario
    ? rewriteCurrencyInText(study.aiAnalysis.discursoProprietario, ajustePairs)
    : undefined;

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
          <div className="owner-tese-lbl">Valor ideal de publicação</div>
          <div className="owner-tese-val">{formatBRL(valorIdeal)}</div>
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
  pretendido: number; acimaMedianaM2: number; valorIdeal: number; gapPct: number;
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
    out.push(`Ajustar para o valor ideal de ${formatBRL(p.valorIdeal)} alinha o imóvel ao centro do mercado e amplia o público qualificado.`);
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

/* -------------------------------------------------------------------------
 * Página 3 — "Carta ao Proprietário"
 * Linguagem direta, sem jargão técnico. Pensada para imprimir e entregar
 * na mão do dono do imóvel.
 * ----------------------------------------------------------------------- */
function OwnerLetterPage({
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
  const valorIdeal = getValorIdeal(study, acm);
  const gap = pretendido - valorIdeal;
  const gapPct = valorIdeal > 0 ? (gap / valorIdeal) * 100 : 0;
  const totalComps = comparaveis.length;
  const abaixoCount = comparaveis.filter((c) => c.preco > 0 && c.preco < pretendido).length;
  const menorPreco = comparaveis.reduce(
    (min, c) => (c.preco > 0 && (min === 0 || c.preco < min) ? c.preco : min),
    0,
  );
  const precoM2Pretendido = input.areaUtil > 0 ? pretendido / input.areaUtil : 0;
  const m2Medio = study.precoM2Medio;
  const acimaMedia = m2Medio > 0 && precoM2Pretendido > 0 ? ((precoM2Pretendido - m2Medio) / m2Medio) * 100 : 0;

  const faixa = {
    entrada: acm.valorMinimoFechamento,
    ideal: acm.valorSugerido,
    teto: acm.valorMaximoPublicacao,
  };
  const ajustePairs = study.aiAnalysis?.faixaRecomendada
    ? [
        { original: study.aiAnalysis.faixaRecomendada.entrada, ajustado: faixa.entrada },
        { original: study.aiAnalysis.faixaRecomendada.ideal, ajustado: faixa.ideal },
        { original: study.aiAnalysis.faixaRecomendada.teto, ajustado: faixa.teto },
      ]
    : [];

  const cidadeBairro = [input.bairro, input.cidade].filter(Boolean).join(", ");

  // Top comparáveis (mesma ordenação do one-pager) + pontos do estudo
  const topComps = (sorted && sorted.length ? sorted : comparaveis).slice(0, 5);
  const fortes = study.pontosFortes.slice(0, 3);
  const atencao = study.pontosAtencao.slice(0, 3);

  // Conteúdo da IA destinado ao proprietário (quando disponível)
  const ai = study.aiAnalysis;
  const aiDiscurso = ai?.discursoProprietario
    ? rewriteCurrencyInText(ai.discursoProprietario, ajustePairs).trim()
    : undefined;
  const aiArgs = (ai?.argumentosChave ?? [])
    .filter(Boolean)
    .slice(0, 3)
    .map((a) => rewriteCurrencyInText(a, ajustePairs));

  // Cor do destaque conforme a posição do preço pretendido
  const tone: "ok" | "ajustar" | "alto" =
    gapPct > 8 ? "alto" : gapPct > 2 ? "ajustar" : "ok";
  const toneLabel =
    tone === "alto" ? "Seu preço está bem acima do mercado"
    : tone === "ajustar" ? "Vale a pena ajustar o preço"
    : "Seu preço está alinhado ao mercado";

  return (
    <div className={`slide-page acm-page owner-letter-page owner-letter-${tone}`}>
      <div className="acm-header">
        <div className="acm-title">Carta ao Proprietário</div>
        <div className="owner-letter-status">{toneLabel}</div>
      </div>
      <div className="acm-stripe" />

      <p className="owner-letter-intro">
        {aiDiscurso
          ? aiDiscurso
          : `Preparei um estudo completo do seu imóvel${cidadeBairro ? ` em ${cidadeBairro}` : ""}. Em 1 minuto, você entende o que o mercado está dizendo hoje e qual é o melhor preço para anunciar.`}
      </p>

      {/* Cartões: pretendido → sugerido → diferença */}
      <div className="owner-letter-cards">
        <div className="owner-letter-card">
          <div className="owner-letter-card-lbl">Seu preço hoje</div>
          <div className="owner-letter-card-val">{formatBRL(pretendido)}</div>
        </div>
        <div className="owner-letter-arrow">→</div>
        <div className="owner-letter-card owner-letter-card-ideal">
          <div className="owner-letter-card-lbl">Preço recomendado</div>
          <div className="owner-letter-card-val">{formatBRL(valorIdeal)}</div>
          <div className="owner-letter-card-sub">com base em {totalComps} imóveis parecidos</div>
        </div>
        <div className="owner-letter-card owner-letter-card-diff">
          <div className="owner-letter-card-lbl">Diferença</div>
          <div className="owner-letter-card-val">
            {gap >= 0 ? "−" : "+"} {formatBRL(Math.abs(gap))}
          </div>
          <div className="owner-letter-card-sub">
            {gap >= 0 ? "−" : "+"}{Math.abs(gapPct).toFixed(1)}% do recomendado
          </div>
        </div>
      </div>

      <div className="owner-letter-grid">
        <div className="owner-letter-box">
          <div className="owner-letter-box-title">O que o mercado está dizendo</div>
          <ul className="owner-letter-list owner-letter-list-bullets">
            <li>Analisamos <b>{totalComps}</b> imóveis parecidos com o seu na região.</li>
            {abaixoCount > 0 && (
              <li><b>{abaixoCount} de {totalComps}</b> estão anunciados por menos que o seu preço atual.</li>
            )}
            {menorPreco > 0 && menorPreco < pretendido && (
              <li>O concorrente mais barato pede <b>{formatBRL(menorPreco)}</b> — diferença de <b>{formatBRL(pretendido - menorPreco)}</b> em relação ao seu.</li>
            )}
            {m2Medio > 0 && (
              <li>O preço médio do metro quadrado na região é <b>{formatBRL(m2Medio)}/m²</b>.</li>
            )}
            {precoM2Pretendido > 0 && acimaMedia > 1 && (
              <li>O seu hoje fica em <b>{formatBRL(precoM2Pretendido)}/m²</b>, cerca de <b>{acimaMedia.toFixed(0)}%</b> acima da média.</li>
            )}
            {precoM2Pretendido > 0 && acimaMedia <= 1 && acimaMedia >= -1 && (
              <li>O seu hoje fica em <b>{formatBRL(precoM2Pretendido)}/m²</b>, praticamente em linha com a média.</li>
            )}
          </ul>
        </div>

        <div className="owner-letter-box">
          <div className="owner-letter-box-title">Por que ajustar agora vale a pena</div>
          <ul className="owner-letter-list owner-letter-list-checks">
            <li><b>Mais visitas:</b> anúncios no preço certo aparecem primeiro nas buscas e geram mais contatos qualificados.</li>
            <li><b>Vende mais rápido:</b> as primeiras semanas concentram a maior parte das propostas reais.</li>
            <li><b>Evita desgaste:</b> imóvel parado por meses costuma acabar vendido com desconto maior do que o ajuste de hoje.</li>
            <li><b>Comparação justa:</b> compradores olham vários imóveis lado a lado — quem está acima da média é descartado antes mesmo da visita.</li>
          </ul>
        </div>
      </div>

      {aiArgs.length > 0 && (
        <div className="owner-letter-ia">
          <div className="owner-letter-ia-title">O que pesou na nossa análise</div>
          <ul className="owner-letter-ia-list">
            {aiArgs.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <div className="owner-letter-ia-badge">Análise assistida por IA · revisada pelo corretor</div>
        </div>
      )}

      {/* Faixa de publicação */}
      <div className="owner-letter-faixa">
        <div className="owner-letter-faixa-title">Faixa que recomendamos para publicar</div>
        <div className="owner-letter-faixa-row">
          <div className="owner-letter-faixa-cell">
            <div className="owner-letter-faixa-tag">Vende rápido</div>
            <div className="owner-letter-faixa-val">{formatBRL(faixa.entrada)}</div>
          </div>
          <div className="owner-letter-faixa-cell owner-letter-faixa-ideal">
            <div className="owner-letter-faixa-tag">Ideal</div>
            <div className="owner-letter-faixa-val">{formatBRL(faixa.ideal)}</div>
          </div>
          <div className="owner-letter-faixa-cell">
            <div className="owner-letter-faixa-tag">Teto para negociar</div>
            <div className="owner-letter-faixa-val">{formatBRL(faixa.teto)}</div>
          </div>
        </div>
        <div className="owner-letter-faixa-hint">
          Publicar dentro dessa faixa coloca o seu imóvel à frente da concorrência sem abrir mão da margem de negociação.
        </div>
      </div>

      <div className="owner-letter-cta">
        <div className="owner-letter-cta-title">Próximo passo</div>
        <p>
          Vamos conversar e definir juntos o valor de publicação. Meu compromisso é vender o seu imóvel
          pelo melhor preço possível, no menor tempo possível — sem queimar o anúncio.
        </p>
        <div className="owner-letter-sign">— {brandName}</div>
      </div>

      {/* Rodapé compacto: 3 comparáveis-chave em uma linha (espelha p.1, sem tabela cheia) */}
      {topComps.length > 0 && (
        <div className="owner-letter-mini">
          <div className="owner-letter-mini-title">Resumo dos comparáveis (já detalhados na p.1)</div>
          <div className="owner-letter-mini-row">
            {topComps.slice(0, 3).map((c, i) => (
              <div key={c.id} className="owner-letter-mini-cell">
                <span className="owner-letter-mini-num">{i + 1}</span>
                <span className="owner-letter-mini-info">
                  {c.areaUtil > 0 ? `${c.areaUtil}m²` : "—"} · {c.quartos > 0 ? `${c.quartos} dorm` : "—"} · <b>{formatBRL(c.preco)}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pontos fortes / atenção */}
      {(fortes.length > 0 || atencao.length > 0) && (
        <div className="owner-letter-points">
          <div className="owner-letter-point owner-letter-point-good">
            <div className="owner-letter-point-head">✓ Pontos fortes</div>
            <ul>{fortes.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
          <div className="owner-letter-point owner-letter-point-warn">
            <div className="owner-letter-point-head">! Pontos de atenção</div>
            <ul>{atencao.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        </div>
      )}

      <div className="acm-page-meta">
        {brandName} · estudo {study.id.slice(0, 8)} · {dataStr} · página 3
      </div>
    </div>
  );
}