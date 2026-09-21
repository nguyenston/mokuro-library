<script lang="ts">
  import { apiFetch } from '$lib/services/api';
  import Button from '$lib/components/controls/Button.svelte';
  import Modal from '$lib/components/modals/Modal.svelte';
  import { CircleX, TriangleAlert } from 'lucide-svelte';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';

  let {
    submissionId,
    isSelfCancel = false,
    on_close,
    on_success
  } = $props<{
    submissionId: string;
    isSelfCancel?: boolean;
    on_close: () => void;
    on_success: () => void;
  }>();

  const rejectionTemplates = [
    'Duplicate content already exists in the shared library.',
    'The OCR quality is too low for inclusion.',
    'The submission contains inappropriate or low-quality content.',
    'The submitted volumes are part of an incomplete series.',
    'The file format or structure is not compatible.'
  ];

  let reason = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  function selectTemplate(e: Event) {
    const target = e.target as HTMLSelectElement;
    if (target.value) {
      reason = target.value;
    }
  }

  async function handleReject() {
    // For self-cancel, we can default the reason if empty
    const finalReason = isSelfCancel && !reason.trim() ? 'Cancelled by submitter' : reason.trim();

    if (!finalReason) {
      error = 'A reason is required.';
      return;
    }

    isLoading = true;
    error = null;
    try {
      await apiFetch(`/api/contributions/submissions/${submissionId}/reject`, {
        method: 'POST',
        body: { reason: finalReason }
      });
      toastStore.success(isSelfCancel ? 'Submission cancelled.' : 'Submission rejected.');
      on_success();
    } catch (e: unknown) {
      console.error('Failed to process submission:', e);
      const message = e instanceof Error ? e.message : 'An unknown error occurred.';
      error = message;
      toastStore.error(message);
    } finally {
      isLoading = false;
    }
  }
</script>

<Modal {on_close} title={isSelfCancel ? 'Cancel Submission' : 'Reject Submission'}>
  <div class="p-6 space-y-4">
    <div
      class="flex items-start gap-3 p-4 rounded-lg bg-status-danger/10 border border-status-danger/20 text-status-danger"
    >
      <TriangleAlert class="w-8 h-8 flex-shrink-0 mt-1" />
      <div class="text-sm">
        {#if isSelfCancel}
          <p class="font-bold mb-1">Are you sure?</p>
          <p>You are about to cancel this submission. This action cannot be undone.</p>
        {:else}
          <p>
            You are about to reject this submission. Please provide a clear reason for the user.
          </p>
        {/if}
      </div>
    </div>

    {#if !isSelfCancel}
      <div class="space-y-2">
        <label for="rejection-template" class="text-sm font-medium text-theme-secondary">
          Rejection Templates (optional)
        </label>
        <select
          id="rejection-template"
          onchange={selectTemplate}
          class="w-full bg-theme-main border border-theme-border rounded-md p-2 text-sm text-theme-primary focus:ring-1 focus:ring-theme-primary focus:border-theme-primary outline-none transition-all"
        >
          <option value="">Select a template...</option>
          {#each rejectionTemplates as template (template)}
            <option value={template}>{template}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="space-y-2">
      <label for="rejection-reason" class="text-sm font-medium text-theme-secondary">
        {isSelfCancel ? 'Reason (Optional)' : 'Reason for Rejection'}
      </label>
      <textarea
        id="rejection-reason"
        bind:value={reason}
        rows="4"
        class="w-full bg-theme-main border border-theme-border rounded-md p-2 text-sm text-theme-primary focus:ring-1 focus:ring-theme-primary focus:border-theme-primary outline-none transition-all placeholder:text-theme-tertiary"
        placeholder={isSelfCancel
          ? 'Why are you cancelling this submission?'
          : 'Explain why the submission is being rejected...'}
      ></textarea>
    </div>

    {#if error}
      <div
        class="text-sm p-3 rounded-lg bg-status-danger/10 border border-status-danger/20 text-status-danger"
      >
        <strong>Error:</strong>
        {error}
      </div>
    {/if}
  </div>

  <div class="px-6 py-4 bg-theme-main/50 border-t border-theme-border flex justify-end gap-3">
    <Button variant="secondary" onclick={on_close} disabled={isLoading}>Keep Submission</Button>
    <Button
      variant="danger"
      onclick={handleReject}
      is_loading={isLoading}
      disabled={!isSelfCancel && !reason.trim()}
    >
      {#snippet icon()}
        <CircleX class="w-4 h-4" />
      {/snippet}
      {isSelfCancel ? 'Cancel Submission' : 'Reject Submission'}
    </Button>
  </div>
</Modal>
