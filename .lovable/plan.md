## Por que os valores divergem hoje

No print: ACM mostra **Sugerido R$ 859k** / **Máx. publicação R$ 902k**, enquanto a IA mostra **Ideal R$ 1.154M** / **Teto R$ 1.231M**. São dois cálculos que rodam em paralelo e não conversam:

- **ACM (painel azul)**: parte de `mediana × área`, aplica os multiplicadores dos sliders, e então **clampa pelo piso competitivo** (`piso × 1.08`). No estudo do print esse clamp puxou o sugerido para baixo (de ~mediana×área para `795.600 × 1.08 = 859.248`).
- **IA (cards Entrada/Ideal/Teto)**: vem do JSON da IA (`faixaRecomendada`). Hoje só passa pelo `applyAcmToValue` (multiplicador + desconto de reforma) — **não respeita o piso nem o teto de publicação do ACM**. Por isso o "Ideal" da IA fica livre acima do clamp.

Resultado: o corretor vê dois "preços recomendados" diferentes na mesma página, sem saber qual usar — exatamente o que o usuário está reclamando.

## Proposta: ACM é a fonte da verdade, IA preserva o tom

Não vou mexer no prompt nem regerar IA. Faço a fusão **na renderização**: os cards Entrada/Ideal/Teto da IA passam a mostrar os mesmos números do painel ACM (já ajustados pelos sliders e pelo piso). A IA continua dona do texto qualitativo (resumo, posicionamento, discurso, argumentos, riscos), e as substituições de valor dentro desses textos também usam os números do ACM.

### Mudanças

1. **`src/components/ai-analysis-card.tsx`**
   - Calcular `acm = computeAcm(study, study.acm)` (já existe).
   - Definir o novo mapeamento de exibição:
     - **Entrada (rápido)** = `acm.valorMinimoFechamento` (piso de negociação)
     - **Ideal** = `acm.valorSugerido` (mesmo número do card "Valor sugerido" do ACM)
     - **Teto de publicação** = `acm.valorMaximoPublicacao` (mesmo do card "Máximo de publicação")
   - Manter como `entradaAdj / idealAdj / tetoAdj` para o resto do componente (substituição de texto, copiar, etc.) continuar funcionando.
   - O `pairs` (substituição de R$ no texto) passa a casar **valor original da IA → valor do ACM**, então a "Carta ao Proprietário" e os "Argumentos de mercado" também ficam coerentes (o número que aparece dentro do texto bate com o card).
   - Hint pequeno nos três cards: "alinhado ao ACM" (em vez de "ajustado pelos fatores ACM") quando o número de exibição diverge do original retornado pela IA.
   - Aviso discreto acima da carta quando `acm.pisoAplicado === true`: "Valor ajustado para respeitar o piso competitivo do mercado".

2. **`src/components/print-slides.tsx` (Carta no PDF)**
   - Mesma substituição com os pares `{ia ideal/entrada/teto → ACM valorSugerido/minFechamento/maxPublicacao}` para a página 3 do PDF refletir o mesmo número que aparece na tela.

3. **`src/components/acm-panel.tsx`**
   - Pequeno tooltip/legenda no card "Valor sugerido": "Esta é a referência usada também nos cards da Análise por IA abaixo." Só para o corretor entender que agora há uma única fonte.

### Sem mudanças em
- `study-engine.ts` (computeAcm, getValorIdeal continuam iguais)
- `ai-analysis.functions.ts` / prompts / persistência / tipos
- A IA continua sendo regerada normalmente; só a apresentação dos números fica casada com o ACM.

## Resultado
- Um único trio Entrada / Ideal / Teto na página, consistente entre ACM e IA.
- Mexer nos sliders ACM (ou ligar/desligar "respeitar piso") move ambos os blocos ao mesmo tempo.
- A divergência R$ 859k vs R$ 1.154M desaparece — vira o mesmo número, com a IA explicando o porquê em texto.
- Nenhum gasto novo de crédito de IA.
