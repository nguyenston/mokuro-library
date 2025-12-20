<script lang="ts">
	import { browser } from '$app/environment';
	import { persistentImageCache } from '$lib/persistentImageCache';

	/**
	 * Props for the CachedImage component
	 */
	let {
		src,
		eager = false,
		alt = 'Page',
		cover = false
	} = $props<{
		src: string;
		/** Whether to load image eagerly (for above-the-fold content) */
		eager?: boolean;
		/** Alt text for accessibility */
		alt?: string;
		/** Whether this is a cover image (uses persistent cache) */
		cover?: boolean;
	}>();

	let localUrl = $state<string | null>(null);
	let error = $state<string | null>(null);
	let isLoaded = $state(false);
	let isUpdating = $state(false);

	$effect(() => {
		if (!browser) return;

		// For cover images, use persistent cache with background revalidation
		if (cover) {
			persistentImageCache
				.get(src, (newUrl) => {
					// Background update available
					isUpdating = true;
					localUrl = newUrl;
					// Trigger re-render with new image
					setTimeout(() => {
						isUpdating = false;
					}, 300);
				})
				.then((url) => {
					localUrl = url;
				})
				.catch((e) => {
					error = (e as Error).message;
				});
		} else {
			// For regular images, use direct fetch
			fetch(src)
				.then((res) => res.blob())
				.then((blob) => {
					localUrl = URL.createObjectURL(blob);
				})
				.catch((e) => {
					error = (e as Error).message;
				});
		}
	});
</script>

{#if error}
	<div class="flex h-full w-full items-center justify-center bg-gray-900">
		<span class="text-red-500">Error loading image</span>
	</div>
{:else if !localUrl}
	<!-- Skeleton loader for better perceived performance -->
	<div class="flex h-full w-full items-center justify-center bg-gray-900 animate-pulse">
		<div class="h-8 w-8 rounded-full bg-gray-700/50"></div>
	</div>
{:else}
	<img
		src={localUrl}
		{alt}
		loading={eager ? 'eager' : 'lazy'}
		decoding="async"
		class="h-full w-full object-contain transition-opacity duration-300"
		class:opacity-0={!isLoaded}
		class:opacity-100={isLoaded}
		onload={() => isLoaded = true}
		draggable="false"
	/>
{/if}
