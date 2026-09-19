<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { apiFetch } from '$lib/services/api';
  import type { Series, PaginationData } from '$lib/types';
  import { uiState } from '$lib/states/ui/uiState.svelte.ts';
  import { SelectionState } from '$lib/states/selection/SelectionState.svelte';
  import { metadataOps } from '$lib/states/metadata/metadataOperations.svelte.ts';
  import Footer from '$lib/components/layout/Footer.svelte';
  import LibraryActionBar from '$lib/components/layout/action-bar/LibraryActionBar.svelte';
  import LibraryActionBarSeriesActions from '$lib/components/layout/action-bar/LibraryActionBarSeriesActions.svelte';
  import LibraryEntry from '$lib/components/layout/LibraryEntry.svelte';
  import LibraryListWrapper from '$lib/components/layout/LibraryListWrapper.svelte';
  import type { FilterStatus, FilterMissing, FilterOwner } from '$lib/states/ui/uiState.svelte.ts';
  import { formatLastReadDate } from '$lib/utils/helpers/date';
  import { SvelteMap } from 'svelte/reactivity';

  let library = $state<Series[]>([]);
  let meta = $state({ total: 0, page: 1, limit: 24, totalPages: 1 });
  let isLoadingLibrary = $state(true);
  let libraryError = $state<string | null>(null);

  let pullDistance = $state(0);
  let touchStartY = $state(0);
  let isRefreshing = $state(false);
  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let selectionState = new SelectionState<Series>();

  const computeSeriesProgress = (series: Series) => {
    if (series.totalPageCount === 0) return { percent: 0, isRead: false };
    return {
      percent: Math.min(100, Math.max(0, (series.readPageCount / series.totalPageCount) * 100)),
      isRead: series.status === 2
    };
  };

  let seriesProgressMap = new SvelteMap<string, { percent: number; isRead: boolean }>();

  const getSeriesProgress = (series: Series) =>
    seriesProgressMap.get(series.id) ?? computeSeriesProgress(series);

  onMount(() => {
    uiState.setContext('library', 'Library', [
      { key: 'title', label: 'Title' },
      { key: 'updated', label: 'Last Updated' },
      { key: 'lastRead', label: 'Recent' }
    ]);
  });

  onMount(() => {
    if (!browser) return;

    const params = page.url.searchParams;

    const q = params.get('q');
    if (q !== null && q !== uiState.searchQuery) {
      uiState.searchQuery = q;
    }

    const sort = params.get('sort');
    const order = params.get('order');

    if (sort) {
      if (sort === 'updated') uiState.sortKey = 'updated';
      else if (sort === 'recent') uiState.sortKey = 'lastRead';
      else uiState.sortKey = 'title';
    }

    if (order === 'asc' || order === 'desc') {
      uiState.sortOrder = order;
    }

    const status = params.get('status');
    if (status && uiState.filterStatus !== status) {
      uiState.filterStatus = status as FilterStatus;
    }

    const bookmarked = params.get('bookmarked');
    if (bookmarked === 'true') {
      uiState.filterBookmarked = true;
    }

    const isOrganized = params.get('is_organized');
    if (isOrganized === 'true') uiState.filterOrganization = 'organized';
    else if (isOrganized === 'false') uiState.filterOrganization = 'unorganized';
    else uiState.filterOrganization = 'all';

    const missing = params.get('filter_missing');
    if (missing) {
      uiState.filterMissing = missing as FilterMissing;
    }

    const owner = params.get('owner');
    if (owner === 'user') uiState.filterOwner = 'private';
    else if (owner === 'admin') uiState.filterOwner = 'shared';
    else uiState.filterOwner = 'all';
  });

  let isFirstLoad = true;
  $effect(() => {
    uiState.libraryVersion;

    if (!browser) return;

    const currentParams = new SvelteURLSearchParams(page.url.searchParams);
    const newParams = new SvelteURLSearchParams(currentParams);

    if (uiState.searchQuery) newParams.set('q', uiState.searchQuery);
    else newParams.delete('q');

    let backendSort = 'title';
    if (uiState.sortKey === 'updated') backendSort = 'updated';
    if (uiState.sortKey === 'lastRead') backendSort = 'recent';

    newParams.set('sort', backendSort);
    newParams.set('order', uiState.sortOrder);

    if (uiState.filterStatus !== 'all') {
      newParams.set('status', uiState.filterStatus);
    } else {
      newParams.delete('status');
    }

    if (uiState.filterBookmarked) {
      newParams.set('bookmarked', 'true');
    } else {
      newParams.delete('bookmarked');
    }

    if (uiState.filterOrganization !== 'all') {
      newParams.set('is_organized', uiState.filterOrganization === 'organized' ? 'true' : 'false');
    } else {
      newParams.delete('is_organized');
    }

    if (uiState.filterMissing !== 'none') {
      newParams.set('filter_missing', uiState.filterMissing);
    } else {
      newParams.delete('filter_missing');
    }

    if (uiState.filterOwner !== 'all') {
      newParams.set('owner', uiState.filterOwner === 'private' ? 'user' : 'admin');
    } else {
      newParams.delete('owner');
    }

    const criteriaChanged =
      currentParams.get('q') !== newParams.get('q') ||
      currentParams.get('sort') !== newParams.get('sort') ||
      currentParams.get('order') !== newParams.get('order') ||
      currentParams.get('status') !== newParams.get('status') ||
      currentParams.get('bookmarked') !== newParams.get('bookmarked') ||
      currentParams.get('is_organized') !== newParams.get('is_organized') ||
      currentParams.get('filter_missing') !== newParams.get('filter_missing');

    if (criteriaChanged) {
      newParams.set('page', '1');
    }

    const queryString = newParams.toString();
    if (queryString !== currentParams.toString()) {
      goto(resolve(`/?${queryString}`, {}), {
        replaceState: true,
        keepFocus: true,
        noScroll: true
      });
    }

    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    if (isFirstLoad) {
      fetchLibrary(`?${queryString}`);
      isFirstLoad = false;
    } else {
      filterDebounceTimer = setTimeout(() => {
        fetchLibrary(`?${queryString}`);
      }, 250);
    }
  });

  onDestroy(() => {
    if (filterDebounceTimer) {
      clearTimeout(filterDebounceTimer);
    }
  });

  const fetchLibrary = async (queryString: string, silent = false) => {
    try {
      if (!silent) isLoadingLibrary = true;
      libraryError = null;

      const response: { data: Series[]; meta: PaginationData } = await apiFetch(
        `/api/library${queryString}`,
        { cache: true }
      );

      const nextLibrary = response.data;
      library = nextLibrary;
      seriesProgressMap = new SvelteMap(
        nextLibrary.map((series) => [series.id, computeSeriesProgress(series)])
      );
      meta = response.meta;
    } catch (e) {
      libraryError = (e as Error).message;
    } finally {
      isLoadingLibrary = false;
    }
  };

  const toggleBookmark = async (e: Event, series: Series) => {
    e.preventDefault();
    e.stopPropagation();

    const oldState = series.bookmarked;
    series.bookmarked = !series.bookmarked;

    metadataOps.syncBookmark(series.id, series.bookmarked, () => {
      series.bookmarked = oldState;
    });
  };

  const handleCardClick = (e: MouseEvent, series: Series) => {
    if (selectionState.isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      selectionState.toggleSelection(series);
    }
  };

  const handleRefresh = () => {
    const params = new SvelteURLSearchParams(page.url.searchParams);
    fetchLibrary(`?${params.toString()}`, true);
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (!browser || window.scrollY > 0 || isRefreshing) return;
    touchStartY = event.touches[0].clientY;
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!touchStartY || isRefreshing) return;
    const delta = event.touches[0].clientY - touchStartY;
    if (delta > 0) {
      event.preventDefault();
    }
    pullDistance = Math.max(0, Math.min(delta, 120));
  };

  const handleTouchEnd = () => {
    if (pullDistance > 80 && !isRefreshing) {
      isRefreshing = true;
      handleRefresh();
      setTimeout(() => {
        isRefreshing = false;
      }, 800);
    }
    pullDistance = 0;
    touchStartY = 0;
  };
