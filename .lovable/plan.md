## Objetivo
Adicionar uma **terceira página** ao PDF (modo ACM/slides) — uma "Carta ao Proprietário" — com layout limpo, linguagem acessível (sem jargão de corretor) e foco em convencer o dono do imóvel a ajustar o preço.

Hoje o PDF tem 2 páginas:
1. ACM (dashboard técnico) — para o corretor
2. "Argumentos para o Proprietário" — material de apoio para a conversa do corretor

Falta uma página feita **para entregar na mão do proprietário**, em tom direto e claro.

## O que muda
Arquivo único: `src/components/print-slides.tsx` (+ estilos em `src/styles.css`).

Adicionar componente `OwnerLetterPage` renderizado após `OwnerPersuasionPage` dentro do mesmo `<section className="print-slides">`. Aparece tanto na pré-visualização em tela quanto no PDF impresso (mesma regra das outras páginas).

## Estrutura da página (A4 paisagem, igual às outras)

```text
┌─────────────────────────────────────────────────────────────────┐
│ [Logo] ESTUDO DE MERCADO PRO          Carta ao Proprietário     │
│ ─── faixa colorida ───                                          │
│                                                                 │
│ Olá, {nome}! Preparei este estudo do seu imóvel em              │
│ {bairro, cidade}. Resumo em 1 minuto:                           │
│                                                                 │
│ ┌──────────────────┐  ┌──────────────────┐ ┌──────────────────┐ │
│ │ SEU PREÇO HOJE   │  │ PREÇO IDEAL      │ │ DIFERENÇA        │ │
│ │ R$ 1.180.000     │→ │ R$ 1.121.951     │ │ - R$ 58.049 (5%) │ │
│ └──────────────────┘  └──────────────────┘ └──────────────────┘ │
│                                                                 │
│ ┌─ O QUE O MERCADO ESTÁ DIZENDO ──────────────────────────────┐ │
│ │ • Analisamos 9 imóveis parecidos com o seu na região        │ │
│ │ • 6 deles estão anunciados por menos que o seu preço atual  │ │
│ │ • O concorrente mais barato pede R$ 1.099.950               │ │
│ │ • O preço médio por m² da região é R$ 11.771                │ │
│ │ • O seu, no preço atual, fica R$ 12.041/m² (acima da média) │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ POR QUE AJUSTAR AGORA VALE A PENA ─────────────────────────┐ │
│ │ ✓ Mais visitas: anúncios no preço certo aparecem 1º no Zap  │ │
│ │ ✓ Vende mais rápido (média de X dias menor*)                │ │
│ │ ✓ Evita "queima" do anúncio — quem fica meses parado        │ │
│ │   acaba aceitando descontos maiores depois                  │ │
│ │ ✓ Compradores comparam: se o seu está acima, nem visitam    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ FAIXA QUE RECOMENDAMOS PUBLICAR ───────────────────────────┐ │
│ │   R$ 1.099.000   ←   R$ 1.121.951   →   R$ 1.178.049        │ │
│ │   vende rápido      ideal               teto p/ negociar    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Próximo passo: vamos conversar e definir juntos o melhor       │
│ valor de publicação. — {corretor / brandName}                  │
│                                                                 │
│ Estudo {id} · {data}                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Conteúdo dinâmico (sem nada inventado)
Tudo derivado de campos que **já existem** no estudo — sem novas chamadas de API, sem mexer em runner/engine:
- `input.proprietario` (se existir) ou saudação genérica "Olá!"
- `input.bairro`, `input.cidade`
- `input.valorPretendido` vs `acm.valorSugerido` → diferença R$ e %
- `study.comparaveis.length`, contagem `abaixo do preço pretendido`, menor preço
- `study.precoM2Medio`, R$/m² pretendido
- `study.aiAnalysis?.argumentosChave` quando disponível, **reescritos em tom de proprietário** (frases curtas, sem "anúncios penalizados em ranking de portal"); fallback determinístico próprio (separado do `buildFallbackArgs` técnico).
- Faixa: `aiAnalysis.faixaRecomendada` ou derivada de `stats` (P25/median/P75), igual à página 2.
- Assinatura usa `branding.brandName`.

## Tom e linguagem
- Frases curtas, 2ª pessoa ("seu imóvel", "você"), sem termos como "percentil", "P90", "ranking PLP", "ACM".
- Números sempre formatados em R$ (reutiliza `formatBRL`).
- Sem tabela de concorrentes com links (essa fica na página 2 para o corretor). O proprietário vê **resumo agregado**, não lista de URLs.
- Status colorido suave (verde "dentro do mercado" / amarelo "vale ajustar" / vermelho "muito acima").

## Estilos
Adicionar em `src/styles.css` (fora de `@media print`, igual `.acm-page` e `.owner-page`):
- `.owner-letter-page` — variações da página atual: blocos com bordas arredondadas mais suaves, tipografia maior, mais respiro.
- Cartões de preço grandes (estilo da página 1) com setas.
- Listas com check (✓) verde para benefícios.
- Faixa de publicação como barra horizontal com 3 marcadores.

## Não muda
- Página 1 (ACM dashboard) intacta.
- Página 2 (argumentos para o corretor) intacta.
- Nenhuma alteração em `study-engine.ts`, `study-runner.ts`, `ai-analysis.functions.ts`, dados, rotas ou store.

## Arquivos editados
- `src/components/print-slides.tsx` — novo `OwnerLetterPage` + render dentro do `<section>`.
- `src/styles.css` — novas classes `.owner-letter-*`.
