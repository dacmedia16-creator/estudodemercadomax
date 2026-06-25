## Problema

Os comparáveis vindos da GeckoAPI estão "passando" no estudo mesmo quando não batem com o imóvel informado. Três causas:

1. **Adapter mascara dados ausentes** — quando o regex não acha quartos/área na descrição, o `gecko-adapter` preenche com os valores do próprio usuário (`fallbackQuartos`, `fallbackAreaUtil`). Resultado: qualquer imóvel "vira" compatível.
2. **Sem filtro pós-busca** — a Gecko devolve a PLP do Zap, que costuma ignorar parte dos filtros (especialmente bairro e tipo). O código aceita tudo o que voltou sem revalidar.
3. **Keyword fraca / sem `propertyType`** — hoje mandamos `"<tipo> <quartos> quartos"` como `keyword`, mas não enviamos bairro nem o `propertyType` (apartment/house), que é o que o Zap realmente respeita.

## Plano

### 1. `src/lib/gecko-adapter.ts` — não inventar dados
- Ler primeiro campos estruturados do item Gecko (`bedrooms`, `bathrooms`, `parkingSpaces`, `usableAreas`, `propertyType`, `address.*`); cair no regex da descrição só como segundo recurso.
- Se quartos ou área continuarem desconhecidos → retornar `null` (descarta o imóvel) em vez de copiar o input do usuário.
- Expor `propertyType` normalizado ("Apartamento" / "Casa" / etc.) em um novo campo opcional no `MockProperty` (ou guardar no título) para o filtro usar.

### 2. `src/routes/app.carregando.tsx` — busca + filtragem em camadas
- Montar `keyword` com **bairro + tipo** (ex.: `"apartamento Batel"`) em vez de "X quartos".
- Enviar `propertyType` para a Gecko quando o tipo do form for mapeável (Apartamento → `apartment`, Casa → `house`, etc.).
- Depois de receber a PLP, aplicar **filtro estrito** antes de passar para o estudo:
  - tipo do imóvel == tipo informado (quando o item tiver tipo);
  - `quartos == input.quartos`;
  - `areaUtil` dentro de ±30% do informado;
  - `preco` dentro de ±40% do informado;
  - `bairro` em `[bairro, ...bairrosProximos]` (case-insensitive) **ou** mesma cidade se nenhum bairro vier preenchido.
- **Fallback escalonado** se sobrarem menos de 4 comparáveis:
  1. relaxa quartos para ±1;
  2. relaxa bairro para a cidade inteira;
  3. relaxa área/preço para ±50%.
  Cada nível registra um aviso ("Filtro ampliado para…") exibido no banner amarelo da tela de carregamento e prefixado no `diagnostico` do estudo.
- Se ainda assim sobrar 0 → cair em dados de demonstração (comportamento atual), mas com mensagem clara: "Nenhum imóvel compatível encontrado para os critérios informados."

### 3. `src/lib/study-engine.ts` — confiar no filtro externo
- Quando `properties` vier do Gecko, **não** misturar com mock; apenas calcular comparáveis sobre o que chegou já filtrado.
- Adicionar ao `StudyResult` um campo `criteriosAplicados: string[]` (ex.: `["Bairro: Batel", "Quartos: 3", "Área: 80–120 m²"]`) para o relatório mostrar transparência.

### 4. Relatório (`src/routes/app.relatorio.$id.tsx`)
- Mostrar um pequeno bloco "Critérios da busca" acima da tabela de comparáveis com os filtros aplicados e quantos imóveis sobraram em cada etapa do funil (ex.: "42 retornados → 11 após filtro estrito → 11 analisados").

### Detalhe técnico

- Mapa `tipoUI → propertyType` em um helper novo dentro de `gecko-adapter.ts`.
- Normalização de bairro: `.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().trim()` para comparar com o que a Gecko devolve.
- Os PDPs continuam só para enriquecer condomínio/IPTU/amenities dos top 6 — sem mudar.

Sem alteração no schema do `StudyInput`, no fluxo de Configurações nem na lógica de fallback do token.