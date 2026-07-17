# Refatorar `/app/relatorio/$id` — foco no corretor

Escopo: só a organização visual da tela (`print-hide-on-print`) em `src/routes/app.relatorio.$id.tsx`. **Nada** de mudar `computeAcm`, `runStudy`, `studyStore`, `PrintOnePager`, `PrintSlides` ou `PrintOwnerPages`. Header, `max-w-7xl`, `print-section` e `print-break-before` ficam intactos.

## Nova ordem da tela

1. **Header** — inalterado.
2. **`ResumoHero`** (novo, só na tela) — hero de valor.
3. **Faixa fina de indicadores** — 1 linha em `text-muted-foreground`.
4. **Card "Como apresentar ao proprietário"** — funde `diagnostico` + `AiAnalysisCard` + sugestão comercial.
5. **Card "Prova de mercado"** — gráfico principal + tabela enxuta + concorrentes diretos; gráfico secundário e "Anunciantes mais ativos" dentro de `<details> Ver mais dados`.
6. **Accordion "Ajustar estudo (avançado)"** — colapsado por padrão, contém `AcmPanel`, `CriteriosEditor`, `ComparaveisManager`.
7. **Pontos fortes / Pontos de atenção** — inalterados.
8. **Slide ACM (preview)** — mantido no fim.

```text
┌───────────── Header (Exportar PDF · ACM · Compartilhar) ─────────────┐
│                                                                      │
│  HERO: Valor recomendado para venda                                  │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ R$ 1.150.000                              (margem ±X: A–B)   │    │
│  │ [Vender rápido]  [Recomendado ★]  [Anunciar até]             │    │
│  │ 12 imóveis parecidos · R$ 9.200/m² · situação: Dentro média  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  Preço médio X · Menor Y · Maior Z · Faixa A–B                       │
│                                                                      │
│  [ Como apresentar ao proprietário ]                                 │
│  [ Prova de mercado ]                                                │
│  ▸ Ajustar estudo (avançado)                                         │
│  Pontos fortes | Pontos de atenção                                   │
│  Slide ACM (preview)                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

## Detalhes por bloco

### 2. `ResumoHero` (novo componente no mesmo arquivo)
- Rótulo "Valor recomendado para venda" + valor grande usando `getValorIdeal(study, acm)`.
- Se `study.valorIdealRange`: linha pequena "margem de segurança ({confianca}): {min} – {max}".
- 3 pills lado a lado, **Recomendado** destacado:
  - `idealMin = valorIdeal * (acm.valorMinimoFechamento / acm.valorSugerido)`
  - `idealMax = valorIdeal * (acm.valorMaximoPublicacao / acm.valorSugerido)`
- Rodapé: "{n} imóveis parecidos analisados · R$ {precoM2Medio}/m² de média · situação: {status}", palavra do status colorida (verde/âmbar/azul) via tokens `text-success | text-warning | text-primary`.
- Estilo: `bg-primary/5 border border-primary/40`, valor em `text-primary`. Sem gradiente/sombra pesada.

### 3. Faixa fina
Substitui os 6 `Indicator`. Uma `<p>` em `text-xs text-muted-foreground`: "Preço médio: X · Menor: Y · Maior: Z · Faixa recomendada: A–B".

### 4. "Como apresentar ao proprietário"
Um único `Card` com subseções:
- **Resumo** — `study.diagnostico` + `aiAnalysis.resumo` se houver.
- **Discurso pro proprietário** — `aiAnalysis.discursoProprietario` + botão Copiar.
- **Anúncio pronto** — `study.tituloSugerido` e `study.descricaoSugerida`, cada um com botão Copiar.
- Botão "Gerar novamente" da IA no header do card (reaproveita a função de `AiAnalysisCard`).
- Riscos e Recomendações da IA como duas colunas no fim do card.

Implementação: extrair um `ApresentacaoCard` que recebe `study`/`onChange` e chama internamente a mesma server fn (`analisarMercadoIa`) que o `AiAnalysisCard` usa hoje — para não duplicar lógica, `AiAnalysisCard` pode ser reaproveitado internamente ou refatorado para expor esse conteúdo; se ficar caro, apenas renderizar `AiAnalysisCard` dentro do card + adicionar Copiar/Título/Descrição em cima.

### 5. "Prova de mercado"
- Gráfico "Distribuição de preços" (mantém).
- Tabela enxuta (ver abaixo).
- Concorrentes diretos (mantém 3 cards).
- Dentro de `<details><summary>Ver mais dados</summary>`: gráfico "Preço por m²" + "Anunciantes mais ativos".

### 6. Tabela enxuta
Colunas visíveis: **Portal · Título (+bairro embaixo) · m² · Quartos · Preço · Semelhança**.
- Preço em negrito; barra/badge de semelhança preservada.
- No máximo 1 badge por linha, prioridade: `Mesmo prédio` > `Mesmo endereço` > `Match preferido`. Outras badges (Premium, Confiança, N anunciantes, Área não informada, Anúncio removido) só na linha de detalhe.
- Clique na linha expande `expandedRow` (state `useState<string | null>`) mostrando Cond., IPTU, DOM, R$/m², Anunciante, WhatsApp, CRECI, link.
- Mantém `Select` de ordenação e o aviso quando `comparaveis.length === 0`.

### 7. Accordion "Ajustar estudo (avançado)"
`Accordion type="single" collapsible` (shadcn), sem `defaultValue`. Um `AccordionItem` com `AcmPanel`, `CriteriosEditor`, `ComparaveisManager` empilhados. `print-hide-on-print` no wrapper.

### 8. Régua de percentis (AcmPanel)
No próprio `AcmPanel` (mudança pequena, autorizada porque é UI, não cálculo): esconder rótulos P10/P25/Mediana/P75/P90 dentro de `<Tooltip>` e deixar visíveis só "mais barato · meio · mais caro".

### 9. Linguagem (só rótulos da tela)
- "Comparáveis" → "Imóveis parecidos".
- "R$/m² pretendido" → "Preço por m² do seu imóvel".
- "valorPretendido" exibido como "Preço que o proprietário quer".

## Arquivos alterados
- `src/routes/app.relatorio.$id.tsx` — reorganização, novos componentes locais `ResumoHero`, `ApresentacaoCard`, tabela enxuta com `expandedRow`.
- `src/components/acm-panel.tsx` — só a régua de percentis (tooltip nas siglas).

## Fora do escopo
Cálculos, engine, store, PDF (`PrintOnePager`/`PrintSlides`/`PrintOwnerPages`), runner, tipos.

## Verificação
- `tsgo` limpo.
- Abrir um relatório existente na preview: hero visível, tabela com 6 colunas, accordion fechado, `print-hide-on-print` ainda impede que os blocos de edição vazem para o PDF.
- Exportar PDF de teste: 4 páginas iguais às de hoje.
