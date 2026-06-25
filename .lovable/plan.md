## Objetivo
Substituir a geração de estudo baseada em 12 imóveis mockados por uma integração real com a **GeckoAPI** (`POST https://api.geckoapi.com.br/v1/extract`) para os modos **PLP** (lista por cidade/UF) e **PDP** (detalhe por URL) do `zapimoveis.com.br`, mantendo o mock como fallback de desenvolvimento.

## Arquitetura

```text
Browser (form / botão "Testar API")
   │
   ▼
createServerFn  src/lib/gecko.functions.ts
   ├─ geckoPlp({ city, state, businessType, keyword?, bedrooms?, priceMin?, priceMax?, areaMin?, areaMax?, latitude?, longitude?, page })
   ├─ geckoPdp({ url })
   └─ geckoTest({ url })   ← usado pelo botão "Testar API"
        │  lê process.env.GECKOAPI_TOKEN  (segredo)
        │  ou token override vindo do front (apenas no fluxo "Testar API")
        ▼
   POST https://api.geckoapi.com.br/v1/extract
        Authorization: Bearer <token>
```

Por que server function: o token é privado, o navegador não pode chamar a GeckoAPI diretamente (CORS + segredo). `createServerFn` resolve as duas coisas e dá tipagem.

## Segredo
- Novo secret `GECKOAPI_TOKEN` (solicitado via `add_secret` quando entrarmos em build mode). Sem ele, todos os fluxos caem para o mock.

## Mudanças por arquivo

**Novos**
- `src/lib/gecko-types.ts` — tipos `GeckoPlpResponse`, `GeckoPdpResponse`, `GeckoItem` espelhando o schema da doc (`data.items[].{id,url,description,address,prices,amenities,advertiser,images,…}`).
- `src/lib/gecko.functions.ts` — três `createServerFn` (`geckoPlp`, `geckoPdp`, `geckoTest`). Validam input com zod, leem token de `process.env.GECKOAPI_TOKEN` dentro do `.handler`, fazem `fetch` e devolvem DTO simples. Tratam `notFound: true`, `401`, `402`, `429` e erros de upstream com mensagens claras.
- `src/lib/gecko-adapter.ts` — converte um `GeckoItem` (PLP) em `MockProperty` (formato já usado por `study-engine.ts`), extraindo `quartos/banheiros/vagas/areaUtil` a partir da `description` + `amenities` quando possível (regex simples: `\d+\s*quartos?`, `\d+\s*m²`, etc.). Item sem área cai para média do bairro.

**Editados**
- `src/routes/app.configuracoes.tsx` — seção “Integração com GeckoAPI” virando “Configurações Técnicas”:
  - Status do token (`Configurado` / `Não configurado`) lido por uma server fn `geckoStatus()` (sem expor o valor).
  - Campos: Endpoint (somente leitura), Portal ativo (Zap Imóveis), Tipo de extração padrão (PLP/PDP).
  - Bloco **Testar API**: input para URL pública do Zap → botão “Testar conexão” → chama `geckoTest({ url })` (PDP) → mostra status, créditos consumidos (se a API expor) e amostra de campos retornados (`description`, `prices.mainValue`).
  - Botão “Atualizar token” → orienta o usuário (no build, abrirá `update_secret`).
- `src/routes/app.novo-estudo.tsx` — no `handleSubmit`, em vez de gerar com mock, dispara fluxo real:
  1. salva `input` em `sessionStorage`;
  2. navega para `/app/carregando`;
  3. a tela de carregamento orquestra as chamadas.
- `src/routes/app.carregando.tsx` — vira o orquestrador real, com 4 estágios visíveis:
  1. “Conectando à GeckoAPI”
  2. “Buscando imóveis similares no Zap Imóveis” → `geckoPlp` com `city`, `state`, `businessType` (`finalidade → sale|rent`), `bedrooms: [quartos]`, faixa de preço ±30% do `valorPretendido`, `areaMin/areaMax` ±25% da `areaUtil`, página 1 (e 2 se vier `nextPage`).
  3. “Analisando imóveis encontrados” → para os top N por similaridade (até 6), chama `geckoPdp({ url })` em paralelo para enriquecer.
  4. “Gerando estudo de mercado” → roda `generateStudy` com os comparáveis convertidos pelo adapter; salva via `studyStore` e navega para `/app/relatorio/$id`.
  - Se `GECKOAPI_TOKEN` não estiver configurado **ou** qualquer etapa falhar, exibe aviso amarelo “Usando dados de demonstração” e cai no fluxo mock atual.
- `src/lib/study-engine.ts` — pequena adaptação: aceita uma lista de `MockProperty` injetada (assinatura nova `generateStudy(input, properties?)`) em vez de sempre ler do array mock. Sem mudanças no cálculo.

## Mapeamento de campos (form → GeckoAPI PLP)
| Form | GeckoAPI |
|---|---|
| `finalidade` Venda/Aluguel | `businessType` `sale` / `rent` |
| `cidade` | `city` |
| `estado` | `state` (UF 2 letras) |
| `tipo` + `quartos` | `keyword` opcional, ex. `"apartamento 3 quartos"` |
| `quartos` | `bedrooms: [n]` |
| `vagas` | `parkingSpots: [n]` |
| `valorPretendido` | `priceMin/Max` = valor ±30% |
| `areaUtil` | `areaMin/Max` = área ±25% |
| paginação | `page: 1` (segunda chamada se `nextPage`) |

## Erros e fallback
- 401 → toast “Token GeckoAPI inválido — verifique em Configurações”.
- 402 → toast “Sem créditos GeckoAPI”.
- 429 → retry simples (1x) com backoff de 1.5s.
- Qualquer 5xx ou `notFound:true` sem itens → fallback mock + aviso visível no relatório (`origem: "Demonstração"`).

## Fora de escopo
- Outros portais (Viva Real, OLX etc.) seguem desabilitados.
- Persistência do token por usuário (continua único via secret do projeto).
- Cache de respostas da GeckoAPI.
