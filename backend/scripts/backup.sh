#!/usr/bin/env bash
# PostgreSQL Backup Automation Script (Linux / Production Docker / Railway)
# Usage: ./backend/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/accommodation_db_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[PostgreSQL Backup] Starting backup to: ${BACKUP_FILE}"

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-accommodation_db}"

# Execute pg_dump with custom format (-F c)
pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -F c -b -v -f "${BACKUP_FILE}" "${PGDATABASE}"

if [ -f "${BACKUP_FILE}" ]; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[PostgreSQL Backup] Success! Size: ${FILE_SIZE}"

  # Prune backups older than retention window
  find "${BACKUP_DIR}" -name "accommodation_db_*.dump" -type f -mtime "+${RETENTION_DAYS}" -delete
  echo "[PostgreSQL Backup] Pruned backups older than ${RETENTION_DAYS} days."
else
  echo "[PostgreSQL Backup] ERROR: Backup file not found."
  exit 1
fi
