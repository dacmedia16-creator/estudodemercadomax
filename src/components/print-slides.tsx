import { computeAcm, formatBRL } from "@/lib/study-engine";
import { DEFAULT_ACM, type StudyResult } from "@/lib/study-types";

/**
 * Apresentação 16:9 para o proprietário. Visível somente em
 * `@media print` quando `<html>` tem a classe `print-mode-slides`.
 */
export function PrintSlides({
  study,
  sorted,
}: {
  study: StudyResult;
  sorted: StudyResult["comparaveis"];
}) {
  const { input } = study;
  const acm = computeAcm(study, study.acm ?? DEFAULT_ACM);
  const top = sorted.slice(0, 6);
  const fortes = study.pontosFortes.slice(0, 4);
  const atencao = study.pontosAtencao.slice(0, 4);
  const data = new Date(study.createdAt).toLocaleDateString("pt-BR");
  const totalSlides = 6;
  const a = study.acm ?? DEFAULT_ACM;

  const factor = (label: string, value: number) => {
    // Map 80..120 -> 0..100% width.
    const pct = Math.max(0, Math.min(100, ((value - 80) / 40) * 100));
    const delta = value - 100;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10pt" }}>
          <span style={{ fontWeight: 600 }}>{label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: delta === 0 ? "#666" : delta > 0 ? "#15803d" : "#b45309" }}>
            {value}% {delta !== 0 && <em style={{ fontStyle: "normal", fontSize: "8.5pt" }}>({delta > 0 ? "+" : ""}{delta})</em>}
          </span>
        </div>
        <div className="sl-bar"><span style={{ width: `${pct}%` }} /></div>
      </div>
    );
  };

  const Footer = ({ n }: { n: number }) => (
    <div className="sl-footer">
      <span>Radar Imobiliário Pro · estudo {study.id.slice(0, 8)}</span>
      <span>{n} / {totalSlides}</span>
    </div>
  );

  return (
    <section className="print-slides">
      {/* 1. CAPA */}
      <div className="slide-page sl-cover">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="sl-brand">Radar Imobiliário Pro</div>
          <div className="sl-meta">{data}</div>
        </div>
        <div style={{ marginTop: "auto" }}>
          <div className="sl-kicker">Estudo de Mercado</div>
          <h1>{input.tipo} em {input.bairro}</h1>
          <div className="sl-cover-sub">
            {input.edificio ? `${input.edificio} · ` : ""}
            {input.endereco ? `${input.endereco}${input.numero ? `, ${input.numero}` : ""} · ` : ""}
            {input.cidade}/{input.estado}
          </div>
        </div>
        <div className="sl-cover-footer">
          <span>Apresentação preparada para o proprietário</span>
          <span>Finalidade: {input.finalidade}</span>
        </div>
      </div>

      {/* 2. IMÓVEL ANALISADO */}
      <div className="slide-page">
        <div className="sl-header">
          <div>
            <div className="sl-kicker">Slide 2</div>
            <h2 className="sl-section">Imóvel analisado</h2>
          </div>
          <div className="sl-meta">{input.cidade}/{input.estado}</div>
        </div>
        <div className="sl-grid-4" style={{ marginTop: "10pt" }}>
          <Cell lbl="Tipo" val={input.tipo} />
          <Cell lbl="Finalidade" val={input.finalidade} />
          <Cell lbl="Área útil" val={`${input.areaUtil} m²`} />
          <Cell lbl="Quartos" val={`${input.quartos}${input.suites ? ` (${input.suites} suíte${input.suites > 1 ? "s" : ""})` : ""}`} />
          <Cell lbl="Banheiros" val={String(input.banheiros)} />
          <Cell lbl="Vagas" val={String(input.vagas)} />
          <Cell lbl="Andar" val={input.andar ? String(input.andar) : "—"} />
          <Cell lbl="Ano" val={input.anoConstrucao ? String(input.anoConstrucao) : "—"} />
          <Cell lbl="Condomínio" val={input.condominio ? formatBRL(input.condominio) : "—"} />
          <Cell lbl="IPTU" val={input.iptu ? formatBRL(input.iptu) : "—"} />
          <Cell lbl="Valor pretendido" val={formatBRL(input.valorPretendido)} />
          <Cell lbl="R$/m² pretendido" val={formatBRL(study.precoM2Pretendido)} />
        </div>
        <div style={{ marginTop: "10pt" }}>
          <div className="sl-kicker" style={{ marginBottom: "4pt" }}>Endereço</div>
          <div className="sl-body">
            {input.endereco ? `${input.endereco}${input.numero ? `, ${input.numero}` : ""}` : `${input.bairro}, ${input.cidade}/${input.estado}`}
            {input.complemento ? ` · ${input.complemento}` : ""}
            {input.edificio ? ` · Edifício ${input.edificio}` : ""}
          </div>
        </div>
        {input.diferenciais.length > 0 && (
          <div style={{ marginTop: "10pt" }}>
            <div className="sl-kicker" style={{ marginBottom: "4pt" }}>Diferenciais</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4pt" }}>
              {input.diferenciais.map((d) => (
                <span key={d} style={{ border: "0.75pt solid #ccc", borderRadius: "999pt", padding: "2pt 8pt", fontSize: "9pt" }}>{d}</span>
              ))}
            </div>
          </div>
        )}
        <Footer n={2} />
      </div>

      {/* 3. VALOR RECOMENDADO (HERO) */}
      <div className="slide-page">
        <div className="sl-header">
          <div>
            <div className="sl-kicker">Slide 3 · Avaliação ACM</div>
            <h2 className="sl-section">Valor recomendado para venda</h2>
          </div>
          <div className="sl-meta">Baseado em {study.comparaveis.length} comparáveis</div>
        </div>
        <div className="sl-hero-box">
          <div className="sl-hero-lbl">Valor sugerido</div>
          <div className="sl-hero-value">{formatBRL(acm.valorSugerido)}</div>
          <div className="sl-hero-meta">
            Média de mercado {formatBRL(study.precoM2Medio)}/m² · status <strong>{study.status}</strong>
          </div>
        </div>
        <div className="sl-pair">
          <div className="sl-pill">
            <div className="lbl">Mínimo de fechamento</div>
            <div className="val">{formatBRL(acm.valorMinimoFechamento)}</div>
          </div>
          <div className="sl-pill">
            <div className="lbl">Máximo de publicação</div>
            <div className="val">{formatBRL(acm.valorMaximoPublicacao)}</div>
          </div>
        </div>
        <div className="sl-callout" style={{ marginTop: "10pt" }}>
          {study.diagnostico}
        </div>
        <Footer n={3} />
      </div>

      {/* 4. ANÁLISE ACM */}
      <div className="slide-page">
        <div className="sl-header">
          <div>
            <div className="sl-kicker">Slide 4</div>
            <h2 className="sl-section">Como chegamos no valor</h2>
          </div>
          <div className="sl-meta">Multiplicador combinado <strong>{(acm.multiplicador * 100).toFixed(1)}%</strong></div>
        </div>
        <div className="sl-grid-2" style={{ gap: "14pt" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8pt" }}>
            <div className="sl-kicker">Fatores aplicados</div>
            {factor("Localização", a.localizacao)}
            {factor("Conservação", a.conservacao)}
            {factor("Idade do imóvel", a.idade)}
            {factor("Padrão de acabamento", a.padrao)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8pt" }}>
            <div className="sl-kicker">Resultado</div>
            <Cell lbl="Média de R$/m² (mercado)" val={formatBRL(study.precoM2Medio)} />
            <Cell lbl="Valor avaliado do m²" val={formatBRL(acm.valorM2Avaliado)} />
            <Cell lbl="Custo estimado de reforma"
                  val={acm.descontoReforma > 0 ? `- ${formatBRL(acm.descontoReforma)} (${formatBRL(a.reformaPorM2)}/m²)` : "—"} />
            <Cell lbl="Margem de negociação" val={`± ${a.margemPublicacaoPct}%`} />
            <Cell lbl="Valor sugerido" val={formatBRL(acm.valorSugerido)} highlight />
          </div>
        </div>
        <Footer n={4} />
      </div>

      {/* 5. COMPARÁVEIS */}
      <div className="slide-page">
        <div className="sl-header">
          <div>
            <div className="sl-kicker">Slide 5</div>
            <h2 className="sl-section">Comparáveis de mercado</h2>
          </div>
          <div className="sl-meta">
            {study.comparaveis.length} imóveis · faixa {formatBRL(study.faixaMin)} – {formatBRL(study.faixaMax)}
          </div>
        </div>
        <table className="sl-table">
          <thead>
            <tr>
              <th>Portal</th>
              <th>Endereço / título</th>
              <th>Bairro</th>
              <th className="num">m²</th>
              <th className="num">Qtos</th>
              <th className="num">Preço</th>
              <th className="num">R$/m²</th>
              <th className="num">Sim.</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c) => (
              <tr key={c.id}>
                <td>{c.portal}</td>
                <td style={{ maxWidth: "180pt" }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.titulo}</div>
                </td>
                <td style={{ color: "#666" }}>{c.bairro}</td>
                <td className="num">{c.areaUtil}</td>
                <td className="num">{c.quartos}</td>
                <td className="num"><strong>{formatBRL(c.preco)}</strong></td>
                <td className="num">{formatBRL(c.precoM2)}</td>
                <td className="num">{c.similaridade}%</td>
              </tr>
            ))}
            {top.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#888" }}>Nenhum comparável encontrado.</td></tr>
            )}
          </tbody>
        </table>
        <div className="sl-grid-3" style={{ marginTop: "10pt" }}>
          <Cell lbl="Preço médio" val={formatBRL(study.precoMedio)} />
          <Cell lbl="R$/m² médio" val={formatBRL(study.precoM2Medio)} />
          <Cell lbl="Min / Max" val={`${formatBRL(study.menorPreco)} / ${formatBRL(study.maiorPreco)}`} />
        </div>
        <Footer n={5} />
      </div>

      {/* 6. PRÓXIMOS PASSOS */}
      <div className="slide-page">
        <div className="sl-header">
          <div>
            <div className="sl-kicker">Slide 6 · Conclusão</div>
            <h2 className="sl-section">Próximos passos</h2>
          </div>
          <div className="sl-meta">Sugestão comercial</div>
        </div>
        <div className="sl-grid-2" style={{ marginTop: "6pt" }}>
          <div className="sl-card" style={{ borderColor: "color-mix(in oklab, var(--primary) 40%, white)" }}>
            <div className="lbl" style={{ color: "var(--primary)" }}>Pontos fortes</div>
            <ul className="sl-list" style={{ marginTop: "4pt" }}>
              {fortes.map((p) => <li key={p}>{p}</li>)}
              {fortes.length === 0 && <li style={{ color: "#888" }}>—</li>}
            </ul>
          </div>
          <div className="sl-card" style={{ borderColor: "#e5b15d" }}>
            <div className="lbl" style={{ color: "#b45309" }}>Pontos de atenção</div>
            <ul className="sl-list" style={{ marginTop: "4pt" }}>
              {atencao.map((p) => <li key={p}>{p}</li>)}
              {atencao.length === 0 && <li style={{ color: "#888" }}>—</li>}
            </ul>
          </div>
        </div>
        <div className="sl-callout" style={{ marginTop: "10pt" }}>
          <strong>Recomendação:</strong> publicar a {formatBRL(acm.valorMaximoPublicacao)} e aceitar propostas a partir de {formatBRL(acm.valorMinimoFechamento)}. {study.argumentoProprietario}
        </div>
        <Footer n={6} />
      </div>
    </section>
  );
}

function Cell({ lbl, val, highlight }: { lbl: string; val: string; highlight?: boolean }) {
  return (
    <div className="sl-card" style={highlight ? { borderColor: "var(--primary)", background: "color-mix(in oklab, var(--primary) 6%, white)" } : undefined}>
      <div className="lbl">{lbl}</div>
      <div className="val" style={highlight ? { color: "var(--primary)" } : undefined}>{val}</div>
    </div>
  );
}