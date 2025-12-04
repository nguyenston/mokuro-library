# Project Specification: Mokuro NAS Library

## Overview

### Project Goal

To create a self-hosted, multi-user Mokuro reader application that runs on a NAS. This application will solve the primary limitation of existing client-side readers by storing all library files and user data on the server's filesystem, bypassing browser storage quotas. This is also a project for me to get into web development.

### Target Use Case
1.  **Home Server (NAS):** A casual NAS owner hosting a manga library for a trusted group over LAN/VPN.
2.  **Local User (Windows):** A user who wants a "double-click to run" portable library on their PC without managing containers or databases.

### Core Architecture

The system will be a decoupled client-server application.

* Backend: A Node.js server (Fastify) handles all logic, database interactions, and file storage.
* Frontend: A SvelteKit application (refactored from zxy101/mokuro-reader) provides the web UI.
* Database: A server-side SQLite file will store all metadata.
* Deployment: The frontend and backend will be packaged to run together, either in a Docker container or a bundled Node exe.

## Feature Set

### Must-Haves (Minimum Viable Product)

1.  **Multi-User Authentication:**
    * [x] Users must be able to create an account and log in.
    * [x] The backend will use a simple, non-HTTPS-only cookie for session management, suitable for a trusted LAN/VPN environment.

2.  **Server-Side Library (Directory Upload-Style):**
    * [x] Authenticated users can upload content via the web UI. The upload modal will support two methods:
        * [x] ~~Single File Upload: .zip or .cbz files containing a single volume, \<series\_title\> will be pulled from inside the .mokuro file.~~ 
        * [x] Directory Upload: Users can select a "root" folder from their computer that contains pre-processed Mokuro output.
    * The backend will be able to parse the uploaded directory structure to find series and volumes based on the standard Mokuro output format:
        **Mokuro Output Structure:**
        * Image Files: root/\<series\_title\>/\<volume\_title\>/\<image\>.\<ext\>
        * Mokuro File: root/\<series\_title\>/\<volume\_title\>.mokuro
    * The backend will iterate through the uploaded file list, identify each series and volume, and populate the SQLite database, linking the new Series to the logged-in user's ID.
    * [x] Collision Handling: If an uploaded volume already exists in that user's library (based on series\_title and volume\_title), the server will ignore the uploaded volume and keep the existing data.

3.  **Per-User Progress & Settings:**
    * [x] All reading progress (current page, stats) will be saved to the database, linked to the specific user ID.
        * [x] Reading progress and read markers will be displayed on volume entry   
    * [x] All user-configurable settings (theme, reader behavior, etc.) will be saved to the database, linked to the user ID.

4.  **Manga Reader UI:**
	* [x] Core reader features
		* [x] Fetch and display the current page's image.
		* [x] Layout Mode: A toggle for Single Page vs. Dual-Page Spread (e.g., showing two pages side-by-side).
		* [x] Dual-Page offset: the ability to choose whether to start dual page from even or odd pages.
		* [x] Dual-Page reading direction: left to right or right to left.
		* [x] Ability to set the width of the side navigation buttons.
		* [x] Interactivity: Zoom and Pan the image(s).
	* [x] OCR overlay features
		* [x] Display editable OCR blocks as overlays.
		* [x] OCR blocks are only visible when hovered.
		* [x] Ensure these overlays correctly scale and pan with the base image.

5.  **OCR Editing (Write-Back):**
    * [x] Ability to delete, create, and change existing OCR blocks.
      * [x] Users can edit the textbox location (i.e. the four corners) of an OCR text box.
      * [x] Users can edit the text (content and font size) within an OCR text box.
    * [x] A "Save" button will send the modified text data to the backend.
    * [x] The backend will verify the user owns the volume, read the corresponding .mokuro file from the disk, update its JSON content, and save the changes.

### Nice-to-Haves (Post-MVP)

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
  * [x] The ability to rename series and volume.
  * [x] Search, sort, and paginate.
  * [ ] Implement the UI to display reading stats (time, characters read), which will be tracked in the database.
* [ ] AnkiConnect Integration: Focuses on sentence mining, as dictionary extensions like Yomi-tan already have word mining down.

## Technology Stack

* Repository: Monorepo (contains frontend and backend packages).
* Frontend: SvelteKit + TypeScript + Tailwind CSS.
* Backend: Node.js + Fastify + TypeScript.
* Database: SQLite (managed via Prisma ORM).

## API endpoints

All endpoints (except /auth) are protected and require an authenticated session cookie. All library-related endpoints are implicitly scoped to the logged-in user.

### Auth API (Public)

* **POST /api/auth/register**
    * Creates a new user.
* **POST /api/auth/login**
    * Creates a session cookie.
* **POST /api/auth/logout**
    * Clears the session cookie.
* **GET /api/auth/me**
    * Gets the currently logged-in user's data (username, settings).

### Library API (User-Scoped)

* **GET /api/library**
    * Gets a list of all Series and Volume metadata owned by the current user.
* **GET /api/library/series/:id**
    * Gets a specific Series and associated Volume metadata owned by the current user.
* **POST /api/library/upload**
    * Uploads new manga (~~zip~~ or directory) and associates it with the current user's ownerId.
