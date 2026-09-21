<script lang="ts">
  import { uiState } from '$lib/states/ui/uiState.svelte.ts';
  import { apiFetch, triggerDownload } from '$lib/services/api';
  import { confirmation } from '$lib/stores/confirmationStore';
  import { contextMenu, type MenuOption } from '$lib/stores/contextMenuStore';
  import { scrapingState } from '$lib/states/scraping/ScrapingState.svelte.ts';
  import type { SelectionState } from '$lib/states/selection/SelectionState.svelte';
  import type { Series } from '$lib/types';
  import SelectionMoreMenu from '$lib/components/menu/SelectionMoreMenu.svelte';
  import EditSeriesModal from '$lib/components/modals/EditSeriesModal.svelte';
  import BulkScrapePanel from '$lib/components/modals/scraping/BulkScrapePanel.svelte';
  import SubmitSeriesPanel from '$lib/components/modals/submissions/SubmitSeriesPanel.svelte';
  import { submissionState } from '$lib/states/contributions/SubmissionState.svelte';
  import { apiCache } from '$lib/utils/caching/apiCache';

  let {
    selectionState,
    onRefresh
  }: {
    selectionState: SelectionState<Series>;
    onRefresh: () => void;
  } = $props();

  const SCRAPE_LIMIT = 100;
  let isProcessing = $state(false);
  let showScrapeModal = $state(false);
  let isEditModalOpen = $state(false);
  let editModalTarget: Series | null = $state(null);
  const selectionMap = $derived(selectionState.selection);
  const selectedIds = $derived(Array.from(selectionMap.keys()));
  const selectedItems = $derived(Array.from(selectionMap.values()));
  let selectionCount = $derived(selectionMap.size);

  $effect(() => {
    if (typeof document === 'undefined') return;
    if (showScrapeModal || isEditModalOpen || submissionState.session) {
      document.body.dataset.actionBarModalOpen = 'true';
    } else {
      delete document.body.dataset.actionBarModalOpen;
    }

    return () => {
      if (typeof document !== 'undefined') {
        delete document.body.dataset.actionBarModalOpen;
      }
    };
  });

  const executeBatchDownload = async (includeImages: boolean) => {
    if (selectionCount === 0) return;
    const ids = selectedIds;

    try {
      isProcessing = true;
      const response = await apiFetch('/api/export/batch/ticket', {
        method: 'POST',
        body: {
          ids,
          type: 'series',
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
    triggerDownload(`/api/export/series/${id}/pdf`);
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
            body: { ids, type: 'series' }
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
    const selectedSeries = selectedItems as Series[];
    scrapingState.initSession(selectedSeries);
    showScrapeModal = true;
  }

  function handleScrapeClose() {
    showScrapeModal = false;
    onRefresh();
    selectionState.exitSelectionMode();
  }

  function handleOpenEdit() {
    const series = Array.from(selectionState.selection.values())[0];
    if (series) {
      editModalTarget = series;
      isEditModalOpen = true;
    }
  }

  function handleOpenSubmit() {
    const selectedSeries = Array.from(selectionState.selection.values());
    if (selectedSeries.length === 0) return;
    submissionState.startSession(selectedSeries);
  }
</script>

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

  <button
    onclick={startScrapeSession}
    disabled={isProcessing || selectionCount > SCRAPE_LIMIT}
    class="p-2.5 rounded-xl hover:bg-accent/10 text-theme-secondary hover:text-accent transition-colors disabled:opacity-50"
    title={selectionCount > SCRAPE_LIMIT ? `Limit: ${SCRAPE_LIMIT} items` : 'Scrape Metadata'}
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

  <button
    onclick={handleOpenSubmit}
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

  {#if selectionCount === 1}
    <button
      onclick={handleOpenEdit}
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

  <SelectionMoreMenu
    {selectionCount}
    {selectedIds}
    onScrape={undefined}
    {onRefresh}
    onExitSelection={() => selectionState.exitSelectionMode()}
  />
</div>

{#if showScrapeModal}
  <BulkScrapePanel provider={scrapingState.preferredProvider} onClose={handleScrapeClose} />
{/if}

<EditSeriesModal
  series={editModalTarget}
  isOpen={isEditModalOpen}
  onClose={() => {
    isEditModalOpen = false;
    selectionState.exitSelectionMode();
  }}
  onRefresh={onRefresh}
/>

{#if submissionState.session}
  <SubmitSeriesPanel
    onClose={() => {
      submissionState.endSession();
      selectionState.exitSelectionMode();
    }}
  />
{/if}
