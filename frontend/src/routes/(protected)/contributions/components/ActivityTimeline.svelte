<script lang="ts">
  import type { ActivityEntry } from '../lib/types';
  import { getEditTypeIcon } from '../lib/utils';
  import { SvelteDate } from 'svelte/reactivity';
  import { ChevronRight, X } from 'lucide-svelte';

  let { activityHistory, onClose, onViewVolume } = $props<{
    activityHistory: ActivityEntry[];
    onClose: () => void;
    onViewVolume: (volumeId: string, seriesId: string) => void;
  }>();
</script>

<div
  class="mb-6 rounded-xl bg-gradient-to-br from-theme-surface to-theme-main border-2 border-theme-border p-5"
>
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm font-bold text-theme-primary uppercase tracking-wider">Recent Activity</h3>
    <button
      onclick={onClose}
      class="p-1 rounded-lg hover:bg-theme-surface transition-colors text-theme-secondary hover:text-theme-primary"
      aria-label="Close recent activity"
    >
      <X class="w-4 h-4" />
    </button>
  </div>

  <div class="space-y-2 max-h-64 overflow-y-auto">
    {#each activityHistory.slice(0, 10) as activity, i (`${activity.timestamp}-${i}`)}
      <button
        onclick={(e) => {
          e.stopPropagation();
          onViewVolume(activity.volumeId, activity.seriesId);
        }}
        class="w-full flex items-center gap-3 p-3 rounded-lg bg-theme-main/50 hover:bg-theme-surface border border-theme-border hover:border-theme-primary/30 transition-all text-left group"
      >
        <div class="text-xl flex-shrink-0">{getEditTypeIcon(activity.editType)}</div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-theme-primary truncate">
            {activity.seriesTitle} — {activity.volumeTitle}
          </div>
          <div class="text-xs text-theme-secondary flex items-center gap-2 mt-1">
            <span>{new SvelteDate(activity.timestamp).toLocaleDateString()}</span>
            <span>•</span>
            <span>{activity.patchCount} edits</span>
            <span>•</span>
            <span class="capitalize">{activity.editType}</span>
          </div>
        </div>
        <ChevronRight class="w-4 h-4 text-theme-secondary group-hover:text-theme-primary transition-colors" />
      </button>
    {/each}
  </div>
</div>
