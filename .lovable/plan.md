## Objetivo

Deixar a seção "Ajustar estudo (avançado)" sempre visível no relatório, sem precisar clicar para expandir.

## Mudança

**Arquivo:** `src/routes/app.relatorio.$id.tsx` (linhas 604–634)

Substituir o `Accordion` por uma seção estática:
- Remover `<Accordion>`, `<AccordionItem>`, `<AccordionTrigger>`, `<AccordionContent>`.
- Manter o cabeçalho (ícone + "Ajustar estudo (avançado)" + subtítulo) como um header simples dentro de um `Card`/`div` com a mesma borda/estilo.
- Renderizar o conteúdo (`AcmPanel`, `CriteriosEditor`, `ComparaveisManager`) diretamente abaixo, sempre expandido.
- Manter `className="print:hidden"` para não aparecer no PDF.
- Remover imports de Accordion se não forem usados em outro lugar do arquivo.

## Fora de escopo

Nenhuma mudança de lógica, PDF ou nos painéis internos.