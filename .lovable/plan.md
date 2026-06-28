## Problema

No estudo de **Venda**, um anúncio de aluguel da OLX entrou na tabela (R$ 3.800 / R$ 41 m²), puxando médias e estatísticas para baixo. Não há filtro de finalidade (venda × aluguel) na hora de aceitar o item retornado pela GeckoAPI, só na hora de montar a busca.

## Causa

- O parser OLX (`olxItemToProperty` em `src/lib/gecko-adapter.ts`) aceita qualquer `price > 0`, sem checar se o anúncio é de venda ou locação. O mesmo vale para os parsers genérico/Zap/Chaves (campos `rentPrice`, `rent.price` são tratados como preço válido).
- O runner (`src/lib/study-runner.ts`) define `businessType` mas não confere se o item devolvido respeita a finalidade — nas camadas "Mesmo prédio/Endereço" usamos keyword livre, então a OLX pode devolver itens de outra categoria.
- Não há guarda mínima de preço: R$ 3.800 num estudo de venda é claramente locação, mas passa.

## Plano

1. **Marcar finalidade do item no parser** (`gecko-adapter.ts`)
   - OLX: ler `category.id`/`subcategory.id`/`listingType`/URL (`/aluguel/`, `/locacao/`) e expor `finalidade: "Venda" | "Aluguel" | undefined` no `MockProperty` retornado. Remover o fallback para `rentPrice`/`rent.price` quando o item não declara venda.
   - Zap: usar `listing.pricingInfos[].businessType` (`SALE` × `RENTAL`).
   - Chaves: usar `businessType`/`transactionType` quando presente.

2. **Filtrar por finalidade no runner** (`study-runner.ts`)
   - Após parsear cada lote (todas as camadas: prédio, endereço, bairro, PDP), descartar itens cuja `finalidade` seja oposta à do estudo. Contabilizar no funil: `Removidos por finalidade incompatível`.

3. **Guarda de sanidade de preço** (runner)
   - Em estudos de **Venda**: descartar preço total < R$ 50.000 **ou** R$/m² < 500 quando `areaUtil > 0`. Esses limites pegam locações disfarçadas mesmo quando o campo de finalidade está ausente.
   - Em estudos de **Aluguel**: descartar preço > R$ 50.000 (provável venda).
   - Adicionar contador no funil: `Removidos por preço fora da faixa de <finalidade>`.

4. **UI**: nenhuma mudança de layout. O funil já existente em `report` mostrará as novas linhas automaticamente.

## Arquivos

- `src/lib/gecko-adapter.ts` — adicionar detecção de finalidade nos 3 parsers; remover fallback de rentPrice.
- `src/lib/study-runner.ts` — filtro por finalidade + guarda de preço; instrumentar funil.
- `src/lib/mock-properties.ts` (tipo `MockProperty`) — adicionar campo opcional `finalidade`.

Sem mudanças em UI, store, ou banco.
