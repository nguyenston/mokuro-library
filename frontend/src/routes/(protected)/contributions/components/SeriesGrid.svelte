<script lang="ts">
  import { longpress } from '$lib/actions/longPress';
  import type { SeriesContribution, VolumeContribution } from '../lib/types';
  import {
    getStatusInfo,
    getSeriesCoverUrl,
    getVolumeCoverUrl,
    handleImageError
  } from '../lib/utils';
  import AuthenticatedImage from '$lib/components/common/AuthenticatedImage.svelte';

  let {
    seriesList,
    expandedSeries,
    selectedItems,
    isSelectionMode,
    onToggleSeries,
    onSeriesLongPress,
    onSeriesSelect,
    onVolumeLongPress,
    onVolumeSelect,
    onViewVolume,
    onRebase,
    onReset,
    onOpenDiffViewer
  } = $props<{
    seriesList: SeriesContribution[];
    expandedSeries: Set<string>;
    selectedItems: Set<string>;
    isSelectionMode: boolean;
    onToggleSeries: (event: MouseEvent, seriesId: string) => void;
    onSeriesLongPress: (seriesId: string) => void;
    onSeriesSelect: (event: MouseEvent, seriesId: string) => void;
    onVolumeLongPress: (volumeId: string) => void;
    onVolumeSelect: (event: MouseEvent, volumeId: string) => void;
    onViewVolume: (volumeId: string, seriesId: string) => void;
    onRebase: (event: MouseEvent, volume: VolumeContribution, seriesTitle: string) => void;
    onReset: (event: MouseEvent, volume: VolumeContribution) => void;
    onOpenDiffViewer: (volume: VolumeContribution) => void;
  }>();
</script>

