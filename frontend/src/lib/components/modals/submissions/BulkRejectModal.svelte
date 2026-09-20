<script lang="ts">
  import { contributionsSummaryState } from '$lib/states/contributions/ContributionsSummaryState.svelte';
  import { apiFetch } from '$lib/services/api';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';

  let {
    isOpen = $bindable(false),
    submissionIds = $bindable<string[]>([]),
    onComplete
  } = $props<{
    isOpen: boolean;
    submissionIds: string[];
    onComplete: () => void;
  }>();

  let reason = $state('');
  let selectedTemplate = $state<string | null>(null);
  let processing = $state(false);

  const rejectionTemplates = [
    {
      id: 'duplicate',
      label: 'Duplicate content already exists',
      text: 'This content already exists in the shared library.'
    },
    {
      id: 'quality',
      label: 'Poor OCR quality',
      text: 'The OCR quality does not meet our standards. Please ensure the text is properly recognized.'
    },
    {
      id: 'inappropriate',
      label: 'Inappropriate content',
      text: 'This content does not align with our library guidelines.'
    },
    {
      id: 'incomplete',
      label: 'Incomplete series',
      text: 'Please submit the complete series rather than individual volumes.'
    },
    { id: 'custom', label: 'Custom reason', text: '' }
  ];

  // Apply template
  function applyTemplate(templateId: string) {
    selectedTemplate = templateId;
    const template = rejectionTemplates.find((t) => t.id === templateId);
    if (template && template.text) {
      reason = template.text;
    } else if (templateId === 'custom') {
      reason = '';
    }
  }

  // Submit rejection
  async function handleSubmit() {
    if (!reason.trim()) {
      toastStore.addToast('Please provide a rejection reason', 'error');
      return;
    }

    processing = true;
    try {
      const result = await apiFetch<{ success: number; failed: number }>(
        '/api/contributions/submissions/reject',
        {
          method: 'POST',
          body: { submissionIds, reason }
        }
      );
      await contributionsSummaryState.refresh({ force: true });

      if (result.failed > 0) {
        toastStore.addToast(`Rejected ${result.success}, failed ${result.failed}`, 'warning');
      } else {
        toastStore.addToast(`Successfully rejected ${result.success} submission(s)`, 'success');
      }

      close();
      onComplete();
    } catch (e) {
      const msg = (e as Error).message || 'Failed to reject submissions';
      toastStore.addToast(msg, 'error');
    } finally {
      processing = false;
    }
  }

  // Close modal and reset state
  function close() {
    isOpen = false;
    reason = '';
    selectedTemplate = null;
    submissionIds = [];
  }

  // Auto-select custom template when user types
  $effect(() => {
    if (reason && !selectedTemplate) {
      selectedTemplate = 'custom';
    }
  });
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && !processing && close()}
    role="button"
    tabindex="0"
  >
    <div
      class="bg-theme-main border border-status-danger/50 sm:border-2 rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <!-- Header -->
      <div
        class="bg-gradient-to-r from-status-danger/20 to-status-danger/10 p-3 sm:p-6 border-b border-status-danger/30 flex-shrink-0"
      >
        <div class="flex items-start justify-between gap-2 sm:gap-4">
          <div class="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div class="text-xl sm:text-3xl flex-shrink-0">❌</div>
            <div class="flex-1 min-w-0">
              <h2 class="text-base sm:text-xl font-extrabold text-theme-primary mb-0.5 sm:mb-1">
                Reject Submission{submissionIds.length > 1 ? 's' : ''}
              </h2>
              <p class="text-xs sm:text-sm text-theme-secondary">
                {submissionIds.length} submission{submissionIds.length > 1 ? 's' : ''} will be rejected
                with this reason
              </p>
            </div>
          </div>
          <button
            onclick={close}
            disabled={processing}
            class="flex-shrink-0 p-2 hover:bg-theme-surface rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <span class="text-xl">✕</span>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
        <!-- Rejection Templates -->
        <div>
          <div class="text-xs font-bold text-theme-tertiary uppercase tracking-wide mb-2">
            Quick Templates:
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {#each rejectionTemplates as template (template.id)}
              <button
                onclick={() => applyTemplate(template.id)}
                disabled={processing}
                class="p-3 rounded-lg border-2 transition-all text-left disabled:opacity-50 {selectedTemplate ===
                template.id
                  ? 'bg-status-danger/10 border-status-danger'
                  : 'bg-theme-surface/60 border-theme-border hover:bg-theme-surface-hover'}"
              >
                <div
                  class="text-xs font-semibold {selectedTemplate === template.id
                    ? 'text-status-danger'
                    : 'text-theme-primary'}"
                >
                  {template.label}
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Reason Text Area -->
        <div>
          <div class="text-xs font-bold text-theme-tertiary uppercase tracking-wide mb-2">
            Rejection Reason: <span class="text-status-danger">*</span>
          </div>
          <textarea
            bind:value={reason}
            disabled={processing}
            placeholder="Enter a clear reason for rejection..."
            class="w-full h-32 px-3 py-2 rounded-lg bg-theme-surface border-2 border-theme-border focus:border-accent outline-none text-sm text-theme-primary placeholder-theme-tertiary resize-none disabled:opacity-50"
          ></textarea>
          {#if !reason.trim()}
            <div class="text-xs text-status-danger mt-1">A reason is required</div>
          {/if}
        </div>

        <!-- Warning -->
        <div class="bg-status-warning/10 border border-status-warning/30 rounded-lg p-3 sm:p-4">
          <div class="flex items-start gap-3">
            <div class="text-xl flex-shrink-0">⚠️</div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-xs text-status-warning mb-1">Important</div>
              <div class="text-xs text-theme-secondary">
                This action cannot be undone. Users will see the rejection reason you provide.
              </div>
            </div>
          </div>
        </div>

        <!-- Progress Indicator -->
        {#if processing}
          <div class="bg-accent/10 border border-accent/30 rounded-lg p-4 text-center">
            <div class="text-2xl mb-2">⏳</div>
            <div class="text-sm text-accent font-semibold">Processing rejections...</div>
            <div class="text-xs text-theme-tertiary mt-1">
              Rejecting {submissionIds.length} submission{submissionIds.length > 1 ? 's' : ''}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div
        class="p-3 sm:p-6 bg-theme-surface/30 border-t border-theme-border flex gap-2 sm:gap-3 flex-shrink-0"
      >
        <button
          onclick={close}
          disabled={processing}
          class="px-3 py-1.5 sm:px-6 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm bg-theme-surface text-theme-primary hover:bg-theme-surface-hover border sm:border-2 border-theme-border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <div class="flex-1"></div>
        <button
          onclick={handleSubmit}
          disabled={processing || !reason.trim()}
          class="px-3 py-1.5 sm:px-6 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm bg-status-danger text-white hover:bg-status-danger/90 border sm:border-2 border-status-danger transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Rejecting...' : `Reject ${submissionIds.length}`}
        </button>
      </div>
    </div>
  </div>
{/if}
