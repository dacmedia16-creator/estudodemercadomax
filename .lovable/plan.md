## Objetivo
Adicionar um **modo apresentação em PDF (slides 16:9)** no relatório `/app/relatorio/:id`, para o corretor imprimir/salvar e apresentar ao proprietário. Mantém a identidade verde do Radar Imobiliário Pro.

## Entregáveis
Botão **"Apresentação para o proprietário"** no cabeçalho do relatório, ao lado do "Exportar PDF" atual. Ao clicar, ativa uma classe `print-mode-slides` no `<html>` e dispara `window.print()`. Cada slide ocupa exatamente uma página 16:9 (297mm × 167mm landscape).

### Slides (uma página cada)
1. **Capa** — logo, "Estudo de Mercado", endereço/edifício, cidade, data, nome do corretor (de Settings).
2. **Imóvel analisado** — dados-chave em grid (tipo, área, quartos, suítes, vagas, andar, condomínio/IPTU, diferenciais) + foto/placeholder.
3. **Valor recomendado (hero)** — número gigante centralizado, com mín. fechamento e máx. publicação ao lado, R$/m² médio, status vs. pretendido.
4. **Análise ACM** — 4 fatores (localização, conservação, idade, padrão) com barras horizontais, multiplicador combinado, custo de reforma e valor avaliado do m².
5. **Comparáveis de mercado** — tabela com top 6 (endereço · m² · quartos · preço · R$/m² · portal) + mini-funil de busca (total amostrado / similaridade média / portais).
6. **Próximos passos** — pontos fortes vs. atenção lado a lado, sugestão comercial em destaque, rodapé com contato do corretor.

## Mudanças técnicas

1. **`src/styles.css`** — novo bloco `@media print` ativo somente quando `<html class="print-mode-slides">`:
   - `@page { size: 297mm 167mm; margin: 0 }` (16:9 landscape paisagem).
   - Cada `.slide-page` = `width:297mm; height:167mm; page-break-after: always; padding: 14mm 16mm;`.
   - Esconde o conteúdo de tela e o one-pager A4 atual (`.print-onepager`, `.print-hide-on-print` continuam para o modo A4).
   - Tipografia maior: títulos 28–40pt, valor hero 64pt, corpo 11pt.

2. **Novo `src/components/print-slides.tsx`** — componente único `<PrintSlides study={...} />` renderizado com `hidden` por padrão e visível apenas em `@media print` quando classe `print-mode-slides` está ativa. Renderiza os 6 slides listados acima reaproveitando `computeAcm`, `formatBRL` e os arrays já existentes em `StudyResult`.

3. **`src/routes/app.relatorio.$id.tsx`** — adicionar:
   - Botão "Apresentação para o proprietário" (ícone `Presentation` do lucide).
   - Handler que faz: `document.documentElement.classList.add("print-mode-slides"); window.print();` e remove a classe no `afterprint`.
   - Inclui `<PrintSlides study={study} />` ao lado do `<PrintOnePager />` atual. A classe controla qual dos dois aparece na impressão.

4. **Sem novas dependências** — usa `window.print()` nativo, mesma estratégia do A4 atual.

## Fora do escopo
- Não alterar busca, cálculos ACM, dados ou layout da tela.
- Não criar rota nova nem `.pptx`.
- Não tocar no one-pager A4 existente; ele continua disponível pelo botão "Exportar PDF".

## Validação
Abrir `/app/relatorio/:id` → clicar **"Apresentação para o proprietário"** → no diálogo de impressão escolher "Salvar como PDF" → conferir 6 páginas 16:9, valor recomendado em destaque na pág. 3, tabela de comparáveis cabendo na pág. 5.
