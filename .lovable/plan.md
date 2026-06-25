## Objetivo
Aumentar a cobertura da busca consultando **até 3 páginas** da GeckoAPI (PLP), em vez de apenas 1.

## Mudanças

### 1. `src/lib/study-runner.ts`
- Adicionar constante `MAX_PAGES = 3` (ou ler de `overrides.maxPages`, default 3, teto 3).
- Criar helper `fetchPlpPages(params, maxPages)` que:
  - Chama `geckoPlp` para `page: 1..maxPages` sequencialmente.
  - Interrompe cedo se uma página retornar 0 itens.
  - Concatena `items` de todas as páginas e deduplica por `url`/`id`.
  - Retorna `{ items, pagesFetched }`.
- Usar o helper tanto na **Layer 0 (edifício)** quanto na **PLP principal do bairro**.
- Registrar no `funilBusca` quantas páginas foram efetivamente consultadas em cada etapa (ex.: `"Páginas consultadas (bairro)": 3`).
- Tratamento de erro: se a página 2 ou 3 falhar, mantém o que já veio da página 1 e segue (não derruba o estudo).

### 2. `src/lib/study-types.ts`
- Adicionar `maxPages?: number` em `SearchOverrides`.

### 3. `src/components/criterios-editor.tsx`
- Novo controle no painel: campo numérico ou select **"Páginas por busca"** (1, 2, 3 — default 3).
- Enviar `maxPages` em `onRerun`.

### 4. Sem mudanças em
- `gecko.functions.ts` (já aceita `page`).
- `gecko-adapter.ts`, `study-engine.ts`, relatório (funil já é renderizado a partir de `funilBusca`).

## Observação de custo
3 páginas = até 3× chamadas PLP por estudo (1× para edifício + 1× principal viram até 6 chamadas). PDPs continuam limitados aos top 6 comparáveis, sem mudança.
