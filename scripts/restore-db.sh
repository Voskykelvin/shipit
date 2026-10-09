#!/bin/bash
# ==============================================================================
# Ship It Fulfillment OS — Database Disaster Recovery Restore Script
# Restores a compressed SQL dump into PostgreSQL.
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-shipit}"
DB_NAME="${POSTGRES_DB:-shipit}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file ${BACKUP_FILE} not found."
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring Ship It database from ${BACKUP_FILE}..."

PGPASSWORD="${POSTGRES_PASSWORD:-shipit}" gunzip -c "${BACKUP_FILE}" | psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database successfully restored."
