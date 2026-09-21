<script lang="ts">
  import { browser } from '$app/environment';
  import MenuSlider from '$lib/components/menu/MenuSlider.svelte';
  import { readerState } from '$lib/states/reader/ReaderState.svelte.ts';

  let { isOpen = $bindable(false), position } = $props<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>();

  // --- State ---
  let sliderElement: HTMLDivElement | null = $state(null);
  let internalFontSize = $state(16);
  let finalX = $state(0);
  let finalY = $state(0);

  // --- Synchronization ---
  // Sync internal state when opening, using the coordinates to find the block
  $effect(() => {
    if (isOpen && readerState.focusedLineCoord && readerState.mokuroStagingData) {
      const [pIdx, bIdx] = readerState.focusedLineCoord;
      const block = readerState.mokuroStagingData.pages[pIdx]?.blocks[bIdx];
      if (block) {
        internalFontSize = block.font_size ?? 16;
      }
    }
  });

  // Keep the slider in the viewport
  $effect(() => {
    if (isOpen && sliderElement && browser) {
      const { x, y } = position;
      const menuWidth = sliderElement.offsetWidth;
      const menuHeight = sliderElement.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate final X
      if (x + menuWidth > viewportWidth) {
        finalX = x - menuWidth;
      } else {
        finalX = x;
      }

      // Calculate final Y
      if (y + menuHeight > viewportHeight) {
        finalY = y - menuHeight;
      } else {
        finalY = y;
      }

      if (finalX < 0) finalX = 0;
      if (finalY < 0) finalY = 0;
    }
  });

  // --- Handlers ---

  const handleSliderChange = () => {
    if (!readerState.focusedLineCoord || !readerState.mokuroStagingData) return;

    const [pIdx, bIdx] = readerState.focusedLineCoord;
    const block = readerState.mokuroStagingData.pages[pIdx]?.blocks[bIdx];

    if (!block || internalFontSize === block.font_size) return;

    // Dispatch using the exact indices from the coordinate system
    readerState.dispatch([
      {
        op: 'replace',
        path: `/pages/${pIdx}/blocks/${bIdx}/font_size`,
        value: internalFontSize,
        old_value: block.font_size ?? 16
      }
    ]);
  };
</script>

<div data-font-slider-popover>
  {#if isOpen}
    <div
      bind:this={sliderElement}
      class="fixed z-50 w-64 rounded-2xl bg-black/60 backdrop-blur-3xl border border-white/10 p-5 shadow-2xl"
      style="left: {finalX}px; top: {finalY}px;"
      onpointerdown={(e) => e.stopPropagation()}
    >
      <MenuSlider
        label="Font Size"
        bind:value={internalFontSize}
        min={8}
        max={100}
        step={1}
        displayValue="{internalFontSize.toFixed(0)}px"
        onChange={handleSliderChange}
      />
    </div>
  {/if}
</div>
