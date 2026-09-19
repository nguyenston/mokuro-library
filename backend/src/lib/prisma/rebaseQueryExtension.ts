import { Prisma } from "../../generated/prisma/client";

// Raw Row from SQL (Flat, potential BigInts)
interface RebaseQueueRawRow {
  id: string;
  title: string;
  seriesId: string;
  pageCount: number;
  coverImageName: string | null;
  seriesTitle: string;
  branchId: string;
  headPatchId: string;
  branchVersion: number;
  hasAhead: bigint | number;
  hasBehind: bigint | number;
  reviewHeadPatchId: string | null;
  reviewRequestedAt: string | number | null;
  rejectionReason: string | null;
}

interface ContributionSummaryRawRow {
  totalEdits: bigint | number;
  editsMerged: bigint | number;
  volumesEdited: bigint | number;
  pendingReviewCount: bigint | number;
  aheadCount: bigint | number;
  lastEditAt: Date | null;
}

export interface ContributionSummary {
  totalEdits: number;
  editsMerged: number;
  volumesEdited: number;
  pendingReviewCount: number;
  aheadCount: number;
  lastEditAt: string | null;
}

// Clean Output Object (Nested, pure Numbers)
export interface RebaseQueueEntry {
  id: string;
  title: string;
  seriesId: string;
  seriesTitle: string;
  pageCount: number;
  coverImageName: string | null;
  versionInfo: {
    branchId: string;
    headPatchId: string;
    branchVersion: number;
    hasAhead: number;
    hasBehind: number;
    reviewHeadPatchId: string | null;
    reviewRequestedAt: string | null;
    rejectionReason: string | null;
  };
}

