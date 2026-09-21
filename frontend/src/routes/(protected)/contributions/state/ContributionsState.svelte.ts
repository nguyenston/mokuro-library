import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { apiFetch } from '$lib/services/api';
import { uiState } from '$lib/states/ui/uiState.svelte.ts';
import type { Series } from '$lib/types';
import { sampleStats } from '../lib/constants';
import type { FilterType, RebaseResolution, VolumeContribution } from '../lib/types';
import {
  createRebaseModalState,
  createResetModalState,
  openRebaseModal,
  openResetModal,
  type RebaseModalState,
  type ResetModalState
} from '../lib/modals';
import { SvelteSet, SvelteDate } from 'svelte/reactivity';
import {
  buildActivityGraph,
  buildActivityHistory,
  buildSeriesContributions,
  filterSeriesByStatus,
  getRecentlyEdited,
  getVolumesNeedingRebase
} from '../lib/utils';
import {
  clearSelection,
  collectSelectedVolumeIds,
  startSelection,
  toggleSelection as toggleSelectionItems
} from '../lib/selection';

export class ContributionsState {
  activeFilter = $state<FilterType>('behind');
  library = $state<Series[]>([]);
  isLoading = $state(true);
  error = $state<string | null>(null);
  expandedSeries = new SvelteSet<string>();
  isResetting = $state(false);

  showActivityTimeline = $state(false);
  showDiffViewer = $state(false);
  selectedDiffVolume = $state<VolumeContribution | null>(null);

  isSelectionMode = $state(false);
  selectedItems = new SvelteSet<string>();

  rebaseModal = $state<RebaseModalState>(createRebaseModalState());
  resetModal = $state<ResetModalState>(createResetModalState());

  seriesContributions = $derived.by(() => buildSeriesContributions(this.library));
  filteredSeries = $derived.by(() =>
    filterSeriesByStatus(this.seriesContributions.seriesList, this.activeFilter)
  );
  filterCounts = $derived.by(() => this.seriesContributions.filterCounts);

  activityHistory = $derived.by(() => {
    if (this.seriesContributions.seriesList.length === 0) return [];
    return buildActivityHistory(this.seriesContributions.seriesList);
  });

  recentlyEdited = $derived.by(() => {
    if (this.seriesContributions.seriesList.length === 0) return [];
    return getRecentlyEdited(this.seriesContributions.seriesList);
  });

  activityGraph = $derived.by(() => buildActivityGraph(this.activityHistory));

  lastContinueVolume = $derived(
    this.activityHistory.length > 0 ? this.activityHistory[0].volumeId : null
  );

  volumesNeedingRebase = $derived.by(() =>
    getVolumesNeedingRebase(this.seriesContributions.seriesList)
  );

  mount() {
    this.restoreExpanded();
    window.addEventListener('keydown', this.handleKeyDown);

    this.fetchLibrary();

    return () => {
      window.removeEventListener('keydown', this.handleKeyDown);
    };
  }

  persistExpanded() {
    if (this.expandedSeries.size === 0) return;
    try {
      sessionStorage.setItem('contributions_expanded', JSON.stringify([...this.expandedSeries]));
    } catch (e) {
      console.error('[Contributions] Failed to persist expanded state:', e);
    }
  }

  private restoreExpanded() {
    const savedExpanded = sessionStorage.getItem('contributions_expanded');
    if (!savedExpanded) return;

    try {
      const expandedArray = JSON.parse(savedExpanded) as string[];
      this.expandedSeries = new SvelteSet(expandedArray);
      console.log('[Contributions] Restored expanded series:', expandedArray);
    } catch (e) {
      console.error('[Contributions] Failed to restore expanded state:', e);
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isSelectionMode) {
      this.exitSelectionMode();
      return;
    }

    if (!this.rebaseModal.isOpen) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (this.rebaseModal.currentConflictIndex > 0) {
          this.rebaseModal.currentConflictIndex--;
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (this.rebaseModal.currentConflictIndex < this.rebaseModal.conflicts.length - 1) {
          this.rebaseModal.currentConflictIndex++;
        }
        break;
      case '1':
        e.preventDefault();
        this.resolveConflict('keep_admin');
        break;
      case '2':
        e.preventDefault();
        this.resolveConflict('keep_mine');
        break;
      case '3':
        e.preventDefault();
        this.resolveConflict('skip');
        break;
      case '4':
        e.preventDefault();
        this.resolveConflict('resurrect');
        break;
    }
  };

  async fetchLibrary() {
    try {
      this.isLoading = true;
      this.error = null;

      const response = await apiFetch<Series[]>('/api/library');
      const basicLibrary = response.data as Series[];

      const detailedLibrary = await Promise.all(
        basicLibrary.slice(0, 5).map(async (series) => {
          try {
            const detailResponse = await apiFetch(`/api/library/series/${series.id}`);
            return detailResponse as Series;
          } catch (e) {
            console.error(`Failed to fetch details for series ${series.id}:`, e);
            return series;
          }
        })
      );

      this.library = detailedLibrary;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.isLoading = false;
    }
  }

