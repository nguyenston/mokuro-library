import { HttpError } from "../../types/error";
import { Prisma, Series, UserSeriesSettings } from "../../generated/prisma/client";
import { SubmissionExecutionPlan } from "../../utils/submissionHelper";
import { SeriesFindUniqueArgs, UserSeriesSettingsUpdateArgs, UserSeriesSettingsUpsertArgs } from "../../generated/prisma/models";
import { z } from 'zod';
import { Sql, PrismaPromise } from "@prisma/client/runtime/client";
import { parseStoredPatchOperation } from "../PatchOperationValidator";

// We use z.coerce.number() because SQL aggregations (SUM, COUNT) often
// return results as BigInts or Strings depending on the database driver.
const UserProgressSummarySchema = z.object({
  userId: z.string(),
  completedPages: z.coerce.number(),
  completedVolumes: z.coerce.number(),
});
const UserProgressListSchema = z.array(UserProgressSummarySchema);

type FlexibleSeriesClient = {
  userSeriesSettings: {
    // 'args: never' allows a function expecting specific args to be assigned here
    upsert: (args: UserSeriesSettingsUpsertArgs) => Promise<UserSeriesSettings>;
    update: (args: UserSeriesSettingsUpdateArgs) => Promise<UserSeriesSettings>;
  };
  series: {
    findUnique: (args: SeriesFindUniqueArgs) => Promise<Series | null>;
  };
  $queryRaw: <T = unknown>(query: TemplateStringsArray | Sql, ...values: any[]) => PrismaPromise<T>
};

async function updateSeriesStats(
  prisma: FlexibleSeriesClient,
  userId: string,
  seriesId: string,
  pageDelta: number,
  volumeDelta: number
) {
  // 1. Atomic Update of Counts
  // We use increment/decrement to ensure thread safety during concurrent writes
  let updatedSettings = await prisma.userSeriesSettings.upsert({
    where: { userId_seriesId: { userId, seriesId } },
    create: {
      userId,
      seriesId,
      readPageCount: pageDelta > 0 ? pageDelta : 0,
      completedVolumeCount: volumeDelta > 0 ? volumeDelta : 0,
      status: 0
    },
    update: {
      readPageCount: { increment: pageDelta },
      completedVolumeCount: { increment: volumeDelta }
    }
  });

  // 2. Recalculate "Read Status" based on the new counts
  // We need the Series totals to know if we are "Completed"
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { totalVolumeCount: true }
  });

  if (!series) return;

  let newStatus = 0; // Unread
  // Logic: If you've finished all volumes (and there is at least 1 volume), it's Completed.
  if (updatedSettings.completedVolumeCount >= series.totalVolumeCount && series.totalVolumeCount > 0) {
    newStatus = 2; // Completed
  } else if (updatedSettings.readPageCount > 0) {
    newStatus = 1; // Reading
  }

  // Only update status if it actually changed (DB optimization)
  if (updatedSettings.status !== newStatus) {
    updatedSettings = await prisma.userSeriesSettings.update({
      where: { userId_seriesId: { userId, seriesId } },
      data: { status: newStatus }
    });
  }
  console.log(updatedSettings)
}
async function getUserTotalProgress(volumeIds: string[], client: FlexibleSeriesClient): Promise<Map<string, {
  completedPages: number;
  completedVolumes: number;
}>> {
  if (volumeIds.length === 0) return new Map();

  // 2. Execute Raw SQL
  const rawResults = await client.$queryRaw`
    SELECT
      up."userId",
      SUM(
        CASE
          WHEN up.completed = true THEN v."pageCount"
          ELSE up.page
        END
      ) AS "completedPages",
      COUNT(*) FILTER (WHERE up.completed = true) AS "completedVolumes"
    FROM "UserProgress" up
    INNER JOIN "Volume" v ON up."volumeId" = v.id
    WHERE up."volumeId" IN (${Prisma.join(volumeIds)})
    GROUP BY up."userId"
  `;

  // 3. Validate with Zod
  // .parse() will throw an error if the DB returns unexpected data types
  const validatedResults = UserProgressListSchema.parse(rawResults);

  // 4. Map the validated results
  return new Map<string, {
    completedPages: number;
    completedVolumes: number;
  }>(
    validatedResults.map((r) => [
      r.userId,
      {
        completedPages: r.completedPages,
        completedVolumes: r.completedVolumes,
      },
    ])
  );
}

