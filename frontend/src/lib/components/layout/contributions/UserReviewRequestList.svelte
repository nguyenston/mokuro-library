<script lang="ts">
  import type { ReviewRequestEntry } from '$lib/types';
  import { getReviews, setReviewStatus } from '$lib/services/reviewApi';
  import { SvelteDate } from 'svelte/reactivity';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';
  import { onMount } from 'svelte';

  import {
    Clock,
    TriangleAlert,
    MessageSquareText,
    Ban,
    ArrowRight,
    GitPullRequest
  } from 'lucide-svelte';

  let reviews = $state<ReviewRequestEntry[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function loadReviews() {
    loading = true;
    error = null;
    try {
      reviews = await getReviews();
    } catch (e) {
      error = (e as Error).message || 'Failed to load reviews';
    } finally {
      loading = false;
    }
  }

  async function handleCancel(volumeId: string) {
    if (!confirm('Cancel this review request? You can submit it again later.')) return;

    try {
      // User cancelling their own request (status: false)
      await setReviewStatus({ volumeId, status: false });
      toastStore.success('Request cancelled');
      await loadReviews();
    } catch (e) {
      toastStore.error((e as Error).message || 'Failed to cancel request');
    }
  }

  function formatDate(dateString: string) {
    return new SvelteDate(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onMount(() => {
    loadReviews();
  });
</script>

<div class="space-y-4">
  {#if loading}
    <div
      class="bg-theme-surface/30 border border-theme-border rounded-lg p-12 text-center text-theme-secondary"
    >
      <div class="animate-pulse">Loading review requests...</div>
    </div>
  {:else if error}
    <div class="bg-status-danger/10 border border-status-danger/20 rounded-lg p-6 text-center">
      <div class="text-status-danger font-bold mb-1">Error</div>
      <div class="text-sm text-theme-secondary mb-3">{error}</div>
      <button onclick={loadReviews} class="btn-sm btn-outline-danger">Retry</button>
    </div>
  {:else if reviews.length === 0}
    <div
      class="bg-theme-surface/30 border border-theme-border rounded-lg p-12 text-center flex flex-col items-center"
    >
      <GitPullRequest class="w-12 h-12 mb-4 text-theme-tertiary/50" />
      <div class="text-sm font-bold text-theme-primary mb-1">No Pending Reviews</div>
      <div class="text-xs text-theme-tertiary max-w-xs">
        Edits you submit for review will appear here.
      </div>
    </div>
  {:else}
    <div class="space-y-3">
      {#each reviews as review (review.id)}
        <div
          class="bg-theme-surface/30 border border-theme-border rounded-lg overflow-hidden group hover:border-accent/30 transition-all"
        >
          <div class="p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="text-sm font-bold text-theme-primary truncate">
                    {review.volumeTitle}
                  </h3>
                  <span class="text-xs text-theme-tertiary truncate max-w-[150px]">
                    {review.seriesTitle}
                  </span>
                </div>

                <div class="flex items-center gap-3 mt-2">
                  {#if review.isBehind}
                    <div
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-status-danger/10 text-status-danger border border-status-danger/20"
                    >
                      <TriangleAlert class="w-3 h-3" />
                      STALE (Behind Admin)
                    </div>
                  {:else}
                    <div
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-status-warning/10 text-status-warning border border-status-warning/20"
                    >
                      <Clock class="w-3 h-3" />
                      Pending Review
                    </div>
                  {/if}

                  <span class="text-[10px] text-theme-tertiary">
                    Submitted {formatDate(review.reviewRequestedAt)}
                  </span>
                </div>

                {#if review.submissionNote}
                  <div
                    class="mt-3 flex gap-2 text-xs text-theme-secondary/80 bg-theme-base/50 p-2 rounded max-w-lg"
                  >
                    <MessageSquareText class="w-3.5 h-3.5 mt-0.5 text-theme-tertiary shrink-0" />
                    <span class="italic">"{review.submissionNote}"</span>
                  </div>
                {/if}

                {#if review.rejectionReason}
                  <div
                    class="mt-2 flex gap-2 text-xs text-status-danger bg-status-danger/5 p-2 rounded border border-status-danger/10 max-w-lg"
                  >
                    <Ban class="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <span class="font-bold">Previous Rejection:</span>
                      {review.rejectionReason}
                    </div>
                  </div>
                {/if}
              </div>

              <div class="flex flex-col items-end gap-2 shrink-0">
                <button
                  onclick={() => handleCancel(review.volumeId)}
                  class="px-3 py-1.5 text-xs font-semibold rounded bg-theme-surface hover:bg-status-danger/10 text-theme-secondary hover:text-status-danger border border-theme-border hover:border-status-danger/30 transition-colors"
                >
                  Cancel Request
                </button>

                <a
                  href={`#preview-${review.volumeId}`}
                  class="text-xs text-accent hover:text-accent-hover font-semibold flex items-center gap-1 mt-1"
                >
                  Preview <ArrowRight class="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
