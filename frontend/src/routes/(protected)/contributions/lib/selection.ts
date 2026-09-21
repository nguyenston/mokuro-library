import type { SeriesContribution } from './types';

export type SelectionUpdate = {
  selection: Set<string>;
  isSelectionMode: boolean;
};

function getSeriesVolumeIds(seriesList: SeriesContribution[], seriesId: string) {
  const series = seriesList.find((item) => item.id === seriesId);
  if (!series) return [];
  return series.volumes.map((volume) => volume.id);
}

export function startSelection(
  seriesList: SeriesContribution[],
  itemId: string,
  isSeries: boolean
): SelectionUpdate {
  const selection = new Set<string>();
  if (isSeries) {
    getSeriesVolumeIds(seriesList, itemId).forEach((id) => selection.add(id));
  } else {
    selection.add(itemId);
  }

  return { selection, isSelectionMode: true };
}

export function toggleSelection(
  seriesList: SeriesContribution[],
  selectedItems: Set<string>,
  isSelectionMode: boolean,
  itemId: string,
  isSeries: boolean
): SelectionUpdate {
  if (!isSelectionMode) {
    return startSelection(seriesList, itemId, isSeries);
  }

  const selection = new Set<string>(selectedItems);

  if (isSeries) {
    const volumeIds = getSeriesVolumeIds(seriesList, itemId);
    if (volumeIds.length === 0) {
      return { selection: new Set<string>(selectedItems), isSelectionMode };
    }
    const allSelected = volumeIds.length > 0 && volumeIds.every((id) => selection.has(id));

    if (allSelected) {
      volumeIds.forEach((id) => selection.delete(id));
    } else {
      volumeIds.forEach((id) => selection.add(id));
    }
  } else if (selection.has(itemId)) {
    selection.delete(itemId);
  } else {
    selection.add(itemId);
  }

  return { selection, isSelectionMode: selection.size > 0 };
}

export function clearSelection(): SelectionUpdate {
  return { selection: new Set<string>(), isSelectionMode: false };
}

export function collectSelectedVolumeIds(
  seriesList: SeriesContribution[],
  selectedItems: Set<string>
) {
  const volumeIds = new Set<string>();
  seriesList.forEach((series) => {
    series.volumes.forEach((volume) => volumeIds.add(volume.id));
  });

  return Array.from(selectedItems).filter((id) => volumeIds.has(id));
}
