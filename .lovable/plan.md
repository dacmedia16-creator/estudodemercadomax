## Objetivo
Trocar a apresentação atual de 6 slides por uma **única página A4 paisagem estilo planilha ACM** (igual ao layout VIP7 anexado), com logo e cor da marca configuráveis pelo usuário.

## Estrutura da nova página (PrintSlides reescrito)

```text
┌───────────────────────────────────────────────────────────────────┐
│ [LOGO]                            Análise Comparativa de Mercado  │
├───────────────────────────────────────────────────────────────────┤ ← faixa cinza
│ IMÓVEIS SIMILARES │ M² │ Dorm │ Suítes │ Vagas │ Cond │ Venda │ R$/m² │
│ 1. link/título ...                                                 │
│ 2. ...  (até 10 linhas)                                            │
├───────────────────────────────────────────────────────────────────┤
│ DEFINIÇÃO DO IMÓVEL │ M² │ Dorms │ Suítes │ Vagas │ Cond │ R$/m² │ Andar │
│ 1. [edificio/tipo]   225  3      3        4       —     —       0     │
├──────────────────────────────┬────────────────────────────────────┤
│ Valor do m² p/ Reforma       │ RESUMO — AVALIAÇÃO PARA VENDA      │
│ R$ 0,00                      │ Média do m²            R$ 7.526    │
│ Nº de Imóveis Similares      │ % do imóvel            100%        │
│ 10                           │ Valor avaliado p/ m²   7.526       │
│                              │ Valor de Reforma       R$ —        │
│                              │ ★ VALOR SUGERIDO  R$ 1.693.353 ★   │ ← faixa amarela
│                              │ Valor Máx. Publicação  R$ 1.778.020│ ← faixa verde
├──────────────────────────────┴────────────────────────────────────┤
│ Reforma estética/estrutural │ Local │ Conservação │ Idade │ Padrão │
│ legenda                     │ 100%  │   100%      │ 100%  │  100%  │
└───────────────────────────────────────────────────────────────────┘
```

## Mudanças

### 1. `src/lib/study-types.ts` — `BrandingSettings`
Adicionar tipo persistido em localStorage:
```ts
type BrandingSettings = {
  logoUrl?: string;        // dataURL ou /__l5e/assets-v1/...
  brandName: string;       // "Radar Imobiliário Pro" (default) ou "VIP7 Imóveis" etc.
  brandColor: string;      // hex, default "#15803d" (verde Radar)
  accentColor: string;     // hex secundário (dourado/cinza), default "#b45309"
};
```

### 2. `src/routes/app.configuracoes.tsx`
Nova seção **"Marca do relatório"**:
- Upload de logo (input file → base64 dataURL, max 300KB) com preview.
- Campos: nome da marca, color picker para cor primária e secundária.
- Botões: salvar / restaurar padrão.
- Persiste em `localStorage` via `brandingStore` (novo helper em `src/lib/branding-store.ts`).

### 3. `src/components/print-slides.tsx` — **reescrita completa**
Remove a estrutura de 6 slides. Vira **uma única `.slide-page` A4 landscape** com a tabela ACM acima:
- Lê branding via `brandingStore.get()`.
- Cabeçalho com `<img src={branding.logoUrl}>` à esquerda (placeholder estilizado se ausente) e título "Análise Comparativa de Mercado" à direita.
- Tabela "Imóveis Similares": até 10 linhas com link clicável (URL truncada), m², dorms, suítes, vagas, condomínio, valor de venda, R$/m². Usa `study.comparaveis` ordenados por similaridade.
- Linha "Definição do imóvel" puxando dados de `study.input` + nome do edifício.
- Bloco "Resumo — Avaliação para Venda": média, % do imóvel (valorPretendido / acm.valorSugerido), valor avaliado/m², valor de reforma (`acm.descontoReforma`), **valor sugerido em destaque amarelo** (cor exata do screenshot), valor máximo publicação em **verde**.
- Rodapé com legenda de reforma (R$ 200–500 estética, R$ 1000–2000 estrutural) e linha de fatores ACM (Localização/Conservação/Idade/Padrão).
- Cores derivam de `branding.brandColor` (faixas, bordas) e `accentColor` (logo/cabeçalho).

### 4. `src/styles.css`
Substituir todos os estilos `.slide-page`, `.sl-cover`, `.sl-grid-*`, `.sl-table`, `.sl-pill`, `.sl-hero-*`, `.sl-footer` etc. por um conjunto novo prefixado `.acm-*`:
- `.acm-page` (210mm × 297mm rotacionado = A4 landscape, `@page { size: A4 landscape }`)
- `.acm-table`, `.acm-row-header`, `.acm-cell`, `.acm-link`
- `.acm-summary`, `.acm-highlight-yellow`, `.acm-highlight-green`
- `.acm-logo`, `.acm-title`
Manter o gating `html.print-mode-slides .print-slides { display: block }` já existente.

### 5. `src/routes/app.relatorio.$id.tsx`
- Botão "Apresentação 16:9" passa a chamar-se **"Exportar ACM (1 página)"**.
- Nenhuma outra mudança de fluxo.

## Fora do escopo
- Não mexer no `PrintOnePager` (continua sendo o dashboard A4 do corretor).
- Não alterar engine de busca, ACM ou comparáveis.
- Sem persistência da branding no Cloud — só localStorage (suficiente pois é por navegador/usuário).
