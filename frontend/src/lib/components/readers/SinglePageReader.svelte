<script lang="ts">
  import { readerState } from '$lib/states/reader/ReaderState.svelte.ts';
  import type { PanzoomObject } from '@panzoom/panzoom';
  import CachedImage from '$lib/components/media/CachedImage.svelte';
  import OcrOverlay from '$lib/components/ocr/OcrOverlay.svelte';
  import { panzoom } from '$lib/actions/panzoom';
  import { onMount } from 'svelte';

  let {
    panzoomInstance = $bindable(),
    navZoneWidth
  }: {
    panzoomInstance: PanzoomObject | null;
    navZoneWidth: number;
  } = $props();

  onMount(() => {
    readerState.jumpToPage = (pageIndex: number) => {
      readerState.setPage(pageIndex);
    };
  });

  // Navigation handlers derived from reading direction
  const handleClickLeft = () => {
    if (readerState.readingDirection === 'rtl') {
      readerState.nextPage();
    } else {
      readerState.prevPage();
    }
  };

  const handleClickRight = () => {
    if (readerState.readingDirection === 'rtl') {
      readerState.prevPage();
    } else {
      readerState.nextPage();
    }
  };

  const handleZoneClick = (e: MouseEvent) => {
    // If text is selected, don't navigate
    if (window.getSelection()?.toString()) return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percent = (x / width) * 100;

    if (percent <= navZoneWidth) {
      handleClickLeft();
    } else if (percent >= 100 - navZoneWidth) {
      handleClickRight();
    }
  };
</script>

<div class="relative h-full w-full flex flex-col" onclick={handleZoneClick} role="presentation">
  <div
    class="panzoom-exclude absolute left-0 z-10 h-full bg-accent transition-opacity duration-200 pointer-events-none"
    style={`width: ${navZoneWidth}%; opacity: var(--nav-zone-opacity, 0);`}
  ></div>

  <div
    class="relative flex h-full flex-1 items-center justify-center"
    use:panzoom={{
      options: {
        canvas: true,
        maxScale: 10,
        minScale: 0.5,
        cursor: 'default',
        origin: '50% 50%',
        disableYAxis: false
      },
      onInit: (pz) => (panzoomInstance = pz)
    }}
  >
    {#if readerState.visiblePages[0]}
      {@const page = readerState.visiblePages[0]}
      <div
        class="relative flex-shrink-0 shadow-2xl reader-page"
        style={`aspect-ratio: ${page.img_width} / ${page.img_height}; height: 100%;`}
      >
        <CachedImage src={`/api/files/volume/${readerState.id}/image/${page.img_path}`} />
        <OcrOverlay pageIndex={page.index} {page} {panzoomInstance} />
      </div>
    {/if}
  </div>

  <div
    class="panzoom-exclude absolute right-0 z-10 h-full bg-accent transition-opacity duration-200 pointer-events-none"
    style={`width: ${navZoneWidth}%; opacity: var(--nav-zone-opacity, 0);`}
  ></div>
</div>

<style>
  .reader-page {
    filter: brightness(var(--reader-brightness, 100%))
      brightness(var(--reader-invert-brightness, 100%)) invert(var(--reader-invert, 0%))
      sepia(var(--reader-red-shift, 0%)) hue-rotate(-20deg) saturate(120%);
  }
</style>
