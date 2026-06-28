## Objetivo
As páginas **"Argumentos para o Proprietário"** e **"Carta ao Proprietário"** estão aparecendo na pré-visualização do slide ACM dentro da tela do relatório. Elas devem existir **apenas no PDF exportado** (botões "Exportar PDF" / "Exportar slide ACM"), mantendo a tela do relatório com apenas o slide ACM principal (página 1).

## Mudanças

### `src/components/print-slides.tsx`
- Manter a **Página 1 (ACM)** renderizando em ambos os modos (`screen` e `print`), como hoje.
- Renderizar as **Páginas 2 (Argumentos) e 3 (Carta)** somente quando `variant !== "screen"` — ou seja, somente quando o componente é montado para impressão/PDF.
- Sem alterações de conteúdo, layout, dados, IA ou estilos dessas páginas — apenas condicional de visibilidade.

### Sem outras alterações
- Tela do relatório (`app.relatorio.$id.tsx`): nenhuma mudança. O preview on-screen passa a mostrar só o slide ACM principal.
- Exportação PDF (`?auto=slides` e botão "Exportar slide ACM"): continua usando `PrintSlides` sem `variant="screen"`, então gera as 3 páginas normalmente.
- Estilos em `src/styles.css`: inalterados.

## Resultado
- **Na tela** do relatório: aparece somente o slide ACM (página 1).
- **No PDF** (modo slides 16:9): aparecem as 3 páginas — ACM, Argumentos para o Proprietário e Carta ao Proprietário.