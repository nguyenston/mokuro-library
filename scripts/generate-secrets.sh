#!/bin/sh
# Script to generate secure secrets for Mokuro Library
# This should be run inside the Docker container or on the host

set -e

SECRETS_FILE="${1:-.env.secrets}"

# Function to generate a random hex string
generate_secret() {
    # Use node if available, otherwise use openssl
    if command -v node >/dev/null 2>&1; then
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    elif command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 32
    else
        # Fallback to /dev/urandom
        head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
    fi
}

echo "Generating secrets for Mokuro Library..."

# Generate secrets
JWT_SECRET=$(generate_secret)
COOKIE_SECRET=$(generate_secret)

# Create secrets file
cat > "$SECRETS_FILE" << EOF
# Generated secrets for Mokuro Library
# DO NOT COMMIT THIS FILE TO VERSION CONTROL
# Generated on: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

JWT_SECRET=$JWT_SECRET
COOKIE_SECRET=$COOKIE_SECRET
EOF

chmod 600 "$SECRETS_FILE"

echo "✓ Secrets generated and saved to: $SECRETS_FILE"
echo ""
echo "IMPORTANT:"
echo "1. Keep this file secure and do NOT commit it to version control"
echo "2. Add '$SECRETS_FILE' to your .gitignore file"
echo "3. Use these secrets in your docker-compose.yml or .env file"
echo ""
echo "For Docker Compose, add this to your compose file:"
echo "  environment:"
echo "    - JWT_SECRET=\${JWT_SECRET}"
echo "    - COOKIE_SECRET=\${COOKIE_SECRET}"
echo ""
echo "Then run: docker-compose --env-file $SECRETS_FILE up -d"
