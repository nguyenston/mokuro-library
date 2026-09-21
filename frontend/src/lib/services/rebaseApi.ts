import { apiFetch } from '$lib/services/api';
import type { RebaseConflict, RebaseResolution } from '$lib/types';

export interface RebaseSessionData {
  sessionId: string;
  volumeId: string;
  volumeTitle: string;
  seriesTitle: string;
  currentConflict: RebaseConflict | null;
  updatedAt: string; // JSON dates are strings
}

export interface RebaseResult {
  status: 'paused' | 'complete';
  rebaseId?: string;
  conflict?: RebaseConflict;
  newHeadId?: string;
  hasAhead?: number;
}

export const rebaseApi = {
  /**
   * Fetches all active rebase sessions for the current user.
   */
  getSessions: async (): Promise<{ sessions: RebaseSessionData[] }> => {
    return apiFetch('/api/library/rebase/sessions');
  },

  /**
   * Starts a new rebase session for a specific volume.
   */
  start: async (volumeId: string): Promise<RebaseResult> => {
    return apiFetch(`/api/library/volume/${volumeId}/rebase/start`, {
      method: 'POST',
      body: {}
    });
  },

  /**
   * Continues an existing rebase session with a resolution.
   */
  continue: async (
    volumeId: string,
    rebaseId: string,
    resolution: RebaseResolution
  ): Promise<RebaseResult> => {
    return apiFetch(`/api/library/volume/${volumeId}/rebase/continue`, {
      method: 'POST',
      body: { rebaseId, resolution }
    });
  },

  /**
   * Aborts and deletes a rebase session.
   */
  abort: async (volumeId: string, rebaseId: string): Promise<{ status: 'aborted' }> => {
    return apiFetch(`/api/library/volume/${volumeId}/rebase/abort`, {
      method: 'POST',
      body: { rebaseId }
    });
  }
};
