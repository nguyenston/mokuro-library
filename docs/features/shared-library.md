# Feature Specification: Shared Library & Contributions

## 1. Overview

**Goal:** Transform Mokuro Library from a single-user silo into a **Hybrid Shared System**.

A designated "Admin" account hosts a central library visible to all users. Users can consume this content while maintaining their own private reading progress, bookmarks, and OCR edits without affecting the "Official" version.

### Core Principles

* **Hybrid Visibility:** A user's library view is the union of `{My Private Uploads} ∪ {Admin's Public Uploads}`.
* **Decoupled State:** Reading progress, status, and bookmarks are strictly private per-user.
* **Non-Destructive Editing:** Users view Admin's OCR text by default. Edits fork into a private branch (see OCR Version Control spec).
* **Contribution Workflow:** Users can submit private content for Admin review and inclusion in the shared library.

---

## 2. User Experience (UX)

### 2.1 The "Admin" Library

* **Concept:** Content uploaded by the system administrator (`userId: "admin"`).
* **Visibility:** Automatically appears in every user's library.
* **Distinction:** Admin content displays a visual badge (e.g., "Official" or "Shared").
* **Collisions:** If a user has a private upload with the same name, **both** appear (one private, one shared).

### 2.2 Reading & Progress

* **Private Tracking:** All progress (page position), status (Reading/Completed), and bookmarks are stored per-user.
* **Isolation:** Even if 5 users read the same Admin volume, their progress is completely independent.

### 2.3 Private Uploads

* **Ownership:** Users can upload their own series/volumes to a private library.
* **Visibility:** Private uploads are only visible to the owner.
* **Contribution:** Users can submit private content to Admin for inclusion in the shared library.

---

## 3. Database Architecture

### 3.1 Ownership Model

The `Series` and `Volume` tables include an `ownerId` field:

```prisma
model Series {
  id        String   @id @default(ulid())
  ownerId   String   // "admin" for shared, {userId} for private
  folderName String
  // ...

  @@unique([ownerId, folderName])  // Prevents collisions per-owner
}
```

### 3.2 Per-User Settings (`UserSeriesSettings`)

Decouples user-specific state from shared content:

```prisma
model UserSeriesSettings {
  userId    String
  seriesId  String

  bookmarked Boolean  @default(false)
  status     Int      @default(0) // 0=Unread, 1=Reading, 2=Completed
  lastReadAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  series    Series   @relation(fields: [seriesId], references: [id], onDelete: Cascade)

  @@id([userId, seriesId])
  @@index([userId, status])
}
```

### 3.3 Submission Tracking

Tracks user contributions awaiting Admin review:

```prisma
model Submission {
  id            String   @id @default(ulid())
  userId        String
  status        String   @default("pending") // pending, accepted, rejected

  targetSeriesId String?  // Optional: merge into existing series
  reason        String?   // Rejection reason

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  targetSeries  Series?  @relation(fields: [targetSeriesId], references: [id])
  volumes       SubmissionVolume[]
}

model SubmissionVolume {
  submissionId  String
  volumeId      String

  submission    Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  volume        Volume     @relation(fields: [volumeId], references: [id], onDelete: Cascade)

  @@id([submissionId, volumeId])
}
```

---

## 4. Key Workflows

### 4.1 "My Library" Query

Fetch the library list for the logged-in user:

1. **Query:** `Series` where `ownerId = userId` **OR** `ownerId = 'admin'`
2. **Join:** Include `UserSeriesSettings` where `userId = currentUser`
3. **Merge:** If settings exist, use them; otherwise default to Unread/not bookmarked

### 4.2 Submission Workflow

**User submits content:**

1. User selects private volumes to submit
2. Optionally specifies target series (for merging into existing shared series)
3. System creates `Submission` record with status `pending`
4. Admin is notified of pending submission

**Admin reviews:**

1. Admin views pending submissions
2. Admin can preview the volumes
3. Admin accepts or rejects:
   - **Accept:** Files are moved, ownership transferred to `admin`
   - **Reject:** Submission marked rejected with optional reason

### 4.3 File Organization

**Storage structure:**
```
uploads/
└── {userId}/           # "admin" for shared, {userId} for private
    └── {seriesName}/
        └── {volumeName}/
