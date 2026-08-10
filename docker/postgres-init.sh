#!/bin/bash
# =============================================================================
# Inicializacao do Postgres (roda uma vez na criacao do volume).
# O container ja criou POSTGRES_USER (repp_owner), dono do banco.
# Aqui criamos as roles da aplicacao:
#   repp_app   : NOSUPERUSER + NOBYPASSRLS -> o Row Level Security se aplica a ela.
#   repp_super : role da plataforma (Super Admin), sem acesso a dados operacionais.
# =============================================================================
set -euo pipefail

: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD nao definida}"
: "${POSTGRES_SUPER_PASSWORD:?POSTGRES_SUPER_PASSWORD nao definida}"

# As senhas (base64url: apenas [A-Za-z0-9_-]) sao injetadas pelo shell direto no
# SQL. NAO se usa variavel do psql (:'x') porque o psql NAO faz substituicao de
# variaveis dentro de um bloco DO $$...$$ -> resultava em "syntax error at or
# near :". Heredoc SEM aspas (EOSQL) para o shell expandir ${...}; o $ do
# dollar-quote e escapado (\$do\$) para nao ser interpretado pelo shell.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
DO \$do\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'repp_app') THEN
    CREATE ROLE repp_app LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'repp_super') THEN
    CREATE ROLE repp_super LOGIN PASSWORD '${POSTGRES_SUPER_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
\$do\$;

-- Grant de conexao (grants de tabela vem do rls-policies.sql, pos-migrations).
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO repp_app;
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO repp_super;
EOSQL
