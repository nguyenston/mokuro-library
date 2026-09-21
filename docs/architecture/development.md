# Development (with Hot-Reload)

This project is configured for a full-stack, containerized development environment using a `docker-compose.dev.yml` override file. This setup runs both the backend and frontend in separate, hot-reloading containers, which is the recommended workflow. Use `npm run dev:docker` for the standard dev entrypoint.

## How It Works

`docker-compose.dev.yml`: adds services for development:
  * **`mokuro` (Backend):** The `backend` service targets the `backend-builder` stage, mount local `./backend` folder, and run the `npm run dev` script. `ts-node-dev` watches your `src` files and restarts the Node.js server on changes.
  * **`frontend` (Frontend):** The `frontend` service targets the `frontend-builder` stage, mounts local `./frontend` folder, and runs the Vite dev server (`npm run dev -- --host`).

## Running the Dev Environment

1.  **First-Time Build (or when `package.json` changes):**
    You must build the dev images once to install all dependencies (including `devDependencies`).
    ```bash
    docker compose -f docker-compose.dev.yml build
    ```

2.  **Start the Dev Environment:**
    This command starts both the backend and frontend services.
    ```bash
    npm run dev:docker
    ```
    This wraps `docker compose -f docker-compose.dev.yml up` and injects `VITE_COMMIT_HASH` for the frontend.

3.  **Access the app:**
    * Open `http://localhost:5173` in your browser.
    * The SvelteKit app will load and automatically proxy all `/api` requests to the `backend` container, thanks to the `VITE_PROXY_TARGET` environment variable.

## Development Workflow

Once the containers are running.

### Changing `backend/src` or `frontend/src` Code
This is the most common case.
* **Backend:** Save a file in `backend/src`. The `backend` container's log will show `ts-node-dev` restarting the server.
* **Frontend:** Save a file in `frontend/src`. Your browser will instantly hot-reload with the changes.

### Changing `package.json` (Adding a Package)
This requires a **rebuild** to install the new dependencies in the image's `node_modules` layer.
1.  Stop the server (`Ctrl+C`).
2.  Tear down containers and volumes:
    ```bash
    npm run dev:docker -- down -v
    ```
3.  Rebuild and start:
    ```bash
    npm run dev:docker -- up --build
    ```

#### Changing `backend/prisma/schema.prisma` (Database Schema)
This requires a **restart** to run the migration, plus a manual client generation.
1.  Stop the server (`Ctrl+C`).
2.  **Run `prisma generate` on your host machine.** This updates local types for IDE/LSP usage.
    ```bash
    (cd backend && npx prisma generate)
    ```
3.  Tear down containers and volumes:
    ```bash
    npm run dev:docker -- down -v
    ```
4.  Rebuild and start:
    ```bash
    npm run dev:docker -- up --build
    ```
    On startup, the `backend` service's `npm run dev` script automatically executes `npx prisma db push`, which reads your mounted `schema.prisma` file and updates your persistent database in `./data`.

## Alternate: Hybrid Development (Frontend on Host)

If you prefer to run the frontend on your host machine (for faster hot-reloading), you can. The `vite.config.ts` file is designed to support this.

1.  **Start the Backend Only:**
    Use the *production* compose file. It will run the backend and handle API requests.
    ```bash
    docker compose up
    ```
2.  **Run Frontend on Host:**
    In a separate terminal, run the SvelteKit dev server on your host machine.
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
3.  **Access Your App:**
    * Open `http://localhost:5173` in your browser.
    * Your `vite.config.ts` will not find the `VITE_PROXY_TARGET` environment variable, so it will correctly default to proxying API requests to `http://localhost:3001` (the port exposed by your backend container).

## Production Wrapper

Recommended production launch:

```bash
npm run prod:docker
```

Manual alternative:

```bash
docker compose up -d
```

HTTPS redirects are disabled by default for LAN/NAS usage. If you deploy behind HTTPS, remove this env var to re-enable the HTTPS guard:

```bash
MOKURO_DISABLE_HTTPS_REDIRECT=true
```
