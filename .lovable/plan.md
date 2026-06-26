## Lógica da planilha (ACM - Verona Ricardo)

A planilha é uma **Análise Comparativa de Mercado** clássica usada por corretores. O fluxo é:

1. Lista 10 imóveis similares (link, M², dorms, suítes, vagas, condomínio, valor venda, R$/m²).
2. Define o imóvel-alvo (M², dorms, suítes, vagas, condomínio, andar).
3. **Calcula a média do R$/m²** dos comparáveis → âncora de preço.
4. Aplica **4 fatores de ajuste percentuais** (Localização, Estado de Conservação, Idade, Padrão), todos partindo de 100%. O produto deles multiplica a média.
5. Soma/desconta um **Valor de Reforma/Atualização** (R$/m² × área), com guia: estética R$ 200–500/m², estrutural R$ 1.000–2.000/m².
6. **Valor sugerido** = (média R$/m² × área × ajustes) − reforma.
7. **Valor Máximo de Publicação** ≈ sugerido × 1,05 (margem de negociação ~5%).

Hoje a gente já tem: comparáveis, média R$/m², faixa min/max (±7%) e diagnóstico. O que **falta e vale puxar da ACM**:

## O que adicionar ao Radar

### 1. Painel "Ajustes ACM" no relatório
Quatro sliders/inputs com default 100% e range típico 80–120%:
- Localização (vs. média da região)
- Estado de conservação
- Idade do imóvel
- Padrão de acabamento

Multiplicador final = produto dos quatro.

### 2. Bloco "Reforma / Atualização"
- Campo R$/m² (com presets: "Sem reforma 0", "Estética 350", "Estrutural 1500", "Customizado")
- Calcula `area × R$/m²` e desconta do valor sugerido
- Mostra a régua de referência da ACM como dica

### 3. Novos campos no resumo
- **Valor avaliado do m²** = média m² × ajustes
- **Valor sugerido (estado atual)** = avaliado × área − reforma
- **Valor máximo de publicação** = sugerido × (1 + margem%), margem default 5% editável
- **Valor mínimo de fechamento** = sugerido × (1 − margem%) (extra, ajuda corretor a negociar)

Substitui/complementa o atual "faixa ±7%", que vira só uma referência rápida.

### 4. Exportação ACM
Adicionar no relatório um botão "Exportar ACM" (PDF e/ou XLSX) com o **mesmo layout da planilha**: tabela de comparáveis, definição do imóvel, ajustes, reforma, resumo. Corretor já reconhece o formato e entrega pro proprietário.

### 5. Persistência
Salvar os ajustes (fatores, reforma, margem) dentro do `StudyResult` para a revisão ficar consistente entre re-execuções.

## Onde mexer (técnico)

- `src/lib/study-types.ts`: adicionar `AcmAdjustments { localizacao, conservacao, idade, padrao, reformaPorM2, margemPublicacaoPct }` em `StudyResult` e `SearchOverrides`.
- `src/lib/study-engine.ts`: novo `computeAcm(result, adjustments)` que retorna `{ valorM2Avaliado, valorSugerido, valorMaximoPublicacao, valorMinimoFechamento, descontoReforma }`. Não substitui `precoMedio`/`faixaMin/Max` (mantém compat).
- `src/routes/app.relatorio.$id.tsx`: novo card "Ajustes ACM" (sliders + input reforma + margem) + bloco "Resumo - Avaliação para Venda" no estilo da planilha; botão "Exportar ACM".
- `src/lib/study-store.ts`: salvar `adjustments` junto ao estudo.
- Export PDF: usar a infraestrutura de impressão já existente do relatório (CSS print) com uma página dedicada formatada como a ACM. XLSX fica para uma segunda iteração se você quiser.

## Fora de escopo (por enquanto)

- Não muda nada na busca/GeckoAPI nem no funil — é só camada de avaliação em cima do que já vem.
- Não vamos pesar os fatores ACM na similaridade dos comparáveis (eles avaliam o alvo, não filtram concorrentes).

Quer que eu já implemente tudo isso ou prefere começar só pelos itens 1–3 (ajustes + reforma + novos valores) e deixar exportação ACM pra depois?
