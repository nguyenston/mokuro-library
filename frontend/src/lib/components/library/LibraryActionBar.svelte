<script lang="ts">
  import { uiState } from '$lib/states/ui/uiState.svelte.ts';
  import { apiFetch } from '$lib/services/api';
  import { confirmation } from '$lib/stores/confirmationStore';
  import { triggerDownload } from '$lib/services/api';
  import { contextMenu, type MenuOption } from '$lib/stores/contextMenuStore';
  import { onMount, onDestroy } from 'svelte';
  import { scrapingState } from '$lib/states/scraping/ScrapingState.svelte.ts';
  import type { RebaseQueueEntry, Series, Volume } from '$lib/types';
  import type { SelectionState } from '$lib/states/selection/SelectionState.svelte';
  import SelectionMoreMenu from '$lib/components/menu/SelectionMoreMenu.svelte';
  import BulkScrapePanel from '$lib/components/modals/scraping/BulkScrapePanel.svelte';
  import SubmitReviewModal from '$lib/components/modals/contributions/SubmitReviewModal.svelte';
  import { apiCache } from '$lib/utils/caching/apiCache';

  // Review workflow
  import { GitPullRequest, GitMerge } from 'lucide-svelte';

  let {
    type = 'series',
    onRename,
    onRefresh,
    onSelectAll,
    onSubmit,
    seriesOwnerId,
    selectionState,
    offset = 0
  }: {
    type: 'series' | 'volume';
    onRename: () => void;
    onRefresh: () => void;
    onSelectAll?: () => void;
    onSubmit?: () => void;
    seriesOwnerId?: string | null;
    selectionState: SelectionState<Series | Volume>;
    offset?: number;
  } = $props();

  const SCRAPE_LIMIT = 100;
  let isProcessing = $state(false);
  let showScrapeModal = $state(false);
  let showReviewModal = $state(false);
  const selectionMap = $derived(selectionState.selection);
  const isSelectionMode = $derived(selectionState.isSelectionMode);
  const selectedIds = $derived(Array.from(selectionMap.keys()));
  const selectedItems = $derived(Array.from(selectionMap.values()));
  let selectionCount = $derived(selectionMap.size);

  // --- Review submission ---
  const singleSelection = $derived(selectionCount === 1 ? selectedItems[0] : null);

  const versionInfo = $derived(
    singleSelection && 'versionInfo' in singleSelection ? singleSelection.versionInfo : null
  );

  const canSubmitReview = $derived(
    type === 'volume' &&
      versionInfo &&
      versionInfo.hasAhead > 0 &&
      versionInfo.reviewHeadPatchId === null &&
      seriesOwnerId === 'admin'
  );

  const submitReviewEntry: RebaseQueueEntry | null = $derived.by(() => {
    if (!singleSelection || !('versionInfo' in singleSelection)) return null;
    const volume = singleSelection as Volume;
    return {
      id: volume.id,
      title: volume.title,
      seriesId: volume.seriesId,
      seriesTitle: '',
      pageCount: volume.pageCount,
      coverImageName: volume.coverImageName,
      versionInfo: volume.versionInfo
    };
  });

  // --- Hotkeys ---
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showScrapeModal) return;
      if (isSelectionMode) selectionState.exitSelectionMode();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      if (isSelectionMode && onSelectAll) {
        e.preventDefault();
        onSelectAll();
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  // --- Actions ---
  const executeBatchDownload = async (includeImages: boolean) => {
    if (selectionCount === 0) return;
    const ids = selectedIds;

    try {
      isProcessing = true;
      const response = await apiFetch('/api/export/batch/ticket', {
        method: 'POST',
        body: {
          ids,
          type,
          options: { include_images: includeImages }
        }
      });
      const { ticket } = response as { ticket: string };
      triggerDownload(`/api/export/batch?ticket=${ticket}`);
    } catch (e) {
      console.error(e);
      alert('Failed to start download.');
    } finally {
      isProcessing = false;
    }
  };

  const executePdfDownload = () => {
    const id = selectedIds[0];
    if (!id) return;
    triggerDownload(`/api/export/${type}/${id}/pdf`);
    selectionState.exitSelectionMode();
  };

  const openDownloadMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLButtonElement;
    const rect = target.getBoundingClientRect();

    const menuItems: MenuOption[] = [
      {
        label: `Download ZIP ${selectionCount > 1 ? '(Batch)' : ''}`,
        action: () => executeBatchDownload(true)
      },
      {
        label: 'Download Metadata',
        action: () => executeBatchDownload(false)
      }
    ];

    if (selectionCount === 1) {
      menuItems.push({ separator: true });
      menuItems.push({
        label: 'Download as PDF',
        action: executePdfDownload
      });
    }

    contextMenu.open(rect.left, rect.top, menuItems, {}, { anchorElement: target, yAlign: 'top' });
  };

  const handleDelete = () => {
    const ids = selectedIds;
    confirmation.open(
      `Delete ${selectionCount} item${selectionCount > 1 ? 's' : ''}?`,
      'This action cannot be undone. Files and progress will be permanently removed.',
      async () => {
        try {
          isProcessing = true;
          await apiFetch('/api/library/batch/delete', {
            method: 'POST',
            body: { ids, type }
          });
          apiCache.invalidateSeriesCache({ seriesId: uiState.activeId ?? undefined });
          apiCache.invalidateLibraryCache(true);

          selectionState.exitSelectionMode();
          onRefresh();
        } catch (e) {
          console.error(e);
          alert('Batch delete failed');
        } finally {
          isProcessing = false;
        }
      }
    );
  };

  async function startScrapeSession() {
    if (type !== 'series') return;
    const selectedSeries = selectedItems as Series[];
    scrapingState.initSession(selectedSeries);
    showScrapeModal = true;
  }

  function handleScrapeClose() {
    showScrapeModal = false;
    onRefresh();
    selectionState.exitSelectionMode();
  }

  function handleOpenReviewModal() {
    if (canSubmitReview) {
      showReviewModal = true;
    }
  }

  function handleReviewSuccess() {
    onRefresh();
    selectionState.exitSelectionMode();
  }
