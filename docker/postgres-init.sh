#!/bin/bash
# =============================================================================
# Inicializacao do Postgres (roda uma vez na criacao do volume).
# O container ja criou POSTGRES_USER (repp_owner), dono do banco.
# Aqui criamos a role da aplicacao repp_app: NOSUPERUSER e NOBYPASSRLS,
# para que o Row Level Security seja de fato aplicado a ela.
# =============================================================================
set -euo pipefail

: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD nao definida}"
: "${POSTGRES_SUPER_PASSWORD:?POSTGRES_SUPER_PASSWORD nao definida}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set app_password="$POSTGRES_APP_PASSWORD" --set super_password="$POSTGRES_SUPER_PASSWORD" <<'EOSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'repp_app') THEN
    EXECUTE format(
      'CREATE ROLE repp_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
      :'app_password'
    );
  END IF;
  -- Role da PLATAFORMA (Super Admin): sem acesso a dados operacionais (ver RLS).
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'repp_super') THEN
    EXECUTE format(
      'CREATE ROLE repp_super LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
      :'super_password'
    );
  END IF;
END $$;
EOSQL

# Grant de conexao (grants de tabela vem do rls-policies.sql, pos-migrations).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "GRANT CONNECT ON DATABASE \"$POSTGRES_DB\" TO repp_app;" \
  -c "GRANT CONNECT ON DATABASE \"$POSTGRES_DB\" TO repp_super;"
