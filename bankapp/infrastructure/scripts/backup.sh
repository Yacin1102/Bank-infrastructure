#!/bin/bash
# Sauvegarde PostgreSQL — cron : 0 2 * * * root bash /opt/bankapp/infrastructure/scripts/backup.sh
set -euo pipefail
APP_DIR="/opt/bankapp"
BACKUP_DIR="${APP_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

echo "[$(date)] Sauvegarde..."
source .env 2>/dev/null || true

docker compose exec -T postgres pg_dump \
  -U "${DB_USER:-bankuser}" \
  -d "${DB_NAME:-bankdb}" \
  --format=plain --clean --if-exists \
  | gzip > "${BACKUP_DIR}/bankdb_${DATE}.sql.gz"

SIZE=$(du -sh "${BACKUP_DIR}/bankdb_${DATE}.sql.gz" | cut -f1)
echo "[$(date)] OK: bankdb_${DATE}.sql.gz (${SIZE})"

# Garder 30 jours
find "$BACKUP_DIR" -name "bankdb_*.sql.gz" -mtime +30 -delete
echo "[$(date)] Terminé. $(find "$BACKUP_DIR" -name '*.sql.gz' | wc -l) sauvegarde(s) conservée(s)."
