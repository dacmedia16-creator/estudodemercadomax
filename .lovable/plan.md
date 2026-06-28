## Problema

O slide ACM (pré-visualização na tela e no PDF) só atualiza depois que o usuário clica em **Salvar ajustes** no painel ACM. Isso acontece porque `AcmPanel` mantém os sliders/inputs num estado local (`acm`) e só repassa para o `study` (via `onChange`) dentro do `persist()`. Como `PrintSlides` lê de `study.acm`, ele fica "congelado" até o save.

Mexer em comparáveis (excluir/incluir) já atualiza o slide, porque o `ComparaveisManager` chama `onChange` na hora.

## Correção

Tornar o painel ACM **reativo em tempo real**, sem perder o botão de salvar:

1. `src/components/acm-panel.tsx`
   - No `update(patch)`, além de atualizar o estado local, chamar `onChange({ ...study, acm: next })` para que o relatório e o slide reflitam o ajuste imediatamente.
   - O botão **Salvar ajustes** continua existindo e passa a apenas persistir no `studyStore` (sem precisar mexer em estado, já que o `study` já está atualizado em memória).
   - **Resetar** também propaga via `onChange` para voltar o slide ao neutro na hora.
   - Sincronizar o estado local quando o `study.id` muda (caso o usuário reexecute a busca e o estudo seja substituído) usando um `useEffect` simples.

2. `src/routes/app.relatorio.$id.tsx`
   - Garantir que o `<PrintSlides variant="screen" />` (linha 522) e o `<PrintSlides />` de impressão (linha 136) recebem o `study` mais recente — já recebem, basta a propagação acima funcionar.
   - Sem outras mudanças.

Nenhuma mudança de lógica de busca/ACM/cálculos. Apenas reatividade da UI.

## Resultado esperado

- Mover sliders de Localização/Conservação/Idade/Padrão → slide atualiza Valor avaliado, Valor sugerido, Máx. de publicação e os fatores no rodapé em tempo real.
- Mudar Reforma R$/m² ou Margem → slide atualiza desconto de reforma e faixas na hora.
- Botão **Salvar ajustes** continua persistindo no banco; reabrir o estudo mantém os valores.