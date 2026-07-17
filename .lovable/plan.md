# Por que o painel "Valor recomendado" não recalcula

Ao adicionar/remover imóveis, o estudo é recalculado (`recomputeStudy`) — mas o número grande do hero vem de `getValorIdeal`, que **prioriza `study.aiAnalysis.faixaRecomendada.ideal`**. Esse campo é preenchido uma única vez pela IA e nunca é atualizado quando os comparáveis mudam. Só se a IA divergir >25% da mediana×área o motor cai no cálculo determinístico — dentro dessa faixa, o valor exibido continua o antigo.

Legenda ("N imóveis · média R$X/m²") atualiza, mas o valor recomendado, "Vender rápido" e "Anunciar até" (todos derivados dele) ficam parados.

# Correção

Fazer `recomputeStudy` reprojetar a `faixaRecomendada` da IA sobre o novo `stats`, mantendo o tom/texto da análise da IA mas com os números atuais.

## Passos

1. **`src/lib/study-engine.ts` — `recomputeStudy`**
   - Depois de calcular o novo `stats` e `valorIdealDetCalc`/`valorIdealRange`, reconstruir `aiAnalysis.faixaRecomendada` quando ela existir:
     - `ideal` = `valorIdealDetCalc` (mediana × área nova)
     - `min` = `valorIdealRange.min` (ou `faixaMin` como fallback)
     - `max` = `valorIdealRange.max` (ou `faixaMax`)
   - Preservar demais campos de `aiAnalysis` (resumo, argumentos, pontos etc.).
   - Se `aiAnalysis` não existir, não criar — mantém compatibilidade com estudos sem IA (getValorIdeal já cai no determinístico).

2. **Verificação rápida no preview**
   - Abrir um relatório, remover 1 imóvel via `ComparaveisManager` e confirmar que "Valor recomendado", "Vender rápido" e "Anunciar até" mudam junto com a legenda.
   - Adicionar um link manual e confirmar que o hero se move na direção esperada.

## Fora de escopo

- Não alterar a IA em si (nem re-chamar o gateway) — apenas reprojetar os números sobre os novos `stats`.
- PDF (`PrintOnePager`) já usa o mesmo `getValorIdeal`, então herda o fix automaticamente.
- Sliders de ACM já reagem — não são afetados por essa mudança.
