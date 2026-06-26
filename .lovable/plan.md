## Achados ao ler a doc do Chaves na Mão PLP/PDP

A doc revela que nossa integração com Chaves está **subutilizando muito** o que o portal aceita, e que o adapter está lendo **os campos errados** do payload do Chaves (por isso muitos imóveis caem como "sem preço/área"). Resumo dos gaps:

### Gap 1 — Adapter lê o shape errado do Chaves (impacto alto)
Hoje `geckoItemToProperty` assume o shape do Zap (`prices.mainValue`, `usableAreas`, `bedrooms`, `parkingSpaces`, `images[].url`, `advertiser.mainPhone`). O Chaves usa outra estrutura:

| Campo | Zap | Chaves |
|---|---|---|
| Preço | `prices.mainValue` | `prices.rawPrice` |
| Condomínio | `prices.monthlyCondoFee` | `prices.condominiumFee` |
| IPTU | `prices.iptu` | `prices.iptuValue` |
| Área útil | `usableAreas[0]` | `area.useful` |
| Quartos | `bedrooms[0]` | `counts.bedrooms.count` |
| Banheiros | `bathrooms[0]` | `counts.bathrooms.count` |
| Suítes | `suites[0]` | `counts.suites.count` |
| Vagas | `parkingSpaces[0]` | `counts.garages.count` |
| Imagem | `images[0].url` (objeto) | `featuredImage` / `images[0]` (string) |
| Telefone | `advertiser.mainPhone` | `advertiser.phones.cellphone` |
| WhatsApp | `advertiser.whatsAppNumber` | (não exposto — derivar do `cellphone`) |
| Data | `createdAt` | `updatedAt` |
| Bairro/cidade | `address.neighborhood/city` | `address.neighborhood/city` ✓ |
| Lat/lng | `address.latitude/longitude` | `address.latitude/longitude` ✓ |

Hoje a tolerância parcial pega o preço em alguns casos via `parsePrice(anyItem.price)`, mas área e quartos sempre voltam `null` → todo item Chaves vira `incomplete` e é filtrado nas camadas estritas.

### Gap 2 — PLP do Chaves NÃO aceita `keyword` (impacto crítico)
A doc lista os inputs aceitos: `city`, `state`, `neighborhood`, `propertyTypes`, `amenities`, `bedrooms`, `bathrooms`, `parkingSpots`, `priceMin/Max`, `areaMin/Max`, `directOwner`, `condominium`, `includeLaunches`, `sort`, `latitude`, `longitude`. **Não tem `keyword`.** Nossas camadas:
- **Camada 1 (mesmo condomínio)** passa `keyword: edificio` → Chaves ignora → busca genérica → 0 matches do prédio → créditos gastos à toa.
- **Camada 2 (mesmo endereço)** passa `keyword: "rua X bairro"` → mesmo problema.
- **Camada 3 (bairro)** passa `keyword: "tipo bairro"` mas não passa o campo `neighborhood` dedicado.

### Gap 3 — Filtros nativos do Chaves estão sendo strippados
Há 2 turns a gente "stripou tudo" pro Chaves achando que quebrava. A doc confirma que ele aceita: `bedrooms`, `bathrooms`, `parkingSpots`, `priceMin/Max`, `areaMin/Max`, `latitude`, `longitude` (com filtro 2 km no próprio worker do Gecko). Hoje a gente envia só `city + businessType + keyword` — perde toda capacidade de filtro nativo. **Atenção:** `bedrooms/bathrooms/parkingSpots` aceitam só **1 valor por request** no Chaves (a doc é explícita).

### Gap 4 — `propertyTypes` (plural, aliases pt) não é mapeado
Chaves usa aliases lowercase: `apartment`, `house`, `penthouse`, `land`, `commercial_room`, `loft`, `flat`, `farm`. Hoje a gente strippa `propertyType` (singular, Zap-style) e não envia nada. Resultado: a busca volta TODOS os tipos do bairro misturados.

### Gap 5 — Lat/lng do Chaves também serve (impacto médio)
A doc diz que o próprio worker aplica raio de 2 km quando `latitude/longitude` são enviados. Hoje a gente strippa do Chaves. Com o geocoding que já temos, dá pra mandar e cortar muito anúncio fora.

### Gap 6 — `updatedAt` como proxy de DOM e `gmb.rating` para anunciante
PDP do Chaves não tem `createdAt`. Usar `updatedAt` (já indica frescor do anúncio). `gmb.rating` pode alimentar `advertiserRating`.

---

## Plano de implementação

Tudo dividido em 3 arquivos. Sem mudanças em UI/relatório.

