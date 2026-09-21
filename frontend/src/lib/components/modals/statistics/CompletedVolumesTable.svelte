<script lang="ts">
  import type { CompletedVolume } from './types';

  let { completedVolumes, formatTime, formatDate } = $props<{
    completedVolumes: CompletedVolume[];
    formatTime: (minutes: number) => string;
    formatDate: (dateString: string) => string;
  }>();
</script>

<div>
  <h3 class="text-lg font-bold theme-primary mb-4">Completed Volumes</h3>
  <div class="rounded-2xl bg-theme-main border border-theme-border-light overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-theme-surface">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Series
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Volume
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Speed
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Duration
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Date Finished
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          {#if completedVolumes.length === 0}
            <tr>
              <td colspan="5" class="px-4 py-8 text-center text-theme-secondary">
                No completed volumes yet
              </td>
            </tr>
          {:else}
            {#each completedVolumes.slice(0, 5) as vol, i (`${vol.seriesName}-${vol.volumeTitle}-${i}`)}
              <tr class="hover:bg-white/5 transition-colors">
                <td class="px-4 py-3 theme-primary font-medium">{vol.seriesName}</td>
                <td class="px-4 py-3 text-theme-secondary">{vol.volumeTitle}</td>
                <td class="px-4 py-3">
                  <div class="theme-primary">{vol.speed} cpm</div>
                  <div class="text-xs text-status-danger">-{Math.abs(vol.vsAvg)}% vs avg</div>
                </td>
                <td class="px-4 py-3">
                  <div class="theme-primary">{formatTime(vol.duration)}</div>
                  <div class="text-xs text-gray-500">{vol.characters} chars</div>
                </td>
                <td class="px-4 py-3 text-theme-secondary">
                  {formatDate(vol.dateFinished)}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
