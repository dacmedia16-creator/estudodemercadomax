## Objetivo

Habilitar o portal **OLX** (`olx.com.br`) na busca de comparáveis, ao lado do Zap Imóveis e Chaves na Mão, respeitando as particularidades da API (`POST /v1/extract` com `target: "olx.com.br"`).

## O que vai mudar (visão geral)

1. **Server-side (`src/lib/gecko.functions.ts`)** — aceitar `"olx.com.br"` em `TARGETS` e enviar apenas os campos que a API da OLX entende.
2. **Adapter (`src/lib/gecko-adapter.ts`)** — novo parser `olxItemToProperty()` para o shape da OLX (PLP `items[]` plano e PDP em `data.data.*`).
3. **Runner (`src/lib/study-runner.ts`)** — incluir OLX nos targets, montar params específicos por portal e pular camadas inviáveis (mesma lógica que já fazemos com Chaves).
4. **Settings (`src/routes/app.configuracoes.tsx`)** — toggle "OLX" funcional, opção no select de teste e exemplo de URL.
5. **Métricas do funil** — OLX entra nos contadores por portal (recebidos/aproveitados/descartados) e no breakdown que aparece no relatório.

## Detalhes técnicos

### 1. `gecko.functions.ts`

- `TARGETS = ["zapimoveis.com.br", "chavesnamao.com.br", "olx.com.br"] as const`.
- Estender `plpInput` com campos exclusivos da OLX: `region?`, `categoryPath?`, `sort?` (manter o mesmo nome `sort` que Chaves já usa, OLX aceita `relevance|date|price|biggest_price|price_relevance`).
- Em `geckoPlp.handler`, novo branch `if (target === "olx.com.br")`:
  - **Obrigatório** mandar `state` (UF 2 letras) quando não há `url`. Se a UF do estudo estiver ausente, retornar `MISSING_QUERY` (igual ao caminho atual).
  - Enviar somente: `target, type: "plp", page, state, keyword?, city?, region?, categoryPath?, priceMin?, priceMax?, sort?`.
  - **Não enviar** `bedrooms/bathrooms/parkingSpots/areaMin/areaMax/latitude/longitude/radius/propertyType/propertyTypes/neighborhood/amenities/...` — OLX ignora e pode dar `INVALID_PAYLOAD`.
- `geckoPdp` já aceita qualquer URL — só precisa que `target` permita `"olx.com.br"`.

### 2. `gecko-adapter.ts`

- Novo dispatch no `geckoItemToProperty`: quando `portal === "OLX"` **ou** o item tem `position`/`listedAtEpoch`/`location.ddd` (assinatura PLP da OLX), delegar para `olxItemToProperty`.
- `olxItemToProperty(item, portal)`:
  - `preco` = `item.price` (ou parse `priceDisplay`). Sem preço → retorna `null`.
  - `bairro`/`cidade`/`estado` = `item.location.neighborhood|city|state`.
  - `titulo` = `item.title`; `descricao` vazia no PLP (descrição só existe no PDP).
  - `imagem` = `item.images[0].webpUrl ?? item.images[0].url`.
  - `url` = `item.url`; `id` = `item.id`.
  - `quartos` / `areaUtil` / `suites` / `vagas` / `banheiros`:
    - Procurar nos `item.properties[]` por `name` em (`real_estate_rooms`, `real_estate_useful_area`/`area_util`, `bathrooms`, `garage_spaces`, `suites`).
    - Fallback: regex no `title` (já fazemos no parser genérico).
    - Se ainda assim faltar → `incomplete = true` (já tratado pelo pipeline).
  - `diasMercado` ← `listedAt`.
  - `anunciante` ← `professionalAd ? "Profissional" : "Particular"` (OLX não retorna nome do vendedor no PLP por LGPD; PDP só traz `nameHash`).
  - `condominio`/`iptu` ← procurar em `properties[]` (`condominium_fee`, `iptu`) quando existir.
- `chavesItemToProperty` já está no arquivo — seguir o mesmo padrão de função privada.
- `enrichWithPdp` continua funcionando porque OLX PDP tem outer `data.data` — manter o desempacotamento atual.

### 3. `study-runner.ts`

- `PORTAL_TARGETS` ganha `"olx.com.br": "OLX"`.
- `PORTAL_NAME_TO_TARGET` ganha `"OLX": "olx.com.br"`.
- Toggle paralelo ao Chaves:
  - `isOlxEnabled()` lendo `localStorage["portal.olx"]` (default OFF para não consumir crédito sem o usuário pedir).
  - `activeTargets()` inclui OLX quando o toggle estiver ON **ou** quando `input.portais` contiver `"OLX"`.
- No `adaptivePaginate`, por-portal params, novo branch:
  ```ts
  if (t === "olx.com.br") portalParams = {
    state: params.state,              // UF obrigatória
    city: params.city || undefined,
    businessType: params.businessType,
    keyword: params.keyword,          // OLX aceita keyword normalmente
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    categoryPath: mapTipoToOlxCategory(tipo, businessType),
    sort: "relevance",
  };
  ```
  - `mapTipoToOlxCategory` (helper local): `Apartamento+Venda → "imoveis/venda-de-apartamentos"`, `Apartamento+Aluguel → "imoveis/aluguel-de-apartamentos"`, `Casa+Venda → "imoveis/venda-de-casas"` etc. Cair fora (`"imoveis"`) quando o tipo não casar.
- Camadas:
  - **Layer 1 (mesmo edifício)** e **Layer 2 (mesmo endereço)**: OLX aceita keyword → participa.
  - **Layer 3 (bairro)**: OLX usa `city + state + categoryPath + keyword`. Não tem geolocalização nem `radius`; descartar `latitude/longitude/radius` no branch.
- Funil: `perPortal["olx.com.br"]` é populado normalmente; nada extra a fazer além do registro inicial.
- `exhaustedGlobal` continua valendo (OLX retorna `notFound: true` quando a busca não existe → marca exhausted, igual aos outros).

### 4. `app.configuracoes.tsx`

- Adicionar estado `olxOn` + `toggleOlx` espelhando `chavesOn/toggleChaves` (default `false`).
- No array de portais: substituir a linha atual `{ n: "OLX", on: false, locked: true, ... }` por `{ n: "OLX", on: true, locked: false, checked: olxOn, toggle: toggleOlx }`.
- Adicionar `"olx.com.br"` ao select de teste PDP (`testTarget`), com URL exemplo `https://pr.olx.com.br/regiao-de-maringa/imoveis/...`.

### 5. Tipos

- `study-types.ts`: nada a mudar (`portais: string[]` já é livre).

## Riscos / fora do escopo

- OLX **não tem** filtros nativos de quartos/área/coordenadas → o filtro continua sendo feito localmente (mais carga no parser, mas é como já funciona o Chaves nos campos não suportados).
- OLX devolve `nameHash` em vez de nome do vendedor — exibimos `"Profissional"`/`"Particular"`; sem telefone direto.
- Sem geocoding/raio na OLX: o relatório ainda mostra o raio, mas os comparáveis da OLX passam apenas pelo filtro local de bairro/cidade.

## Verificação

1. `bun run build` passa.
2. Em `/app/configuracoes`, ativar **OLX**, testar PLP com `state: "SP", city: "Sorocaba", keyword: "apartamento"` e PDP com uma URL real.
3. Rodar um estudo em Sorocaba e conferir no funil que aparece `OLX — recebidos/aproveitados/descartados > 0`.
