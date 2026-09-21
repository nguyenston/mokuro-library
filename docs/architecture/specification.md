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
    * [x] Custom keymapping
    * [ ] Custom ligatures
* [ ] History/undo/redo for OCR edits
* [ ] The ability to export the library in different format (e.g. pdf, cbz, ...)
  * [x] zip
  * [x] pdf with selectable text
  * [ ] cbz (low priority)
  * [ ] metadata only
* [ ] Library features
  * [ ] More secure cookie (auth) implementation for more public use cases.
  * [x] The ability to rename series and volume.
  * [x] Search, sort, and paginate.
  * [ ] Implement the UI to display reading stats (time, characters read), which will be tracked in the database.
  * [ ] Import and manage content without OCR
  * [ ] Bundle mokuro into backend for OCR generation
  * [x] Contribution summary dashboard (ahead/merged/pending counts; rebase queue)
* [ ] AnkiConnect Integration: Focuses on sentence mining, as dictionary extensions like Yomi-tan already have word mining down.

## Technology Stack

* Repository: Monorepo (contains frontend and backend packages).
* Frontend: SvelteKit + TypeScript + Tailwind CSS.
* Backend: Node.js + Fastify + TypeScript.
* Database: SQLite (managed via Prisma ORM).

### Auth API (Public)

* **POST /api/auth/register**
    * Creates a new user.
* **POST /api/auth/login**
    * Creates a session cookie.
* **POST /api/auth/logout**
    * Clears the session cookie.
* **POST /api/auth/logout/all**
    * Clears all sessions for the current user.
* **GET /api/auth/me**
    * Gets the currently logged-in user's data (username, settings).
* **POST /api/auth/refresh**
    * Refreshes an access token (uses device fingerprint header + refresh cookie).

### Health & Readiness

* **GET /api/health**
    * Returns server health checks.
* **GET /api/ready**
    * Returns readiness status.

### Stats API (User-Scoped)

* **GET /api/stats/summary**
    * Returns aggregate reading stats.
* **GET /api/stats/series**
    * Returns per-series stats.
* **GET /api/stats/series/:id**
    * Returns stats for one series.
* **GET /api/stats/history**
    * Returns reading history data.
* **GET /api/stats/completedVolumes**
    * Returns completed volume stats.
* **GET /api/stats/export**
    * Exports stats data.

### Library API (User-Scoped)

* **GET /api/library**
    * Gets a list of all Series and Volume metadata owned by the current user.
* **GET /api/library/series/:id**
    * Gets a specific Series and associated Volume metadata owned by the current user.
* **POST /api/library/check**
    * **(New)** Checks if a Series/Volume pair already exists to prevent redundant uploads.
    * Body: `{ "series_folder_name": "...", "volume_folder_name": "..." }`
    * Returns: `{ "exists": boolean }`
* **POST /api/library/upload**
    * Uploads a single volume (Pipeline Mode).
    * **Format:** `multipart/form-data` with **Strict Ordering**.
    * **Required Fields (Must appear before files):**
        * `series_folder_name`: The root series directory name (ID).
        * `volume_folder_name`: The volume directory name (ID).
        * `metadata`: (Optional) JSON string containing display titles (`series_title`, `volume_title`) and progress.
    * **Files:** The stream of images and the `.mokuro` file.
* **POST /api/library/series/:id/cover**
    * Uploads and sets the cover image for a series.
* **GET /api/library/volume/:id**
    * Gets full data for one volume, including the parsed .mokuro JSON.
    * Fails (404/403) if the volume does not belong to the current user.
* **POST /api/library/volume/:id/ocr**
    * Syncs OCR snapshot with server state and returns updated data/version.
* **POST /api/library/volume/:id/patch**
    * Appends an OCR patch to the user's branch.
* **POST /api/library/volume/:id/undo**
    * Undo last OCR patch.
* **POST /api/library/volume/:id/redo**
    * Redo OCR patch.
* **POST /api/library/volume/:id/reset**
    * Reset OCR branch to the admin head.
* **POST /api/library/volume/:id/rebase/start**
    * Start a rebase session.
* **POST /api/library/volume/:id/rebase/continue**
    * Continue a rebase session with conflict resolutions.
* **POST /api/library/volume/:id/rebase/abort**
    * Abort a rebase session.
