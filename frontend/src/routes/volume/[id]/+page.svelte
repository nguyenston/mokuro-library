<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { browser } from '$app/environment';

	// Stores & State
	import { user } from '$lib/authStore';
	import { imageStore } from '$lib/cachedImageStore';
	import { confirmation } from '$lib/confirmationStore';
	import { readerState } from '$lib/states/ReaderState.svelte';
	import { uiState } from '$lib/states/uiState.svelte';

	// Components
	import ReaderSettings from '$lib/components/settings/ReaderSettings.svelte';
	import SinglePageReader from '$lib/components/readers/SinglePageReader.svelte';
	import DoublePageReader from '$lib/components/readers/DoublePageReader.svelte';
	import VerticalReader from '$lib/components/readers/VerticalReader.svelte';
	import LineOrderModal from '$lib/components/LineOrderModal.svelte';
	import ReaderHeader from '$lib/components/ReaderHeader.svelte';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import type { MokuroBlock, MokuroPage } from '$lib/types';

	// --- Props ---
	let { params } = $props<{ params: { id: string } }>();

	// --- UI State (View Specific) ---
	let settingsOpen = $state(false);
	let panzoomInstance = $state<PanzoomObject | null>(null);
	// handle header visibility on mobile
	let headerTimer: ReturnType<typeof setTimeout> | null = null;
	let headerIsVisible = $state(false);

	// --- Initialization ---
	$effect(() => {
		if (params.id) {
			readerState.mount(params.id);
		}
		return () => {
			readerState.cleanup();
			imageStore.clear();
		};
	});

	// Auth Check
	$effect(() => {
		if ($user === null && browser) {
			goto('/login');
		}
	});

	// --- Navigation Guard ---
	beforeNavigate(({ to, cancel }) => {
		if (readerState.hasUnsavedChanges) {
			cancel();
			confirmation.open(
				'Discard Unsaved Changes?',
				'You have unsaved OCR edits. Are you sure you want to discard them?',
				async () => {
					readerState.hasUnsavedChanges = false;
					if (to?.url) goto(to.url);
				},
				'Discard & Exit',
				'Exiting...'
			);
		}
	});

	// --- Event Handlers ---
	const handleKeydown = (e: KeyboardEvent) => {
		if (readerState.layoutMode === 'vertical') return;
		if (e.key === 'ArrowRight') {
			readerState.readingDirection === 'rtl' ? readerState.prevPage() : readerState.nextPage();
		}
		if (e.key === 'ArrowLeft') {
			readerState.readingDirection === 'rtl' ? readerState.nextPage() : readerState.prevPage();
		}
	};

	// Font Slider Helpers
	const focusedBlockFontSize = $derived(readerState.focusedBlock?.font_size ?? 16);
	const sliderMax = $derived(
		readerState.focusedPage
			? Math.floor(
					Math.min(readerState.focusedPage.img_height, readerState.focusedPage.img_width) / 3
				)
			: 100
	);

	const handleFontSizeInput = (e: Event) => {
		if (readerState.focusedBlock) {
			readerState.focusedBlock.font_size = parseFloat((e.target as HTMLInputElement).value);
			readerState.onOcrChange();
		}
	};

	const handleFontSizeWheel = (e: WheelEvent) => {
		if (readerState.focusedBlock) {
			const delta = e.deltaY > 0 ? -1 : 1;
			const newSize = (readerState.focusedBlock.font_size ?? 16) + delta;
			readerState.focusedBlock.font_size = Math.max(newSize, 1);
			readerState.onOcrChange();
		}
	};

	// Reset Panzoom
	$effect(() => {
		readerState.currentPageIndex; // Dependency
		if (panzoomInstance && readerState.layoutMode !== 'vertical') {
			if (readerState.retainZoom) {
				panzoomInstance.pan(0, 0, { animate: true });
			} else {
				panzoomInstance.reset({ animate: true });
			}
		}
	});

	// Touch/Hover Detection
	let hasHover = $state(true);
	onMount(() => {
		if (browser) {
			window.addEventListener('keydown', handleKeydown);
			const mq = window.matchMedia('(hover: none)');
			hasHover = !mq.matches;
			const listener = (e: MediaQueryListEvent) => (hasHover = !e.matches);

			mq.addEventListener('change', listener);

			// Set Context for header
			uiState.setContext('reader', 'Reader', []);

			return () => {
				window.removeEventListener('keydown', handleKeydown);
				mq.removeEventListener('change', listener);
			};
		}
	});

	// Bridge functions
	const onOcrChange = () => readerState.onOcrChange();
	const onLineFocus = (block: MokuroBlock | null, page: MokuroPage | null) =>
		readerState.setFocusedBlock(block, page);
</script>

<svelte:head>
	<title>
		{readerState.volume ? `${readerState.seriesTitle} - ${readerState.volumeTitle}` : 'Loading...'}
	</title>
</svelte:head>

<div class="flex h-screen w-full flex-col bg-gray-800 dark:bg-black overflow-hidden">
	{#if readerState.isLoading}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-white">Loading volume...</p>
		</div>
	{:else if readerState.error}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-red-400">Error: {readerState.error}</p>
		</div>
	{:else if readerState.volume}
		<ReaderHeader bind:settingsOpen />

		<main class="flex flex-1 items-center justify-center overflow-hidden h-full">
			{#if readerState.layoutMode === 'vertical'}
				<VerticalReader
					bind:panzoomInstance
					showTriggerOutline={readerState.showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => readerState.setOcrMode(m)}
				/>
			{:else if readerState.layoutMode === 'double'}
				<DoublePageReader
					bind:panzoomInstance
					navZoneWidth={readerState.navZoneWidth}
					showTriggerOutline={readerState.showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => readerState.setOcrMode(m)}
				/>
			{:else}
				<SinglePageReader
					bind:panzoomInstance
					navZoneWidth={readerState.navZoneWidth}
					showTriggerOutline={readerState.showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => readerState.setOcrMode(m)}
				/>
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
		<LineOrderModal />
	{/if}
</div>
