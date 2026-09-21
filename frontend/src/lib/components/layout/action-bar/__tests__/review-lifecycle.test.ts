/** Exercise review completion with real modal/image teardown and mocked network calls. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import ActionBarHarness from './ActionBarHarness.svelte';
import { SelectionState } from '$lib/states/selection/SelectionState.svelte';
import type { Volume } from '$lib/types';
import { apiFetch } from '$lib/services/api';

vi.mock('$lib/stores/authStore', async () => {
  const { writable } = await import('svelte/store');
  return { user: writable(null) };
});
vi.mock('$lib/services/api', () => ({
  apiFetch: vi.fn(),
  triggerDownload: vi.fn(),
  fetchAuthenticatedImage: vi.fn().mockResolvedValue('blob:cover'),
  revokeImageUrl: vi.fn(),
  HttpError: class extends Error {}
}));
vi.mock('$lib/stores/toastStore.svelte', () => ({
  toastStore: { success: vi.fn(), error: vi.fn() }
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('volume action bar review lifecycle', () => {
  it('finishes review submission and clears selection without a teardown error', async () => {
    const selection = new SelectionState<Volume>();
    selection.enterSelectionMode({
      id: 'v',
      title: 'Volume',
      seriesId: 's',
      coverImageName: 'cover.jpg',
      versionInfo: { branchVersion: 3, hasAhead: 2, hasBehind: 0, reviewHeadPatchId: null }
    } as Volume);
    vi.mocked(apiFetch).mockResolvedValue({
      newVersion: 4,
      status: true,
      action: 'submitted',
      volumeId: 'v'
    });
    const refresh = vi.fn();
    render(ActionBarHarness, { selectionState: selection, onRefresh: refresh });
    await fireEvent.click(screen.getByTitle('Submit Edits (+2)'));
    await fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(selection.selection.size).toBe(0);
    await waitFor(() => expect(document.body.dataset.actionBarModalOpen).toBeUndefined());
  });
});
