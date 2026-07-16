## Objetivo

Ocultar o card **"Piso competitivo"** no resumo da Avaliação ACM.

## Alteração — `src/components/acm-panel.tsx`

Remover o bloco `{computed.valorPiso > 0 && (<SummaryItem label="Piso competitivo" ... />)}` dentro do grid de resumo.

## Fora do escopo

- Não alterar a lógica de piso em `study-engine` (segue sendo usada para limitar o valor sugerido).