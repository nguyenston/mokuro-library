# Mokuro Library

Mokuro Library is a self-hosted, multi-user web application designed to run on a NAS or home server. It provides a web-based reader for manga processed with [Mokuro](https://github.com/kha-white/mokuro), solving browser storage limitations by keeping all library files, metadata, and user progress on the server.



## 🌟 Core Features

For more details, read [the specification](specification.md):
* **Multi-User Authentication:** Separate accounts for different users, with progress and settings saved per-user.
* **Server-Side Library:** Upload entire Mokuro-processed directories. The server parses the structure and populates the database.
* **Persistent, Per-User Progress:** Reading progress, page, and completion status are saved to the database for each user/+page.svelte].
* **Persistent Reader Settings:** All reader preferences (layout, direction, etc.) are saved to your account.
* **Live OCR Editing:** Edit and correct OCR text blocks directly in the reader UI. Changes are saved back to the `.mokuro` file on the server.
* **Dockerized Deployment:** A single Docker container runs the entire application, making setup and maintenance simple.
* **Volume & Series Management:** Upload series covers, delete individual volumes, or remove entire series from your library/+page.svelte].

## 💻 Technology Stack

This project is a monorepo containing a decoupled frontend and backend.

* **Backend:** **Node.js** with **Fastify** for high-performance routing.
* **Frontend:** **SvelteKit** with **TypeScript** and **Tailwind CSS**.
* **Database:** **SQLite** for simple, file-based data persistence.
* **ORM:** **Prisma** for type-safe database access and migrations.
* **Containerization:** **Docker** and **Docker Compose**.

## 🚀 Deployment (Production)

The recommended way to run Mokuro Library is with Docker Compose.

1.  **Build the Image:**
    This command builds the production-ready Docker image, compiling both the frontend and backend.
    ```bash
    docker compose build --no-cache
    ```

2.  **Run the Container:**
    This starts the container in detached mode.
    ```bash
    docker compose up -d
    ```
    Your library is now accessible at `http://localhost`. The following local folders will be created to store your persistent data:
    * `./data`: Stores your `library.db` database file.
    * `./data/uploads`: Stores all uploaded manga files.

### Updating the Application

When you pull new changes from Git or modify the schema:

1.  **Re-build the image:**
    ```bash
    docker compose build
    ```
2.  **Re-create the container:**
    The `--force-recreate` flag is necessary to apply the new image. The entrypoint script will automatically run any database migrations.
    ```bash
    docker compose up -d --force-recreate
    ```
    Your data in the `./data` folder will be preserved.

## 🛠️ Development (with Hot-Reload)

A separate development environment is configured for hot-reloading the backend.

1.  **Initial Build:**
    You must build the development container once to install all `devDependencies`.
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml build
    ```

2.  **Start the Dev Server:**
    This command starts the container using the `docker-compose.dev.yml` overrides.
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
    ```
    This does the following:
    * Mounts your local `./backend` folder into the container.
    * Runs the `npm run dev` script, which starts `ts-node-dev`.
    * `ts-node-dev` will watch your `backend/src` directory and automatically restart the server on any file changes.

3.  **Frontend Development:**
    The dev compose file does not serve the frontend. You must run the SvelteKit dev server on your host machine:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    Your frontend will be available at `http://localhost:5173`, and it will proxy all `/api` requests to the backend container running on port `3001`.

### Development Schema Changes

If you change `backend/prisma/schema.prisma` while developing:

1.  **Stop** the dev server (`Ctrl+C`).
2.  **Run `prisma generate`** to update the client. You can run this on your host or in the container:
    ```bash
    # Run on host
    (cd backend && npx prisma generate)
    
    # OR run in container
    docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm mokuro npx prisma generate
    ```
3.  **Restart** the dev server:
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
    ```
    On startup, the `npm run dev` script will automatically run `npx prisma db push` to migrate your dev database.
