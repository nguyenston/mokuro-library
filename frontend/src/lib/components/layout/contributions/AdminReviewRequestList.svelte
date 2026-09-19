<script lang="ts">
  import type { ReviewRequestEntry } from '$lib/types';
  import { getReviews, setReviewStatus } from '$lib/services/reviewApi';
  import { SvelteDate } from 'svelte/reactivity';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';
  import { onMount } from 'svelte';
  import RejectReviewModal from '$lib/components/modals/contributions/RejectReviewModal.svelte';

  import {
    User,
    TriangleAlert,
    MessageSquareText,
    ArrowRight,
    Ban,
    CheckCircle2
  } from 'lucide-svelte';

  let reviews = $state<ReviewRequestEntry[]>([]);
  let loading = $state(false);
  let showRejectModal = $state(false);
  let rejectTarget = $state<ReviewRequestEntry | null>(null);
  let isRejecting = $state(false);

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

  // Note: "Accept" is handled via the Git Merge UI in the Reader,
  // so we usually link the Admin to the Volume to perform the merge there.

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
    <div class="bg-theme-surface/30 border border-theme-border rounded-lg p-4 flex gap-4">
      <div class="shrink-0 pt-1">
        <div
          class="w-10 h-10 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center text-theme-tertiary"
        >
          <User class="w-5 h-5" />
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-theme-primary"
                >{review.userDisplayName || 'Unknown User'}</span
              >
              <span class="text-xs text-theme-tertiary"
                >• {new SvelteDate(review.reviewRequestedAt).toLocaleDateString()}</span
              >
            </div>
            <div class="text-xs text-theme-secondary font-medium mt-0.5">
              {review.seriesTitle} <span class="text-theme-tertiary">/</span>
              {review.volumeTitle}
            </div>
          </div>
        </div>

        {#if review.submissionNote}
          <div
            class="mt-2 bg-theme-base/50 p-2 rounded text-xs text-theme-secondary italic border-l-2 border-accent/50"
          >
            "{review.submissionNote}"
          </div>
        {/if}

        {#if review.isBehind}
          <div class="mt-2 text-[10px] font-bold text-status-danger flex items-center gap-1">
            <TriangleAlert class="w-3 h-3" /> BEHIND MASTER
          </div>
        {/if}
      </div>

      <div class="flex flex-col gap-2 shrink-0">
        <a
          href={`#preview-${review.volumeId}`}
          class="px-3 py-1.5 rounded bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors text-center flex items-center justify-center gap-1"
        >
          Review <ArrowRight class="w-3 h-3" />
        </a>

        <button
          onclick={() => openRejectModal(review)}
          class="px-3 py-1.5 rounded bg-status-danger/10 text-status-danger text-xs font-bold hover:bg-status-danger hover:text-white transition-colors border border-status-danger/20 flex items-center justify-center gap-1"
        >
          <Ban class="w-3 h-3" /> Reject
        </button>
      </div>
    </div>
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
