## Causa
1. Busca livre sem cidade enviou `city:""` / `state:""` à server function `geckoPlp`, que tem Zod exigindo city≥1 e state=2 chars → 400 → fallback demo.
2. Sem comparáveis, `generateStudy` devolveu valores `null` e o relatório chamou `toLocaleString` em null → tela de erro.

## Correções

**`src/lib/gecko.functions.ts`**
- Validador da PLP: `city` vira opcional (string vazia ok), `state` aceita "" ou 2 chars.
- No handler, montar o payload pra GeckoAPI omitindo `city`/`state` quando vazios e exigindo `keyword` nesse caso; se faltar tudo, retornar erro amigável `MISSING_QUERY`.

**`src/lib/study-runner.ts`**
- Detectar modo "busca livre" (`cidade` vazia): pular layers de edifício/endereço, rodar apenas a layer keyword com até 3 páginas.
- Relaxar filtros locais quando cidade/bairro vazios: aceitar todos os imóveis retornados que casem com `tipo` (quando informado).
- Garantir que `chosen` nunca explode quando `bairrosAlvo` está vazio.

**`src/lib/study-engine.ts`**
- `formatBRL` aceita `null|undefined` e retorna `"—"`.
- `generateStudy` com 0 comparáveis: preencher campos numéricos com 0 e textos com placeholders ("—"), nunca `null`.

**`src/routes/app.relatorio.$id.tsx`**
- Se `result.comparaveis.length === 0`, renderizar card "Sem imóveis compatíveis. Refine a busca." e esconder gráficos/tabelas que dependem dos números.

## Fora de escopo
- Layout geral do relatório, formulário detalhado, painel de critérios.