export const rebaseQueryExtension = Prisma.defineExtension((client) => {
  const baseQueueSelect = Prisma.sql`
    SELECT
      v.id as "id",
      v."sortTitle" as "title",
      v."seriesId" as "seriesId",
      v."pageCount" as "pageCount",
      v."coverImageName" as "coverImageName",
      s."sortTitle" as "seriesTitle",

      -- Branch Info
      ub.id as "branchId",
      ub."headPatchId" as "headPatchId",
      ub."version" as "branchVersion",
      ub."reviewHeadPatchId" as "reviewHeadPatchId",
      ub."reviewRequestedAt" as "reviewRequestedAt",
      ub."rejectionReason" as "rejectionReason",

      -- Math (Same as Rebase Queue)
      (uh.sequence - (ur.sequence - 1)) as "hasAhead",
      (ah.sequence - (ur.sequence - 1)) as "hasBehind"
  `;

  const baseBranchJoins = Prisma.sql`
    FROM "OcrBranch" ub
    JOIN "Volume" v ON ub."volumeId" = v.id
    JOIN "Series" s ON v."seriesId" = s.id

    -- Admin Branch for 'Behind' calc
    LEFT JOIN "OcrBranch" ab ON ab."volumeId" = ub."volumeId" AND ab."userId" = 'admin'
  `;

  const basePatchJoins = Prisma.sql`
    -- Patch Sequences
    LEFT JOIN "Patch" ah ON ab."headPatchId" = ah.id
    JOIN "Patch" uh ON ub."headPatchId" = uh.id
  `;

  const rootPatchJoinRequired = Prisma.sql`
    JOIN "Patch" ur ON ub."rootPatchId" = ur.id
  `;

  const rootPatchJoinOptional = Prisma.sql`
    LEFT JOIN "Patch" ur ON ub."rootPatchId" = ur.id
  `;

  const mapContributionSummary = (row: ContributionSummaryRawRow | undefined): ContributionSummary => {
    const lastEditRaw = row?.lastEditAt ?? null;
    const lastEditAt =
      lastEditRaw instanceof Date
        ? lastEditRaw.toISOString()
        : lastEditRaw
          ? new Date(lastEditRaw).toISOString()
          : null;

    return {
      totalEdits: Number(row?.totalEdits ?? 0),
      editsMerged: Number(row?.editsMerged ?? 0),
      volumesEdited: Number(row?.volumesEdited ?? 0),
      pendingReviewCount: Number(row?.pendingReviewCount ?? 0),
      aheadCount: Number(row?.aheadCount ?? 0),
      lastEditAt
    };
  };

  const mapRebaseQueueRows = (rows: RebaseQueueRawRow[]): RebaseQueueEntry[] => {
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      seriesId: r.seriesId,
      seriesTitle: r.seriesTitle,
      pageCount: r.pageCount,
      coverImageName: r.coverImageName,
      versionInfo: {
        branchId: r.branchId,
        headPatchId: r.headPatchId,
        branchVersion: r.branchVersion,
        hasAhead: Number(r.hasAhead || 0),
        hasBehind: Number(r.hasBehind || 0),
        reviewHeadPatchId: r.reviewHeadPatchId,
        reviewRequestedAt: r.reviewRequestedAt == null ? null : new Date(r.reviewRequestedAt).toISOString(),
        rejectionReason: r.rejectionReason
      }
    }));
  };

  return client.$extends({
    name: 'rebaseQuery',
    model: {
      ocrBranch: {
        async getVolumesNeedingRebase(userId: string, limit = 50): Promise<RebaseQueueEntry[]> {
          if (userId === 'admin') {
            return [];
          }

          const result = await client.$queryRaw<RebaseQueueRawRow[]>`
            ${baseQueueSelect}
            ${baseBranchJoins}
            ${basePatchJoins}
            ${rootPatchJoinRequired}

            WHERE
              ub."userId" = ${userId}
              AND s."ownerId" = 'admin'

              -- Ahead condition: User Head > Fork Point
              AND uh.sequence > (ur.sequence - 1)
              -- Behind Condition: Admin Head > Fork Point
              AND ah.sequence > (ur.sequence - 1)

            LIMIT ${limit};
          `;

          // Map to the requested nested structure
          return mapRebaseQueueRows(result);
        },
        async getRandomEligibleReviews(userId: string, limit = 1): Promise<RebaseQueueEntry[]> {
          if (userId === 'admin') {
            return [];
          }

          const result = await client.$queryRaw<RebaseQueueRawRow[]>`
            ${baseQueueSelect}
            ${baseBranchJoins}
            ${basePatchJoins}
            ${rootPatchJoinRequired}

            WHERE
              ub."userId" = ${userId}
              AND ub."reviewHeadPatchId" IS NULL
              AND uh.sequence > (ur.sequence - 1)

            ORDER BY RANDOM()
            LIMIT ${limit};
          `;

          return mapRebaseQueueRows(result);
        },
        /**
         * Calculates how many branches for this user are behind the Admin's latest state.
         * Handles both Clean (Case A) and Dirty (Case B) logic.
         */
        async countBehind(userId: string): Promise<number> {
          // Use $queryRaw on the client context
          const result = await client.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            ${baseBranchJoins}
            ${basePatchJoins}
            ${rootPatchJoinOptional}

            WHERE ub."userId" = ${userId}
              AND s."ownerId" = 'admin'
              AND (
                -- Case A: Clean Branch
                (ub."rootPatchId" IS NULL AND ah.sequence > uh.sequence)
                OR
                -- Case B: Dirty Branch
                (ub."rootPatchId" IS NOT NULL AND ah.sequence > (ur.sequence - 1))
              )
          `;

          // Centralized BigInt safety handling
          const count = result[0]?.count ?? 0n;
          return Number(count);
        },
        async getContributionSummary(userId: string): Promise<ContributionSummary> {
          const result = await client.$queryRaw<ContributionSummaryRawRow[]>`
            WITH user_patches AS (
              SELECT p.id, p."volumeId", p.sequence, p."nextPatchId", p."createdAt"
              FROM "Patch" p
              JOIN "Volume" v ON p."volumeId" = v.id
              JOIN "Series" s ON v."seriesId" = s.id
              WHERE p."userId" = ${userId}
                AND s."ownerId" = 'admin'
            ),
            admin_heads AS (
              SELECT ab."volumeId", ab."headPatchId", ah.sequence as "headSequence"
              FROM "OcrBranch" ab
              JOIN "Patch" ah ON ah.id = ab."headPatchId"
              WHERE ab."userId" = 'admin'
            ),
            merged_edits AS (
              SELECT COUNT(*) as count
              FROM user_patches up
              JOIN admin_heads ah ON ah."volumeId" = up."volumeId"
              WHERE (up."nextPatchId" IS NOT NULL OR up.id = ah."headPatchId")
                AND up.sequence <= ah."headSequence"
            ),
            total_edits AS (
              SELECT COUNT(*) as count FROM user_patches
            ),
            volumes_edited AS (
              SELECT COUNT(DISTINCT "volumeId") as count FROM user_patches
            ),
            last_edit AS (
              SELECT MAX("createdAt") as "lastEditAt" FROM user_patches
            ),
            pending_reviews AS (
              SELECT COUNT(*) as count
              FROM "OcrBranch" ub
              JOIN "Volume" v ON ub."volumeId" = v.id
              JOIN "Series" s ON v."seriesId" = s.id
              WHERE ub."userId" = ${userId}
                AND ub."reviewHeadPatchId" IS NOT NULL
                AND s."ownerId" = 'admin'
            ),
            ahead_count AS (
              SELECT COUNT(*) as count
              FROM "OcrBranch" ub
              JOIN "Volume" v ON ub."volumeId" = v.id
              JOIN "Series" s ON v."seriesId" = s.id
              WHERE ub."userId" = ${userId}
                AND ub."rootPatchId" IS NOT NULL
                AND s."ownerId" = 'admin'
            )
            SELECT
              (SELECT count FROM total_edits) as "totalEdits",
              (SELECT count FROM merged_edits) as "editsMerged",
              (SELECT count FROM volumes_edited) as "volumesEdited",
              (SELECT count FROM pending_reviews) as "pendingReviewCount",
              (SELECT count FROM ahead_count) as "aheadCount",
              (SELECT "lastEditAt" FROM last_edit) as "lastEditAt";
          `;

          return mapContributionSummary(result[0]);
        },
      },
    },
  });
});
