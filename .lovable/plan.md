# Por que o layout ficou assim

Na rota `src/routes/app.relatorio.$id.tsx` os componentes `PrintOnePager` e `PrintSlides` são montados sempre no DOM, sem nenhuma classe que os esconda em tela:

```tsx
<PrintOnePager study={study} sorted={sorted} />
<PrintSlides study={study} sorted={sorted} />

<div className="... print-hide-on-print"> {/* relatório normal */} </div>
```

Todo o CSS deles (`.print-onepager`, `.print-slides`, `.slide-page`, etc.) vive dentro de `@media print` em `src/styles.css`. Logo, na tela esses elementos aparecem como texto puro empilhado — é o que você está vendo ("Slide 2 / Imóvel analisado / Tipo / Apartamento ..."). Provavelmente algo quebrou a regra anterior que mantinha esses blocos ocultos (ou a regra nunca existiu).

# Correção

1. Em `src/styles.css`, adicionar regra **fora** do `@media print`:
   ```css
   .print-onepager, .print-slides { display: none; }
   ```
   Dentro de `@media print` continuam as regras que mostram um deles conforme o modo (`print-mode-slides` mostra slides e esconde onepager; padrão mostra onepager).

2. Garantir que `.print-hide-on-print` continue só escondendo o conteúdo normal durante a impressão (não mexer).

3. Verificar visualmente:
   - Tela `/app/relatorio/:id`: só o relatório interativo aparece (sem o texto cru de slides/onepager).
   - "Exportar PDF": gera o one-pager A4.
   - "Apresentação para proprietário": adiciona `print-mode-slides` no `<html>`, abre print, gera os slides 16:9.
   - Após imprimir, remover a classe `print-mode-slides` (já é feito hoje) para a tela voltar ao normal.

# Arquivo afetado

- `src/styles.css` (apenas adicionar 1 regra base).

Nada de lógica de negócio muda; é só correção de visibilidade na tela.
