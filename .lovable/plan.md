## Objetivo

Sempre que o sistema sugerir um ajuste estratégico de preço (no PDF, na carta ao proprietário, no relatório na tela e nos textos da IA), a referência deve ser o **Valor Ideal** (mediana de mercado × área, ou `faixaRecomendada.ideal` quando a IA estiver disponível) — e não mais o `acm.valorSugerido`. Isso unifica o discurso: o "preço recomendado / sugerido" mostrado em todos os pontos passa a coincidir com o "Valor Ideal" que já aparece nas faixas.

## O que muda

### 1. Helper único — `src/lib/study-engine.ts`
Adicionar `getValorIdeal(study, acm)` com a regra:
1. `study.aiAnalysis?.faixaRecomendada.ideal` (quando IA rodou)
2. `study.stats.median × input.areaUtil` (quando há percentis)
3. fallback: `acm.valorSugerido`

Esse helper passa a alimentar todos os textos de "ajuste sugerido".

### 2. PDF página 2 — "Argumentos para o Proprietário" (`print-slides.tsx`, `OwnerPersuasionPage`)
- "Valor sugerido (ACM)" passa a exibir `valorIdeal` e seu rótulo vira **"Valor ideal de publicação"**.
- `gap` / `gapPct` / `statusLabel` (ACIMA / DENTRO / ABAIXO) recalculados contra o ideal.
- Fallback args (`buildFallbackArgs`): a frase "Ajustar para X" passa a citar o `valorIdeal`.

### 3. PDF página 3 — "Carta ao Proprietário" (`OwnerLetterPage`)
- Card "Preço recomendado" mostra `valorIdeal` (mesmo número da faixa "Ideal" logo abaixo).
- "Diferença" e o tom (ok / ajustar / alto) recalculados contra o ideal.

### 4. Relatório na tela — `src/routes/app.relatorio.$id.tsx`
- HERO "Valor recomendado para venda" passa a usar `valorIdeal`.
- Pílula "Valor ideal" idem (fica idêntica ao hero, eliminando a inconsistência atual entre hero e pílula).
- Pílulas "Mínimo de fechamento" e "Máximo de publicação" passam a ser derivadas do `valorIdeal` (× 1 − margem / × 1 + margem) para manter coerência.

### 5. Texto narrativo determinístico — `study-engine.ts`
- `argumentoProprietario` e a frase de "Acima da média" passam a explicitar **"o valor ideal de mercado é R$ X"** (mediana × área), além de citar a faixa.

### 6. IA — `src/lib/ai-analysis.functions.ts`
- SYSTEM ganha regra explícita: "Sempre que sugerir um ajuste de preço, ancore no `faixaRecomendada.ideal`. Nunca diga 'ajuste para o valor sugerido' — sempre 'ajuste para o valor ideal' (R$ X)."
- O prompt do usuário passa a calcular **"diferença pretendido vs ideal"** (e não vs sugerido) e a injetar esse número.
- Fallback determinístico já usa `base = median`; só ajusto o texto do `discursoProprietario` para chamar esse número de **"valor ideal"**.

## Critérios de aceite

- No PDF (páginas 2 e 3) e no relatório na tela, o número exibido como "preço recomendado / sugerido / valor ideal" é **o mesmo** em todos os pontos.
- A diferença % e o tom (ACIMA / DENTRO / ABAIXO) usam esse mesmo valor como referência.
- Qualquer frase do tipo "sugiro ajustar para …" cita o valor ideal.
- Quando a IA está disponível, todos os pontos seguem `faixaRecomendada.ideal`; sem IA, seguem `mediana × área`; sem stats, caem no `acm.valorSugerido` (compatibilidade).
- Sem mudanças em backend, schemas ou fluxo de busca.
