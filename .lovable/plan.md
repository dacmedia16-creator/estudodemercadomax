# Corrigir layout das páginas "Argumentos" / "Carta" no PDF padrão

## Problema
No "Exportar PDF" (one-pager), as páginas **Argumentos para o Proprietário** e **Carta ao Proprietário** estão saindo com conteúdo estreito (~210 mm) dentro de uma folha A4 paisagem, deixando uma faixa branca enorme à direita. Causa: essas páginas reaproveitam `.acm-page` (largura fixa **297 mm**, desenhada para A4 paisagem do slide ACM), mas o job de impressão do botão "Exportar PDF" é A4 retrato — o named page `@page acm { size: A4 landscape }` não rotaciona de forma confiável no Chrome quando misturado com retrato, então o conteúdo de 297 mm aparece "cortado" / sub-ocupado.

## Solução
Tornar as páginas **Argumentos** e **Carta** **A4 retrato (210 × 297 mm)** quando renderizadas dentro de `.print-owner-pages` (fluxo do botão "Exportar PDF"), mantendo o slide ACM em paisagem como hoje.

### Mudanças em `src/styles.css`

1. Substituir o bloco `.print-owner-pages > .acm-page` por estilos retrato:
   - `size: A4 portrait` em `@page owner` nomeado
   - `width: 210mm; height: 297mm; padding: 12mm 12mm`
   - usar `page: owner` em vez de `page: acm`
2. Manter `.print-slides .acm-page` em 297 mm (paisagem) para o modo ACM/slides — nenhuma mudança no slide ACM principal.

### Mudanças em `src/components/print-slides.tsx` (apenas layout das duas páginas)

Reorganizar grids que assumiam largura de paisagem para caber confortavelmente em retrato:
- **OwnerPersuasionPage**: o bloco "Por que afasta compradores" + "5 concorrentes" hoje fica lado a lado (2 colunas). Em retrato vira **empilhado** (concorrentes em tabela full-width abaixo do texto). "Argumentos prontos" + "Riscos" continua 2 colunas (cabem bem). "Faixa recomendada" 4 cards continuam em linha.
- **OwnerLetterPage**: 3 cartões grandes (atual → recomendado → diferença) continuam em linha. Bloco "O que o mercado está dizendo" e "Por que ajustar agora" empilhados. Faixa visual mantém largura cheia.
- Reduzir um pouco font-sizes de títulos de bloco (de ~10.5pt → 9.5pt) para garantir que cada página caiba em uma folha A4 retrato sem quebra.

### Resultado
"Exportar PDF" gera: **página 1 (one-pager A4 retrato)** → **página 2 Argumentos (A4 retrato)** → **página 3 Carta (A4 retrato)**. Tudo no mesmo tamanho de folha, sem espaço em branco lateral. O "Exportar ACM" continua produzindo o slide ACM em paisagem, sem mudanças.

## Fora de escopo
- Slide ACM principal (continua paisagem)
- Lógica de cálculo / textos / dados
