<script lang="ts">
  import LineChart from '$lib/components/charts/LineChart.svelte';
  import type { ReadingStats, TimeFilter } from './types';

  let { stats, speedHistory, selectedTimeFilter, onFilterChange } = $props<{
    stats: ReadingStats;
    speedHistory: Array<{ date: string; speed: number }>;
    selectedTimeFilter: TimeFilter;
    onFilterChange: (filter: TimeFilter) => void;
  }>();

  const filters: TimeFilter[] = ['week', 'month', '3months', '6months', 'year'];
</script>

<div>
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-gray-400"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <h3 class="text-xl font-bold theme-primary">Reading Speed Over Time</h3>
    </div>
    <div class="flex gap-2">
      {#each filters as filter (filter)}
        {@const label =
          filter === '3months'
            ? '3 Months'
            : filter === '6months'
              ? '6 Months'
              : filter.charAt(0).toUpperCase() + filter.slice(1)}
        <button
          onclick={() => onFilterChange(filter)}
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {selectedTimeFilter ===
          filter
            ? 'bg-accent theme-primary'
            : 'bg-theme-main text-theme-secondary hover:theme-primary hover:bg-theme-surface-hover'}"
        >
          {label}
        </button>
      {/each}
    </div>
  </div>
  {#if stats.volumesCompleted === 0}
    <p class="text-sm text-gray-400 mb-4">
      Example data shown below. Your actual progress will appear after completing your first volume.
    </p>
  {/if}
  <div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
    <LineChart
      data={speedHistory.map((h: { date: string; speed: number }) => ({
        date: h.date,
        value: h.speed
      }))}
      label="Reading Speed (chars/min)"
      color="#6366f1"
      height={200}
    />
  </div>
</div>
