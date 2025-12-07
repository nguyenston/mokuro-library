# Feature Spec: Windows Portable Executable

## 1. Overview & Goal
**Goal:** To distribute Mokuro Library as a standalone, "portable" Windows application.

**User Story:** A Windows user can download a single ZIP file, extract it, and run `MokuroLibrary.exe`. The app starts a local server and opens their browser automatically, without needing Docker, Node.js installed, or complex setup.

## 2. Technical Architecture

This feature wraps the existing Fastify backend into a **Monolithic "Local Server"** using the native **Node.js Single Executable Application (SEA)** feature.

### 2.1. The "Local Server" Model
* **Runtime:** We use the user's installed Node.js binary (v20+) as the base. We inject the application code directly into a copy of this executable using `postject`.
* **Bundling:** We use **esbuild** to bundle the entire backend into a single `bundle.js` file before injection.
* **Database:** We use **SQLite** (`better-sqlite3`) with a custom **Runtime Migration Runner**. This ensures the database is created and updated automatically when the user runs the app, without needing the heavy Prisma CLI binaries.

### 2.2. Folder Structure (Release Artifact)
The build script generates a `release/` folder which is distributed to the user:

```text
MokuroLibrary/
├── data/                 # Created on first run (Database)
├── frontend/             # Static frontend assets
│   └── build/            # Served by Fastify
├── node_modules/         # Native modules (MUST accompany the exe)
│   ├── .prisma/          # Prisma Query Engine (windows.dll.node)
│   └── better-sqlite3/   # SQLite bindings
├── prisma/
│   ├── migrations/       # SQL files for runtime migration
│   └── schema.prisma     # Required by Prisma Client
├── uploads/              # Stores uploaded files
└── mokuro-library.exe    # The application (Node.js + Bundled Code)
```

## 3. Implementation Details

### 3.1. Build Pipeline (`scripts/build-exe.js`)
We use a custom orchestration script (`npm run build:exe`) that automates the Node.js SEA workflow:

1.  **Build Frontend:** Runs `vite build` (Adapter Static) and copies output to `release/frontend/build`.
2.  **Bundle Backend:** Uses **esbuild** to compile TypeScript into a single CommonJS bundle.
    * *Polyfill:* We inject a custom `require` shim at the top of the bundle so it can load native modules from the external `node_modules` folder.
3.  **Generate SEA Blob:** Converts the bundle into a binary blob (`sea-prep.blob`).
4.  **Injection:** Copies the host's `node.exe`, renames it, and uses `postject` to insert the blob.
5.  **Asset Copying:** Copies critical runtime dependencies that cannot be bundled:
    * `prisma/migrations` (for DB initialization).
    * `node_modules` (Prisma Engine & SQLite native binaries).

### 3.2. Entry Point (`exe-entry.ts`)
A dedicated entry file bootstraps the environment before starting the server.

* **Environment:** Sets `DATABASE_URL` relative to the executable's path.
* **Hoisting Fix:** Uses `require('./server')` instead of `import` to ensure environment variables are set *before* the application loads.
* **Migration Runner:**
    * On startup, it scans `prisma/migrations`.
    * It creates a lightweight tracking table: `_app_migrations`.
    * It applies any missing SQL files inside a transaction using `better-sqlite3` directly.
    * This removes the need to ship the 50MB+ Prisma Migration Engine.

## 4. Development & Limitations

* **Native Modules:** Native addons (like `better-sqlite3`) **cannot** be bundled inside the `.exe` by Node SEA. They must exist in a `node_modules` folder next to the executable.
* **Prisma Integrity:** We use a shadow migration table (`_app_migrations`) instead of the standard `_prisma_migrations`. This avoids checksum validation crashes but means the database file is not strictly "Prisma-compliant" if moved back to a development environment (requires manual resolution).
