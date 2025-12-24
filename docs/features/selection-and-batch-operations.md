# Feature Specification: Batch Selection & Operations

This document outlines the final architecture for the "Selection Mode," batch operations, and the unified "Edit" workflow.

## 1. Overview

Users can enter "Selection Mode" via a long-press gesture. This mode allows selecting multiple items for batch operations (Export, Delete) or managing single items (Edit) without navigating to the details view.

## 2. User Experience (UX)

### 2.1. Triggering Selection Mode

* **Gesture:** Long-press (`pointerdown` + 500ms hold) on any `LibraryEntry` card.
* **Visual Feedback:**
* Target card becomes selected (highlighted border/glow).
* UI enters `isSelectionMode = true`.
* **Footer Animation:** The Pagination Footer slides up (`-translate-y`) to make room for the Action Bar.
* **Action Bar:** slides in from the bottom (z-index 50).



### 2.2. Selection Behavior

* **In Selection Mode:**
* Standard clicks on cards toggle selection (navigation is disabled).
* Clicking "Cancel" or pressing `Escape` clears selection and exits mode.
* Clicking "Select All" (optional future addition) selects all visible.



### 2.3. Contextual Actions (Action Bar)

The Action Bar updates dynamically based on the selection count (`n`):

* **Single Selection (n=1):**
* **Edit Details:** Opens the **Edit Series Modal** (Title, Description).
* **Download:** Triggers batch download flow for the single item.
* **Delete:** Prompts for confirmation, deletes item.


* **Multi Selection (n > 1):**
* **Batch Download:** Downloads a single ZIP containing all selected items.
* **Batch Delete:** Prompts for confirmation, deletes all selected items.
* *(Edit is disabled)*



---

## 3. Frontend Architecture

### 3.1. State Management (`uiState.svelte.ts`)

* **State:** `isSelectionMode` (boolean), `selectedIds` (Set<string>).
* **Actions:** `enterSelectionMode(id)`, `toggleSelection(id)`, `exitSelectionMode()`.

### 3.2. Components

* **`LibraryEntry.svelte`**:
* Uses a `longpress` action to trigger selection.
* Intercepts click events when `isSelectionMode` is active.


* **`LibraryActionBar.svelte`**:
* Handles the business logic for Delete/Export.
* Emits `onEdit` event for the parent page to handle.


* **`LibraryFooter.svelte`**:
* Wraps pagination controls.
* Reactively translates upwards when the Action Bar is visible to prevent UI overlap.


* **`EditSeriesModal.svelte`**:
* "Dumb" component: accepts `initialTitle`, `initialDescription` and fires `onSave`.


* **`metadataOperations.ts`**:
* Centralizes API calls for metadata updates (`updateSeries`).



---

## 4. Backend API Specification

### 4.1. Batch Export (The "Ticket" Pattern)

To support large files and native browser download behavior (progress bars), we use a 2-step process.

1. **Request Ticket:** `POST /api/export/ticket`
* **Body:** `{ ids: string[], type: 'series'|'volume', options: { include_images: bool } }`
* **Response:** `{ ticket: "uuid" }`


2. **Download Stream:** `GET /api/export/download?ticket=uuid`
* **Behavior:** Browser navigates here. Backend streams the ZIP. Ticket is invalidated immediately.
* **Grouping:** If `type='volume'`, volumes are grouped by their parent Series folder inside the ZIP to prevent file collisions.



### 4.2. Batch Delete

* **Endpoint:** `POST /api/library/batch/delete`
* **Body:** `{ ids: string[], type: 'series'|'volume' }`
* **Logic:**
* Iterates through IDs.
* Deletes files (recursive) and Database records (Prisma cascade).
* Returns success/fail counts.



### 4.3. Edit Metadata

* **Endpoint:** `PATCH /api/metadata/series/:id`
* **Body:** `{ title?: string, description?: string }`
* **Logic:** Updates fields only if provided (partial update).

---

## 5. Implementation Roadmap Status

* [x] **Backend:** `POST /batch` endpoints implemented.
* [x] **Backend:** Export "Ticket" system implemented.
* [x] **Backend:** Shared logic helpers (`addVolumeToArchive`, `deleteSeriesById`) refactored.
* [x] **Frontend:** `longpress` action created.
* [x] **Frontend:** `LibraryActionBar` implemented with Ticket download flow.
* [x] **Frontend:** `EditSeriesModal` replaced simple Rename modal.
* [x] **Frontend:** Footer and Header layout adjusted for Selection Mode.
