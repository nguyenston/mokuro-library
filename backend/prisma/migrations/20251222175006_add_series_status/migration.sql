-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "folderName" TEXT NOT NULL,
    "coverPath" TEXT,
    "description" TEXT,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "status" INTEGER NOT NULL DEFAULT 0,
    "sortTitle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Series" ("bookmarked", "coverPath", "createdAt", "description", "folderName", "id", "lastReadAt", "ownerId", "sortTitle", "title", "updatedAt") SELECT "bookmarked", "coverPath", "createdAt", "description", "folderName", "id", "lastReadAt", "ownerId", "sortTitle", "title", "updatedAt" FROM "Series";
DROP TABLE "Series";
ALTER TABLE "new_Series" RENAME TO "Series";
CREATE UNIQUE INDEX "Series_folderName_ownerId_key" ON "Series"("folderName", "ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
