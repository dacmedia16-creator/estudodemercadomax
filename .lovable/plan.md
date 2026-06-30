## Problema

Mexer em Localização / Conservação / Idade / Padrão / Reforma muda o "Valor sugerido" interno do painel ACM, mas **não muda o "Valor ideal de publicação"** que aparece no hero do relatório e é o número usado no PDF, carta e argumentos.

Causa: `getValorIdeal()` em `src/lib/study-engine.ts` retorna `aiAnalysis.faixaRecomendada.ideal` (ou `mediana × área`) e só cai no `acm.valorSugerido` como último recurso. Os ajustes do ACM ficam órfãos.

## Correção

**`src/lib/study-engine.ts` — `getValorIdeal()`**

Aplicar o multiplicador ACM e o desconto de reforma sobre a base (IA ou determinística), em vez de ignorá-los:

1. Calcular `base` = IA (com guarda de 25%) ou `mediana × área`, como hoje.
2. Calcular `mult` = produto dos 4 fatores ACM (localização × conservação × idade × padrão), default 1.0 quando todos a 100%.
3. Calcular `descontoReforma` = `reformaPorM2 × areaUtil`.
4. Retornar `Math.round(base × mult − descontoReforma)`, respeitando piso competitivo se `respeitarPiso` estiver ativo (mesma lógica do `computeAcm`).
5. Quando todos os fatores estão neutros (100%, reforma 0), o resultado é idêntico ao de hoje — sem regressão para estudos que nunca tocaram o ACM.

**`src/routes/app.relatorio.$id.tsx`**

A `ratioMin`/`ratioMax` da faixa de publicação já é derivada de `acm.valorSugerido`, então passa a refletir a margem corretamente sobre o novo `valorIdeal`. Sem mudança adicional.

**Sem mudanças** em UI, PDF, AI prompts, busca, ou no `computeAcm` (continua sendo a fonte para o card "Resumo para venda" do painel).

## Resultado

Mover os sliders do ACM passa a alterar em tempo real:
- Hero "Valor ideal de publicação" no relatório
- Faixa min/máx de publicação
- Valor ideal usado na Carta ao Proprietário e nos argumentos do PDF
