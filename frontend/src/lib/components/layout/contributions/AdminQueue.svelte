<script lang="ts">
  import type { SubmissionDetail } from '$lib/types';
  import { apiFetch } from '$lib/services/api';
  import { SvelteDate } from 'svelte/reactivity';
  import { SelectionState } from '$lib/states/selection/SelectionState.svelte';
  import { contributionsSummaryState } from '$lib/states/contributions/ContributionsSummaryState.svelte';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import {
    Check,
    ClipboardList,
    LoaderCircle,
    TriangleAlert,
    X
  } from 'lucide-svelte';
  import LibraryEntry from '$lib/components/layout/LibraryEntry.svelte';
  import LibraryActionBar from '$lib/components/layout/action-bar/LibraryActionBar.svelte';
  import AcceptSubmissionModal from '$lib/components/modals/submissions/AcceptSubmissionModal.svelte';
  import RejectSubmissionModal from '$lib/components/modals/submissions/RejectSubmissionModal.svelte';
  import BulkRejectModal from '$lib/components/modals/submissions/BulkRejectModal.svelte';

  let submissions = $state<SubmissionDetail[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let selectionState = new SelectionState<SubmissionDetail>();
  let showAcceptModal = $state(false);
  let showRejectModal = $state(false);
  let showBulkRejectModal = $state(false);
  let activeSubmissionId = $state<string | null>(null);
  let bulkRejectIds = $state<string[]>([]);
  let bulkAccepting = $state(false);

  function formatDate(dateString: string): string {
    const date = new SvelteDate(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function loadSubmissions() {
    loading = true;
    error = null;
    try {
      const data = (await apiFetch('/api/contributions/submissions', {
        showErrorToast: false
      })) as SubmissionDetail[];
      submissions = data || [];
      selectionState.exitSelectionMode();
    } catch (e) {
      const msg = (e as Error).message || 'Failed to load submissions';
      error = msg;
      console.error('Failed to load submissions', e);
    } finally {
      loading = false;
    }
  }

  function openAcceptModal(submissionId: string) {
    activeSubmissionId = submissionId;
    showAcceptModal = true;
  }

  function openRejectModal(submissionId: string) {
    activeSubmissionId = submissionId;
    showRejectModal = true;
  }

  function closeModals() {
    showAcceptModal = false;
    showRejectModal = false;
    activeSubmissionId = null;
  }

  async function handleAcceptSuccess() {
    closeModals();
    await contributionsSummaryState.refresh({ force: true });
    await loadSubmissions();
  }

  async function handleRejectSuccess() {
    closeModals();
    await contributionsSummaryState.refresh({ force: true });
    await loadSubmissions();
  }

  async function handleBulkAccept() {
    if (selectionState.selection.size === 0 || bulkAccepting) return;
    if (!confirm(`Accept ${selectionState.selection.size} submission(s)?`)) return;

    bulkAccepting = true;
    try {
      const submissionIds = Array.from(selectionState.selection.keys());
      const result = await apiFetch<{ success: number; failed: number }>(
        '/api/contributions/submissions/accept',
        {
          method: 'POST',
          body: { submissionIds },
          showErrorToast: false
        }
      );
      await contributionsSummaryState.refresh({ force: true });
      if (result.failed > 0) {
        toastStore.addToast(`Accepted ${result.success}, failed ${result.failed}`, 'warning');
      } else {
        toastStore.addToast(`Accepted ${result.success} submission(s)`, 'success');
      }
      selectionState.exitSelectionMode();
      await loadSubmissions();
    } catch (e) {
      toastStore.addToast((e as Error).message || 'Failed to accept submissions', 'error');
    } finally {
      bulkAccepting = false;
    }
  }

  function openBulkRejectModal() {
    if (selectionState.selection.size === 0) return;
    bulkRejectIds = Array.from(selectionState.selection.keys());
    showBulkRejectModal = true;
  }

  function handleBulkRejectComplete() {
    selectionState.exitSelectionMode();
    loadSubmissions();
  }

  onMount(() => {
    loadSubmissions();
  });
</script>

<div class="space-y-4">
  {#if loading}
    <div
      class="bg-theme-surface/30 border border-theme-border rounded-lg p-12 text-center flex flex-col items-center"
    >
      <LoaderCircle class="w-8 h-8 mb-3 text-accent animate-spin" />
      <div class="text-sm text-theme-secondary font-medium">Loading pending submissions...</div>
    </div>
  {:else if error}
    <div
      class="bg-status-danger/5 border border-status-danger/20 rounded-lg p-8 text-center flex flex-col items-center"
    >
      <TriangleAlert class="w-8 h-8 mb-3 text-status-danger" />
      <div class="text-sm text-status-danger font-bold mb-1">Failed to Load</div>
      <div class="text-xs text-theme-secondary mb-4">{error}</div>
      <button
        onclick={loadSubmissions}
        class="px-4 py-2 rounded-lg bg-status-danger text-white hover:bg-status-danger-hover transition-all text-xs font-bold shadow-lg shadow-status-danger/20"
      >
        Retry
      </button>
    </div>
  {:else if submissions.length === 0}
    <div
      class="bg-theme-surface/30 border border-theme-border rounded-lg p-12 text-center flex flex-col items-center"
    >
      <ClipboardList class="w-12 h-12 mb-4 text-theme-tertiary/50" />
      <div class="text-sm font-bold text-theme-primary mb-1">All Caught Up!</div>
      <div class="text-xs text-theme-tertiary max-w-xs">
        No pending submissions to review. New submissions from users will appear here.
      </div>
    </div>
  {:else}
    <div class="flex items-center gap-2 pb-2">
      <button
        onclick={() => selectionState.selectAll(submissions)}
        class="text-xs text-accent hover:text-accent-hover font-semibold transition-colors"
      >
        Select All ({submissions.length})
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4">
      {#each submissions as submission (submission.id)}
        {@const seriesRecord = submission.targetSeries ?? submission.sourceSeries}
        {@const seriesTitle = seriesRecord?.sortTitle ?? 'Unknown Series'}
        {@const seriesId = seriesRecord?.id}
        {@const coverUrl = seriesId && seriesRecord?.coverPath
          ? `/api/files/series/${seriesId}/cover?w=240&q=60&format=avif`
          : null}
        <LibraryEntry
          entry={{
            id: submission.id,
            title: seriesTitle,
            folderName: seriesTitle,
            coverUrl
          }}
          type="series"
          viewMode="list"
          href={resolve(`/contributions/submissions/${submission.id}`, {})}
          progress={{ percent: 0, isRead: false, hideBar: true }}
          mainStat={`${submission._count?.volumes || 0} volume${
            submission._count?.volumes === 1 ? '' : 's'
          }`}
          subStat={`Submitted ${formatDate(submission.submittedAt)} - ${
            submission.user?.username || 'Unknown User'
          }`}
          badge={{ text: 'Pending', status: 'warning' }}
          isSelected={selectionState.selection.has(submission.id)}
          isSelectionMode={selectionState.isSelectionMode}
          onLongPress={() => selectionState.enterSelectionMode(submission)}
          onSelect={(e) => {
            if (!selectionState.isSelectionMode) return;
            e.preventDefault();
            e.stopPropagation();
            selectionState.toggleSelection(submission);
          }}
        >
          {#snippet listActions()}
            <div class="w-10 h-10 rounded-lg overflow-hidden border border-theme-border bg-theme-surface/30 divide-y divide-theme-border/60">
              <button
                onclick={() => openAcceptModal(submission.id)}
                class="w-full h-1/2 flex items-center justify-center text-theme-secondary hover:text-status-success hover:bg-status-success/10 transition-colors"
                aria-label="Accept submission"
                title="Accept"
              >
                <Check class="w-4 h-4" />
              </button>
              <button
                onclick={() => openRejectModal(submission.id)}
                class="w-full h-1/2 flex items-center justify-center text-theme-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                aria-label="Reject submission"
                title="Reject"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          {/snippet}
        </LibraryEntry>
      {/each}
    </div>
  {/if}
</div>

<LibraryActionBar
  onSelectAll={() => selectionState.selectAll(submissions)}
  selectionState={selectionState}
>
  {#snippet children(selection)}
    <div class="flex items-center gap-1">
      <button
        class="p-2.5 rounded-xl hover:bg-status-success/10 text-theme-secondary hover:text-status-success transition-colors disabled:opacity-50"
        onclick={handleBulkAccept}
        disabled={selection.selection.size === 0 || bulkAccepting}
        title="Accept selected"
      >
        <Check class="w-5 h-5" />
      </button>
      <button
        class="p-2.5 rounded-xl hover:bg-status-danger/10 text-theme-secondary hover:text-status-danger transition-colors disabled:opacity-50"
        onclick={openBulkRejectModal}
        disabled={selection.selection.size === 0}
        title="Reject selected"
      >
        <X class="w-5 h-5" />
      </button>
    </div>
  {/snippet}
</LibraryActionBar>

{#if showAcceptModal && activeSubmissionId}
  <AcceptSubmissionModal
    submissionId={activeSubmissionId}
    on_close={closeModals}
    on_success={handleAcceptSuccess}
  />
{/if}

{#if showRejectModal && activeSubmissionId}
  <RejectSubmissionModal
    submissionId={activeSubmissionId}
    on_close={closeModals}
    on_success={handleRejectSuccess}
  />
{/if}

{#if showBulkRejectModal}
  <BulkRejectModal
    bind:isOpen={showBulkRejectModal}
    bind:submissionIds={bulkRejectIds}
    onComplete={handleBulkRejectComplete}
  />
{/if}
