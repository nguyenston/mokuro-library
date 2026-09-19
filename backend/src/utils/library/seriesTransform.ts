import { LibraryEntry, SeriesWithOptionalSettings, VolumeResponse } from '../../types/library';
import { Volume, OcrBranch, Patch, UserProgress } from '../../generated/prisma/client';

type VolumeWithBranches = Volume & {
  progress: UserProgress[];
  branches: (OcrBranch & {
    headPatch: Patch;
    rootPatch: Patch | null;
  })[];
};

export function transformSeriesForLibraryQuery(
  series: SeriesWithOptionalSettings,
  userId: string,
): LibraryEntry {
  // If we came from the 'recent' sort, settings are passed directly.
  // If we came from standard sort, settings are in series.userSettings[0].
  const userStats = series.userSettings?.[0];

  // Remove internal relations we don't want to send raw
  // (We use destructuring to separate relations from scalar fields)
  const { userSettings, ...cleanSeries } = series;

  return {
    ...cleanSeries,
    // 1. Flattened User State (Defaults if no interaction yet)
    bookmarked: userStats?.bookmarked ?? false,
    status: userStats?.status ?? 0,
    organized: userStats?.organized ?? false,
    lastReadAt: userStats?.lastReadAt ?? new Date(0), // Epoch if never read

    // 2. Progress Stats (From Cached DB Fields)
    totalPageCount: cleanSeries.totalPageCount ?? 0,
    totalVolumeCount: cleanSeries.totalVolumeCount ?? 0,
    readPageCount: userStats?.readPageCount ?? 0,
    completedVolumeCount: userStats?.completedVolumeCount ?? 0,

    // 3. Computed "Official" Indicator
    isOfficial: series.ownerId === 'admin',

    // 4. Permissions Flag
    canEdit: series.ownerId === userId,
  };
}

/**
 * Transforms a Volume and its mixed branches (User + Admin) into a clean VolumeResponse.
 * Handles the logic for calculating "Ahead/Behind" and "Pending Review" status.
 */
export function transformVolumeWithBranches(
  volume: VolumeWithBranches,
  userId: string
): VolumeResponse {
  // 1. Separate the branches from the single list
  const userBranch = volume.branches.find(b => b.userId === userId);
  const adminBranch = volume.branches.find(b => b.userId === 'admin');

  // 2. Determine Reference Points
  const adminHeadSeq = adminBranch?.headPatch?.sequence ?? 0;

  // Default State (Clean / No edits)
  let versionInfo = {
    branchId: "",
    headPatchId: "",
    branchVersion: 0,
    hasAhead: 0,
    hasBehind: 0,
    reviewHeadPatchId: null as string | null,
    reviewRequestedAt: null as Date | null,
    rejectionReason: null as string | null
  };

  // 3. Calculate Divergence if User has a branch
  if (userBranch) {
    const userHeadSeq = userBranch.headPatch.sequence;

    const forkPointSeq = userBranch.rootPatch ? (userBranch.rootPatch.sequence - 1) : userBranch.headPatch.sequence;

    // AHEAD: How many patches have I made since the fork?
    // UserHead - ForkPoint
    const aheadCount = Math.max(0, userHeadSeq - forkPointSeq);

    // BEHIND: How many patches has Admin made since the fork?
    // AdminHead - ForkPoint
    const behindCount = Math.max(0, adminHeadSeq - forkPointSeq);

    versionInfo = {
      branchId: userBranch.id,
      headPatchId: userBranch.headPatchId,
      branchVersion: userBranch.version,
      hasAhead: aheadCount,
      hasBehind: behindCount,
      reviewHeadPatchId: userBranch.reviewHeadPatchId,
      reviewRequestedAt: userBranch.reviewRequestedAt,
      rejectionReason: userBranch.rejectionReason
    };
  }

  return {
    id: volume.id,
    title: volume.sortTitle,
    folderName: volume.folderName,
    seriesId: volume.seriesId,
    pageCount: volume.pageCount,
    coverImageName: volume.coverImageName,
    progress: volume.progress,
    mokuroData: { pages: [] }, // Optimization: Empty for list view
    versionInfo
  };
}
