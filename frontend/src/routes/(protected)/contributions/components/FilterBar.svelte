<script lang="ts">
  import type { FilterType } from '../lib/types';

  let { activeFilter, filterCounts, onFilterChange } = $props<{
    activeFilter: FilterType;
    filterCounts: { behind: number; ahead: number };
    onFilterChange: (filter: FilterType) => void;
  }>();
</script>

<div class="flex gap-2 sm:gap-3 mb-6">
  <button
    onclick={() => onFilterChange('behind')}
    class="group relative flex-1 sm:flex-none px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 overflow-hidden {activeFilter ===
    'behind'
      ? 'bg-gradient-to-br from-status-warning to-status-warning/80 text-white shadow-xl shadow-status-warning/30 scale-105'
      : 'bg-theme-main text-theme-secondary hover:text-status-warning hover:bg-theme-surface border-2 border-theme-border hover:border-status-warning/30'}"
  >
    <div
      class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
    ></div>
    <div class="relative flex items-center justify-center gap-1.5 sm:gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="sm:w-5 sm:h-5 flex-shrink-0"
        ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
          points="7 10 12 15 17 10"
        /><line x1="12" x2="12" y1="15" y2="3" /></svg
      >
      <span class="hidden xs:inline">Behind</span>
      <span class="px-1.5 sm:px-2 py-0.5 rounded-full bg-black/20 text-[10px] sm:text-xs font-black"
        >{filterCounts.behind}</span
      >
    </div>
  </button>
  <button
    onclick={() => onFilterChange('ahead')}
    class="group relative flex-1 sm:flex-none px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 overflow-hidden {activeFilter ===
    'ahead'
      ? 'bg-gradient-to-br from-accent to-accent/80 text-white shadow-xl shadow-accent/30 scale-105'
      : 'bg-theme-main text-theme-secondary hover:text-accent hover:bg-theme-surface border-2 border-theme-border hover:border-accent/30'}"
  >
    <div
      class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
    ></div>
    <div class="relative flex items-center justify-center gap-1.5 sm:gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="sm:w-5 sm:h-5 flex-shrink-0"
        ><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg
      >
      <span class="hidden xs:inline">Ahead</span>
      <span class="px-1.5 sm:px-2 py-0.5 rounded-full bg-black/20 text-[10px] sm:text-xs font-black"
        >{filterCounts.ahead}</span
      >
    </div>
  </button>
</div>
