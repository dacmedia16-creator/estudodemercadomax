## Diagnóstico — o que está e o que NÃO está funcionando

Li `src/lib/study-runner.ts`, `src/lib/gecko.functions.ts` e `src/lib/gecko-adapter.ts`. O fluxo cobre o básico (params por portal, paginação adaptativa, parsing tolerante), mas tem **5 problemas reais** que afetam Chaves na Mão. Listo na ordem de impacto.

### Bug 1 — PDP do Chaves é chamado como se fosse Zap (crítico)
Em `study-runner.ts` linha 485:
```ts
const pdp = await geckoPdp({ data: { url: p.url } });
```
`geckoPdp` tem `target` default = `"zapimoveis.com.br"`. Ou seja: todo comparável vindo do Chaves enriquece via PDP do Zap → a chamada falha silenciosamente ou volta `notFound`, e o imóvel pode ser marcado `removido = true` indevidamente, sumindo do relatório. Também queima 1 crédito por imóvel sem retorno útil.

**Correção:** detectar o portal pelo `p.portal` (ou pelo host da URL) e passar `target: "chavesnamao.com.br"` quando aplicável.

### Bug 2 — Set `exhausted` não persiste entre camadas
`exhausted` é recriado dentro de cada chamada de `adaptivePaginate`. Se o Chaves esgotou (notFound ou sem `nextPage`) na camada "mesmo condomínio", a camada "mesmo endereço" e depois "bairro" voltam a consultá-lo. Em uma cidade que o Chaves não reconhece, isso desperdiça até **6 chamadas extras** por estudo (3 camadas × 2 retries) e ainda polui o funil com `plpNotFound` repetido.

**Correção:** mover `exhausted` para o escopo do `runStudy` (fora de `adaptivePaginate`), passar como parâmetro, e mostrar no funil "Chaves na Mão: portal esgotado/não reconhece a cidade" apenas uma vez.

### Bug 3 — `totalResults` mistura Zap + Chaves
Linha 196: `totalResultsUpstream = Math.max(...)`. Se Zap retorna 5.000 e Chaves retorna 30, o funil mostra 5.000 e atribui ao "portal" no singular. Engana a leitura.

**Correção:** acumular `totalResults` por portal (`totalResultsPerTarget[t]`) e renderizar uma linha por portal no funil.

### Bug 4 — Stats per-portal não distinguem camada
`perPortal[t].recebidos` soma condo + endereço + bairro. Se o Chaves só retorna na camada bairro, parece que respondeu em todas. Difícil debugar onde o portal funciona.

**Correção:** trocar contadores únicos por `{layer, recebidos, aproveitados}` e logar/funilar por camada quando houver dados.

### Bug 5 — Chaves recebe `state: ""` sempre
A doc do Chaves na Mão (URLs `/imoveis/SP/sao-paulo/...`) sugere que o portal **precisa** de UF. O override atual zera o state porque "Chaves quebra com UF code" — mas o sintoma original pode ter sido outro (ex.: priceMin/Max). Sem state, a chance de notFound aumenta em cidades comuns a múltiplos estados (São José, Boa Vista, etc.).

**Correção:** manter `state` (UF, 2 letras) na chamada do Chaves; remover só os filtros que comprovadamente quebram (bedrooms/price/area/lat/lng/radius, que já estavam fora). Adicionar um teste rápido em Settings → "Testar Chaves" com e sem UF pra confirmar.

### O que JÁ está correto (não mexer)
- Parsing tolerante em `gecko-adapter.ts` (price/area/quartos em formatos BR e EN).
- `bedrooms/price/area/lat/lng` strippados do body do Chaves no server.
- `propertyType` enviado só para Zap.
- Paginação adaptativa pára quando atinge TARGET=8 ou portal exhausted.

---

## Plano de implementação

Tudo em **`src/lib/study-runner.ts`** (1 arquivo). Sem mudanças em UI, sem mudanças no engine de relatório.

1. **Fix PDP target por portal**
   - Mapa `PORTAL_TO_TARGET = { "Zap Imóveis": "zapimoveis.com.br", "Chaves na Mão": "chavesnamao.com.br" }`.
   - Na chamada PDP (linha ~485): `geckoPdp({ data: { url: p.url, target: PORTAL_TO_TARGET[p.portal] ?? "zapimoveis.com.br" } })`.

2. **`exhausted` persistente entre camadas**
   - Declarar `const exhausted = new Set<PortalTarget>()` no topo do `runStudy`.
   - `adaptivePaginate` recebe-o por referência; passa a respeitar e a popular esse Set.
   - Adicionar uma única linha no funil: `${PORTAL_TARGETS[t]}: portal esgotado` quando exhausted após a corrida.

3. **`totalResults` e `plpNotFound` por portal**
   - `totalResultsPerTarget: Record<PortalTarget, number>`.
   - No funil: uma linha por portal com `Total disponível em ${nome}: ${n}`.
   - `plpNotFoundPerTarget` já existe — só checar que cada portal aparece no funil apenas se relevante.

4. **Stats per-portal por camada (debug)**
   - Trocar `perPortal[t] = { recebidos, aproveitados, descartados }` por `perPortal[t][layer]`.
   - No funil final, agregar e mostrar: `Chaves na Mão (condomínio: 0, endereço: 0, bairro: 12) → 5 aproveitados`.

5. **Reativar `state` para o Chaves**
   - No override per-portal de `adaptivePaginate`, manter `state: params.state` (UF) também para Chaves.
   - Manter strip apenas de `propertyType`/`bedrooms`/`price`/`area`/`lat`/`lng`/`radius` (que já estão fora pelo build do body em Chaves).

### Validação após implementar
- `tsgo` (typecheck).
- Rodar um estudo em uma cidade que o Chaves cobre (ex.: Sorocaba/SP) e conferir no funil que aparece "Chaves na Mão" com `recebidos > 0` e que comparáveis Chaves chegam ao relatório com `condominio`/`diasMercado` preenchidos (sinal de PDP correto).
- Rodar em cidade obscura e confirmar que `Chaves: portal esgotado` aparece **uma vez só** (não 3).
- Conferir contagem total de requisições no rodapé do funil — deve cair em ~30% para cidades onde o Chaves dá notFound.

### Fora do escopo (proponho para depois)
- Geocoding também para Chaves (atualmente sem efeito pois Chaves não tem lat/lng nos itens — passaria pelo filtro Haversine sem ser cortado).
- Dicionário de tradução de `propertyType` para o vocabulário do Chaves (`apartamento`/`casa` em pt) caso a doc confirme suporte.
