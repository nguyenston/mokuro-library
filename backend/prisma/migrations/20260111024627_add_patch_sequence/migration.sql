/*
  Safe SQLite Migration: Add 'sequence' column

  1. Creates new table with "sequence INTEGER NOT NULL"
  2. Calculates sequences using CTE from existing data
  3. Inserts old data + calculated sequence into new table
  4. Swaps tables
*/

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- 1. Create the new table
CREATE TABLE "new_Patch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT,
    "nextPatchId" TEXT,
    "volumeId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    CONSTRAINT "Patch_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Patch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Patch_nextPatchId_fkey" FOREIGN KEY ("nextPatchId") REFERENCES "Patch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Patch_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Patch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 2. INSERT with CTE Calculation
WITH RECURSIVE PatchTree(id, calculated_seq) AS (
    -- Base Case: Genesis Patches (No parent)
    SELECT id, 0
    FROM "Patch"
    WHERE parentId IS NULL

    UNION ALL

    -- Recursive Step: Child = Parent + 1
    SELECT p.id, pt.calculated_seq + 1
    FROM "Patch" p
    INNER JOIN PatchTree pt ON p.parentId = pt.id
)
INSERT INTO "new_Patch" (
    "id", "parentId", "nextPatchId", "volumeId", "userId", "createdAt", "operation", "sequence"
)
SELECT
    p.id,
    p.parentId,
    p.nextPatchId,
    p.volumeId,
    p.userId,
    p.createdAt,
    p.operation,
    -- If the tree is broken (orphan), default to 0 to save data,
    -- otherwise use calculated sequence.
    COALESCE(pt.calculated_seq, 0)
FROM "Patch" p
LEFT JOIN PatchTree pt ON p.id = pt.id;

-- 3. Drop Old Table
DROP TABLE "Patch";

-- 4. Rename New Table
ALTER TABLE "new_Patch" RENAME TO "Patch";

-- 5. Recreate Indexes
CREATE UNIQUE INDEX "Patch_nextPatchId_key" ON "Patch"("nextPatchId");
CREATE INDEX "Patch_volumeId_idx" ON "Patch"("volumeId");
CREATE INDEX "Patch_parentId_idx" ON "Patch"("parentId");
CREATE INDEX "Patch_volumeId_userId_createdAt_idx" ON "Patch"("volumeId", "userId", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