</script>

<div
  class="flex flex-col min-h-[calc(100vh-5rem)] mx-auto px-4 sm:px-6 pt-1 sm:pt-2 pb-6"
  style="max-width: 1400px;"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  {#if pullDistance > 0}
    <div class="flex justify-center">
      <div
        class="px-4 py-2 rounded-full bg-theme-surface text-theme-secondary text-xs shadow-lg"
        style={`transform: translateY(${pullDistance / 2}px);`}
      >
        {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
      </div>
    </div>
  {/if}
  {#if isLoadingLibrary && library.length === 0}
    <div class="flex-grow flex items-center justify-center">
      <div
        class="rounded-3xl bg-black/20 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 flex items-center gap-4"
      >
        <svg
          class="animate-spin h-8 w-8 text-accent"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span class="text-theme-secondary">Loading library...</span>
      </div>
    </div>
  {:else if libraryError}
    <div class="flex-grow flex items-center justify-center p-4">
      <div
        class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-status-danger/20 text-status-danger shadow-[0_4px_16px_0_rgba(0,0,0,0.3)]"
      >
        Error loading library: {libraryError}
      </div>
    </div>
  {:else if library.length === 0}
    <div class="flex-grow flex flex-col items-center justify-center py-20 text-center">
      <div
        class="rounded-3xl backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 sm:p-12 max-w-md"
      >
        <div
          class="bg-theme-surface-hover backdrop-blur-2xl p-6 rounded-full mb-6 border border-white/5 inline-block"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-theme-tertiary"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        </div>
        <p class="text-xl font-medium text-theme-primary mb-2">Your library is empty</p>
        <p class="text-theme-secondary max-w-sm mb-6">
          Upload some Mokuro-processed manga volumes to get started building your collection.
        </p>
        <button
          onclick={() => (uiState.isUploadOpen = true)}
          class="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors shadow-lg shadow-indigo-900/20"
        >
          Upload Now &rarr;
        </button>
      </div>
    </div>
  {:else}
    <div class="flex-grow pb-24 relative">
      <!-- Glassmorphic container wrapper with fade on background only -->
      <LibraryListWrapper>
        <!-- Content layer (series cards) - fully visible, not affected by fade -->
        <div
          class="relative z-10 {uiState.viewMode === 'grid'
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
            : 'flex flex-col gap-3'}"
        >
          {#each library as series (series.id)}
            {@const { percent, isRead } = getSeriesProgress(series)}
            {@const isSelected = selectionState.selection.has(series.id)}

            <LibraryEntry
              onLongPress={() => {
                selectionState.enterSelectionMode(series);
              }}
              entry={{
                id: series.id,
                title: series.title,
                folderName: series.folderName,
                coverUrl: series.coverPath
                  ? `/api/files/series/${series.id}/cover?w=300&q=44&format=avif&t=${series.updatedAt}`
                  : null
              }}
              type="series"
              viewMode={uiState.viewMode}
              {isSelected}
              isSelectionMode={selectionState.isSelectionMode}
              badge={
                series.canEdit
                  ? undefined
                  : {
                      text: 'Shared',
                      status: 'success'
                    }
              }
              progress={{
                percent: percent,
                isRead: isRead
              }}
              href={resolve(`/series/${series.id}`, {})}
              mainStat={`${series.totalVolumeCount ?? 0} ${series.totalVolumeCount <= 1 ? 'Vol' : 'Vols'}`}
              subStat={formatLastReadDate(series.lastReadAt)}
              onSelect={(e) => handleCardClick(e, series)}
            >
              {#snippet circleAction()}
                <button
                  onclick={(e) => toggleBookmark(e, series)}
                  class={`z-30 col-start-1 row-start-1 relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 pointer-events-auto hover:bg-white/10 active:scale-75 ${
                    series.bookmarked ? 'text-status-warning' : 'text-theme-secondary'
                  }`}
                  title={series.bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="18"
                    width="18"
                    viewBox="0 0 24 24"
                    fill={series.bookmarked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class={`relative transition-all ${
                      series.bookmarked ? 'animate-pop neon-glow' : 'neon-off'
                    }`}
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              {/snippet}

              {#snippet listActions()}
                <button
                  onclick={(e) => toggleBookmark(e, series)}
                  class={`z-30 col-start-1 row-start-1 relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 pointer-events-auto hover:bg-white/10 active:scale-75 ${
                    series.bookmarked ? 'text-status-warning' : 'text-theme-secondary'
                  }`}
                  title={series.bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="18"
                    width="18"
                    viewBox="0 0 24 24"
                    fill={series.bookmarked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class={`relative transition-all ${
                      series.bookmarked ? 'animate-pop neon-glow' : 'neon-off'
                    }`}
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              {/snippet}
            </LibraryEntry>
          {/each}
        </div>
      </LibraryListWrapper>
    </div>

    <Footer {meta} />
    <LibraryActionBar
      onSelectAll={() => selectionState.selectAll(library)}
      offset={72}
      {selectionState}
    >
      {#snippet children(selection)}
        <LibraryActionBarSeriesActions
          selectionState={selection}
          onRefresh={handleRefresh}
        />
      {/snippet}
    </LibraryActionBar>
  {/if}
</div>

<style>
  .neon-off {
    transition: filter 0.8s ease-in;
    filter: drop-shadow(0 0 0px color-mix(in srgb, currentColor, transparent 100%))
      drop-shadow(0 0 0px color-mix(in srgb, currentColor, transparent 100%))
      drop-shadow(0 0 0px color-mix(in srgb, currentColor, transparent 100%));
  }

  @keyframes bookmark-pop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.4);
    }
    100% {
      transform: scale(1);
    }
  }

  .animate-pop {
    animation: bookmark-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* Button hover glow */
  button:not(:disabled):hover {
    box-shadow:
      0 20px 40px -12px rgba(99, 102, 241, 0.5),
      0 0 30px rgba(99, 102, 241, 0.3);
  }
</style>
