## Objetivo
Permitir confirmar e analisar qualquer frase digitada na Busca rápida, mesmo sem cidade/bairro identificados.

## Mudanças

**`src/components/busca-rapida.tsx`**
- Remover a checagem que desabilita o botão "Confirmar e analisar" quando falta cidade.
- Remover/ignorar o array `blockers`; o botão fica sempre ativo enquanto houver texto na frase.
- Manter os campos Cidade/Bairro editáveis inline, mas sem indicador de "obrigatório".
- Ao confirmar sem cidade: passar a frase original como `keyword` livre para o runner e deixar `cidade`/`bairro` vazios.

**`src/lib/study-runner.ts` (ajuste mínimo)**
- Garantir que o pipeline aceite execução sem cidade/bairro: quando ambos vazios, roda apenas a camada por `keyword` (frase original) na PLP, até 3 páginas, sem exigir filtros estruturados.
- Se nada vier, retorna relatório vazio com mensagem amigável (não trava).

**`src/lib/query-parser.ts`**
- Manter o parser como está (só extrai o que conseguir), mas remover `blockers` da interface `ParsedQuery` (ou deixar sempre `[]`).

## Fora de escopo
- Não mexer no formulário detalhado.
- Não mudar layout/visual além de esconder o aviso de campo obrigatório.
