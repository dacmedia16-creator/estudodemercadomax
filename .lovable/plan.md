## Diagnóstico

Estudando o doc do **Zapimoveis PDP** descobri **3 problemas** no nosso pipeline + várias oportunidades de enriquecimento que estamos jogando fora:

1. **Bug silencioso de enriquecimento PDP.** Em `study-runner.ts` (linhas 354-358), o código lê `d.condominium` e `d.iptu`, mas o payload real do PDP entrega esses valores em `data.data.prices.monthlyCondoFee` e `data.data.prices.iptu`. Resultado: nenhum comparável recebe valor de condomínio/IPTU hoje.
2. **`notFound: true` tratado como sucesso vazio.** O Gecko retorna HTTP 200 + `notFound: true` quando o anúncio sumiu. Hoje o adapter trata como dados ausentes e descarta — perdendo o sinal de que o anúncio expirou.
3. **Erros de crédito/rate-limit (`402`, `429`) não têm mensagem clara.** A mensagem genérica esconde a causa real.

Além disso, o PDP entrega campos ricos (geolocalização, anunciante completo, datas, comodidades destacadas, tipo de publicação) que hoje são descartados.

## O que vai melhorar

**Correção do bug PDP** — comparáveis passam a mostrar condomínio e IPTU reais.

**Novos dados em cada comparável** extraídos do PDP:
- **Anunciante:** nome, CRECI, telefone, WhatsApp, rating
- **Geolocalização:** latitude/longitude (preparada pra mapa futuro)
- **Dias no mercado (DOM):** calculado a partir de `createdAt`
- **Custo total mensal:** preço/m² + condomínio + IPTU somados
- **Comodidades destacadas** (`mainAmenities`) e tags (`infoTags`, ex.: "Aceita financiamento")
- **Publicação PREMIUM/STANDARD** (sinal de qualidade do anúncio)

**Tratamento robusto:**
- `notFound: true` → marca comparável como "Anúncio removido" em vez de ignorar
- `402 INSUFFICIENT_CREDITS` → banner claro no relatório: "Sem créditos GeckoAPI"
- `429 RATE_LIMIT` → já tem retry, vai ganhar mensagem específica

**Relatório:**
- Tabela de comparáveis ganha colunas opcionais: **Condomínio**, **IPTU**, **DOM** (dias no mercado), **Anunciante**
- Card resumo mostra **anunciante com mais comparáveis** (insight competitivo)

## Detalhes técnicos

### 1. `src/lib/gecko-types.ts`
Estender `GeckoItem` (ou criar `GeckoPdpData`) com `prices.monthlyCondoFee`, `prices.iptu`, `address.latitude/longitude`, `advertiser.{mainPhone, whatsAppNumber, creci, rating}`, `createdAt`, `updatedAt`, `mainAmenities`, `infoTags`, `publicationType`, `virtualTourUrl`.

### 2. `src/lib/mock-properties.ts` — `MockProperty`
Adicionar campos opcionais:
```ts
latitude?: number;
longitude?: number;
diasMercado?: number;
publicationType?: string;
mainAmenities?: string[];
infoTags?: string[];
advertiserPhone?: string;
advertiserWhatsapp?: string;
advertiserCreci?: string;
advertiserRating?: number;
removido?: boolean;        // notFound do PDP
```

### 3. `src/lib/gecko-adapter.ts`
- Mapear `prices.monthlyCondoFee` → `condominio` e `prices.iptu` → `iptu` (PLP às vezes já traz).
- Mapear `address.latitude/longitude`.
- Mapear `createdAt` → calcular `diasMercado = floor((now - createdAt)/86400000)`.
- Mapear `advertiser.{mainPhone, whatsAppNumber, creci, rating.score}`.
- Mapear `mainAmenities`, `infoTags`, `publicationType`, `virtualTourUrl`.

### 4. `src/lib/study-runner.ts`
- **Corrigir leitura do PDP:** trocar `d.condominium / d.iptu / d.amenities` por leitura de `d.data.data.prices.monthlyCondoFee`, `d.data.data.prices.iptu`, `d.data.data.mainAmenities` etc. — passar pelo mesmo `geckoItemToProperty` para reuso.
- Quando `pdp.notFound === true`, marcar `p.removido = true` e adicionar contador no funil.
- Mensagens de erro específicas para `402` e `429` no `catch` final.

### 5. `src/lib/gecko.functions.ts`
Já propaga `notFound` corretamente — sem mudança estrutural, só garantir tipos atualizados.

### 6. `src/routes/app.relatorio.$id.tsx`
- Tabela de comparáveis: adicionar colunas **Cond.**, **IPTU**, **DOM**, **Anunciante** (badge com WhatsApp clicável se existir).
- Badge "Anúncio removido" em itens com `removido: true`.
- Pequeno card "Top anunciantes da região" (agrupa comparáveis por `anunciante`).

### 7. Sem mudanças
- Schema do `gecko.functions.ts` request: o PDP só precisa de `url` + `target` + `type: "pdp"` (já fazemos).
- Lógica das 3 camadas de busca (edifício → endereço → bairro): segue igual.
- Custo de créditos: igual (mesmo número de chamadas PDP).

## Fora de escopo
- Mapa interativo (latitude/longitude ficam preparados, mas integração com Leaflet/Mapbox fica pra outro plano).
- Workflow assíncrono de imobiliárias (`/v1/workflows/runs`) — já discutido, sem implementação.
