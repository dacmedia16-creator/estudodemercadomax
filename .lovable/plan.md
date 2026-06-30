## Problema

Mexer nos sliders da ACM (Localização / Conservação / Idade / Padrão) e no desconto de reforma altera `valorM2Avaliado`, mas o **Valor sugerido** continua igual porque o "Respeitar piso de mercado" está fixando o sugerido no piso competitivo (≈ menor preço × 1,02). No estudo do print: sliders dão R$ 1.300.460, mas o piso (1.450.000 × 1,02 = 1.479.000) sobrescreve o resultado e o número não responde aos sliders.

## Mudanças

### 1. `src/lib/study-engine.ts` — `computeAcm`
- Remover o clamp que **sobe** o `valorSugerido` até o piso. O piso passa a ser apenas referência informativa + teto opcional (limite máximo acima do piso), nunca um chão que ignora o ajuste do avaliador.
- Substituir o bloco:
  ```ts
  if (a.respeitarPiso && valorPiso > 0) {
    const teto = valorPiso * (1 + (a.maxAcimaPisoPct ?? 8) / 100);
    if (valorSugerido > teto) { valorSugerido = teto; pisoAplicado = true; }
    if (valorSugerido < valorPiso) valorSugerido = valorPiso;  // ← remover
  }
  ```
  por uma versão que só aplica o teto (limita para cima). Marcar `pisoAplicado = true` somente quando o teto foi de fato aplicado.
- Adicionar campo informativo `abaixoDoPiso: boolean` em `AcmComputed` para a UI alertar (sem alterar o valor).

### 2. `src/components/acm-panel.tsx`
- Trocar o hint atual ("limitado pelo piso de mercado") por dois estados distintos:
  - **Teto aplicado** (sugerido foi reduzido pelo "máx. acima do piso"): badge informativa atual.
  - **Abaixo do piso**: aviso amarelo "Seu ajuste está abaixo do piso competitivo (formatBRL(piso)) — confira se faz sentido", **sem** alterar o número.
- Pequeno ajuste no `SummaryItem` "Piso competitivo" para sempre mostrar (mesmo quando teto não atuou), reforçando que é referência.

### 3. Nenhuma mudança em `getValorIdeal`, `print-slides.tsx`, runner ou tipos persistidos
O ACM já é propagado em tempo real para o relatório/slide via `onChange` — basta o `valorSugerido` deixar de ser pinado pelo piso para o PDF e a Carta ao Proprietário refletirem os sliders imediatamente.

## Resultado esperado no estudo do print
Com fatores 100/95/90/90 e sem reforma:
- Valor sugerido passa de **R$ 1.479.000 → R$ 1.300.460** (responde aos sliders).
- Valor Máximo de Publicação ajusta junto (`+ margem`).
- Aparece aviso "abaixo do piso (R$ 1.479.000)" no painel — apenas informativo, decisão fica com o corretor.
