## Objetivo

Ocultar o card **"Mínimo de fechamento"** no resumo da Avaliação ACM.

## Alteração — `src/components/acm-panel.tsx`

Remover (ou comentar) o bloco `<SummaryItem label="Mínimo de fechamento" ... />` dentro do grid de resumo (linha ~334).

## Fora do escopo

- Não alterar cálculo de `valorMinimoFechamento` em `study-engine` (permanece disponível caso seja usado em outros lugares como relatório/slides).
- Não mexer nos outros cards do resumo.