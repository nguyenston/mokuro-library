import type { RebaseConflict, RebaseResolution } from '$lib/types';
import { rebaseApi, type RebaseSessionData } from '$lib/services/rebaseApi';
import { toastStore } from '$lib/stores/toastStore.svelte';

export type SessionStatus = 'idle' | 'starting' | 'conflict' | 'resolving' | 'complete' | 'error';

export class RebaseSession {
  // Data Properties
  id: string;
  volumeId: string;
  volumeTitle: string;
  seriesTitle: string;
  hasAhead: number | null = null;

  // State Properties
  currentConflict = $state<RebaseConflict | null>(null);
  status = $state<SessionStatus>('idle');
  updatedAt = $state<Date>(new Date());

  constructor(data: RebaseSessionData) {
    this.id = data.sessionId;
    this.volumeId = data.volumeId;
    this.volumeTitle = data.volumeTitle;
    this.seriesTitle = data.seriesTitle;
    this.currentConflict = data.currentConflict;
    this.updatedAt = new Date(data.updatedAt);

    // If we loaded with a conflict, we are in conflict state
    if (this.currentConflict) {
      this.status = 'conflict';
    }
  }

  /**
   * Resolves the current conflict with the chosen resolution.
   */
  async resolve(resolution: RebaseResolution): Promise<boolean> {
    if (this.status === 'resolving') return false;

    // Optimistic update
    this.status = 'resolving';

    try {
      const result = await rebaseApi.continue(this.volumeId, this.id, resolution);

      if (result.status === 'complete') {
        this.status = 'complete';
        this.currentConflict = null;
        this.hasAhead = result.hasAhead ?? 0;
        toastStore.success(`Rebase complete for ${this.volumeTitle}`);
        return true; // Finished
      }
      else if (result.status === 'paused' && result.conflict) {
        this.status = 'conflict';
        this.currentConflict = result.conflict;
        return false; // Not finished, new conflict
      } else {
        throw new Error('Unexpected rebase status');
      }
    } catch (err: any) {
      console.error('Rebase resolve error:', err);
      this.status = 'error';
      toastStore.error(err.message || 'Failed to resolve conflict');

      // If we have a conflict, revert to conflict state so user can retry
      if (this.currentConflict) {
        this.status = 'conflict';
      }
      return false;
    }
  }
}
