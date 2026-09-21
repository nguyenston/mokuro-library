<script lang="ts">
  import type { SpeedBySeries } from './types';

  let { speedBySeries } = $props<{ speedBySeries: SpeedBySeries[] }>();
</script>

<div>
  <h3 class="text-lg font-bold theme-primary mb-4">Speed by Series</h3>
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
              Volumes
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Avg Speed
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Improvement
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          {#if speedBySeries.length === 0}
            <tr>
              <td colspan="5" class="px-4 py-8 text-center text-theme-secondary">
                No data available
              </td>
            </tr>
          {:else}
            {#each speedBySeries.slice(0, 5) as item, i (item.seriesName ?? i)}
              <tr class="hover:bg-white/5 transition-colors">
                <td class="px-4 py-3 theme-primary font-medium">{item.seriesName}</td>
                <td class="px-4 py-3 text-theme-secondary">{item.volumes}</td>
                <td class="px-4 py-3 theme-primary">{item.avgSpeed} cpm</td>
                <td class="px-4 py-3 text-status-success">+{item.improvement}%</td>
                <td class="px-4 py-3"></td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
