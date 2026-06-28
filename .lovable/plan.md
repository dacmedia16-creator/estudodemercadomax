
# Página de Convencimento do Proprietário no PDF

Hoje o slide ACM (A4 paisagem) mostra a tabela de comparáveis e o valor sugerido, mas não entrega ao corretor um material pronto para **defender uma redução de preço** com o proprietário. Vou adicionar uma segunda página ao PDF dedicada a isso, usando dados que já temos no estudo (`stats`, `comparaveis`, `acm`, `aiAnalysis`).

## O que vai aparecer na nova página

1. **Cabeçalho com a “tese”**
   - Valor pretendido pelo proprietário × Valor sugerido pela ACM
   - Diferença em R$ e %
   - Selo de status (Acima / Dentro / Abaixo da média)

2. **Bloco "Por que o preço atual afasta compradores"** (fatos do mercado)
   - Posição do preço pretendido entre P10–P90 dos comparáveis (ex.: “seu preço está no topo 10% da região”).
   - R$/m² pretendido vs. mediana e teto do bairro.
   - Quantos comparáveis estão abaixo do preço pretendido (“X de Y imóveis semelhantes custam menos”).
   - Menor preço total observado no mesmo perfil.
   - Tempo médio no mercado (DOM) quando disponível, destacando anúncios antigos como sinal de preço alto.

3. **Tabela "Os 5 concorrentes diretos mais baratos"**
   - Top 5 comparáveis ordenados por preço (mesmo prédio/endereço primeiro quando houver).
   - Colunas: endereço/edifício, área, dorms, R$ total, R$/m², link.
   - Cada linha com a diferença % vs. o imóvel do proprietário — visualmente mostra que existe oferta melhor.

4. **Bloco "Faixa recomendada de publicação"**
   - Entrada / Ideal / Teto vindos de `aiAnalysis.faixaRecomendada` (ou calculados a partir de `stats` quando a IA não rodou).
   - Valor máximo de publicação (já calculado no ACM) com margem de negociação destacada.
   - Mini-simulação: “publicando a R$ X, seu imóvel entra no top 25% mais competitivos”.

5. **Bloco "Argumentos prontos para a conversa"**
   - Usa `aiAnalysis.discursoProprietario` e `aiAnalysis.argumentosChave` quando existirem.
   - Fallback determinístico (sem IA) montado a partir das estatísticas: 4–6 bullets do tipo
     - “Há N imóveis equivalentes anunciados por até R$ X a menos.”
     - “O R$/m² pretendido está Y% acima da mediana do bairro.”
     - “Imóveis nessa faixa de preço ficam em média Z dias no portal.”
     - “Reduzindo para R$ W, o imóvel passa a competir com a metade inferior do mercado e tende a vender mais rápido.”

6. **Bloco "Riscos de manter o preço atual"**
   - 3 bullets curtos: perda de relevância nos portais, queda de visitas, necessidade de descontos maiores depois.
   - Usa `aiAnalysis.riscos` quando disponível; caso contrário, texto padrão calibrado pelo gap %.

7. **Rodapé**
   - Marca/corretor (do `branding-store`), data, ID do estudo — igual à página ACM atual para manter identidade visual.

## Como o PDF vai sair

- Mantém a página ACM atual como **página 1**.
- Nova **página 2** “Argumentos para o Proprietário”, também A4 paisagem, mesmas cores da marca.
- Continua usando o fluxo de impressão atual (`?auto=slides`) — o usuário gera o PDF do mesmo jeito, só que agora com 2 páginas.
- Sem nova dependência; tudo renderizado em React + CSS print já existentes.

## Detalhes técnicos (para referência)

- Editar `src/components/print-slides.tsx` para renderizar dois `.slide-page` dentro do mesmo `<section className="print-slides">`, cada um com `page-break-after: always`.
- Criar componente interno `OwnerPersuasionPage` no mesmo arquivo, recebendo `study`, `sorted`, `branding`.
- Cálculos auxiliares (gap %, posição no percentil, contagem de comparáveis abaixo do preço, top 5 mais baratos, DOM médio) ficam em helpers locais — sem mexer em `study-engine.ts` nem em tipos.
- Quando `study.aiAnalysis` estiver presente, usar `discursoProprietario`, `argumentosChave` e `riscos`. Quando não estiver, gerar texto determinístico a partir de `stats` e `comparaveis` — nada de chamada nova de IA no momento da impressão.
- Ajustes em `src/styles.css` apenas para os novos blocos da página 2 (tipografia, faixas, tabela compacta), reaproveitando as CSS vars `--acm-brand` / `--acm-accent` já injetadas.

## Fora do escopo

- Não altera busca, scoring ou cálculo do ACM.
- Não cria nova chamada de IA nem novo endpoint.
- Não mexe na visualização normal do relatório na tela (só no modo slide/PDF).
