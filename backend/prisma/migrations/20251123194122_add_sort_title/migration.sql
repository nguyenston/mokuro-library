/*
  Warnings:

  - Added the required column `sortTitle` to the `Series` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sortTitle` to the `Volume` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "folderName" TEXT NOT NULL,
    "coverPath" TEXT,
    "sortTitle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Series" (
    "id", "title", "folderName", "coverPath", "ownerId", 
    "createdAt", "updatedAt", "lastReadAt", 
    "sortTitle"
)
SELECT 
    "id", "title", "folderName", "coverPath", "ownerId", 
    "createdAt", "updatedAt", "lastReadAt", 
    COALESCE("title", "folderName") -- Set sortTitle to title. If title is NULL, use folderName.
FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_folderName_ownerId_key" ON "Series"("folderName", "ownerId");
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
    CONSTRAINT "Volume_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Volume" (
    "id", "title", "folderName", "pageCount", 
    "filePath", "mokuroPath", "coverImageName", "seriesId", 
    "createdAt", "updatedAt", 
    "sortTitle"
) 
SELECT 
    "id", "title", "folderName", "pageCount", 
    "filePath", "mokuroPath", "coverImageName", "seriesId", 
    "createdAt", "updatedAt", 
    COALESCE("title", "folderName") -- Set sortTitle to title. If title is NULL, use folderName.
FROM "Volume";
DROP TABLE "Volume";
ALTER TABLE "new_Volume" RENAME TO "Volume";
CREATE UNIQUE INDEX "Volume_filePath_key" ON "Volume"("filePath");
CREATE UNIQUE INDEX "Volume_mokuroPath_key" ON "Volume"("mokuroPath");
CREATE UNIQUE INDEX "Volume_seriesId_folderName_key" ON "Volume"("seriesId", "folderName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
