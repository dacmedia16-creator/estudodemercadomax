## Objetivo

Tornar o PDF entregue ao proprietário mais simples, completo e visualmente melhor. Escopo apenas nas páginas de impressão (`src/components/print-slides.tsx` + estilos em `src/styles.css`), sem mexer na lógica de cálculo.

## 1. Reordenação das páginas

Ordem atual do PDF (`PrintOwnerPages`):
```text
Capa → ACM técnica → Argumentos → Carta ao Proprietário → Contracapa
```
Nova ordem:
```text
Capa → Carta ao Proprietário → Argumentos → ACM técnica (anexo) → Contracapa
```
Alteração em `PrintOwnerPages` (ordem dos componentes) e no cabeçalho da ACM: adicionar rótulo **"Anexo técnico"** para deixar claro que é material de apoio.

Também renumerar o rodapé "página X" para refletir a nova ordem.

## 2. Simplificar linguagem (remover jargão)

Substituições em todas as páginas do PDF:

| Termo técnico atual | Substituir por |
|---|---|
| ACM / Análise Comparativa de Mercado | "Estudo de Preço de Mercado" (mantém "ACM" só no anexo, com nota "sigla técnica do setor") |
| P10 / P25 / P75 / P90 | "10% mais baratos", "25% mais baratos", "25% mais caros", "10% mais caros" |
| Mediana | "preço do meio da faixa" (com mediana entre parênteses no anexo) |
| R$/m² | "preço por metro quadrado" no corpo do texto; "R$/m²" só em tabelas |
| Percentil / posição percentil | "posição na faixa de preços" |
| Faixa de confiança | "margem de segurança da estimativa" |
| Valor Máximo de Publicação | "Preço máximo para anunciar" |
| Valor Mínimo de Fechamento / Entrada | "Preço para vender rápido" |
| Valor Sugerido | "Preço recomendado para anunciar" |
| Fatores ACM (Localização/Conservação/Idade/Padrão) | Manter só no anexo, com legenda explicando "100% = neutro, acima aumenta valor, abaixo reduz" |
| Multiplicador combinado | Remover do resumo; deixar só na tabela do anexo |
| Desconto de reforma | "Ajuste para custos de reforma" |

Textos de bullets já existentes nas páginas "Argumentos" e "Carta" recebem passada de revisão para tirar termos como "penalizam anúncios fora da curva", "portais penalizam", "ranking de busca" → linguagem cotidiana.

## 3. Reformular página ACM (anexo)

Reduzir densidade da tabela técnica atual:

- Renomear cabeçalho para **"Anexo — Como chegamos ao preço recomendado"**.
- Adicionar bloco introdutório de 2–3 linhas em linguagem simples explicando o método ("comparamos seu imóvel com X anunciados hoje na região; aplicamos ajustes de localização, conservação, idade e padrão; consideramos custos de reforma").
- Manter a tabela de comparáveis (é útil), mas:
  - Substituir cabeçalhos em CAIXA ALTA técnica por rótulos amigáveis ("Área", "Dormitórios", "Suítes", "Vagas", "Condomínio", "Preço", "Preço por m²").
  - Ocultar URLs longas; mostrar título + portal, com URL só quando não houver título.
- Substituir bloco "Resumo — Avaliação para Venda" por versão simplificada:
  - Uma coluna à esquerda com 3 caixas: **Preço para vender rápido**, **Preço recomendado**, **Preço máximo para anunciar** — cada uma com uma frase curta abaixo explicando quando usar.
  - Coluna à direita mostrando a "conta" resumida: preço médio do m² × área × ajustes = preço recomendado (uma linha por passo, com valores).
- Rodapé de fatores (Localização/Conservação/Idade/Padrão) ganha legenda de 1 linha explicando o que cada % significa.

## 4. Melhorias visuais (tipografia, espaçamento, hierarquia)

Em `src/styles.css`, dentro dos blocos `@media print` e `.print-slides`:

- **Hierarquia tipográfica**: aumentar contraste entre título de página (`.acm-title`), títulos de bloco (`.owner-block-title`, `.owner-letter-box-title`) e corpo. Adicionar rastreio de letras (letter-spacing) em títulos, peso 700; corpo em 400/500 com leading generoso.
- **Espaçamento**: aumentar margens internas das páginas `.slide-page` (padding), aumentar gap entre blocos `.owner-grid`, `.owner-letter-cards`. Evitar que tudo pareça "colado".
- **Cor**: manter identidade da marca (`--acm-brand`, `--acm-accent`), mas suavizar contornos de tabela (border cinza claro em vez de preto), reduzir uso de fundos amarelos fortes no resumo — usar cor da marca com opacidade baixa.
- **Cards de preço**: destacar `Preço recomendado` como o card principal (maior, com borda de cor da marca), pretendido e diferença secundários.
- **Callouts**: caixa de "toneLabel" da Carta ao Proprietário ganha ícone semântico (check / alerta) e cor mais suave.
- **Rodapé**: padronizar `.acm-page-meta` com número de página coerente após a reordenação.

## 5. Fora do escopo

- Nada de novos dados de contato do corretor (usuário optou por manter só o nome da marca).
- Não alterar `study-engine`, `study-types` ou lógica de cálculo.
- Não mexer no modo Slides 16:9 (`.print-slides-screen` / `print-mode-slides`) — só nas páginas que entram no PDF padrão (`PrintOwnerPages`).
- Não mexer no `PrintOnePager`.

## Arquivos afetados

- `src/components/print-slides.tsx` — reordenação, novos textos, remontagem da página ACM.
- `src/styles.css` — ajustes de tipografia, espaçamento, cores de impressão.
