
## Objetivo

Instrumentar todas as chamadas à GeckoAPI feitas pelo app e expor um painel **apenas para o super admin** (`dacmedia16@gmail.com` / role `admin`) com:
- Total de chamadas no mês atual
- Custo estimado em R$ (taxa configurável, padrão R$ 0,0127/call = plano Developer)
- Quebra por **usuário**, por **portal** (Zap / Chaves / OLX) e por **endpoint** (PLP / PDP)
- Top 10 estudos mais caros do mês

Usuários normais não veem nada disso.

## O que muda

### 1. Nova tabela `public.api_usage` (migração)

```text
api_usage
├─ id          uuid pk
├─ user_id     uuid  (auth.users — quem disparou)
├─ study_id    uuid  (nullable — null = chamada avulsa / diagnóstico)
├─ portal      text  (zap | chaves | olx | other)
├─ endpoint    text  (plp | pdp | other)
├─ target_host text  (ex.: zapimoveis.com.br)
├─ status      int   (HTTP status devolvido pela GeckoAPI)
├─ created_at  timestamptz default now()
```

RLS:
- `INSERT`: `authenticated` (qualquer usuário logado pode inserir o próprio uso — `user_id = auth.uid()`)
- `SELECT`: **somente** `has_role(auth.uid(), 'admin')`
- `service_role`: ALL

GRANTs explícitos para `authenticated` e `service_role`. Sem acesso `anon`.

Índices: `(created_at desc)`, `(user_id, created_at desc)`, `(study_id)`.

### 2. Instrumentação em `src/lib/gecko.functions.ts`

A função server-side que hoje proxia o `POST /v1/extract` da GeckoAPI ganha um passo final, dentro do `.handler()`, depois de receber a resposta:

- Detecta `portal` pelo `target` (`zapimoveis.com.br` → `zap`, etc.)
- Detecta `endpoint` por heurística do payload (lista de resultados → `plp`; campos de imóvel único → `pdp`)
- Faz `insert` em `api_usage` com `context.userId`, `study_id` opcional vindo do input, `status` e `target_host`
- O insert é **fire-and-forget**: erro de logging nunca quebra a busca (try/catch silencioso, só `console.warn`)
- O input do server fn ganha um campo opcional `studyId?: string` para correlacionar

Nenhuma chamada à GeckoAPI muda em comportamento — só passa a registrar.

### 3. Novo server fn `adminUsageStats` em `src/lib/admin.functions.ts`

Protegido por `requireSupabaseAuth` + checagem `has_role('admin')` (mesmo padrão dos outros admin fns). Recebe `{ month?: string }` (default = mês atual) e devolve:

```text
{
  rateBrl: number,           // taxa por chamada (default 0.0127)
  totalCalls: number,
  totalCostBrl: number,
  byUser:    [{ user_id, email, calls, costBrl }],
  byPortal:  [{ portal, calls, costBrl }],
  byEndpoint:[{ endpoint, calls, costBrl }],
  topStudies:[{ study_id, bairro, cidade, calls, costBrl }],
  dailySeries:[{ day: '2026-06-01', calls }]
}
```

Usa `supabaseAdmin` (carregado com `await import` dentro do handler) só para o join com `auth.users` (email) — leitura pura, sem mutação.

### 4. Nova aba **"Custo API"** em `src/routes/app.admin.tsx`

Adicionar uma terceira aba ao painel admin existente (já tem Usuários e Estudos):

- **Cards no topo**: chamadas no mês, custo total R$, custo médio por estudo, projeção para o mês cheio.
- **Seletor de mês** (default = atual).
- **Input "Taxa por chamada (R$)"** — persistido em `localStorage` por enquanto (`radar:api-rate`), default `0.0127`. Recalcula tudo no client sem nova requisição.
- **Gráfico de barras** (Recharts) com chamadas por dia.
- **Tabela "Por usuário"** com email, chamadas, custo, % do total.
- **Tabela "Por portal"** e **"Por endpoint"**.
- **Tabela "Top 10 estudos mais caros"** com link `Abrir` para `/app/relatorio/$id` (igual ao já existente).

### 5. Sidebar (`src/components/app-sidebar.tsx`)

Nenhuma mudança visível para usuário comum — a aba "Custo API" fica dentro do menu **Administração** que já só aparece se `hasRole('admin')`.

## Detalhes técnicos

- **Correlação estudo ↔ chamadas**: `src/lib/study-runner.ts` já tem um `studyId` (o id do estudo sendo gerado/recalculado). Passamos esse id em todas as chamadas a `geckoExtract` via o novo campo `studyId` para que o `api_usage` saiba a qual estudo cada call pertence. Para chamadas avulsas (diagnóstico em Settings, inclusão de URL manual fora de um estudo) `study_id` fica `NULL`.
- **Taxa configurável**: mantida client-side por enquanto (`localStorage`). Se no futuro quiser por workspace, vira coluna em uma tabela `app_settings`, mas isso fica fora deste escopo.
- **Privacidade**: a tabela é totalmente invisível para usuários não-admin via RLS. O server fn `adminUsageStats` também checa `has_role('admin')` antes de qualquer leitura, como os demais admin fns.
- **Custo de armazenamento**: ~50 bytes/linha × ~20 calls/estudo × milhares de estudos = desprezível. Sem rotina de purge nesta entrega.
- **Sem mudança no fluxo de busca**: nenhum comportamento de matching, filtros ou portais é alterado. Só observabilidade.

## Arquivos tocados

- `supabase/migrations/<nova>.sql` — tabela `api_usage` + RLS + GRANTs + índices
- `src/lib/gecko.functions.ts` — logging fire-and-forget + novo input `studyId`
- `src/lib/study-runner.ts` — passa `studyId` em cada chamada
- `src/lib/admin.functions.ts` — novo fn `adminUsageStats`
- `src/routes/app.admin.tsx` — nova aba "Custo API"
- (opcional) `src/components/api-cost-panel.tsx` — componente da nova aba para manter o arquivo de rota enxuto

Nenhum arquivo de UI do usuário final é alterado.
