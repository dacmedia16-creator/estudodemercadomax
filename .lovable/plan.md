## Diagnóstico

O carrossel de fotos já está implementado e plugado em `src/routes/app.relatorio.$id.tsx`. O que você está vendo é um estudo antigo (gerado antes da feature), onde os comparáveis foram salvos só com `imagem` (foto única) e o array `imagens` vazio. Por isso o card mostra uma imagem só, sem setas.

## Plano

Validar que **estudos novos** já vão renderizar o carrossel corretamente, sem mexer em estudos antigos.

1. Gerar um estudo novo de teste (ex.: o mesmo apartamento do Cannes Campolim) e abrir o relatório.
2. Confirmar nos cards de "Concorrentes diretos":
   - Setas prev/next visíveis quando há mais de 1 foto.
   - Bullets e contador "n/total".
   - Fallback para foto única quando o anúncio realmente só tem uma imagem.
3. Se algum portal (Zap / Chaves na Mão / OLX) estiver retornando apenas 1 imagem mesmo quando o anúncio tem várias, ajustar o coletor correspondente em `src/lib/gecko-adapter.ts` (`collectZapImages` / `collectChavesImages` / `collectOlxImages`) para varrer mais campos do payload (galeria, mídias, anexos).
4. Garantir que o `onError` do `PropertyPhotosCarousel` continua removendo URLs quebradas sem deixar o card vazio.

Nenhuma mudança em estudos antigos, nenhum backfill, nenhuma alteração de UI fora dos cards de comparáveis.

## Detalhes técnicos

- Arquivos potencialmente tocados: `src/lib/gecko-adapter.ts` (apenas os 3 coletores de imagens, se o teste mostrar payload subaproveitado) e `src/components/property-photos-carousel.tsx` (apenas se aparecer bug visual).
- Sem mudanças no runner, no engine, no ACM, na IA ou no PDF.
- Sem migrações, sem novas dependências.