  toggleSeries(e: MouseEvent, seriesId: string) {
    e.preventDefault();
    e.stopPropagation();
    const newExpanded = new SvelteSet(this.expandedSeries);
    if (newExpanded.has(seriesId)) {
      newExpanded.delete(seriesId);
    } else {
      newExpanded.add(seriesId);
    }
    this.expandedSeries = newExpanded;
  }

  handleRebase(e: MouseEvent, volume: VolumeContribution, seriesTitle: string) {
    e.preventDefault();
    e.stopPropagation();

    this.rebaseModal = openRebaseModal(volume, seriesTitle);
  }

  handleReset(e: MouseEvent, volume: VolumeContribution) {
    e.preventDefault();
    e.stopPropagation();

    this.resetModal = openResetModal(volume);
  }

  async confirmReset() {
    if (!this.resetModal.volumeId || this.isResetting) return;

    try {
      this.isResetting = true;
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.resetModal.isOpen = false;
    } catch (e) {
      console.error('[Reset] Failed to reset volume:', e);
      this.error = 'Failed to reset volume. Please try again.';
    } finally {
      this.isResetting = false;
    }
  }

  resolveConflict(resolution: RebaseResolution) {
    console.log(
      '[Rebase] Resolving conflict',
      this.rebaseModal.currentConflictIndex,
      'with',
      resolution
    );

    if (this.rebaseModal.currentConflictIndex < this.rebaseModal.conflicts.length - 1) {
      this.rebaseModal.currentConflictIndex++;
    } else {
      this.rebaseModal.isOpen = false;
    }
  }

  abortRebase() {
    console.log('[Rebase] Aborting rebase for volume:', this.rebaseModal.volumeId);
    this.rebaseModal.isOpen = false;
  }

  handleViewVolume(volumeId: string) {
    const expandedArray = Array.from(this.expandedSeries);
    sessionStorage.setItem('contributions_expanded', JSON.stringify(expandedArray));
    console.log('[Contributions] Saved expanded series before navigation:', expandedArray);

    try {
      uiState.setReturnPath('/contributions', 'Back to Contributions');
      console.log('[Contributions] Set return path to /contributions');
    } catch (e) {
      console.error('[Contributions] Failed to set return path:', e);
    }

    console.log('[Contributions] Navigating to /volume/' + volumeId);
    goto(resolve(`/volume/${volumeId}`));
  }

  async handleRebaseAll() {
    await runSampleRebaseAll(this.volumesNeedingRebase);
  }

  async handleBatchRebase() {
    if (this.selectedItems.size === 0) return;

    const selectedVolumeIds = collectSelectedVolumeIds(
      this.seriesContributions.seriesList,
      this.selectedItems
    );

    await runSampleBatchRebase(this.seriesContributions.seriesList, selectedVolumeIds);

    this.exitSelectionMode();
  }

  handleExportEdits() {
    const exportData = {
      exportedAt: new SvelteDate().toISOString(),
      stats: sampleStats,
      activity: this.activityHistory,
      selectedItems: Array.from(this.selectedItems)
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contributions-export-${new SvelteDate().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  openDiffViewer(volume: VolumeContribution) {
    this.selectedDiffVolume = volume;
    this.showDiffViewer = true;
  }

  enterSelectionMode(itemId: string, isSeries = false) {
    console.log('[Selection] Entering selection mode for:', itemId, 'isSeries:', isSeries);
    const result = startSelection(this.seriesContributions.seriesList, itemId, isSeries);
    this.isSelectionMode = result.isSelectionMode;
    this.selectedItems = result.selection;
    console.log('[Selection] Selected items:', Array.from(result.selection));
  }

  toggleSelection(itemId: string, isSeries = false) {
    console.log(
      '[Selection] Toggle selection for:',
      itemId,
      'isSeries:',
      isSeries,
      'isSelectionMode:',
      this.isSelectionMode
    );

    const result = toggleSelectionItems(
      this.seriesContributions.seriesList,
      this.selectedItems,
      this.isSelectionMode,
      itemId,
      isSeries
    );

    this.selectedItems = result.selection;
    this.isSelectionMode = result.isSelectionMode;
    console.log('[Selection] Updated selected items:', Array.from(result.selection));
  }

  exitSelectionMode() {
    console.log('[Selection] Exiting selection mode');
    const result = clearSelection();
    this.isSelectionMode = result.isSelectionMode;
    this.selectedItems = result.selection;
  }

  handleSeriesLongPress(seriesId: string) {
    console.log('[Event] Series long press:', seriesId);
    this.enterSelectionMode(seriesId, true);
  }

  handleVolumeSelect(e: MouseEvent, volumeId: string) {
    console.log('[Event] Volume select:', volumeId, 'isSelectionMode:', this.isSelectionMode);
    if (this.isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSelection(volumeId, false);
    }
  }

  handleVolumeLongPress(volumeId: string) {
    console.log('[Event] Volume long press:', volumeId);
    this.enterSelectionMode(volumeId, false);
  }

  handleSeriesSelect(e: MouseEvent, seriesId: string) {
    console.log('[Event] Series select:', seriesId, 'isSelectionMode:', this.isSelectionMode);
    if (this.isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSelection(seriesId, true);
    }
  }
}
