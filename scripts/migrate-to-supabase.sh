#!/usr/bin/env bash
# Migra schema + dados + usuários (auth) do projeto Supabase de ORIGEM (Lovable Cloud)
# para o projeto Supabase de DESTINO (o que você criou).
#
# NÃO edite este arquivo para colar senhas. Exporte as variáveis no seu terminal
# ANTES de rodar o script, assim elas não ficam salvas em nenhum arquivo:
#
#   export SOURCE_DB_URL="postgres://postgres:<SENHA_ORIGEM>@db.ieokhhjhvbqzqkuojkcw.supabase.co:5432/postgres"
#   export DEST_DB_URL="postgres://postgres:<SENHA_DESTINO>@db.<DEST_REF>.supabase.co:5432/postgres"
#   bash scripts/migrate-to-supabase.sh
#
# As duas connection strings ("Direct connection") estão em:
#   Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI
# Se a senha tiver caracteres especiais, faça percent-encoding (ex: @ -> %40).
#
# O script não apaga nada na origem. No destino, só faz INSERT (projeto novo,
# ainda sem dados). Os arquivos .sql intermediários ficam em .migration-tmp/
# (já está no .gitignore) para você poder inspecionar antes/depois.

set -euo pipefail

: "${SOURCE_DB_URL:?Defina SOURCE_DB_URL antes de rodar (ver comentário no topo do script)}"
: "${DEST_DB_URL:?Defina DEST_DB_URL antes de rodar (ver comentário no topo do script)}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/.migration-tmp"
SUPA="bunx supabase@2.109.1"

mkdir -p "$OUT_DIR"
cd "$ROOT_DIR"

echo "==> 1/4 Aplicando supabase/migrations no projeto de DESTINO (schema, RLS, triggers)"
$SUPA db push --db-url "$DEST_DB_URL" --include-all

echo "==> 2/4 Exportando dados de auth.users / auth.identities da ORIGEM"
$SUPA db dump --db-url "$SOURCE_DB_URL" --data-only --schema auth \
  -x "auth.audit_log_entries" \
  -x "auth.sessions" \
  -x "auth.refresh_tokens" \
  -x "auth.mfa_challenges" \
  -x "auth.mfa_amr_claims" \
  -x "auth.one_time_tokens" \
  -x "auth.flow_state" \
  -x "auth.sso_providers" \
  -x "auth.sso_domains" \
  -x "auth.saml_providers" \
  -x "auth.saml_relay_states" \
  -x "auth.schema_migrations" \
  -f "$OUT_DIR/auth_data.sql"
echo "    -> $OUT_DIR/auth_data.sql"

echo "==> 3/4 Exportando dados do schema public da ORIGEM"
$SUPA db dump --db-url "$SOURCE_DB_URL" --data-only --schema public \
  -f "$OUT_DIR/public_data.sql"
echo "    -> $OUT_DIR/public_data.sql"

echo "==> 4/4 Restaurando no DESTINO (auth antes de public, por causa das foreign keys)"
$SUPA db query --db-url "$DEST_DB_URL" -f "$OUT_DIR/auth_data.sql"
$SUPA db query --db-url "$DEST_DB_URL" -f "$OUT_DIR/public_data.sql"

echo ""
echo "==> Conferindo contagem de linhas no DESTINO:"
$SUPA db query --db-url "$DEST_DB_URL" "
  select 'auth.users' as tabela, count(*) from auth.users
  union all select 'auth.identities', count(*) from auth.identities
  union all select 'public.studies', count(*) from public.studies
  union all select 'public.user_roles', count(*) from public.user_roles
  union all select 'public.teams', count(*) from public.teams
  union all select 'public.api_usage', count(*) from public.api_usage
  order by 1;
"

echo ""
echo "Concluído. Compare essas contagens com as da origem antes de considerar migrado."
echo "Rode o mesmo SELECT trocando --db-url para \$SOURCE_DB_URL para comparar."
