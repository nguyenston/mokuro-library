/** Exercise the shared confirmation before any single or bulk rebase requests. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import ConfirmationModal from '$lib/components/modals/ConfirmationModal.svelte';
import { confirmation } from '$lib/stores/confirmationStore';
import { rebaseState } from '../RebaseState.svelte';
import { rebaseApi } from '$lib/services/rebaseApi';

vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }), scale: () => ({ duration: 0 }) }));
vi.mock('$lib/services/rebaseApi', () => ({ rebaseApi: {
  getSessions: vi.fn(), start: vi.fn(), continue: vi.fn(), abort: vi.fn()
} }));
vi.mock('$lib/stores/toastStore.svelte', () => ({ toastStore: { error: vi.fn(), success: vi.fn() } }));

/** Build displayed targets with distinct optimistic versions. */
function targets(count: number) {
  return Array.from({ length: count }, (_, i) => ({ volumeId: `v${i}`, volumeTitle: `Volume ${i}`,
    seriesTitle: 'Series', branchVersion: i + 3 }));
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmation.close();
  rebaseState.close();
  rebaseState.sessions = [];
  vi.mocked(rebaseApi.getSessions).mockResolvedValue({ sessions: [] });
  vi.mocked(rebaseApi.start).mockResolvedValue({ status: 'complete' });
  render(ConfirmationModal);
});
afterEach(() => { cleanup(); confirmation.close(); rebaseState.close(); });

describe('rebase confirmation', () => {
  it.each([1, 2])('cancels %i targets without a request or opening the manager', async count => {
    await rebaseState.open(targets(count));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Aborting rebase will not restore them/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rebaseApi.getSessions).not.toHaveBeenCalled();
    expect(rebaseApi.start).not.toHaveBeenCalled();
    expect(rebaseState.isModalOpen).toBe(false);
  });

  it.each([1, 2])('confirms %i captured targets with their original versions', async count => {
    const selected = targets(count);
    await rebaseState.open(selected);
    selected[0].branchVersion = 99;
    selected[0].volumeId = 'different-selection';
    await fireEvent.click(await screen.findByRole('button', { name: 'Rebase edits' }));
    await waitFor(() => expect(rebaseApi.start).toHaveBeenCalledTimes(count));
    targets(count).forEach(target => expect(rebaseApi.start)
      .toHaveBeenCalledWith(target.volumeId, target.branchVersion, true));
    expect(rebaseState.isModalOpen).toBe(true);
  });

  it('opens existing sessions without asking to start a rebase', async () => {
    await rebaseState.open();
    expect(rebaseApi.getSessions).toHaveBeenCalledOnce();
    expect(rebaseApi.start).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not automatically retry a stale target', async () => {
    vi.mocked(rebaseApi.start).mockRejectedValueOnce(new Error('Branch or review changed. Please refresh.'));
    await rebaseState.open(targets(1));
    await fireEvent.click(await screen.findByRole('button', { name: 'Rebase edits' }));
    await waitFor(() => expect(rebaseState.isLoading).toBe(false));
    expect(rebaseApi.start).toHaveBeenCalledOnce();
  });
});
