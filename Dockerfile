# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
# Copy only package files first for better caching
COPY frontend/package*.json ./
RUN npm ci
# Copy the rest of the frontend source
COPY frontend/ .
# Build into /app/frontend/build
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .

# Creates a new, fresh library.db file
RUN npx prisma db push
# Generate Prisma client
RUN npx prisma generate
# Build backend TypeScript into /app/backend/dist
RUN npm run build

# --- Stage 3: Final Runtime Image ---
FROM node:22-alpine
WORKDIR /app

# Install production dependencies for backend only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy built backend code
COPY --from=backend-builder /app/backend/dist ./dist
# Copy Prisma schema and sample database
COPY --from=backend-builder /app/backend/prisma/schema.prisma ./prisma/
COPY --from=backend-builder /app/backend/prisma/library.db ./prisma/

# Copy Prisma client
COPY --from=backend-builder /app/backend/src/generated/prisma ./dist/generated/prisma

# Copy built frontend static files to the expected location
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Environment variables (can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:/app/data/library.db"

# Expose the port
EXPOSE 3001

# Create a volume mount point for persistent data (uploads and db)
VOLUME ["/app/uploads", "/app/data"]

# ---
# Add and use the entrypoint script
# ---
# Copy the script into the image
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# Convert Windows line endings to Unix
# Install dos2unix, run it on the script, and remove it
RUN apk add --no-cache dos2unix \
    && dos2unix /app/docker-entrypoint.sh \
    && apk del dos2unix

# Make the script executable
RUN chmod +x /app/docker-entrypoint.sh

# Set the entrypoint to run our script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# This command is passed to the entrypoint script (as the "$@")
CMD ["node", "dist/server.js"]
