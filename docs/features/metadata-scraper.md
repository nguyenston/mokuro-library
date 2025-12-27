# Feature Specification: Metadata Management & Organization

This document outlines the architecture for the "Inbox Zero" library management workflow, the "Organized" status flag, and the integrated metadata scraping tools.

## 1. Overview

The Metadata Management system shifts from a dedicated "Maintenance Page" to an integrated workflow within the main Library view. It introduces an **"Organized"** state, allowing users to separate curated content ("Archive") from new or incomplete uploads ("Inbox").

## 2. Core Concepts

### 2.1. The "Organized" Flag (`Series.organized`)
A boolean flag in the database that represents the user's "stamp of approval."
* **`false` (Unorganized / Inbox):** The default state for new uploads. Indicates the series needs review, metadata scraping, or manual editing.
* **`true` (Organized / Archive):** Indicates the user is satisfied with this entry. It will be hidden from default "Maintenance" views.

**Transitions:**
* **Manual:** User selects items and clicks "Mark as Organized" (Batch or Single).
* **Automatic:** User successfully applies a Scrape result to a series (Frontend automatically sets flag).

---

## 3. User Experience (UX)

### 3.1. Orthogonal Filtering
Filtering is split into two independent axes, allowing for precise maintenance queries.

**Axis A: Organization Status**
* **Unorganized (Default):** "My To-Do List." Shows only items that haven't been curated.
* **Organized:** "My Collection." Shows finished items.
* **All:** "Global View." Ignores the flag.

**Axis B: Missing Metadata**
* **All:** No specific missing field requirements.
* **Missing Cover:** Entry has no cover image.
* **Missing Description:** Entry has no synopsis.
* **Missing Title:** Entry has no parsed metadata title (relies on folder name).

**Example Workflows:**
* *Inbox Review:* **Unorganized** + **All**.
* *Cover Hunt:* **Unorganized** + **Missing Cover**.
* *Audit:* **Organized** + **Missing Description** (Find items marked "Done" that are actually incomplete).

### 3.2. Contextual Actions (Action Bar)
The `LibraryActionBar` is updated to include a "More" (Ellipsis) menu for metadata operations.

* **Primary Actions (Visible):** Download, Delete.
* **Secondary Actions (Ellipsis Menu):**
    * **Maintenance Section:**
        * **"Scrape Metadata":** Opens the *Bulk Review Queue* for the selected items.
    * **Organization Section:**
        * **"Mark as Organized":** Sets `organized=true`. Removes items from the "Unorganized" view immediately.
        * **"Mark as Unorganized":** Sets `organized=false`.

### 3.3. Bulk Scrape & Review Queue
Triggered via "Scrape Metadata" in the Action Bar.
1.  **Queueing:** Frontend fetches metadata for selected items sequentially.
2.  **Review (The Modal):**
    * User sees a comparison: *Current Data* vs. *Scraped Data*.
    * **Confirm:** Calls `PATCH /api/metadata/series/:id` with scraped fields AND `organized: true`.
    * **Skip:** Advances to next without changes.

### 3.4. Scrape Settings (Configuration)
Located in the global `Settings` page (not the library view).
* **Metadata Source:** Select default provider (AniList, MAL, Kitsu).
* **Description Cleaning:**
    * **Regex Rules:** Users can define regex patterns (e.g., `/Uploaded by .*/i`) to automatically strip uploader credits or spam from scraped descriptions before they are applied.

---

## 4. Frontend Architecture

### 4.1. State Management
* **`FilterMenu.svelte`**: Binds to `uiState.filterMode` (Missing Data) and `uiState.organizationMode`.
* **`LibraryActionBar.svelte`**: Implements the `ContextMenu` for the new "More" actions.
* **`metadataOperations.ts`**: Helper to handle the API calls for organizing and scraping.

### 4.2. Components
* **`BulkScrapePanel.svelte`**:
    * Refactored to handle the `organized` flag application payload.
    * Works with a selection queue instead of a global "missing" list.
* **`ScraperSettings.svelte`**:
    * Simplified version of the old `ScrapeMetadata.svelte`.
    * Contains only Provider selection and Regex configuration.

---

## 5. Backend API Specification

### 5.1. Library Query (`GET /api/library`)
Updated to support the orthogonal filters.
* **Query Params:**
    * `filter_missing`: `'cover' | 'description' | 'title' | 'any' | 'none'`
    * `is_organized`: `'true' | 'false'` (omitting this returns all)
* **Logic:** Applies `AND` condition in Prisma.

### 5.2. Metadata Updates (`PATCH /api/metadata/series/:id`)
* **Endpoint:** `backend/src/routes/metadata.ts`
* **Schema Update:** Add `organized: boolean` to the allowed body fields.
* **Usage:** Used for both "Apply Scrape" (sending title/desc + organized:true) and Single "Mark as Organized" (sending only organized:true).

### 5.3. Batch Organization (`POST /api/metadata/batch/organize`)
* **Endpoint:** `backend/src/routes/metadata.ts` (New Endpoint)
* **Body:** `{ ids: string[], value: boolean }`
* **Logic:** Updates `organized` status for all provided IDs efficiently.
