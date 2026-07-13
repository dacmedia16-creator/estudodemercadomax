# Adicionar Viva Real ao motor de busca

Viva Real usa o mesmo endpoint `POST /v1/extract` da GeckoAPI, com `target: "vivareal.com.br"` e vocabulário quase idêntico ao Zap Imóveis (mesmo grupo). Diferenças notáveis:

- Item shape usa `attributes.usableAreas[]`, `attributes.bedrooms[]`, `attributes.bathrooms[]`, `attributes.parkingSpaces[]`, `attributes.suites[]`, `attributes.unitFloor` e `prices[].value / condominium / iptu` (array em vez de objeto único).
- Aceita `neighborhood`, `propertyTypes[]`, `amenities[]`, `bedrooms[]`, `bathrooms[]`, `parkingSpots[]`, `priceMin/Max`, `areaMin/Max`, `latitude/longitude`, `sort`, `directOwner`, `condominium`, `includeLaunches` — igual ao Zap/Chaves.
- **Não aceita `keyword`** (como Chaves). URL pública é opcional.

## Mudanças

### 1. `src/lib/gecko.functions.ts`
- Adicionar `"vivareal.com.br"` no array `TARGETS`.
- Expandir `portalKey()` retornando `"viva"` para vivareal.
- No handler `geckoPlp`: tratar Viva Real no mesmo bloco do Zap (aceita quase todos os filtros nativos), mas **sem `keyword`** — só envia keyword quando target é Zap. Enviar `neighborhood`, `propertyTypes`, `amenities`, `directOwner`, `condominium`, `includeLaunches`, `sort` quando target for viva ou chaves.

### 2. `src/lib/gecko-adapter.ts`
- `detectPortalFromUrl`: adicionar caso `vivareal.com.br` → `"Viva Real"`.
- Novo parser `vivaRealItemToProperty(item, portal)` que lê `attributes.*` (arrays) e `prices[0].value/condominium/iptu`. Reaproveita helpers existentes (`firstNumber`, `parsePrice`, imagens).
- `geckoItemToProperty`: detectar shape Viva Real (presença de `attributes` + `prices` como array) e delegar ao novo parser, análogo ao que já é feito com Chaves.

### 3. `src/lib/study-runner.ts`
- `PORTAL_TARGETS`: adicionar `"vivareal.com.br": "Viva Real"`.
- `PORTAL_NAME_TO_TARGET`: adicionar `"Viva Real": "vivareal.com.br"`.
- Toggle localStorage `portal.vivareal` (default ligado). Incluir em `list` como o Chaves/OLX.
- Camadas de âncora (mesmo prédio / endereço / bairro): Viva Real entra no mesmo caminho estrutural do Zap (usando `neighborhood` + `propertyTypes` em vez de `keyword`, já que Viva não aceita keyword). O `keywordOnlyLayer` deve pular Viva assim como já pula Chaves.
- Retry afrouxado: incluir Viva Real na lista `retryTargets` junto com Zap e Chaves.

### 4. `src/routes/app.configuracoes.tsx`
- Adicionar `"vivareal.com.br"` no union type de `testTarget`.
- Adicionar `<option value="vivareal.com.br">Viva Real</option>` no seletor de teste PDP e uma URL de exemplo.
- Estado `vivaOn` com localStorage `portal.vivareal`, toggle e linha na lista "Portais ativos".

### 5. `src/routes/app.novo-estudo.tsx`
- Ler `portal.vivareal` do localStorage e incluir "Viva Real" na lista de portais selecionáveis do wizard (passo 4).

### 6. `src/components/busca-rapida.tsx` (verificar)
- Se listar portais explicitamente, incluir Viva Real.

## Fora de escopo
- Endpoint PDP (`geckoPdp`) já é agnóstico ao portal — funciona sem alteração.
- Retry específico do OLX / avisos de portal indisponível — outro tópico.

## Validação
- Rodar um estudo em SP/Vila Mariana com todos os portais ligados e conferir o funil.
- Testar PDP Viva Real em Configurações → Diagnóstico com URL pública.