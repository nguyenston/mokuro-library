<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteDate } from 'svelte/reactivity';
  import { resolve } from '$app/paths';
  import { apiFetch } from '$lib/services/api';
  import { browser } from '$app/environment';
  import AchievementsSection from './statistics/AchievementsSection.svelte';
  import CompletedVolumesTable from './statistics/CompletedVolumesTable.svelte';
  import SpeedBySeriesTable from './statistics/SpeedBySeriesTable.svelte';
  import SpeedHistorySection from './statistics/SpeedHistorySection.svelte';
  import StatsSummaryCards from './statistics/StatsSummaryCards.svelte';
  import type {
    Achievement,
    CompletedVolume,
    ReadingStats,
    SpeedBySeries,
    TimeFilter
  } from './statistics/types';
  import type { PaginationData } from '$lib/types';

  let { isOpen, onClose } = $props<{ isOpen: boolean; onClose: () => void }>();

  let isLoading = $state(true);
  let stats = $state<ReadingStats>({
    recentSpeed: 0,
    charactersRead: 0,
    volumesCompleted: 0,
    totalTime: 0
  });

  // Mock data for features not yet implemented
  let speedHistory = $state<Array<{ date: string; speed: number }>>([]);
  let achievements = $state<Achievement[]>([
    {
      id: 'first_volume',
      title: 'First Volume',
      description: 'You finished your first volume',
      icon: 'trophy',
      color: 'text-status-warning',
      unlocked: false
    },
    {
      id: 'mokuro',
      title: 'Mookuro',
      description: 'Welcome to the reader',
      icon: 'ribbon',
      color: 'text-purple-400',
      unlocked: true
    }
  ]);

  let speedBySeries = $state<SpeedBySeries[]>([]);
  let completedVolumes = $state<CompletedVolume[]>([]);
  let selectedTimeFilter = $state<TimeFilter>('month');

  function getTimeRangeDays() {
    const ranges = { week: 7, month: 30, '3months': 90, '6months': 180, year: 365 };
    return ranges[selectedTimeFilter];
  }

  // Mock reading speed history data
  async function fetchStatistics() {
    if (!browser) return;

    try {
      isLoading = true;

      // Fetch stats from new API endpoints
      const [summaryData, historyData, { data: seriesStats, meta: seriesPaginate }, completedData] =
        await Promise.all([
          apiFetch<ReadingStats>('/api/stats/summary'),
          apiFetch<{ history: { date: string; speed: number }[] }>(
            `/api/stats/history?timeRange=${getTimeRangeDays()}`
          ),
          apiFetch<{ data: SpeedBySeries[]; meta: PaginationData }>('/api/stats/series?'),
          apiFetch<{ completedVolumes: CompletedVolume[] }>('/api/stats/completedVolumes')
        ]);

      // Update stats
      stats = {
        recentSpeed: summaryData.recentSpeed || 0,
        charactersRead: summaryData.charactersRead || 0,
        volumesCompleted: summaryData.volumesCompleted || 0,
        totalTime: summaryData.totalTime || 0
      };

      // Update speed history for chart
      speedHistory = (historyData.history || []).map((h) => ({
        date: h.date,
        speed: h.speed || 0
      }));

      // Update series stats
      speedBySeries = (seriesStats || []).map((s) => ({
        seriesName: s.seriesName,
        volumes: s.volumes,
        avgSpeed: s.avgSpeed,
        improvement: 0 // Can calculate if we track historical data
      }));

      // Update completed volumes
      completedVolumes = (completedData.completedVolumes || []).map((v) => ({
        ...v,
        vsAvg: 0 // Can calculate with average speed
      }));

      achievements[0].unlocked = (summaryData.volumesCompleted || 0) > 0;
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    if (isOpen) {
      fetchStatistics();
    }
  });

  // Refetch when modal opens
  $effect(() => {
    if (isOpen) {
      fetchStatistics();
    }
  });

  // Refetch when time filter changes
  $effect(() => {
    if (isOpen && selectedTimeFilter) {
      fetchStatistics();
    }
  });

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new SvelteDate(dateString);
    const now = new SvelteDate();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;

    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      onclick={onClose}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === 'Escape' && onClose()}
      aria-label="Close modal"
    ></div>

    <div
      class="relative w-full max-w-7xl max-h-[90vh] transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all sm:my-8 flex flex-col"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border"
      >
        <div class="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-accent"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <h2 class="text-2xl font-bold theme-primary">Reading Statistics</h2>
        </div>
        <div class="flex items-center gap-2">
          <a
            href={resolve('/api/stats/export', {})}
            download="reading-stats.csv"
            class="px-4 py-2 rounded-lg bg-theme-main text-theme-secondary hover:theme-primary hover:bg-theme-surface-hover transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export CSV
          </a>
          <button
            onclick={onClose}
            class="p-2 rounded-lg text-theme-secondary hover:theme-primary hover:bg-theme-surface-hover transition-colors"
            aria-label="Close"
          >
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
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content (Scrollable) -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        {#if isLoading}
          <div class="flex items-center justify-center py-20">
            <div class="text-theme-secondary">Loading statistics...</div>
          </div>
        {:else}
          <!-- Reading Speed History Section -->
          <div>
            <h3 class="text-xl font-bold theme-primary mb-4">Reading Speed History</h3>
            {#if stats.volumesCompleted === 0}
              <div
                class="rounded-2xl bg-theme-main p-12 border border-theme-border-light text-center"
              >
                <p class="text-2xl font-bold theme-primary mb-2">No Reading History Yet</p>
                <p class="text-theme-secondary">Start reading to track your reading speed!</p>
              </div>
            {/if}

            <StatsSummaryCards {stats} {formatTime} />
            <AchievementsSection {achievements} />
            <SpeedHistorySection
              {stats}
              {speedHistory}
              {selectedTimeFilter}
              onFilterChange={(filter) => (selectedTimeFilter = filter)}
            />

            <!-- Bottom Tables -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <SpeedBySeriesTable {speedBySeries} />
              <CompletedVolumesTable {completedVolumes} {formatTime} {formatDate} />
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
