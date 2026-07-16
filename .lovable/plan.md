## Objetivo

Ocultar o bloco **"Respeitar piso de mercado"** no painel ACM (inclui o toggle ATIVO/INATIVO, o slider "Máx. acima do piso" e o texto explicativo).

## Alteração — `src/components/acm-panel.tsx`

Remover o segundo `<div>` dentro do grid "Estratégia + piso competitivo" (linha ~115), que contém:
- Label "Respeitar piso de mercado" + botão ATIVO/INATIVO
- Slider `maxAcimaPisoPct`
- Texto explicativo

O grid passa a ter apenas a coluna "Estratégia de precificação" (removo `md:grid-cols-2` para virar uma coluna).

## Fora do escopo

- Não alterar `respeitarPiso` nem `maxAcimaPisoPct` em `study-types`/`study-engine`. Defaults continuam ativos silenciosamente.
