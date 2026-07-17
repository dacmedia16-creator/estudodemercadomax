## Objetivo
No modal "Nova equipe", trocar o campo de texto "E-mail do gestor" por um **seletor (dropdown com busca)** listando os usuários já cadastrados no sistema. O admin escolhe entre os usuários disponíveis; se quiser criar um gestor novo, mantém a opção de digitar um e-mail novo + senha.

## Mudanças

### Backend — `src/lib/team.functions.ts`
- Nova server fn `adminListAvailableUsers` (admin-only) que retorna `[{ id, email, role }]` de todos os usuários (via `supabaseAdmin.auth.admin.listUsers`), marcando o papel atual (admin/gestor/user) para exibição.
- `adminCreateTeam` passa a aceitar **ou** `managerId` (uuid de usuário existente) **ou** `managerEmail` + `managerPassword` (criar novo). Valida que pelo menos um dos dois foi enviado.

### Frontend — `src/routes/app.equipes.tsx`
- No modal "Nova equipe":
  - Substituir o `<Input type="email">` por um `<Combobox>` (Popover + Command do shadcn) mostrando lista de usuários com busca por e-mail e badge do papel atual.
  - Botão/opção "➕ Criar novo gestor" que revela os campos `e-mail` + `senha inicial` (fluxo atual).
  - Estado: `managerId` (selecionado) OU `newManagerEmail` + `newManagerPassword`.
- `handleCreate` envia `managerId` quando um usuário existente foi escolhido; senão envia `managerEmail`/`managerPassword`.
- Carregar lista de usuários com `useQuery(['admin-users'])` habilitada quando o modal abre.

## Fora do escopo
Não altera o modal "Adicionar corretor" (segue o fluxo atual por e-mail). Se quiser aplicar o mesmo padrão lá, faço em seguida.
