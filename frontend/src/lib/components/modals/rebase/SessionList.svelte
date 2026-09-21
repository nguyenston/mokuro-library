<script lang="ts">
  import { rebaseState } from '$lib/states/rebase/RebaseState.svelte';
  import { X } from 'lucide-svelte';
  import type { RebaseSession } from '$lib/states/rebase/RebaseSession.svelte';

  let { onReviewRequest } = $props<{
    onReviewRequest?: (session: RebaseSession) => void;
  }>();

  // Helper to format the time since update
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    }).format(date);
  };
</script>

<div
  class="flex flex-col h-full border-r border-theme-border bg-theme-surface-highlight w-64 flex-shrink-0"
>
  <div class="p-4 border-b border-theme-border">
    <h3 class="font-bold text-theme-primary">Active Sessions ({rebaseState.activeSessionCount})</h3>
    <p class="text-xs text-theme-secondary mt-1">
      {rebaseState.activeSessionCount} / {10} slots used
    </p>
  </div>

  <div class="flex-1 overflow-y-auto p-2 space-y-2">
    {#each rebaseState.sessions as session (session.id)}
      <div class="relative group w-full">
        <button
          class="w-full text-left p-3 rounded-lg border transition-all duration-200"
          class:bg-theme-main={rebaseState.selectedSessionId === session.id}
          class:border-theme-primary={rebaseState.selectedSessionId === session.id}
          class:bg-theme-surface={rebaseState.selectedSessionId !== session.id}
          class:border-theme-border={rebaseState.selectedSessionId !== session.id}
          class:hover:border-theme-primary-dim={rebaseState.selectedSessionId !== session.id}
          onclick={() => rebaseState.selectSession(session.id)}
        >
          <div class="flex justify-between items-start mb-1">
            <span
              class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              class:bg-red-500={session.status === 'conflict'}
              class:text-white={session.status === 'conflict'}
              class:bg-blue-500={session.status === 'resolving' || session.status === 'starting'}
              class:bg-theme-surface-hover={session.status === 'idle'}
            >
              {session.status}
            </span>
            <span class="text-[10px] text-theme-secondary">
              {formatTime(session.updatedAt)}
            </span>
          </div>

          <div
            class="font-medium text-sm text-theme-primary truncate pr-6"
            title={session.seriesTitle}
          >
            {session.seriesTitle}
          </div>
          <div class="text-xs text-theme-secondary truncate" title={session.volumeTitle}>
            {session.volumeTitle}
          </div>
        </button>

        <button
          class="absolute right-2 bottom-2 p-1 rounded z-10 hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Abort Session"
          onclick={(e) => {
            e.stopPropagation(); // Prevent triggering selection
            rebaseState.abortSession(session.id);
          }}
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    {/each}

    {#if rebaseState.sessions.length === 0}
      <div class="p-4 text-center text-theme-secondary text-sm italic">
        No active rebase sessions.
      </div>
    {/if}

    {#if rebaseState.completedSessionCount > 0}
      <div class="px-3 pt-3 text-[10px] font-bold uppercase tracking-wider text-theme-secondary">
        Completed ({rebaseState.completedSessionCount})
      </div>
      <div class="space-y-2 pt-2">
        {#each rebaseState.completedSessions as session (session.id)}
          <button
            onclick={() => onReviewRequest?.(session)}
            class="w-full text-left p-3 rounded-lg border border-theme-border bg-theme-surface/50 opacity-80 hover:opacity-100 hover:border-theme-primary/40 transition-all"
          >
            <div class="flex justify-between items-start mb-1">
              <span
                class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-status-success/20 text-status-success"
              >
                completed
              </span>
              <span class="text-[10px] text-theme-secondary">
                {formatTime(session.updatedAt)}
              </span>
            </div>

            <div class="font-medium text-sm text-theme-primary truncate" title={session.seriesTitle}>
              {session.seriesTitle}
            </div>
            <div class="text-xs text-theme-secondary truncate" title={session.volumeTitle}>
              {session.volumeTitle}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
