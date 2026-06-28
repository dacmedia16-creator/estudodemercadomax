## Problema

Os logs mostram que suas tentativas de cadastro com a senha `12345678` foram bloqueadas pelo Supabase com o erro:

> "Password is known to be weak and easy to guess, please choose a different one." (código `weak_password`, motivo `pwned`)

Isso acontece porque ativamos a proteção contra **senhas vazadas (HIBP)** — qualquer senha que já apareceu em vazamentos públicos é recusada, mesmo tendo 8+ caracteres. `12345678` está entre as mais vazadas do mundo.

Além disso, a mensagem que aparece na tela está vindo crua em inglês, porque o tradutor de erros que escrevi só detectava a palavra "pwned" (que está no código do erro, não no texto). Por isso parece que "não acontece nada" / mensagem confusa.

## Plano de correção

1. **Melhorar a mensagem de erro na tela `/auth`**
   - Detectar também `weak_password`, `known to be weak`, `easy to guess` e o campo `error.code` retornado pelo Supabase, não só a string "pwned".
   - Mostrar uma mensagem clara em português: *"Esta senha é muito comum ou apareceu em vazamentos. Escolha outra (ex.: combine letras, números e um símbolo)."*
   - Cobrir também: `email_address_invalid`, `over_email_send_rate_limit`, `signup_disabled`, `user_already_exists`.

2. **Reforçar o aviso preventivo no formulário de cadastro**
   - Texto curto abaixo do campo Senha: *"Mínimo 8 caracteres. Senhas comuns como `12345678` ou `senha123` serão recusadas."*
   - Pequeno indicador visual quando a senha for óbvia (verificação local rápida contra uma lista das ~20 piores) para evitar até a chamada de rede.

3. **Não alterar a política de segurança**
   - Manter HIBP ligado (é uma boa prática e foi pedido na etapa anterior).
   - Não diminuir o tamanho mínimo nem desligar a verificação.

## Como você consegue criar a conta agora (sem esperar a correção)

Use qualquer senha que **não** seja óbvia. Exemplos que passam na verificação:
- `Radar!Imovel2026`
- `corretor.pro#88`
- `MinhaCasa$Sorocaba9`

Evite: sequências (`12345678`, `abcdefgh`), nome próprio simples, `senha123`, `qwerty…`, datas de nascimento.

## Detalhes técnicos (apenas para referência)

- Arquivo afetado: `src/routes/auth.tsx` — função `translateAuthError` será trocada por uma versão que olha `error.code` do `AuthError` do `supabase-js` em vez de fazer match por substring no texto em inglês.
- Nenhuma migração nem mudança no backend é necessária.
- Sem mudanças em RLS ou nas server functions.