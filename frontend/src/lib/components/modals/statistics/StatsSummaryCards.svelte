<script lang="ts">
  import type { ReadingStats } from './types';

  let { stats, formatTime } = $props<{
    stats: ReadingStats;
    formatTime: (minutes: number) => string;
  }>();
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
    <div class="flex items-center justify-between mb-4">
      <p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Recent Speed</p>
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
        class="text-status-warning"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
    <div class="text-2xl font-bold theme-primary">{stats.recentSpeed} chars/min</div>
  </div>

  <div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
    <div class="flex items-center justify-between mb-4">
      <p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Characters Read</p>
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
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    </div>
    <div class="text-2xl font-bold theme-primary">{stats.charactersRead}</div>
    <div class="text-xs text-gray-400 mt-1">{stats.charactersRead} total</div>
  </div>

  <div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
    <div class="flex items-center justify-between mb-4">
      <p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
        Volumes Completed
      </p>
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
        class="text-status-success"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    </div>
    <div class="text-2xl font-bold theme-primary">{stats.volumesCompleted}</div>
    <div class="text-xs text-gray-400 mt-1">({stats.volumesCompleted} tracked)</div>
  </div>

  <div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
    <div class="flex items-center justify-between mb-4">
      <p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Total Time</p>
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
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </div>
    <div class="text-2xl font-bold theme-primary">{formatTime(stats.totalTime)}</div>
  </div>
</div>
