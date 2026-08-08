#!/usr/bin/env bash
# =============================================================================
# Backup do .GRAMO (Postgres + arquivos do storage). Pensado para rodar por CRON
# no VPS de producao (setup docker-compose). Guarda legal: 5 anos -- leve os
# backups para FORA do servidor (S3/Backblaze/Drive) e teste o restore.
#
# Uso:  bash scripts/backup.sh [/caminho/dos/backups]
# Cron: 0 2 * * *  bash /repo/scripts/backup.sh /backup >> /var/log/repp-backup.log 2>&1
# =============================================================================
set -euo pipefail

DEST="${1:-/backup}"
DATA="$(date +%F_%H%M)"
mkdir -p "$DEST"

# 1) Banco de dados (dump logico comprimido).
docker exec repp-postgres pg_dump -U repp_owner repp | gzip > "$DEST/db_${DATA}.sql.gz"

# 2) Arquivos do storage (fotos/biometria, documentos, exportacoes) -- volume nomeado.
VOL="$(docker volume ls --format '{{.Name}}' | grep -E 'repp_storage$' | head -1)"
if [ -n "$VOL" ]; then
  docker run --rm -v "$VOL":/data -v "$DEST":/out alpine \
    tar czf "/out/storage_${DATA}.tar.gz" -C /data .
else
  echo "AVISO: volume repp_storage nao encontrado (docker volume ls)."
fi

# 3) Retencao local: mantem os ultimos 14 dias (o arquivo longo fica no destino externo).
find "$DEST" -name 'db_*.sql.gz' -mtime +14 -delete
find "$DEST" -name 'storage_*.tar.gz' -mtime +14 -delete

echo "Backup OK: $DEST/db_${DATA}.sql.gz + storage_${DATA}.tar.gz"
echo ">> Envie estes arquivos para um destino FORA do servidor e teste o restore periodicamente."
