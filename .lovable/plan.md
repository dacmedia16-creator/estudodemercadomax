## Objetivo

Substituir as telas placeholder de **Comparativos** e **Relatórios** por funcionalidades reais usando os estudos já salvos no Supabase (`public.studies`). Nenhuma mudança de banco — apenas frontend + leitura via `study-store`.

## 1. `/app/comparativos` — Comparar 2 a 4 estudos lado a lado

Substituir `src/routes/app.comparativos.tsx` por uma tela funcional:

- Carrega a lista de estudos do usuário (`listStudies()` de `src/lib/study-store.ts`).
- Painel superior: tabela checkbox com todos os estudos (bairro, cidade, data, status). Usuário marca de 2 a 4.
- Botão **Comparar** habilita quando seleção ≥ 2.
- Resultado:
  - **Tabela lado a lado** com colunas: Estudo, Bairro/Cidade, Área, Quartos, Valor pretendido, Preço médio, R$/m² médio, Faixa sugerida, Menor, Maior, Status, Nº de comparáveis.
  - **Gráfico de barras** (Recharts, já no projeto) comparando R$/m² médio e Preço médio entre os estudos selecionados.
  - **Destaque** do menor R$/m² e do estudo "Dentro da média" com badge verde.
- Estado vazio: card orientando criar pelo menos 2 estudos.

## 2. `/app/relatorios` — Lista com ações rápidas de export

Substituir `src/routes/app.relatorios.tsx` por uma central de exportação:

- Lista todos os estudos do usuário em tabela: Data, Bairro, Cidade, Tipo, Status, Preço médio, Nº comparáveis.
- Busca por texto (bairro/cidade) e filtro por status.
- Coluna **Ações** por linha:
  - **Abrir relatório** → navega para `/app/relatorio/$id`.
  - **Exportar PDF (A4)** → abre `/app/relatorio/$id?print=onepager` e dispara `window.print()` (mesmo fluxo do botão já existente no relatório).
  - **Exportar slide ACM** → abre `/app/relatorio/$id?print=slides` e dispara `window.print()`.
  - **Copiar link** → copia URL pública do relatório (`/app/relatorio/$id`) para a área de transferência com toast de confirmação.
- Estado vazio: CTA para "Novo estudo".

A rota `/app/relatorio/$id` já existe e já lê o parâmetro `print` para alternar entre os dois layouts de impressão — vamos apenas garantir que ela aceite o auto-print via query param (`?print=onepager&auto=1`); se já não fizer isso, adicionamos um `useEffect` curto que chama `window.print()` quando `auto=1`.

## 3. Ajustes auxiliares

- `src/components/app-sidebar.tsx`: nenhum (links já existem e já apontam para as rotas certas).
- Garantir que `listStudies()` (Supabase) é chamado dentro de `useEffect` com loading skeleton, igual ao padrão usado em `app.estudos.tsx`.

## Arquivos tocados

- `src/routes/app.comparativos.tsx` — reescrito.
- `src/routes/app.relatorios.tsx` — reescrito.
- `src/routes/app.relatorio.$id.tsx` — adicionar `useEffect` para `?auto=1` chamando `window.print()` (apenas se ainda não tiver).

Sem migrations, sem mudanças no engine de estudo, sem novas dependências (Recharts e shadcn já estão no projeto).
