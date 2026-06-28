## Objetivo
Mostrar o slide ACM (mesmo layout do PDF/apresentação) também na tela, no final do relatório de estudo.

## Mudanças

**`src/styles.css`**
- O bloco `.print-slides` hoje está dentro de `@media print` e fica oculto fora da impressão. Mover/duplicar os estilos visuais (tabelas ACM, header, stripe, resumo, footer) para fora do `@media print` para que o layout funcione também na tela.
- Adicionar uma variante `.print-slides.print-slides-screen` com:
  - `display: block` sempre (sem depender de `html.print-mode-slides`).
  - largura máxima ~ 1100px, `margin: 0 auto`, sombra leve e borda arredondada para parecer uma "folha" embutida no relatório.
  - permitir rolagem horizontal em telas estreitas (`overflow-x: auto`).
- Manter o comportamento atual de impressão intacto: durante `@media print` continua escondido a menos que `html.print-mode-slides` esteja ativo (a versão de tela ganha `print:hidden` via classe utilitária).

**`src/components/print-slides.tsx`**
- Aceitar uma prop opcional `variant?: "print" | "screen"` (default `"print"`).
- Quando `variant === "screen"`, adicionar a classe `print-slides-screen` à `<section>` raiz e marcar com `print:hidden` para não duplicar na impressão.
- Nenhuma mudança no conteúdo/markup interno.

**`src/routes/app.relatorio.$id.tsx`**
- No final da página do relatório (logo após o último bloco existente, antes do fechamento do container), renderizar:
  - Um título curto: "Slide ACM — Análise Comparativa de Mercado" + subtítulo "Pré-visualização do material exportado".
  - `<PrintSlides study={study} sorted={sorted} variant="screen" />` envolvido por um wrapper com padding.
- Reaproveitar `sorted` que já existe no componente para alimentar o slide.

## Fora do escopo
- Não alterar a lógica de exportação PDF, branding, nem o conteúdo do slide.
- Não tocar em outras rotas (exemplo, estudos, etc.).
