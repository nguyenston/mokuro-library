import { PrismaClient } from '../generated/prisma/client';

/**
 * Recalculates the status of a series based on its volumes using DB Aggregation.
 * Status Enum: 0 = Unread, 1 = In Progress, 2 = Read
 */
export async function updateSeriesStatus(prisma: PrismaClient, seriesId: string) {
  // 1. Get Series Owner (critical for correctly filtering progress)
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { ownerId: true, status: true }
  });

  if (!series) return;

  const userId = series.ownerId;

  // 2. Run Aggregations in Parallel
  const [totalVolumes, readVolumes, startedVolumes] = await prisma.$transaction([
    // A. How many volumes are there?
    prisma.volume.count({
      where: { seriesId }
    }),

    // B. How many are marked as "Completed"?
    prisma.volume.count({
      where: {
        seriesId,
        progress: {
          some: {
            userId,
            completed: true
          }
        }
      }
    }),

    // C. How many have ANY progress?
    prisma.volume.count({
      where: {
        seriesId,
        progress: {
          some: {
            userId,
            page: { gte: 1 } // Page cannot be zero unless untouched
          }
        }
      }
    })
  ]);

  // 3. Determine Status Logic
  let newStatus = 0; // Default: Unread

  if (totalVolumes === 0) {
    newStatus = 0;
  } else if (readVolumes === totalVolumes) {
    // Every single volume is marked as read
    newStatus = 2; // Read
  } else if (startedVolumes > 0) {
    // Not finished, but at least one volume has been started
    newStatus = 1; // In Progress
  } else {
    // No volumes have been started
    newStatus = 0; // Unread
  }

  // 4. Write to DB only if changed
  if (series.status !== newStatus) {
    await prisma.series.update({
      where: { id: seriesId },
      data: { status: newStatus }
    });
  }
}
