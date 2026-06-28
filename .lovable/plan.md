## Diagnóstico

Hoje as páginas **"Argumentos para o Proprietário"** e **"Carta ao Proprietário"** vivem dentro de `PrintSlides`, que o CSS `@media print` só exibe quando `<html>` tem a classe `print-mode-slides` (acionada pelo botão **"Exportar ACM"**). No botão **"Exportar PDF"** (one-pager A4) apenas `.print-onepager` é impresso, então as 2 páginas novas ficam invisíveis — é o que o usuário está vendo.

## Mudanças

### 1. `src/components/print-slides.tsx`
- Extrair os componentes `OwnerPersuasionPage` e `OwnerLetterPage` para export nomeado e criar um wrapper novo:

  ```tsx
  export function PrintOwnerPages({ study, sorted }: { ... }) {
    const acm = computeAcm(study, study.acm ?? DEFAULT_ACM);
    const branding = brandingStore.get();
    const data = new Date(study.createdAt).toLocaleDateString("pt-BR");
    const styleVars = { "--acm-brand": branding.brandColor, "--acm-accent": branding.accentColor } as React.CSSProperties;
    return (
      <section className="print-owner-pages" style={styleVars}>
        <OwnerPersuasionPage ... />
        <OwnerLetterPage ... />
      </section>
    );
  }
  ```
- Em `PrintSlides`, manter as 2 páginas extras quando `variant !== "screen"` (modo ACM continua com as 3 páginas como hoje) — sem mudança de comportamento atual.

### 2. `src/routes/app.relatorio.$id.tsx`
- Renderizar `<PrintOwnerPages study={study} sorted={sorted} />` logo após `<PrintOnePager />` para que entre no fluxo do botão "Exportar PDF".
- Não duplicar quando o usuário usa "Exportar ACM": o CSS abaixo esconde `.print-owner-pages` no modo slides (as páginas já vêm dentro de `PrintSlides`).

### 3. `src/styles.css`
- Esconder o novo wrapper na tela e no modo ACM, e mostrá-lo no PDF padrão:

  ```css
  @media screen { .print-owner-pages { display: none !important; } }

  @media print {
    .print-owner-pages { display: block; }
    /* No modo ACM, as 2 páginas já vêm dentro de .print-slides — evitar duplicar */
    html.print-mode-slides .print-owner-pages { display: none !important; }

    /* Cada slide-page no modo padrão também vira página A4 paisagem */
    @page owner { size: A4 landscape; margin: 0; }
    .print-owner-pages .slide-page {
      page: owner;
      page-break-before: always;
      break-before: page;
      width: 297mm; height: 210mm;
      overflow: hidden;
    }
  }
  ```
- Os estilos visuais das páginas (`.owner-tese`, `.owner-grid`, `.letter-*`, etc.) já são definidos em `.print-slides ...`. Adicionar seletores irmãos para que também valham em `.print-owner-pages` — duplicar a lista com `, .print-owner-pages ...` em cada regra ou refatorar para um seletor combinado `:is(.print-slides, .print-owner-pages)`.

### Resultado
- Botão **"Exportar PDF"**: gera o one-pager A4 (retrato) seguido das 2 páginas "Argumentos" e "Carta" em A4 paisagem.
- Botão **"Exportar ACM"**: continua gerando as 3 páginas via `PrintSlides` como hoje (sem duplicação).
- Tela do relatório: continua mostrando apenas o slide ACM principal (pré-visualização), sem as páginas extras.
