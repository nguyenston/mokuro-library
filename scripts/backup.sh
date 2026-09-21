#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

DB_FILE="./data/mokuro.db"
if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_FILE="${DATABASE_URL#file:}"
fi

UPLOADS_DIR="./uploads"

mkdir -p "$BACKUP_DIR"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/library_$DATE.db'"
else
  echo "sqlite3 not found; copy the database file manually."
  cp "$DB_FILE" "$BACKUP_DIR/library_$DATE.db"
fi

if [[ -d "$UPLOADS_DIR" ]]; then
  tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C . uploads
fi

find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete || true
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete || true

echo "Backup completed: $DATE"
