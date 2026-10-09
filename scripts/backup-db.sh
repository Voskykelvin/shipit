#!/bin/bash
# ==============================================================================
# Ship It Fulfillment OS — Automated PostgreSQL Database Backup Script
# Creates a compressed, timestamped pg_dump with retention rotation (14 days).
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="shipit_db_backup_${TIMESTAMP}.sql.gz"
TARGET_PATH="${BACKUP_DIR}/${FILENAME}"

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-shipit}"
DB_NAME="${POSTGRES_DB:-shipit}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Ship It PostgreSQL backup for ${DB_NAME}..."

PGPASSWORD="${POSTGRES_PASSWORD:-shipit}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-privileges \
    | gzip -9 > "${TARGET_PATH}"

BACKUP_SIZE=$(du -h "${TARGET_PATH}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup created: ${TARGET_PATH} (Size: ${BACKUP_SIZE})"

# Optional S3 Cloud Sync
if [[ -n "${S3_BACKUP_BUCKET:-}" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploading backup to S3 bucket ${S3_BACKUP_BUCKET}..."
    aws s3 cp "${TARGET_PATH}" "s3://${S3_BACKUP_BUCKET}/postgres/${FILENAME}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] S3 upload complete."
fi

# Rotate old backups
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "shipit_db_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup job successfully completed."
