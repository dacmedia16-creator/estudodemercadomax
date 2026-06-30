# Adicionar carrossel de fotos nos cards de "Concorrentes diretos"

Sim, dá pra fazer — os portais já retornam várias fotos por anúncio (Zap, Chaves na Mão e OLX trazem `images[]` no JSON), mas hoje o adapter só guarda a primeira (`imagem`) e o card mostra uma imagem estática. Vou guardar a lista completa e trocar a `<img>` por um carrossel navegável (setas + bullets), só no card do relatório.

## Mudanças

1. **`src/lib/study-types.ts`**
   - Adicionar campo opcional `imagens?: string[]` em `ComparableProperty` (mantém `imagem` como a capa, para compatibilidade com estudos já salvos).

2. **`src/lib/gecko-adapter.ts`**
   - Nas três funções de normalização (Zap PLP, Chaves PDP, OLX PDP) coletar até ~8 URLs únicas de `item.images[].url` / `webpUrl` / `photos[]` (filtrando duplicadas e vazias).
   - Popular `imagens` no objeto retornado; `imagem` continua sendo a primeira.

3. **`src/components/property-photos-carousel.tsx`** (novo, ~60 linhas)
   - Componente client-side simples: estado `index`, setas prev/next sobrepostas, bullets na base, contador "n/total" no canto. Sem libs novas — só Tailwind + lucide icons já presentes.
   - Fallback: se `imagens` vazio, usa `imagem`; se nada, mostra placeholder atual.
   - `referrerPolicy="no-referrer"`, `loading="lazy"`, `onError` esconde a foto quebrada e avança automaticamente.

4. **`src/routes/app.relatorio.$id.tsx`** (bloco "Concorrentes diretos", linhas ~540-556)
   - Trocar o `<img>` pelo `<PropertyPhotosCarousel images={c.imagens?.length ? c.imagens : (c.imagem ? [c.imagem] : [])} alt={c.titulo} />`.
   - Esconder controles no print (`print:hidden` nas setas/bullets) — no PDF fica só a capa, como hoje.

## Fora de escopo
- Não mexer no `ComparaveisManager` nem no `print-slides` (mantêm capa única).
- Não mexer em IA, ACM, runner ou filtros — é puramente apresentação.
- Estudos antigos sem `imagens` continuam funcionando via fallback para `imagem`.
