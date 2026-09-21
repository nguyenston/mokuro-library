#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/restore.sh <backup_db_file>"
  exit 1
fi

BACKUP_DB="$1"
DB_FILE="./data/mokuro.db"
if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_FILE="${DATABASE_URL#file:}"
fi

cp "$BACKUP_DB" "$DB_FILE"
echo "Restore completed."
