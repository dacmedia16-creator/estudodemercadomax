## Diagnóstico

`api_usage` das últimas buscas mostra: **1 PLP Zap (200, 0 itens) + 0 PLP Chaves + 1 PLP OLX + 3 PDP OLX**. O Zap até é chamado, mas devolve vazio e o orquestrador não se recupera; o Chaves nem entra.

### Causa 1 — Zap volta vazio por excesso de filtros nativos
Em `src/lib/study-runner.ts` (~580–610) enviamos juntos: `bedrooms` exato, `priceMin/Max` ±30%, `areaMin/Max` ±25%, `latitude/longitude/radius` 2 km e `amenities`. Anúncios que não declaram esses campos no formato esperado são cortados pelo PLP, zerando a página.

Já existe um retry "sem filtros nativos" (~646–679), mas ele só roda se `!exhaustedGlobal.has(zap)`. Como `200 + items:[] + hasNextPage:false` marca o portal como esgotado, **o retry nunca dispara**.

### Causa 2 — Chaves fora do estudo
- Camadas 1 e 2 (keyword de prédio/endereço) pulam Chaves por design (`keywordOnlyLayer`).
- Camada 3 depende dos mesmos filtros nativos do Zap; se zerar, Chaves também sai sem aparecer no funil — usuário não percebe.

## Mudanças

1. **`src/lib/study-runner.ts` — separar "esgotado nesta query" de "esgotado global por filtros":**
   - PLP que volta `items:[]` *na 1ª página* + filtros nativos enviados → só `exhaustedThisQuery`, nunca `exhaustedGlobal`.
   - `exhaustedGlobal` permanece para HTTP error, `notFound` real, ou esgotamento após ≥1 página com itens.

2. **`src/lib/study-runner.ts` — retry escalonado por portal (Zap **e** Chaves):**
   - Generalizar o bloco "retry Zap sem filtros nativos" para iterar sobre `[zap, chaves]`.
   - Roda sempre que `perPortal[t].bairro.recebidos === 0` (independente de `exhaustedGlobal`).
   - Dois passos:
     a) tira `amenities` + `radius`, mantém bedrooms/price/area;
     b) se ainda 0, tira também bedrooms/price/area/lat/lng (fica city/state/keyword/propertyType/neighborhood).
   - Cada passo escreve linha no `funilBusca` ("Zap: retry afrouxando amenities", "Chaves: retry sem filtros nativos").

3. **`src/lib/study-runner.ts` — defaults nativos mais largos:**
   - `priceMin/Max` enviado ao PLP passa a ±40% (o `strictLocal` continua ±30% local — pontuação não muda).
   - `areaMin/Max` ao PLP **só quando o usuário definiu range manual** via override; senão filtra local.
   - `bedrooms` ao PLP só quando `fieldModes.quartos === "hard"`; senão filtra local.

4. **`src/lib/study-runner.ts` — funil mais explícito:**
   - "Zap: 0 itens com filtros nativos — tentando retry" quando aplicável.
   - "Chaves: desativado nas configurações" quando `isChavesEnabled()` for false e `input.portais` não cobrir Chaves (mostra ao usuário onde mexer).

5. **Sem schema, sem UI nova.** O componente de funil já renderiza cada entrada — as linhas novas aparecem sozinhas no painel "Critérios da busca".

## Custo
Estudos que já funcionam: **iguais**. Estudos onde Zap zerava hoje: **+1 a 2 PLPs**, podendo somar +3 PDPs Zap/Chaves. Em troca, voltam a ter Zap+Chaves+OLX no laudo e o comparável "mesmo prédio/endereço" volta a aparecer.

## Validação
- Rodar um estudo que vinha "só OLX" e conferir, no `api_usage`, múltiplas PLP Zap (1 inicial + 1 retry) com itens, e PLP Chaves presente.
- No relatório, "Critérios da busca" deve mostrar a linha de retry quando ocorrer.
- Sanidade: `strictLocal` segue intacto, então mediana/ACM não perde qualidade — só ganha amostra.
