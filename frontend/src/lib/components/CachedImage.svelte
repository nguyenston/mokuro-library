<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';

	let { src } = $props<{ src: string }>();

	let localUrl = $state<string | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		let isMounted = true;
		if (!browser) return;

		const loadImage = async () => {
			try {
				const cache = await caches.open('mokuro-images');
				let response = await cache.match(src);

				if (!response) {
					response = await fetch(src);
					if (!response.ok) throw new Error(`Failed to fetch ${src}`);
					await cache.put(src, response.clone());
				}

				const blob = await response.blob();
				if (isMounted) {
					localUrl = URL.createObjectURL(blob);
				}
			} catch (e) {
				if (isMounted) {
					error = (e as Error).message;
				}
				console.error('Failed to load image:', e);
			}
		};

		loadImage();

		return () => {
			isMounted = false;
		};
	});

	// Clean up the blob URL when the component is destroyed
	onDestroy(() => {
		if (localUrl) {
			URL.revokeObjectURL(localUrl);
		}
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
	<img {src} alt="Page" class="h-full w-full object-contain" draggable="false" />
{/if}
