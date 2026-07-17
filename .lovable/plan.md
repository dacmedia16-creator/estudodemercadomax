
## Objetivo
Admin cria e gerencia **equipes nomeadas** (ex.: "Equipe Centro"), cada uma com 1 gestor responsável e vários corretores. Gestor tem acesso somente-leitura à sua equipe, podendo apenas desvincular corretores.

## Banco de dados (migração)

Nova tabela `public.teams`:
- `id uuid pk`
- `name text not null`
- `manager_id uuid not null` (gestor responsável, ref. `auth.users`)
- `created_by uuid not null` (admin que criou)
- `created_at`, `updated_at`

Alteração em `public.team_members`:
- adicionar `team_id uuid not null references public.teams(id) on delete cascade`
- manter `manager_id` e `user_id` (compatibilidade com `is_team_manager` e RLS atuais)
- unique `(team_id, user_id)`

GRANTs + RLS:
- `teams`: SELECT para admin (todas) e para gestor (só onde `manager_id = auth.uid()`); INSERT/UPDATE/DELETE somente admin.
- `team_members`: INSERT/DELETE por admin; DELETE também permitido ao gestor dono (`manager_id = auth.uid()`). SELECT mantém a policy atual.
- Trigger `update_updated_at_column` em `teams`.

Migração popula `teams` a partir dos vínculos existentes (1 equipe por gestor atual, nome padrão "Equipe do <email>") e preenche `team_id` em `team_members`.

## Backend (`src/lib/team.functions.ts`)

Helpers:
- `assertAdmin(supabase, userId)` — usa `has_role admin`.
- Manter `assertGestorOrAdmin` para leitura.

Novas funções (admin-only):
- `adminListTeams` — retorna equipes com nome, gestor (email), nº de membros, nº de estudos.
- `adminCreateTeam({ name, managerEmail, managerPassword? })` — se email já existe e é gestor, reutiliza; senão cria usuário e concede papel `gestor`. Cria linha em `teams`.
- `adminUpdateTeam({ id, name })`.
- `adminDeleteTeam({ id, deleteMembers? })` — remove equipe (cascade em members); usuários permanecem.
- `adminAddMemberToTeam({ teamId, email, password })` — cria corretor e insere em `team_members` com `team_id` + `manager_id` da equipe.
- `adminRemoveMemberFromTeam({ teamId, userId, deleteAccount })`.

Ajustar existentes:
- `gestorCreateMember` → **remover** (ou marcar admin-only). Admin passa a criar via `adminAddMemberToTeam`.
- `gestorRemoveMember` → mantém, mas escopo é sempre a equipe do gestor logado.
- `gestorListTeam` / `gestorListTeamStudies` → passam a considerar `team_id` da equipe do gestor logado (via `manager_id`).

## Frontend

### Sidebar (`src/components/app-sidebar.tsx`)
- Admin: item "Equipes" (`/app/equipes`, plural, nova rota).
- Gestor: mantém "Equipe" (`/app/equipe`, singular) — sua própria equipe.

### Nova rota `src/routes/app.equipes.tsx` (admin)
- Lista de equipes (nome, gestor, nº membros, nº estudos, criada em).
- Botão "Nova equipe" → dialog com: nome, email do gestor, senha (se novo).
- Ações por linha: renomear, excluir equipe, abrir detalhes.
- Detalhe da equipe (dialog ou drawer): lista de corretores, botão "Adicionar corretor" (email/senha), remover corretor (com opção de excluir conta).

### Rota atual `src/routes/app.equipe.tsx` (gestor)
- Remove o botão/dialog "Criar membro".
- Mantém lista de membros com ação "Remover" (chama `gestorRemoveMember`, sem opção de deletar conta — apenas desvincula).
- Mantém aba de estudos da equipe.
- Admin que acessar essa rota é redirecionado para `/app/equipes`.

### `useIsGestor` — sem mudança.

## Fora de escopo
- Sem alteração no fluxo de estudos, relatórios ou RLS de `studies` (a policy `is_team_manager` continua válida porque `manager_id` permanece em `team_members`).
- Sem UI para transferir gestor entre equipes nesta iteração (pode ser feito depois excluindo/recriando).

## Ordem de execução
1. Migração (teams + team_members.team_id + RLS + backfill).
2. Backend `team.functions.ts` (novas funções admin, ajuste das de gestor).
3. Frontend: sidebar + nova rota `/app/equipes` + limpar `/app/equipe`.
