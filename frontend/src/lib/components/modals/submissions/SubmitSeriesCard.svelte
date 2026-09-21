<script lang="ts">
  import { submissionState } from '$lib/states/contributions/SubmissionState.svelte';
  import type { SubmissionItem } from '$lib/states/contributions/SubmissionSession.svelte';
  import Button from '$lib/components/controls/Button.svelte';
  import AuthenticatedImage from '$lib/components/common/AuthenticatedImage.svelte';
  import type { Series } from '$lib/types';
  import { slide, fade } from 'svelte/transition';

  let { item }: { item: SubmissionItem } = $props();

  // Local Search State
  let searchQuery = $state(item.sourceSeries.sortTitle);
  let searchResults = $state<Series[]>([]);
  let isSearching = $state(false);
  let showDropdown = $state(false);

  // Reference for click-outside detection
  let dropdownContainer = $state<HTMLElement>();

  // Debounce timer
  let debounceTimer: NodeJS.Timeout;

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchQuery = val;
    clearTimeout(debounceTimer);

    if (val.length < 2) {
      searchResults = [];
      return;
    }

    isSearching = true;
    debounceTimer = setTimeout(async () => {
      searchResults = await submissionState.searchSharedLibrary(val);
      isSearching = false;
      showDropdown = true;
    }, 500);
  }

  // Handle Click Outside
  function handleClickOutside(event: MouseEvent) {
    if (showDropdown && dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
      showDropdown = false;
    }
  }

  async function selectTarget(series: Series) {
    showDropdown = false;
    const fullSeries = await submissionState.fetchRemoteSeriesDetails(series.id);
    if (fullSeries) {
      item.targetSeries = fullSeries;
      item.resetSelection();
    }
  }

  function selectNewSeries() {
    showDropdown = false;
    item.targetSeries = null;
    item.resetSelection();
  }

  let isSubmitting = $derived(item.status === 'submitting');

  // Navigation Helpers
  const session = $derived(submissionState.session);
  const isFirst = $derived(session ? session.currentIndex === 0 : true);
  const isLast = $derived(session ? session.currentIndex === session.items.length - 1 : true);
</script>

<svelte:window onclick={handleClickOutside} />

