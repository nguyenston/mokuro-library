import { describe, expect, it } from 'vitest';
import type { SeriesContribution, VolumeContribution } from '../lib/types';
import {
  clearSelection,
  collectSelectedVolumeIds,
  startSelection,
  toggleSelection
} from '../lib/selection';

const createVolume = (
  id: string,
  seriesId: string,
  hasAhead = 0,
  hasBehind = 0
): VolumeContribution => ({
  id,
  seriesId,
  title: `Volume ${id}`,
  folderName: `volume-${id}`,
  pageCount: 10,
  coverImageName: null,
  progress: [],
  mokuroData: { pages: [] },
  versionInfo: {
    branchId: `branch-${id}`,
    headPatchId: `head-${id}`,
    branchVersion: 0,
    hasAhead,
    hasBehind,
    reviewHeadPatchId: null
  },
  hasAhead,
  hasBehind,
  userPatchCount: 0,
  behindByCount: 0
});

const createSeries = (id: string, volumeIds: string[]): SeriesContribution => {
  const volumes = volumeIds.map((volumeId) => createVolume(volumeId, id));
  return {
    id,
    title: `Series ${id}`,
    coverPath: null,
    volumes,
    totalAhead: 0,
    totalBehind: 0,
    volumesAhead: 0,
    volumesBehind: 0
  };
};

describe('contributions selection helpers', () => {
  const seriesList = [
    createSeries('series-1', ['vol-1', 'vol-2']),
    createSeries('series-2', ['vol-3'])
  ];

  it('starts selection for a volume', () => {
    const result = startSelection(seriesList, 'vol-1', false);

    expect(result.isSelectionMode).toBe(true);
    expect(Array.from(result.selection)).toEqual(['vol-1']);
  });

  it('starts selection for a series by selecting all volumes', () => {
    const result = startSelection(seriesList, 'series-1', true);

    expect(result.isSelectionMode).toBe(true);
    expect(Array.from(result.selection)).toEqual(['vol-1', 'vol-2']);
  });

  it('toggles series selection on and off', () => {
    const initial = startSelection(seriesList, 'series-1', true);
    const toggled = toggleSelection(
      seriesList,
      initial.selection,
      initial.isSelectionMode,
      'series-1',
      true
    );

    expect(toggled.isSelectionMode).toBe(false);
    expect(toggled.selection.size).toBe(0);
  });

  it('filters selected volume ids', () => {
    const selectedItems = new Set(['vol-1', 'unknown-id']);
    const result = collectSelectedVolumeIds(seriesList, selectedItems);

    expect(result).toEqual(['vol-1']);
  });

  it('clears selection state', () => {
    const result = clearSelection();

    expect(result.isSelectionMode).toBe(false);
    expect(result.selection.size).toBe(0);
  });
});