* **POST /api/library/series/:id/cover**
    * Uploads and sets the cover image for a series.
* **GET /api/library/volume/:id**
    * Gets full data for one volume, including the parsed .mokuro JSON.
    * Fails (404/403) if the volume does not belong to the current user.
* **PUT /api/library/volume/:id/ocr**
    * Saves modified OCR data.
    * Fails if the volume does not belong to the current user.
* **DELETE /api/library/volume/:id or DELETE /api/library/series/:id**
    * Deletes a volume or entire series.
    * Fails if the resource does not belong to the current user.

### User Data API (User-Scoped)

* **GET /api/settings**
    * Gets the current user's settings JSON.
* **PUT /api/settings**
    * Updates the current user's settings.
* **GET /api/metadata/volume/:id/progress**
    * Gets the UserProgress (page, time read, etc.) for a specific volume.
    * Returns default values (page 1, etc.) if no progress exists.
* **PATCH /api/metadata/volume/:id/progress**
    * Updates the UserProgress for a volume. 
    * Supports partial updates (e.g., sending just `{ page: 10 }`).
    * Automatically creates the progress record if it doesn't exist (Upsert).
* **DELETE /api/metadata/volume/:id/progress**
    * Resets (wipes) the progress for a specific volume.
* **PATCH /api/metadata/series/:id**
    * Renames the **Display Title** of a series.
    * Accepts `{ title: "New Name" }` or `{ title: null }` (to revert to the folder name).
    * Does **not** affect the filesystem directory name.
* **PATCH /api/metadata/volume/:id**
    * Renames the **Display Title** of a volume.
    * Accepts `{ title: "New Name" }` or `{ title: null }`.
    * Does **not** affect the filesystem directory name.

### File API (User-Scoped)

* **GET /api/files/volume/:id/image/:imageName**
    * Securely serves a specific manga page image.
    * Fails if the volume does not belong to the current user.
* **GET /api/files/series/:id/cover**
    * Securely serves the cover image for a series.
    * Fails if the series does not belong to the current user.
### Export API (User-Scoped)

* GET /api/export/volume/:id/zip
    * Downloads a single volume as a ZIP.
* GET /api/export/series/:id/zip
    * Downloads an entire series as a ZIP.
* GET /api/export/zip
    * Downloads the entire user library as a ZIP.
* GET /api/export/volume/:id/pdf
    * Downloads a single volume as a pdf with selectable text.
* GET /api/export/series/:id/pdf
    * Downloads an entire series as a ZIP of pdfs.
* GET /api/export/pdf
    * Downloads the entire user library as a ZIP of pdfs.

## Draft Database Schema (Prisma)

This schema will be located at backend/prisma/schema.prisma.

```prisma
generator client {
  provider = "prisma-client"

  // for docker: 'linux-musl-openssl-3.0.x' is required for Alpine Linux
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// Stores metadata about a manga series
model Series {
  id          String    @id @default(cuid())
  title       String?   // defaults to folderName
  folderName  String
  coverPath   String?   // Path to the cover image

  // Always contains either 'title' or 'folderName'
  sortTitle   String

  createdAt   DateTime  @default(now()) // "Date Added"
  updatedAt   DateTime  @updatedAt @default(now())     // "Recently Updated" (Refreshed on new volume)

  // Updated manually when a child volume's progress is updated.
  // Default is Epoch (1970) so unread items appear at the bottom of "Recently Read".
  lastReadAt  DateTime  @default(dbgenerated("'1970-01-01T00:00:00.000Z'"))

  volumes     Volume[]
  owner       User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  ownerId     String    // Which user uploaded this

  @@unique([folderName, ownerId]) // A user can't have two series with the same title
}

// Stores metadata about a single volume
model Volume {
  id          String   @id @default(cuid())
  title       String?  // defaults to folderName
  folderName  String
  pageCount   Int

  // Always contains either 'title' or 'folderName'
  sortTitle   String

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt @default(now())

  // File paths on the NAS
  filePath    String   @unique // Path to the folder containing the images
  mokuroPath  String   @unique // Path to the .mokuro file

  coverImageName String?

  series      Series   @relation(fields: [seriesId], references: [id], onDelete: Cascade)
  seriesId    String

  progress    UserProgress[]

  @@unique([seriesId, folderName]) // Prevent duplicate volumes within a series
}

// Stores user accounts and their settings
model User {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String   // Will store a hash

  settings  Json     // All reader settings

  uploads   Series[]
  progress  UserProgress[]
}

// Tracks the progress for a specific user and a specific volume
model UserProgress {
  id         String    @id @default(cuid())
  page       Int       @default(1)
  timeRead   Int       @default(0) // in minutes
  charsRead  Int       @default(0)
  completed  Boolean   @default(false)

  // --- RECENTLY READ ---
  // 1. @updatedAt: Automatically updates to NOW() whenever you save progress.
  // 2. @default("1970..."): Forces existing database rows to have an "ancient" date 
  lastReadAt DateTime @updatedAt @default(dbgenerated("'1970-01-01T00:00:00.000Z'"))

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String
  volume     Volume    @relation(fields: [volumeId], references: [id], onDelete: Cascade)
  volumeId   String

  @@unique([userId, volumeId]) // A user can only have one progress entry per volume
}
```
