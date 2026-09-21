<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { ReviewRequestEntry } from '$lib/types';
  import { Ban, X } from 'lucide-svelte';

  let { isOpen, review, isSubmitting = false, onClose, onSubmit } = $props<{
    isOpen: boolean;
    review: ReviewRequestEntry | null;
    isSubmitting?: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => void;
  }>();

  let reason = $state('');
  let showError = $state(false);

  $effect(() => {
    if (isOpen) {
      reason = '';
      showError = false;
    }
  });

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = () => {
    if (!reason.trim()) {
      showError = true;
      return;
    }
    onSubmit(reason.trim());
  };
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0"
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
      class="relative w-full max-w-xl max-h-[90vh] transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all sm:my-8 flex flex-col"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      <div
        class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border"
      >
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-status-danger/10 text-status-danger">
            <Ban class="w-6 h-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-theme-primary">Reject Review</h2>
            <p class="text-sm text-theme-secondary">
              {review?.userDisplayName || 'Unknown User'} · {review?.volumeTitle || 'Unknown Volume'}
            </p>
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

      <div class="flex-1 overflow-y-auto p-6 space-y-3">
        <label
          for="reject-reason"
          class="text-sm font-bold text-theme-secondary flex items-center gap-2"
        >
          Rejection Reason <span class="text-status-danger">*</span>
        </label>
        <textarea
          id="reject-reason"
          bind:value={reason}
          placeholder="Explain why the review is rejected..."
          class="w-full h-28 px-4 py-3 rounded-xl bg-theme-surface/50 border border-theme-border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-sm placeholder:text-theme-tertiary/50"
          disabled={isSubmitting}
          oninput={() => (showError = false)}
        ></textarea>
        {#if showError}
          <div class="text-xs text-status-danger">A reason is required.</div>
        {/if}
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
          class="px-5 py-2.5 rounded-xl bg-status-danger text-white text-sm font-semibold hover:bg-status-danger/90 shadow-lg shadow-status-danger/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if isSubmitting}
            <div
              class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
            <span>Rejecting...</span>
          {:else}
            <Ban class="w-4 h-4" />
            <span>Reject Review</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
