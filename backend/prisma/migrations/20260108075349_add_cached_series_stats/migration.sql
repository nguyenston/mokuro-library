-- RedefineTables
PRAGMA defer_foreign_keys=ON;
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
    "totalPageCount" INTEGER NOT NULL DEFAULT 0,
    "totalVolumeCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Series" ("coverPath", "createdAt", "description", "folderName", "id", "japaneseTitle", "ownerId", "romajiTitle", "sortTitle", "synonyms", "title", "updatedAt") SELECT "coverPath", "createdAt", "description", "folderName", "id", "japaneseTitle", "ownerId", "romajiTitle", "sortTitle", "synonyms", "title", "updatedAt" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_folderName_ownerId_key" ON "Series"("folderName", "ownerId");
CREATE TABLE "new_UserSeriesSettings" (
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "status" INTEGER NOT NULL DEFAULT 0,
    "organized" BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
    "readPageCount" INTEGER NOT NULL DEFAULT 0,
    "completedVolumeCount" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("userId", "seriesId"),
    CONSTRAINT "UserSeriesSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSeriesSettings_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSeriesSettings" ("bookmarked", "lastReadAt", "organized", "seriesId", "status", "userId") SELECT "bookmarked", "lastReadAt", "organized", "seriesId", "status", "userId" FROM "UserSeriesSettings";
DROP TABLE "UserSeriesSettings";
ALTER TABLE "new_UserSeriesSettings" RENAME TO "UserSeriesSettings";
CREATE INDEX "UserSeriesSettings_userId_status_idx" ON "UserSeriesSettings"("userId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- =====================================================================
-- MANUAL BACKFILL SCRIPT
-- =====================================================================

-- 1. Backfill Series Stats
-- We use a correlated subquery to calculate totals for every series
UPDATE "Series"
SET
    "totalPageCount" = (
        SELECT COALESCE(SUM("pageCount"), 0)
        FROM "Volume"
        WHERE "Volume"."seriesId" = "Series"."id"
    ),
    "totalVolumeCount" = (
        SELECT COUNT(*)
        FROM "Volume"
        WHERE "Volume"."seriesId" = "Series"."id"
    );

-- 2. Backfill User Stats
-- We use a correlated subquery to sum progress per user/series pair.
-- Logic: If completed (1), use Volume.pageCount. If not, use UserProgress.page.
UPDATE "UserSeriesSettings"
SET
    "readPageCount" = (
        SELECT COALESCE(SUM(
            CASE
                WHEN UP."completed" = 1 THEN V."pageCount"
                ELSE UP."page"
            END
        ), 0)
        FROM "UserProgress" UP
        JOIN "Volume" V ON UP."volumeId" = V."id"
        WHERE UP."userId" = "UserSeriesSettings"."userId"
          AND V."seriesId" = "UserSeriesSettings"."seriesId"
    ),
    "completedVolumeCount" = (
        SELECT COUNT(*)
        FROM "UserProgress" UP
        JOIN "Volume" V ON UP."volumeId" = V."id"
        WHERE UP."userId" = "UserSeriesSettings"."userId"
          AND V."seriesId" = "UserSeriesSettings"."seriesId"
          AND UP."completed" = 1
    );
