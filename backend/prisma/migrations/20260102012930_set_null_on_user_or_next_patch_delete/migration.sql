/*
  Warnings:

  - Made the column `snapshotPatchId` on table `OcrBranch` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OcrBranch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volumeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headPatchId" TEXT NOT NULL,
    "rootPatchId" TEXT,
    "snapshotPatchId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OcrBranch_headPatchId_fkey" FOREIGN KEY ("headPatchId") REFERENCES "Patch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_rootPatchId_fkey" FOREIGN KEY ("rootPatchId") REFERENCES "Patch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OcrBranch" ("headPatchId", "id", "rootPatchId", "snapshotPatchId", "updatedAt", "userId", "version", "volumeId") SELECT "headPatchId", "id", "rootPatchId", "snapshotPatchId", "updatedAt", "userId", "version", "volumeId" FROM "OcrBranch";
DROP TABLE "OcrBranch";
ALTER TABLE "new_OcrBranch" RENAME TO "OcrBranch";
CREATE UNIQUE INDEX "OcrBranch_volumeId_userId_key" ON "OcrBranch"("volumeId", "userId");
CREATE TABLE "new_Patch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT,
    "nextPatchId" TEXT,
    "volumeId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operation" TEXT NOT NULL,
    CONSTRAINT "Patch_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Patch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Patch_nextPatchId_fkey" FOREIGN KEY ("nextPatchId") REFERENCES "Patch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Patch_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Patch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Patch" ("createdAt", "id", "nextPatchId", "operation", "parentId", "userId", "volumeId") SELECT "createdAt", "id", "nextPatchId", "operation", "parentId", "userId", "volumeId" FROM "Patch";
DROP TABLE "Patch";
ALTER TABLE "new_Patch" RENAME TO "Patch";
CREATE UNIQUE INDEX "Patch_nextPatchId_key" ON "Patch"("nextPatchId");
CREATE INDEX "Patch_volumeId_idx" ON "Patch"("volumeId");
CREATE INDEX "Patch_parentId_idx" ON "Patch"("parentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
