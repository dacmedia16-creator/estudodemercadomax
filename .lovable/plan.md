## Simplificar PDF do relatório para o proprietário

Escopo estrito: apenas o componente `PrintOnePager` em `src/routes/app.relatorio.$id.tsx` e as classes `.op-*` dentro de `@media print` em `src/styles.css`. Zero mudança em `computeAcm`, `runStudy`, `studyStore`, `PrintSlides`, `PrintOwnerPages` ou cálculos.

## Arquivo 1 — `src/routes/app.relatorio.$id.tsx` (função `PrintOnePager`)

Reescrever o JSX mantendo o cálculo do topo (`acm`, `valorIdeal`, `ratioMin/Max`, `idealMin/Max`) e trocando o resto:

1. **Faixa de marca** — `op-brandbar` com "ESTUDO DE MERCADO" à esquerda e `dataStr` (createdAt em `dd/mm/aaaa`) à direita. Sem #id, sem revisão, sem "PRO".
2. **Título** — `op-title`: `{tipo} em {bairro}`; `op-sub`: `{cidade}/{estado}`.
3. **Hero** (`op-hero`, primary, texto branco):
   - `op-hero-label`: "Valor recomendado para venda"
   - `op-hero-value`: `formatBRL(valorIdeal)`
   - `op-hero-pills` com 3 pills: "Para vender mais rápido" (idealMin) · "Valor recomendado" (valorIdeal, `op-hpill-strong`) · "Anunciar no máximo por" (idealMax).
   - Remover `op-hero-meta` (margem de segurança, IA sobrescrita, contagem/status).
4. **Seção "Seu imóvel"** — `op-section-title` + `op-facts` (grid 3 col) com `op-fact` (lbl+val): Tipo, Área (`{areaUtil} m²`), Dormitórios (`{quartos}` + suítes entre parênteses se >0), Vagas, Condomínio (só se `> 0`), Bairro.
5. **Seção "Por que esse valor"** — `op-why` com `op-why-lead` ("Analisamos {n} imóveis parecidos anunciados na região. {posicaoTexto}") e `op-why-list` com `pontosFortes.slice(0,3)`. `posicaoTexto` conforme `study.status` (Acima/Abaixo/alinhado).
6. **Seção "Alguns imóveis parecidos à venda hoje"** — tabela com 4 colunas: Imóvel (título + `op-cmp-sub` com bairro e tag "mesmo prédio"/"mesmo endereço") · Área (m²) · Dorm. · Preço pedido (negrito). `sorted.slice(0, 4)`. Nota final em `op-table-note`: "Valores anunciados nos portais na data deste estudo. Servem de referência de mercado."
7. **Rodapé** — "Estudo de mercado imobiliário" à esquerda, "Gerado em {dataStr}" à direita.

Remover: coluna Portal, coluna R$/m², coluna Semelhança + bloco `op-simwrap`, blocos `op-kpis`, `op-points` (fortes/atenção lado a lado), `op-suggest` (título/argumento), meta de IA/margem no hero, #id/revisão na brandbar.

## Arquivo 2 — `src/styles.css` (bloco `@media print`)

Manter intactos: `.print-onepager` container (`210mm/297mm/padding 8mm 9mm`), `.op-brandbar*`, `.op-titleblock`, `.op-title`, `.op-sub`, `.op-hero`, `.op-hero-label`, `.op-hero-value`, `.op-hero-pills`, `.op-hpill*`, `.op-section-title`, `.op-table`, `.op-cmp-title`, `.op-cmp-sub`, `.op-tag`, `.op-footer`, e regras `-webkit-print-color-adjust: exact` já existentes.

Ajustes:
- `.op-title` → `font-size: 17pt` (era 13pt).
- `.op-sub` → tamanho similar, ~10pt.
- `.op-hero` → padding mais respirado (~16pt); `.op-hero-value` → `font-size: 40pt`.
- `.op-section-title` → `font-size: 10pt`, uppercase, cor `var(--primary)`.
- `.op-tag` → pill primary com fundo `color-mix(in srgb, var(--primary) 12%, #fff)` e texto `var(--primary)`.

Adicionar novas classes:
- `.op-facts` — `display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8pt 16pt; margin-bottom: 8pt`.
- `.op-fact` — coluna com borda inferior fininha; `.lbl` 7.5pt cinza uppercase, `.val` 11pt negrito.
- `.op-why` — bloco com padding leve; `.op-why-lead` 9.5pt cinza escuro; `.op-why-list` 9pt.
- `.op-table-note` — 7.5pt itálico cinza logo abaixo da tabela.

Remover (não existem mais): `.op-kpis`, `.op-kpi`, `.op-kpi-status`, `.op-points`, `.op-point`, `.op-point-good`, `.op-point-warn`, `.op-point-head`, `.op-suggest*`, `.op-simwrap`, `.op-simbar`, `.op-simval`, `.op-hero-meta`.

## Verificação
- `tsgo` limpo (harness).
- Preview: layout de tela inalterado.
- Print preview: uma única folha A4 com Faixa → Título → Hero → Seu imóvel → Por que esse valor → Tabela (4 col) → Rodapé, sem KPIs/pontos atenção/sugestão.

## Fora do escopo
Qualquer mudança em cálculos, engine, store, slides de dono (`PrintOwnerPages`), `PrintSlides`, layout de tela, terminologia da UI web.
