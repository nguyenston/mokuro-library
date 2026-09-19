<script lang="ts">
  import { uiState } from '$lib/states/ui/uiState.svelte.ts';
  import { apiFetch, triggerDownload } from '$lib/services/api';
  import { confirmation } from '$lib/stores/confirmationStore';
  import { contextMenu, type MenuOption } from '$lib/stores/contextMenuStore';
  import type { RebaseQueueEntry, Volume } from '$lib/types';
  import { rebaseState } from '$lib/states/rebase/RebaseState.svelte';
  import type { SelectionState } from '$lib/states/selection/SelectionState.svelte';
  import SubmitReviewModal from '$lib/components/modals/contributions/SubmitReviewModal.svelte';
  import EditVolumeModal from '$lib/components/modals/EditVolumeModal.svelte';
  import { apiCache } from '$lib/utils/caching/apiCache';

  // Review workflow
  import { GitPullRequest, GitMerge } from 'lucide-svelte';

  let {
    selectionState,
    onRefresh,
    seriesOwnerId,
    seriesTitle
  }: {
    selectionState: SelectionState<Volume>;
    onRefresh: () => void;
    seriesOwnerId?: string | null;
    seriesTitle?: string | null;
  } = $props();

  let isProcessing = $state(false);
  let showReviewModal = $state(false);
  let isEditModalOpen = $state(false);
  let editVolumeTarget = $state<{ id: string; title: string | null } | null>(null);
  const selectionMap = $derived(selectionState.selection);
  const selectedIds = $derived(Array.from(selectionMap.keys()));
  const selectedItems = $derived(Array.from(selectionMap.values()));
  let selectionCount = $derived(selectionMap.size);
  const isPrivateSeries = $derived(seriesOwnerId !== 'admin');

  $effect(() => {
    if (typeof document === 'undefined') return;
    if (showReviewModal || isEditModalOpen) {
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

  // --- Review submission ---
  const singleSelection = $derived(selectionCount === 1 ? selectedItems[0] : null);

  const versionInfo = $derived(
    singleSelection && 'versionInfo' in singleSelection ? singleSelection.versionInfo : null
  );

  const canSubmitReview = $derived(
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

  const executeBatchDownload = async (includeImages: boolean) => {
    if (selectionCount === 0) return;
    const ids = selectedIds;

    try {
      isProcessing = true;
      const response = await apiFetch('/api/export/batch/ticket', {
        method: 'POST',
        body: {
          ids,
          type: 'volume',
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
    triggerDownload(`/api/export/volume/${id}/pdf`);
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
            body: { ids, type: 'volume' }
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

  function handleOpenReviewModal() {
    if (canSubmitReview) {
      showReviewModal = true;
    }
  }

  function handleReviewSuccess() {
    onRefresh();
    selectionState.exitSelectionMode();
  }

  function handleBatchRebase() {
    if (isPrivateSeries) return;
    if (selectionCount === 0) return;
    const targets = selectedItems.map((volume) => ({
      volumeId: volume.id,
      volumeTitle: volume.title ?? '',
      seriesTitle: seriesTitle ?? ''
    }));
    rebaseState.open(targets);
  }

  function handleOpenEdit() {
    const volume = Array.from(selectionState.selection.values())[0];
    if (volume) {
      editVolumeTarget = { id: volume.id, title: volume.title };
      isEditModalOpen = true;
    }
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

  {#if !isPrivateSeries}
    <button
      onclick={handleBatchRebase}
      disabled={isProcessing || selectionCount === 0}
      class="p-2.5 rounded-xl hover:bg-accent/10 text-theme-secondary hover:text-accent transition-colors disabled:opacity-50"
      title="Batch Rebase"
    >
      <GitMerge class="w-5 h-5" />
    </button>
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
</div>

<!-- Keep the reviewed volume available while the modal's exit transition completes. -->
{#each showReviewModal && submitReviewEntry ? [submitReviewEntry] : [] as reviewEntry (reviewEntry.id)}
  <SubmitReviewModal
    volume={reviewEntry}
    on_close={() => (showReviewModal = false)}
    onSuccess={handleReviewSuccess}
  />
{/each}

<EditVolumeModal
  volume={editVolumeTarget}
  isOpen={isEditModalOpen}
  onClose={() => (isEditModalOpen = false)}
  onRefresh={onRefresh}
/>
