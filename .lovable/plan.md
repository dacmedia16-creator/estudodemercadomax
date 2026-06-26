
## Estudo: GeckoAPI Zap Imóveis PLP

Você só pediu pra estudar — abaixo o resumo do doc + o que dá pra melhorar no código atual quando quiser implementar. **Nada será alterado até você aprovar.**

### O que o endpoint oferece

`POST /v1/extract` com `target: "zapimoveis.com.br"`, `type: "plp"`.

**Inputs úteis que já podemos mandar (mas hoje NÃO mandamos):**

| Campo | O que faz | Status no nosso código |
|---|---|---|
| `bedrooms: int[]` | Filtra quartos no upstream | ❌ Aceito no Zod, **não enviado** pelo `study-runner` |
| `bathrooms: int[]` | Filtra banheiros | ❌ Não enviado |
| `parkingSpots: int[]` | Filtra vagas | ❌ Não enviado |
| `priceMin` / `priceMax` | Faixa de preço no upstream | ❌ Não enviado |
| `areaMin` / `areaMax` | Faixa de área (m²) | ❌ Não enviado |
| `latitude` + `longitude` | Raio de 2 km ao redor do ponto | ❌ Não usado (mesmo quando temos lat/lng do CEP/PDP) |

Hoje o runner faz PLP "wide" e filtra tudo localmente, o que **gasta créditos** trazendo páginas cheias de anúncios fora da faixa. Mandar esses filtros nativos reduziria descartes e o número de páginas necessárias.

### Output (campos que valem aproveitar)

```
data.totalResults       → quantos resultados existem (decisão de parar paginação)
data.nextPage           → null/ausente = última página (parar sem chamar mais)
data.items[].address.latitude/longitude   → mapa + raio
data.items[].prices.mainValue + period    → já usamos
data.items[].amenities[] / stamps[]       → enriquece tabela
data.items[].advertiser.{id,name}         → já agrupamos no relatório
data.items[].childrenCount                → card agregado (vários anúncios juntos) — hoje tratamos como 1 só
```

**Limitação importante:** PLP **não** retorna `bedrooms`/`usableAreas` por item — por isso o adapter depende de regex na `description`. Por isso enviar `bedrooms`/`areaMin/Max` ao upstream é a **única forma barata** de pré-filtrar sem PDP.

### `notFound: true`

PLP também pode retornar `200` com `data: null` + `notFound: true` (cidade/UF que o Zap não reconhece). Hoje tratamos como "0 itens" e seguimos — está OK, mas vale logar como aviso explícito.

### Oportunidades concretas (lista de implementação futura)

1. **Mandar filtros nativos no PLP** (`bedrooms`, `areaMin/Max`, `priceMin/Max`) — corta páginas inúteis e ~30-50% menos PDPs descartados.
2. **Usar `latitude`/`longitude` quando disponível** (do CEP via ViaCEP/geocoder ou do primeiro PDP) — raio de 2 km substitui as camadas frágeis de "mesmo endereço".
3. **Parar paginação por `nextPage == null`** em vez de só pelo TARGET — economiza 1 chamada por layer no fim das listas curtas.
4. **Expor `totalResults` no funil** — feedback útil ("achamos 824 anúncios, analisamos 24").
5. **Logar `notFound: true` separadamente** no funil/warning.
6. **Tratar `childrenCount > 0`** como badge "Anúncio agregado" e, opcionalmente, fazer 1 PDP extra para abrir os filhos.

### Conclusão

A integração atual está funcional mas **subutiliza o PLP** — manda só city/state/keyword e filtra tudo no cliente. Os ganhos maiores vêm de #1 (filtros nativos) e #2 (lat/lng). Quando quiser implementar, me diga quais itens entram e eu monto um plano com o passo a passo de código.
