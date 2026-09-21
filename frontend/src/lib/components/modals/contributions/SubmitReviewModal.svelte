<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { setReviewStatus } from '$lib/services/reviewApi';
  import { toastStore } from '$lib/stores/toastStore.svelte';
  import { GitPullRequest, GitMerge, TriangleAlert, X } from 'lucide-svelte';
  import type { RebaseQueueEntry } from '$lib/types';
  import AuthenticatedImage from '$lib/components/common/AuthenticatedImage.svelte';

  let { volume, on_close, onSuccess } = $props<{
    volume: RebaseQueueEntry | null;
    on_close: () => void;
    onSuccess?: () => void;
  }>();

  let note = $state('');
  let isSubmitting = $state(false);

  // Derived stats
  let ahead = $derived(volume?.versionInfo?.hasAhead || 0);
  let behind = $derived(volume?.versionInfo?.hasBehind || 0);

  const handleClose = () => {
    if (isSubmitting) return;
    on_close();
  };

  /** Submit the frozen prefix and retain the returned branch-state version. */
  async function handleSubmit() {
    if (!volume || isSubmitting) return;

    try {
      isSubmitting = true;
      const result = await setReviewStatus({
        volumeId: volume.id,
        status: true,
        reason: note
      });
      // Review submission changes the optimistic version even without an edit.
      if (volume.versionInfo) volume.versionInfo.branchVersion = result.newVersion;

      toastStore.success('Review requested successfully');
      if (onSuccess) onSuccess();
      on_close();
    } catch (e) {
      toastStore.error((e as Error).message || 'Failed to submit request');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div
  class="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-0"
  role="dialog"
  aria-modal="true"
>
  <div
    class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
    class:cursor-not-allowed={isSubmitting}
    transition:fade={{ duration: 150 }}
    onclick={handleClose}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
    aria-label="Close modal"
  ></div>

  <div
    class="relative w-full max-w-2xl max-h-[90vh] transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all sm:my-8 flex flex-col"
    transition:scale={{ duration: 200, start: 0.95 }}
  >
    <div
      class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-accent/10 text-accent">
          <GitPullRequest class="w-6 h-6" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-theme-primary">Submit Edits</h2>
          <p class="text-sm text-theme-secondary">Request a review for your changes</p>
        </div>
      </div>
      <button
        onclick={handleClose}
        disabled={isSubmitting}
        class="p-2 rounded-lg text-theme-secondary hover:text-white hover:bg-theme-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Close"
      >
        <X class="w-5 h-5" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      {#if volume}
        <div
          class="bg-gradient-to-br from-theme-surface/40 to-theme-surface/20 border-2 border-theme-border rounded-xl overflow-hidden"
        >
          <div class="p-4 flex items-start gap-4">
            {#if volume.coverImageName}
              <AuthenticatedImage
                src={`/api/files/volume/${volume.id}/image/${volume.coverImageName}?w=80&q=60&format=avif`}
                alt=""
                class="w-12 h-16 object-cover rounded-lg border-2 border-theme-border flex-shrink-0"
              />
            {:else}
              <div
                class="w-12 h-16 rounded-lg border-2 border-theme-border bg-theme-surface flex items-center justify-center text-theme-tertiary font-bold flex-shrink-0"
              >
                #
              </div>
            {/if}

            <div class="flex-1 min-w-0 py-0.5">
              <h3 class="font-bold text-theme-primary text-lg truncate mb-1">
                {volume.title}
              </h3>

              <div class="flex items-center gap-2 text-sm">
                <div
                  class="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 flex items-center gap-1.5"
                >
                  <GitPullRequest class="w-3.5 h-3.5 text-accent" />
                  <span class="text-xs font-bold text-accent uppercase">+{ahead} Additions</span>
                </div>

                {#if behind > 0}
                  <div
                    class="px-2 py-0.5 rounded-md bg-status-warning/10 border border-status-warning/20 flex items-center gap-1.5"
                  >
                    <TriangleAlert class="w-3.5 h-3.5 text-status-warning" />
                    <span class="text-xs font-bold text-status-warning uppercase"
                      >{behind} Behind</span
                    >
                  </div>
                {/if}
              </div>
            </div>
          </div>

          {#if behind > 0}
            <div class="bg-status-warning/5 border-t-2 border-status-warning/20 p-4">
              <div class="flex items-start gap-3">
                <GitMerge class="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
                <div class="flex-1">
                  <div class="font-bold text-sm text-status-warning mb-1">
                    Branch Conflict Detected
                  </div>
                  <div class="text-xs text-theme-secondary leading-relaxed">
                    You are behind the shared library. It is recommended to
                    <strong class="text-theme-primary">Rebase</strong> before submitting to avoid rejection.
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="space-y-2">
        <label
          for="review-note"
          class="text-sm font-bold text-theme-secondary flex items-center gap-2"
        >
          Submission Note <span class="text-theme-tertiary font-normal text-xs">(Optional)</span>
        </label>
        <textarea
          id="review-note"
          bind:value={note}
          placeholder="Briefly describe your changes (e.g. 'Fixed typos in Ch 3', 'Redrew SFX on pg 10')..."
          class="w-full h-32 px-4 py-3 rounded-xl bg-theme-surface/50 border border-theme-border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-sm placeholder:text-theme-tertiary/50"
        ></textarea>
      </div>
    </div>

    <div
      class="flex items-center justify-end gap-3 px-6 py-4 bg-theme-main border-t border-theme-border"
    >
      <button
        onclick={handleClose}
        disabled={isSubmitting}
        class="px-5 py-2.5 rounded-xl border border-theme-border text-sm font-semibold text-theme-secondary hover:text-white hover:bg-theme-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>

      <button
        onclick={handleSubmit}
        disabled={isSubmitting}
        class="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {#if isSubmitting}
          <div
            class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
          ></div>
          <span>Sending...</span>
        {:else}
          <GitPullRequest class="w-4 h-4" />
          <span>Submit Request</span>
        {/if}
      </button>
    </div>
  </div>
</div>
