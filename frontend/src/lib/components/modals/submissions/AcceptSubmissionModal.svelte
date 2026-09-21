<script lang="ts">
  import { apiFetch } from '$lib/services/api';
  import Button from '$lib/components/controls/Button.svelte';
  import Modal from '$lib/components/modals/Modal.svelte';
  import { AlertTriangle, CheckCircle } from 'lucide-svelte';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';

  let { submissionId, on_close, on_success } = $props<{
    submissionId: string;
    on_close: () => void;
    on_success: () => void;
  }>();

  let isLoading = $state(false);
  let error = $state<string | null>(null);

  async function handleAccept() {
    isLoading = true;
    error = null;
    try {
      await apiFetch(`/api/contributions/submissions/${submissionId}/accept`, {
        method: 'POST',
        body: {}
      });
      toastStore.success('Submission accepted successfully!');
      on_success();
    } catch (e: unknown) {
      console.error('Failed to accept submission:', e);
      const message = e instanceof Error ? e.message : 'An unknown error occurred.';
      error = message;
      toastStore.error(message);
    } finally {
      isLoading = false;
    }
  }
</script>

<Modal {on_close} title="Accept Submission">
  <div class="p-6 space-y-4">
    <div
      class="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
    >
      <AlertTriangle class="w-8 h-8 flex-shrink-0" />
      <p class="text-sm">
        You are about to accept this submission. The submitted volumes will be moved to the shared
        library and ownership will be transferred to the admin account. This action cannot be
        undone.
      </p>
    </div>

    {#if error}
      <div class="text-sm p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
        <strong>Error:</strong>
        {error}
      </div>
    {/if}
  </div>

  <div class="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end gap-3">
    <Button variant="secondary" onclick={on_close} disabled={isLoading}>Cancel</Button>
    <Button variant="success" onclick={handleAccept} is_loading={isLoading}>
      {#snippet icon()}
        <CheckCircle class="w-4 h-4" />
      {/snippet}
      Accept Submission
    </Button>
  </div>
</Modal>
