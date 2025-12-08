#!/usr/bin/env bash
set -euo pipefail

CONTAINER="wms_postgres"
BACKUP_DIR="backups"
DB_USER="wms"
DB_NAME="wms"

ensure_container() {
  if ! docker ps -q -f "name=${CONTAINER}" >/dev/null; then
    echo "Container ${CONTAINER} is not running. Start stack with 'docker compose up -d'." >&2
    exit 1
  fi
}

cmd_backup() {
  ensure_container
  mkdir -p "${BACKUP_DIR}"
  TS=$(date +%Y%m%d)
  FILE="${BACKUP_DIR}/wms_backup_${TS}.sql"
  echo "Creating backup to ${FILE} ..."
  docker exec -t "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" > "${FILE}"
  echo "Backup completed: ${FILE}"
}

cmd_restore() {
  ensure_container
  local FILE="${1:-}"
  if [[ -z "${FILE}" ]]; then
    echo "Usage: $0 restore <backup_file.sql>" >&2
    exit 1
  fi
  if [[ ! -f "${FILE}" ]]; then
    echo "File not found: ${FILE}" >&2
    exit 1
  fi
  echo "WARNING: restore will overwrite data in database '${DB_NAME}' inside container ${CONTAINER}."
  read -r -p "Continue? [y/N] " ans
  if [[ ! "${ans}" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
  fi
  echo "Restoring from ${FILE} ..."
  docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" < "${FILE}"
  echo "Restore completed."
}

case "${1:-}" in
  backup) cmd_backup ;;
  restore) shift; cmd_restore "$@" ;;
  *)
    cat <<EOF
Usage: $0 {backup|restore <file.sql>}

Backup example:
  $0 backup

Restore example:
  $0 restore backups/wms_backup_YYYYMMDD.sql
EOF
    exit 1
    ;;
esac
