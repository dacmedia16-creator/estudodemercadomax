## Objetivo
Mostrar a mensagem de erro **completa e crua** retornada pelo Supabase ao criar conta, em vez de apenas a tradução amigável.

## Mudanças
Arquivo: `src/routes/auth.tsx`

1. No `catch` do fluxo de cadastro (e também no login, por simetria), capturar:
   - `error.message`
   - `error.status` / `error.code` (quando existir)
   - `error.name`
2. Renderizar um bloco de erro expandido contendo:
   - Mensagem traduzida (atual) no topo
   - Um `<details>` "Ver detalhes técnicos" com `<pre>` exibindo JSON formatado do erro completo (`code`, `status`, `name`, `message` originais)
3. Manter o `PasswordHint` e validações existentes — nada mais muda.
4. Logar também `console.error("[auth] signup error", error)` para inspeção no DevTools.

## Como você verá
Ao falhar o cadastro, aparecerá a caixa de erro com a mensagem em PT e logo abaixo um expansor com o payload exato (ex.: `{"code":"weak_password","message":"Password should...","status":422}`), o que torna trivial identificar a causa real.
