<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { apiFetch } from '$lib/services/api';
  import { rebaseState } from '$lib/states/rebase/RebaseState.svelte';
  import { user as authUser } from '$lib/stores/authStore';
  import { page } from '$app/state';

  import {
    Inbox,
    ClipboardList,
    RefreshCw,
    PartyPopper,
    GitMerge,
    GitPullRequest,
    RotateCcw
  } from 'lucide-svelte';

  // Components
  import ContributionsHeader from '$lib/components/layout/contributions/ContributionsHeader.svelte';
  import ActivityTimeline from './components/ActivityTimeline.svelte';
  import LibraryEntry from '$lib/components/layout/LibraryEntry.svelte';
  import LibraryActionBar from '$lib/components/layout/action-bar/LibraryActionBar.svelte';
  import LoadingState from './components/LoadingState.svelte';
  import UserQueue from '$lib/components/layout/contributions/UserQueue.svelte';
  import AdminQueue from '$lib/components/layout/contributions/AdminQueue.svelte';
  import UserReviewRequestList from '$lib/components/layout/contributions/UserReviewRequestList.svelte';
  import AdminReviewRequestList from '$lib/components/layout/contributions/AdminReviewRequestList.svelte';
  import SubmissionReader from '$lib/components/readers/SubmissionReader.svelte';
  import ReviewCandidates from '$lib/components/layout/contributions/ReviewCandidates.svelte';
  import { confirmResetOcr } from '$lib/services/ocrApi';
  import { confirmation } from '$lib/stores/confirmationStore';

  import type { RebaseQueueEntry } from '$lib/types';
  import { uiState } from '$lib/states/ui/uiState.svelte';
  import { SelectionState } from '$lib/states/selection/SelectionState.svelte';

  // --- Local State ---
  let isLoading = $state(true);
  let rebaseQueue = $state<RebaseQueueEntry[]>([]);
  let showActivityTimeline = $state(false);
  let activeTab = $state<'rebase' | 'submissions' | 'reviews'>('rebase');
  let showReader = $state(false);
  let previewVolumeId = $state<string | null>(null);
  let wasRebaseOpen = $state(false);
  let rebaseSelection = new SelectionState<RebaseQueueEntry>();
  let rebaseSelectionCount = $derived(rebaseSelection.selection.size);

  // Admin check
  let isAdmin = $derived($authUser?.id === 'admin' || $authUser?.role === 'admin');

  // --- Actions ---
  /** Fetch the current rebase queue from the API. */
  const loadQueue = async () => {
    isLoading = true;
    try {
      const res = await apiFetch<RebaseQueueEntry[]>('/api/contributions/rebase');
      rebaseQueue = res || [];
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      isLoading = false;
    }
  };

  /** Launch a rebase session for every queue entry. */
  const handleRebaseAll = () => {
    if (rebaseQueue.length === 0) return;
    rebaseState.open(
      rebaseQueue.map((task) => ({
        volumeId: task.id,
        volumeTitle: task.title,
        seriesTitle: task.seriesTitle
      }))
    );
  };

  /** Launch a rebase session for only the selected entries. */
  const handleBatchRebase = () => {
    if (rebaseSelection.selection.size === 0) return;
    // Only batch the currently selected queue entries.
    const targets = Array.from(rebaseSelection.selection.values()).map((task) => ({
      volumeId: task.id,
      volumeTitle: task.title,
      seriesTitle: task.seriesTitle
    }));
    if (targets.length === 0) return;
    rebaseState.open(targets);
  };

  /** Adapt a queue entry to the LibraryEntry data shape. */
  const getEntryData = (task: RebaseQueueEntry) => ({
    id: task.id,
    title: task.seriesTitle,
    folderName: task.seriesTitle,
    coverUrl: task.coverImageName
      ? `/api/files/volume/${task.id}/image/${task.coverImageName}`
      : null
  });

  /** Open or close the preview reader based on the URL hash. */
  $effect(() => {
    const hash = page.url.hash;
    if (hash.startsWith('#preview-')) {
      previewVolumeId = hash.replace('#preview-', '');
      showReader = true;
    } else {
      showReader = false;
      previewVolumeId = null;
    }
  });

  /** Clear selection when leaving the rebase tab. */
  $effect(() => {
    if (activeTab !== 'rebase' && rebaseSelection.isSelectionMode) {
      // Exit selection when leaving the rebase tab to avoid stale UI state.
      rebaseSelection.exitSelectionMode();
    }
  });

  /** Refresh the queue after the rebase modal closes. */
  $effect(() => {
    if (!isAdmin && wasRebaseOpen && !rebaseState.isModalOpen) {
      rebaseSelection.exitSelectionMode();
      loadQueue();
    }
    wasRebaseOpen = rebaseState.isModalOpen;
  });

  /** Close the preview reader and clear hash state. */
  function closePreview() {
    if (page.url.hash.startsWith('#preview-')) {
      history.back();
    } else {
      showReader = false;
      previewVolumeId = null;
    }
  }

  /** Initialize page state and load the queue for non-admin users. */
  onMount(() => {
    uiState.setSubtext('contributions', 'Contributions');
    if (isAdmin) {
      activeTab = 'submissions';
      return;
    }
    loadQueue();
  });
