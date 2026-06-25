## Painel de ajuste de critérios + regeneração do relatório

Adicionar, no topo do relatório, um painel "Critérios da busca" editável que permite reexecutar a análise com novos filtros sem refazer o formulário inteiro.

### Comportamento

- Bloco atual "Critérios da busca" (somente leitura) vira **collapsible editável**.
- Campos editáveis:
  - Keyword (texto livre, default = `tipo + bairro`)
  - Cidade / Estado
  - Bairro principal + bairros próximos (chips)
  - Quartos (min / max)
  - Área útil (min / max, m²)
  - Faixa de preço (min / max, R$)
  - Tipo de imóvel (select)
  - Finalidade (Venda/Aluguel)
  - Toggle "Expandir automaticamente se < 4 resultados" (default ON; quando OFF, usa só os filtros estritos definidos)
- Botões: **Reexecutar busca** (primário) e **Restaurar critérios originais**.
- Ao reexecutar:
  - Mostra estado de loading inline no painel (sem sair da página).
  - Chama o mesmo orquestrador PLP+PDP usado em `app.carregando.tsx`, agora com critérios manuais.
  - Substitui o `StudyResult` atual (mesmo `id`), atualiza `studyStore`, e re-renderiza gráficos/tabela/diagnóstico.
  - Em falha (token ausente / 0 resultados / erro de rede): toast com motivo, mantém relatório anterior intacto.
- Histórico simples: pequeno badge "Revisão Nº" incrementado a cada reexecução (apenas em memória/estudo).

### Implementação técnica

1. **Extrair orquestrador** de `src/routes/app.carregando.tsx` para `src/lib/study-runner.ts`:
   - `runStudy(input, overrides?)` retorna `StudyResult`.
   - `overrides` opcional: `{ keyword?, priceMin?, priceMax?, areaMin?, areaMax?, bedroomsMin?, bedroomsMax?, cidade?, estado?, bairro?, autoExpand?: boolean }`.
   - `app.carregando.tsx` passa a apenas chamar `runStudy(input)`.
2. **Atualizar `StudyResult`** (`src/lib/study-types.ts`):
   - Adicionar `overridesAplicados?: SearchOverrides` e `revisao?: number`.
3. **Novo componente** `src/components/criterios-editor.tsx`:
   - Painel collapsible (shadcn `Collapsible` + `Card`) com os campos acima.
   - Estado local controlado; ao submeter chama callback `onRerun(overrides)`.
4. **Integrar em `src/routes/app.relatorio.$id.tsx`**:
   - Substituir o bloco 3.5 atual pelo novo `CriteriosEditor`.
   - `handleRerun` chama `runStudy(study.input, overrides)`, atualiza state + `studyStore.save`, incrementa `revisao`.
   - Mantém o mini-funil (`funilBusca`) visível abaixo do editor.
5. **Defaults inteligentes** ao abrir o editor: preencher campos com os valores efetivamente usados na última execução (derivados de `criteriosAplicados` + `input`), não os do formulário original — para o usuário ajustar a partir do que de fato rodou.

### Fora do escopo

- Salvar múltiplas revisões como estudos separados (atual: sobrescreve).
- Editar diferenciais / dados do imóvel analisado (continua só pelo formulário).
