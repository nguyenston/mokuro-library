/*
  Warnings:

  - Made the column `sourceSeriesId` on table `Submission` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "targetSeriesId" TEXT,
    "sourceSeriesId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_targetSeriesId_fkey" FOREIGN KEY ("targetSeriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Submission_sourceSeriesId_fkey" FOREIGN KEY ("sourceSeriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Submission" ("id", "reviewNote", "reviewedAt", "sourceSeriesId", "status", "submittedAt", "targetSeriesId", "userId") SELECT "id", "reviewNote", "reviewedAt", "sourceSeriesId", "status", "submittedAt", "targetSeriesId", "userId" FROM "Submission";
DROP TABLE "Submission";
ALTER TABLE "new_Submission" RENAME TO "Submission";
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");
CREATE INDEX "Submission_status_idx" ON "Submission"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
