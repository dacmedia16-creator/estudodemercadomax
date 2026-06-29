## Objetivo
A análise da IA deve vir pronta junto com o estudo, sem precisar clicar em "Analisar com IA".

## Mudanças

1. **`src/lib/study-runner.ts`** — após calcular `result` e antes de retornar:
   - Chamar `analisarMercadoIa` (server fn) com o mesmo payload usado hoje no `AiAnalysisCard` (imóvel, mercado com percentis/ACM, top 15 comparáveis).
   - Atualizar `setStep("Gerando análise por IA...")` para feedback no loading screen.
   - Em sucesso: anexar `result.aiAnalysis = res.data`.
   - Em falha (402/429/erro): seguir sem IA (silencioso, log no console) — o card continua permitindo "Gerar novamente" manualmente como fallback.

2. **`src/components/ai-analysis-card.tsx`** — ajustes mínimos:
   - Quando `study.aiAnalysis` já existir (caso comum agora), mostrar direto o conteúdo.
   - Quando não existir (fallback de falha), manter botão "Analisar com IA".
   - Trocar o estado vazio para mensagem mais branda ("Análise automática indisponível — clique para tentar novamente").

3. **`src/routes/app.relatorio.$id.tsx`** — para estudos antigos sem `aiAnalysis`:
   - Em `useEffect`, se `study && !study.aiAnalysis && !study.aiAttempted`, disparar `analisarMercadoIa` uma vez automaticamente, salvar via `studyStore.save` e marcar `aiAttempted` em memória para evitar loop.

## Resultado
- Novo estudo: já abre o relatório com a análise da IA pronta.
- Estudo antigo aberto: gera automaticamente na primeira visita.
- Sem créditos / erro: card mostra mensagem e botão manual.
