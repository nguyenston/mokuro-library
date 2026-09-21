<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { readerState } from '$lib/states/reader/ReaderState.svelte.ts';

  // Components
  import SubmissionReaderHeader from '../layout/SubmissionReaderHeader.svelte';
  import ReaderSettings from '$lib/components/settings/ReaderSettings.svelte';
  import SinglePageReader from '$lib/components/readers/SinglePageReader.svelte';
  import DoublePageReader from '$lib/components/readers/DoublePageReader.svelte';
  import VerticalReader from '$lib/components/readers/VerticalReader.svelte';
  import type { PanzoomObject } from '@panzoom/panzoom';
  // No local types required in preview mode

  let { volumeId, close } = $props<{ volumeId: string; close: () => void }>();

  let settingsOpen = $state(false);
  let panzoomInstance = $state<PanzoomObject | null>(null);

  onMount(async () => {
    await readerState.mount(volumeId, { isPreview: true });
  });

  onDestroy(async () => {
    await readerState.cleanup();
  });

  // Reset Panzoom on page change
  $effect(() => {
    void readerState.currentPageIndex; // Dependency
    if (panzoomInstance && readerState.layoutMode !== 'vertical') {
      if (readerState.retainZoom) {
        panzoomInstance.pan(0, 0, { animate: true });
      } else {
        panzoomInstance.reset({ animate: true });
      }
    }
  });

  // In preview mode we don't need OCR event handlers.
</script>

<div
  class="fixed inset-0 bg-gray-900/70 backdrop-blur-sm z-50 flex flex-col"
  role="dialog"
  aria-modal="true"
>
  <div class="relative flex h-full w-full flex-col bg-gray-800 dark:bg-black overflow-hidden">
    {#if readerState.isLoading}
      <div class="flex flex-1 items-center justify-center">
        <div class="w-full max-w-3xl px-6 py-10 animate-pulse space-y-4">
          <div class="h-4 w-32 rounded-full bg-white/20"></div>
          <div class="h-[60vh] rounded-2xl border border-white/10 bg-white/5"></div>
        </div>
      </div>
    {:else if readerState.error}
      <div class="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <p class="text-red-400 font-semibold">Error loading preview</p>
          <p class="text-sm text-white/60 mt-2">{readerState.error}</p>
          <button onclick={close} class="mt-4 px-4 py-2 bg-red-500/20 text-red-300 rounded-md"
            >Close</button
          >
        </div>
      </div>
    {:else if readerState.volume}
      <!-- Use the new, simplified header for the preview -->
      <SubmissionReaderHeader bind:settingsOpen on_close={close} />

      <main class="flex flex-1 items-center justify-center overflow-hidden h-full">
        {#if readerState.layoutMode === 'vertical'}
          <VerticalReader bind:panzoomInstance />
        {:else if readerState.layoutMode === 'double'}
          <DoublePageReader bind:panzoomInstance navZoneWidth={readerState.navZoneWidth} />
        {:else}
          <SinglePageReader bind:panzoomInstance navZoneWidth={readerState.navZoneWidth} />
        {/if}
      </main>

      {#if settingsOpen}
        <button
          onclick={() => (settingsOpen = false)}
          type="button"
          class="fixed inset-0 z-[60] h-full w-full cursor-auto bg-black/60 backdrop-blur-sm"
          aria-label="Close settings"
        ></button>

        <div
          class="fixed right-0 top-0 z-[70] h-full"
          onclick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <ReaderSettings onClose={() => (settingsOpen = false)} inReader={true} />
        </div>
      {/if}
    {/if}
  </div>
</div>
