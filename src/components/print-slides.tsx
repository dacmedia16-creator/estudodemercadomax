import { computeAcm, formatBRL } from "@/lib/study-engine";
import { DEFAULT_ACM, type StudyResult } from "@/lib/study-types";
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
}: {
  study: StudyResult;
  sorted: StudyResult["comparaveis"];
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
    <section className="print-slides" style={styleVars}>
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