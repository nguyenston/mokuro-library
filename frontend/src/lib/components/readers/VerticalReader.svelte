<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { readerState } from '$lib/states/ReaderState.svelte';
	import type { MokuroBlock, MokuroPage } from '$lib/types';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import CachedImage from '$lib/components/CachedImage.svelte';
	import OcrOverlay from '$lib/components/ocr/OcrOverlay.svelte';
	import { panzoom } from '$lib/actions/panzoom';

	let {
		panzoomInstance = $bindable(),
		showTriggerOutline,
		onOcrChange,
		onLineFocus,
		onOcrChangeMode
	} = $props<{
		panzoomInstance: PanzoomObject | null;
		showTriggerOutline: boolean;
		onOcrChange: () => void;
		onLineFocus: (block: MokuroBlock | null, page: MokuroPage | null) => void;
		onOcrChangeMode: (state: 'READ' | 'BOX' | 'TEXT') => void;
	}>();

	let verticalScrollerElement = $state<HTMLElement | null>(null);
	let panzoomWrapper = $state<HTMLElement | null>(null);
	let panzoomElement = $state<HTMLElement | null>(null);

	// Track visibility of every page to skip rendering heavy images/overlays
	let visiblePages = $state<boolean[]>([]);

	// Observers
	let renderObserver: IntersectionObserver | null = null;
	let destroyObserver: IntersectionObserver | null = null;
	let progressObserver: IntersectionObserver | null = null;

	const RENDER_MARGIN = '100px 0px';
	const DESTROY_MARGIN = '500px 0px';

	const setupObservers = async () => {
		if (!panzoomElement || !readerState.mokuroData || !verticalScrollerElement) return;

		// Cleanup old observers
		renderObserver?.disconnect();
		destroyObserver?.disconnect();
		progressObserver?.disconnect();

		// Reset state
		visiblePages = Array(readerState.mokuroData.pages.length).fill(false);

		// Wait for Svelte to render the placeholder divs
		await tick();
		const pageElements = panzoomElement.querySelectorAll('[data-page-index]');

		// 1. Render Observer (Load Content when close)
		renderObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const index = parseInt((entry.target as HTMLElement).dataset.pageIndex!, 10);
						visiblePages[index] = true;
					}
				}
			},
			{ root: verticalScrollerElement, rootMargin: RENDER_MARGIN }
		);

		// 2. Destroy Observer (Unload Content when far)
		destroyObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						const index = parseInt((entry.target as HTMLElement).dataset.pageIndex!, 10);
						visiblePages[index] = false;
					}
				}
			},
			{ root: verticalScrollerElement, rootMargin: DESTROY_MARGIN }
		);

		// 3. Progress Observer (Track active page)
		progressObserver = new IntersectionObserver(
			(entries) => {
				// Find the element with the highest intersection ratio
				let bestEntry = entries[0];
				for (const entry of entries) {
					if (entry.isIntersecting && entry.intersectionRatio > bestEntry.intersectionRatio) {
						bestEntry = entry;
					}
				}
				if (bestEntry && bestEntry.isIntersecting) {
					const index = (bestEntry.target as HTMLElement).dataset.pageIndex;
					if (index) {
						// Update state silently (without triggering navigation animations)
						readerState.setPage(parseInt(index, 10));
					}
				}
			},
			{ root: verticalScrollerElement, threshold: [0.5] }
		);

		pageElements.forEach((el) => {
			renderObserver?.observe(el);
			destroyObserver?.observe(el);
			progressObserver?.observe(el);
		});

		// Initial scroll to saved position
		if (pageElements[readerState.currentPageIndex]) {
			pageElements[readerState.currentPageIndex].scrollIntoView({ block: 'start' });
		}
	};

	onMount(() => {
		setupObservers();
		return () => {
			renderObserver?.disconnect();
			destroyObserver?.disconnect();
			progressObserver?.disconnect();
		};
	});

	// Handle Pinch-to-Zoom (Mobile) & Sync Wrapper Height
	let currentPanzoomScale: number;
	// Effect to initialize currentPanzoomScale
	$effect(() => {
		if (panzoomInstance) currentPanzoomScale = panzoomInstance.getScale();
	});

	const onZoom = (e: CustomEvent) => {
		if (!panzoomInstance || !verticalScrollerElement || !panzoomWrapper || !panzoomElement) return;

		// The library passes the new scale in the event detail
		const newScale = e.detail.scale;

		// offsetHeight returns the unscaled layout height, which is what we want
		const originalHeight = panzoomElement.offsetHeight;
		// Sync the wrapper height to match the new visual scale
		panzoomWrapper.style.height = `${originalHeight * newScale}px`;

		// Calculate scroll adjustment to keep view centered
		const currentScroll = verticalScrollerElement.scrollTop;
		verticalScrollerElement.scrollTop = (currentScroll * newScale) / currentPanzoomScale;

		// cache new scale
		currentPanzoomScale = newScale;
	};

	// Prevent scrolling from being triggered when pinching on mobile
	const onPinch = (event: TouchEvent) => {
		// Check if the user is using two fingers (Pinch)
		if (event.touches.length === 2) {
			// Stop the browser from handling this event (stops the pan-y scroll)
			// allowing Panzoom to handle the pinch instead.
			event.preventDefault();
		}
	};

	// Register the listener specifically for the library's event
	$effect(() => {
		panzoomElement?.addEventListener('panzoomzoom', onZoom as EventListener);
		panzoomWrapper?.addEventListener('touchmove', onPinch as EventListener);

		return () => {
			panzoomElement?.removeEventListener('panzoomzoom', onZoom as EventListener);
			panzoomWrapper?.removeEventListener('touchmove', onPinch as EventListener);
		};
	});

	// Re-run observers if the data changes (e.g. forced refresh)
	$effect(() => {
		if (readerState.mokuroData) {
			setupObservers();
		}
	});

	// Custom Zoom Handler for Vertical Mode
	const handleWheel = (e: WheelEvent) => {
		// Only intercept if Ctrl is pressed (Zoom intent)
		if (!e.ctrlKey) {
			return;
		}

		if (!panzoomInstance || !verticalScrollerElement || !panzoomWrapper || !panzoomElement) return;

		e.preventDefault();
		e.stopPropagation();

		// Zoom Logic
		const scroll = e.deltaY > 0 ? -1 : 1;
		const zoomStep = panzoomInstance.getOptions().step ?? 0.3;
		const scaleAmount = 1 + scroll * zoomStep;
		const currentScale = panzoomInstance.getScale();
		const newScale = Math.max(Math.min(currentScale * scaleAmount, 10), 0.5);

		// Apply changes
		panzoomInstance.zoom(newScale);
	};
