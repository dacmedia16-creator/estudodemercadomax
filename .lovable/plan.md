## Objetivo
Trazer o conteúdo gerado pela IA (`study.aiAnalysis`) para a **Carta ao Proprietário** (página 3 do PDF), selecionando apenas o que é relevante para o dono do imóvel e em linguagem destinada a ele — sem jargão técnico.

## O que entra (e por quê)
Da resposta da IA usaremos:
- `discursoProprietario` → já é escrito em 1ª pessoa do plural, tom acolhedor, pronto para o dono ler. Vira o **corpo principal** da carta.
- `argumentosChave` (top 3) → fatos curtos de mercado (“X imóveis anunciados entre R$ A e R$ B”, “mediana em R$/m² Y”). Reforçam a carta com dados.
- `faixaRecomendada` → já é usada hoje no bloco “Faixa que recomendamos para publicar” (mantém).

O que **não** entra na carta (continua só nas páginas internas / one-pager):
- `resumo`, `posicionamento`, `riscos`, `recomendacoes` → linguagem voltada ao corretor, não ao proprietário.

## Mudanças

### 1. `src/components/print-slides.tsx` → `OwnerLetterPage`
- Ler `ai = study.aiAnalysis` (opcional).
- **Substituir o parágrafo `owner-letter-intro` fixo** por:
  - Se `ai?.discursoProprietario` existir → usar esse texto (mantém quebras de linha com `white-space: pre-line`).
  - Senão → manter o texto atual como fallback.
- **Adicionar bloco novo `owner-letter-ia`** (só se `ai?.argumentosChave?.length > 0`), inserido **logo após “O que o mercado está dizendo” / “Por que ajustar agora vale a pena”** e **antes da “Faixa que recomendamos para publicar”**:
  - Título: “O que pesou na nossa análise”.
  - Lista compacta com até 3 itens de `argumentosChave`.
  - Selo discreto “análise assistida por IA · revisada pelo corretor”.
- Manter tabela de comparáveis e pontos fortes/atenção como estão.

### 2. `src/styles.css` (bloco `.print-owner-pages` dentro de `@media print`)
- Adicionar `.owner-letter-ia` (borda lateral azul, padding 4pt, fonte 7.4pt, lista com bullets).
- Garantir `white-space: pre-line` em `.owner-letter-intro` para preservar quebras do `discursoProprietario`.
- Reduzir levemente, **só nesta página e só se necessário**, alguns paddings/line-heights para acomodar o novo bloco sem estourar a folha A4:
  - `owner-letter-grid` gap 4pt → 3pt
  - `owner-letter-faixa` padding-y −1pt
  - `owner-letter-cta` padding-y −1pt
- Página continua travada em 210×297mm com `overflow: hidden`.

### 3. Validação
- Abrir um relatório que já tenha rodado a análise de IA (ou rodar “Analisar com IA” antes) e acionar **Exportar PDF**.
- Confirmar via Playwright/print preview que a página 3:
  - Mostra o discurso da IA como texto principal.
  - Mostra os 3 argumentos-chave.
  - Continua cabendo em 1 única folha A4 retrato com tabela de comparáveis + pontos fortes/atenção.
- Confirmar que estudos **sem** `aiAnalysis` continuam exibindo o texto/fallback atual sem quebrar layout.

## Escopo
- Sem mudanças na página 1 (one-pager) nem na página 2 (Argumentos).
- Sem mudança em lógica de cálculo, prompts ou schema da IA — só apresentação na página 3.
