## Trocar multiplicador ACM de produto para média dos 4 fatores

Hoje os sliders de **Localização / Conservação / Idade / Padrão** se multiplicam entre si, o que faz o efeito compor demais (110% em todos = +46%). Vou trocar por **média aritmética dos 4 fatores**, que é o que você espera: 110% em todos = +10%, 90% em todos = −10%.

### Mudança única

**`src/lib/study-engine.ts`** (linha ~526, função `computeAcm`)

De:
```ts
const mult = (a.localizacao / 100) * (a.conservacao / 100) * (a.idade / 100) * (a.padrao / 100);
```

Para:
```ts
const mult = (a.localizacao + a.conservacao + a.idade + a.padrao) / 4 / 100;
```

### Efeito

- Todos em 100% → **100%** (neutro, igual antes).
- Todos em 110% → **110%** (+10%, antes era +46%).
- Localização 120%, resto 100% → **105%** (o slider individual pesa 1/4, antes pesava 20% cheio).
- Todos em 90% → **90%** (−10%, antes era −34%).

Tudo o mais fica igual: desconto de reforma, margem de publicação, estratégia (agressivo/equilibrado/premium), piso competitivo, IA, PDF — nenhum outro cálculo muda.

### Texto de ajuda embaixo dos sliders

Atualizar a legenda em `src/components/acm-panel.tsx` para refletir a nova fórmula:

De: "Multiplicador combinado: X% · cada fator parte de 100% (neutro). Acima valoriza, abaixo desvaloriza."

Para: "Multiplicador combinado: X% · média dos 4 fatores (cada um pesa 1/4). 100% = neutro."

Só isso. Confirma que era isso mesmo que você queria?