</script>

<div
	class="h-full w-full overflow-y-auto bg-transparent"
	bind:this={verticalScrollerElement}
	onwheel={handleWheel}
>
	<div class="w-full" bind:this={panzoomWrapper}>
		<div
			class="relative mx-auto w-full max-w-4xl pt-16 pb-16"
			bind:this={panzoomElement}
			use:panzoom={{
				options: {
					canvas: true,
					maxScale: 10,
					cursor: 'default',
					origin: '50% 0', // Zoom from top-center to prevent jumping
					disableYAxis: true,
					touchAction: 'pan-y'
				},
				onInit: (pz) => (panzoomInstance = pz)
			}}
		>
			{#if readerState.mokuroData}
				{#each readerState.mokuroData.pages as page, i (page.img_path)}
					<div
						class="relative flex-shrink-0 bg-white mb-2 shadow-lg reader-page"
						style={`aspect-ratio: ${page.img_width} / ${page.img_height};`}
						data-page-index={i}
					>
						{#if visiblePages[i]}
							<CachedImage src={`/api/files/volume/${readerState.id}/image/${page.img_path}`} />
							<OcrOverlay
								{page}
								{panzoomInstance}
								ocrMode={readerState.ocrMode}
								isSmartResizeMode={readerState.isSmartResizeMode}
								{showTriggerOutline}
								readingDirection={readerState.readingDirection}
								{onOcrChange}
								{onLineFocus}
								onChangeMode={onOcrChangeMode}
							/>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.reader-page {
		filter: brightness(var(--reader-brightness, 100%))
			brightness(var(--reader-invert-brightness, 100%)) invert(var(--reader-invert, 0%));
	}
</style>
