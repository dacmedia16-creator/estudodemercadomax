## Objetivo

Ocultar o controle **"Margem de negociação"** no painel ACM.

## Alteração — `src/components/acm-panel.tsx`

Remover o bloco `<div>` que contém o label "Margem de negociação", o `<Slider>` de `margemPublicacaoPct` e o texto explicativo abaixo.

## Fora do escopo

- Não alterar `margemPublicacaoPct` em `study-types` nem sua lógica em `study-engine`. O valor padrão continua sendo aplicado silenciosamente.