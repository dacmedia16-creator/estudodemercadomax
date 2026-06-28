## Objetivo
Permitir qualquer senha (com mínimo de 8 caracteres) ao criar conta — desativar o bloqueio de senhas vazadas (HIBP).

## Mudanças

1. **Supabase Auth**: chamar `configure_auth` com `password_hibp_enabled: false` (mantendo signup habilitado, sem auto-confirm, sem usuários anônimos). Isso remove o erro "senha vazada/comum".
2. **`src/routes/auth.tsx`**: remover o `PasswordHint` (aviso sobre senhas comuns) e simplificar o texto de ajuda abaixo do campo de senha para apenas "Mínimo 8 caracteres". A tradução de erro HIBP fica no código como fallback, mas não será mais acionada.

## Observação
A validação local mínima de 8 caracteres é mantida (limite do próprio Supabase). Se quiser permitir senhas ainda mais curtas, é preciso alterar a política mínima de senha no Supabase — me avise.
