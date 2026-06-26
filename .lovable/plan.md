## Estudo do doc PLP Chaves na Mão

O doc confirma campos e comportamentos que ainda não estamos aproveitando bem. Implementar 5 melhorias focadas em **precisão dos filtros**, **transparência no funil** e **economia de créditos** — sem mudar UI.

### 1. `includeLaunches: false` por padrão (Chaves)
Doc: "default do worker é false" — mas como temos um campo `condominium`/`directOwner` opcional, vamos enviar explicitamente `includeLaunches: false` para garantir que lançamentos não entrem nos comparáveis (preço/área de lançamento distorcem mediana). Em `study-runner.ts`, na camada bairro do bloco Chaves, adicionar `includeLaunches: false`.

### 2. Aproveitar contadores de filtro do response
Doc expõe `launchesFilteredOut` e `coordinateFilteredOut` por página. Somar esses valores por portal e exibir no funil:
- "Chaves na Mão: lançamentos removidos (N)"
- "Chaves na Mão: fora do raio 2 km (N)"

Isso já existe parcialmente para Zap via cálculo local Haversine; para Chaves é o worker quem filtra, então só precisamos ler e mostrar.

### 3. Exhaustion mais preciso usando `totalPages`
Hoje paramos quando `nextPage == null` ou `items.length === 0`. Doc garante `totalPages` (ex.: 2206). Quando `page >= totalPages`, marcar `exhaustedGlobal` mesmo se a API não setar `nextPage`. Reduz 1 chamada extra em buscas curtas.

### 4. `directOwner` / `condominium` editáveis (opcional, sem UI nova)
Hoje os campos existem no Zod mas nada no runner os usa. Sem mudar UI: adicionar passagem em `CriteriosEditor` futuramente. **Por agora, só documentar como TODO no código** — não vamos criar UI sem o usuário pedir.

### 5. Filtro local de status na Chaves
Doc mostra `status: "ACTIVE"`, `active: true`, `isLaunch: false` por item. Adicionar em `gecko-adapter.ts` (`chavesItemToProperty`): descartar item se `active === false`, `status === "INACTIVE"`, ou `isLaunch === true` (reforço local ao filtro `includeLaunches`).

### Onde mexer (resumo técnico)

```text
src/lib/study-runner.ts
  - bloco Chaves (linha ~199): add includeLaunches: false
  - adaptivePaginate: ler rawData.launchesFilteredOut e
    rawData.coordinateFilteredOut → somar por portal
  - exhaustion: marcar exhausted quando page >= rawData.totalPages
  - funilBusca: 2 novas linhas por portal Chaves

src/lib/gecko-adapter.ts
  - chavesItemToProperty: skip se active===false || isLaunch===true
    || status==="INACTIVE"
```

Sem mudanças em `gecko.functions.ts` (Zod já aceita os campos).

### Fora de escopo (mencionados no doc, não implementar agora)
- PLP por URL pública — exigiria nova UI para colar link do Chaves.
- `amenities`/`bathrooms`/`parkingSpots` nativos — precisaria novos campos no `StudyInput`.
- Filtros `directOwner`/`condominium` editáveis no `CriteriosEditor` — UI nova, pedir confirmação antes.

Após implementação rodo typecheck. Resultado esperado: funil mais explicativo no portal Chaves e menos comparáveis "lançamento" distorcendo a mediana.