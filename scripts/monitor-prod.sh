#!/usr/bin/env bash
# Monitor de producao do .GRAMO (REP-P). Roda NO servidor por cron (cada 15 min).
#
# Checa saude e REGISTRA em /root/monitor.log. Sem alerta ativo por enquanto: o
# canal (webhook/e-mail) pluga no bloco ALERTA abaixo em 1 linha. O exit code e
# 2 em caso CRIT, entao um alerting futuro pode reagir so ao codigo de saida.
set -uo pipefail

SITE="https://gramoengenharia.online/"
DOMINIO="gramoengenharia.online"
API_READY="http://localhost:3000/api/v1/health/ready"
LOG="/root/monitor.log"
DISCO_WARN=80
DISCO_CRIT=90
CERT_WARN_DIAS=20
BACKUP_MAX_HORAS=26
CONTAINERS="repp-web repp-api repp-caddy repp-postgres"

status="OK"
problemas=""
marca() { # nivel mensagem...
  local nivel="$1"
  shift
  [ "$nivel" = "CRIT" ] && status="CRIT"
  [ "$nivel" = "WARN" ] && [ "$status" != "CRIT" ] && status="WARN"
  problemas="$problemas [$nivel] $*"
}

# 1) Site publico responde 200?
code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 15 "$SITE" || echo 000)
[ "$code" = "200" ] || marca CRIT "site HTTP=$code"

# 2) API de pe e banco acessivel?
ready=$(curl -s --max-time 15 "$API_READY" || echo "")
echo "$ready" | grep -q '"db":"up"' || marca CRIT "api/ready=${ready:-vazio}"

# 3) Todos os containers no ar?
for c in $CONTAINERS; do
  docker ps --format '{{.Names}}' | grep -qx "$c" || marca CRIT "container fora: $c"
done

# 4) Disco.
uso=$(df / | awk 'NR==2{gsub("%","",$5); print $5}')
if [ "${uso:-0}" -ge "$DISCO_CRIT" ]; then
  marca CRIT "disco ${uso}%"
elif [ "${uso:-0}" -ge "$DISCO_WARN" ]; then
  marca WARN "disco ${uso}%"
fi

# 5) Validade do certificado TLS (Caddy renova sozinho; isto e uma rede de seguranca).
fim=$(echo | openssl s_client -servername "$DOMINIO" -connect "$DOMINIO":443 2>/dev/null |
  openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$fim" ]; then
  dias=$((($(date -d "$fim" +%s) - $(date +%s)) / 86400))
  [ "$dias" -lt "$CERT_WARN_DIAS" ] && marca WARN "cert vence em ${dias}d"
else
  marca WARN "nao consegui ler o certificado"
fi

# 6) O backup da noite rodou? (frescor do dump mais recente)
novo=$(ls -t /root/backups/db/gramo-db-*.dump 2>/dev/null | head -1)
if [ -z "$novo" ]; then
  marca CRIT "sem backup de banco"
else
  idade_h=$((($(date +%s) - $(stat -c %Y "$novo")) / 3600))
  [ "$idade_h" -gt "$BACKUP_MAX_HORAS" ] && marca WARN "backup com ${idade_h}h (esperado <=${BACKUP_MAX_HORAS}h)"
fi

# Registra uma linha e mantem o log enxuto (ultimas 5000 linhas).
linha="[$(date '+%F %T')] $status$problemas"
echo "$linha" >> "$LOG"
tail -n 5000 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"

# --- ALERTA (pluga aqui quando escolher o canal) --------------------------
# if [ "$status" != "OK" ]; then
#   curl -s -X POST "$WEBHOOK_URL" --data-urlencode "text=[.GRAMO] $linha" >/dev/null
# fi
# --------------------------------------------------------------------------

[ "$status" = "CRIT" ] && exit 2
exit 0
