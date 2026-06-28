
## Problema

Hoje o valor sugerido vem da fórmula ACM (média de R$/m² × multiplicadores × área − reforma). Quando há 1–2 comparáveis muito baratos puxando o piso, a média ignora esse "chão de mercado" e o sugerido fica longe do menor preço — o corretor perde competitividade.

## Solução em duas frentes

### 1. Ancoragem estatística no valor mínimo (determinística, sem IA)

Trocar a média simples por uma faixa que respeita o piso do mercado:

- Calcular **percentis** dos R$/m² dos comparáveis (P10, P25, mediana, P75, P90) em vez de só média.
- Usar **mediana** como base do valor de m² avaliado (mais robusta a outliers).
- Adicionar um **"piso competitivo"**: max(P10, menor preço × 1,02). O valor sugerido nunca fica mais de X% acima desse piso (X configurável, default 8%).
- Detectar **outliers** (preços > P90 × 1,3 ou < P10 × 0,7) e marcar com badge "Outlier" — opção de excluí-los do cálculo com um clique.
- Mostrar no painel ACM: **Menor**, **P25**, **Mediana**, **Sugerido**, **P75**, **Maior** numa régua visual, com o sugerido posicionado na régua para o corretor ver onde está.
- Novo controle "Estratégia de precificação" no painel ACM: **Agressivo (P25)** / **Equilibrado (mediana, default)** / **Premium (P75)**.

### 2. Análise de IA opcional (Lovable AI — Gemini)

Botão **"Analisar com IA"** no relatório que envia comparáveis + dados do imóvel para o Gemini via `createServerFn` e retorna:

- **Faixa recomendada** justificada (preço de entrada, ideal, teto), considerando o piso do mercado e diferenciais.
- **Posicionamento** vs. os 3 mais baratos e os 3 mais caros (por que está próximo/longe).
- **Riscos de superprecificação** (tempo médio até venda esperado, chance de virar "encalhe").
- **Recomendações de ajuste**: o que destacar no anúncio, quando reduzir, faixa de negociação.
- Resposta estruturada com `Output.object` (Zod), salva no estudo como `study.aiAnalysis` para reabrir sem gastar crédito de novo.

## Onde mexe

- `src/lib/study-engine.ts`: novas funções `computeStats` (percentis) e `computeAcm` com `estrategia` + `pisoCompetitivo`; `StudyResult` ganha `stats` (P10/P25/median/P75/P90) e `valorPiso`.
- `src/lib/study-types.ts`: `AcmAdjustments` ganha `estrategia: "agressivo" | "equilibrado" | "premium"` e `respeitarPiso: boolean`; `StudyResult` ganha `aiAnalysis?`.
- `src/components/acm-panel.tsx`: régua visual com percentis + seletor de estratégia + toggle "Respeitar piso de mercado".
- `src/components/comparaveis-manager.tsx`: badge "Outlier" + ação "Excluir do cálculo".
- `src/components/print-slides.tsx`: mostrar a régua percentil no slide ACM.
- `src/lib/ai-analysis.functions.ts` (novo): `createServerFn` com `requireSupabaseAuth`, usa `createLovableAiGatewayProvider` + `google/gemini-3-flash-preview` + `Output.object`, trata 402/429.
- `src/routes/app.relatorio.$id.tsx`: botão "Analisar com IA" + card de resultado.
- `src/lib/study-store.ts`: persistir `stats` e `aiAnalysis` no JSONB do estudo.

## Por que isso resolve

O valor sugerido deixa de ser "média cega" e passa a ser **mediana + piso competitivo**: por construção, ele nunca fica muito acima do menor preço (limite configurável). A IA entra como camada de **leitura qualitativa** explicando o porquê e sugerindo a faixa final, sem substituir a matemática.

## Fora do escopo desta etapa

- Treinar modelo próprio com histórico de vendas.
- Previsão de tempo até venda baseada em DOM real do portal (já temos o dado, mas modelar fica para depois).
- Comparar IA de provedores diferentes.