<!-- Series Cards - Two Column Grid -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
  {#each seriesList as series, i (series.id)}
    {@const isExpanded = expandedSeries.has(series.id)}
    {@const isSeriesSelected =
      series.volumes.length > 0 &&
      series.volumes.every((vol: VolumeContribution) => selectedItems.has(vol.id))}
    <div
      use:longpress
      onlongpress={() => onSeriesLongPress(series.id)}
      class="contrib-series-card group relative rounded-xl sm:rounded-2xl border-2 bg-theme-surface/25 transition-all duration-300 overflow-hidden shadow-theme-secondary/10 shadow-[0_4px_16px_0] hover:shadow-[0_8px_24px_0] {isSeriesSelected
        ? 'border-accent/50 ring-1 ring-accent shadow-[0_0_20px_rgba(99,102,241,0.4)] z-30 scale-[1.02]'
        : 'border-theme-primary/10 hover:border-accent/30 z-10'} {isSelectionMode &&
      !isSeriesSelected
        ? 'opacity-40 grayscale-[0.4]'
        : 'opacity-100'}"
      style="animation: slideIn 0.3s ease-out {i * 0.05}s both"
    >
      <!-- Series Card Header -->
      <button
        onpointerdown={(e) => onSeriesSelect(e, series.id)}
        onclick={(e) => {
          if (isSelectionMode) {
            e.preventDefault();
          } else {
            onToggleSeries(e, series.id);
          }
        }}
        class="w-full flex items-center transition-colors duration-300 hover:bg-theme-surface/30"
      >
        <!-- Series Cover -->
        <div
          class="relative h-20 xs:h-24 sm:h-32 w-14 xs:w-[4.2rem] sm:w-auto sm:aspect-[7/11] bg-gradient-to-br from-theme-main to-theme-surface flex-shrink-0 border-r border-accent/20 overflow-hidden"
        >
          {#if series.coverPath}
            <AuthenticatedImage
              src={getSeriesCoverUrl(series.id)}
              alt={series.title}
              class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
              onerror={(e) => handleImageError(e, 'series', series.id)}
            />
          {:else}
            <div
              class="h-full w-full flex items-center justify-center text-3xl font-bold text-theme-tertiary"
            >
              📚
            </div>
          {/if}
          <div
            class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none"
          ></div>
        </div>

        <!-- Series Info -->
        <div class="flex-1 min-w-0 py-3 sm:py-4 px-3 sm:px-5 text-left">
          <div class="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
            <h3
              class="text-sm sm:text-lg font-extrabold text-theme-primary group-hover:text-accent transition-colors duration-300 line-clamp-2 tracking-tight"
            >
              {series.title}
            </h3>
            <div
              class="flex-shrink-0 text-accent/60 group-hover:text-accent transition-all duration-300 {isExpanded
                ? 'rotate-180'
                : ''}"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="sm:w-5 sm:h-5"><polyline points="6 9 12 15 18 9"></polyline></svg
              >
            </div>
          </div>

          <!-- Stats Row -->
          <div
            class="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3 text-[10px] sm:text-xs font-semibold"
          >
            <span
              class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-theme-surface/60 text-theme-secondary border border-theme-border/50 whitespace-nowrap"
            >
              {series.volumes.length} vol{series.volumes.length === 1 ? '' : 's'}
            </span>
            {#if series.totalAhead > 0}
              <span
                class="group/badge relative inline-flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 px-1.5 xs:px-2 sm:px-3 py-0.5 xs:py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 text-accent border border-accent/30 sm:border-2 shadow-sm hover:shadow-lg hover:scale-105 transition-all duration-200 whitespace-nowrap"
              >
                <div
                  class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/badge:opacity-100 transition-opacity rounded-lg"
                ></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
                  ><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path
                    d="m15 5 4 4"
                  /></svg
                >
                <span class="font-bold leading-none">{series.totalAhead}</span>
                <span class="hidden sm:inline text-[9px] sm:text-[10px] leading-none"
                  >edit{series.totalAhead === 1 ? '' : 's'}</span
                >
                <span class="hidden md:inline text-[9px] sm:text-xs leading-none">·</span>
                <span class="hidden md:inline font-semibold leading-none"
                  >{series.volumesAhead}</span
                >
                <span class="hidden md:inline text-[9px] sm:text-xs leading-none"
                  >vol{series.volumesAhead === 1 ? '' : 's'}</span
                >
              </span>
            {/if}
            {#if series.totalBehind > 0}
              <span
                class="group/badge relative inline-flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 px-1.5 xs:px-2 sm:px-3 py-0.5 xs:py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-gradient-to-br from-status-warning/20 to-status-warning/10 text-status-warning border border-status-warning/30 sm:border-2 shadow-sm hover:shadow-lg hover:scale-105 transition-all duration-200 whitespace-nowrap"
              >
                <div
                  class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/badge:opacity-100 transition-opacity rounded-lg"
                ></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
                  ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
                    points="7 10 12 15 17 10"
                  /><line x1="12" x2="12" y1="15" y2="3" /></svg
                >
                <span class="font-bold leading-none">{series.totalBehind}</span>
                <span class="hidden sm:inline text-[9px] sm:text-[10px] leading-none"
                  >update{series.totalBehind === 1 ? '' : 's'}</span
                >
                <span class="hidden md:inline text-[9px] sm:text-xs leading-none">·</span>
                <span class="hidden md:inline font-semibold leading-none"
                  >{series.volumesBehind}</span
                >
                <span class="hidden md:inline text-[9px] sm:text-xs leading-none"
                  >vol{series.volumesBehind === 1 ? '' : 's'}</span
                >
              </span>
            {/if}
          </div>
        </div>
      </button>

      <!-- Expandable Volumes List -->
      {#if isExpanded}
        <div
          class="border-t border-theme-primary/10 bg-theme-surface/20"
          style="animation: expandDown 0.3s ease-out"
        >
          <div class="divide-y divide-theme-border/20">
            {#each series.volumes as volume, idx (volume.id)}
              {@const status = getStatusInfo(volume)}
              {@const hasActivity = volume.hasAhead > 0 || volume.hasBehind > 0}
              {@const isVolumeSelected = selectedItems.has(volume.id)}
              <div
                use:longpress
                onlongpress={() => onVolumeLongPress(volume.id)}
                class="w-full flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 transition-all duration-200 {!hasActivity &&
                !isSelectionMode
                  ? 'opacity-40'
                  : ''} {isVolumeSelected
                  ? 'bg-accent/10 border-l-4 border-accent'
                  : ''} {isSelectionMode && !isVolumeSelected ? 'opacity-40 grayscale-[0.4]' : ''}"
                style="animation: fadeIn 0.2s ease-out {idx * 0.02}s both"
              >
                <!-- Volume Cover (Small) -->
                <div class="relative flex-shrink-0">
                  {#if volume.coverImageName}
                    <AuthenticatedImage
                      src={getVolumeCoverUrl(volume.id, volume.coverImageName) || ''}
                      alt={volume.title}
                      class="w-10 h-14 sm:w-14 sm:h-20 object-cover rounded-md shadow-md transition-all duration-200 border border-theme-border/30"
                      loading="lazy"
                      onerror={(e) => handleImageError(e, 'volume', volume.id)}
                    />
                  {:else}
                    <div
                      class="w-10 h-14 sm:w-14 sm:h-20 rounded-md bg-gradient-to-br from-theme-main to-theme-surface border border-theme-border flex items-center justify-center text-lg sm:text-xl text-theme-tertiary shadow-md"
                    >
                      📖
                    </div>
                  {/if}
                  {#if hasActivity}
                    <div class="absolute -top-1 -right-1">
                      <div
                        class="w-2 h-2 sm:w-3 sm:h-3 rounded-full {status.color} shadow-lg border-2 border-theme-surface animate-pulse"
                      ></div>
                    </div>
                  {/if}
                </div>

                <!-- Volume Info -->
                <div class="flex-1 min-w-0">
                  <div
                    class="text-xs sm:text-base font-bold text-theme-primary truncate mb-1.5 sm:mb-2 tracking-tight"
                  >
                    {volume.title}
                  </div>
                  <div
                    class="flex items-center gap-1 xs:gap-1.5 sm:gap-2 text-[9px] xs:text-[10px] sm:text-xs font-semibold flex-wrap"
                  >
                    {#if volume.hasAhead > 0}
                      <span
                        class="inline-flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 px-1 xs:px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-accent/15 text-accent border border-accent/30 whitespace-nowrap"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0"
                          ><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path
                            d="m15 5 4 4"
                          /></svg
                        >
                        <span class="leading-none">{volume.userPatchCount}</span>
                        <span class="hidden sm:inline text-[9px] sm:text-[10px] leading-none"
                          >edit{volume.userPatchCount === 1 ? '' : 's'}</span
                        >
                      </span>
                    {/if}
                    {#if volume.hasBehind > 0}
                      <span
                        class="inline-flex items-center gap-0.5 xs:gap-1 sm:gap-1.5 px-1 xs:px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-status-warning/15 text-status-warning border border-status-warning/30 whitespace-nowrap"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0"
                          ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
                            points="7 10 12 15 17 10"
                          /><line x1="12" x2="12" y1="15" y2="3" /></svg
                        >
                        <span class="leading-none">{volume.behindByCount}</span>
                        <span class="hidden sm:inline text-[9px] sm:text-[10px] leading-none"
                          >update{volume.behindByCount === 1 ? '' : 's'}</span
                        >
                      </span>
                    {/if}
                    {#if !hasActivity}
                      <span
                        class="px-1 xs:px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-theme-surface/60 text-theme-tertiary border border-theme-border/50 whitespace-nowrap text-[9px] xs:text-[10px] sm:text-xs"
                        >Up to date</span
                      >
                    {/if}
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex flex-row items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
                  <!-- Diff Viewer Button -->
                  {#if volume.hasAhead > 0 || volume.hasBehind > 0}
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        onOpenDiffViewer(volume);
                      }}
                      class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-semibold text-[10px] sm:text-xs transition-all border border-theme-primary/30 sm:border-2 bg-theme-primary/10 text-theme-primary hover:bg-theme-primary/20 hover:border-theme-primary shadow-sm hover:shadow-md flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
                      title="View differences"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="sm:w-3.5 sm:h-3.5"
                        ><path d="M12 3v18" /><path d="m8 9-3 3 3 3" /><path
                          d="m16 15 3-3-3-3"
                        /></svg
                      >
                      <span class="hidden lg:inline">Differences</span>
                    </button>
                  {/if}

                  {#if hasActivity}
                    {#if volume.hasBehind > 0}
                      <!-- Rebase Button -->
                      <button
                        onclick={(e) => onRebase(e, volume, series.title)}
                        class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-semibold text-[10px] sm:text-xs transition-all border border-status-warning/30 sm:border-2 bg-status-warning/10 text-status-warning hover:bg-status-warning hover:text-white hover:border-status-warning shadow-sm hover:shadow-md whitespace-nowrap flex-shrink-0"
                        title="Sync with official updates"
                      >
                        🔄 Rebase
                      </button>
                    {/if}
                    {#if volume.hasAhead > 0}
                      <!-- Reset Button -->
                      <button
                        onclick={(e) => onReset(e, volume)}
                        class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-semibold text-[10px] sm:text-xs transition-all border border-status-danger/30 sm:border-2 bg-status-danger/10 text-status-danger hover:bg-status-danger hover:text-white hover:border-status-danger shadow-sm hover:shadow-md whitespace-nowrap flex-shrink-0"
                        title="Reset to official version"
                      >
                        ↺ Reset
                      </button>
                    {/if}
                  {/if}
                  <!-- View Button -->
                  <button
                    onpointerdown={(e) => onVolumeSelect(e, volume.id)}
                    onclick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isSelectionMode) {
                        onViewVolume(volume.id, series.id);
                      }
                    }}
                    class="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg font-semibold text-[10px] sm:text-xs transition-all border border-theme-border/50 sm:border-2 bg-theme-surface/60 text-theme-secondary hover:bg-accent hover:text-white hover:border-accent shadow-sm hover:shadow-md flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                    title="Open volume"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="sm:w-3.5 sm:h-3.5"
                      ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
                        cx="12"
                        cy="12"
                        r="3"
                      /></svg
                    >
                    <span class="hidden md:inline">View</span>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .contrib-series-card {
    content-visibility: auto;
    contain: content;
    contain-intrinsic-size: auto 260px;
  }
</style>
