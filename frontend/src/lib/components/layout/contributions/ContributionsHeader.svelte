<script lang="ts">
  import type { RebaseQueueEntry } from '$lib/types';
  import { contributionsSummaryState } from '$lib/states/contributions/ContributionsSummaryState.svelte';
  import { SvelteDate } from 'svelte/reactivity';
  import {
    Activity,
    ArrowUp,
    BookOpen,
    Check,
    Clock,
    Download,
    GitMerge,
    PenLine,
    RefreshCw,
    Repeat,
    Star
  } from 'lucide-svelte';

  type ActivityGraphDay = {
    date: string;
    dayName: string;
    count: number;
  };

  let {
    activityGraph,
    showQuickActions,
    volumesNeedingRebase,
    activityHistoryCount,
    selectedItemsCount,
    onRebaseAll,
    onToggleActivityTimeline,
    onBatchRebase,
    onExportEdits
  } = $props<{
    activityGraph: ActivityGraphDay[];
    showQuickActions: boolean;
    volumesNeedingRebase: RebaseQueueEntry[];
    activityHistoryCount: number;
    selectedItemsCount: number;
    onRebaseAll: () => void;
    onToggleActivityTimeline: () => void;
    onBatchRebase: () => void;
    onExportEdits: () => void;
  }>();

</script>

