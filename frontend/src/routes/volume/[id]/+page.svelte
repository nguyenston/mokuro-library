<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { browser } from '$app/environment';

	// Stores & APIs
	import { user, updateSettings, type ReaderSettingsData } from '$lib/authStore';
	import { apiFetch } from '$lib/api';
	import { imageStore } from '$lib/cachedImageStore';
	import { confirmation } from '$lib/confirmationStore';

	// Types & State
	import type { VolumeResponse, MokuroBlock, MokuroPage } from '$lib/types';
	import { ReaderState } from '$lib/states/ReaderState.svelte';

	// Components
	import ReaderSettings from '$lib/components/ReaderSettings.svelte';
	import SinglePageReader from '$lib/components/readers/SinglePageReader.svelte';
	import DoublePageReader from '$lib/components/readers/DoublePageReader.svelte';
	import VerticalReader from '$lib/components/readers/VerticalReader.svelte';
	import type { PanzoomObject } from '@panzoom/panzoom';

	// --- Props ---
	let { params } = $props<{ params: { id: string } }>();

	// --- State Initialization ---
	const reader = new ReaderState();

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let panzoomInstance = $state<PanzoomObject | null>(null);

	// UI State
	let settingsOpen = $state(false);
	let navZoneWidth = $state(15);
	let showTriggerOutline = $state(false);
	let retainZoom = $state(true);

	// OCR Editing State
	let focusedBlock = $state<MokuroBlock | null>(null);
	let focusedPage = $state<MokuroPage | null>(null);

	// Persistence State
	let hasUnsavedChanges = $state(false);
	let isSaving = $state(false);
	let saveSuccess = $state(false);
	let isSavingProgress = $state(false);
	let isSavingSettings = $state(false);

	// Timers
	let progressSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;

	// Initial Reference for change detection
	let initialPageIndex = 0;

	// --- Data Fetching ---
	const fetchVolumeAndProgressData = async (volumeId: string) => {
		isLoading = true;
		error = null;
		try {
			// Parallel fetch for speed
			const [volData, progressData] = await Promise.all([
				apiFetch(`/api/library/volume/${volumeId}`) as Promise<VolumeResponse>,
				apiFetch(`/api/metadata/volume/${volumeId}/progress`)
			]);

			let startPage = 0;
			if (progressData && typeof progressData.page === 'number') {
				startPage = Math.max(0, progressData.page - 1); // DB is 1-based
			}

			initialPageIndex = startPage;
			// [Fixed]: Pass volumeId as 2nd arg
			reader.load(volData, startPage);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	};

	const currentUserId = $derived($user?.id);
	$effect(() => {
		if (currentUserId && params.id) {
			fetchVolumeAndProgressData(params.id);
		}
	});

	// --- Settings Management ---
	let settingsInitialized = false;

	// Load Settings on Mount/User Load
	$effect(() => {
		if ($user && !settingsInitialized) {
			const s = $user.settings;
			reader.layoutMode = s.layoutMode ?? 'double';
			reader.readingDirection = s.readingDirection ?? 'rtl';
			reader.doublePageOffset = s.doublePageOffset ?? 'odd';
			retainZoom = s.retainZoom ?? false;
			navZoneWidth = s.navZoneWidth ?? 15;
			showTriggerOutline = s.showTriggerOutline ?? false;
			settingsInitialized = true;
		}
	});

	// Save Settings when they change (Debounced)
	const saveSettings = async () => {
		if (isSavingSettings || !settingsInitialized) return;
		isSavingSettings = true;

		try {
			const currentSettings: ReaderSettingsData = {
				layoutMode: reader.layoutMode,
				readingDirection: reader.readingDirection,
				doublePageOffset: reader.doublePageOffset,
				retainZoom,
				navZoneWidth,
				showTriggerOutline
			};
			await updateSettings(currentSettings);
		} catch (e) {
			console.error('Failed to save settings', e);
		} finally {
			isSavingSettings = false;
		}
	};

	$effect(() => {
		// Watch relevant dependencies
		// Simply accessing them registers dependency
		const _ = {
			l: reader.layoutMode,
			d: reader.readingDirection,
			o: reader.doublePageOffset,
			z: retainZoom,
			n: navZoneWidth,
			t: showTriggerOutline
		};

		if (!settingsInitialized) return;
		if (settingsSaveTimer) clearTimeout(settingsSaveTimer);

		settingsSaveTimer = setTimeout(() => {
			saveSettings();
		}, 2000);
	});

	// --- Progress Management ---
	const saveProgress = async () => {
		if (isSavingProgress || !reader.mokuroData) return;
		isSavingProgress = true;
		try {
			await apiFetch(`/api/metadata/volume/${params.id}/progress`, {
				method: 'PATCH',
				body: { page: reader.currentPageIndex + 1 } // Save as 1-based
			});
			initialPageIndex = reader.currentPageIndex;
		} catch (e) {
			console.error('Failed to save progress', e);
		} finally {
			isSavingProgress = false;
		}
	};

	// Debounced progress saving
	$effect(() => {
		// Watch page index changes
		if (reader.currentPageIndex !== initialPageIndex) {
			if (progressSaveTimer) clearTimeout(progressSaveTimer);
			progressSaveTimer = setTimeout(() => {
				saveProgress();
			}, 2000);
		}
	});

	// --- Navigation Guard ---
	beforeNavigate(({ to, cancel }) => {
		// 1. Handle Unsaved OCR Changes
		if (hasUnsavedChanges) {
			cancel();
			confirmation.open(
				'Discard Unsaved Changes?',
				'You have unsaved OCR edits. Are you sure you want to discard them?',
				async () => {
					hasUnsavedChanges = false;
					imageStore.clear();
					if (to?.url) goto(to.url);
				},
				'Discard & Exit',
				'Exiting...'
			);
			return;
		}

		// 2. Normal Exit Cleanup
		imageStore.clear(); // Added missing cleanup for happy path

		// 3. Flush pending saves
		if (progressSaveTimer) {
			clearTimeout(progressSaveTimer);
			saveProgress();
		}
		if (settingsSaveTimer) {
			clearTimeout(settingsSaveTimer);
			saveSettings();
		}
	});

	// --- Event Handlers ---

	// Keyboard Navigation
	const handleKeydown = (e: KeyboardEvent) => {
		// Vertical mode uses native scrolling, so we don't hijack arrows
		if (reader.layoutMode === 'vertical') return;

		if (e.key === 'ArrowRight') {
			reader.readingDirection === 'rtl' ? reader.prevPage() : reader.nextPage();
		}
		if (e.key === 'ArrowLeft') {
			reader.readingDirection === 'rtl' ? reader.nextPage() : reader.prevPage();
		}
	};

	// OCR Logic
	const handleSaveOcr = async () => {
		if (!reader.mokuroData || isSaving) return;
		isSaving = true;
		saveSuccess = false;
		error = null;

		try {
			await apiFetch(`/api/library/volume/${params.id}/ocr`, {
				method: 'PUT',
				body: reader.mokuroData.pages
			});
			saveSuccess = true;
			hasUnsavedChanges = false;
			setTimeout(() => (saveSuccess = false), 3000);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isSaving = false;
		}
	};

	// --- Callbacks ---
	const onOcrChange = () => {
		hasUnsavedChanges = true;
	};

	const onLineFocus = (block: MokuroBlock | null, page: MokuroPage | null) => {
		focusedBlock = block;
		focusedPage = page;
	};

	// Font Slider Logic
	const focusedBlockFontSize = $derived(focusedBlock?.font_size ?? 16);
	const sliderMax = $derived(
		focusedPage ? Math.floor(Math.min(focusedPage.img_height, focusedPage.img_width) / 3) : 100
	);

	const handleFontSizeInput = (e: Event) => {
		if (focusedBlock) {
			focusedBlock.font_size = parseFloat((e.target as HTMLInputElement).value);
			onOcrChange();
		}
	};

	const handleFontSizeWheel = (e: WheelEvent) => {
		if (focusedBlock) {
			const delta = e.deltaY > 0 ? -1 : 1;
			const newSize = (focusedBlock.font_size ?? 16) + delta;
			focusedBlock.font_size = Math.max(newSize, 1);
			onOcrChange();
		}
	};

	// Reset Panzoom on page change (if retainZoom is false)
	$effect(() => {
		// Dependency on page index
		reader.currentPageIndex;

		if (panzoomInstance && reader.layoutMode !== 'vertical') {
			if (retainZoom) {
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

			return () => {
				window.removeEventListener('keydown', handleKeydown);
				mq.removeEventListener('change', listener);
			};
		}
	});
</script>

<div class="flex h-screen w-full flex-col bg-gray-800 dark:bg-black overflow-hidden">
	{#if isLoading}
		<!-- Loading State -->
		<div class="flex flex-1 items-center justify-center">
			<p class="text-white">Loading volume...</p>
		</div>
	{:else if error}
		<!-- Error State -->
		<div class="flex flex-1 items-center justify-center">
			<p class="text-red-400">Error: {error}</p>
		</div>
	{:else if reader.volume}
		<!-- Main Reader UI / Header Section -->
		<header
			class="absolute top-0 left-0 right-0 z-20 flex h-16 items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 text-white"
		>
			<!-- Left: Back Button & Title -->
			<div class="flex-1 justify-start overflow-hidden">
				<button
					onclick={() => goto(`/series/${reader.seriesId}`)}
					class="flex-1 truncate whitespace-nowrap pr-2 text-sm hover:text-indigo-400 sm:text-base cursor-pointer"
				>
					&larr; {reader.seriesTitle}
				</button>
			</div>

			<!-- Center: Status / Font Slider -->
			<div class="flex-1 text-center">
				{#if reader.ocrMode === 'TEXT' && focusedBlock}
					<!-- Font Size Slider (Only visible when a block is focused in edit mode) -->
					<div
						class="mx-auto flex w-48 items-center gap-2"
						role="toolbar"
						tabindex="-1"
						onmousedown={(e) => {
							// Prevent drag/selection on the container, but allow it on the input
							if ((e.target as HTMLElement).id !== 'headerFontSizeSlider') {
								e.preventDefault();
							}
						}}
					>
						<label for="headerFontSizeSlider" class="text-sm text-semibold font-medium leading-none"
							>{focusedBlockFontSize.toFixed(0)}</label
						>
						<input
							id="headerFontSizeSlider"
							title="Scroll to adjust font size"
							type="range"
							min="8"
							max={sliderMax}
							step="1"
							value={focusedBlockFontSize}
							aria-valuemin="8"
							aria-valuemax={sliderMax}
							aria-valuenow={focusedBlockFontSize}
							oninput={handleFontSizeInput}
							onwheel={handleFontSizeWheel}
							class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-500/50 accent-indigo-500"
						/>
					</div>
				{:else if isSaving}
					<!-- Saving Indicator -->
					<span class="text-sm bg-gray-900 rounded px-2 py-1 text-blue-300">Saving...</span>
				{:else if saveSuccess}
					<!-- Saved Success Indicator -->
					<span class="text-sm bg-gray-900 rounded px-2 py-1 text-green-300">Saved!</span>
				{/if}
			</div>

			<!-- Right: Tools & Settings -->
			<div class="flex flex-1 justify-end gap-2 items-center">
				<!-- Page Counter -->
				<span
					class="flex flex-row items-center justify-center text-sm font-medium font-semibold text-gray-300"
				>
					<span class="inline md:hidden mr-1">
						{reader.currentPageIndex + 1}{reader.visiblePages.length === 2
							? `-${reader.currentPageIndex + 2}`
							: ''}
					</span>
					<span class="hidden md:inline mr-1">
						{reader.currentPageIndex + 1}{reader.visiblePages.length === 2
							? `-${reader.currentPageIndex + 2}`
							: ''}
						/
						{reader.totalPages}
					</span>
				</span>

				<!-- Manual Save Button -->
				{#if hasUnsavedChanges}
					<button
						onclick={handleSaveOcr}
						disabled={isSaving}
						class="text-gray-400 hover:text-white disabled:opacity-50 cursor-pointer p-1"
						title="Save OCR"
					>
						<svg
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
							/></svg
						>
					</button>
				{/if}

				<!-- Toggle Smart Resize Mode -->
				<button
					onclick={() => reader.toggleSmartResizeMode()}
					class="flex justify-center items-center rounded p-1 transition-colors aspect-square w-8 cursor-pointer"
					class:bg-amber-300={reader.isSmartResizeMode}
					class:hover:bg-gray-700={!reader.isSmartResizeMode}
					class:text-gray-800={reader.isSmartResizeMode}
					class:text-gray-400={!reader.isSmartResizeMode}
					title="Smart Resize Mode"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256"
						><path
							fill="currentColor"
							d="M208 144a15.78 15.78 0 0 1-10.42 14.94l-51.65 19l-19 51.61a15.92 15.92 0 0 1-29.88 0L78 178l-51.62-19a15.92 15.92 0 0 1 0-29.88l51.65-19l19-51.61a15.92 15.92 0 0 1 29.88 0l19 51.65l51.61 19A15.78 15.78 0 0 1 208 144Zm-56-96h16v16a8 8 0 0 0 16 0V48h16a8 8 0 0 0 0-16h-16V16a8 8 0 0 0-16 0v16h-16a8 8 0 0 0 0 16Zm88 32h-8v-8a8 8 0 0 0-16 0v8h-8a8 8 0 0 0 0 16h8v8a8 8 0 0 0 16 0v-8h8a8 8 0 0 0 0-16Z"
						/></svg
					>
				</button>

				<!-- Toggle Edit Mode -->
				<button
					onclick={() => {
						reader.ocrMode = reader.ocrMode === 'BOX' ? 'READ' : 'BOX';
						focusedBlock = null;
					}}
					class="flex justify-center items-center rounded p-1 transition-colors aspect-square w-8 cursor-pointer"
					class:bg-indigo-600={reader.ocrMode !== 'READ'}
					class:hover:bg-gray-700={reader.ocrMode === 'READ'}
					class:text-white={reader.ocrMode !== 'READ'}
					class:text-gray-400={reader.ocrMode === 'READ'}
					title={hasHover ? 'Box Edit Mode' : 'Disabled for non-mouse devices'}
				>
					{#if reader.ocrMode === 'BOX'}
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M23 15h-2v2h2v-2zm0-4h-2v2h2v-2zm0 8h-2v2c1 0 2-1 2-2zM15 3h-2v2h2V3zm8 4h-2v2h2V7zm-2-4v2h2c0-1-1-2-2-2zM3 21h8v-6H1v4c0 1.1.9 2 2 2zM3 7H1v2h2V7zm12 12h-2v2h2v-2zm4-16h-2v2h2V3zm0 16h-2v2h2v-2zM3 3C2 3 1 4 1 5h2V3zm0 8H1v2h2v-2zm8-8H9v2h2V3zM7 3H5v2h2V3z"
							/>
						</svg>
					{:else if reader.ocrMode === 'TEXT'}
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
							<path fill="currentColor" d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M3 17.46v3.04c0 .28.22.5.5.5h3.04c.13 0 .26-.05.35-.15L17.81 9.94l-3.75-3.75L3.15 17.1c-.1.1-.15.22-.15.36zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83l3.75 3.75l1.83-1.83z"
							/>
						</svg>
					{/if}
				</button>

				<!-- Open Settings Button -->
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

		<!-- Main Reader Viewport -->
		<main class="flex flex-1 items-center justify-center overflow-hidden h-full">
			{#if reader.layoutMode === 'vertical'}
				<!-- Render Vertical Layout -->
				<VerticalReader
					{reader}
					bind:panzoomInstance
					{showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => reader.setOcrMode(m)}
				/>
			{:else if reader.layoutMode === 'double'}
				<!-- Render Double Page Layout -->
				<DoublePageReader
					{reader}
					bind:panzoomInstance
					{navZoneWidth}
					{showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => reader.setOcrMode(m)}
				/>
			{:else}
				<!-- Render Single Page Layout -->
				<SinglePageReader
					{reader}
					bind:panzoomInstance
					{navZoneWidth}
					{showTriggerOutline}
					{onOcrChange}
					{onLineFocus}
					onOcrChangeMode={(m) => reader.setOcrMode(m)}
				/>
			{/if}
		</main>

		<!-- Settings Overlay Modal -->
		<ReaderSettings
			bind:isOpen={settingsOpen}
			layoutMode={reader.layoutMode}
			readingDirection={reader.readingDirection}
			doublePageOffset={reader.doublePageOffset}
			{retainZoom}
			currentPageIndex={reader.currentPageIndex}
			totalPages={reader.totalPages}
			currentPages={reader.visiblePages}
			{navZoneWidth}
			volumeTitle={reader.volumeTitle}
			onSetLayout={(m) => reader.setLayout(m)}
			onToggleDirection={() =>
				(reader.readingDirection = reader.readingDirection === 'rtl' ? 'ltr' : 'rtl')}
			onToggleOffset={() => reader.toggleOffset()}
			onToggleZoom={() => (retainZoom = !retainZoom)}
			onNavZoneChange={(e) => (navZoneWidth = +(e.target as HTMLInputElement).value)}
			{showTriggerOutline}
			onToggleTriggerOutline={() => (showTriggerOutline = !showTriggerOutline)}
		/>
	{/if}
</div>
