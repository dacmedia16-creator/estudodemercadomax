## Problema
Os cards "Entrada / Ideal / Teto" e a "Carta ao proprietário" exibem números absolutos retornados pela IA e gravados em `study.aiAnalysis`. Eles não respondem aos sliders ACM — só mudam quando o usuário clica "Gerar novamente" (consome créditos e muda o texto inteiro).

## Mudanças

### 1. `src/lib/study-engine.ts` — novo helper `applyAcmToValue`
Pequeno utilitário puro `applyAcmToValue(v, acm) = Math.max(0, Math.round(v * mult - desconto))`, reutilizado pelo card e pelo PDF.

### 2. `src/components/ai-analysis-card.tsx`
- Calcular ao vivo `entradaAdj / idealAdj / tetoAdj` aplicando `applyAcmToValue` em cima de `ai.faixaRecomendada.{entrada,ideal,teto}` usando o ACM corrente.
- Exibir esses valores nos três cards `FaixaCell`. Quando o ajuste diverge do valor original da IA, mostrar hint pequeno: "ajustado pelos fatores ACM".
- "Como conversar com o proprietário": pós-processar `ai.discursoProprietario` substituindo a primeira ocorrência do `formatBRL(ai.faixaRecomendada.ideal)` (e suas variações com espaço/sem espaço pt-BR) pelo `formatBRL(idealAdj)`. Se o texto não casar (segurança), mostrar um aviso pequeno acima da carta: "Valor ideal ajustado para R$ X — atualize a carta antes de enviar" + botão "Atualizar com novos valores" que faz a substituição manualmente do trecho clicando.
- Idem para a lista `argumentosChave`: substituir aparições de `formatBRL(originalIdeal)` por `formatBRL(idealAdj)`.
- O botão "Copiar" copia a versão ajustada.

### 3. `src/components/print-slides.tsx` (Carta ao Proprietário no PDF)
Aplicar a mesma substituição de string no `discursoProprietario` antes de renderizar na página 3 do PDF, usando o mesmo helper. Mantém o PDF consistente com a tela.

### 4. Sem mudanças em
`ai-analysis.functions.ts`, prompts, persistência ou tipos — os valores originais da IA continuam preservados em `study.aiAnalysis`; o ajuste é só na renderização.

## Resultado
Mexer nos sliders ACM passa a refletir imediatamente em:
- Cards Entrada / Ideal / Teto da Análise por IA
- Frases com valor R$ dentro da Carta ao Proprietário (tela + PDF)
- Argumentos de mercado que citam o "ideal"

Sem novo gasto de crédito de IA e sem perder o texto qualitativo original.
