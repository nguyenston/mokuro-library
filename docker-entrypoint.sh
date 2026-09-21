#!/bin/sh

# This is the path to the database file inside the persistent volume.
DB_FILE="/app/data/library.db"

# This is the path to the "seed" database being copied into the image.
SEED_DB_FILE="/app/prisma/library.db"

# Ensure the data directory exists
mkdir -p /app/data

# ---
# SECURITY SECRETS GENERATION ---
# ---
# Generate secure secrets if not provided via environment variables
generate_secret() {
    # Use node to generate a secure random hex string
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

# Check and generate JWT_SECRET if not provided
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change-me-in-production" ]; then
    echo "WARNING: JWT_SECRET not provided or using default value"
    echo "Generating a secure JWT_SECRET..."
    export JWT_SECRET=$(generate_secret)
    echo "✓ Generated JWT_SECRET"
fi

# Check and generate COOKIE_SECRET if not provided
if [ -z "$COOKIE_SECRET" ] || [ "$COOKIE_SECRET" = "change-me-in-production" ]; then
    echo "WARNING: COOKIE_SECRET not provided or using default value"
    echo "Generating a secure COOKIE_SECRET..."
    export COOKIE_SECRET=$(generate_secret)
    echo "✓ Generated COOKIE_SECRET"
fi

# Save generated secrets to a file for reference (in the persistent volume)
SECRETS_FILE="/app/data/.generated-secrets"
if [ ! -f "$SECRETS_FILE" ]; then
    echo "Saving generated secrets to $SECRETS_FILE"
    cat > "$SECRETS_FILE" << EOF
# Auto-generated secrets for Mokuro Library
# Generated on: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# IMPORTANT: These secrets were auto-generated because you didn't provide them.
# For production use, you should set JWT_SECRET and COOKIE_SECRET in your
# docker-compose.yml or use the ./scripts/generate-secrets.sh script.

JWT_SECRET=$JWT_SECRET
COOKIE_SECRET=$COOKIE_SECRET
EOF
    chmod 600 "$SECRETS_FILE"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  IMPORTANT: Auto-generated secrets saved to:"
    echo "  $SECRETS_FILE"
    echo ""
    echo "  For production deployments, you should:"
    echo "  1. Copy these secrets to a secure location"
    echo "  2. Set them as environment variables in docker-compose.yml"
    echo "  3. OR run: ./scripts/generate-secrets.sh .env.secrets"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
fi
# ---

# Check if the database file does NOT exist in the volume
if [ ! -f "$DB_FILE" ]; then
  echo "Database file not found. Copying seed database..."
  # Copy the seed database from the image to the volume
  cp "$SEED_DB_FILE" "$DB_FILE"
else
  echo "Database file already exists. Skipping copy."
fi
# ---
# DATABASE MIGRATION ---
# ---
echo "Running database schema push to ensure schema is up to date..."
# This command connects to the persistent database and applies
# any pending schema changes from schema.prisma.
npx prisma migrate deploy
echo "Schema is up to date."
# ---

# 'exec "$@"' is the most important part.
# It replaces the script process with the command you passed
# to 'docker run' (which is the CMD from your Dockerfile: "node dist/server.js").
exec "$@"