* **POST /api/library/volume/:id/officialize**
    * Admin: accept the frozen OCR prefix identified by `reviewHeadPatchId`, via fast-forward or implicit rebase. Uses server-captured admin optimistic version; no live user version input. Semantic rebase conflicts cancel the review with a retained explanation; stale admin state is retryable.
* **DELETE /api/library/volume/:id**
    * Deletes a volume. If it is the last volume, the series is also deleted.
* **DELETE /api/library/series/:id**
    * Deletes an entire series and all its volumes.
* **POST /api/library/batch/delete**
    * Batch delete volumes.
* **GET /api/library/upload/status/:jobId**
    * Returns upload processing status for a job.
* **GET /api/library/rebase/sessions**
    * Lists active rebase sessions.

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
* **GET /api/metadata/series/:id/settings**
    * Returns per-user series settings (bookmarked/status/etc).
* **PATCH /api/metadata/series/:id/settings**
    * Updates per-user series settings.
* **POST /api/metadata/series/scrape**
    * Triggers metadata scraping for series.
* **POST /api/metadata/batch/organize**
    * Batch update organize/verify flags.

### File API (User-Scoped)

* **GET /api/files/volume/:id/image/:imageName**
    * Securely serves a specific manga page image.
    * Fails if the volume does not belong to the current user.
* **GET /api/files/series/:id/cover**
    * Securely serves the cover image for a series.
    * Fails if the series does not belong to the current user.
* **GET /api/files/preview**
    * Returns a preview asset (used for upload previews).

### Export API (User-Scoped)

* **GET /api/export/volume/:id/zip**
    * Downloads a single volume as a ZIP.
* **GET /api/export/series/:id/zip**
    * Downloads an entire series as a ZIP.
* **GET /api/export/zip**
    * Downloads the entire user library as a ZIP.
* **GET /api/export/volume/:id/pdf**
    * Downloads a single volume as a pdf with selectable text.
* **GET /api/export/series/:id/pdf**
    * Downloads an entire series as a ZIP of pdfs.
* **GET /api/export/pdf**
    * Downloads the entire user library as a ZIP of pdfs.
* **GET /api/export/batch**
    * Lists export batch jobs.
* **POST /api/export/batch**
    * Starts a batch export job.
* **POST /api/export/batch/ticket**
    * Creates or refreshes an export ticket.

### Contributions & Rebase API

* **GET /api/contributions/summary**
    * Returns contribution metrics against admin-owned content (ahead counts, merged edits, pending review counts, last edit timestamp, pending submissions count).
* **GET /api/contributions/rebase**
    * Lists volumes needing rebase (admin vs user branches).
* **GET /api/contributions/reviews**
    * Lists pending OCR reviews (`reviewHeadPatchId != null`), including their frozen head and request timestamp. Later user edits are excluded from the reviewed range.
* **GET /api/contributions/reviews/candidates**
    * Lists eligible private OCR ranges without a pending review; contributor-facing state also exposes retained rejection/cancellation explanations.
* **POST /api/contributions/reviews/set**
    * Creates a frozen OCR review at the current user head, or cancels/rejects a request. Reset and explicit rebase cancel pending review after UI confirmation. See `docs/features/ocr-version-control.md` §4.6 for the lifecycle.

### Submissions API

* **GET /api/contributions/submissions**
    * Lists submissions (admin sees all, users see their own).
* **POST /api/contributions/submissions**
    * Creates a submission from user-owned series/volumes.
* **GET /api/contributions/submissions/:id**
    * Gets a submission with details.
* **DELETE /api/contributions/submissions/:id**
    * Deletes a submission.
* **POST /api/contributions/submissions/:id/comments**
    * Adds a comment to a submission thread.
* **POST /api/contributions/submissions/:id/accept**
    * Admin: accepts a submission.
* **POST /api/contributions/submissions/:id/reject**
    * Admin: rejects a submission (with reason).
* **POST /api/contributions/submissions/accept**
    * Admin: bulk accept submissions.
* **POST /api/contributions/submissions/reject**
    * Admin: bulk reject submissions.
## Database Schema (Prisma)

See the source of truth at `backend/prisma/schema.prisma` (includes auth refresh tokens, submissions/reviews, OCR patch/rebase models, series settings, and progress).
