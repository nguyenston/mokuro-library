import type { Series } from '$lib/types';
import type {
  ActivityEntry,
  ActivityGraphDay,
  ConflictType,
  FilterType,
  RebaseResolution,
  SeriesContribution,
  StatusInfo,
  VolumeContribution
} from './types';
import { SvelteDate } from 'svelte/reactivity';
import { ACTIVITY_EDIT_TYPES } from './constants';

export function buildSeriesContributions(library: Series[]) {
  const seriesList: SeriesContribution[] = [];
  let behindCount = 0;
  let aheadCount = 0;

  library.forEach((series) => {
    if (!series.volumes || series.totalVolumeCount === 0) return;

    const volumeContribs: VolumeContribution[] = [];
    let totalAhead = 0;
    let totalBehind = 0;
    let volumesAhead = 0;
    let volumesBehind = 0;

    // Use actual volumes from the API
    series.volumes.forEach((volume) => {
      const hasAhead = volume.versionInfo?.hasAhead ?? 0;
      const hasBehind = volume.versionInfo?.hasBehind ?? 0;
      const userPatchCount = hasAhead;
      const behindByCount = hasBehind;

      if (hasAhead > 0) {
        totalAhead += userPatchCount;
        volumesAhead++;
      }
      if (hasBehind > 0) {
        totalBehind += behindByCount;
        volumesBehind++;
      }

      // Use actual volume data
      volumeContribs.push({
        ...volume,
        hasAhead,
        hasBehind,
        userPatchCount,
        behindByCount
      });
    });

    if (totalAhead > 0 || totalBehind > 0) {
      // Count for filter badges while we're already iterating
      if (totalBehind > 0) behindCount++;
      if (totalAhead > 0) aheadCount++;

      seriesList.push({
        id: series.id,
        title: series.title || series.folderName,
        coverPath: series.coverPath,
        volumes: volumeContribs,
        totalAhead,
        totalBehind,
        volumesAhead,
        volumesBehind
      });
    }
  });

  return { seriesList, filterCounts: { behind: behindCount, ahead: aheadCount } };
}

export function filterSeriesByStatus(seriesList: SeriesContribution[], activeFilter: FilterType) {
  switch (activeFilter) {
    case 'behind':
      return seriesList.filter((series) => series.totalBehind > 0);
    case 'ahead':
      return seriesList.filter((series) => series.totalAhead > 0);
    default:
      return seriesList;
  }
}

export function getStatusInfo(volume: VolumeContribution): StatusInfo {
  if (volume.hasAhead > 0 && volume.hasBehind > 0) {
    return { color: 'bg-status-warning', textColor: 'text-status-warning', icon: '⚠️' };
  }
  if (volume.hasAhead > 0) {
    return { color: 'bg-accent', textColor: 'text-accent', icon: '✏️' };
  }
  if (volume.hasBehind > 0) {
    return { color: 'bg-status-unread', textColor: 'text-status-unread', icon: '🔄' };
  }
  return { color: 'bg-status-success', textColor: 'text-status-success', icon: '✓' };
}

export function getSeriesCoverUrl(seriesId: string) {
  const url = `/api/files/series/${seriesId}/cover`;
  console.log('[Series Cover] Generated URL:', url, 'for seriesId:', seriesId);
  return url;
}

export function getVolumeCoverUrl(volumeId: string, coverImageName: string | null) {
  console.log('[Volume Cover URL] Generating for:', { volumeId, coverImageName });
  if (!coverImageName) {
    console.log('[Volume Cover URL] ❌ No coverImageName provided, returning null');
    return null;
  }
  const url = `/api/files/volume/${volumeId}/image/${coverImageName}`;
  console.log('[Volume Cover URL] ✓ Generated:', url);
  console.log('[Volume Cover URL] ⚠️ Note: This will fail for mock volume IDs');
  return url;
}

export function handleImageError(event: Event, type: 'series' | 'volume', id: string) {
  const img = event.target as HTMLImageElement;
  console.error(`[${type} Cover] Failed to load image for ${id}:`, img.src);
}

