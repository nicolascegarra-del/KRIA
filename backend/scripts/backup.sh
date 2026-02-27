#!/bin/bash
# AGAMUR daily backup script
# Cron: 0 3 * * * /app/scripts/backup.sh >> /var/log/agamur_backup.log 2>&1

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/agamur_backups"
DB_BACKUP="agamur_db_${TIMESTAMP}.dump"
MINIO_BUCKET="${MINIO_BUCKET_NAME:-agamur}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}"
RETENTION_DAYS=30

echo "[${TIMESTAMP}] Starting AGAMUR backup..."

mkdir -p "${BACKUP_DIR}"

# ── PostgreSQL dump ───────────────────────────────────────────────────────────
echo "Dumping PostgreSQL..."
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --no-password \
  --file="${BACKUP_DIR}/${DB_BACKUP}"

echo "DB dump: ${DB_BACKUP} ($(du -sh "${BACKUP_DIR}/${DB_BACKUP}" | cut -f1))"

# ── Upload to MinIO backups/ prefix ──────────────────────────────────────────
echo "Uploading to MinIO backups/..."
mc alias set minio "http://${MINIO_ENDPOINT}" \
  "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" --quiet

mc cp "${BACKUP_DIR}/${DB_BACKUP}" "minio/${MINIO_BUCKET}/backups/${DB_BACKUP}"

echo "Upload complete."

# ── Cleanup local temp ───────────────────────────────────────────────────────
rm -f "${BACKUP_DIR}/${DB_BACKUP}"

# ── Remove old backups from MinIO ─────────────────────────────────────────────
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
mc find "minio/${MINIO_BUCKET}/backups/" \
  --older-than "${RETENTION_DAYS}d" \
  --name "*.dump" \
  | xargs -I{} mc rm {}

echo "[${TIMESTAMP}] Backup complete."
