# Mokuro Library
A self-hosted, Plex-like server for your a [Mokuro](https://github.com/kha-white/mokuro)-processed manga library.

Mokuro Library is a multi-user, server-side application designed to run on a NAS, home server, or local computer. 
It provides a centralized, persistent library for your Mokuro-processed manga, deployed via a Docker container.

## 🌟 Core Features

For more details, read [the specification](docs/specification.md):
* **Multi-User Authentication:** Separate accounts for different users, with progress and settings saved per-user.
* **Server-Side Library:** Upload entire Mokuro-processed directories. All files are managed by the server.
* **Persistent, Per-User Progress:** Reading progress, page, and completion status are saved to the database for each user.
* **Persistent Reader Settings:** All reader preferences (layout, direction, etc.) are saved to your account.
* **Live OCR Editing:** Edit and correct OCR text blocks directly in the reader UI. Changes are saved back to the `.mokuro` file on the server.
* **Smart Resize Mode:** Automatically adjusts font size to fit text within its bounding box during editing.
* **Dockerized Deployment:** A single Docker container runs the entire application, making setup and maintenance simple.
* **Volume & Series Management:** Upload series covers, delete individual volumes, or remove entire series from your library.

## 📸 Screenshots
<table>
  <tr>
    <td align="center">
      <strong>The Library View</strong>
      <br><br>
      <img src="docs-wiki/public/library.webp" alt="Mokuro Library main bookshelf view" width="400">
    </td>
    <td align="center">
      <strong>The Series View</strong>
      <br><br>
      <img src="docs-wiki/public/series.webp" alt="Mokuro Library series view" width="400">
    </td>
  </tr>
</table>

*Live OCR editing in action:*
![Live OCR editing demonstration](docs-wiki/public/edit-demo.webp)

## 💻 Technology Stack

This project is a monorepo containing a decoupled frontend and backend.

* **Backend:** **Node.js** with **Fastify** for high-performance routing.
* **Frontend:** **SvelteKit** with **TypeScript** and **Tailwind CSS**.
* **Database:** **SQLite** for simple, file-based data persistence.
* **ORM:** **Prisma** for type-safe database access and migrations.
* **Containerization:** **Docker** and **Docker Compose**.

## 🚀 Installation

The recommended way to run Mokuro Library is with Docker Compose, which handles the database, backend, and frontend in one managed container.

### Prerequisites

* [Git](https://git-scm.com/downloads)
* [Docker](https://www.docker.com/products/docker-desktop/) (which includes `docker compose`)

### Running in Production

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/nguyenston/mokuro-library.git](https://github.com/nguyenston/mokuro-library.git)
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

The recommended workflow is the full-stack, containerized dev environment. For details on this and alternative workflows (like Hybrid Development), see [the development doc](docs/development.md).

### Recommended Dev Workflow

1.  **First-Time Build (or when `package.json` changes):**
    You must build the dev images once to install all dependencies.
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml build
    ```
   

2.  **Start the Dev Environment:**
    This command starts both the backend and frontend services with hot-reloading.
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
    ```
   

3.  **Access the app:**
    * Open `http://localhost:5173` in your browser.
    * The SvelteKit app will auto-proxy `/api` requests to the backend container.

## 📚 FAQ
### 1. Mokuro Library vs. Mokuro Reader

The original [ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader) is a fantastic **browser-based** reader. It's fast, simple, and perfect for loading `.mokuro` files directly into your browser without installing anything. It stores your library and reading progress in the browser's internal storage (IndexedDB).

**Mokuro Library** is a **self-hosted, server-side** application that solves a different set of problems. It is designed to run as a persistent service (e.g., in a Docker container on a NAS). It moves the entire library, all user accounts, and all progress tracking to the server, using a central SQLite database and the server's filesystem.

#### Which One Should You Use?

**Use the original [ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader) if:**
* You want to quickly read a `.mokuro` file without setting up a server.
* You prefer a hosted (don't worry, your data is still local), zero-installation experience.
* You are managing a smaller library that fits comfortably within your browser's storage limits.
* You only need to track your progress on a single device.

**Use Mokuro Library (this project) if:**
* You have a large manga library and are hitting browser storage quotas.
* You want a centralized library that lives in the open on your computer's filesystem, not in the browser.
* You want your **OCR text edits saved directly back** to the `.mokuro` files on your disk for portability.
* You want to **sync reading progress** across devices (by running it on a NAS/Server).
* You need **multi-user** support for family or friends (by running it on a NAS/Server).

### 2. Non-essential stretch features:
* [x] Optional Reader features
  * [x] Smart resize mode that auto fit the text content to the bounding box.
  * [x] Per user persistent reader settings.
  * [x] A single, long-scrolling vertical layout (webtoon mode).
  * [x] Caching images to avoid unnecessary server calls.
  * [ ] Customization
    * [ ] Custom keymapping
    * [ ] Custom ligatures
* [ ] The ability to export the library in different format (e.g. pdf, cbz, ...)
  * [x] zip
  * [x] pdf with selectable text
  * [ ] cbz (low priority)
* [ ] Library features
  * [ ] More secure cookie implementation for more public use cases.
  * [ ] The ability to rename series and volume.
  * [ ] Search and sort.
  * [ ] Reading Statistics: Implement the UI to display reading stats (time, characters read), which will be tracked in the database.
* [ ] AnkiConnect Integration: Focuses on sentence mining, as dictionary extensions like Yomi-tan already have word mining down.


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
    1.  Open `docker-compose.yml`.
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
