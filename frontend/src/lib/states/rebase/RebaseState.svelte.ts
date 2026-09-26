import { RebaseSession } from './RebaseSession.svelte';
import { rebaseApi, type RebaseSessionData } from '$lib/services/rebaseApi';
import { toastStore } from '$lib/stores/toastStore.svelte';
import type { RebaseResolution } from '$lib/types';
import { confirmation } from '$lib/stores/confirmationStore';

/** Displayed branch state captured before confirming a single or bulk rebase. */
type RebaseTarget = { volumeId: string; volumeTitle: string; seriesTitle: string; branchVersion: number };

// --- Configuration ---
export const MAX_ACTIVE_SESSIONS = 10;

class RebaseState {
  // --- Global State ---
  isModalOpen = $state(false);
  isLoading = $state(false);

  // The list of all active sessions for this user
  sessions = $state<RebaseSession[]>([]);
  // Completed sessions kept while the modal is open
  completedSessions = $state<RebaseSession[]>([]);

  // The ID of the session currently being viewed in the modal
  selectedSessionId = $state<string | null>(null);

  // --- Derived ---
  selectedSession = $derived(
    this.sessions.find(s => s.id === this.selectedSessionId) || null
  );

  activeSessionCount = $derived(this.sessions.length);
  completedSessionCount = $derived(this.completedSessions.length);
  canStartNewSession = $derived(this.sessions.length < MAX_ACTIVE_SESSIONS);

  constructor() {
    // No auto-init.
  }

  /**
   * Confirm captured targets before starting single/bulk rebase. Opening the manager
   * without targets only loads existing sessions. Confirmed targets retain their versions.
   */
  async open(targets?: RebaseTarget[], confirmed = false) {
    if (targets?.length && !confirmed) {
      // Copy values so selection changes cannot change the confirmed targets or versions.
      const captured = targets.map(target => ({ ...target }));
      confirmation.open(
        captured.length === 1 ? `Rebase ${captured[0].volumeTitle || 'volume'}?` : `Rebase ${captured.length} volumes?`,
        'Rebase updates your private edits onto the admin version. Any pending reviews for these volumes will be cancelled when rebase starts. Aborting rebase will not restore them.',
        () => this.open(captured, true),
        'Rebase edits',
        'Starting rebase...'
      );
      return;
    }
    this.isModalOpen = true;
    this.isLoading = true;

    try {
      // 1. Always refresh global list first to get latest state from DB
      await this.refreshSessions();

      // 2. Handle specific targets if requested
      if (targets && targets.length > 0) {
        await this.ensureSessionsFor(targets);
      }

      // 3. Set default selection if nothing selected yet
      if (!this.selectedSessionId && this.sessions.length > 0) {
        this.selectedSessionId = this.sessions[0].id;
      }
    } catch (err) {
      console.error('Failed to initialize rebase modal:', err);
      toastStore.error('Failed to load rebase sessions');
    } finally {
      this.isLoading = false;
    }
  }

  close() {
    this.isModalOpen = false;
    this.selectedSessionId = null;
    this.completedSessions = [];
  }

  selectSession(sessionId: string) {
    this.selectedSessionId = sessionId;
  }

  async refreshSessions() {
    try {
      const response = await rebaseApi.getSessions();
      this.sessions = response.sessions.map((data: RebaseSessionData) => new RebaseSession(data));

      // Cleanup: If selected session no longer exists, deselect it
      if (this.selectedSessionId && !this.sessions.find(s => s.id === this.selectedSessionId)) {
        this.selectedSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
      }
    } catch (err) {
      console.error('Fetch sessions error', err);
      throw err;
    }
  }

  /** Resume existing sessions or start confirmed targets up to the session limit. */
  private async ensureSessionsFor(targets: RebaseTarget[]) {
    for (const target of targets) {
      const volId = target.volumeId;
      // Check if we already have a session for this volume
      const existing = this.sessions.find(s => s.volumeId === volId);
      if (existing) {
        this.selectedSessionId = existing.id;
        continue;
      }

      // Check limit before starting new
      if (!this.canStartNewSession) {
        toastStore.error(`Cannot start more than ${MAX_ACTIVE_SESSIONS} concurrent rebase sessions.`);
        break;
      }

      // Start new session
      await this.startSession(target);
    }
  }

  /** Start one captured target; bulk failures are reported per volume, not retried. */
  private async startSession(target: RebaseTarget) {
    try {
      // Backend handles eligibility and may fast-forward/complete immediately.
      const result = await rebaseApi.start(target.volumeId, target.branchVersion, true);
      if (result.status === 'complete') {
        const completed = new RebaseSession({
          sessionId: `completed-${target.volumeId}-${Date.now()}`,
          volumeId: target.volumeId,
          volumeTitle: target.volumeTitle,
          seriesTitle: target.seriesTitle,
          currentConflict: null,
          updatedAt: new Date().toISOString()
        });
        completed.status = 'complete';
        completed.hasAhead = result.hasAhead ?? 0;
        this.completedSessions = [completed, ...this.completedSessions];
        toastStore.success(`Rebase complete for ${target.volumeTitle}`);
        return;
      }

      await this.refreshSessions();

      const newSession = this.sessions.find(s => s.volumeId === target.volumeId);
      if (newSession) {
        this.selectedSessionId = newSession.id;
      }
    } catch (err: any) {
      console.error(`Failed to start session for volume ${target.volumeId}:`, err);
      toastStore.error(err.message || 'Failed to start rebase');
    }
  }

  async resolveConflict(sessionId: string, resolution: RebaseResolution) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const isComplete = await session.resolve(resolution);

    if (isComplete) {
      this.completedSessions = [session, ...this.completedSessions];
      // Remove from local list immediately
      this.sessions = this.sessions.filter(s => s.id !== sessionId);

      // Select next available if any
      if (this.sessions.length > 0) {
        this.selectedSessionId = this.sessions[0].id;
      } else {
        this.selectedSessionId = null;
      }
    }
  }

  async abortSession(sessionId: string) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    try {
      await rebaseApi.abort(session.volumeId, sessionId);
      this.sessions = this.sessions.filter(s => s.id !== sessionId);
      toastStore.info('Rebase session aborted');

      if (this.selectedSessionId === sessionId) {
        this.selectedSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
      }
    } catch (err: any) {
      toastStore.error(err.message || 'Failed to abort session');
    }
  }
}

export const rebaseState = new RebaseState();
