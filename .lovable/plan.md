## Objetivo
Levar para a **Carta ao Proprietário** (página 3 do PDF) os blocos finais do one-pager: a tabela **Top comparáveis** e o painel **Pontos fortes / Pontos de atenção** — mantendo tudo dentro de 1 folha A4.

## Mudanças

### 1. `src/components/print-slides.tsx` → `OwnerLetterPage`
- Receber `sorted` (mesmos comparáveis já ordenados que a página 2) — atualizar o caller `PrintOwnerPages` para passar `sorted`.
- Selecionar `topComps = sorted.slice(0, 5)` (ou `comparaveis.slice(0,5)` se `sorted` vazio).
- Selecionar `fortes = study.pontosFortes.slice(0,3)` e `atencao = study.pontosAtencao.slice(0,3)`.
- Inserir, **depois da "Faixa que recomendamos para publicar" e antes do bloco CTA "Próximo passo"**:
  - Bloco `owner-letter-top` com título "Imóveis parecidos sendo anunciados agora" e tabela `owner-letter-tabela` com colunas: Portal · Endereço/Título · m² · Qtos · Preço · R$/m² · Similaridade (barra). Reaproveita o padrão visual da `owner-table` da página 2.
  - Bloco `owner-letter-points` com duas colunas (verde "Pontos fortes" / âmbar "Pontos de atenção"), mesma estética da `.op-points` do one-pager.

### 2. `src/styles.css` (bloco `.print-owner-pages` dentro do `@media print`)
- Adicionar estilos compactos para as novas classes:
  - `.owner-letter-top` (título + tabela, fonte ~7pt).
  - `.owner-letter-tabela th/td` com `padding: 1.6pt 2pt` e barra de similaridade igual à `op-simbar` reduzida.
  - `.owner-letter-points` 2 colunas (`grid-template-columns: 1fr 1fr; gap: 5pt`), borda lateral colorida, lista compacta (~7.2pt).
- Reduzir levemente, **somente nesta página**, para garantir 1 folha:
  - `owner-letter-intro` 10.5pt → 9.5pt
  - `owner-letter-list li` 9pt → 8pt
  - `owner-letter-cta p` 9.5pt → 8.5pt
  - `owner-letter-grid gap` menor (4pt)
  - reduzir margens dos cards/faixa em ~1pt
- Manter `.acm-page` travada em 210×297mm com `overflow: hidden` (proteção contra estouro).

### 3. Validação
- Abrir `/app/relatorio/<id>?auto=onepager` (ou usar o botão Exportar PDF) e simular via Playwright/print preview para confirmar que a página 3 segue como **1 única folha A4 retrato** com todos os novos blocos visíveis.

## Escopo
- Sem mudanças na página 1 (one-pager) nem na página 2 (Argumentos).
- Sem mudança em lógica/cálculo — só apresentação na página 3.