<div class="mb-8">
  <!-- Title Section with Gradient -->
  <div
    class="relative mb-6 sm:mb-8 overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-accent/20 via-theme-surface/50 to-theme-main border-2 border-accent/30 p-4 sm:p-6 md:p-8 shadow-xl"
  >
    <!-- Background Decoration -->
    <div class="absolute inset-0 bg-grid-pattern opacity-5"></div>
    <div class="absolute -top-24 -right-24 w-96 h-96 bg-accent/20 rounded-full blur-3xl"></div>
    <div
      class="absolute -bottom-24 -left-24 w-96 h-96 bg-theme-primary/10 rounded-full blur-3xl"
    ></div>

    <!-- Content -->
    <div class="relative z-10">
      <div class="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
        <div
          class="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-accent/20 border-2 border-accent/40 shadow-lg flex-shrink-0"
        >
          <Star class="sm:w-8 sm:h-8 text-accent" />
        </div>
        <div class="flex-1 min-w-0">
          <h1
            class="text-xl sm:text-2xl md:text-4xl font-black text-theme-primary mb-0.5 sm:mb-1 tracking-tight"
          >
            Your Contributions
          </h1>
          <p class="text-xs sm:text-sm text-theme-secondary font-medium">
            Track edits & sync with shared library
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Stats and Quick Actions Container -->
  <div class="flex flex-col lg:flex-row gap-6">
    <!-- Left: Stats Dashboard -->
    <div class="flex flex-col gap-4 lg:flex-1">
      <!-- Stats Grid -->
      <div class="grid grid-cols-2 min-[520px]:grid-cols-3 gap-3 sm:gap-4">
        <!-- Total Edits -->
        <div
          class="group relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-theme-main to-theme-surface border-2 border-theme-border hover:border-accent/50 p-4 sm:p-5 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>
          <div class="relative z-10">
            <div class="flex items-center justify-between mb-2 sm:mb-3">
              <div class="p-1.5 sm:p-2 rounded-lg bg-accent/10 border border-accent/30">
                <PenLine class="sm:w-5 sm:h-5 text-accent" />
              </div>
              <div
                class="text-2xl sm:text-3xl font-black text-accent group-hover:scale-110 transition-transform"
              >
                {contributionsSummaryState.totalEdits}
              </div>
            </div>
            <div
              class="text-[10px] sm:text-xs font-bold text-theme-secondary uppercase tracking-wider"
            >
              Total Edits
            </div>
          </div>
        </div>

        <!-- Edits Merged -->
        <div
          class="group relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-theme-main to-theme-surface border-2 border-theme-border hover:border-status-success/50 p-4 sm:p-5 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-status-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>
          <div class="relative z-10">
            <div class="flex items-center justify-between mb-2 sm:mb-3">
              <div
                class="p-1.5 sm:p-2 rounded-lg bg-status-success/10 border border-status-success/30"
              >
                <Check class="sm:w-5 sm:h-5 text-status-success" />
              </div>
              <div
                class="text-2xl sm:text-3xl font-black text-status-success group-hover:scale-110 transition-transform"
              >
                {contributionsSummaryState.editsMerged}
              </div>
            </div>
            <div
              class="text-[10px] sm:text-xs font-bold text-theme-secondary uppercase tracking-wider"
            >
              Edits Merged
            </div>
          </div>
        </div>

        <!-- Volumes Edited -->
        <div
          class="group relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-theme-main to-theme-surface border-2 border-theme-border hover:border-theme-primary/50 p-4 sm:p-5 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-theme-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>
          <div class="relative z-10">
            <div class="flex items-center justify-between mb-2 sm:mb-3">
              <div
                class="p-1.5 sm:p-2 rounded-lg bg-theme-primary/10 border border-theme-primary/30"
              >
                <BookOpen class="sm:w-5 sm:h-5 text-theme-primary" />
              </div>
              <div
                class="text-2xl sm:text-3xl font-black text-theme-primary group-hover:scale-110 transition-transform"
              >
                {contributionsSummaryState.volumesEdited}
              </div>
            </div>
            <div
              class="text-[10px] sm:text-xs font-bold text-theme-secondary uppercase tracking-wider"
            >
              Volumes Edited
            </div>
          </div>
        </div>

        <!-- Pending Reviews -->
        <div
          class="group relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-theme-main to-theme-surface border-2 border-theme-border hover:border-status-warning/50 p-4 sm:p-5 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-status-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>
          <div class="relative z-10">
            <div class="flex items-center justify-between mb-2 sm:mb-3">
              <div
                class="p-1.5 sm:p-2 rounded-lg bg-status-warning/10 border border-status-warning/30"
              >
                <GitMerge class="sm:w-5 sm:h-5 text-status-warning" />
              </div>
              <div
                class="text-2xl sm:text-3xl font-black text-status-warning group-hover:scale-110 transition-transform"
              >
                {contributionsSummaryState.pendingReviewCount}
              </div>
            </div>
            <div
              class="text-[10px] sm:text-xs font-bold text-theme-secondary uppercase tracking-wider"
            >
              Pending Reviews
            </div>
          </div>
        </div>

        <!-- Ahead Edits -->
        <div
          class="group relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-theme-main to-theme-surface border-2 border-theme-border hover:border-accent/50 p-4 sm:p-5 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>
          <div class="relative z-10">
            <div class="flex items-center justify-between mb-2 sm:mb-3">
              <div class="p-1.5 sm:p-2 rounded-lg bg-accent/10 border border-accent/30">
                <ArrowUp class="sm:w-5 sm:h-5 text-accent" />
              </div>
              <div
                class="text-2xl sm:text-3xl font-black text-accent group-hover:scale-110 transition-transform"
              >
                {contributionsSummaryState.aheadCount}
              </div>
            </div>
            <div
              class="text-[10px] sm:text-xs font-bold text-theme-secondary uppercase tracking-wider"
            >
              Ahead Edits
            </div>
          </div>
        </div>

        <!-- Pending Submissions -->
        <div
          class="group relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-theme-main to-theme-surface border-2 border-theme-border hover:border-orange-400/50 p-4 sm:p-5 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>
          <div class="relative z-10">
            <div class="flex items-center justify-between mb-2 sm:mb-3">
              <div
                class="p-1.5 sm:p-2 rounded-lg bg-orange-400/10 border border-orange-400/30"
              >
                <Clock class="sm:w-5 sm:h-5 text-orange-400" />
              </div>
              <div
                class="text-2xl sm:text-3xl font-black text-orange-400 group-hover:scale-110 transition-transform"
              >
                {contributionsSummaryState.pendingSubmissionsCount}
              </div>
            </div>
            <div
              class="text-[10px] sm:text-xs font-bold text-theme-secondary uppercase tracking-wider"
            >
              Pending Submissions
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Graph (Last 30 Days) -->
      {#if activityGraph.length > 0}
        {@const maxCount = Math.max(...activityGraph.map((day: ActivityGraphDay) => day.count), 1)}
        {@const totalEdits = activityGraph.reduce(
          (sum: number, day: ActivityGraphDay) => sum + day.count,
          0
        )}
        {@const activeDays = activityGraph.filter((day: ActivityGraphDay) => day.count > 0).length}
        {@const firstDay = activityGraph[0]}
        {@const lastDay = activityGraph[activityGraph.length - 1]}
        <div
          class="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-theme-surface border-2 border-accent/30"
        >
          <!-- Header with Stats -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div class="flex items-center gap-2 sm:gap-3">
              <div class="text-xl sm:text-2xl">📊</div>
              <div>
                <div class="text-xs sm:text-sm font-bold text-accent">30-Day Activity Graph</div>
                <div class="text-[10px] sm:text-xs text-theme-secondary">
                  {totalEdits} edit{totalEdits === 1 ? '' : 's'} across {activeDays} day{activeDays ===
                  1
                    ? ''
                    : 's'}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs flex-wrap">
              <div class="flex items-center gap-1 sm:gap-1.5">
                <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-accent"></div>
                <span class="text-theme-secondary">Active</span>
              </div>
              <div class="flex items-center gap-1 sm:gap-1.5">
                <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-theme-border/30"></div>
                <span class="text-theme-secondary">Inactive</span>
              </div>
              <span
                class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-accent/20 text-accent font-bold"
              >
                Max: {maxCount}
              </span>
            </div>
          </div>

          <!-- Graph with Date Labels -->
          <div class="space-y-2">
            <!-- Graph Container with Y-axis -->
            <div class="flex gap-2">
              <!-- Y-axis labels -->
              <div
                class="flex flex-col justify-between text-[9px] sm:text-[10px] text-theme-tertiary font-semibold w-6 sm:w-8 flex-shrink-0 text-right pr-1"
              >
                <span>{maxCount}</span>
                <span>{Math.floor(maxCount / 2)}</span>
                <span>0</span>
              </div>

              <!-- Graph Bars -->
              <div class="flex-1 relative">
                <div class="flex items-end gap-0.5 h-16 relative">
                  {#each activityGraph as day (day.date)}
                    {@const heightPercent =
                      day.count > 0 ? Math.max((day.count / maxCount) * 100, 8) : 0}
                    <div
                      class="group/bar flex-1 rounded-sm transition-all cursor-pointer hover:opacity-80 relative {day.count >
                      0
                        ? 'bg-accent hover:bg-accent/80'
                        : 'bg-theme-border/30 hover:bg-theme-border/50'}"
                      style="height: {heightPercent}%"
                      title="{day.dayName}, {new SvelteDate(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}: {day.count} edit{day.count === 1 ? '' : 's'}"
                    >
                      <!-- Tooltip on hover - positioned above the graph container -->
                      {#if day.count > 0}
                        <div
                          class="absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 px-2 py-1 bg-theme-main border border-accent/50 rounded-md shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 text-xs font-semibold"
                        >
                          <div class="text-accent">
                            {day.count} edit{day.count === 1 ? '' : 's'}
                          </div>
                          <div class="text-theme-secondary text-[10px]">
                            {new SvelteDate(day.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Date Range Labels -->
            <div
              class="flex items-center justify-between text-[10px] text-theme-tertiary font-semibold"
            >
              <span class="w-6 sm:w-8 flex-shrink-0"></span>
              <div class="flex-1 flex items-center justify-between px-0.5">
                <span class="text-[9px] sm:text-[10px]"
                  >{new SvelteDate(firstDay.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}</span
                >
                <span class="text-theme-secondary text-[9px] sm:text-[10px]">← 30 days →</span>
                <span class="text-[9px] sm:text-[10px]"
                  >{new SvelteDate(lastDay.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}</span
                >
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Right: Quick Actions Panel -->
    {#if showQuickActions}
      <div
        class="flex flex-col lg:flex-1 rounded-xl bg-gradient-to-br from-theme-surface to-theme-main border-2 border-theme-border p-4 sm:p-5"
      >
        <div class="mb-3 sm:mb-4">
          <h3 class="text-xs sm:text-sm font-bold text-theme-primary uppercase tracking-wider">
            Quick Actions
          </h3>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 auto-rows-min content-start">
          <!-- Rebase All -->
          {#if volumesNeedingRebase.length > 0}
            <button
              onclick={onRebaseAll}
              class="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-status-warning/10 border border-status-warning/30 hover:bg-status-warning/20 transition-all text-left group"
            >
              <div
                class="p-1.5 sm:p-2 rounded-lg bg-status-warning/20 group-hover:bg-status-warning/30 transition-colors flex-shrink-0"
              >
                <RefreshCw class="sm:w-5 sm:h-5 text-status-warning" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[10px] sm:text-xs font-bold text-status-warning mb-0.5 sm:mb-1">
                  Rebase All
                </div>
                <div class="text-[9px] sm:text-xs text-theme-secondary truncate">
                  {volumesNeedingRebase.length} vol{volumesNeedingRebase.length === 1 ? '' : 's'} behind
                </div>
              </div>
            </button>
          {/if}

          <!-- Recently Edited Dropdown -->
          <div class="relative">
            <button
              onclick={onToggleActivityTimeline}
              class="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-theme-primary/10 border border-theme-primary/30 hover:bg-theme-primary/20 transition-all text-left group"
            >
              <div
                class="p-1.5 sm:p-2 rounded-lg bg-theme-primary/20 group-hover:bg-theme-primary/30 transition-colors flex-shrink-0"
              >
                <Activity class="sm:w-5 sm:h-5 text-theme-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[10px] sm:text-xs font-bold text-theme-primary mb-0.5 sm:mb-1">
                  Activity Timeline
                </div>
                <div class="text-[9px] sm:text-xs text-theme-secondary truncate">
                  {activityHistoryCount} recent edits
                </div>
              </div>
            </button>
          </div>

          <!-- Batch Rebase -->
          <button
            onclick={onBatchRebase}
            disabled={selectedItemsCount === 0}
            class="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg transition-all text-left group {selectedItemsCount ===
            0
              ? 'bg-status-warning/5 border border-status-warning/20 opacity-50 cursor-not-allowed'
              : 'bg-status-warning/10 border border-status-warning/30 hover:bg-status-warning/20'}"
            title={selectedItemsCount === 0 ? 'Hold to select volumes' : 'Rebase selected volumes'}
          >
            <div
              class="p-1.5 sm:p-2 rounded-lg bg-status-warning/20 group-hover:bg-status-warning/30 transition-colors flex-shrink-0"
            >
              <Repeat class="sm:w-5 sm:h-5 text-status-warning" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[10px] sm:text-xs font-bold text-status-warning mb-0.5 sm:mb-1">
                Batch Rebase
              </div>
              <div class="text-[9px] sm:text-xs text-theme-secondary truncate">
                {selectedItemsCount === 0
                  ? 'Hold to select'
                  : `${selectedItemsCount} item${selectedItemsCount === 1 ? '' : 's'}`}
              </div>
            </div>
          </button>

          <!-- Export Edits -->
          <button
            onclick={onExportEdits}
            class="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all text-left group"
          >
            <div
              class="p-1.5 sm:p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors flex-shrink-0"
            >
              <Download class="sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[10px] sm:text-xs font-bold text-emerald-400 mb-0.5 sm:mb-1">
                Export Data
              </div>
              <div class="text-[9px] sm:text-xs text-theme-secondary truncate">Download JSON</div>
            </div>
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
