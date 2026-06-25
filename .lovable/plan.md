## Priorizar imóveis no mesmo condomínio/edifício

Quando o usuário preencher **Edifício/Condomínio** na etapa 1, o pipeline de busca passa a tratar imóveis do mesmo prédio como prioridade máxima, e só depois amplia para o restante do bairro/cidade.

### Comportamento

1. Se `input.edificio` (ou override equivalente) estiver preenchido:
   - **Camada 0 (nova, prioritária)**: busca PLP com `keyword = "<edifício> <bairro>"` e filtra resultados cujo `titulo + descricao + endereco` contenha o nome do edifício (match normalizado, ignorando acentos/caixa e palavras genéricas como "edifício", "residencial", "condomínio").
   - Se encontrar **≥ 3** comparáveis no mesmo prédio → usa **apenas** esses; o relatório destaca "Comparáveis no mesmo condomínio".
   - Se encontrar **1–2** → mantém esses como "âncora" e completa com as camadas atuais (bairro → cidade → faixa ampla) até ≥ 4 no total, marcando cada comparável com flag `mesmoCondominio: boolean`.
   - Se encontrar **0** → cai direto no fluxo atual (estrito → ampliações).
2. Sem `edificio` preenchido: comportamento idêntico ao de hoje.

### UI

- Editor de critérios (`criterios-editor.tsx`): novo campo **Edifício/Condomínio** com toggle "Priorizar mesmo prédio" (default ON quando há valor).
- Relatório (`app.relatorio.$id.tsx`):
  - Funil de busca ganha etapa extra "Mesmo condomínio: N".
  - Tabela de comparáveis ganha badge "Mesmo prédio" nos itens com `mesmoCondominio = true`.
  - Diagnóstico menciona quantos comparáveis vieram do próprio edifício.

### Implementação técnica

1. `src/lib/study-types.ts`:
   - `SearchOverrides`: adicionar `edificio?: string` e `priorizarEdificio?: boolean`.
   - `ComparableProperty`: adicionar `mesmoCondominio?: boolean`.
2. `src/lib/study-runner.ts`:
   - Ler `edificio` efetivo (override > input).
   - Função `matchEdificio(p, nome)`: normaliza ambos, remove stopwords (`edificio|edifício|residencial|condominio|condomínio|cond|ed`), exige que todos os tokens significativos do nome apareçam em `titulo+descricao+endereco`.
   - Quando `priorizarEdificio && edificio`:
     - Roda PLP extra com keyword do edifício (em paralelo à PLP principal, ou sequencial se mais simples).
     - Faz o ranqueamento descrito acima, marca `mesmoCondominio` nos selecionados.
     - Acrescenta `{ etapa: "Mesmo condomínio", total: n }` em `funilBusca`.
   - `criteriosAplicados` ganha linha `Edifício: <nome> (prioridade)` quando aplicável.
3. `src/lib/study-engine.ts`:
   - Ao calcular `comparaveis`, preservar a flag `mesmoCondominio` vinda do runner; opcionalmente dar peso extra de similaridade aos do mesmo prédio (mantém ordenação por similaridade — quem é do mesmo prédio sobe naturalmente).
4. `src/components/criterios-editor.tsx`:
   - Novo input `edificio` + `Switch` "Priorizar mesmo prédio".
   - Defaults a partir de `study.input.edificio` / `overridesAplicados`.
5. `src/routes/app.relatorio.$id.tsx`:
   - Badge "Mesmo prédio" na tabela.
   - Frase no diagnóstico: "X de Y comparáveis estão no mesmo condomínio."

### Fora do escopo

- Geocodificação por endereço/CEP para identificar prédio sem nome digitado.
- Busca cruzada em outros portais (mantém só Zap).
