#!/bin/sh

# This is the path to the database file inside the persistent volume.
DB_FILE="/app/data/library.db"

# This is the path to the "seed" database being copied into the image.
SEED_DB_FILE="/app/prisma/library.db"

# Ensure the data directory exists
mkdir -p /app/data

# Check if the database file does NOT exist in the volume
if [ ! -f "$DB_FILE" ]; then
  echo "Database file not found. Copying seed database..."
  # Copy the seed database from the image to the volume
  cp "$SEED_DB_FILE" "$DB_FILE"
else
  echo "Database file already exists. Skipping copy."
fi

# 'exec "$@"' is the most important part.
# It replaces the script process with the command you passed
# to 'docker run' (which is the CMD from your Dockerfile: "node dist/server.js").
exec "$@"
