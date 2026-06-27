# Excluir/incluir imóveis por link e recalcular o estudo

Permitir, na tela do relatório, remover comparáveis indesejados e adicionar imóveis manualmente colando a URL do anúncio (Zap, Chaves na Mão ou OLX). Após qualquer mudança, recalcular médias, ACM, faixa sugerida e gráficos. Mudanças valem só na sessão atual (não persistem após reexecução da busca).

## Mudanças

### 1. `src/lib/study-engine.ts`
- Extrair função `recomputeStudy(study, comparaveis)` que recebe a lista atualizada e devolve um novo `StudyResult` com `precoMedio`, `precoMedioM2`, `faixaSugerida`, `status`, `distribuicao`, `bairros`, `tendencia`, `acm` recalculados a partir dos comparáveis passados (hoje essa lógica está dentro de `generateStudy`).

### 2. `src/lib/gecko-adapter.ts` / detecção de portal por URL
- Adicionar `detectPortalFromUrl(url)` → `"zapimoveis.com.br" | "chavesnamao.com.br" | "olx.com.br" | null`.

### 3. `src/lib/study-runner.ts`
- Exportar `fetchSinglePropertyByUrl(url, input)`: faz uma chamada PDP (`type: "pdp"`, `target: portal`, `url`) via `gecko.functions.ts`, normaliza com o parser do portal correto e retorna um `Comparavel` marcado com `origem: "manual"` (novo campo opcional em `study-types.ts`).
- Sem fallback de busca: se a PDP falhar, devolve erro.

### 4. `src/lib/study-types.ts`
- `Comparavel`: novo campo opcional `origem?: "busca" | "manual"`.

### 5. Novo componente `src/components/comparaveis-manager.tsx`
- Lista os comparáveis atuais com botão "Remover" (lixeira) em cada linha/card.
- Input para colar URL + botão "Adicionar imóvel": valida portal, chama `fetchSinglePropertyByUrl`, mostra loading e toast de sucesso/erro, evita duplicar pela URL.
- Botão "Restaurar originais" volta à lista que veio da busca.
- Badge "Adicionado manualmente" nos itens com `origem: "manual"`.

### 6. `src/routes/app.relatorio.$id.tsx`
- Manter `study` como estado local; após qualquer add/remove chamar `recomputeStudy` e atualizar o estado (sem persistir no `studyStore` automaticamente — só na sessão).
- Renderizar `ComparaveisManager` acima/junto da tabela de comparáveis existente.
- Toast informando "Estudo recalculado".
- Quando o usuário reexecutar a busca pelo `CriteriosEditor`, as alterações manuais são descartadas (comportamento esperado pela escolha "só sessão atual").

## Detalhes técnicos

- Reaproveita `gecko.functions.ts` (`extract`) com `type: "pdp"` — sem novos endpoints.
- `recomputeStudy` usa as mesmas funções já existentes para gerar `acm` (fatores atuais preservados) e estatísticas; nada muda no PDF/slides porque eles leem do `study` em estado.
- Funil de busca (`funilBusca`) ganha entrada informativa "Ajuste manual: +X / -Y" apenas em memória, sem alterar contagem de créditos persistida.
- Sem mudanças em rotas, sem backend novo, sem persistência adicional.
