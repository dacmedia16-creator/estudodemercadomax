## Diagnóstico

Olhando o `src/lib/study-runner.ts` achei duas causas concretas:

### Bug 1 — Zap fica "esgotado" para sempre quando a camada 1 (edifício) retorna 0

`exhaustedGlobal` é compartilhado entre as 3 camadas. Quando a camada 1 manda `keyword: edificio` ("Cannes Campolim") pro Zap e a primeira página vem com `items: []`, o código marca **Zap como exhausted globalmente**. Resultado: a camada 3 (bairro, que é a que de fato traz comparáveis) **nem chama mais o Zap** — só o Chaves. É exatamente o que seu print mostra (10/10 cards são Chaves).

```ts
// hoje: items.length === 0 → exhaustedGlobal.add(t) → próximas camadas pulam o portal
if (items.length === 0) exhaustedGlobal.add(t);
```

### Bug 2 — "Mesmo endereço" não casa quando o usuário põe o número

`matchEndereco` exige que **todos** os tokens significativos do endereço apareçam no anúncio:

```ts
return tokens.every((t) => hay.includes(t));
```

Se o usuário digita "Rua Coronel Nogueira Padilha, 1000", os tokens viram `["coronel","nogueira","padilha","1000"]`. Quase nenhum anúncio coloca o número exato no título/descrição do Zap/Chaves, então o `every()` falha sempre e a camada zera. Pior: o keyword enviado pro PLP (`${enderecoRaw} ${bairro}`) inclui o número, o que joga a relevância do Zap pra zero.

## Correções

**Arquivo único:** `src/lib/study-runner.ts`.

### 1. Tirar o "exhaust on empty"

- `exhaustedGlobal` passa a marcar portal apenas em casos definitivos: `notFound: true`, erro HTTP, ou `nextPage == null && totalPages` consumido.
- Quando `items: []` numa camada com `keyword`, parar só **aquela** paginação, **não** banir o portal para as próximas camadas. Manter um `exhaustedThisQuery` local por chamada de `adaptivePaginate`.

### 2. Endereço sem número

- Em `matchEndereco`: separar tokens em `nameTokens` (não-numéricos, len≥3, sem stopword) e `numberToken` (puro dígito). Exigir todos os `nameTokens`; o número fica como **bônus opcional** (se casar, é "Mesmo endereço exato"; se não, ainda conta como mesmo endereço).
- No envio do keyword pra Zap/Chaves na camada `endereco`, **remover o número** (`enderecoRaw.replace(/,?\s*\d+\s*$/, "").trim()`) — Zap relevância funciona melhor sem o número.

### 3. Retry de Zap quando a camada de bairro vier vazia

Após `adaptivePaginate` da camada `bairro`, se `perPortal["zapimoveis.com.br"].bairro.recebidos === 0` e o portal não está em `exhaustedGlobal` por `notFound`, fazer **uma segunda passada apenas pro Zap** com filtros nativos relaxados:
- sem `bedrooms`, `priceMin/Max`, `areaMin/Max`
- sem `latitude/longitude/radius` (geocoding do Nominatim pode estar fora do polígono)
- mantém `keyword`, `city`, `state`, `propertyType`, `page: 1..maxPages`

Adicionar linha no funil: `"Zap Imóveis: retry sem filtros nativos"` para transparência.

### 4. Funil mais útil

- Mostrar `"<portal>: 0 retornados em <camada>"` por camada quando recebidos = 0 (hoje só aparece o agregado, fica difícil debugar).
- Mostrar a flag de "Mesmo endereço exato (número confere)" no diagnóstico quando algum comparável casar o número.

## Verificação

- `tsgo` (typecheck) limpo.
- Você roda novo estudo em Sorocaba/SP · Parque Campolim · "Cannes Campolim" e confere no funil:
  - linha `Zap Imóveis: <N> recebidos / <M> aproveitados` com N>0
  - linha `Mesmo endereço (...)` com total > 0 mesmo com o número preenchido

## Fora do escopo

- Não vou geocodar de novo nem ajustar o raio padrão — o raio editável fica como está.
- Não vou mudar o adapter nem a integração com Chaves.