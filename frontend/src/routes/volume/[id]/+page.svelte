<script lang="ts">
	import { user, updateSettings, type ReaderSettingsData } from '$lib/authStore';
	import { apiFetch } from '$lib/api';
	import { browser } from '$app/environment';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import type { VolumeResponse, MokuroData, MokuroPage, MokuroBlock } from '$lib/types';
	import ReaderSettings from '$lib/components/ReaderSettings.svelte';
	import OcrOverlay from '$lib/components/OcrOverlay.svelte';

	// --- SvelteKit Props ---
	let { params } = $props<{ params: { id: string } }>();

	// --- Component State ---
	let volumeResponse = $state<VolumeResponse | null>(null);
	let currentPageIndex = $state(0);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// --- Reader settings state ---
	let settingsOpen = $state(false);
	let settingsInitialized = $state(false);
	let layoutMode = $state<'single' | 'double'>('single');
	let readingDirection = $state<'ltr' | 'rtl'>('rtl'); // Default 'rtl' for manga
	let doublePageOffset = $state<'even' | 'odd'>('odd'); // Default 'odd' (starts on page 1)
	let retainZoom = $state(true);
	let navZoneWidth = $state(15);
	let saveTimer: ReturnType<typeof setTimeout>;

	// --- OCR settings state ---
	let isEditMode = $state(false); // Controls visibility of lines_coords
	let showTriggerOutline = $state(false); // Controls visibility of the main block.box
	let isBoxEditMode = $state(false);

	// --- OCR save states
	let isSaving = $state(false);
	let saveSuccess = $state(false);
	let hasUnsavedChanges = $state(false);

	// --- States for DOM elements and the panzoom instance ---
	let mainElement = $state<HTMLElement | null>(null);
	let panzoomElement = $state<HTMLDivElement | null>(null);
	let panzoomInstance = $state<PanzoomObject | null>(null);

	// --- Data Fetching Effects ---
	// This effect fetches volume data on load
	const currentUserId = $derived($user?.id);
	$effect(() => {
		if (currentUserId && params.id) {
			volumeResponse = null;
			currentPageIndex = 0;
			isLoading = true;
			fetchVolumeData(params.id);
		}
	});

	// This effiect initializes settings when the user loads
	$effect(() => {
		if ($user && !settingsInitialized) {
			const saved = $user.settings;

			// Set local state from the store, using defaults
			layoutMode = saved.layoutMode ?? 'double';
			readingDirection = saved.readingDirection ?? 'rtl';
			doublePageOffset = saved.doublePageOffset ?? 'odd';
			retainZoom = saved.retainZoom ?? false;
			navZoneWidth = saved.navZoneWidth ?? 10;
			showTriggerOutline = saved.showTriggerOutline ?? false;

			// Mark as initialized
			settingsInitialized = true;
		}
	});

	// This effect watches all local settings and saves them
	$effect(() => {
		// 1. Bundle up all current settings
		const currentSettings: ReaderSettingsData = {
			layoutMode,
			readingDirection,
			doublePageOffset,
			retainZoom,
			navZoneWidth,
			showTriggerOutline
		};

		// 2. Don't save on the first load
		if (!settingsInitialized) return;

		// 3. Debounce the save
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			// 4. Call the store's update function
			updateSettings(currentSettings);
		}, 2000); // 2-second delay
	});

	const fetchVolumeData = async (volumeId: string) => {
		try {
			const data = await apiFetch(`/api/library/volume/${volumeId}`);
			volumeResponse = data as VolumeResponse;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	};

	// --- Save Handler ---
	const handleSave = async () => {
		if (!mokuroData || isSaving) return;

		isSaving = true;
		saveSuccess = false;
		error = null;

		try {
			await apiFetch(`/api/library/volume/${params.id}/ocr`, {
				method: 'PUT',
				body: mokuroData.pages // Send the entire modified pages array
			});
			saveSuccess = true;
			hasUnsavedChanges = false;
			// Hide success message after 3 seconds
			setTimeout(() => (saveSuccess = false), 3000);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isSaving = false;
		}
	};

	// --- Derived State ---

	// This rune is fine, it only depends on base state
	const totalPages = $derived(volumeResponse?.mokuroData.pages.length ?? 0);
	const mokuroData = $derived(volumeResponse?.mokuroData);

	// This rune calculates the page(s) to display in the current view
	const currentPages = $derived.by(() => {
		if (!mokuroData) return []; // Return empty array if no data

		let page1Index = currentPageIndex;
		let page1 = mokuroData.pages[page1Index];
		if (!page1) return []; // No page, return empty array

		// --- Single Page Mode ---
		if (layoutMode === 'single') {
			return [page1]; // Return just the one page
		}

		// --- Dual Page Mode ---
		const hasOddOffset = doublePageOffset === 'odd';

		// Case 1: We are on the cover page (index 0) and have an odd offset
		if (hasOddOffset && page1Index === 0) {
			return [page1]; // Return just the cover
		}

		const page2Index = page1Index + 1;
		const page2 = mokuroData.pages[page2Index];

		if (!page2) {
			return [page1]; // No second page (e.g., last page), return just one
		}

		// We have two pages, return them in reading order
		if (readingDirection === 'rtl') {
			return [page2, page1]; // [Right Page, Left Page]
		} else {
			return [page1, page2]; // [Left Page, Right Page]
		}
	});

	// --- Event Handlers ---
	const syncDoublePageOffset = () => {
		const hasOddOffset = doublePageOffset === 'odd';
		const pageIsEven = currentPageIndex % 2 === 0;
		if (layoutMode === 'single') return;
		if (currentPageIndex === 0) return;
		// Not perfect, can cause page drift if repeatedly toggle even-odd
		if (hasOddOffset === pageIsEven) currentPageIndex -= 1;
	};

	const toggleDoubleLayout = () => {
		layoutMode = layoutMode === 'single' ? 'double' : 'single';
		syncDoublePageOffset();
	};

	const toggleEvenOddOffset = () => {
		doublePageOffset = doublePageOffset === 'odd' ? 'even' : 'odd';
		syncDoublePageOffset();
	};

	const toggleReadingDirection = () => {
		readingDirection = readingDirection === 'rtl' ? 'ltr' : 'rtl';
	};

	const toggleRetainZoom = () => {
		retainZoom = !retainZoom;
	};

	const handleNavZoneChange = (e: Event) => {
		// We get the value from the slider and convert it to a number
		navZoneWidth = +(e.target as HTMLInputElement).value;
	};

	const toggleEditMode = () => {
		isEditMode = !isEditMode;
	};

	const toggleBoxEditMode = () => {
		isBoxEditMode = !isBoxEditMode;
	};

	const toggleTriggerOutline = () => {
		showTriggerOutline = !showTriggerOutline;
	};

	// Callback for OcrOverlay
	const onOcrChange = () => {
		hasUnsavedChanges = true;
	};

	const nextPage = () => {
		if (currentPageIndex >= totalPages - 1) return; // At end

		if (layoutMode === 'single') {
			currentPageIndex += 1;
			return;
		}
		// Dual Page
		const hasOddOffset = doublePageOffset === 'odd';
		let jump = 2;

		// If we're on the solo cover (index 0), the first jump is only 1
		if (hasOddOffset && currentPageIndex === 0) {
			jump = 1;
		}

		currentPageIndex = Math.min(totalPages - 1, currentPageIndex + jump);
	};

	const prevPage = () => {
		if (currentPageIndex === 0) return; // At start

		if (layoutMode === 'single') {
			currentPageIndex -= 1;
			return;
		}
		// Dual Page
		const hasOddOffset = doublePageOffset === 'odd';
		let jump = 2;

		// If we're on the first spread (index 1), jump back 1 to the cover
		if (hasOddOffset && currentPageIndex === 1) {
			jump = 1;
		}

		currentPageIndex = Math.max(0, currentPageIndex - jump);
	};

	// --- Panzoom Effects ---

	// initialize panzoom
	$effect(() => {
		if (mainElement && panzoomElement && browser) {
			let pz: PanzoomObject;

			// 1. --- Define handlers in the outer scope ---
			const onWheel = (e: WheelEvent) => {
				e.preventDefault();
				pz?.zoomWithWheel(e); // Use pz?. for safety
			};
			// --- End of handler definitions ---

			const initPanzoom = async () => {
				const PanzoomModule = await import('@panzoom/panzoom');
				const Panzoom = PanzoomModule.default;

				if (!panzoomElement) return;
				pz = Panzoom(panzoomElement, {
					canvas: true,
					maxScale: 10,
					cursor: 'default'
				});
				panzoomInstance = pz;

				// 2. --- Bind the handlers ---
				mainElement?.addEventListener('wheel', onWheel);
			};

			initPanzoom();

			// 3. --- The cleanup function can now see the handlers ---
			return () => {
				mainElement?.removeEventListener('wheel', onWheel);
				if (panzoomInstance) {
					panzoomInstance.destroy();
					panzoomInstance = null;
				}
			};
		}
	});

	// Effect to lock/unlock panzoom based on Box Edit Mode
	$effect(() => {
		if (panzoomInstance) {
			if (isBoxEditMode) {
				// Lock the viewport
				panzoomInstance.reset(); // Reset to known state
				panzoomInstance.setOptions({
					disablePan: true,
					disableZoom: true,
					cursor: 'auto' // Use default cursor, not 'move'
				});
			} else {
				// Unlock the viewport
				panzoomInstance.setOptions({
					disablePan: false,
					disableZoom: false,
					cursor: 'default' // Back to default panzoom cursor
				});
			}
		}
	});

	// Effect to reset panzoom when page changes
	$effect(() => {
		if (panzoomInstance) {
			if (retainZoom) {
				// Retain zoom, but reset pan to the center
				panzoomInstance.pan(0, 0, { animate: true });
			} else {
				// Reset both pan and zoom
				panzoomInstance.reset({ animate: true });
			}
		}
		currentPageIndex;
	});

	// Keyboard navigation
	$effect(() => {
		if (!browser) return; // Only run in browser

		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'ArrowRight') {
				// If RTL, ArrowRight goes "back" (prev)
				readingDirection === 'rtl' ? prevPage() : nextPage();
			}
			if (e.key === 'ArrowLeft') {
				// If RTL, ArrowLeft goes "forward" (next)
				readingDirection === 'rtl' ? nextPage() : prevPage();
			}
		};

		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div class="flex h-screen w-full flex-col bg-gray-800 dark:bg-black">
	{#if isLoading}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-white">Loading volume...</p>
		</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-red-400">Error: {error}</p>
		</div>
	{:else if mokuroData}
		<header
			class="absolute top-0 left-0 right-0 z-20 flex h-16 items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 text-white"
		>
			<a
				href={`/series/${volumeResponse?.seriesId}`}
				class="flex-1 truncate whitespace-nowrap pr-2 text-sm hover:text-indigo-400 sm:text-base"
			>
				&larr; {mokuroData.title}
			</a>

			<div class="flex-1 text-center">
				{#if isSaving}
					<span class="text-sm text-blue-300">Saving...</span>
				{:else if saveSuccess}
					<span class="text-sm text-green-300">Saved!</span>
				{/if}
			</div>

			<div class="flex flex-1 justify-end gap-4">
				{#if hasUnsavedChanges}
					<button
						onclick={handleSave}
						disabled={isSaving}
						type="button"
						class="text-gray-400 hover:text-white disabled:opacity-50"
						aria-label="Save OCR Edits"
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
					onclick={() => (settingsOpen = true)}
					type="button"
					class="text-gray-400 hover:text-white"
					aria-label="Open settings"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</button>
			</div>
		</header>

		<main class="flex flex-1 items-center justify-center overflow-hidden" bind:this={mainElement}>
			<button
				onclick={readingDirection === 'rtl' ? nextPage : prevPage}
				type="button"
				class="panzoom-exclude absolute left-0 z-10 h-full hover:cursor-pointer"
				aria-label="Previous Page"
				style={`width: ${navZoneWidth}%`}
			></button>

			<div
				class="relative flex h-full flex-1 items-center justify-center"
				bind:this={panzoomElement}
			>
				{#each currentPages as page (page.img_path)}
					<div
						class="relative flex-shrink-0"
						style={`aspect-ratio: ${page.img_width} / ${page.img_height}; max-height: 100%; max-width: 100%;`}
					>
						<img
							src={`/api/files/volume/${params.id}/image/${page.img_path}`}
							alt={`Page ${page.img_path}`}
							class="h-full w-full object-contain"
							draggable="false"
						/>
						<OcrOverlay {page} {isEditMode} {isBoxEditMode} {showTriggerOutline} {onOcrChange} />
					</div>
				{/each}
			</div>

			<button
				onclick={readingDirection === 'rtl' ? prevPage : nextPage}
				type="button"
				class="panzoom-exclude absolute right-0 z-10 h-full hover:cursor-pointer"
				aria-label="Next Page"
				style={`width: ${navZoneWidth}%`}
			></button>
		</main>
	{:else}
		<div class="flex h-screen items-center justify-center">
			<p class="text-gray-700 dark:text-gray-300">Redirecting to login...</p>
		</div>
	{/if}
	<ReaderSettings
		bind:isOpen={settingsOpen}
		{layoutMode}
		{readingDirection}
		{doublePageOffset}
		{retainZoom}
		{currentPageIndex}
		{totalPages}
		{currentPages}
		{navZoneWidth}
		volumeTitle={mokuroData?.volume ?? ''}
		onToggleLayout={toggleDoubleLayout}
		onToggleDirection={toggleReadingDirection}
		onToggleOffset={toggleEvenOddOffset}
		onToggleZoom={toggleRetainZoom}
		onNavZoneChange={handleNavZoneChange}
		{isEditMode}
		{isBoxEditMode}
		{showTriggerOutline}
		onToggleEditMode={toggleEditMode}
		onToggleBoxEditMode={toggleBoxEditMode}
		onToggleTriggerOutline={toggleTriggerOutline}
	/>
</div>
