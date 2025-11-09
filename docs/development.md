# 🛠️ Development (with Hot-Reload)

This project is configured for a full-stack, containerized development environment using a `docker-compose.dev.yml` override file. This setup runs both the backend and frontend in separate, hot-reloading containers, which is the recommended workflow.

## How It Works

The `docker compose -f docker-compose.yml -f docker-compose.dev.yml ...` command merges two files:
1.  `docker-compose.yml`: Provides the base configuration (like service names and data volumes).
2.  `docker-compose.dev.yml`: Overrides and adds services for development:
    * **`mokuro` (Backend):** The `mokuro` service is overridden to target the `backend-builder` stage, mount local `./backend` folder, and run the `npm run dev` script. `ts-node-dev` watches your `src` files and restarts the Node.js server on changes.
    * **`frontend` (Frontend):** A new `frontend` service is added. It targets the `frontend-builder` stage, mounts local `./frontend` folder, and runs the Vite dev server (`npm run dev -- --host`).

## Running the Dev Environment

1.  **First-Time Build (or when `package.json` changes):**
    You must build the dev images once to install all dependencies (including `devDependencies`).
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml build
    ```

2.  **Start the Dev Environment:**
    This command starts both the backend and frontend services.
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
    ```

3.  **Access the app:**
    * Open `http://localhost:5173` in your browser.
    * The SvelteKit app will load and automatically proxy all `/api` requests to the `mokuro` backend container, thanks to the `VITE_PROXY_TARGET` environment variable.

## Development Workflow

Once the containers are running.

### Changing `backend/src` or `frontend/src` Code
This is the most common case.
* **Backend:** Save a file in `backend/src`. The `mokuro` container's log will show `ts-node-dev` restarting the server.
* **Frontend:** Save a file in `frontend/src`. Your browser will instantly hot-reload with the changes.

### Changing `package.json` (Adding a Package)
This requires a **rebuild** to install the new dependencies in the image's `node_modules` layer.
1.  Stop the server (`Ctrl+C`).
2.  Run the `build` command:
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml build
    ```
3.  Restart the server:
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
    ```

#### Changing `backend/prisma/schema.prisma` (Database Schema)
This requires a **restart** to run the migration, plus a manual client generation.
1.  Stop the server (`Ctrl+C`).
2.  **Run `prisma generate` on your host machine.** This is necessary to update your local `backend/src/generated/prisma` folder, which is mounted into the container.
    ```bash
    (cd backend && npx prisma generate)
    ```
3.  **Restart the server:**
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
    ```
    On startup, the `mokuro` service's `npm run dev` script automatically executes `npx prisma db push`, which reads your mounted `schema.prisma` file and updates your persistent database in `./data`.

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