</script>

<div class="max-w-5xl mx-auto p-4 space-y-6 pb-20">
  <ContributionsHeader
    activityGraph={[]}
    showQuickActions={true}
    volumesNeedingRebase={rebaseQueue}
    activityHistoryCount={0}
    selectedItemsCount={!isAdmin && activeTab === 'rebase' ? rebaseSelection.selection.size : 0}
    onRebaseAll={handleRebaseAll}
    onToggleActivityTimeline={() => (showActivityTimeline = !showActivityTimeline)}
    onBatchRebase={handleBatchRebase}
    onExportEdits={() => {}}
  />

  <div class="flex items-center gap-6 border-b border-theme-border overflow-x-auto">
    {#if !isAdmin}
      <button
        onclick={() => (activeTab = 'rebase')}
        class="pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
        {activeTab === 'rebase'
          ? 'border-accent text-accent'
          : 'border-transparent text-theme-secondary hover:text-theme-primary'}"
      >
        <Inbox class="w-4 h-4" />
        <span>Needs Attention</span>
        {#if rebaseQueue.length > 0}
          <span
            class="px-1.5 py-0.5 rounded-full bg-status-warning text-white text-[10px] leading-none"
          >
            {rebaseQueue.length}
          </span>
        {/if}
      </button>
    {/if}

    <button
      onclick={() => (activeTab = 'submissions')}
      class="pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
      {activeTab === 'submissions'
        ? 'border-accent text-accent'
        : 'border-transparent text-theme-secondary hover:text-theme-primary'}"
    >
      <ClipboardList class="w-4 h-4" />
      <span>Asset Submissions</span>
    </button>

    <button
      onclick={() => (activeTab = 'reviews')}
      class="pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
      {activeTab === 'reviews'
        ? 'border-accent text-accent'
        : 'border-transparent text-theme-secondary hover:text-theme-primary'}"
    >
      <GitPullRequest class="w-4 h-4" />
      <span>Edit Reviews</span>
    </button>
  </div>

  {#if !isAdmin && activeTab === 'rebase'}
    <section class="min-h-[300px]" transition:fade={{ duration: 200 }}>
      <div class="flex items-center justify-end mb-4">
        <button
          class="text-xs text-theme-secondary hover:text-theme-primary transition-colors flex items-center gap-1.5"
          onclick={loadQueue}
        >
          <RefreshCw class="w-3 h-3" />
          Refresh
        </button>
      </div>

      {#if isLoading}
        <LoadingState />
      {:else if rebaseQueue.length === 0}
        <div
          class="py-16 text-center bg-theme-surface/30 rounded-2xl border-2 border-dashed border-theme-border flex flex-col items-center"
        >
          <PartyPopper class="w-12 h-12 mb-4 text-theme-tertiary" />
          <h3 class="font-bold text-theme-primary text-lg mb-1">All Caught Up!</h3>
          <p class="text-sm text-theme-secondary max-w-xs mx-auto">
            You have no conflicting edits.
          </p>
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-3">
          {#each rebaseQueue as task (task.id)}
            <div>
              <LibraryEntry
                entry={getEntryData(task)}
                type="volume"
                viewMode="list"
                href={`#preview-${task.id}`}
                progress={{ percent: 0, isRead: false, hideBar: true }}
                mainStat={task.title}
                badge={{
                  text: `▲ ${task.versionInfo.hasAhead}  ▼ ${task.versionInfo.hasBehind}`,
                  status: 'warning'
                }}
                isSelected={rebaseSelection.selection.has(task.id)}
                isSelectionMode={rebaseSelection.isSelectionMode}
                onLongPress={() => {
                  rebaseSelection.enterSelectionMode(task);
                }}
                onSelect={(e) => {
                  if (!rebaseSelection.isSelectionMode) return;
                  e.preventDefault();
                  e.stopPropagation();
                  rebaseSelection.toggleSelection(task);
                }}
              >
                {#snippet listActions()}
                  <button
                    class="p-2.5 rounded-xl hover:bg-status-warning/20 text-status-warning transition-colors disabled:opacity-50"
                    title="Rebase edits" aria-label="Rebase edits"
                    onclick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      rebaseState.open([
                        {
                          volumeId: task.id,
                          volumeTitle: task.title,
                          seriesTitle: task.seriesTitle
                        }
                      ]);
                    }}
                  >
                    <GitMerge size={20} aria-hidden="true" />
                  </button>
                  <button
                    onclick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      confirmResetOcr({ volumeId: task.id, volumeTitle: task.title,
                        branchVersion: task.versionInfo.branchVersion, onRefresh: loadQueue });
                    }}
                    disabled={$confirmation.isOpen}
                    class="p-2.5 rounded-xl hover:bg-red-500/20 text-status-danger transition-colors disabled:opacity-50"
                    title="Reset private edits" aria-label="Reset private edits">
                    <RotateCcw size={20} aria-hidden="true" />
                  </button>
                {/snippet}
              </LibraryEntry>
            </div>
          {/each}
        </div>
      {/if}
    </section>
    <LibraryActionBar
      onSelectAll={() => rebaseSelection.selectAll(rebaseQueue)}
      selectionState={rebaseSelection}
    >
      {#snippet children(selection)}
        <div class="flex items-center gap-1">
          <button
            class="p-2.5 rounded-xl hover:bg-accent/10 text-theme-secondary hover:text-accent transition-colors disabled:opacity-50"
            onclick={handleBatchRebase}
            disabled={rebaseSelectionCount === 0}
            title="Rebase selected"
          >
            <GitMerge class="w-5 h-5" />
          </button>
        </div>
      {/snippet}
    </LibraryActionBar>
  {:else if activeTab === 'submissions'}
    <div transition:fade={{ duration: 200 }}>
      {#if isAdmin}
        <AdminQueue />
      {:else}
        <UserQueue />
      {/if}
    </div>
  {:else if activeTab === 'reviews'}
    <div transition:fade={{ duration: 200 }}>
      <div class="mb-4 text-sm text-theme-tertiary">
        {#if isAdmin}
          Review pending edits from contributors.
        {:else}
          Track the status of text edits you have submitted for review.
        {/if}
      </div>

      {#if isAdmin}
        <AdminReviewRequestList />
      {:else}
        <ReviewCandidates />
        <UserReviewRequestList />
      {/if}
    </div>
  {/if}

  {#if showActivityTimeline}
    <ActivityTimeline
      activityHistory={[]}
      onClose={() => (showActivityTimeline = false)}
      onViewVolume={() => {}}
    />
  {/if}

  {#if showReader && previewVolumeId}
    <SubmissionReader volumeId={previewVolumeId} close={closePreview} />
  {/if}
</div>
