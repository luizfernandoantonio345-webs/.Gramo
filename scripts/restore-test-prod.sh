#!/usr/bin/env bash
# Restore-test (drill de recuperacao) do backup do .GRAMO. Restaura o dump mais
# recente num banco DESCARTAVEL, confere estrutura e APAGA. Registra em
# /root/restore-test.log. Roda por cron (mensal). NAO toca no banco real.
#
# "Backup que nunca foi restaurado e apenas uma esperanca" -- este script troca
# a esperanca por evidencia, periodicamente.
set -uo pipefail

PG=repp-postgres
LOG=/root/restore-test.log
DB_TESTE=gramo_restore_test
MIN_TABELAS=20 # o schema tem ~37 tabelas; <20 = restore incompleto
log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

DUMP=$(ls -t /root/backups/db/gramo-db-*.dump 2>/dev/null | head -1)
if [ -z "$DUMP" ]; then
  log "FALHA: nenhum backup encontrado em /root/backups/db"
  exit 1
fi
log "=== inicio restore-test: $(basename "$DUMP") ==="

# Restaura num banco isolado (usuario/DB resolvidos DENTRO do container).
docker exec "$PG" sh -c 'dropdb -U "$POSTGRES_USER" --if-exists gramo_restore_test' > /dev/null 2>&1 || true
docker exec "$PG" sh -c 'createdb -U "$POSTGRES_USER" gramo_restore_test'
# So o pg_restore usa -i, com o dump redirecionado do host (nao engole o script).
docker exec -i "$PG" sh -c 'pg_restore -U "$POSTGRES_USER" -d gramo_restore_test --no-owner --no-privileges' \
  < "$DUMP" 2> /tmp/restore-test.err || true

tabelas=$(docker exec "$PG" sh -c 'psql -tA -U "$POSTGRES_USER" -d gramo_restore_test -c "select count(*) from information_schema.tables where table_schema='"'"'public'"'"' and table_type='"'"'BASE TABLE'"'"';"' | tr -d '[:space:]')

# Limpa o banco de teste SEMPRE (mesmo se a contagem falhar).
docker exec "$PG" sh -c 'dropdb -U "$POSTGRES_USER" gramo_restore_test' > /dev/null 2>&1 || true

if [ "${tabelas:-0}" -ge "$MIN_TABELAS" ]; then
  log "OK: backup restaura (${tabelas} tabelas). DB de teste removido."
  exit 0
fi
log "FALHA: restore trouxe ${tabelas:-0} tabelas (esperado >=${MIN_TABELAS}). Ver /tmp/restore-test.err"
exit 2