<div class="w-full max-w-5xl h-full flex flex-col gap-4 mx-auto">
  <div class="flex gap-4 items-start border-b border-theme-border pb-4 shrink-0">
    <div class="w-16 h-24 shrink-0 rounded overflow-hidden border border-theme-border bg-black/20">
      <AuthenticatedImage
        src={`/api/files/series/${item.sourceSeries.id}/cover?w=300&q=44&format=avif&t=${item.sourceSeries.updatedAt}`}
        alt={item.sourceSeries.sortTitle}
        class="w-full h-full object-cover"
      />
    </div>
    <div class="flex-1 min-w-0 flex flex-col justify-top h-24">
      <div class="text-xs font-bold uppercase text-theme-secondary mb-0.5">Source Series</div>

      <h3 class="text-lg font-bold text-theme-primary truncate">{item.sourceSeries.sortTitle}</h3>
      <p class="text-sm text-theme-secondary truncate">
        {#if item.isLoadingSource}
          Loading volumes...
        {:else}
          {item.volumes.length} local volumes
        {/if}
      </p>
    </div>
  </div>

  <div
    class="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden gap-6 min-h-0 relative"
  >
    {#if item.isLoadingSource}
      <div
        class="absolute inset-0 flex flex-col items-center justify-center bg-theme-main/80 backdrop-blur-sm z-20 rounded-lg"
        transition:fade
      >
        <div
          class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2"
        ></div>
        <p class="text-theme-secondary text-sm">Fetching series details...</p>
      </div>
    {/if}

    <div
      class="flex flex-col gap-4 shrink-0 flex-1 {item.isLoadingSource
        ? 'opacity-20 pointer-events-none'
        : ''}"
    >
      <div class="space-y-2 relative z-10" bind:this={dropdownContainer}>
        <div class="text-xs font-bold uppercase text-theme-secondary">Target Series</div>

        <div class="relative">
          <input
            type="text"
            class="w-full bg-theme-surface border border-theme-border rounded px-3 py-2 text-sm focus:border-accent outline-none transition-colors"
            placeholder="Search shared library..."
            bind:value={searchQuery}
            oninput={handleSearchInput}
            onfocus={() => (showDropdown = true)}
          />

          {#if isSearching}
            <div class="absolute right-3 top-2.5 text-theme-secondary text-xs">Loading...</div>
          {/if}

          {#if showDropdown && (searchResults.length > 0 || searchQuery.length > 0)}
            <div
              class="absolute top-full left-0 right-0 mt-1 bg-theme-surface border border-theme-border rounded-lg shadow-xl max-h-60 overflow-y-auto overflow-x-hidden"
              transition:slide
            >
              <button
                class="w-full text-left px-3 py-3 hover:bg-accent hover:text-white transition-colors flex items-center gap-3 border-b border-theme-border/50"
                onclick={selectNewSeries}
              >
                <span class="text-xl">✨</span>
                <div>
                  <div class="font-bold text-sm">Submit as New Series</div>
                  <div class="text-xs opacity-70">
                    Create "{item.sourceSeries.sortTitle}" in shared library
                  </div>
                </div>
              </button>

              {#each searchResults as result}
                <button
                  class="w-full text-left px-3 py-2 hover:bg-accent hover:text-white transition-colors flex items-center gap-3"
                  onclick={() => selectTarget(result)}
                >
                  <div
                    class="w-8 h-12 bg-black/20 rounded overflow-hidden shrink-0 border border-white/10"
                  >
                    {#if result.coverPath}
                      <AuthenticatedImage
                        src={`/api/files/series/${result.id}/cover?w=300&q=44&format=avif&t=${result.updatedAt}`}
                        class="w-full h-full object-cover"
                      />
                    {/if}
                  </div>
                  <div class="min-w-0">
                    <div class="font-bold text-sm truncate">{result.sortTitle}</div>
                    <div class="text-[10px] opacity-70 truncate">{result.id}</div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div
        class="flex-1 bg-theme-surface/30 border border-theme-border rounded-lg p-6 flex flex-col justify-center min-h-[200px]"
      >
        {#if item.targetSeries}
          <div class="flex gap-5">
            <div
              class="w-24 h-36 bg-black/20 rounded-md overflow-hidden shrink-0 shadow-lg border border-theme-border/50"
            >
              <AuthenticatedImage
                src={`/api/files/series/${item.targetSeries.id}/cover?w=300&q=44&format=avif&t=${item.targetSeries.updatedAt}`}
                class="w-full h-full object-cover"
              />
            </div>

            <div class="flex-1 min-w-0 flex flex-col justify-center">
              <div class="text-xs text-accent font-bold uppercase tracking-wider mb-1">
                Merge Into
              </div>
              <h4
                class="text-2xl font-bold text-theme-primary leading-tight mb-2 line-clamp-2"
                title={item.targetSeries.sortTitle}
              >
                {item.targetSeries.sortTitle}
              </h4>

              <div class="flex flex-wrap gap-2">
                <span
                  class="px-2 py-1 rounded bg-theme-surface border border-theme-border text-xs text-theme-secondary font-mono"
                >
                  {item.targetSeries.volumes.length} remote volumes
                </span>
              </div>
            </div>
          </div>

          <div
            class="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-200 flex items-start gap-2"
          >
            <span>⚠️</span>
            <span
              >Merging will only submit volumes that do not already exist in the target series
              (matched by folder name).</span
            >
          </div>
        {:else}
          <div class="h-full flex flex-col items-center justify-center text-center opacity-60 py-8">
            <span class="text-5xl mb-4 grayscale brightness-150">✨</span>
            <p class="text-lg font-bold text-theme-primary">New Series Mode</p>
            <p class="text-sm text-theme-secondary max-w-[200px]">
              A new series entry will be created in the Shared Library.
            </p>
          </div>
        {/if}
      </div>
    </div>

    <div
      class="flex-1 flex flex-col min-h-0 {item.isLoadingSource
        ? 'opacity-20 pointer-events-none'
        : ''}"
    >
      <div class="flex justify-between items-center mb-2 shrink-0">
        <div class="text-xs font-bold uppercase text-theme-secondary">Volumes to Submit</div>
        <div
          class="text-xs text-theme-secondary px-2 py-0.5 rounded bg-theme-surface border border-theme-border"
        >
          {item.selectedVolumeIds.size} selected
        </div>
      </div>

      <div
        class="flex-1 lg:overflow-y-auto bg-theme-surface/50 border border-theme-border rounded-lg p-2 space-y-1 shadow-inner"
      >
        {#each item.volumes as vol (vol.id)}
          {@const isConflict = item.isVolumeConflicting(vol)}
          {@const isSelected = item.selectedVolumeIds.has(vol.id)}

          <button
            disabled={isConflict}
            onclick={() => item.toggleVolume(vol.id)}
            class="w-full flex items-center gap-3 px-3 py-3 rounded text-sm transition-all border border-transparent group
                 {isConflict
              ? 'opacity-50 cursor-not-allowed bg-red-500/5 hover:bg-red-500/10'
              : 'hover:bg-theme-surface'}
                 {isSelected ? 'bg-accent/10 border-accent/20' : ''}"
          >
            <div
              class="w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors
                  {isSelected
                ? 'bg-accent border-accent text-white'
                : 'border-theme-secondary/40 bg-theme-main'}"
            >
              {#if isSelected}
                <span class="text-xs font-bold">✓</span>
              {/if}
            </div>

            <span
              class="truncate flex-1 text-left font-medium {isSelected
                ? 'text-theme-primary'
                : 'text-theme-secondary group-hover:text-theme-primary'}"
            >
              {vol.folderName}
            </span>

            {#if isConflict}
              <span
                class="text-[10px] text-red-400 font-bold uppercase tracking-wider px-2 py-1 bg-red-900/20 rounded"
                >Exists</span
              >
            {/if}
          </button>
        {/each}

        {#if item.volumes.length === 0 && !item.isLoadingSource}
          <div class="p-8 text-center text-theme-secondary text-sm">No local volumes found.</div>
        {/if}
      </div>
    </div>
  </div>

  <div class="pt-4 border-t border-theme-border flex justify-between items-center shrink-0">
    <div class="flex gap-2">
      <Button
        variant="ghost"
        disabled={isFirst}
        onclick={() => submissionState.session?.previous()}
      >
        ← Prev
      </Button>
      <Button variant="ghost" disabled={isLast} onclick={() => submissionState.session?.next()}>
        Next →
      </Button>
    </div>

    <div class="flex gap-4 items-center">
      {#if item.errorMessage}
        <span class="text-xs text-status-danger font-medium hidden sm:inline"
          >{item.errorMessage}</span
        >
      {/if}

      {#if item.status === 'submitted'}
        <div
          class="flex items-center gap-2 text-status-success font-bold text-sm mr-2 px-3 py-2 bg-status-success/10 rounded-lg"
        >
          <span>✓ Submitted</span>
        </div>
      {:else}
        <Button
          variant="primary"
          is_loading={isSubmitting}
          disabled={item.selectedVolumeIds.size === 0 || item.isLoadingSource}
          onclick={() => submissionState.submitCurrentItem()}
        >
          {`Submit (${item.selectedVolumeIds.size})`}
        </Button>
      {/if}
    </div>
  </div>
</div>
