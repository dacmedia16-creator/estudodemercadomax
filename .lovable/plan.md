## Diagnóstico

A integração já dispara as duas chamadas PLP em paralelo (Zap + Chaves na Mão), mas o adapter `geckoItemToProperty` é 100% modelado no schema do **Zap Imóveis**:

- exige `item.prices.mainValue` para não devolver `null`
- lê `item.usableAreas`, `item.address.neighborhood`, `item.images[0].url` no formato Zap

A GeckoAPI devolve cada portal num shape próprio. Resultado: os itens da Chaves na Mão chegam, o adapter retorna `null` em todos eles e o runner descarta silenciosamente. Daí parece que "não entrou na busca".

Também há um risco secundário: o enum de `propertyType` (`APARTMENT`, `HOME`, …) é o vocabulário do Zap e pode estar filtrando demais no lado da Gecko para chavesnamao.

## Plano

1. **Visibilidade primeiro (sem mexer no normalizador ainda)**
   - Adicionar no `study-runner` contadores por portal: itens recebidos, itens normalizados, itens descartados — e empurrar no `funilBusca`.
   - Logar no `console.debug` o `keys(item)` do primeiro item de cada portal na primeira página, pra confirmar o shape real.
   - Mostrar no relatório (bloco "Critérios da busca") os portais consultados e o que cada um devolveu/aproveitou.

2. **Adapter portal-aware (`gecko-adapter.ts`)**
   - Receber `portal` e ler caminhos alternativos comuns do Chaves na Mão (com fallbacks):
     - preço: `item.prices?.mainValue ?? item.price ?? item.priceValue ?? parse(desc)`
     - área: `item.usableAreas ?? item.area ?? item.privateArea`
     - bairro/cidade/estado: `item.address?.neighborhood ?? item.neighborhood`, idem cidade/estado
     - imagem: `item.images?.[0]?.url ?? item.image ?? item.thumbnail`
     - url/id: garantir fallback robusto
   - Continuar marcando `incomplete: true` quando faltar área/quartos (já é o comportamento atual), em vez de descartar.

3. **Painel de teste em Configurações ganha modo PLP**
   - Hoje o painel só faz PDP. Adicionar um botão "Testar PLP" que dispara `geckoPlp` com `target` selecionado, `city/keyword` simples, e mostra o JSON cru — pra eu validar o shape real do Chaves na Mão sem precisar rodar um estudo inteiro.

4. **propertyType só quando aplicável**
   - Quando `target === "chavesnamao.com.br"`, omitir `propertyType` no payload PLP (mantém só `keyword`/`bedrooms`/preço). Evita filtro server-side com vocabulário Zap.

5. **Validação**
   - Rodar um estudo com Chaves na Mão ligado, abrir a aba Network e o relatório:
     - confirmar 2 POSTs `/v1/extract` por página (um por target)
     - confirmar no funil que o Chaves na Mão aparece com >0 itens aproveitados
   - Ajustar paths do adapter se algum item ainda voltar `null` (com base no log do passo 1/3).

## Arquivos afetados

- `src/lib/gecko-adapter.ts` — leitura tolerante a múltiplos shapes
- `src/lib/study-runner.ts` — contadores por portal + entradas no funil
- `src/lib/gecko.functions.ts` — não passar `propertyType` para chavesnamao
- `src/routes/app.configuracoes.tsx` — botão "Testar PLP" no painel de diagnóstico
- `src/routes/app.relatorio.$id.tsx` — exibir portais consultados/aproveitados no bloco de critérios (se já não exibir)

Sem alteração de regras de negócio do relatório nem do engine.