### 1) `src/lib/gecko-adapter.ts` — adapter dual-shape
- Criar `chavesItemToProperty(item, portal)` que lê os caminhos corretos:
  - preço: `prices.rawPrice` || `prices.maxPrice`
  - condomínio: `prices.condominiumFee`
  - iptu: `prices.iptuValue`
  - área: `area.useful` || `area.total`
  - quartos: `counts.bedrooms.count`
  - banheiros: `counts.bathrooms.count`
  - suítes: `counts.suites.count`
  - vagas: `counts.garages.count`
  - imagem: `featuredImage` || `images[0]` (string)
  - bairro/cidade/estado/lat/lng: `address.*`
  - anunciante: `advertiser.name`, `advertiser.phones.cellphone`, `advertiser.creci`
  - whatsApp: derivar do `cellphone` removendo máscara (link `wa.me/55…`) quando `phones.public === true`
  - amenidades: `privativeAmenities` + `commonAmenities` concatenados
  - data: `updatedAt` → `diasMercado`
- No `geckoItemToProperty(item, portal)` existente, **detectar** o shape: se `portal === "Chaves na Mão"` OU `item.counts?.bedrooms` existe → delegar para `chavesItemToProperty`. Caso contrário, manter código atual (Zap).
- No `enrichWithPdp`: já desce 1 nível (`outer.data`). Após descer, chama o mesmo `geckoItemToProperty(inner, p.portal)`, que vai despachar corretamente.

### 2) `src/lib/gecko.functions.ts` — aceitar campos do Chaves
- Estender `plpInput` com campos opcionais: `neighborhood` (string), `propertyTypes` (array string), `amenities` (array string), `directOwner` (bool), `condominium` (bool), `includeLaunches` (bool), `sort` (string).
- No handler, montar o body:
  - `neighborhood` enviado quando presente.
  - `propertyTypes` enviado quando target === `chavesnamao.com.br`.
  - `propertyType` (singular, UPPERCASE) continua só para Zap.
  - `directOwner`, `condominium`, `includeLaunches`, `amenities`, `sort` enviados quando presentes (úteis para Chaves; harmless ignorados pelo Zap, mas só enviar quando target === Chaves para não poluir).
- Manter `bedrooms`/`price`/`area` como já está — funciona pros dois agora.

### 3) `src/lib/study-runner.ts` — params por portal corretos
- Novo mapa `mapTipoToChavesAlias`:
  ```ts
  apartamento → "apartment"
  apto → "apartment"
  cobertura → "penthouse"
  casa → "house"
  sobrado → "house"
  studio → "flat"
  kitnet → "flat"
  loft → "loft"
  terreno → "land"
  sala/comercial → "commercial_room"
  ```
- Override per-portal no `adaptivePaginate`, **camada bairro**:
  ```ts
  t === "chavesnamao.com.br" ? {
    city, state, businessType,
    neighborhood: bairro || undefined,
    propertyTypes: chavesAlias ? [chavesAlias] : undefined,
    // Chaves: 1 valor por request
    bedrooms: bedroomsList?.length ? [bedroomsList[0]] : undefined,
    priceMin, priceMax, areaMin, areaMax,
    latitude: geoLat, longitude: geoLng,
  } : params
  ```
- **Camadas condomínio/endereço (keyword-only):** Chaves não suporta keyword → **pular Chaves nessas camadas**. No `adaptivePaginate`, quando `layerKey === "condominio"` ou `"endereco"`, remover Chaves de `remaining`. Adicionar ao funil uma única linha: `Chaves na Mão: pulado em camadas de keyword (não suportado pela API)`.
- Manter strip de `radius` (não é input do Chaves; o worker aplica 2 km fixo).

### Validação
- `tsgo` (typecheck).
- Rodar estudo em **Curitiba/PR, Centro, apartamento 3 quartos** (mesmo exemplo da doc).
  - Funil deve mostrar `Chaves na Mão: total disponível no portal: ~33000`.
  - Comparáveis Chaves devem ter preço, área e quartos preenchidos (não vão mais cair em `incomplete`).
  - Funil deve mostrar `Chaves na Mão: pulado em camadas keyword` quando edifício/endereço informados.
- Confirmar que comparáveis Chaves carregam `latitude/longitude` (vão entrar no filtro Haversine corretamente).

### Fora do escopo
- Toggle de UI para `amenities`/`directOwner` no formulário (a doc oferece, mas sem demanda explícita).
- Paginação por URL pública (`url:` no PLP) — mantemos o fluxo por filtros.
- Aceitar `bedrooms` como range no Chaves — a API limita a 1 valor; podemos rodar PLPs separados por valor de quartos, mas isso duplica créditos. Sem ganho claro agora.
