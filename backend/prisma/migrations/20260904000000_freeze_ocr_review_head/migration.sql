-- Preserve history and existing branch identities; only review metadata changes.
ALTER TABLE "OcrBranch" ADD COLUMN "reviewHeadPatchId" TEXT
    REFERENCES "Patch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OcrBranch" ADD COLUMN "reviewRequestedAt" DATETIME;

-- The legacy flag did not record a submitted head/time. Freeze the migration-time
-- head only for a connected active private range; updatedAt is an approximation
-- of request time. UNION prevents malformed cycles from recursing indefinitely.
WITH RECURSIVE ancestry(branchId, patchId, parentId) AS (
    SELECT b.id, p.id, p.parentId
    FROM "OcrBranch" b JOIN "Patch" p ON p.id = b.headPatchId AND p.volumeId = b.volumeId
    WHERE b.isPendingReview = 1 AND b.rootPatchId IS NOT NULL AND b.userId <> 'admin'
    UNION
    SELECT a.branchId, p.id, p.parentId
    FROM ancestry a
    JOIN "OcrBranch" b ON b.id = a.branchId
    JOIN "Patch" p ON p.id = a.parentId AND p.volumeId = b.volumeId
)
UPDATE "OcrBranch"
SET "reviewHeadPatchId" = "headPatchId", "reviewRequestedAt" = "updatedAt"
WHERE id IN (
    SELECT a.branchId FROM ancestry a
    JOIN "OcrBranch" b ON b.id = a.branchId AND b.rootPatchId = a.patchId
);

-- Invalid pending ranges cannot be carried forward as frozen reviews.
UPDATE "OcrBranch"
SET "rejectionReason" = COALESCE("rejectionReason", 'Review cancelled during upgrade: no active connected private range. Please submit again.')
WHERE "isPendingReview" = 1 AND "reviewHeadPatchId" IS NULL;

ALTER TABLE "OcrBranch" DROP COLUMN "isPendingReview";
