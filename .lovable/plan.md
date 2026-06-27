## Objetivo
Adicionar um 4º modo **"Preferir"** aos Campos Extras, que **prioriza** imóveis com o item selecionado (boost na similaridade e badge "match exato"), mas **não exclui** os que não têm — diferente do "Obrigatório" que elimina.

## Mudanças

### 1. `src/lib/study-types.ts`
- Estender o tipo:
  ```ts
  export type FieldMode = "ignore" | "soft" | "prefer" | "hard";
  ```
- `DEFAULT_FIELD_MODES`: manter como está (continua usando `soft` por padrão).
- Comentário do JSDoc atualizado explicando:
  - `prefer`: igual ao `soft` na busca (não filtra), mas com peso **dobrado** na similaridade e marca de "match preferido" quando bate.

### 2. `src/lib/study-engine.ts`
- Onde a similaridade é calculada por campo, ler o modo:
  - `ignore` → peso 0
  - `soft` → peso normal
  - `prefer` → peso ×2 + bônus fixo (~+5 pts) quando o comparável atende ao critério; sem penalidade extra quando não atende
  - `hard` → mantém comportamento atual (filtro duro upstream)
- Adicionar flag `preferenciaAtendida?: boolean` em `ComparableProperty` quando todos os campos `prefer` foram atendidos (usado para badge na UI).

### 3. `src/lib/study-runner.ts`
- No estágio de filtro pós-busca, só aplicar exclusão para modos `hard`. Modos `prefer` **não filtram nada** — só sinalizam pra etapa de ranking.
- Garantir que os parâmetros nativos do portal (Zap/Chaves PLP filters de piscina, vagas, etc.) **só** são enviados quando o modo é `hard`. `prefer` busca amplo e prioriza localmente.

### 4. `src/components/criterios-editor.tsx`
- Adicionar `<SelectItem value="prefer">Preferir</SelectItem>` no Select de cada campo, entre "Preferência" e "Obrigatório".
- Atualizar o texto explicativo do painel:
  > **Ignorar**: só no relatório. **Preferência**: pesa um pouco. **Preferir**: prioriza quem tem, mas inclui quem não tem. **Obrigatório**: elimina quem não bate.

### 5. `src/routes/app.relatorio.$id.tsx` (tabela de comparáveis)
- Quando `preferenciaAtendida` for true, mostrar um badge sutil **"Match preferido"** no cartão/linha do comparável.

## Fora do escopo
- Não mexer no fluxo de busca por CEP, ACM, ou layout do PDF.
- `DEFAULT_FIELD_MODES` permanece igual — usuário precisa escolher "Preferir" manualmente.
- Sem migração de estudos antigos — `prefer` só se aplica em reexecuções/novos estudos.