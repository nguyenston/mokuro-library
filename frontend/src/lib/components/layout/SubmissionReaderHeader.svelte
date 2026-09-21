<script lang="ts">
  import { readerState } from '$lib/states/reader/ReaderState.svelte.ts';
  import { X, Settings } from 'lucide-svelte';

  let { settingsOpen = $bindable(), on_close } = $props<{
    settingsOpen: boolean;
    on_close: () => void;
  }>();

  let headerForceVisible = $state(false);
  let headerTimer: ReturnType<typeof setTimeout> | null = null;
  let headerIsVisible = $derived(!readerState.hideHUD || headerForceVisible);
  const pageIndices = $derived(readerState.visiblePages.map((v) => v.index));
</script>

<header
  class="absolute top-0 left-0 right-0 z-40 flex h-12 items-center justify-between px-4
  text-white touch-none transition-opacity duration-300 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
  class:opacity-0={!headerIsVisible}
  onpointerenter={(e) => {
    if (e.pointerType === 'mouse') headerForceVisible = true;
  }}
  onpointerleave={(e) => {
    if (e.pointerType === 'mouse') headerForceVisible = false;
  }}
  onpointerup={(e: PointerEvent) => {
    if (e.pointerType !== 'mouse') {
      setTimeout(() => {
        headerForceVisible = true;
      }, 100);
      if (headerTimer) clearTimeout(headerTimer);

      headerTimer = setTimeout(() => {
        headerForceVisible = false;
        headerTimer = null;
      }, 4000);
    }
  }}
>
  <!-- Close Button -->
  <div class="flex-1 justify-start">
    <button
      disabled={!headerIsVisible}
      onclick={(e) => {
        e.stopPropagation();
        on_close();
      }}
      class="group flex items-center gap-2 pr-4 text-theme-secondary hover:text-theme-primary transition-colors"
      title="Close Preview"
    >
      <div class="p-2 rounded-xl group-hover:bg-white/10 transition-colors">
        <X class="w-5 h-5" />
      </div>
      <span class="text-sm font-medium hidden sm:inline">Close</span>
    </button>
  </div>

  <!-- Title -->
  <div class="flex-1 flex justify-center text-sm font-bold text-white/90 truncate px-4">
    {readerState.volumeTitle}
  </div>

  <!-- Page Count & Settings -->
  <div class="flex flex-1 justify-end gap-2 items-center">
    <span
      class="hidden sm:flex items-center flex-nowrap whitespace-nowrap px-3 py-1 mr-2
        rounded-xl bg-black/20 border border-white/5 text-xs font-medium text-theme-primary font-mono"
    >
      <span class="mr-1">
        {pageIndices[0] + 1}{pageIndices[1] ? `-${pageIndices[1] + 1}` : ''}
      </span>
      <span>/ {readerState.totalPages}</span>
    </span>

    <button
      disabled={!headerIsVisible}
      onclick={(e) => {
        e.stopPropagation();
        settingsOpen = true;
      }}
      class="p-2 rounded-xl text-theme-secondary hover:text-white hover:bg-white/10 transition-colors"
      title="Settings"
    >
      <Settings class="w-5 h-5" />
    </button>
  </div>
</header>
