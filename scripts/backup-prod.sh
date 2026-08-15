#!/usr/bin/env bash
# Backup de producao do .GRAMO (REP-P): Postgres + volume de storage cifrado.
#
# Roda NO servidor (VPS Hostinger), agendado via cron (ver README abaixo). Faz
# dump logico do banco (pg_dump -Fc), tar do storage, VERIFICA a integridade de
# ambos (backup que nao restaura nao e backup), mantem retencao e registra log.
#
# Nao le nem imprime segredos: usuario/DB do Postgres sao resolvidos DENTRO do
# container. Uso: ./backup-prod.sh   (sem argumentos)
set -euo pipefail

PG_CONTAINER="repp-postgres"
STORAGE_VOLUME="rep-p_repp_storage"
BACKUP_ROOT="/root/backups"
DB_DIR="$BACKUP_ROOT/db"
STORAGE_DIR="$BACKUP_ROOT/storage"
LOG="$BACKUP_ROOT/backup.log"
RETENCAO_DIAS=14
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DB_DIR" "$STORAGE_DIR"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

log "=== inicio backup $TS ==="

# 1) Banco: pg_dump formato custom (-Fc) — comprimido e com restauracao seletiva.
DB_FILE="$DB_DIR/gramo-db-$TS.dump"
docker exec "$PG_CONTAINER" sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$DB_FILE"
log "dump do banco: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

# 2) Verifica que o dump e restauravel (le o indice/TOC; falha se truncado).
if docker exec -i "$PG_CONTAINER" pg_restore -l < "$DB_FILE" > /dev/null 2>&1; then
  log "OK: dump valido (pg_restore -l leu o indice)"
else
  log "ERRO: dump invalido/corrompido -- abortando"
  rm -f "$DB_FILE"
  exit 1
fi

# 3) Storage cifrado (fotos/documentos/comprovantes) -> tar.gz do volume (ro).
STORAGE_FILE="$STORAGE_DIR/gramo-storage-$TS.tar.gz"
docker run --rm -v "$STORAGE_VOLUME":/data:ro -v "$STORAGE_DIR":/backup alpine \
  tar czf "/backup/$(basename "$STORAGE_FILE")" -C /data .
log "backup storage: $STORAGE_FILE ($(du -h "$STORAGE_FILE" | cut -f1))"

# 4) Verifica integridade do tar.
if tar -tzf "$STORAGE_FILE" > /dev/null 2>&1; then
  log "OK: tar do storage integro"
else
  log "ERRO: tar do storage corrompido -- abortando"
  rm -f "$STORAGE_FILE"
  exit 1
fi

# 5) Checksums SHA-256 (deteccao de bit-rot ao longo do tempo).
( cd "$BACKUP_ROOT" && sha256sum "db/$(basename "$DB_FILE")" "storage/$(basename "$STORAGE_FILE")" >> checksums.txt )

# 6) Retencao: remove backups com mais de RETENCAO_DIAS dias.
find "$DB_DIR" -name 'gramo-db-*.dump' -mtime +"$RETENCAO_DIAS" -delete
find "$STORAGE_DIR" -name 'gramo-storage-*.tar.gz' -mtime +"$RETENCAO_DIAS" -delete

log "=== fim backup $TS (OK) ==="
