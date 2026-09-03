-- 1. Create New Tables
CREATE TABLE "UserSeriesSettings" (
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "status" INTEGER NOT NULL DEFAULT 0,
    "organized" BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',

    PRIMARY KEY ("userId", "seriesId"),
    CONSTRAINT "UserSeriesSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSeriesSettings_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "targetSeriesId" TEXT,
    "sourceSeriesId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_targetSeriesId_fkey" FOREIGN KEY ("targetSeriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Submission_sourceSeriesId_fkey" FOREIGN KEY ("sourceSeriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Patch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT,
    "nextPatchId" TEXT,
    "volumeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operation" TEXT NOT NULL,
    CONSTRAINT "Patch_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Patch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Patch_nextPatchId_fkey" FOREIGN KEY ("nextPatchId") REFERENCES "Patch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Patch_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Patch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OcrBranch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volumeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headPatchId" TEXT NOT NULL,
    "rootPatchId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "isFloating" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OcrBranch_headPatchId_fkey" FOREIGN KEY ("headPatchId") REFERENCES "Patch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_rootPatchId_fkey" FOREIGN KEY ("rootPatchId") REFERENCES "Patch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. MANUAL MIGRATION: Preserve User Settings
-- We move 'bookmarked', 'status', etc. from Series to UserSeriesSettings
-- We map Series.ownerId -> UserSeriesSettings.userId
INSERT INTO "UserSeriesSettings" ("userId", "seriesId", "bookmarked", "status", "organized", "lastReadAt")
SELECT "ownerId", "id", "bookmarked", "status", "organized", "lastReadAt"
FROM "Series";

-- 3. Cleanup Old OCR System
-- Remove the unused pre-release HistoryChunk table. It was not part of the
-- supported product history workflow and requires no user-data migration.
DROP TABLE IF EXISTS "HistoryChunk";

-- 4. Redefine 'Series' (Drop moved columns)
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "japaneseTitle" TEXT,
    "romajiTitle" TEXT,
    "synonyms" TEXT,
    "description" TEXT,
    "folderName" TEXT NOT NULL,
    "coverPath" TEXT,
    "sortTitle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Series" ("coverPath", "createdAt", "description", "folderName", "id", "japaneseTitle", "ownerId", "romajiTitle", "sortTitle", "synonyms", "title", "updatedAt") 
SELECT "coverPath", "createdAt", "description", "folderName", "id", "japaneseTitle", "ownerId", "romajiTitle", "sortTitle", "synonyms", "title", "updatedAt" 
FROM "Series";

DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_folderName_ownerId_key" ON "Series"("folderName", "ownerId");

-- 5. Redefine 'Volume' (Add submissionId, Drop headPatchId)
CREATE TABLE "new_Volume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "folderName" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "sortTitle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT NOT NULL,
    "mokuroPath" TEXT NOT NULL,
    "coverImageName" TEXT,
    "seriesId" TEXT NOT NULL,
    "submissionId" TEXT,
    CONSTRAINT "Volume_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Volume_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Note: We intentionally do NOT select "headPatchId" here, effectively dropping it.
INSERT INTO "new_Volume" ("coverImageName", "createdAt", "filePath", "folderName", "id", "mokuroPath", "pageCount", "seriesId", "sortTitle", "title", "updatedAt") 
SELECT "coverImageName", "createdAt", "filePath", "folderName", "id", "mokuroPath", "pageCount", "seriesId", "sortTitle", "title", "updatedAt" 
FROM "Volume";

DROP TABLE "Volume";
ALTER TABLE "new_Volume" RENAME TO "Volume";
CREATE UNIQUE INDEX "Volume_filePath_key" ON "Volume"("filePath");
CREATE UNIQUE INDEX "Volume_mokuroPath_key" ON "Volume"("mokuroPath");
CREATE UNIQUE INDEX "Volume_seriesId_folderName_key" ON "Volume"("seriesId", "folderName");

-- 6. Create Indexes
CREATE UNIQUE INDEX "Patch_nextPatchId_key" ON "Patch"("nextPatchId");
CREATE INDEX "Patch_volumeId_idx" ON "Patch"("volumeId");
CREATE INDEX "Patch_parentId_idx" ON "Patch"("parentId");
CREATE UNIQUE INDEX "OcrBranch_volumeId_userId_key" ON "OcrBranch"("volumeId", "userId");
CREATE INDEX "UserSeriesSettings_userId_status_idx" ON "UserSeriesSettings"("userId", "status");
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

PRAGMA foreign_keys=ON;
