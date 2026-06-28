## Objetivo
Tornar **dacmedia16@gmail.com** super admin do sistema, com poderes para criar/listar/excluir usuários e ver estudos de todos.

## 1. Banco de dados (migration)

Criar a infraestrutura padrão de roles:

- `enum public.app_role` com valores `admin`, `user`.
- Tabela `public.user_roles` (id, user_id → auth.users, role) com RLS, GRANTs, e policies:
  - usuário autenticado vê os próprios roles;
  - apenas admin pode inserir/excluir roles (via `has_role`).
- Função `public.has_role(_user_id, _role)` SECURITY DEFINER (padrão antirecursão).
- Trigger em `auth.users` (AFTER INSERT) que concede `admin` automaticamente quando `lower(email) = 'dacmedia16@gmail.com'` — assim, mesmo que a conta seja recriada no futuro, continua sendo admin.
- Seed: se já existir um `auth.users` com esse email, inserir o role `admin` agora.
- Estender RLS de `public.studies`: além de "dono", admin pode `SELECT/UPDATE/DELETE` qualquer estudo (via `has_role(auth.uid(),'admin')`).

## 2. Server functions (`src/lib/admin.functions.ts`)

Todas com `requireSupabaseAuth` + checagem `has_role(userId,'admin')`; usam `supabaseAdmin` (carregado dinâmico) para Auth Admin API:

- `listUsers()` → `supabaseAdmin.auth.admin.listUsers()` (página única, paginável depois).
- `createUser({ email, password, isAdmin })` → `supabaseAdmin.auth.admin.createUser({ email_confirm: true })`, e se `isAdmin` insere role.
- `deleteUser({ id })` → `supabaseAdmin.auth.admin.deleteUser(id)`; bloqueia auto-delete e bloqueia deletar o próprio super admin de email fixo.
- `setUserAdmin({ id, isAdmin })` → insere/remove role `admin`.
- `getMeRoles()` → retorna roles do usuário corrente (para o frontend exibir menu Admin).

## 3. Frontend

- **Hook `useIsAdmin()`** (`src/hooks/use-is-admin.ts`): consulta `getMeRoles` via React Query.
- **Menu lateral** (`src/components/app-sidebar.tsx` ou equivalente da `/app`): mostrar item **Administração** apenas se `isAdmin`.
- **Nova rota `/app/admin` (`src/routes/app.admin.tsx`)**: 
  - Listagem de usuários (email, criado em, último login, badge "Admin").
  - Botão **Novo usuário** abre modal (email, senha, checkbox "É administrador").
  - Ações por linha: alternar admin, excluir (com confirmação).
  - `beforeLoad` chama `getMeRoles`; se não-admin, `redirect` para `/app/novo-estudo` com toast.
- **Rota `/app/estudos`**: nada muda na UI; a policy expandida já permite o admin ver todos. Adicionar (apenas quando admin) uma coluna "Dono" mostrando o email do criador, buscado por uma server fn `listStudyOwners(ids)` que usa `supabaseAdmin` para resolver `user_id → email` (somente admin).

## 4. Segurança

- Nenhum role é editável pelo próprio usuário (policies negam INSERT/DELETE em `user_roles` sem `has_role admin`).
- Todas as ações administrativas validam role no servidor — checagem no frontend é só UX.
- `supabaseAdmin` continua importado dinamicamente dentro de cada handler.

## Detalhes técnicos
- Edits/criações de arquivos: `src/lib/admin.functions.ts`, `src/hooks/use-is-admin.ts`, `src/routes/app.admin.tsx`, ajustes no sidebar e em `app.estudos.tsx`.
- Migration única com enum + tabela + função + trigger + seed + policies de `studies`.
