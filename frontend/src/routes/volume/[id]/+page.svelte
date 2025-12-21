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
	import ReaderSettings from '$lib/components/ReaderSettings.svelte';
	import SinglePageReader from '$lib/components/readers/SinglePageReader.svelte';
	import DoublePageReader from '$lib/components/readers/DoublePageReader.svelte';
	import VerticalReader from '$lib/components/readers/VerticalReader.svelte';
	import LineOrderModal from '$lib/components/LineOrderModal.svelte';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import type { MokuroBlock, MokuroPage } from '$lib/types';

	// --- Props ---
	let { params } = $props<{ params: { id: string } }>();

	// --- UI State (View Specific) ---
	let settingsOpen = $state(false);
	let panzoomInstance = $state<PanzoomObject | null>(null);

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
		<header
			class="absolute top-0 left-0 right-0 z-20 flex h-16 items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 text-white touch-none"
		>
			<div class="flex-1 justify-start overflow-hidden">
				<button
					onclick={() => goto(`/series/${readerState.seriesId}`)}
					class="flex-1 truncate whitespace-nowrap pr-2 text-sm hover:text-indigo-400 sm:text-base cursor-pointer"
				>
					&larr; {readerState.seriesTitle}
				</button>
			</div>

			<div class="flex-1 text-center">
				{#if readerState.ocrMode === 'TEXT' && readerState.focusedBlock}
					<div
						class="mx-auto flex w-48 items-center gap-2"
						role="toolbar"
						tabindex="-1"
						onmousedown={(e) => {
							if ((e.target as HTMLElement).id !== 'headerFontSizeSlider') e.preventDefault();
						}}
					>
						<label
							for="headerFontSizeSlider"
							class="text-sm text-semibold font-medium leading-none"
						>
							{focusedBlockFontSize.toFixed(0)}
						</label>
						<input
							id="headerFontSizeSlider"
							type="range"
							min="8"
							max={sliderMax}
							step="1"
							value={focusedBlockFontSize}
							oninput={handleFontSizeInput}
							onwheel={handleFontSizeWheel}
							class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-500/50 accent-indigo-500"
						/>
					</div>
				{:else if readerState.isSaving}
					<span class="text-sm bg-gray-900 rounded px-2 py-1 text-blue-300">Saving...</span>
				{:else if readerState.saveSuccess}
					<span class="text-sm bg-gray-900 rounded px-2 py-1 text-green-300">Saved!</span>
				{/if}
			</div>

			<div class="flex flex-1 justify-end gap-2 items-center">
				<span
					class="flex flex-row items-center justify-center text-sm font-medium font-semibold text-gray-300"
				>
					<span class="mr-1">
						{readerState.currentPageIndex + 1}
						{readerState.visiblePages.length === 2 ? `-${readerState.currentPageIndex + 2}` : ''}
						<span class="hidden md:inline"> / {readerState.totalPages}</span>
					</span>
				</span>

				{#if readerState.hasUnsavedChanges}
					<button
						onclick={() => readerState.saveOcr()}
						disabled={readerState.isSaving}
						class="text-gray-400 hover:text-white disabled:opacity-50 cursor-pointer p-1"
						title="Save OCR"
					>
						<svg
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
							/>
						</svg>
					</button>
				{/if}

				<button
					onclick={() => readerState.toggleSmartResizeMode()}
					class="flex justify-center items-center rounded p-1 transition-colors aspect-square w-8 cursor-pointer"
					class:bg-amber-300={readerState.isSmartResizeMode}
					class:hover:bg-gray-700={!readerState.isSmartResizeMode}
					class:text-gray-800={readerState.isSmartResizeMode}
					class:text-gray-400={!readerState.isSmartResizeMode}
					title="Smart Resize Mode"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256">
						<path
							fill="currentColor"
							d="M208 144a15.78 15.78 0 0 1-10.42 14.94l-51.65 19l-19 51.61a15.92 15.92 0 0 1-29.88 0L78 178l-51.62-19a15.92 15.92 0 0 1 0-29.88l51.65-19l19-51.61a15.92 15.92 0 0 1 29.88 0l19 51.65l51.61 19A15.78 15.78 0 0 1 208 144Zm-56-96h16v16a8 8 0 0 0 16 0V48h16a8 8 0 0 0 0-16h-16V16a8 8 0 0 0-16 0v16h-16a8 8 0 0 0 0 16Zm88 32h-8v-8a8 8 0 0 0-16 0v8h-8a8 8 0 0 0 0 16h8v8a8 8 0 0 0 16 0v-8h8a8 8 0 0 0 0-16Z"
						/>
					</svg>
				</button>

				<button
					onclick={() => readerState.setOcrMode(readerState.ocrMode === 'BOX' ? 'READ' : 'BOX')}
					class="flex justify-center items-center rounded p-1 transition-colors aspect-square w-8 cursor-pointer"
					class:bg-indigo-600={readerState.ocrMode !== 'READ'}
					class:hover:bg-gray-700={readerState.ocrMode === 'READ'}
					class:text-white={readerState.ocrMode !== 'READ'}
					class:text-gray-400={readerState.ocrMode === 'READ'}
					title={hasHover ? 'Box Edit Mode' : 'Disabled for non-mouse devices'}
				>
					{#if readerState.ocrMode === 'BOX'}
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M23 15h-2v2h2v-2zm0-4h-2v2h2v-2zm0 8h-2v2c1 0 2-1 2-2zM15 3h-2v2h2V3zm8 4h-2v2h2V7zm-2-4v2h2c0-1-1-2-2-2zM3 21h8v-6H1v4c0 1.1.9 2 2 2zM3 7H1v2h2V7zm12 12h-2v2h2v-2zm4-16h-2v2h2V3zm0 16h-2v2h2v-2zM3 3C2 3 1 4 1 5h2V3zm0 8H1v2h2v-2zm8-8H9v2h2V3zM7 3H5v2h2V3z"
							/></svg
						>
					{:else if readerState.ocrMode === 'TEXT'}
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"
							/></svg
						>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M3 17.46v3.04c0 .28.22.5.5.5h3.04c.13 0 .26-.05.35-.15L17.81 9.94l-3.75-3.75L3.15 17.1c-.1.1-.15.22-.15.36zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83l3.75 3.75l1.83-1.83z"
							/></svg
						>
					{/if}
				</button>

				<button
					onclick={() => (settingsOpen = true)}
					class="text-gray-400 hover:text-white cursor-pointer p-1"
					title="Settings"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/></svg
					>
				</button>
			</div>
		</header>

		<main class="flex flex-1 items-center justify-center overflow-hidden h-full">
			{#if readerState.layoutMode === 'vertical'}
				<VerticalReader
					reader={readerState}
					bind:panzoomInstance
					showTriggerOutline={readerState.showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => readerState.setOcrMode(m)}
				/>
			{:else if readerState.layoutMode === 'double'}
				<DoublePageReader
					reader={readerState}
					bind:panzoomInstance
					navZoneWidth={readerState.navZoneWidth}
					showTriggerOutline={readerState.showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => readerState.setOcrMode(m)}
				/>
			{:else}
				<SinglePageReader
					reader={readerState}
					bind:panzoomInstance
					navZoneWidth={readerState.navZoneWidth}
					showTriggerOutline={readerState.showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => readerState.setOcrMode(m)}
				/>
			{/if}
		</main>

		<ReaderSettings
			bind:isOpen={settingsOpen}
			layoutMode={readerState.layoutMode}
			readingDirection={readerState.readingDirection}
			doublePageOffset={readerState.doublePageOffset}
			retainZoom={readerState.retainZoom}
			currentPageIndex={readerState.currentPageIndex}
			totalPages={readerState.totalPages}
			currentPages={readerState.visiblePages}
			navZoneWidth={readerState.navZoneWidth}
			volumeTitle={readerState.volumeTitle}
			showTriggerOutline={readerState.showTriggerOutline}
			onSetLayout={(m) => readerState.setLayout(m)}
			onToggleDirection={() =>
				(readerState.readingDirection = readerState.readingDirection === 'rtl' ? 'ltr' : 'rtl')}
			onToggleOffset={() => readerState.toggleOffset()}
			onToggleZoom={() => (readerState.retainZoom = !readerState.retainZoom)}
			onNavZoneChange={(e) => (readerState.navZoneWidth = +(e.target as HTMLInputElement).value)}
			onToggleTriggerOutline={() =>
				(readerState.showTriggerOutline = !readerState.showTriggerOutline)}
		/>
		<LineOrderModal />
	{/if}
</div>
