<script lang="ts">
  import type { RebaseSession } from '$lib/states/rebase/RebaseSession.svelte';
  import type { RebaseConflict, PatchOperation } from '$lib/types';
  import { rebaseState } from '$lib/states/rebase/RebaseState.svelte';

  let { session }: { session: RebaseSession } = $props();

  // Helper to safely extract displayable value from a patch operation
  const getValue = (patch: any) => {
    if (!patch?.operation) return 'N/A';
    const val = patch.operation.value;

    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  // Helper to get human readable conflict reason
  const getReasonTitle = (conflict: RebaseConflict) => {
    switch (conflict.reason) {
      case 'dead_zone':
        return 'Edited Deleted Content';
      case 'reverse_dead_zone':
        return 'Deleted Edited Content';
      case 'content_conflict':
        return 'Content Conflict';
      case 'reorder_collision':
        return 'Reorder Conflict';
      default:
        return 'Unknown Conflict';
    }
  };

  const getReasonDescription = (conflict: RebaseConflict) => {
    switch (conflict.reason) {
      case 'dead_zone':
        return 'The Official Version (Admin) deleted this block, but you have edits for it. Do you want to accept the deletion or resurrect the block with your edits?';
      case 'reverse_dead_zone':
        return 'The Official Version (Admin) edited this block, but you deleted it. Do you want to accept their edits (restore block) or keep your deletion?';
      case 'content_conflict':
        return 'Both you and the Official Version edited the same value.';
      default:
        return 'The operations on this block collide.';
    }
  };
</script>

{#if session.currentConflict}
  {@const conflict = session.currentConflict}
  <div class="flex flex-col h-full bg-theme-surface">
    <div class="p-6 border-b border-theme-border bg-theme-surface-highlight">
      <div class="flex items-center gap-2 mb-2">
        <span class="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded uppercase">
          Conflict
        </span>
        <span class="text-xs font-mono text-theme-secondary">
          {conflict.userPatch.operation.path}
        </span>
      </div>
      <h2 class="text-xl font-bold text-theme-primary mb-1">
        {getReasonTitle(conflict)}
      </h2>
      <p class="text-theme-secondary text-sm">
        {getReasonDescription(conflict)}
      </p>
    </div>

    <div class="flex-1 overflow-y-auto p-6">
      <div class="grid grid-cols-2 gap-6 h-full">
        <div class="flex flex-col">
          <h4 class="font-bold text-theme-secondary mb-2 uppercase text-xs tracking-wider">
            Official Version (Incoming)
          </h4>
          <div
            class="flex-1 p-4 rounded-lg border border-theme-border bg-theme-main font-mono text-sm whitespace-pre-wrap overflow-auto"
          >
            {getValue(conflict.adminPatch)}
          </div>
          <button
            class="mt-4 w-full py-3 rounded-lg font-bold transition-colors border border-theme-border hover:bg-theme-surface-hover text-theme-primary"
            onclick={() => rebaseState.resolveConflict(session.id, 'keep_admin')}
          >
            Accept Official
            {#if conflict.reason === 'dead_zone'}
              (Delete)
            {/if}
          </button>
        </div>

        <div class="flex flex-col">
          <h4 class="font-bold text-blue-500 mb-2 uppercase text-xs tracking-wider">
            Your Edit (Current)
          </h4>
          <div
            class="flex-1 p-4 rounded-lg border-2 border-blue-500/20 bg-blue-50/5 font-mono text-sm whitespace-pre-wrap overflow-auto"
          >
            {getValue(conflict.userPatch)}
          </div>
          <button
            class="mt-4 w-full py-3 rounded-lg font-bold transition-colors bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20"
            onclick={() => rebaseState.resolveConflict(session.id, 'keep_mine')}
          >
            Keep My Edit
            {#if conflict.reason === 'dead_zone'}
              (Resurrect)
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="flex flex-col items-center justify-center h-full text-theme-secondary">
    {#if session.status === 'resolving'}
      <div
        class="animate-spin h-8 w-8 border-4 border-theme-primary border-t-transparent rounded-full mb-4"
      ></div>
      <p>Applying resolution...</p>
    {:else if session.status === 'complete'}
      <div class="text-green-500 text-5xl mb-4">✓</div>
      <p class="font-bold text-theme-primary">Rebase Complete</p>
    {:else}
      <p>Loading session data...</p>
    {/if}
  </div>
{/if}
