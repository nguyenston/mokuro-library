import { apiFetch, HttpError } from './api';
import { confirmation } from '$lib/stores/confirmationStore';
import { toastStore } from '$lib/stores/toastStore.svelte';

/**
 * Reset private OCR edits at the caller's observed branch version.
 * `forced` confirms pending-review cancellation; it never bypasses version checks.
 * The caller owns confirmation and error presentation, including any explicit retry.
 */
export async function resetOcr(
  volumeId: string,
  branchVersion: number,
  forced = false
): Promise<{ success: boolean }> {
  return apiFetch(`/api/library/volume/${volumeId}/reset`, {
    method: 'POST',
    body: { branchVersion, forced },
    showErrorToast: false
  });
}

/**
 * Open the shared confirmation dialog, capturing the target before any request.
 * Each invocation owns its captured values; no global reset state is needed.
 * Review cancellation requires a second explicit confirmation with the same version.
 */
export function confirmResetOcr({
  volumeId,
  volumeTitle,
  branchVersion,
  onRefresh
}: {
  volumeId: string;
  volumeTitle: string | null;
  branchVersion: number;
  onRefresh: () => Promise<void>;
}) {
  let busy = false;

  /** Present either the initial warning or the server-requested review warning. */
  function showConfirmation(forced: boolean) {
    confirmation.open(
      `Reset ${volumeTitle || 'volume'}?`,
      forced
        ? 'This cancels your pending review and permanently discards all private edits, including edits made after submission. The volume returns to the admin version.'
        : 'Reset permanently discards your private edits and returns this volume to the admin version. This cannot be undone.',
      () => confirmReset(forced),
      forced ? 'Cancel review and reset' : 'Reset Volume',
      'Resetting...'
    );
  }

  /** Send only explicitly confirmed requests and refresh stale or completed state. */
  async function confirmReset(forced: boolean) {
    if (busy) return;
    busy = true;
    let refresh = false;
    try {
      await resetOcr(volumeId, branchVersion, forced);
      refresh = true;
      toastStore.success('Private edits reset.');
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 409 &&
        error.code === 'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED' && !forced) {
        showConfirmation(true);
      } else {
        refresh = error instanceof HttpError && error.statusCode === 409;
        toastStore.error(refresh
          ? 'Branch state changed. Refreshing; review it before resetting again.'
          : error instanceof Error ? error.message : 'Reset failed.');
      }
    } finally {
      // A reload failure must not imply that a successful reset was rolled back.
      if (refresh) {
        try { await onRefresh(); }
        catch { toastStore.error('Could not reload branch state. Refresh before editing.'); }
      }
      busy = false;
    }
  }

  showConfirmation(false);
}