</script>

{#if isSelectionMode}
  <div
    class="fixed left-1/2 -translate-x-1/2 z-50 flex items-center p-2 rounded-2xl bg-theme-surface/90 backdrop-blur-xl border border-theme-primary/20 shadow-2xl animate-in slide-in-from-bottom-10"
    style={`bottom: calc(1.5rem + ${offset}px);`}
  >
    <div class="flex-shrink px-3 font-bold text-theme-primary flex items-center gap-3">
      <span
        class="bg-accent text-white text-xs rounded-full w-6 h-6 flex items-center justify-center shadow-sm"
      >
        {selectionCount}
      </span>
      <div class="flex flex-col leading-tight">
        <span class="text-[10px] text-theme-secondary uppercase tracking-wider">Selected</span>
        <div class="flex gap-2">
          {#if onSelectAll}
            <button
              onclick={onSelectAll}
              class="whitespace-nowrap flex-shrink-0 text-[10px] font-bold text-accent hover:text-accent-hover hover:underline"
              title="Add all visible items to selection (Ctrl+A)"
            >
              + ALL
            </button>
          {/if}
          <button
            onclick={() => selectionState.deselectAll()}
            class="text-[10px] font-bold text-theme-tertiary hover:text-theme-primary hover:underline"
            title="Clear selection"
          >
            CLEAR
          </button>
        </div>
      </div>
    </div>

    {#if selectionCount >= 1}
      <div class="w-[2px] h-8 bg-theme-tertiary/70 mx-1"></div>
      <div class="flex items-center gap-1">
        <button
          onclick={openDownloadMenu}
          disabled={isProcessing}
          class="p-2.5 rounded-xl hover:bg-theme-primary/10 text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
          title="Download"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>

        {#if type === 'series'}
          <button
            onclick={startScrapeSession}
            disabled={isProcessing || selectionCount > SCRAPE_LIMIT}
            class="p-2.5 rounded-xl hover:bg-accent/10 text-theme-secondary hover:text-accent transition-colors disabled:opacity-50"
            title={selectionCount > SCRAPE_LIMIT
              ? `Limit: ${SCRAPE_LIMIT} items`
              : 'Scrape Metadata'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
              <g>
                <circle cx="16" cy="16" r="5" fill="white" stroke="currentColor"></circle>
                <line x1="19.5" y1="19.5" x2="23" y2="23"></line>
              </g>
            </svg>
          </button>

          {#if onSubmit}
            <button
              onclick={onSubmit}
              disabled={isProcessing}
              class="p-2.5 rounded-xl hover:bg-accent/10 text-theme-secondary hover:text-accent transition-colors disabled:opacity-50"
              title="Submit to Shared Library"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
            </button>
          {/if}
        {/if}

        {#if selectionCount === 1}
          {#if canSubmitReview}
            <button
              onclick={handleOpenReviewModal}
              disabled={isProcessing}
              class="p-2.5 rounded-xl hover:bg-accent/10 text-theme-secondary hover:text-accent transition-colors disabled:opacity-50 relative group"
              title={`Submit Edits (+${versionInfo?.hasAhead || 0})`}
            >
              <GitPullRequest class="w-5 h-5" />
              {#if versionInfo?.hasAhead}
                <span class="absolute top-1 right-1 flex h-2.5 w-2.5">
                  <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"
                  ></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                </span>
              {/if}
            </button>
          {:else if versionInfo?.hasBehind && versionInfo.hasBehind > 0 && versionInfo.reviewHeadPatchId === null}
            <div
              class="p-2.5 text-status-warning opacity-50 cursor-help"
              title={`Behind by ${versionInfo.hasBehind} commits`}
            >
              <GitMerge class="w-5 h-5" />
            </div>
          {/if}

          <button
            onclick={onRename}
            disabled={isProcessing}
            class="p-2.5 rounded-xl hover:bg-theme-primary/10 text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
            title="Rename"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        {/if}

        <button
          onclick={handleDelete}
          disabled={isProcessing}
          class="p-2.5 rounded-xl hover:bg-red-500/20 text-status-danger transition-colors disabled:opacity-50"
          title="Delete"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            ></path>
          </svg>
        </button>

        {#if type === 'series'}
          <SelectionMoreMenu
            {selectionCount}
            {selectedIds}
            onScrape={undefined}
            {onRefresh}
            onExitSelection={() => selectionState.exitSelectionMode()}
          />
        {/if}
      </div>
    {/if}

    <div class="w-[2px] h-8 bg-theme-tertiary/70 mx-1"></div>
    <div class="ml-1">
      <button
        onclick={() => selectionState.exitSelectionMode()}
        class="p-2 rounded-full hover:bg-white/20 text-theme-secondary hover:text-white transition-colors"
        title="exit selection"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
{/if}

{#if showScrapeModal}
  <BulkScrapePanel provider={scrapingState.preferredProvider} onClose={handleScrapeClose} />
{/if}

{#if showReviewModal && submitReviewEntry}
  <SubmitReviewModal
    volume={submitReviewEntry}
    on_close={() => (showReviewModal = false)}
    onSuccess={handleReviewSuccess}
  />
{/if}