```

**On acceptance:** Files move from `uploads/{userId}/...` to `uploads/admin/...`

---

## 5. API Specification

### 5.1 API Tree

```
/api/contributions
├── /summary                          GET     - Contribution statistics
├── /submit                           POST    - Submit volumes for review
└── /submissions
    ├── /                             GET     - List submissions
    └── /:id
        ├── /accept                   POST    - Accept submission (admin)
        └── /reject                   POST    - Reject submission (admin)
```

### 5.2 Contributions Summary

**GET** `/api/contributions/summary`

Returns contribution statistics for the current user.

* **Response:**
```json
{
  "pending": 2,
  "accepted": 15,
  "rejected": 1
}
```

### 5.3 Submit Volumes

**POST** `/api/contributions/submit`

Submit private volumes for Admin review.

* **Body:**
```json
{
  "volumeIds": ["vol_1", "vol_2"],
  "targetSeriesId": "series_123"  // Optional: merge into existing
}
```

* **Response:**
```json
{
  "success": true,
  "submissionId": "sub_abc123"
}
```

* **Errors:**
  - `400`: Invalid volume IDs or not owned by user
  - `403`: Admin cannot submit to self

### 5.4 List Submissions

**GET** `/api/contributions/submissions`

List submissions (users see their own, admin sees all).

* **Query:** `status`, `limit`, `offset`

* **Response:**
```json
{
  "submissions": [
    {
      "id": "sub_abc123",
      "userId": "user_456",
      "status": "pending",
      "volumes": [
        { "id": "vol_1", "title": "Volume 1" },
        { "id": "vol_2", "title": "Volume 2" }
      ],
      "targetSeriesId": "series_123",
      "createdAt": "2025-01-02T10:00:00Z"
    }
  ],
  "total": 10
}
```

### 5.5 Accept Submission

**POST** `/api/contributions/submissions/:id/accept`

Admin accepts a submission, transferring ownership.

* **Body:** `{ }` (empty)

* **Behavior:**
  1. Move files from user directory to admin directory
  2. Update `Volume.ownerId` and `Series.ownerId` to `admin`
  3. Mark submission as `accepted`

* **Response:** `{ success: true }`

* **Errors:**
  - `403`: Not authorized (non-admin)
  - `404`: Submission not found

### 5.6 Reject Submission

**POST** `/api/contributions/submissions/:id/reject`

Admin rejects a submission with optional reason.

* **Body:**
```json
{
  "reason": "Duplicate content already exists"
}
```

* **Response:** `{ success: true }`

* **Errors:**
  - `403`: Not authorized (non-admin)
  - `404`: Submission not found

---

## 6. Conflict Handling

### 6.1 Database Collisions

* **Series naming:** `@@unique([ownerId, folderName])` prevents collisions per-owner
* **On acceptance:** If admin already has a series with same name, volumes are merged into it

### 6.2 File Collisions

* **Private uploads:** Isolated in `uploads/users/{userId}/`
* **On acceptance:** Check for existing files, rename if necessary

### 6.3 Display Collisions

* If user has private "Naruto" and admin has shared "Naruto":
  - Both appear in library view
  - Visual badge distinguishes them: "Naruto" vs "Naruto [Official]"

---

## 7. Related Specifications

* **OCR Version Control:** For branching, patching, rebase, and officialize of OCR edits
* **OCR Officialize:** Admin accepts a frozen OCR review prefix through
  `/api/library/volume/:id/officialize`, using fast-forward or implicit rebase.
  Continued user edits remain outside that review. See §4.6 of
  [OCR Version Control](ocr-version-control.md) for boundaries, cancellation,
  and branch-state rules. This is separate from volume submission/ownership transfer.
