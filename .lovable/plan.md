Mudar o destino após login para o Dashboard ("Início") em `/app`, em vez de `/app/novo-estudo`.

Alterações em `src/routes/auth.tsx`:
- Linha 46: `navigate({ to: "/app/novo-estudo" ... })` → `navigate({ to: "/app" ... })` (redirect quando já logado).
- Linha 64: `emailRedirectTo: .../app/novo-estudo` → `.../app` (confirmação de signup).
- Linha 87: `navigate({ to: "/app/novo-estudo" ... })` → `navigate({ to: "/app" ... })` (após login/signup bem-sucedido).

Nenhuma outra mudança — a rota `/app` já renderiza o Dashboard (`app.index.tsx`).