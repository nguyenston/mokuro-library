<script lang="ts">
	import { user, updateSettings, type ReaderSettingsData } from '$lib/authStore';
	import { apiFetch } from '$lib/api';
	import { browser } from '$app/environment';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import type { VolumeResponse, MokuroData, MokuroPage, MokuroBlock } from '$lib/types';
	import ReaderSettings from '$lib/components/ReaderSettings.svelte';
	import OcrOverlay from '$lib/components/OcrOverlay.svelte';
	import CachedImage from '$lib/components/CachedImage.svelte';
	import { goto, beforeNavigate, afterNavigate } from '$app/navigation';
	import { confirmation } from '$lib/confirmationStore';
	import { tick, onMount } from 'svelte';

	// --- SvelteKit Props ---
	let { params } = $props<{ params: { id: string } }>(); // volumeId

	// --- State to track hover capability ---
	let hasHover = $state(true); // Default to true

	// --- Component State ---
	let volumeResponse = $state<VolumeResponse | null>(null);
	let currentPageIndex = $state(0);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// --- Reader settings state ---
	let settingsOpen = $state(false);
	let settingsInitialized = $state(false);
	let layoutMode = $state<'single' | 'double' | 'vertical'>('single');
	let readingDirection = $state<'ltr' | 'rtl'>('rtl'); // Default 'rtl' for manga
	let doublePageOffset = $state<'even' | 'odd'>('odd'); // Default 'odd' (starts on page 1)
	let retainZoom = $state(true);
	let navZoneWidth = $state(15);
	let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let isSavingSettings = $state(false);

	// --- OCR settings state ---
	let isEditMode = $state(false); // Controls visibility of lines_coords
	let showTriggerOutline = $state(false); // Controls visibility of the main block.box
	let isBoxEditMode = $state(false);
	let focusedBlock = $state<MokuroBlock | null>(null);
	let focusedPage = $state<MokuroPage | null>(null);
	let isSmartResizeMode = $state(false);
	let isSliderHovered = $state(false);

	// --- OCR save states
	let isSaving = $state(false);
	let saveSuccess = $state(false);
	let hasUnsavedChanges = $state(false);

	// --- States for DOM elements and the panzoom instance ---
	let mainElement = $state<HTMLElement | null>(null);
	let panzoomElement = $state<HTMLDivElement | null>(null);
	let panzoomInstance = $state<PanzoomObject | null>(null);
	let verticalScrollerElement = $state<HTMLDivElement | null>(null); // for vertical mode

	// --- Progress Tracking State ---
	let initialPage = 0; // The page number we loaded with
	let progressSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let isSavingProgress = $state(false);

	// --- Virtualization State ---
	let progressObserver: IntersectionObserver | null = null;
	let renderObserver: IntersectionObserver | null = null;
	let destroyObserver: IntersectionObserver | null = null;
	let visiblePages = $state<boolean[]>([]);

	// --- Data Fetching Effects ---
	// This effect fetches volume data on load
	const fetchVolumeAndProgressData = async (volumeId: string) => {
		try {
			// Fetch volume data
			const data = await apiFetch(`/api/library/volume/${volumeId}`);
			volumeResponse = data as VolumeResponse;

			// Fetch progress data
			const progressData = await apiFetch(`/api/progress/volume/${volumeId}`);
			if (progressData.page) {
				currentPageIndex = progressData.page - 1; // 1-based to 0-based
				initialPage = progressData.page - 1;
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	};

	const currentUserId = $derived($user?.id);
	$effect(() => {
		if (currentUserId && params.id) {
			volumeResponse = null;
			currentPageIndex = 0;
			initialPage = 0;
			isLoading = true;
			fetchVolumeAndProgressData(params.id);
		}
	});

	// setup keyboard navigation presses
	onMount(() => {
		const handleKeydown = (e: KeyboardEvent) => {
			if (layoutMode === 'vertical') return;

			if (e.key === 'ArrowRight') {
				readingDirection === 'rtl' ? prevPage() : nextPage();
			}
			if (e.key === 'ArrowLeft') {
				readingDirection === 'rtl' ? nextPage() : prevPage();
			}
		};

		window.addEventListener('keydown', handleKeydown);

		// This return function is now only called on unmount
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	// check for hover capability
	onMount(() => {
		if (!browser) return;
		const mediaQuery = window.matchMedia('(hover: none)');

		// Set the initial value
		hasHover = !mediaQuery.matches;

		// Update the value if it changes
		const listener = (e: MediaQueryListEvent) => {
			hasHover = !e.matches;
		};
		mediaQuery.addEventListener('change', listener);

		// Cleanup listener
		return () => {
			mediaQuery.removeEventListener('change', listener);
		};
	});

	// This effect initializes settings when the user loads
	$effect(() => {
		if ($user && !settingsInitialized) {
			console.log(`Loading settings...`);
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
			console.log(`Settings loaded!`);
		}
	});

	// initial setup for vertical layout when page first load
	$effect(() => {
		if (settingsInitialized && !isLoading) setLayout(layoutMode);
	});

	// This effect watches all local settings and saves them
	$effect(() => {
		const currentSettings: ReaderSettingsData = {
			layoutMode,
			readingDirection,
			doublePageOffset,
			retainZoom,
			navZoneWidth,
			showTriggerOutline
		};

		if (!settingsInitialized) return;

		// Clear previous timer using short-circuit
		settingsSaveTimer && clearTimeout(settingsSaveTimer);

		// Start new timer
		settingsSaveTimer = setTimeout(() => {
			settingsSaveTimer = null;
			saveSettings(currentSettings);
		}, 2000);
	});

	// immediately execute pending timer on leave
	beforeNavigate(() => {
		if (settingsSaveTimer) {
			console.log('Saving settings on unmount...');
			const currentSettings: ReaderSettingsData = {
				layoutMode,
				readingDirection,
				doublePageOffset,
				retainZoom,
				navZoneWidth,
				showTriggerOutline
			};
			saveSettings(currentSettings);
		}
	});

	// This effect watches for page change and save progress
	$effect(() => {
		if (currentPageIndex !== initialPage) {
			// User has turned the page
			// Clear previous timer using short-circuit
			progressSaveTimer && clearTimeout(progressSaveTimer);
			// Start new timer
			progressSaveTimer = setTimeout(() => {
				progressSaveTimer = null;
				saveProgress();
				initialPage = currentPageIndex;
			}, 2000); // 2-second buffer
		}
	});

	// immediately execute pending timer on leave
	beforeNavigate(() => {
		if (currentPageIndex !== initialPage && progressSaveTimer) {
			console.log('Saving progress on unmount...');
			clearTimeout(progressSaveTimer);
			progressSaveTimer = null;
			saveProgress();
			initialPage = currentPageIndex;
		}
	});

	// Effect to disable box edit mode if hover is lost
	$effect(() => {
		if (!hasHover && isBoxEditMode) {
			// If user loses hover (e.g., tablet mode) while edit is on, force it off
			isBoxEditMode = false;
		}
	});

	// --- Saves the current page progress to the backend ---
	const saveProgress = async () => {
		if (isSavingProgress || !volumeResponse) return;
		isSavingProgress = true;

		// Clear any pending timer
		if (progressSaveTimer) {
			clearTimeout(progressSaveTimer);
			progressSaveTimer = null;
		}

		try {
			await apiFetch(`/api/progress/volume/${params.id}`, {
				method: 'PUT',
				body: {
					page: currentPageIndex + 1 // Convert 0-based to 1-based for DB
				}
			});
		} catch (e) {
			console.error('Failed to save progress:', (e as Error).message);
		} finally {
			isSavingProgress = false;
		}
	};

	// --- save reader settings ---
	const saveSettings = async (settings: ReaderSettingsData) => {
		if (isSavingSettings) return;
		isSavingSettings = true;

		// Clear any pending timer if called directly (e.g., on unmount)
		if (settingsSaveTimer) {
			clearTimeout(settingsSaveTimer);
			settingsSaveTimer = null;
		}

		try {
			await updateSettings(settings);
		} catch (e) {
			console.error('Failed to save settings:', e);
		} finally {
			isSavingSettings = false;
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

	// compute values for font slider
	const focusedBlockFontSize = $derived(
		focusedBlock?.font_size ?? 16 // Default to 16 if null
	);

	// Dynamic max value for font slider
	const sliderMax = $derived(
		focusedPage ? Math.floor(Math.min(focusedPage.img_height, focusedPage.img_width) / 3) : 100 // Default max 100
	);
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
		if (layoutMode === 'double') {
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
		}

		// --- Vertical Mode ---
		if (layoutMode === 'vertical') {
			// For the header/settings UI, just show the single "current" page
			const page = mokuroData.pages[page1Index];
			return page ? [page] : [];
		}

		return [];
	});

	// --- Event Handlers ---
	const handleGoBack = () => {
		const seriesId = volumeResponse?.seriesId;
		if (!seriesId) return; // Safety check
		goto(`/series/${seriesId}`);
	};

	beforeNavigate(async ({ from, to, cancel }) => {
		if (!to) return;

		// If no unsaved changes at all, just save progress and allow navigation
		if (!hasUnsavedChanges) return;

		// Stop the navigation from happening automatically
		cancel();

		// Open the confirmation modal
		confirmation.open(
			'Discard Unsaved Changes?',
			'You have unsaved OCR edits. Are you sure you want to discard them and exit?',
			async () => {
				// --- This is the 'onConfirm' callback ---
				// User clicked "Discard & Exit"

				// Manually clear the 'dirty' flag so we don't get asked again
				hasUnsavedChanges = false;

				// Re-trigger the navigation
				// TODO: Maybe fix back button behavior?
				// Currently clicking back still move the history forward
				const url = to.url;
				if (url) goto(url);
			},
			'Discard & Exit',
			'Exiting...'
		);
	});

	const setupDoublePageMode = () => {
		if (layoutMode !== 'double') return;
		if (currentPageIndex === 0) return;

		// Not perfect, can cause page drift if repeatedly toggle even-odd
		const hasOddOffset = doublePageOffset === 'odd';
		const pageIsEven = currentPageIndex % 2 === 0;
		if (hasOddOffset === pageIsEven) currentPageIndex -= 1;
	};

	const setupVerticalMode = () => {
		if (layoutMode !== 'vertical') return;
		if (!mainElement || !mokuroData) return;
		const pageElementsNodeList = mainElement.querySelectorAll('[data-page-index]');
		if (pageElementsNodeList.length !== mokuroData.pages.length) return;

		renderObserver?.disconnect();
		destroyObserver?.disconnect();
		progressObserver?.disconnect();

		// sort node list by index
		const pageElements = Array(mokuroData.pages.length);
		for (const el of pageElementsNodeList) {
			const index = parseInt((el as HTMLElement).dataset.pageIndex!, 10);
			pageElements[index] = el;
		}
		pageElements[currentPageIndex].scrollIntoView({ behavior: 'auto', block: 'start' });
		visiblePages = Array(mokuroData.pages.length).fill(false);

		const RENDER_MARGIN = '100px 0px';
		const DESTROY_MARGIN = '500px 0px';

		// 1. RENDER OBSERVER
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

		// 2. DESTROY OBSERVER
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

		// 3. PROGRESS OBSERVER
		progressObserver = new IntersectionObserver(
			(entries) => {
				let bestEntry = entries[0];
				for (const entry of entries) {
					if (entry.isIntersecting && entry.intersectionRatio > bestEntry.intersectionRatio) {
						bestEntry = entry;
					}
				}
				if (bestEntry.isIntersecting) {
					console.log(entries);
					console.log(bestEntry.intersectionRatio);
					const index = (bestEntry.target as HTMLElement).dataset.pageIndex;
					if (index) {
						const newPageIndex = parseInt(index, 10);
						currentPageIndex = newPageIndex;
					}
				}
			},
			{
				root: verticalScrollerElement,
				threshold: [0, 0.25, 0.5, 0.75, 1.0]
			}
		);

		// Observe all page elements with all observers
		pageElements.forEach((el) => {
			renderObserver?.observe(el);
			destroyObserver?.observe(el);
			progressObserver?.observe(el);
		});
	};

	const setLayout = async (mode: 'single' | 'double' | 'vertical') => {
		console.log(`Setting layout ${mode}`);
		layoutMode = mode;
		await tick();
		setupDoublePageMode();
		setupVerticalMode();
	};

	const toggleEvenOddOffset = () => {
		doublePageOffset = doublePageOffset === 'odd' ? 'even' : 'odd';
		setupDoublePageMode();
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
		focusedBlock = null; // Clear focused block on mode switch
		isBoxEditMode = isBoxEditMode && !isEditMode; // Both cannot be active at the same time
	};

	const toggleBoxEditMode = () => {
		isBoxEditMode = !isBoxEditMode;
		focusedBlock = null; // Clear focused block on mode switch
		isEditMode = isEditMode && !isBoxEditMode; // Both cannot be active at the same time
	};

	const toggleSmartResizeMode = () => {
		isSmartResizeMode = !isSmartResizeMode;
	};

	const toggleTriggerOutline = () => {
		showTriggerOutline = !showTriggerOutline;
	};

	// Callback for OcrOverlay
	const onOcrChange = () => {
		hasUnsavedChanges = true;
	};

	// Callback for OcrOverlay
	const onLineFocus = (block: MokuroBlock | null, page: MokuroPage | null) => {
		focusedBlock = block;
		focusedPage = page;
	};

	// Handler for the font slider
	const handleFontSizeInput = (e: Event) => {
		if (focusedBlock) {
			const newSize = parseFloat((e.target as HTMLInputElement).value);
			focusedBlock.font_size = newSize;
			onOcrChange();
		}
	};

	const handleFontSizeWheel = (e: WheelEvent) => {
		if (focusedBlock) {
			const delta = e.deltaY > 0 ? -1 : 1;
			const newFontSize = (focusedBlock.font_size ?? 16) + delta;
			focusedBlock.font_size = Math.max(newFontSize, 0);
			onOcrChange();
		}
	};

	const nextPage = () => {
		if (layoutMode === 'vertical') return; // disable for vertical mode
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
		if (layoutMode === 'vertical') return; // disable for vertical mode
		if (currentPageIndex === 0) return; // At start

		if (layoutMode === 'single') {
			currentPageIndex -= 1;
			return;
		}
		// Dual Page
		const hasOddOffset = doublePageOffset === 'odd';
		const pageIsEven = currentPageIndex % 2 === 0;
		let jump = 2;

		if (hasOddOffset === pageIsEven) {
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
				// ALWAYS zoom if Ctrl is held
				if (e.ctrlKey || layoutMode !== 'vertical') {
					e.preventDefault();
					pz?.zoomWithWheel(e);
					return;
				}
			};

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

	// Effect to reset panzoom when page changes
	$effect(() => {
		if (panzoomInstance && layoutMode !== 'vertical') {
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
			<div class="flex-1 justify-start">
				<button
					type="button"
					onclick={handleGoBack}
					class="flex-1 truncate whitespace-nowrap pr-2 text-sm hover:text-indigo-400 sm:text-base cursor-pointer"
				>
					&larr;
					{mokuroData.title}
				</button>
			</div>

			<div class="flex-1 text-center">
				{#if isEditMode && focusedBlock}
					<!-- Font Size Slider -->
					<div
						class="mx-auto flex w-48 items-center gap-2"
						role="toolbar"
						tabindex="-1"
						bind:this={verticalScrollerElement}
						onmousedown={(e) => {
							// Only prevent default if the click is on the container,
							// not on the slider input itself.
							if ((e.target as HTMLElement).id !== 'headerFontSizeSlider') {
								e.preventDefault();
							}
						}}
						onmouseenter={() => (isSliderHovered = true)}
						onmouseleave={() => (isSliderHovered = false)}
					>
						<label for="headerFontSizeSlider" class="text-s text-semibold font-medium leading-none">
							{focusedBlockFontSize.toFixed(0)}
						</label>
						<input
							id="headerFontSizeSlider"
							title="Scroll to adjust font size"
							type="range"
							min="8"
							max={sliderMax}
							step="1"
							value={focusedBlockFontSize}
							class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-500/50 accent-indigo-500"
							aria-valuemin="8"
							aria-valuemax={sliderMax}
							aria-valuenow={focusedBlockFontSize}
							onwheel={handleFontSizeWheel}
							oninput={handleFontSizeInput}
						/>
					</div>
				{:else if isSaving}
					<span class="text-sm bg-gray-900 rounded text-blue-300">Saving...</span>
				{:else if saveSuccess}
					<span class="text-sm bg-gray-900 rounded text-green-300">Saved!</span>
				{/if}
			</div>

			<div class="flex flex-1 justify-end gap-2">
				<!-- Page Counter -->

				<span
					class="flex flex-row items-center justify-center text-sm font-medium font-semibold text-gray-300"
				>
					<!-- shortened form -->
					<span class="inline md:hidden mr-1">
						{`${currentPageIndex + 1}${currentPages.length == 2 ? `-${currentPageIndex + 2}` : ''}`}
					</span>
					<span class="hidden md:inline mr-1">
						{`${currentPageIndex + 1}${currentPages.length == 2 ? `-${currentPageIndex + 2}` : ''}`}
						/
						{totalPages}
					</span>
				</span>
				<!-- OCR TEXT EDIT MODE TOGGLE -->
				<button
					onclick={toggleSmartResizeMode}
					type="button"
					title="Toggle Smart Resize (Auto-fit text)"
					class="flex justify-center items-center rounded p-1 transition-colors aspect-square w-8 cursor-pointer"
					class:bg-amber-300={isSmartResizeMode}
					class:hover:bg-gray-700={!isSmartResizeMode}
					class:text-gray-800={isSmartResizeMode}
					class:text-gray-400={!isSmartResizeMode}
					aria-pressed={isSmartResizeMode}
					class:active={isSmartResizeMode}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256">
						<path
							fill="currentColor"
							d="M208 144a15.78 15.78 0 0 1-10.42 14.94l-51.65 19l-19 51.61a15.92 15.92 0 0 1-29.88 0L78 178l-51.62-19a15.92 15.92 0 0 1 0-29.88l51.65-19l19-51.61a15.92 15.92 0 0 1 29.88 0l19 51.65l51.61 19A15.78 15.78 0 0 1 208 144Zm-56-96h16v16a8 8 0 0 0 16 0V48h16a8 8 0 0 0 0-16h-16V16a8 8 0 0 0-16 0v16h-16a8 8 0 0 0 0 16Zm88 32h-8v-8a8 8 0 0 0-16 0v8h-8a8 8 0 0 0 0 16h8v8a8 8 0 0 0 16 0v-8h8a8 8 0 0 0 0-16Z"
						/>
					</svg>
				</button>
				<!-- OCR TEXT EDIT MODE TOGGLE -->
				<button
					onclick={toggleEditMode}
					type="button"
					title="Toggle Text Edit Mode"
					class="flex justify-center items-center rounded p-1 transition-colors aspect-square w-8 cursor-pointer"
					class:bg-indigo-600={isEditMode}
					class:hover:bg-gray-700={!isEditMode}
					class:text-white={isEditMode}
					class:text-gray-400={!isEditMode}
					aria-pressed={isEditMode}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"
						/></svg
					>
				</button>

				<!-- OCR BOX EDIT MODE TOGGLE -->
				<button
					onclick={toggleBoxEditMode}
					type="button"
					title={hasHover ? 'Toggle Box Edit Mode' : 'Box edit is disabled on touch-only devices'}
					class="flex justify-center items-center rounded p-1 transition-colors aspect-square w-8 cursor-pointer disabled:text-gray-600"
					class:bg-indigo-600={isBoxEditMode}
					class:hover:bg-gray-700={!isBoxEditMode}
					class:text-white={isBoxEditMode}
					class:text-gray-400={!isBoxEditMode}
					aria-pressed={isBoxEditMode}
					disabled={!hasHover}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M23 15h-2v2h2v-2zm0-4h-2v2h2v-2zm0 8h-2v2c1 0 2-1 2-2zM15 3h-2v2h2V3zm8 4h-2v2h2V7zm-2-4v2h2c0-1-1-2-2-2zM3 21h8v-6H1v4c0 1.1.9 2 2 2zM3 7H1v2h2V7zm12 12h-2v2h2v-2zm4-16h-2v2h2V3zm0 16h-2v2h2v-2zM3 3C2 3 1 4 1 5h2V3zm0 8H1v2h2v-2zm8-8H9v2h2V3zM7 3H5v2h2V3z"
						/></svg
					>
				</button>

				{#if hasUnsavedChanges}
					<!-- OCR save button -->
					<button
						onclick={handleSave}
						disabled={isSaving}
						title="Save OCR changes"
						type="button"
						class="text-gray-400 hover:text-white disabled:opacity-50 cursor-pointer"
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
					title="Open settings"
					type="button"
					class="text-gray-400 hover:text-white cursor-pointer"
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
		{#if layoutMode === 'vertical'}
			<main class="flex flex-1 items-center justify-center overflow-hidden" bind:this={mainElement}>
				<div class="h-full w-full overflow-y-auto" bind:this={verticalScrollerElement}>
					<div class="relative mx-auto w-full max-w-4xl pt-16">
						{#each mokuroData.pages as page, i (page.img_path)}
							<div
								class="relative flex-shrink-0 bg-white"
								style={`aspect-ratio: ${page.img_width} / ${page.img_height};`}
								data-page-index={i}
							>
								{#if visiblePages[i]}
									<CachedImage src={`/api/files/volume/${params.id}/image/${page.img_path}`} />
									<OcrOverlay
										{page}
										{panzoomInstance}
										{isEditMode}
										{isBoxEditMode}
										{isSmartResizeMode}
										{showTriggerOutline}
										{isSliderHovered}
										{onOcrChange}
										{onLineFocus}
									/>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</main>
		{:else}
			<main class="flex flex-1 items-center justify-center overflow-hidden" bind:this={mainElement}>
				<button
					onclick={readingDirection === 'rtl' ? nextPage : prevPage}
					type="button"
					class="panzoom-exclude absolute left-0 z-10 h-full hover:cursor-pointer"
					aria-label="Previous Page"
					style={`width: ${navZoneWidth}%`}
				></button>
				>
				<div
					class="relative flex h-full flex-1 items-center justify-center"
					bind:this={panzoomElement}
				>
					{#each currentPages as page (page.img_path)}
						<div
							class="relative flex-shrink-0"
							style={`aspect-ratio: ${page.img_width} / ${page.img_height}; max-height: 100%; max-width: 100%;`}
						>
							<CachedImage src={`/api/files/volume/${params.id}/image/${page.img_path}`} />
							<OcrOverlay
								{page}
								{panzoomInstance}
								{isEditMode}
								{isBoxEditMode}
								{isSmartResizeMode}
								{showTriggerOutline}
								{isSliderHovered}
								{onOcrChange}
								{onLineFocus}
							/>
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
		{/if}
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
		onSetLayout={setLayout}
		onToggleDirection={toggleReadingDirection}
		onToggleOffset={toggleEvenOddOffset}
		onToggleZoom={toggleRetainZoom}
		onNavZoneChange={handleNavZoneChange}
		{showTriggerOutline}
		onToggleTriggerOutline={toggleTriggerOutline}
	/>
</div>