function xmur3(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRandom(seed: string) {
  return mulberry32(xmur3(seed)());
}

function buildActivitySeed(seriesList: SeriesContribution[]) {
  const seriesSeeds = seriesList.map((series) => {
    const volumeIds = series.volumes.map((volume) => volume.id).sort();
    return `${series.id}:${volumeIds.join(',')}`;
  });
  return seriesSeeds.sort().join('|') || 'contributions';
}

export function buildActivityHistory(seriesList: SeriesContribution[]): ActivityEntry[] {
  const now = new SvelteDate();
  now.setHours(0, 0, 0, 0);
  const entries: ActivityEntry[] = [];
  const seedBase = buildActivitySeed(seriesList);

  // Generate diverse activity across the last 30 days
  seriesList.slice(0, 3).forEach((series) => {
    series.volumes.slice(0, 2).forEach((volume, volIdx) => {
      if (volume.hasAhead > 0) {
        const rand = createSeededRandom(`${seedBase}:${volume.id}`);
        // Create multiple edits for each volume across different days
        const numEdits = Math.floor(rand() * 4) + 2; // 2-5 edit sessions per volume
        for (let i = 0; i < numEdits; i++) {
          const daysAgo = Math.floor(rand() * 28) + 1; // Random day in last 28 days
          const patchCount = Math.floor(rand() * 8) + 1; // 1-8 patches per session
          entries.push({
            id: `activity-${volume.id}-${i}`,
            volumeId: volume.id,
            volumeTitle: volume.title || `Volume ${volIdx + 1}`,
            seriesTitle: series.title || 'Unknown Series',
            seriesId: series.id,
            timestamp: new SvelteDate(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
            patchCount,
            editType: ACTIVITY_EDIT_TYPES[Math.floor(rand() * ACTIVITY_EDIT_TYPES.length)]
          });
        }
      }
    });
  });

  return entries.sort(
    (a, b) => new SvelteDate(b.timestamp).getTime() - new SvelteDate(a.timestamp).getTime()
  );
}

export function getRecentlyEdited(seriesList: SeriesContribution[]): VolumeContribution[] {
  const allVolumes: VolumeContribution[] = [];
  seriesList.forEach((series) => {
    series.volumes.forEach((volume) => {
      if (volume.hasAhead > 0) allVolumes.push(volume);
    });
  });
  return allVolumes.slice(0, 5);
}

export function getEditTypeIcon(type: ActivityEntry['editType']) {
  switch (type) {
    case 'text':
      return '✏️';
    case 'box':
      return '📦';
    case 'font':
      return '🔤';
    case 'structure':
      return '🏗️';
  }
}

export function buildActivityGraph(
  activityHistory: ActivityEntry[],
  days = 30
): ActivityGraphDay[] {
  if (activityHistory.length === 0) return [];

  const now = new SvelteDate();
  const graphData: ActivityGraphDay[] = [];

  // Create array of last X days
  for (let i = days - 1; i >= 0; i--) {
    const date = new SvelteDate(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    graphData.push({
      date: dateStr,
      count: 0,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' })
    });
  }

  // Count activities per day
  activityHistory.forEach((activity) => {
    const activityDate = new SvelteDate(activity.timestamp).toISOString().split('T')[0];
    const dayData = graphData.find((day) => day.date === activityDate);
    if (dayData) {
      dayData.count += activity.patchCount;
    }
  });

  return graphData;
}

export function getVolumesNeedingRebase(seriesList: SeriesContribution[]): VolumeContribution[] {
  const volumes: VolumeContribution[] = [];
  seriesList.forEach((series) => {
    series.volumes.forEach((volume) => {
      if (volume.hasBehind > 0) volumes.push(volume);
    });
  });
  return volumes;
}

export function getConflictTypeLabel(type: ConflictType) {
  switch (type) {
    case 'content_conflict':
      return 'Content Conflict';
    case 'dead_zone':
      return 'Deleted Block';
    case 'double_delete':
      return 'Double Delete';
    case 'reorder_length_change':
      return 'Reorder + Length Change';
    case 'competing_reorder':
      return 'Competing Reorders';
    default:
      return 'Conflict';
  }
}

export function getAvailableResolutions(type: ConflictType): RebaseResolution[] {
  switch (type) {
    case 'dead_zone':
      return ['skip', 'resurrect'];
    case 'double_delete':
      return ['skip'];
    default:
      return ['keep_admin', 'keep_mine'];
  }
}
