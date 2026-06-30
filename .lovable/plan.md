## Objetivo

Quando o toggle **"Buscar também em bairros próximos"** estiver ligado e o usuário **não digitar nenhum bairro**, o sistema descobre sozinho os bairros vizinhos e usa na camada extra de busca. Se o usuário digitar bairros manualmente, esses prevalecem (comportamento atual mantido).

## Como vai funcionar

1. No Passo 1 do formulário, o toggle continua igual. O campo de chips ganha um texto auxiliar: *"Deixe em branco para detectarmos os bairros vizinhos automaticamente"*.
2. No `study-runner.ts`, ao entrar na Layer 3.5 (bairros próximos):
   - Se `bairrosProximos.length > 0` → usa a lista do usuário (hoje).
   - Se vazio → chama um novo helper `descobrirBairrosVizinhos(cidade, bairro, lat, lng)` e usa o resultado.
3. Os bairros descobertos aparecem no funil como `Bairro próximo (auto): <nome>: N` para ficar transparente o que foi usado.
4. No `CriteriosEditor` (pós-estudo), mesma regra: se o campo estiver vazio e o toggle ligado, descobre na hora de reexecutar; os nomes detectados são mostrados como chips "sugeridos" (removíveis) para o usuário poder ajustar antes de rodar de novo.

## Como descobrir os vizinhos (sem custo de GeckoAPI)

Estratégia em cascata, parando no primeiro que retornar ≥ 3 bairros:

1. **Nominatim reverse + nearby search** (já usamos Nominatim no geocode). A partir do `lat,lng` do imóvel, consultamos `search.php?q=<cidade>&featuretype=suburb` num bounding box de ~3 km e coletamos `suburb`/`neighbourhood` distintos do bairro alvo. Cache em memória por `cidade|bairro` por 24 h.
2. **Overpass API** (fallback gratuito) com query `node[place=suburb](around:3000,lat,lng)` quando o passo 1 trouxer menos de 3.
3. **Fallback final**: nenhum vizinho detectado → log no funil "Vizinhos: não detectados" e a Layer 3.5 é pulada (sem quebrar o estudo).

Limite duro: no máximo **5 bairros vizinhos** usados por estudo, ordenados por distância ao imóvel, para não estourar chamadas de PLP.

## Arquivos a tocar

- `src/lib/neighbors.functions.ts` *(novo)* — `descobrirBairrosVizinhos` como `createServerFn` (chamadas Nominatim/Overpass ficam no servidor, com retry e cache em memória do worker).
- `src/lib/study-runner.ts` — na Layer 3.5, se lista vazia + toggle ligado, chama o server fn antes do loop e usa os nomes retornados; rotula no funil como `(auto)`.
- `src/lib/study-types.ts` — adicionar campo opcional `bairrosProximosAuto?: string[]` no resultado do estudo, para o editor e o PDF mostrarem o que foi usado.
- `src/routes/app.novo-estudo.tsx` — texto auxiliar no campo de chips quando toggle ligado e lista vazia.
- `src/components/criterios-editor.tsx` — botão "Detectar vizinhos automaticamente" + exibição dos chips sugeridos antes do recálculo.

## Pontos de decisão

- **Raio de detecção fixo em 3 km** (independente do raio de busca do estudo). Mantém vizinhos realmente colados, evita puxar bairros distantes só porque o raio de busca é 5 km. Posso amarrar ao raio do estudo se preferir.
- **Cache**: em memória do worker (volátil). Sem nova tabela. Se quiser persistente, dá pra adicionar `neighbor_cache` depois.
- **Sem mudança no PDF** nesta entrega — só o funil mostra os bairros auto. Posso incluir uma linha "Bairros vizinhos considerados" na capa se quiser.

Confirma e eu implemento.