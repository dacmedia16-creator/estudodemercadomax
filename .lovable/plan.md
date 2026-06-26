## Objetivo
Refazer o layout de impressão do relatório para caber tudo em **uma única folha A4**, mantendo hierarquia visual clara e destaque para o valor recomendado.

## Estratégia
Trocar o modelo atual (capa + várias seções com `page-break`) por um **dashboard de uma página** estilo "one-pager executivo", com grid denso e tipografia reduzida apenas no modo `@media print`. A visualização na tela continua igual.

## Layout proposto (A4 retrato, margens 8mm)

```text
┌─────────────────────────────────────────────────────┐
│ HEADER (slim)  Radar Imobiliário Pro · data · ID    │
├─────────────────────────────────────────────────────┤
│ TÍTULO DO IMÓVEL  ·  endereço · tipo · m² · quartos │
├──────────────────────────┬──────────────────────────┤
│  VALOR RECOMENDADO       │  Mín fechamento          │
│  R$ XXX.XXX  (destaque)  │  Máx publicação          │
│                          │  R$/m² · amostra · DOM   │
├──────────────────────────┴──────────────────────────┤
│ RESUMO ACM (3 colunas compactas: fatores | custos | │
│ resultado)                                          │
├─────────────────────────────────────────────────────┤
│ COMPARÁVEIS (tabela enxuta, até 6 linhas)           │
│ Endereço · m² · quartos · preço · R$/m² · portal    │
├──────────────────────────┬──────────────────────────┤
│ PONTOS FORTES (bullets)  │ PONTOS DE ATENÇÃO        │
├──────────────────────────┴──────────────────────────┤
│ FOOTER: sugestão comercial em 1 linha + paginação   │
└─────────────────────────────────────────────────────┘
```

## Mudanças técnicas

1. **`src/styles.css` – bloco `@media print`**
   - `@page { size: A4; margin: 8mm }`.
   - Reset de `font-size` base para 9pt; títulos 11–14pt; valor recomendado 28pt.
   - Forçar `html, body { height: 297mm }` e desabilitar `page-break-*` antigos (`break-before: auto`).
   - Nova classe utilitária `.print-onepager` com grid CSS (12 colunas, gap 6pt).
   - Esconder elementos não essenciais: cards de indicadores duplicados, gráficos Recharts, painéis interativos, `CriteriosEditor`, `AcmPanel` sliders, badges grandes.
   - Limitar tabela de comparáveis a 6 linhas via `tr:nth-child(n+7) { display:none }` no print.

2. **`src/routes/app.relatorio.$id.tsx`**
   - Substituir o `PrintCover` atual por um componente `PrintOnePager` único renderizado apenas em `print` (`hidden print:block`), que monta o layout acima a partir do `study` já carregado.
   - Esconder via `print:hidden` toda a versão tela do relatório durante impressão.
   - Garantir que valores ACM (recomendado/mín/máx), top 6 comparáveis ordenados por similaridade, e até 4 bullets de cada coluna venham do mesmo state já existente — sem alterar lógica de cálculo.

3. **`src/components/acm-panel.tsx`**
   - Já oculta sliders no print; adicionar variante compacta (`text-[9pt]`, sem cards grandes) quando dentro do `PrintOnePager`.

## Fora do escopo
- Não mexer em cálculos, busca, ou dados.
- Sem mudanças visuais na tela (somente `@media print`).
- Sem nova dependência de PDF; continua via `window.print()`.

## Validação
Abrir `/app/relatorio/:id`, `Ctrl+P` → "Salvar como PDF" → conferir que cabe em 1 página A4 com hierarquia legível e o valor recomendado em destaque.
