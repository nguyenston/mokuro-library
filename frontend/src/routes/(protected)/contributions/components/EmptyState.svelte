<script lang="ts">
  import type { FilterType } from '../lib/types';

  let { activeFilter } = $props<{ activeFilter: FilterType }>();
</script>

<div class="rounded-xl bg-theme-main border border-theme-border p-12 text-center">
  <div class="text-4xl mb-2">📚</div>
  <div class="text-base font-medium text-theme-secondary mb-1">
    {#if activeFilter === 'all'}
      No contributions yet
    {:else if activeFilter === 'behind'}
      All caught up!
    {:else}
      No pending edits
    {/if}
  </div>
  <div class="text-xs text-theme-tertiary">
    {#if activeFilter === 'all'}
      Start editing volumes from the shared library
    {:else if activeFilter === 'behind'}
      You have no volumes that need rebasing
    {:else}
      You have no unpublished edits
    {/if}
  </div>
</div>
