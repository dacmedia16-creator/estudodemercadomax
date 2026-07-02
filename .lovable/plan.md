## Manter média + destravar o piso competitivo

Mantém a fórmula da **média dos 4 fatores** (mudança de hoje) e resolve o travamento do Valor sugerido pelo piso.

### 1. Aumentar o teto default do piso

**`src/lib/study-types.ts`** — `DEFAULT_ACM.maxAcimaPisoPct`: `8` → `15`.

Efeito: em estudos novos, o Valor sugerido pode ficar até 15% acima do piso competitivo antes de travar (antes só podia 8%). Estudos antigos com valor já salvo continuam com o que estava.

### 2. Banner de aviso quando o piso trava

**`src/components/acm-panel.tsx`** — Quando `computed.pisoAplicado === true`, mostrar um bloco amarelo logo acima da grid dos fatores:

> **Valor sugerido travado pelo piso competitivo**
> Piso: **R$ X** · teto atual: piso + **{maxAcimaPisoPct}%**. Os sliders de Localização/Conservação/Idade/Padrão não vão subir o Valor sugerido enquanto estiver travado.
> [Aumentar teto para +25%] [Desligar "Respeitar piso"]

Os dois botões chamam `update({ maxAcimaPisoPct: 25 })` e `update({ respeitarPiso: false })`. Some quando `pisoAplicado` volta a ser false.

### 3. Ajuste rápido no card "Valor sugerido"

Deixar o hint atual ("limitado pelo teto acima do piso") mais visível — trocar a cor para amarela (`text-warning-foreground`) quando `pisoAplicado`.

### Fora do escopo

- Fórmula do multiplicador (fica a média).
- Cálculo do piso (`max(P10 × área, menorPreço × 1.02)`).
- Motor de scoring, IA, PDF, margem de publicação, estratégia.
- Estudos já salvos: o `DEFAULT_ACM` novo só vale pra quem ainda não tem `acm.maxAcimaPisoPct` salvo. Quem já salvou 8% continua com 8% (pode subir manualmente no slider ou usar o botão do banner).

Confirma que é isso?