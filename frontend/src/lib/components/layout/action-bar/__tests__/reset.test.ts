/** Verify reset discovery in the real volume action bar, independent of the rebase queue. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import VolumeActions from '../LibraryActionBarVolumeActions.svelte';
import { SelectionState } from '$lib/states/selection/SelectionState.svelte';
import { user } from '$lib/stores/authStore';
import type { Volume } from '$lib/types';
import ConfirmationModal from '$lib/components/modals/ConfirmationModal.svelte';
import { confirmation } from '$lib/stores/confirmationStore';

// jsdom's animation stub does not dispatch transition finish events.
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }), scale: () => ({ duration: 0 }) }));

vi.mock('$lib/stores/authStore', async () => {
  const { writable } = await import('svelte/store');
  return { user: writable(null) };
});
vi.mock('$lib/services/api', () => ({ apiFetch: vi.fn(), triggerDownload: vi.fn(), HttpError: class extends Error {} }));

/** Select an ahead-only volume, with optional pending review. */
function selection(reviewHeadPatchId: string | null = null) {
  const state = new SelectionState<Volume>();
  state.enterSelectionMode({ id: 'v', title: 'Volume', seriesId: 's',
    versionInfo: { branchVersion: 3, hasAhead: 2, hasBehind: 0, reviewHeadPatchId }
  } as Volume);
  return state;
}
beforeEach(() => { confirmation.close(); render(ConfirmationModal); });
afterEach(() => { cleanup(); confirmation.close(); user.set(null); });

describe('volume action bar reset', () => {
  it.each([null, 'submitted'])('shows reset for an ahead-only branch (review=%s)', async review => {
    user.set({ id: 'contributor', username: 'User', settings: {}, expiresIn: 60, role: 'user' });
    render(VolumeActions, { selectionState: selection(review), onRefresh: vi.fn(), seriesOwnerId: 'admin' });
    const reset = screen.getByRole('button', { name: 'Reset private edits' });
    expect(reset.title).toBe('Reset private edits');
    expect(reset.classList.contains('text-status-danger')).toBe(true);
    expect(reset.nextElementSibling).toBe(screen.getByTitle('Delete'));
    await fireEvent.click(reset);
    expect(screen.getByRole('dialog', { name: 'Reset Volume?' })).toBeTruthy();
    expect(document.body.dataset.actionBarModalOpen).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides reset for admin', () => {
    user.set({ id: 'admin', username: 'Admin', settings: {}, expiresIn: 60, role: 'admin' });
    render(VolumeActions, { selectionState: selection(), onRefresh: vi.fn(), seriesOwnerId: 'admin' });
    expect(screen.queryByRole('button', { name: 'Reset private edits' })).toBeNull();
  });

  it('does not offer an unsupported batch reset', () => {
    user.set({ id: 'contributor', username: 'User', settings: {}, expiresIn: 60, role: 'user' });
    const selected = selection();
    selected.selection.set('v2', { ...selected.selection.get('v')!, id: 'v2' });
    render(VolumeActions, { selectionState: selected, onRefresh: vi.fn(), seriesOwnerId: 'admin' });
    expect(screen.queryByRole('button', { name: 'Reset private edits' })).toBeNull();
  });
});