export const statsExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'statsExtension',
    client: {
      async migrateVolumesTransaction(plan: SubmissionExecutionPlan): Promise<string> {

        const volumeIds = plan.volumeMoves.map(v => v.id);
        const totalPages = plan.volumeMoves.reduce((sum, m) => sum + m.pageCount, 0);
        const totalVolumes = plan.volumeMoves.length;
        const userTotalProgress = await getUserTotalProgress(volumeIds, client);

        return await client.$transaction(async (tx) => {
          let finalSeriesId = plan.targetSeriesId;

          // A. Handle Target Series (Create or Update)
          if (finalSeriesId) {
            await tx.series.update({
              where: { id: finalSeriesId },
              data: {
                totalPageCount: { increment: totalPages },
                totalVolumeCount: { increment: totalVolumes }
              }
            });
          } else if (plan.newSeriesData) {
            const newSeries = await tx.series.create({
              data: {
                ...plan.newSeriesData,
                ownerId: 'admin',
                totalPageCount: totalPages,
                totalVolumeCount: totalVolumes
              }
            });
            finalSeriesId = newSeries.id;
          } else {
            throw new Error("Migration Failed: No target ID and no creation data provided.");
          }

          if (!finalSeriesId) throw new Error("Migration Failed: Logic Error resolving Series ID.");

          // Auto-Demote users in new series (Standard Create Logic)
          // "If you were done, you aren't anymore because I just added/moved a book here."
          await tx.userSeriesSettings.updateMany({
            where: { seriesId: finalSeriesId, status: 2 },
            data: { status: 1 }
          });

          // Add User Stats to New Series
          for (const [userId, p] of userTotalProgress.entries()) {
            const pages = p.completedPages;
            const vol = p.completedVolumes;
            await updateSeriesStats(tx, userId, finalSeriesId, pages, vol);
          }

          // B. Update Source Series Stats
          const sourceSeries = await tx.series.update({
            where: { id: plan.sourceSeriesId },
            data: {
              totalPageCount: { decrement: totalPages },
              totalVolumeCount: { decrement: totalVolumes }
            }
          });

          // Auto-Promote users in old series (Standard Delete Logic)
          await tx.userSeriesSettings.updateMany({
            where: { seriesId: sourceSeries.id, completedVolumeCount: sourceSeries.totalVolumeCount },
            data: { status: 2 }
          });

          // Remove User Stats from Old Series
          for (const [userId, p] of userTotalProgress.entries()) {
            const pages = p.completedPages;
            const vol = p.completedVolumes;
            await updateSeriesStats(tx, userId, sourceSeries.id, -pages, -vol);
          }

          // C. Update Volumes
          for (const move of plan.volumeMoves) {
            await tx.volume.update({
              where: { id: move.id },
              data: {
                seriesId: finalSeriesId,
                filePath: move.newPathRel,
                mokuroPath: move.newMokuroRel
              }
            });

            const genesisPatch = await tx.patch.findFirst({
              where: { volumeId: move.id, parentId: null }
            });

            if (genesisPatch) {
              const op = parseStoredPatchOperation(
                genesisPatch.operation,
                `patch ${genesisPatch.id}`
              );
              if (op.op === 'genesis') {
                op.path = move.newMokuroRel;
                await tx.patch.update({
                  where: { id: genesisPatch.id },
                  data: { operation: JSON.stringify(op) }
                });
              }
            }
          }


          return finalSeriesId;
        }, { timeout: 30000 });
      }
    },
    query: {
      volume: {
        async create({ args, query }) {
          const result = await query(args);
          // 1. Increment Series Stats on Create
          if (!result.seriesId) throw new HttpError(403, `Create volume query must select seriesId for stat sync.`)
          await client.series.update({
            where: { id: result.seriesId },
            data: {
              totalPageCount: { increment: result.pageCount },
              totalVolumeCount: { increment: 1 },
            },
          });
          await client.userSeriesSettings.updateMany({
            where: { seriesId: result.seriesId, status: 2 },
            data: { status: 1 }
          })
          return result;
        },
        async delete({ args, query }) {
          // 2. Handle Volume Deletion
          // NOTE: We must pre-fetch data because 'Cascade' delete happens at DB level
          // and we won't be able to see the connected progress rows after the delete.
          const volId = args.where.id;
          if (!volId) return query(args);

          const volume = await client.volume.findUnique({
            where: { id: volId },
            include: {
              progress: true // Fetch users who will be affected
            }
          });

          if (!volume) return query(args);

          // Execute the Delete
          const result = await query(args);

          // A. Decrement Series Stats
          const series = await client.series.update({
            where: { id: volume.seriesId },
            data: {
              totalPageCount: { decrement: volume.pageCount },
              totalVolumeCount: { decrement: 1 },
            },
          });

          await client.userSeriesSettings.updateMany({
            where: { seriesId: series.id, completedVolumeCount: series.totalVolumeCount },
            data: { status: 2 }
          });

          // B. Decrement User Stats (Manual Cascade Handling)
          for (const p of volume.progress) {
            // Rule: If they finished the volume, they lose 'pageCount' pages.
            //       If they were reading it, they lose 'p.page' pages.
            const pagesToRemove = p.completed ? volume.pageCount : p.page;
            const volumesToRemove = p.completed ? 1 : 0;

            await updateSeriesStats(client, p.userId, volume.seriesId, -pagesToRemove, -volumesToRemove);
          }

          return result;
        },
        async update({ args, query }) {
          // 1. Pre-fetch Old Data
          const oldVolume = await client.volume.findFirst({
            where: args.where,
            include: { progress: true }
          });

          if (!oldVolume) return query(args);

          const newSeriesId = (args.data.seriesId as string) || oldVolume.seriesId;
          const newPageCount = (args.data.pageCount as number) ?? oldVolume.pageCount;

          // Optimization: If relevant fields didn't change, skip logic
          if (newSeriesId === oldVolume.seriesId && newPageCount === oldVolume.pageCount) {
            return query(args);
          }

          // 2. Execute Update
          const result = await query(args);

          // 3. LOGIC: REMOVE from Old Location
          const oldSeries = await client.series.update({
            where: { id: oldVolume.seriesId },
            data: {
              totalPageCount: { decrement: oldVolume.pageCount },
              totalVolumeCount: { decrement: 1 }
            }
          });

          // Auto-Promote users in old series (Standard Delete Logic)
          await client.userSeriesSettings.updateMany({
            where: { seriesId: oldVolume.seriesId, completedVolumeCount: oldSeries.totalVolumeCount },
            data: { status: 2 }
          });

          // Remove User Stats from Old Series
          for (const p of oldVolume.progress) {
            const pages = p.completed ? oldVolume.pageCount : p.page;
            const vol = p.completed ? 1 : 0;
            await updateSeriesStats(client, p.userId, oldVolume.seriesId, -pages, -vol);
          }

          // 4. LOGIC: ADD to New Location
          await client.series.update({
            where: { id: newSeriesId },
            data: {
              totalPageCount: { increment: newPageCount },
              totalVolumeCount: { increment: 1 }
            }
          });

          // Auto-Demote users in new series (Standard Create Logic)
          // "If you were done, you aren't anymore because I just added/moved a book here."
          await client.userSeriesSettings.updateMany({
            where: { seriesId: newSeriesId, status: 2 },
            data: { status: 1 }
          });

          // Add User Stats to New Series
          for (const p of oldVolume.progress) {
            // Note: We use newPageCount here. If they completed it, their read-count scales up/down.
            const pages = p.completed ? newPageCount : p.page;
            const vol = p.completed ? 1 : 0;
            await updateSeriesStats(client, p.userId, newSeriesId, pages, vol);
          }

          return result;
        },
        // --- SAFETY BLOCKS ---
        async updateMany({ args, query }) {
          if (args.data.seriesId) throw new Error("Stats Safety: 'updateMany' cannot be used to update seriesId. Use 'update' in a loop.");
          return await query(args);
        },
        async upsert() { throw new Error("Stats Safety: 'upsert' is disabled for Volume. Use 'create' to ensure stats are tracked."); },
        async createMany() { throw new Error("Stats Safety: 'createMany' is disabled for Volume. Use 'create' in a loop."); },
        async deleteMany() { throw new Error("Stats Safety: 'deleteMany' is disabled for Volume. Use 'delete' in a loop."); }
      },
      userProgress: {
        async upsert({ args, query }) {
          const userId_volumeId = args.where.userId_volumeId;
          if (!userId_volumeId) throw new HttpError(403, `Upserting UserProgress cannot be done through direct id queries.`);

          const { userId, volumeId } = userId_volumeId;

          // Get "Before" State
          const oldProgress = await client.userProgress.findUnique({
            where: { userId_volumeId: { userId, volumeId } }
          });

          // Get Volume Context (for max pages)
          const volume = await client.volume.findUnique({
            where: { id: volumeId },
            select: { pageCount: true, seriesId: true }
          });

          if (!volume) throw new HttpError(500, `DB Corruption: Dangling UserProgress found.`);

          // Execute Update
          const result = await query(args);
          if (result.page === undefined) throw new HttpError(403, `Upserting UserProgress needs page field to be selected.`);

          // Calculate Deltas
          const oldCompleted = oldProgress?.completed ?? false;
          // Rule: If completed, pages = max. Else pages = current.
          const oldPages = oldCompleted ? volume.pageCount : (oldProgress?.page ?? 0);

          const newCompleted = result.completed;
          const newPages = newCompleted ? volume.pageCount : result.page;

          const deltaPages = newPages - oldPages;
          const deltaVolumes = (newCompleted ? 1 : 0) - (oldCompleted ? 1 : 0);

          if (deltaPages !== 0 || deltaVolumes !== 0) {
            await updateSeriesStats(client, userId, volume.seriesId, deltaPages, deltaVolumes);
          }

          return result;
        },
        async delete({ args, query }) {
          // Handle Single Progress Reset (Wipe)
          const userId_volumeId = args.where.userId_volumeId;
          if (!userId_volumeId) throw new HttpError(403, `Deleting UserProgress cannot be done through direct id queries.`);

          const { userId, volumeId } = userId_volumeId;
          const oldProgress = await client.userProgress.findUnique({
            where: { userId_volumeId: { userId, volumeId } },
            include: { volume: true }
          });

          const result = await query(args);

          if (oldProgress && oldProgress.volume) {
            const pagesToRemove = oldProgress.completed ? oldProgress.volume.pageCount : oldProgress.page;
            const volumesToRemove = oldProgress.completed ? 1 : 0;
            await updateSeriesStats(client, userId, oldProgress.volume.seriesId, -pagesToRemove, -volumesToRemove);
          }
          return result;
        },
        // --- SAFETY BLOCKS ---
        async create() { throw new Error("Stats Safety: 'create' is disabled for UserProgress. Use 'upsert' to ensure stats are tracked."); },
        async update() { throw new Error("Stats Safety: 'update' is disabled for UserProgress. Use 'upsert' to ensure stats are tracked."); },
        async createMany() { throw new Error("Stats Safety: 'createMany' is disabled for UserProgress."); },
        async deleteMany() { throw new Error("Stats Safety: 'deleteMany' is disabled for UserProgress."); }
      }
    }
  })
});
