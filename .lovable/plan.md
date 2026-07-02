## Destravar o Valor sugerido quando o multiplicador cai

Hoje, quando o `valorSugeridoRaw` (área × R$/m² ajustado) fica acima do teto (piso + 15%), o `computeAcm` fixa o Valor sugerido no teto. Resultado: você mexe os sliders pra baixo, o R$/m² acompanha, mas o Valor sugerido só sai do lugar quando o raw finalmente cai abaixo do teto — parece "travado".

### Opções

**(A) Desligar "Respeitar piso" por padrão** — em `src/lib/study-types.ts`, `DEFAULT_ACM.respeitarPiso: true` → `false`. Slider passa a mexer no preço linearmente. O piso ainda existe como toggle opcional, mas fica desativado. Estudos antigos ficam como estavam.

**(B) Manter o piso, mas subir o teto default pra +40%** — `maxAcimaPisoPct: 15` → `40`. Praticamente nunca trava, mas a proteção continua lá pra evitar preço absurdo abaixo do piso.

**(C) Mudar a lógica: piso só vira "aviso", nunca clampa** — em `src/components/acm-panel.tsx`/`study-engine.ts`, remover a linha que faz `valorSugerido = teto`. O piso só marca `pisoAplicado=true` pro hint amarelo, mas o Valor sugerido segue livre.

### Recomendo

**(C)** — o piso vira informação, não uma trava. O slider sempre responde 1:1 no preço total, e você ainda vê o aviso quando está acima do teto.

Qual prefere: A, B ou C?