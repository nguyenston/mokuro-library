/** Reset UI integration tests use the real API error parser and existing confirmation modal. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { confirmResetOcr } from '$lib/services/ocrApi';
import ConfirmationModal from '$lib/components/modals/ConfirmationModal.svelte';
import { confirmation } from '$lib/stores/confirmationStore';

// Test confirmation behavior without waiting for browser-only animations.
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }), scale: () => ({ duration: 0 }) }));

vi.mock('$lib/services/deviceFingerprint', () => ({ getStoredFingerprint: async () => 'test' }));
vi.mock('$lib/stores/toastStore.svelte', () => ({ toastStore: { success: vi.fn(), error: vi.fn() } }));

const request = vi.fn();
const refresh = vi.fn();
/** Make a JSON HTTP response, including machine-readable confirmation errors. */
function response(status = 200, code?: string) {
  return new Response(JSON.stringify({ success: status === 200, message: 'Test response', code }), {
    status, headers: { 'content-type': 'application/json' }
  });
}
/** Submit the initial confirmation opened by the shared reset workflow. */
async function submit() {
  await fireEvent.click(await screen.findByRole('button', { name: 'Reset Volume' }));
}
beforeEach(() => {
  confirmation.close();
  render(ConfirmationModal);
  request.mockReset();
  refresh.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', request);
});
afterEach(() => { cleanup(); confirmation.close(); vi.unstubAllGlobals(); });

describe('reset confirmation', () => {
  it('cancels the first dialog without sending a request', async () => {
    confirmResetOcr({ volumeId: 'v', volumeTitle: 'Volume', branchVersion: 3, onRefresh: refresh });
    await fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(request).not.toHaveBeenCalled();
  });

  it('resets without forcing and refreshes on success', async () => {
    request.mockResolvedValue(response());
    confirmResetOcr({ volumeId: 'v', volumeTitle: 'Volume', branchVersion: 3, onRefresh: refresh });
    await submit();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ branchVersion: 3, forced: false });
  });

  it('retries only after review confirmation and retains the originally displayed version', async () => {
    request.mockResolvedValueOnce(response(409, 'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED'))
      .mockResolvedValueOnce(response());
    const target = { volumeId: 'v', volumeTitle: 'Volume', branchVersion: 3, onRefresh: refresh };
    confirmResetOcr(target);
    await submit();
    await screen.findByRole('button', { name: 'Cancel review and reset' });
    expect(request).toHaveBeenCalledOnce();
    target.branchVersion = 9;
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel review and reset' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(request.mock.calls.map(call => JSON.parse(call[1].body))).toEqual([
      { branchVersion: 3, forced: false }, { branchVersion: 3, forced: true }
    ]);
  });

  it('cancels review confirmation without a forced request', async () => {
    request.mockResolvedValue(response(409, 'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED'));
    confirmResetOcr({ volumeId: 'v', volumeTitle: 'Volume', branchVersion: 3, onRefresh: refresh });
    await submit();
    await screen.findByRole('button', { name: 'Cancel review and reset' });
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(request).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([false, true])('refreshes a stale request without retrying (forced=%s)', async forced => {
    if (forced) request.mockResolvedValueOnce(response(409, 'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED'));
    request.mockResolvedValue(response(409));
    confirmResetOcr({ volumeId: 'v', volumeTitle: 'Volume', branchVersion: 3, onRefresh: refresh });
    await submit();
    if (forced) await fireEvent.click(await screen.findByRole('button', { name: 'Cancel review and reset' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledTimes(forced ? 2 : 1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not force or retry other API failures', async () => {
    request.mockResolvedValue(response(500));
    confirmResetOcr({ volumeId: 'v', volumeTitle: 'Volume', branchVersion: 3, onRefresh: refresh });
    await submit();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(request).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('prevents duplicate submits while reset is running', async () => {
    let finish!: (value: Response) => void;
    request.mockReturnValue(new Promise<Response>(resolve => { finish = resolve; }));
    confirmResetOcr({ volumeId: 'v', volumeTitle: 'Volume', branchVersion: 3, onRefresh: refresh });
    await submit();
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Close modal' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Resetting...' }));
    expect(request).toHaveBeenCalledOnce();
    finish(response());
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
