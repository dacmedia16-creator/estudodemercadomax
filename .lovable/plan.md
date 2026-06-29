Plano para ajustar a escala/proporção das páginas 2 e 3 do PDF exportado:

1. Separar definitivamente os layouts por modo de exportação
   - Manter o ACM em A4 paisagem apenas no botão “Exportar ACM”.
   - Forçar as páginas 2 e 3 do botão “Exportar PDF” a usarem A4 retrato real: 210mm × 297mm, sem herdar largura de 297mm do ACM.

2. Ajustar a proporção interna das páginas 2 e 3
   - Definir dimensões fixas de página, padding e `box-sizing` para evitar zoom automático do navegador.
   - Reduzir fontes, gaps e paddings específicos das páginas 2/3 em modo retrato.
   - Trocar grids largos por composições que cabem em retrato sem esmagar ou cortar conteúdo.

3. Evitar páginas extras e quebras incorretas
   - Corrigir `page-break`/`break-before` para cada página começar em folha nova.
   - Garantir que o conteúdo não estoure a altura A4 e não gere continuação indesejada.
   - Revisar a regra global que força `break-inside: avoid`, pois ela pode fazer o navegador criar páginas vazias ou escalar errado.

4. Preservar o layout ACM
   - Confirmar que o botão “Exportar ACM” continua gerando a folha paisagem com proporção 297mm × 210mm.
   - Evitar duplicação das páginas “Argumentos” e “Carta” no modo ACM.

5. Validação
   - Gerar/abrir a impressão no navegador com o relatório atual.
   - Verificar visualmente que:
     - página 1 fica A4 retrato;
     - página 2 fica A4 retrato preenchida corretamente;
     - página 3 fica A4 retrato preenchida corretamente;
     - ACM continua paisagem quando usado pelo botão próprio.