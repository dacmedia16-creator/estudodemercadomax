## Objetivo

Quando o sugerido fica abaixo do pretendido, o corretor precisa de argumentos prontos, claros e empáticos para apresentar ao proprietário sem gerar atrito. Hoje a IA devolve "riscos" e "recomendações" técnicas — falta um discurso pronto, em tom humano, focado em justificar o valor.

## Mudanças

### 1. `src/lib/study-types.ts`
Adicionar dois campos opcionais em `AiAnalysis`:
- `discursoProprietario: string` — texto corrido, 4–6 frases, tom empático e profissional, pronto para o corretor ler/enviar ao dono.
- `argumentosChave: string[]` — 3 a 5 bullets curtos com os argumentos de mercado mais fortes (ex.: "12 imóveis semelhantes anunciados entre R$ X e R$ Y", "tempo médio de venda na faixa atual é N dias", "P25 do bairro está em R$/m² Z").

### 2. `src/lib/ai-analysis.functions.ts`
- Atualizar o `SYSTEM` prompt explicando o cenário: o corretor precisa convencer o proprietário, que costuma resistir quando o sugerido é menor que o pretendido. Pedir tom **acolhedor, profissional, sem culpar o dono, sempre ancorando em fato de mercado** (mediana, piso, nº de concorrentes, DOM).
- Incluir no JSON pedido os dois campos novos (`discursoProprietario`, `argumentosChave`).
- Atualizar `outputSchema` com os campos (`discursoProprietario` string min 1, `argumentosChave` array de strings, default `[]`).
- Atualizar o fallback (quando a IA falha em estruturar) gerando um discurso padrão a partir dos percentis: ex. "Olhando os {N} imóveis semelhantes no {bairro}, a faixa praticada hoje vai de {min} a {max}, com mediana em {mediana}. Para garantir visitas qualificadas nas primeiras semanas…"
- Passar no prompt o `valorPretendido` vs `valorSugerido` e a diferença percentual para a IA calibrar o tom (se pretendido > teto, ser mais firme; se está alinhado, parabenizar).

### 3. `src/components/ai-analysis-card.tsx`
Adicionar dois blocos novos no card, abaixo de "Posicionamento" e antes de "Riscos/Recomendações":
- **"Como conversar com o proprietário"** — caixa destacada (border-primary/30, bg-primary/5) com o `discursoProprietario` em texto corrido + botão **Copiar** (usa `navigator.clipboard.writeText`, toast de confirmação).
- **"Argumentos de mercado"** — lista compacta com os bullets de `argumentosChave`, cada um com ícone de check.

Atualizar a validação de "resposta incompleta" para considerar o novo campo `discursoProprietario` como obrigatório.

## Notas técnicas

- Sem mudanças de schema do banco — `aiAnalysis` continua como JSON opcional no `StudyResult`.
- Sem novas dependências.
- O botão "Copiar" usa a Clipboard API nativa; fallback silencioso se o navegador bloquear.
- Mantém compatibilidade com estudos antigos: os campos novos são opcionais; o card só renderiza os blocos se vierem preenchidos.
