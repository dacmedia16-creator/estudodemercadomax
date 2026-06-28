## Objetivo
Permitir que o super admin visualize (e gerencie) os estudos de todos os usuários da plataforma a partir do painel de Administração.

## Contexto atual
- RLS já permite ao admin ler/editar/excluir qualquer estudo em `public.studies` (políticas "Admins can view/update/delete all studies").
- `src/lib/study-store.ts` lista estudos apenas do usuário logado (`auth.uid()`), então hoje o admin não enxerga os dos outros.
- Já existe `src/routes/app.admin.tsx` com gestão de usuários e o hook `useIsAdmin`.

## Mudanças

### 1. Server functions de admin para estudos
Em `src/lib/admin.functions.ts` (ou novo `admin-studies.functions.ts`), adicionar funções protegidas por `requireSupabaseAuth` + checagem `has_role('admin')`:
- `listAllStudies()` → retorna todos os estudos com `user_id`, cidade, bairro, status, datas e payload resumido.
- `getStudyByIdAsAdmin(id)` → retorna um estudo específico independentemente do dono.
- `deleteStudyAsAdmin(id)` → remove estudo de qualquer usuário.
- Enriquecer cada estudo com o e-mail do dono via `supabaseAdmin.auth.admin.getUserById` (cache simples em memória por request) para exibir "quem fez".

### 2. Nova aba "Estudos" no painel admin
Em `src/routes/app.admin.tsx`, transformar a tela em abas (`Usuários` | `Estudos`). A aba Estudos mostra tabela com:
- Data, usuário (e-mail), cidade/bairro, status, ações (Abrir / Excluir).
- Filtro por usuário e busca por cidade/bairro.
- "Abrir" navega para `/app/estudo/$id` (a rota atual já carrega via RLS — o admin enxerga porque a policy permite).

### 3. Carregamento do estudo como admin
Confirmar que `src/lib/study-store.ts > getStudy(id)` usa server function autenticada que apenas filtra por `id` (RLS faz o resto). Se hoje filtra por `user_id = auth.uid()`, remover essa restrição extra para o admin (ou simplesmente confiar na RLS, removendo o `.eq('user_id', userId)`).

### 4. UI/UX
- Badge "Admin" na linha quando o estudo não pertence ao admin logado.
- Confirmação antes de excluir estudo de outro usuário.
- Vazio: "Nenhum estudo cadastrado na plataforma".

## Fora de escopo
- Editar estudos de terceiros (apenas visualizar/excluir nesta entrega).
- Métricas agregadas/dashboard de uso (pode vir depois).

## Detalhes técnicos
- Todas as novas server functions devem chamar `has_role(userId, 'admin')` no início e retornar 403 caso contrário.
- Usar `supabaseAdmin` (import dinâmico dentro do handler) só para resolver e-mails via Auth Admin API; as leituras de `studies` continuam pelo client RLS do contexto (`context.supabase`), que já enxerga tudo como admin.
