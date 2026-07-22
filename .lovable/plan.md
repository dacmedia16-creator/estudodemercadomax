## Diagnóstico

Dois bugs distintos no painel "Ajustar comparáveis":

**1) Excluir 1 remove 5 de uma vez**
Em `src/components/comparaveis-manager.tsx`, `handleRemove` filtra por `id`:
```ts
study.comparaveis.filter((c) => c.id !== id)
```
Vários anúncios estão chegando com o **mesmo `id`**. Em `src/lib/gecko-adapter.ts` o id é obtido de `item.id ?? item.listingId ?? url` — no Viva Real (e às vezes no OLX) diferentes unidades do mesmo empreendimento voltam com o mesmo `listingId` de "development", então clicar em um "Barão de Iguatemi" apaga todos os irmãos que compartilham aquele id. O mesmo acontece com o cálculo de "removidos" e com o `computeSimilarity`/render (keys duplicadas no React).

**2) "Restaurar originais" só devolve o item que acabei de excluir**
Em `src/routes/app.relatorio.$id.tsx` (linha 65), `originalsRef` é preenchida com `s.comparaveis` **no momento em que o relatório abre**, ou seja, com a lista **já modificada** que foi salva no banco. Não existe snapshot verdadeiro dos originais da busca — só a última execução completa (`onRerun`, linha 173) reseta a ref. Ao recarregar a página, "originais" = "estado atual salvo", então restaurar não traz de volta nada que foi excluído em sessões anteriores.

## Correção

### A. IDs únicos por linha (resolve o bug #1)

- Em `src/lib/study-runner.ts`, logo depois de montar a lista final de comparáveis (antes de retornar o `StudyResult`), aplicar um deduplicador que garante `id` único: se um `id` se repete, sufixar com `#2`, `#3`, etc. Isso preserva a estabilidade do id nas linhas que já são únicas e conserta as duplicadas sem mexer nos adapters de cada portal.
- Aplicar o mesmo passo em `ComparaveisManager.handleAdd` ao inserir um item manual: se colidir com um id existente, sufixar antes de adicionar.

### B. Snapshot real dos "originais" (resolve o bug #2)

- Adicionar campo opcional `comparaveisOriginais?: ComparableProperty[]` em `StudyResult` (`src/lib/study-types.ts`).
- Em `src/lib/study-runner.ts`, ao finalizar a busca (novo estudo ou rerun), gravar `comparaveisOriginais = [...comparaveis]` no resultado — este é o snapshot imutável da última busca.
- Em `src/routes/app.relatorio.$id.tsx`:
  - Remover `originalsRef` e derivar `originals` direto de `study.comparaveisOriginais ?? study.comparaveis` (fallback para estudos antigos que ainda não têm o snapshot).
  - Passar esse array como prop `originals` para `ComparaveisManager`.
  - No `onRerun`, o novo `study` já vem com `comparaveisOriginais` atualizado, sem precisar de ref.
- Em `src/components/comparaveis-manager.tsx`, "Restaurar originais" continua chamando `recomputeStudy(study, originals)` — agora recebendo o snapshot verdadeiro.

### C. Migração leve para estudos antigos

Estudos salvos antes desta mudança não têm `comparaveisOriginais`. Para eles o botão continua se comportando como hoje (fallback = lista atual) até que o usuário rode "Refazer busca", quando o snapshot é criado. Sem migração de banco necessária — o campo mora dentro do `payload` JSON.

## Arquivos afetados

- `src/lib/study-types.ts` — novo campo `comparaveisOriginais?`.
- `src/lib/study-runner.ts` — dedupe de ids + preencher `comparaveisOriginais` no retorno.
- `src/routes/app.relatorio.$id.tsx` — usar `study.comparaveisOriginais` no lugar da ref.
- `src/components/comparaveis-manager.tsx` — dedupe de id ao adicionar manual.

Nenhuma mudança de schema Supabase, nenhuma mudança em RLS.
