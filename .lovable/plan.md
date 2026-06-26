## Problema

Hoje o "Exportar PDF" só chama `window.print()` na página do relatório, sem nenhum CSS de impressão. Resultado: sidebar, header do app, botões, painel de critérios, painel ACM completo com sliders, controles de ordenação e cards interativos vão todos pro PDF — fica bagunçado, multi-página sem hierarquia, e o valor recomendado de venda some no meio.

## Objetivo

Quando o usuário clicar em **Exportar PDF**, gerar um documento com cara de relatório profissional, com **capa destacando o valor recomendado de venda** e seções organizadas, sem mexer no layout da tela.

## Estrutura do PDF (nova)

```
┌─────────────────────────────────────────┐
│  RADAR IMOBILIÁRIO PRO · Relatório      │  ← cabeçalho fixo (logo + data)
├─────────────────────────────────────────┤
│                                         │
│   [Tipo] em [Bairro, Cidade/UF]         │
│   Apto · 3 dorm · 92 m² · Venda         │
│                                         │
│   ╔═══════════════════════════════════╗ │
│   ║  VALOR RECOMENDADO PARA VENDA     ║ │  ← bloco hero,
│   ║                                   ║ │    fundo primary,
│   ║         R$ 845.000                ║ │    fonte grande,
│   ║                                   ║ │    sempre na 1ª pág
│   ║  Mínimo fechamento  Máx publicação║ │
│   ║   R$ 802.750         R$ 887.250   ║ │
│   ╚═══════════════════════════════════╝ │
│                                         │
│   Status vs. mercado: Dentro da média   │
│   Diagnóstico (parágrafo curto)         │
│                                         │
│ ─── PÁGINA 1 (capa executiva) ─────────│
│                                         │
│   Imóvel analisado (grid 4 col)         │
│   Resumo de mercado (média m², faixa)   │
│                                         │
│ ─── PÁGINA 2 (avaliação ACM) ──────────│
│                                         │
│   Avaliação ACM — só o resumo final     │
│   (média m², ajustes aplicados,         │
│    reforma, sugerido, mín, máx)         │
│   Sem sliders/botões/inputs.            │
│                                         │
│ ─── PÁGINA 3+ (comparáveis) ───────────│
│                                         │
│   Tabela compacta dos comparáveis       │
│   (#, endereço, área, R$, R$/m², sim.)  │
│   Critérios da busca (lista resumida)   │
│                                         │
│ ─── ÚLTIMA PÁGINA (texto comercial) ───│
│                                         │
│   Pontos fortes / atenção               │
│   Título sugerido + descrição           │
│   Argumento para proprietário           │
│                                         │
│   Rodapé: gerado por Radar Imobiliário  │
└─────────────────────────────────────────┘
```

Gráfico Recharts: ocultado no print (não renderiza bem em SVG impresso e polui). A tabela já transmite a informação.

## Como implementar (técnico)

### 1. `src/styles.css` — bloco `@media print`

Adicionar um único bloco `@media print` com:
- `@page { size: A4; margin: 14mm 12mm; }`
- Esconder sidebar do app, header app, todos os botões e qualquer elemento com classe `.no-print`.
- Esconder `CriteriosEditor` inteiro (painel de ajuste de busca — não vai pro PDF).
- Esconder os controles internos do `AcmPanel` (sliders, presets, botões), mantendo só o bloco "Resumo · Avaliação para venda".
- Esconder o gráfico Recharts (`.recharts-responsive-container`).
- Forçar fundo branco, cores sólidas (`-webkit-print-color-adjust: exact`).
- Garantir que cards não quebrem no meio (`break-inside: avoid`).
- Forçar quebras de página entre seções principais com classes utilitárias `.print-break-before`.

### 2. Componente `PrintHero` (novo, dentro do próprio `app.relatorio.$id.tsx`)

Bloco visível **somente no print** (`hidden print:block`) que entra logo após o título:
- Título grande: `{tipo} em {bairro}, {cidade}/{UF}`
- Linha de specs em uma frase (área · dormitórios · vagas · finalidade)
- Caixa hero (border primary, fundo primary/5, padding generoso):
  - Label pequeno: "VALOR RECOMENDADO PARA VENDA"
  - Número gigante: `computeAcm(study, study.acm ?? DEFAULT_ACM).valorSugerido`
  - Duas colunas embaixo: Mínimo de fechamento · Máximo de publicação
- Badge de status (Abaixo/Dentro/Acima da média) + parágrafo do diagnóstico.

Esse hero é a primeira coisa que aparece no PDF — garante que o valor recomendado seja o destaque.

### 3. Marcadores nas seções existentes

Adicionar classes nos containers já existentes (não muda nada visual na tela):
- Bloco "Imóvel analisado" e "Resumo de mercado": `print-section`
- `AcmPanel`: wrap externo com `print-break-before` + classe que aciona o modo compacto no CSS.
- Tabela de comparáveis: `print-break-before print-section`
- Bloco comercial (pontos fortes, descrição, argumento): `print-break-before print-section`

### 4. `AcmPanel` — modo print

Adicionar nos elementos internos:
- `className="print:hidden"` nos sliders, input de reforma, presets, botões salvar/resetar e cabeçalho com botões.
- O bloco "Resumo · Avaliação para venda" permanece visível e ganha `print:mt-0`.

### 5. `CriteriosEditor` e header da página

- `CriteriosEditor`: wrap com `print:hidden`.
- Header com os botões Exportar/Compartilhar/Salvar/Novo estudo: classe `print:hidden`.
- Sidebar e topo do app (em `src/routes/app.tsx`): adicionar `print:hidden` no shell. Verificar primeiro o arquivo; se a sidebar usa um componente compartilhado, aplicar lá.

### 6. Rodapé de impressão

Pequeno bloco `hidden print:block` no fim da página com "Radar Imobiliário Pro · gerado em {data} · revisão {n}".

## Fora de escopo

- Não troca `window.print()` por gerador server-side (jsPDF/pdfmake). Mantém o fluxo atual, só organiza o que o navegador imprime.
- Não mexe na lógica de busca, ACM, ou no layout da tela.
- Exportação XLSX da ACM continua fora desta iteração.

## Arquivos afetados

- `src/styles.css` — bloco `@media print` novo.
- `src/routes/app.relatorio.$id.tsx` — adiciona `PrintHero`, classes `print:hidden` nos botões/painéis interativos, marcadores de seção, rodapé de impressão.
- `src/components/acm-panel.tsx` — `print:hidden` nos controles, manter resumo.
- `src/components/criterios-editor.tsx` — `print:hidden` no wrapper raiz.
- `src/routes/app.tsx` (ou onde estiver a sidebar/topbar do app) — `print:hidden` no shell.

Resultado: PDF com 3–4 páginas limpas, valor recomendado em destaque na capa, sem ruído de UI interativa.
