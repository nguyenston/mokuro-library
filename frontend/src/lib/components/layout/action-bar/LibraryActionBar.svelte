<script lang="ts" generics="T extends {id: string}">
  import { onMount, onDestroy, type Snippet } from 'svelte';
  import type { SelectionState } from '$lib/states/selection/SelectionState.svelte';

  let {
    onSelectAll,
    selectionState,
    offset = 0,
    children
  }: {
    onSelectAll?: () => void;
    selectionState: SelectionState<T>;
    offset?: number;
    children?: Snippet<[SelectionState<T>]>;
  } = $props();

  const selectionMap = $derived(selectionState.selection);
  const isSelectionMode = $derived(selectionState.isSelectionMode);
  let selectionCount = $derived(selectionMap.size);

  const isEscapeBlocked = () =>
    typeof document !== 'undefined' && document.body?.dataset.actionBarModalOpen === 'true';

  // --- Hotkeys ---
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isEscapeBlocked()) return;
      if (isSelectionMode) selectionState.exitSelectionMode();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      if (isSelectionMode && onSelectAll) {
        e.preventDefault();
        onSelectAll();
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if isSelectionMode}
  <div
    class="fixed inset-x-0 mx-auto w-fit z-50 flex items-center p-2 rounded-2xl bg-theme-surface/90 border border-theme-primary/20 shadow-2xl"
    style={`bottom: calc(1.5rem + ${offset}px);`}
  >
    <div class="flex-shrink px-3 font-bold text-theme-primary flex items-center gap-3">
      <span
        class="bg-accent text-white text-xs rounded-full w-6 h-6 flex items-center justify-center shadow-sm"
      >
        {selectionCount}
      </span>
      <div class="flex flex-col leading-tight">
        <span class="text-[10px] text-theme-secondary uppercase tracking-wider">Selected</span>
        <div class="flex gap-2">
          {#if onSelectAll}
            <button
              onclick={onSelectAll}
              class="whitespace-nowrap flex-shrink-0 text-[10px] font-bold text-accent hover:text-accent-hover hover:underline"
              title="Add all visible items to selection (Ctrl+A)"
            >
              + ALL
            </button>
          {/if}
          <button
            onclick={() => selectionState.deselectAll()}
            class="text-[10px] font-bold text-theme-tertiary hover:text-theme-primary hover:underline"
            title="Clear selection"
          >
            CLEAR
          </button>
        </div>
      </div>
    </div>

    {#if selectionCount >= 1}
      <div class="w-[2px] h-8 bg-theme-tertiary/70 mx-1"></div>
      {#if children}
        {@render children(selectionState)}
      {/if}
    {/if}

    <div class="w-[2px] h-8 bg-theme-tertiary/70 mx-1"></div>
    <div class="ml-1">
      <button
        onclick={() => selectionState.exitSelectionMode()}
        class="p-2 rounded-full hover:bg-white/20 text-theme-secondary hover:text-white transition-colors"
        title="exit selection"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
{/if}
