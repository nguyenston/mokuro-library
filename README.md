# Mokuro Library

Mokuro Library is a **self-hosted, multi-user, server-side** application for a [Mokuro](https://github.com/kha-white/mokuro)-processed manga library.
It's designed to run on a NAS/home server or local computer, providing a centralized, persistent library with per-user progress and settings, all deployed by a simple Docker container.



## 🌟 Core Features

For more details, read [the specification](docs/specification.md):
* **Multi-User Authentication:** Separate accounts for different users, with progress and settings saved per-user.
* **Server-Side Library:** Upload entire Mokuro-processed directories. All files are managed by the server.
* **Persistent, Per-User Progress:** Reading progress, page, and completion status are saved to the database for each user.
* **Persistent Reader Settings:** All reader preferences (layout, direction, etc.) are saved to your account.
* **Live OCR Editing:** Edit and correct OCR text blocks directly in the reader UI. Changes are saved back to the `.mokuro` file on the server.
* **Dockerized Deployment:** A single Docker container runs the entire application, making setup and maintenance simple.
* **Volume & Series Management:** Upload series covers, delete individual volumes, or remove entire series from your library.

## 💻 Technology Stack

This project is a monorepo containing a decoupled frontend and backend.

* **Backend:** **Node.js** with **Fastify** for high-performance routing.
* **Frontend:** **SvelteKit** with **TypeScript** and **Tailwind CSS**.
* **Database:** **SQLite** for simple, file-based data persistence.
* **ORM:** **Prisma** for type-safe database access and migrations.
* **Containerization:** **Docker** and **Docker Compose**.

## 🚀 Usage

The recommended way to run Mokuro Library is with Docker Compose, which handles the database, backend, and frontend in one managed container.

### Prerequisites

* [Git](https://git-scm.com/downloads)
* [Docker](https://www.docker.com/products/docker-desktop/) (which includes `docker compose`)

### Running in Production

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/nguyenston/mokuro-library.git
    ```

2.  **Navigate to the directory:**
    ```bash
    cd mokuro-library
    ```

3.  **Build the Image:**
    ```bash
    docker compose build --no-cache
    ```

4.  **Run the Container:**
    This starts the container in detached (`-d`) mode. The `docker-compose.yml` file defines the service. On the first run, the entrypoint script will automatically create and migrate your database.
    ```bash
    docker compose up -d
    ```

Your library is now accessible at `http://localhost:3001`.

Based on the `docker-compose.yml` configuration, the following persistent data folders will be created in your project directory:
* `./data`: Stores your `library.db` database file.
* `./data/uploads`: Stores all your uploaded manga and series files.

### Updating the Application

When you pull new changes from Git or modify the schema:

1.  **Re-build the image:**
    ```bash
    docker compose build
    ```
2.  **Re-create the container:**
    The `--force-recreate` flag is necessary to apply the new image. The entrypoint script will automatically run any database migrations to update your schema.
    ```bash
    docker compose up -d --force-recreate
    ```
    Your data in the `./data` folder will be preserved.
    
## 🛠️ Development (with Hot-Reload)

See [the development doc](docs/development.md).

## 📚FAQ
### 1. Server-Side vs. Client-Side

The original [ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader) is a fantastic **client-side** reader. It's fast, simple, and perfect for loading files directly into the browser.

However, as a client-side tool, it relies on browser storage, which has limitations. If you have a large library or want to sync progress between devices, you can quickly hit those limits.

**Mokuro Library solves this problem** by moving everything to the server:

* **Solve Storage Limits:** Library size is limited only by the server's hard drive, not browser's cache.
* **Persistent Centralized Progress:** All reading progress, page numbers, and settings are saved to your user account on the server, so you are not brower/devide-bound.
* **Data lives in the open:** Uploaded files stay on the server and accessible through the file system.
* **File-Based Edit Persistence:** OCR modifications are written directly back to the corresponding `.mokuro` file on the server's filesystem. This contrasts with client-side applications that store edits in volatile browser storage. As a result, all corrections are as persistent and portable as the `.mokuro` files themselves.

### 2. Anki integration

Unlike [ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader), this is not a planned feature. Implementing it to work with Docker can be rather complicated.
In addition, browser extensions like Yomi-tan already have matured Anki-Connect support (with tags like `{screenshot}` or `{clipboard-image}` for images).

## 🔧 Troubleshooting

### 1. Docker Issues

If you encounter problems running the application, the issue is often related to your Docker installation or host system configuration.

#### "Docker Desktop - WSL 2 Installation is Incomplete" or "WSL 2 requires an update"

This is a common error on Windows. Docker Desktop uses the Windows Subsystem for Linux (WSL 2) backend by default.
* **Solution:** Follow the official Microsoft guide to [install WSL](https://learn.microsoft.com/en-us/windows/wsl/install). Usually, running `wsl --install` in an Administrator PowerShell terminal is sufficient.

#### "Virtualization must be enabled" (SVM / VT-x)

Docker requires hardware virtualization to be enabled in your computer's BIOS/UEFI settings. If it's disabled, Docker Desktop will fail to install.
* **Symptoms:** This is a common root cause for many installation failures. Instead of a clear error, installations or commands may simply **hang indefinitely**.
    * Docker Desktop installation may hang and never complete.
    * Running `wsl --install` in an Administrator PowerShell terminal may hang and never complete.
* **Solution:**
    1.  Restart your computer and enter the BIOS/UEFI setup (usually by pressing F2, F12, or Del during boot).
    2.  Look for a setting named **Intel Virtualization Technology (VT-x)**, **AMD Secure Virtual Machine (SVM)**, or simply **Virtualization**.
    3.  Enable it, save changes, and restart.
    4.  After restarting, verify in Task Manager (Performance tab > CPU) that "Virtualization" is listed as "Enabled".
    5.  The `wsl --install` and Docker Desktop installations should now complete successfully.

#### "Ports are not available" or "Bind for 0.0.0.0:3001 failed"

This means another application on your computer is already using port 3001.
* **Solution:**
    1.  Open `docker-compose.yml` [cite: mokuro-lib/docker-compose.yml].
    2.  Find the `ports:` section.
    3.  Change the *first* number in `"3001:3001"` to something else, like `"8080:3001"`.
    4.  Access the library at `http://localhost:8080`.

### 2. Database Reset

If you need to completely wipe your library and start over:
1.  Stop the container: `docker compose down`
2.  Delete the `./data` folder in your project directory.
3.  Start the container: `docker compose up -d`. A fresh database will be created automatically.

## Acknowledgements

The UX/UI flow in this project is a heavily inspired by the original **[ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader)**.
