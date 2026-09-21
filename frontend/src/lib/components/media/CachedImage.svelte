<script lang="ts">
  import { browser } from '$app/environment';
  import { imageStore, optimizeSrc } from '$lib/stores/cachedImageStore';

  let { src } = $props<{ src: string }>();

  let localUrl = $state<string | null>(null);
  let error = $state<string | null>(null);
  let optimizedSrc = $derived.by(() => optimizeSrc(src, browser));

  $effect(() => {
    if (!browser) return;

    // Call the store's 'get' method.
    // This handles all caching and deduplication.
    imageStore
      .get(optimizedSrc)
      .then((url) => {
        localUrl = url;
      })
      .catch((e) => {
        error = (e as Error).message;
      });
  });
</script>

{#if error}
  <div class="flex h-full w-full items-center justify-center bg-gray-900">
    <span class="text-red-500">Error loading image</span>
  </div>
{:else if !localUrl}
  <div class="flex h-full w-full items-center justify-center bg-gray-900">
    <span class="text-gray-500">Loading...</span>
  </div>
{:else}
  <img src={localUrl} alt="Page" class="h-full w-full object-contain" draggable="false" />
{/if}
