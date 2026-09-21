-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OcrBranch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volumeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headPatchId" TEXT NOT NULL,
    "rootPatchId" TEXT,
    "snapshotPatchId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "isPendingReview" BOOLEAN NOT NULL DEFAULT false,
    "submissionNote" TEXT,
    "rejectionReason" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OcrBranch_headPatchId_fkey" FOREIGN KEY ("headPatchId") REFERENCES "Patch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_rootPatchId_fkey" FOREIGN KEY ("rootPatchId") REFERENCES "Patch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_snapshotPatchId_fkey" FOREIGN KEY ("snapshotPatchId") REFERENCES "Patch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OcrBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OcrBranch" ("headPatchId", "id", "rootPatchId", "snapshotPatchId", "updatedAt", "userId", "version", "volumeId") SELECT "headPatchId", "id", "rootPatchId", "snapshotPatchId", "updatedAt", "userId", "version", "volumeId" FROM "OcrBranch";
DROP TABLE "OcrBranch";
ALTER TABLE "new_OcrBranch" RENAME TO "OcrBranch";
CREATE INDEX "OcrBranch_headPatchId_idx" ON "OcrBranch"("headPatchId");
CREATE UNIQUE INDEX "OcrBranch_volumeId_userId_key" ON "OcrBranch"("volumeId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
