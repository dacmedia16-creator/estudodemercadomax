# Melhorar layout do PDF — One-pager A4 (executivo RE/MAX)

Refinar **somente** o one-pager A4 do "Exportar PDF" (`PrintOnePager` em `src/routes/app.relatorio.$id.tsx` + estilos `.print-onepager` em `src/styles.css`). As páginas "Argumentos" e "Carta ao Proprietário" e o slide ACM ficam inalterados.

## Direção visual
Executivo RE/MAX: azul institucional (`--primary` #003DA5) como cor de comando, branco como base, cinza-grafite para texto, vermelho (#DC1C2E) só como acento pontual. Tipografia mais firme, mais ar entre blocos, números com tabular-nums, divisores finos em vez de caixas pesadas.

## Mudanças no layout (uma folha A4 retrato)

```text
┌──────────────────────────────────────────────────────────┐
│ ▎ logo/Marca RE/MAX        Estudo de Mercado · #ID · data│  faixa azul fina topo
├──────────────────────────────────────────────────────────┤
│ Apartamento · Bairro, Cidade/UF                          │  título + sub
│ 140 m² · 3 dorm (2 ste) · 2 vagas · Venda                │
├──────────────────────────────────────────────────────────┤
│ ╔══════════════════════ HERO ═══════════════════════════╗│
│ ║ VALOR RECOMENDADO PARA VENDA                          ║│  faixa azul cheia
│ ║ R$ 1.250.000        ── faixa: 1.180k ─ 1.290k         ║│  valor 32pt branco
│ ║ Mín. fechamento  •  Ideal  •  Máx. publicação         ║│  3 pills
│ ╚════════════════════════════════════════════════════════╝│
├─────────────┬─────────────┬──────────────────────────────┤
│ PRETENDIDO  │ MERCADO     │ DIAGNÓSTICO                  │  KPIs em 3 col
│ R$ X        │ Médio R$ Y  │ texto curto + status pill    │
│ R$/m² Z     │ Faixa A–B   │                              │
├──────────────────────────────────────────────────────────┤
│ TOP 6 COMPARÁVEIS                          [zebra rows]  │
│ Portal  Endereço/título   m²  Qtos  Preço  R$/m²  Sim.   │
│ …                                                        │
├─────────────────────────────┬────────────────────────────┤
│ ✓ Pontos fortes             │ ! Pontos de atenção        │
├──────────────────────────────────────────────────────────┤
│ SUGESTÃO COMERCIAL — título + argumento (1 bloco limpo)  │
├──────────────────────────────────────────────────────────┤
│ rodapé fino: marca · estudo #ID · gerado em …            │
└──────────────────────────────────────────────────────────┘
```

### Decisões específicas
- **Faixa de marca no topo** (4mm azul) com logo RE/MAX, título do produto e ID/data alinhados à direita — substitui o cabeçalho atual desbalanceado.
- **Hero do valor recomendado**: bloco de fundo azul sólido (`--primary`), valor em 30–32pt branco, com 3 pills internos (Mínimo · Ideal · Máximo) em vez do layout atual lateral. Faz o número saltar imediatamente.
- **KPIs em 3 colunas iguais** com divisores verticais finos (sem boxes), rótulos uppercase 7pt cinza, valores 11pt grafite — mais "executivo", menos "card".
- **Tabela de comparáveis**: cabeçalho com fundo cinza-claro #F5F7FA, linhas zebradas sutis, coluna Sim. com barra mini (largura = similaridade%), badges "Mesmo prédio/endereço" em azul quando aplicável; Preço em negrito grafite e R$/m² alinhado tabular.
- **Fortes / Atenção** lado a lado com ícone único de cabeçalho (✓ verde, ! âmbar), bullets compactos.
- **Sugestão comercial** vira um único bloco com borda esquerda azul de 3pt (sem fundo), título em uppercase + argumento em corpo.
- **Rodapé**: linha azul fina + texto 7pt cinza com marca e geração.
- Garantir cabimento em 1 página com `@page A4 portrait; margin: 10mm` e `print-color-adjust: exact` para o hero azul imprimir.

## Arquivos
- `src/routes/app.relatorio.$id.tsx` — reescrever JSX da função `PrintOnePager` (linhas ~568-694) com a nova estrutura (faixa topo, hero azul, KPIs 3-col, tabela com barra de similaridade, blocos fortes/atenção e sugestão com borda lateral). Sem mudanças em business logic — apenas apresentação.
- `src/styles.css` — atualizar bloco `.print-onepager …` (linhas ~673-770): nova grade, cor de hero, pills brancos, tabela zebrada, divisores, tipografia mais firme, `print-color-adjust: exact`.

## Fora de escopo
- Slide ACM (paisagem) e páginas "Argumentos"/"Carta ao Proprietário" — permanecem como estão.
- Lógica de cálculo, dados ou ordenação.
