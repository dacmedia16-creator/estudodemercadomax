## Problema

A análise por IA falha com erro de validação Zod no cliente, antes de chegar no servidor:

```
mercado.precoM2Medio → Invalid input (expected number)
comparaveis[9].precoM2 → Invalid input (expected number)
```

Causa: o estudo atual tem `precoM2Medio` ausente/`NaN` (média R$/m² aparece como "—" na tela) e pelo menos um comparável sem `precoM2`. O `inputSchema` em `src/lib/ai-analysis.functions.ts` exige `number` nesses campos, então o `.parse()` do `inputValidator` rejeita o payload no client antes de chamar o servidor.

## Correção

1. **`src/lib/ai-analysis.functions.ts`** — tornar o schema tolerante:
   - `precoM2Medio`, `menorPreco`, `maiorPreco`, `precoMedio` → `z.number().nullish().transform(v => Number(v) || 0)`.
   - Em `comparavelSchema`: `preco`, `precoM2`, `areaUtil`, `quartos`, `similaridade` → mesma transformação tolerante (aceita `null`/`undefined`/`NaN` e cai para 0).
   - Manter os campos obrigatórios do `imovel` como estão.

2. **`src/components/ai-analysis-card.tsx`** — sanitizar antes de enviar:
   - Substituir cada número pelo `Number(x) || 0` ao montar `payload.mercado` e `payload.comparaveis`, evitando enviar `NaN`/`undefined`.
   - Filtrar comparáveis sem `preco > 0` (não fazem sentido para a IA).

3. **Mensagem de erro** — se após sanitização não houver nenhum comparável com preço válido, mostrar toast claro ("Sem comparáveis com preço para analisar") em vez de chamar a IA.

Nenhuma mudança de UI ou lógica de busca — apenas robustez na chamada da análise.