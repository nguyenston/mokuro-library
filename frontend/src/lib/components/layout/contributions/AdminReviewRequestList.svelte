<script lang="ts">
  import type { ReviewRequestEntry } from '$lib/types';
  import { getReviews, setReviewStatus } from '$lib/services/reviewApi';
  import { apiFetch } from '$lib/services/api';
  import { SvelteDate } from 'svelte/reactivity';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';
  import { onMount } from 'svelte';
  import RejectReviewModal from '$lib/components/modals/contributions/RejectReviewModal.svelte';
  import LibraryEntry from '$lib/components/layout/LibraryEntry.svelte';

  import { MessageSquareText, Check, X } from 'lucide-svelte';

  let reviews = $state<ReviewRequestEntry[]>([]);
  let loading = $state(false);
  let showRejectModal = $state(false);
  let rejectTarget = $state<ReviewRequestEntry | null>(null);
  let isRejecting = $state(false);
  let acceptingId = $state<string | null>(null);

  async function loadReviews() {
    loading = true;
    try {
      reviews = await getReviews();
    } catch (e) {
      toastStore.error('Failed to load admin queue');
    } finally {
      loading = false;
    }
  }

  // Admin Action: Reject
  async function handleReject(reason: string) {
    if (!rejectTarget) return;
    try {
      isRejecting = true;
      await setReviewStatus({
        volumeId: rejectTarget.volumeId,
        status: false,
        reason,
        targetUserId: rejectTarget.userId // Critical for Admin strategy
      });
      toastStore.success('Submission rejected');
      closeRejectModal();
      await loadReviews();
    } catch (e) {
      toastStore.error((e as Error).message || 'Failed to reject');
    } finally {
      isRejecting = false;
    }
  }

  function openRejectModal(review: ReviewRequestEntry) {
    rejectTarget = review;
    showRejectModal = true;
  }

  function closeRejectModal() {
    showRejectModal = false;
    rejectTarget = null;
  }

  async function handleAccept(review: ReviewRequestEntry) {
    if (acceptingId) return;
    acceptingId = review.id;
    try {
      await apiFetch(`/api/library/volume/${review.volumeId}/officialize`, {
        method: 'POST',
        body: {
          sourceBranchUserId: review.userId,
          reviewHeadPatchId: review.reviewHeadPatchId
        }
      });
      toastStore.success('Review accepted');
      await loadReviews();
    } catch (e) {
      toastStore.error((e as Error).message || 'Failed to accept review');
    } finally {
      acceptingId = null;
    }
  }

  onMount(() => {
    loadReviews();
  });
</script>

<div class="space-y-4">
  {#if reviews.length === 0 && !loading}
    <div class="text-center p-8 text-theme-tertiary text-sm italic">
      No pending reviews in the queue.
    </div>
  {/if}

  {#each reviews as review (review.id)}
    {@const coverUrl = review.coverImageName
      ? `/api/files/volume/${review.volumeId}/image/${review.coverImageName}`
      : null}
    <LibraryEntry
      entry={{
        id: review.id,
        title: review.seriesTitle,
        folderName: review.seriesTitle,
        coverUrl
      }}
      type="volume"
      viewMode="list"
      href={`#preview-${review.volumeId}`}
      progress={{ percent: 0, isRead: false, hideBar: true }}
      mainStat={review.volumeTitle}
      subStat={`${review.userDisplayName || 'Unknown User'} - ${new SvelteDate(
        review.reviewRequestedAt
      ).toLocaleDateString()}`}
      badge={review.isBehind ? { text: 'BEHIND', status: 'danger' } : undefined}
    >
      {#snippet titleAction()}
        {#if review.submissionNote}
          <span
            class="p-1.5 rounded-md bg-theme-surface/70 text-theme-secondary border border-theme-border"
            title={review.submissionNote}
            aria-label="Submission note"
          >
            <MessageSquareText class="w-3.5 h-3.5" />
          </span>
        {/if}
      {/snippet}
      {#snippet listActions()}
        <div class="w-10 h-10 rounded-lg overflow-hidden border border-theme-border bg-theme-surface/30 divide-y divide-theme-border/60">
          <button
            onclick={() => handleAccept(review)}
            class="w-full h-1/2 flex items-center justify-center text-theme-secondary hover:text-status-success hover:bg-status-success/10 transition-colors disabled:opacity-50"
            aria-label="Accept submission"
            title="Accept"
            disabled={acceptingId === review.id}
          >
            <Check class="w-4 h-4" />
          </button>
          <button
            onclick={() => openRejectModal(review)}
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

{#if showRejectModal}
  <RejectReviewModal
    isOpen={showRejectModal}
    review={rejectTarget}
    isSubmitting={isRejecting}
    onClose={closeRejectModal}
    onSubmit={handleReject}
  />
{/if}
