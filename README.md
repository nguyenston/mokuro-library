# Mokuro Library
A self-hosted, Plex-like server for your a [Mokuro](https://github.com/kha-white/mokuro)-processed manga library.

Mokuro Library is a multi-user, server-side application designed to run on a NAS, home server, or local computer. 
It provides a centralized, persistent library for your Mokuro-processed manga, deployed via a Docker container.

## 🌟 Core Features

For more details, read [the specification](docs/architecture/specification.md).

### 📚 Library Management
* **Server-Side Library:** Upload entire Mokuro-processed directories. All files are managed by the server.
* **Multi-User Authentication:** Support for multiple users with separate databases for progress, settings, and history.
* **Organization:** Search, sort, and paginate through your collection.
* **Metadata Management:** User-defined titles and reading progress is exported as a json sidecar.
* **Export:** Download volumes as **ZIP** archives or **PDFs** (with selectable text) for offline reading.

### 📖 Reading Experience
* **Persistent Tracking:** Reading progress and page completion status are saved automatically to the database.
* **View Modes:** Supports **Single Page**, **Double Page**, and **Vertical Scroll** layouts.
* **Performance:** Smart image caching to minimize server requests and ensure smooth page turns.
* **Customizable:** Per-user reader settings (layout, reading direction, scaling) are persistent across sessions.

### ✏️ Live OCR Editing
* **Edit & Write-Back:** Correct text and bounding boxes in the browser. Changes are saved directly to the source `.mokuro` file on the server.
* **Smart Resize:** Automatically calculates the optimal font size to fit text within its box.
* **Japanese Text Support:** Specialized handlers for vertical text input, including proper line-splitting (Enter) and merging (Backspace), plus ligature cleaning.

### ⚙️ Deployment
* **Docker:** A single container runs the database (SQLite), backend (Node/Fastify), and frontend (SvelteKit).
* **Windows Binary:** A portable Windows application that runs a local server for your library.
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
![Live OCR editing demonstration](docs-wiki/public/using-smart-edit-mode.webp)

## 💻 Technology Stack

This project is a monorepo containing a decoupled frontend and backend.

* **Backend:** **Node.js** with **Fastify** for high-performance routing.
* **Frontend:** **SvelteKit** with **TypeScript** and **Tailwind CSS**.
* **Database:** **SQLite** for simple, file-based data persistence.
* **ORM:** **Prisma** for type-safe database access and migrations.
* **Containerization:** **Docker** and **Docker Compose**.

## 🐳 Installation (Docker)

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

## 📥 Download & Run (Windows Portable)

For users who want to run the library locally on their PC without Docker:

1.  **Download** the latest `MokuroLibrary-Windows.zip` from the **[Releases Page](../../releases)**.
2.  **Extract** the ZIP file to a folder.
3.  If you are updating, copy the `data` and `uploads` folders into the new version.
4.  **Run** `mokuro-library.exe`.
    * A command window will open (don't close it, this is the server).
    * Your library is accessible at `http://localhost:3001`.

> [!WARNING]
> **Database Compatibility:** The database (`library.db`) generated by this Windows Portable version uses a simplified migration system (`_app_migrations`) for portability. It is **not directly compatible** with the Docker/NAS version.
>
> If you decide to switch from Windows to Docker in the future, you cannot simply copy the database file. You will need to **export and re-import** your library content or do some manual `prisma migrate resolve`. This does not affect you if you plan to keep using the Windows application.

## 📖 Usage & Getting Started

After installing and starting the container, here are your first steps:

1.  Open `http://localhost:3001` in your browser.
2.  Create your first user account.
3.  On the main library page, click the "Upload" button.
4.  Select a directory that has been processed by `mokuro` (one that contains the `.mokuro` file and images).
5.  Once uploaded, click the new series cover to start reading.

**For a complete guide on all UI features, including OCR editing, please see the [Mokuro Library User Guide Wiki](https://nguyenston.github.io/mokuro-library).**

    

## 🗺️ Roadmap

* [ ] **AnkiConnect Integration:** Support for sentence mining directly to Anki.
* [ ] **Reading Stats:** UI to visualize reading time and characters read (data is already being tracked).
* [ ] **CBZ Export:** Support for standard comic book archives.
* [ ] **Customization:** Custom keymappings and user-defined ligatures.
* [ ] **Version Control:** History/undo/redo for OCR edits

## 📚 FAQ

### 1. Mokuro Library vs. Mokuro Reader

While both projects serve the same `.mokuro` processed content, they are built on fundamentally different architectures.

The original **[ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader)** is a **Client-Side Progressive Web App (PWA)**. It runs entirely in your browser, using IndexedDB for storage and connecting to third-party services (Google Drive, MEGA, WebDAV) for synchronization.

**Mokuro Library** (this project) is a **Self-Hosted Server Application**. It runs as a container on your own hardware (NAS, Home Server), serving files directly from your local filesystem and using a centralized SQL database.

#### Which One Should You Use?

**Use the original [ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader) if:**
* **You prefer a Zero-Infrastructure setup:** You do not want to manage Docker containers or host your own server.
* **You rely on Cloud Storage:** You prefer syncing your library and progress via Google Drive, MEGA, or WebDAV.
* **You import volumes on demand:** You are comfortable importing specific volumes into the browser as needed.

**Use Mokuro Library (this project) if:**
* **You Self-Host on a NAS/Server:** You want a centralized location that streams images directly from your hard drive without duplicating data into browser storage.
* **Or you want a desktop app:** You just want a manager application that stores your files in an open and accessible location.
* **You require Multi-User separation:** You want to host a private library for multiple users (family/friends) with completely separate accounts, progress tracking, and settings databases.
* **You have a truly gigantic collection:** You somehow managed to exhaust the 2000+ volume limit of the client-side reader.

### 2. Why did you choose absolute line coordinate rendering?

While treating text as a simple paragraph block much simpler and more robust, this project prioritizes data completeness and visual precision.

1. **Future Database Utility:** I have ideas of building a centralized database for user-submitted OCR edits. To ensure this shared data is useful and compatible across the ecosystem, it is essential to maintain complete and valid data. Preserving the exact file structure is necessary for this future synchronization.

2. **Visual Adherence:** Manga text layouts sometimes don't follow standard horizontal flow (e.g., diagonal speech bubbles or scattered text). Absolute rendering guarantees perfect visual adherence to the original image geometry, which is my personal preference.

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

## 🛠️ Development (with Hot-Reload)

The recommended workflow is the full-stack, containerized dev environment. For details on this and alternative workflows (like Hybrid Development), 
see [the development doc](docs/architecture/development.md).

### Recommended Dev Workflow

1.  **First-Time Build (or when `package.json` changes):**
    You must build the dev images once to install all dependencies.
    ```bash
    docker compose -f docker-compose.dev.yml build
    ```
   

2.  **Start the Dev Environment:**
    This command starts both the backend and frontend services with hot-reloading.
    ```bash
    docker compose -f docker-compose.dev.yml up
    ```
   

3.  **Access the app:**
    * Open `http://localhost:5173` in your browser.
    * The SvelteKit app will auto-proxy `/api` requests to the backend container.

## Acknowledgements

The UX/UI flow in this project is heavily inspired by the original **[ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader)**.
