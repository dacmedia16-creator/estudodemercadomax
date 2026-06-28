# Autenticação + estudos por usuário

## 1. Habilitar Lovable Cloud
Habilitar o backend integrado (Postgres + Auth + RLS). Sem ele não há como isolar dados por usuário de forma segura.

## 2. Autenticação Email + Senha
- Rota pública `/auth` com tabs **Entrar** e **Criar conta** (validação Zod, mensagens em PT-BR).
- Cadastro sem confirmação de email (login imediato), com `emailRedirectTo = window.location.origin`.
- Listener global `onAuthStateChange` em `__root.tsx` (filtrado em SIGNED_IN/OUT/USER_UPDATED) para invalidar router/queries.
- Botão **Sair** no header de `/app` com teardown correto (cancelQueries → clear → signOut → navigate replace `/auth`).
- Avatar do header mostra as iniciais do email do usuário logado.

## 3. Proteção de rotas (todo /app protegido)
- Criar layout gerenciado `src/routes/_authenticated/route.tsx` (`ssr: false`, redireciona para `/auth`).
- Mover **todas** as rotas atuais de `app.*` para `_authenticated/app.*`:
  `app.tsx`, `app.index.tsx`, `app.novo-estudo.tsx`, `app.relatorio.$id.tsx`, `app.estudos.tsx`, `app.relatorios.tsx`, `app.comparativos.tsx`, `app.configuracoes.tsx`, `app.exemplo.tsx`, `app.carregando.tsx`.
- Landing `/` e `/auth` permanecem públicas. Botão "Entrar" na landing.

## 4. Persistência dos estudos no banco (com RLS)
Migrar de `localStorage` para Postgres.

### Schema
```sql
create table public.studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,        -- StudyResult completo (input, comparáveis, ACM, etc.)
  titulo text generated always as (payload->'input'->>'bairro') stored,
  cidade text generated always as (payload->'input'->>'cidade') stored,
  status text generated always as (payload->>'status') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.studies to authenticated;
grant all on public.studies to service_role;

alter table public.studies enable row level security;

create policy "owner select" on public.studies for select to authenticated using (auth.uid() = user_id);
create policy "owner insert" on public.studies for insert to authenticated with check (auth.uid() = user_id);
create policy "owner update" on public.studies for update to authenticated using (auth.uid() = user_id);
create policy "owner delete" on public.studies for delete to authenticated using (auth.uid() = user_id);
```

### Acesso
- Substituir `src/lib/study-store.ts` por server functions com `requireSupabaseAuth`:
  `listStudies`, `getStudy(id)`, `saveStudy(payload)`, `deleteStudy(id)`.
- Atualizar `app.estudos.tsx`, `app.relatorio.$id.tsx`, `app.novo-estudo.tsx` (loading) e `app.carregando.tsx` para usar TanStack Query + as novas server fns.
- Estudos antigos do localStorage são **descartados** (conforme escolha) — adicionar `localStorage.removeItem('rip:studies')` no primeiro login.
- Branding (logo/cor) em Configurações continua em localStorage por dispositivo (não é dado sensível).

## 5. Segurança das APIs externas (auditoria)
Confirmar e manter dentro de server functions (já estão hoje, validar que nada vaze ao cliente):
- **GeckoAPI**: token `GECKOAPI_TOKEN` lido apenas em `src/lib/gecko.functions.ts` via `process.env`. Adicionar `.middleware([requireSupabaseAuth])` em `geckoPlp`, `geckoPdp`, `geckoTest`, `geckoTestPlp`, `geckoStatus` para impedir uso anônimo do nosso crédito.
- **Geocode (Nominatim)** e **ViaCEP**: server-side em `geocode.functions.ts` — adicionar mesma middleware.
- **Lovable AI Gateway** (`query-parser.functions.ts`): exige auth + lê `LOVABLE_API_KEY` server-side (já é o caso). Confirmar.
- Diagnóstico em Configurações continua funcionando porque o usuário estará logado.

## 6. Configurações de Auth (Lovable Cloud)
- Desativar confirmação de email (login imediato após signup).
- Ativar **Leaked password protection** (HIBP) via `configure_auth`.
- Configurar **Site URL** e **Redirect URLs** com a URL atual.

## 7. Pós-implementação
- Banner uma única vez: "Seus estudos agora ficam salvos na sua conta na nuvem."
- Atualizar `__root.tsx` head com title/description corretos do Radar Imobiliário Pro.

## Detalhes técnicos
- Cliente browser: `@/integrations/supabase/client` (publishable key).
- Server fns autenticadas: `.middleware([requireSupabaseAuth])` + `context.supabase` (RLS aplica).
- Bearer attacher já vem do template — registrar em `src/start.ts` se ainda não estiver.
- Todas as server fns que tocam `studies` retornam DTOs simples (sem clients/SDK).
- `_authenticated/route.tsx` é o único gate; nenhum `beforeLoad` adicional nas rotas filhas.
- Nada de `supabaseAdmin` em código de rota — só publishable + RLS por `auth.uid()`.
