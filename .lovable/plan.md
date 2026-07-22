## Objetivo

Permitir excluir um comparável direto da tabela de evidências do relatório (hoje só dá para excluir pelo painel "Ajustar comparáveis").

## Mudanças

**Arquivo:** `src/routes/app.relatorio.$id.tsx`

1. Adicionar botão de lixeira (ícone `Trash2`) na última coluna de cada linha da tabela, ao lado do chevron de expandir.
2. Ao clicar:
   - `e.stopPropagation()` para não abrir/fechar o detalhe da linha.
   - Remover por **índice** (mesma abordagem do `ComparaveisManager`, evitando problemas de IDs duplicados).
   - Rodar `recomputeStudy` com a nova lista, atualizar estado local via o mesmo setter que já persiste, e salvar via `studyStore.save` com toast de sucesso/erro.
3. Reaproveitar o handler que o `ComparaveisManager` já usa (extrair para função local `handleRemoveComparavel(index)` no componente do relatório, ou passar via callback). Como o `ComparaveisManager` já vive na mesma página e opera sobre o mesmo `study`, a função pode ser declarada uma vez no componente pai e usada nos dois lugares.
4. Se a linha estiver expandida no momento da remoção, fechar (`setExpandedRow(null)`).

## Fora de escopo

- Nenhuma mudança no motor, no PDF, no schema ou no painel "Ajustar comparáveis".
- Sem confirmação modal (mesma UX do painel — clique único remove, undo via "Restaurar originais").
