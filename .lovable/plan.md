Ao adicionar ou remover um imóvel no card "Ajustar comparáveis", além de recalcular médias, mediana, R$/m², ACM e estatísticas (que já funciona), o estudo passa a ser **salvo automaticamente**, sem depender do botão "Salvar".

## Mudança

- Em `src/components/comparaveis-manager.tsx`, após cada `handleAdd`, `handleRemove` e `handleRestore`, chamar `studyStore.save(recalculado)` antes/depois do `onChange`.
- Os toasts passam a informar "Recalculado e salvo" em vez de só "Recalculado".
- Se `studyStore.save` falhar, mostra toast de erro mas mantém o estado local atualizado (o usuário ainda vê o novo cálculo em tela).

Nenhuma outra tela ou lógica é alterada — a IA continua sendo regenerada manualmente pelo botão do card de análise, e a busca nos portais continua manual.