# Remover páginas 2 e 5 do PDF

O PDF exportado hoje tem 5 páginas em ordem:

1. **One-Pager A4** (`PrintOnePager` — capa executiva com valor recomendado)
2. **Capa/Cover** (`CoverPage`) ← remover
3. **Carta ao Proprietário** (`OwnerLetterPage`)
4. **Argumentos para o Proprietário** (`OwnerPersuasionPage`)
5. **Contracapa/BackCover** (`BackCoverPage`) ← remover

## Alteração

Em `src/components/print-slides.tsx`, dentro de `PrintOwnerPages`, remover as linhas que renderizam `<CoverPage .../>` e `<BackCoverPage .../>`. Manter apenas a Carta e a página de Argumentos.

Após a mudança, o PDF fica com 3 páginas: One-Pager → Carta → Argumentos.

## Fora de escopo

- Não apagar os componentes `CoverPage`/`BackCoverPage` do arquivo (ficam disponíveis caso queira reativar no futuro; se preferir remoção completa dos componentes também, avise).
- `PrintSlides` (apresentação 16:9) não é usado no PDF padrão — não é afetado.

## Verificação

Abrir o relatório e usar "Exportar PDF" → confirmar que agora sai com One-Pager, Carta e Argumentos apenas (sem capa nem contracapa).
