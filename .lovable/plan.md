# Fixar corte "Top 10 mais baratos" + priorizar anúncios recentes

Objetivo: remover o caráter opcional do corte pelos 10 mais baratos e adicionar, como **última etapa** do funil, um filtro que privilegia anúncios com data de inclusão mais próxima do dia do estudo.

## 1. Corte fixo pelos 10 mais baratos (`src/lib/study-runner.ts`)

- Remover a leitura de `overrides.top10Baratos` (linhas ~1266–1277). O corte passa a rodar **sempre** que a amostra tiver mais de 10 comparáveis.
- Manter o registro no funil (`etapa: "Top 10 mais baratos (corte por preço — X → 10)"`) e em `criteriosAplicados`.
- Marcar `SearchOverrides.top10Baratos` como `@deprecated` em `src/lib/study-types.ts` (mantido para não quebrar estudos salvos, mas ignorado).

## 2. Nova última etapa: priorizar recência (`src/lib/study-runner.ts` / `src/lib/study-engine.ts`)

Depois do corte pelos 10 mais baratos (e antes do `computeStats`), aplicar reordenação por `diasMercado`:

- Regra: dentro dos 10 finais, ordenar do menor `diasMercado` (mais recente) para o maior. Empates: menor preço total.
- Anúncios **sem `diasMercado`** (campo ausente em alguns retornos de portal): tratados como "idade desconhecida" e vão para o fim da lista, mas **continuam nos 10** — nunca descartar por falta de data, para não esvaziar a amostra.
- Não é um filtro que **elimina** — é reordenação. A amostra dos 10 permanece a mesma; muda só a apresentação/ordem no relatório e a rotulagem de "mais atuais".
- Registrar no funil: `etapa: "Priorização por data de inclusão (mais recentes primeiro)"`.

## 3. UI — remover o toggle opcional

- `src/components/criterios-editor.tsx` (ou onde o campo "Focar nos 10 mais baratos" for exposto): remover o checkbox/toggle. O comportamento é fixo — nenhuma opção editável.
- `src/routes/app.relatorio.$id.tsx`: a legenda "Foco nos 10 mais baratos" continua aparecendo em `criteriosAplicados` (vem do runner).

## 4. Fora de escopo

- Não mexer no scoring de similaridade, ACM, IA, dedup, `computeStats`, `flagOutliers` ou peso de confiança por DOM (que já existe em `computeConfidence`).
- Não mudar as camadas de busca nem os filtros hard/soft/prefer.
- Não descartar comparáveis por idade — só reordenar.

## Detalhes técnicos

Ordem final do funil (em `study-runner.ts` → `study-engine.ts`):

```text
busca multi-portal
  → dedup semântica
  → filtros hard (tipo, finalidade, quartos, área, campos "hard")
  → ordenação por similaridade
  → interleaving por portal (top 10 balanceados)
  → [NOVO — FIXO] corte pelos 10 mais baratos (preço total)
  → [NOVO] reordenação por diasMercado (mais recentes primeiro; sem data = fim)
  → flagOutliers + computeStats
```

Impacto:
- Estudos onde a busca traz >10 comparáveis passam a **sempre** aplicar o corte de preço (hoje, mesmo com default ligado, o override podia desligar).
- Relatório passa a listar os comparáveis com o mais recente no topo.
- Zero migração de dados: `SearchOverrides.top10Baratos` fica no schema, apenas ignorado.
