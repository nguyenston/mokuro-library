# Feature Spec: Smart Frontend Upload Pipeline

## 1. Overview
**Goal:** To implement a robust, "Smart Client" upload system where the browser organizes files into atomic Volumes and extracts metadata (if available) before transmission.

**Philosophy:** The backend receives explicit instructions. The frontend identifies the content structure, looks up metadata from the sidecar, and sends specific attributes to the server.

## 2. Data Logic & Identifiers

### 2.1. The "Anchor" Concept (Directory Structure)
The frontend groups files based on the file system structure.
* **Volume Anchor:** A `.mokuro` file defines a Volume. The directory containing it is the **Volume ID** (`volumeFolderName`).
* **Series Anchor:** The parent directory of the Volume is the **Series ID** (`seriesFolderName`).

### 2.2. Metadata Source (`Series.json`)
Metadata is sourced from an optional sidecar JSON file in the Series folder. This file contains a map of all volumes.
* **Structure:**
  ```json
  {
    "series": { "title": "Naruto" },
    "volumes": {
      "Vol 1": { "displayTitle": "Naruto Vol. 1", "progress": {...} },
      "Vol 2": { "displayTitle": "Naruto Vol. 2" }
    }
  }
  ```
* **Lookup Logic:** The frontend parses this JSON once. For each volume job (e.g., "Vol 1"), it looks up `json.volumes["Vol 1"]` to find the specific display title for that volume.

## 3. Implementation Details

### 3.1. Frontend Logic (`createJobsFromFiles`)
1.  **Scan & Group:** Iterate through the `FileList` to build a directory tree.
2.  **Parse Series JSON:** Look for `SeriesFolder/SeriesFolder.json`.
    * If found, read and parse the full `MokuroSeriesMetadata` object.
3.  **Queue Creation:** Create one Job per Volume.
    * **Identifiers:** `series_folder_name` (e.g., "Naruto"), `volume_folder_name` (e.g., "Vol 1").
    * **Metadata Extraction:**
        * `series_title`: Taken from `json.series.title`.
        * `volume_title`: Taken from `json.volumes[volume_folder_name].displayTitle`.
    * **Payload:** Attach `.mokuro` file + Images.

### 3.2. Backend Logic (Simplified)
The backend accepts the extraction results directly.

* **Field 1: `series_folder_name`** -> Primary Key for Series.
* **Field 2: `volume_folder_name`** -> Primary Key for Volume.
* **Field 3: `metadata`** -> JSON string containing the *extracted* titles:
  ```json
  { "series_title": "...", "volume_title": "..." }
  ```
  *(Note: We send only the specific titles for this volume, not the entire raw metadata file).*
* **Files:** Saved to `uploads/<series_folder_name>/<volume_folder_name>/`.

### 3.3. Security & Validation
* **Sanitization:** Backend applies `safeFilename()` to folder names.
* **Conflict Resolution:** Rejects upload if `series_folder_name` + `volume_folder_name` exists.

## 4. API Specification (`POST /api/library/upload`)

**Request (Multipart/Form-Data):**
Strict order: Identifiers -> Metadata -> Files.

```http
-----------------------------Boundary
Content-Disposition: form-data; name="series_folder_name"

Naruto
-----------------------------Boundary
Content-Disposition: form-data; name="volume_folder_name"

Vol 1
-----------------------------Boundary
Content-Disposition: form-data; name="metadata"

{ "series_title": "Naruto", "volume_title": "Naruto Vol. 1" }
-----------------------------Boundary
Content-Disposition: form-data; name="mokuro_file"; filename="Vol 1.mokuro"

(Binary Data...)
-----------------------------Boundary
Content-Disposition: form-data; name="images"; filename="001.jpg"

(Binary Data...)
```

**Response:**
```json
{
  "success": true,
  "data": { "seriesId": "...", "volumeId": "..." }
}
```
