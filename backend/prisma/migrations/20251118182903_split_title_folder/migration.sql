-- RedefineTables
PRAGMA foreign_keys=OFF;

-- 1. Create new Series table with folderName (Required) and title (Optional)
CREATE TABLE "new_Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "folderName" TEXT NOT NULL,
    "coverPath" TEXT,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Copy data: Map old 'title' to new 'folderName', set new 'title' to NULL
INSERT INTO "new_Series" ("id", "folderName", "title", "coverPath", "ownerId")
SELECT "id", "title", NULL, "coverPath", "ownerId" FROM "Series";

DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_folderName_ownerId_key" ON "Series"("folderName", "ownerId");

-- 3. Create new Volume table
CREATE TABLE "new_Volume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "folderName" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "mokuroPath" TEXT NOT NULL,
    "coverImageName" TEXT,
    "seriesId" TEXT NOT NULL,
    CONSTRAINT "Volume_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. Copy data: Map old 'title' to new 'folderName', set new 'title' to NULL
INSERT INTO "new_Volume" ("id", "folderName", "title", "pageCount", "filePath", "mokuroPath", "coverImageName", "seriesId")
SELECT "id", "title", NULL, "pageCount", "filePath", "mokuroPath", "coverImageName", "seriesId" FROM "Volume";

DROP TABLE "Volume";
ALTER TABLE "new_Volume" RENAME TO "Volume";
CREATE UNIQUE INDEX "Volume_filePath_key" ON "Volume"("filePath");
CREATE UNIQUE INDEX "Volume_mokuroPath_key" ON "Volume"("mokuroPath");
CREATE UNIQUE INDEX "Volume_seriesId_folderName_key" ON "Volume"("seriesId", "folderName");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
