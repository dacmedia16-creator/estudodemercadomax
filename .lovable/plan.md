# Reescrever a narrativa do estudo para nunca sugerir manter ou subir o preço

## Problema
O diagnóstico atual diz coisas como "Seu imóvel está **bem posicionado**... Reforce os diferenciais para acelerar a negociação" quando o status é "Dentro da média". Para o proprietário, isso soa como "está tudo certo, posso até pedir mais". O texto também repete "diferenciais" como argumento, o que dá margem para resistência em ajustar valor. O mesmo risco existe no caso "Abaixo da média", que hoje sugere abertamente subir o preço.

A regra passa a ser: **a comunicação sempre puxa para velocidade de venda, competitividade e risco de encalhe — nunca elogia o posicionamento do pretendido nem convida a aumentar o valor.**

## Mudanças

### 1) `src/lib/study-engine.ts` — diagnósticos (linhas 198–204 e 354–360, duas ocorrências idênticas)
Reescrever os três ramos do diagnóstico em tom neutro/competitivo, sem "bem posicionado", sem "reforce os diferenciais", sem sugerir reajuste para cima:

- **Acima da média** → manter tom firme, mas tirar a parte de "destacando metragem, localização e diferenciais" (vira convite a justificar o preço). Substituir por algo como: "O valor pretendido está acima da faixa praticada no mercado de {bairro}. Imóveis nessa faixa tendem a ficar mais tempo no portal e perder visibilidade. Para se manter competitivo, recomenda-se trabalhar entre {faixaMin} e {faixaMax}."
- **Dentro da média** → trocar "bem posicionado" e "reforce os diferenciais" por leitura competitiva: "O valor pretendido está dentro da faixa praticada hoje em {bairro}, mas próximo do teto da concorrência. Para garantir visitas qualificadas e evitar que o anúncio esfrie, a faixa mais competitiva está entre {faixaMin} e {faixaMax}."
- **Abaixo da média** → remover "há espaço para reajuste de valor / aumentar a margem". Reescrever como confirmação de competitividade: "O valor pretendido está alinhado e competitivo frente ao mercado de {bairro}. A faixa de referência vai de {faixaMin} a {faixaMax} — manter nesse patamar tende a acelerar a venda."

Aplicar a mesma redação nas duas funções (`generateStudy` e a recompute em torno da linha 327).

### 2) `src/lib/study-engine.ts` — `pontosAtencao` / `pontosFortes`
- Adicionar em `pontosAtencao`, quando status for "Dentro da média": "Próximo do teto da faixa praticada — risco de tempo de venda mais longo."
- Remover frases em `pontosFortes` que possam ser usadas como argumento para subir preço ("Metragem acima da média da região" pode ficar, mas não criar nada novo nessa linha).

### 3) `src/lib/ai-analysis.functions.ts` — SYSTEM prompt
Reforçar as regras críticas do prompt para a IA também nunca dar margem:
- Adicionar regra explícita: "NUNCA descreva o imóvel como 'bem posicionado', 'bem precificado', 'no preço certo' ou frases equivalentes — mesmo quando o pretendido estiver dentro da média. Sempre traga a leitura para velocidade de venda, competitividade e risco de tempo no portal."
- Adicionar regra: "NUNCA sugira aumentar o valor pretendido, nem mesmo quando ele estiver abaixo da mediana. Se estiver abaixo, reforce que essa é a posição competitiva ideal."
- Adicionar regra: "Não use a palavra 'diferenciais' como argumento para sustentar o preço; diferenciais entram apenas como apoio à decisão de venda rápida."
- Ajustar o fallback determinístico (final do handler) com a mesma linguagem, removendo qualquer texto que possa soar como "está ótimo, mantenha".

### 4) Verificação
Após aplicar, rodar `rg -n "bem posicionad|reforce os diferenciais|aumentar a margem|reajuste de valor" src/` e confirmar que não há mais ocorrências.

## Fora do escopo
- Não alterar o label visual do badge "Dentro da média" / "Abaixo da média" / "Acima da média" no relatório — esses rótulos são neutros e seguem como classificação técnica. A mudança é só no texto que acompanha.
- Não mudar cálculo de faixa, ACM, percentis ou comparáveis.
