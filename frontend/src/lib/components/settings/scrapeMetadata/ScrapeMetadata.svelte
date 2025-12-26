<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { browser } from '$app/environment';
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';
	import { createId } from '@paralleldrive/cuid2';
	import { ReviewSession, type ScrapedPreview } from './reviewSession.svelte';

	let { inReader = false }: { inReader?: boolean } = $props();

	interface SeriesWithMissingData {
		id: string;
		title: string;
		missingCover: boolean;
		missingDescription: boolean;
		missingJapaneseTitle: boolean;
		missingRomajiTitle: boolean;
		volumeCount: number;
	}

	type FilterMode = 'all' | 'missing-cover' | 'missing-description' | 'missing-title';

	let width = $state(0);
	let isXs = $derived(width >= 480);
	let isSm = $derived(width >= 640);
	let isMd = $derived(width >= 768);
	let isLg = $derived(width >= 1024);

	let series = $state<SeriesWithMissingData[]>([]);
	let isLoading = $state(true);
	let filterMode = $state<FilterMode>('all');
	let selectedProvider = $state<'anilist' | 'mal' | 'kitsu'>('anilist');

	// --- Filters (Description) ---
	interface DescriptionFilter {
		id: string;
		pattern: string;
		enabled: boolean;
		isRegex: boolean;
	}
	let descriptionFilters = $state<DescriptionFilter[]>([]);
	let showFilterManager = $state(false);
	let newFilterText = $state('');
	let newFilterIsRegex = $state(false);

	// --- Lists Management ---
	let excludedSeriesIds = $state<Set<string>>(new Set());
	let scrapedSeriesIds = $state<Set<string>>(new Set()); // This gets updated by ReviewSession
	let showMissingData = $state(false);
	let showScraped = $state(false);
	let showExcluded = $state(false);

	// Default recommended filters
	const defaultFilters: Omit<DescriptionFilter, 'id' | 'enabled'>[] = [
		// Publisher sources
		{ pattern: '\\(Source: VIZ Media\\)', isRegex: true },
		{ pattern: '\\(Source: Kodansha USA\\)', isRegex: true },
		{ pattern: '\\(Source: Seven Seas Entertainment\\)', isRegex: true },
		{ pattern: '\\(Source: Yen Press\\)', isRegex: true },
		{ pattern: '\\(Source: Dark Horse Manga\\)', isRegex: true },
		{ pattern: '\\(Source: Tokyopop\\)', isRegex: true },
		{ pattern: '\\(Source: NIS America\\)', isRegex: true },
		{ pattern: '\\(Source: Denpa\\)', isRegex: true },
		{ pattern: '\\(Source: Glacier Bay Books\\)', isRegex: true },
		{ pattern: '\\(Source: Vertical\\)', isRegex: true },
		{ pattern: '\\(Source: Anime News Network\\)', isRegex: true },
		{ pattern: '\\(Source: SQUARE ENIX\\)', isRegex: true },
		{ pattern: '\\(Source: Crunchyroll\\)', isRegex: true },
		{ pattern: '\\(Source: [^)]+\\)', isRegex: true }, // Generic source pattern
		// MAL Rewrite
		{ pattern: '\\[Written by MAL Rewrite\\]', isRegex: true },
		// HTML artifacts
		{ pattern: '&mdash;', isRegex: false },
		{ pattern: '&nbsp;', isRegex: false },
		{ pattern: '&amp;', isRegex: false },
		{ pattern: '&quot;', isRegex: false },
		{ pattern: '<br\\s*/?>', isRegex: true },
		{ pattern: '<i>|</i>', isRegex: true },
		{ pattern: '<b>|</b>', isRegex: true },
		// Trailing whitespace and multiple spaces
		{ pattern: '\\s+$', isRegex: true },
		{ pattern: '\\s{2,}', isRegex: true }
	];

	// 1. Session Manager (Handles logic for both Bulk and Single updates)
	const session = new ReviewSession((seriesId) => {
		// Callback: Logic to run when a series is updated successfully
		scrapedSeriesIds = new Set([...scrapedSeriesIds, seriesId]);
		saveScrapedSeries();
		// Optional: Refresh list in background
		// fetchSeriesWithMissingData();
	});

	// 2. Single Scrape UI State
	let currentPreview = $state<ScrapedPreview | null>(null);
	let isSingleScraping = $state(false);

	// 3. Bulk Scrape UI State
	let isScraping = $state(false);
	let showBulkModal = $state(false);

	// --- API Fetching ---

	async function fetchSeriesWithMissingData() {
		if (!browser) return;
		try {
			isLoading = true;
			const libraryData = await apiFetch('/api/library?limit=10000');
			const allSeries = libraryData.data || [];
			const allSeriesData: SeriesWithMissingData[] = [];
			const updatedScrapedIds = new Set(scrapedSeriesIds);

			for (const s of allSeries) {
				const missingCover = !s.coverPath;
				const missingDescription = !s.description?.trim();
				const missingJapaneseTitle = !s.japaneseTitle?.trim();
				const missingRomajiTitle = !s.romajiTitle?.trim();
				const isComplete =
					!missingCover && !missingDescription && !missingJapaneseTitle && !missingRomajiTitle;

				allSeriesData.push({
					id: s.id,
					title: s.title || s.folderName,
					missingCover,
					missingDescription,
					missingJapaneseTitle,
					missingRomajiTitle,
					volumeCount: s.volumes?.length || 0
				});

				if (isComplete) updatedScrapedIds.add(s.id);
			}
			series = allSeriesData;
			scrapedSeriesIds = updatedScrapedIds;
			saveScrapedSeries();
		} catch (error) {
			console.error('Failed to fetch series:', error);
		} finally {
			isLoading = false;
		}
	}

	// --- Scraping Logic ---

	async function startBulkScrape() {
		if (isScraping) return;

		isScraping = true;
		showBulkModal = true;

		// Reset session stats and queue
		session.reset(missingDataSeries.length);

		const queue = [...missingDataSeries];

		for (const s of queue) {
			if (!isScraping) break; // Graceful stop

			try {
				const { scraped, current } = await scrapeWithFallback(s.id, s.title, selectedProvider);

				if (current) {
					const newItem: ScrapedPreview = {
						id: createId(),
						seriesId: s.id,
						seriesTitle: s.title,
						searchQuery: s.title,
						current,
						scraped: {
							...scraped,
							description: filterDescription(scraped.description)
						},
						status: 'pending'
					};
					// Add to class queue
					session.addIncoming(newItem);
				}
			} catch (e) {
				console.error(e);
			} finally {
				session.incrementScrapedCount();
			}
			await new Promise((r) => setTimeout(r, 200));
		}
		isScraping = false;
	}

	function stopScraping() {
		isScraping = false;
	}

	function clearQueue() {
		stopScraping();
		session.reset(0); // Clear data
		showBulkModal = false;
	}

	async function scrapeSingleSeries(seriesId: string, seriesTitle: string) {
		isSingleScraping = true;
		try {
			const { scraped, current } = await scrapeWithFallback(
				seriesId,
				seriesTitle,
				selectedProvider
			);
			if (!current) throw new Error('No data found');

			currentPreview = {
				id: createId(),
				seriesId,
				seriesTitle,
				searchQuery: seriesTitle,
				current,
				scraped: { ...scraped, description: filterDescription(scraped.description) },
				status: 'pending'
			};
		} catch (e) {
			alert('Failed to scrape: ' + e);
		} finally {
			isSingleScraping = false;
		}
	}

	// --- Review Interaction Handlers ---

	// 1. Bulk Confirm
	async function handleBulkConfirm() {
		await session.confirmCurrent();
	}

	// 2. Bulk Skip
	function handleBulkSkip() {
		session.skipCurrent();
	}

	// 3. Single Confirm (Uses ReviewSession logic but for standalone item)
	async function handleSingleConfirm() {
		if (!currentPreview) return;
		await session.commitChange(currentPreview);
		// Close modal after success
		if (currentPreview.status === 'applied') {
			currentPreview = null;
		}
	}

	// 4. Keyboard Navigation
	function handleKeydown(e: KeyboardEvent) {
		// 1. Check which mode we are in
		const isBulk = showBulkModal;
		const isSingle = !!currentPreview;

		// If neither modal is open, do nothing
		if (!isBulk && !isSingle) return;

		// 2. Safety: Don't trigger shortcuts if typing in the Search Input
		if (document.activeElement?.tagName === 'INPUT') {
			// Optional: Allow 'Escape' to blur the input
			if (e.key === 'Escape') {
				(document.activeElement as HTMLElement).blur();
			}
			return;
		}

		// 3. Handle Keys based on context
		switch (e.key) {
			case 'ArrowRight':
				// Only available in Bulk mode
				if (isBulk) session.defer();
				break;

			case 'ArrowLeft':
				// Only available in Bulk mode
				if (isBulk) session.rewind();
				break;

			case 'Enter':
				e.preventDefault();
				if (isBulk) {
					handleBulkConfirm();
				} else {
					handleSingleConfirm();
				}
				break;

			case 'Escape':
				e.preventDefault();
				if (isBulk) {
					handleBulkSkip();
				} else {
					// In single mode, Escape just closes the modal
					currentPreview = null;
				}
				break;
		}
	}

	// --- Derived Lists ---

	const missingDataSeries = $derived.by(() => {
		// 1. Filter out excluded and scraped series first (Efficiency)
		let filtered = series.filter(
			(s) => !excludedSeriesIds.has(s.id) && !scrapedSeriesIds.has(s.id)
		);

		// 2. Apply the specific mode filter
		if (filterMode === 'missing-cover') {
			return filtered.filter((s) => s.missingCover);
		}
		if (filterMode === 'missing-description') {
			return filtered.filter((s) => s.missingDescription);
		}
		if (filterMode === 'missing-title') {
			return filtered.filter((s) => s.missingJapaneseTitle || s.missingRomajiTitle);
		}

		// Default: Return all that passed the first check
		return filtered;
	});

	const scrapedSeries = $derived(series.filter((s) => scrapedSeriesIds.has(s.id)));
	const excludedSeries = $derived(series.filter((s) => excludedSeriesIds.has(s.id)));

	// --- Helper Functions ---

	function filterDescription(description: string | undefined): string | undefined {
		if (!description) return description;
		let result = description;

		for (const filter of descriptionFilters) {
			if (!filter.enabled) continue;
			try {
				if (filter.isRegex) {
					const regex = new RegExp(filter.pattern, 'gims');
					result = result.replace(regex, ' ');
				} else {
					result = result.split(filter.pattern).join(' ');
				}
			} catch (e) {
				console.warn(`Invalid filter: ${filter.pattern}`);
			}
		}
		return result.replace(/\s+/g, ' ').trim();
	}

	async function scrapeWithFallback(
		seriesId: string,
		seriesTitle: string,
		primaryProvider: 'anilist' | 'mal' | 'kitsu'
	) {
		try {
			// Just make ONE call. The backend handles the fallback.
			const response = await apiFetch('/api/metadata/series/scrape', {
				method: 'POST',
				body: {
					seriesId,
					seriesName: seriesTitle,
					provider: primaryProvider
				}
			});

			if (response.error || !response.scraped) {
				return { scraped: {}, current: null };
			}

			return {
				scraped: response.scraped,
				current: response.current
			};
		} catch (error) {
			console.error(`Failed to scrape:`, error);
			return { scraped: {}, current: null };
		}
	}

	// --- Persistence & Filters ---

	function saveExcludedSeries() {
		if (browser)
			localStorage.setItem('mokuro_excluded_series', JSON.stringify([...excludedSeriesIds]));
	}
	function loadExcludedSeries() {
		if (browser) {
			try {
				const s = localStorage.getItem('mokuro_excluded_series');
				if (s) excludedSeriesIds = new Set(JSON.parse(s));
			} catch (e) {
				console.error(e);
			}
		}
	}

	function saveScrapedSeries() {
		if (browser)
			localStorage.setItem('mokuro_scraped_series', JSON.stringify([...scrapedSeriesIds]));
	}
	function loadScrapedSeries() {
		if (browser) {
			try {
				const s = localStorage.getItem('mokuro_scraped_series');
				if (s) scrapedSeriesIds = new Set(JSON.parse(s));
			} catch (e) {
				console.error(e);
			}
		}
	}

	function saveFilters() {
		if (browser) {
			localStorage.setItem(
				'mokuro_series_description_scrape_filters',
				JSON.stringify(descriptionFilters)
			);
		}
	}

	function loadFilters() {
		if (browser) {
			const s = localStorage.getItem('mokuro_series_description_scrape_filters');
			if (s) descriptionFilters = JSON.parse(s);
		}
	}

	// Action Handlers
	function excludeSeries(id: string) {
		excludedSeriesIds = new Set([...excludedSeriesIds, id]);
		saveExcludedSeries();
	}

	function restoreSeries(id: string) {
		const s = new Set(excludedSeriesIds);
		s.delete(id);
		excludedSeriesIds = s;
		saveExcludedSeries();
	}

	function addCustomFilter() {
		if (!newFilterText.trim()) return;
		descriptionFilters = [
			...descriptionFilters,
			{
				id: createId(),
				pattern: newFilterText,
				isRegex: newFilterIsRegex,
				enabled: true
			}
		];
		newFilterText = '';
		saveFilters();
	}
	function removeFilter(id: string) {
		descriptionFilters = descriptionFilters.filter((f) => f.id !== id);
		saveFilters();
	}
	function toggleFilter(id: string) {
		descriptionFilters = descriptionFilters.map((f) =>
			f.id === id ? { ...f, enabled: !f.enabled } : f
		);
		saveFilters();
	}

	function addPresetFilters() {
		const newFilters = defaultFilters.map((f) => ({
			...f,
			id: createId(),
			enabled: true
		}));
		descriptionFilters = [...descriptionFilters, ...newFilters];
		saveFilters();
	}

	function clearAllFilters() {
		if (confirm('Clear all filters?')) {
			descriptionFilters = [];
			saveFilters();
		}
	}

	async function rescrapeWithQuery(preview: ScrapedPreview) {
		try {
			preview.status = 'applying';

			const { scraped, current } = await scrapeWithFallback(
				preview.seriesId,
				preview.searchQuery,
				selectedProvider
			);

			if (!current) {
				console.error('Re-scrape failed: no results from any provider');
				preview.status = 'error';
				return;
			}

			// Update the preview with new scraped data and new ID
			preview.id = createId();
			preview.current = current;
			preview.scraped = {
				...scraped,
				description: filterDescription(scraped.description)
			};
			preview.status = 'pending';
		} catch (error) {
			console.error(`Failed to re-scrape metadata:`, error);
			preview.status = 'error';
		}
	}

	// Lifecycle
	onMount(() => {
		loadFilters();
		loadExcludedSeries();
		loadScrapedSeries();
		fetchSeriesWithMissingData();
	});
</script>

<svelte:window bind:innerWidth={width} onkeydown={handleKeydown} />

<div class="w-full {inReader ? 'max-w-2xl' : 'max-w-4xl'}">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-theme-primary mb-2">Scrape Metadata</h1>
		<p class="text-base text-theme-secondary">
			Find and update manga with missing covers or descriptions.
		</p>
	</div>

	<div class="space-y-5">
		<MenuGridRadio
			title="Metadata Provider"
			tooltip="Choose which service to scrape metadata from"
			bind:value={selectedProvider}
			layout={isXs ? [3] : [1, 1, 1]}
			options={[
				{ value: 'anilist', label: 'AniList' },
				{ value: 'mal', label: 'MyAnimeList' },
				{ value: 'kitsu', label: 'Kitsu' }
			]}
		/>

		<MenuGridRadio
			title="Filter"
			tooltip="Filter series by what metadata is missing"
			bind:value={filterMode}
			layout={isXs ? [4] : [1, 1, 1, 1]}
			options={[
				{ value: 'all', label: 'All Missing' },
				{ value: 'missing-cover', label: 'Missing Cover' },
				{ value: 'missing-description', label: 'Missing Desc' },
				{ value: 'missing-title', label: 'Missing Title' }
			]}
		/>

		<div
			class="rounded-2xl backdrop-blur-2xl p-6 border border-theme-primary/10 shadow-theme-secondary/20 shadow-lg space-y-3"
		>
			<div class="flex flex-col gap-2 sm:flex-row items-center justify-between mb-2">
				<div class="w-max-10">
					<p class="text-[10px] font-bold text-theme-secondary uppercase tracking-[0.2em]">
						Description Filters
					</p>
					<p class="text-xs text-theme-secondary mt-1">
						Remove unwanted text from descriptions (source tags, HTML, etc.)
					</p>
				</div>
				<div class="flex gap-2">
					<button
						onclick={addPresetFilters}
						class="px-3 py-1 w-20 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-xs font-semibold"
					>
						Add Presets
					</button>
					<button
						onclick={clearAllFilters}
						disabled={descriptionFilters.length === 0}
						class="px-3 py-1 w-15 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Clear All
					</button>
					<button
						onclick={() => (showFilterManager = !showFilterManager)}
						class="px-3 py-1 w-20 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-xs font-semibold"
					>
						{showFilterManager ? 'Close' : 'Manage'} ({descriptionFilters.filter((f) => f.enabled)
							.length})
					</button>
				</div>
			</div>

			{#if showFilterManager}
				<div class="p-4 rounded-xl bg-theme-surface border border-theme-border space-y-3">
					<p class="text-xs font-semibold text-theme-primary">Add New Filter</p>
					<div class="flex flex-col sm:flex-row gap-2">
						<input
							type="text"
							bind:value={newFilterText}
							placeholder="Text or regex pattern..."
							class="flex-1 px-3 py-2 rounded-lg bg-theme-main border border-theme-border text-theme-primary placeholder-gray-500 focus:border-accent focus:outline-none transition-colors text-sm font-mono"
						/>
						<div class="flex gap-2">
							<label
								class="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-main border border-theme-border cursor-pointer hover:border-accent transition-colors"
							>
								<input type="checkbox" bind:checked={newFilterIsRegex} class="accent-accent" />
								<span class="text-xs text-theme-primary">Regex</span>
							</label>
							<button
								onclick={addCustomFilter}
								disabled={!newFilterText.trim()}
								class="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
							>
								Add
							</button>
						</div>
					</div>
				</div>

				<div class="space-y-2 max-h-96 overflow-y-auto">
					{#if descriptionFilters.length === 0}
						<div class="text-center py-8 text-theme-secondary text-sm">No filters configured.</div>
					{:else}
						{#each descriptionFilters as filter (filter.id)}
							<div
								class="flex items-center gap-3 p-3 rounded-lg bg-theme-surface border border-theme-border hover:border-accent/50 transition-colors"
							>
								<input
									type="checkbox"
									checked={filter.enabled}
									onchange={() => toggleFilter(filter.id)}
									class="accent-accent"
								/>
								<div class="flex-1 min-w-0">
									<p class="text-sm text-theme-primary font-mono truncate">{filter.pattern}</p>
									<p class="text-xs text-theme-secondary">{filter.isRegex ? 'Regex' : 'Text'}</p>
								</div>
								<button
									onclick={() => removeFilter(filter.id)}
									class="text-red-400 hover:text-red-300 text-xs"
								>
									Remove
								</button>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
			<div class="flex items-center gap-2 mb-4">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-accent"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="16" x2="12" y2="12" />
					<line x1="12" y1="8" x2="12.01" y2="8" />
				</svg>
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Summary</p>
			</div>

			{#if isLoading}
				<div class="text-center py-8 text-theme-secondary">Loading series...</div>
			{:else}
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
					<div class="text-center">
						<div class="text-2xl font-bold theme-primary">{series.length}</div>
						<div class="text-xs text-gray-400 mt-1">Total Missing</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold theme-primary">
							{series.filter((s) => s.missingCover).length}
						</div>
						<div class="text-xs text-gray-400 mt-1">Cover</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold theme-primary">
							{series.filter((s) => s.missingDescription).length}
						</div>
						<div class="text-xs text-gray-400 mt-1">Description</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold theme-primary">
							{series.filter((s) => s.missingJapaneseTitle).length}
						</div>
						<div class="text-xs text-gray-400 mt-1">Japanese</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold theme-primary">
							{series.filter((s) => s.missingRomajiTitle).length}
						</div>
						<div class="text-xs text-gray-400 mt-1">Romaji</div>
					</div>
				</div>
			{/if}
		</div>

		{#if !isScraping && !showBulkModal}
			<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
				<div class="w-full flex items-center justify-between">
					<button
						onclick={() => (showMissingData = !showMissingData)}
						class="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1 text-left"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-accent"
						>
							<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
						</svg>
						<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
							Missing Data ({missingDataSeries.length})
						</p>
					</button>

					<div class="flex items-center gap-2">
						{#if showMissingData && !isLoading}
							<button
								onclick={startBulkScrape}
								disabled={missingDataSeries.length === 0}
								class="px-4 py-2 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/80 disabled:opacity-50"
							>
								Scrape All
							</button>
						{/if}
						<button
							onclick={() => (showMissingData = !showMissingData)}
							class="p-1 hover:bg-theme-surface-hover rounded-lg transition-colors"
							title="toggle show missing data"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="text-theme-tertiary transition-transform {showMissingData
									? 'rotate-180'
									: ''}"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</button>
					</div>
				</div>

				{#if showMissingData}
					<div class="space-y-3 max-h-[600px] mt-4 overflow-y-auto">
						{#each missingDataSeries as item (item.id)}
							<div class="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-theme-surface">
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold theme-primary truncate">{item.title}</p>
									<div class="flex flex-wrap gap-2 mt-1">
										<span class="text-xs text-gray-400">{item.volumeCount} Vols</span>
										{#if item.missingCover}
											<span
												class="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[10px] font-bold uppercase"
												>No Cov</span
											>
										{/if}
										{#if item.missingDescription}
											<span
												class="px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase"
												>No Desc</span
											>
										{/if}
									</div>
								</div>
								<div class="flex gap-2">
									<button
										onclick={() => scrapeSingleSeries(item.id, item.title)}
										disabled={isSingleScraping}
										class="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-semibold text-sm disabled:opacity-50"
									>
										Scrape
									</button>
									<button
										onclick={() => excludeSeries(item.id)}
										class="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 font-semibold text-sm"
									>
										Exclude
									</button>
								</div>
							</div>
						{/each}
						{#if missingDataSeries.length === 0}
							<div class="text-center py-8 text-theme-secondary">
								No series match the current filter.
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
				<button
					onclick={() => (showScraped = !showScraped)}
					class="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
				>
					<div class="flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-green-500"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
						<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
							Scraped Manga ({scrapedSeries.length})
						</p>
					</div>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-theme-tertiary transition-transform {showScraped ? 'rotate-180' : ''}"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>
				{#if showScraped}
					<div class="space-y-3 max-h-[600px] mt-4 overflow-y-auto">
						{#each scrapedSeries as item (item.id)}
							<div class="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-theme-surface">
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold theme-primary truncate">{item.title}</p>
									<span
										class="px-1.5 py-0.5 rounded-md bg-green-500/20 text-green-400 text-[10px] font-bold uppercase"
										>Scraped</span
									>
								</div>
								<button
									onclick={() => scrapeSingleSeries(item.id, item.title)}
									class="px-4 py-2 rounded-lg bg-accent text-white font-semibold text-sm"
								>
									Re-scrape
								</button>
							</div>
						{/each}
						{#if scrapedSeries.length === 0}
							<div class="text-center py-8 text-theme-secondary">No scraped series yet.</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
				<button
					onclick={() => (showExcluded = !showExcluded)}
					class="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
				>
					<div class="flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-red-500"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
						</svg>
						<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
							Excluded Manga ({excludedSeries.length})
						</p>
					</div>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-theme-tertiary transition-transform {showExcluded ? 'rotate-180' : ''}"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>
				{#if showExcluded}
					<div class="space-y-3 max-h-[600px] mt-6 overflow-y-auto">
						{#each excludedSeries as item (item.id)}
							<div class="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-theme-surface">
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold theme-primary truncate">{item.title}</p>
									<span
										class="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[10px] font-bold uppercase"
										>Excluded</span
									>
								</div>
								<button
									onclick={() => restoreSeries(item.id)}
									class="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 font-semibold text-sm"
								>
									Restore
								</button>
							</div>
						{/each}
						{#if excludedSeries.length === 0}
							<div class="text-center py-8 text-theme-secondary">No excluded series.</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if currentPreview}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
		<div
			class="relative z-10 bg-theme-surface rounded-2xl border border-theme-border max-w-4xl w-full h-[90vh] flex flex-col"
		>
			<button
				type="button"
				class="absolute top-4 right-4 text-theme-secondary hover:text-theme-primary z-50"
				onclick={() => (currentPreview = null)}
				title="close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
				>
			</button>
			{@render previewCard(currentPreview, false)}
		</div>
	</div>
{/if}

{#if showBulkModal}
	<div class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
		<div
			class="bg-theme-main rounded-2xl border border-accent max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl"
		>
			<div
				class="bg-theme-surface border-b border-theme-border p-4 flex items-center justify-between"
			>
				<div class="flex items-center gap-4">
					<h2 class="hidden sm:inline text-lg font-bold text-theme-primary">Bulk Review</h2>
					<div class="flex items-center gap-2 text-xs font-mono">
						<span
							class="px-2 py-1 rounded bg-theme-main border border-theme-border text-theme-secondary"
						>
							Queue: {session.totalPending}
						</span>
						<span class="px-2 py-1 rounded bg-theme-main border border-theme-border text-green-400">
							Applied: {session.stats.success}
						</span>
					</div>
				</div>
				<div class="flex gap-2">
					{#if isScraping}
						<button
							onclick={stopScraping}
							class="p-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
							title="Stop Scan"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
							</svg>
						</button>
					{/if}
					<button
						onclick={clearQueue}
						class="p-2 text-theme-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors"
						title="Close"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			</div>

			<div class="flex-1 flex overflow-hidden">
				<div class="w-64 border-r border-theme-border bg-theme-surface hidden md:flex flex-col">
					<div
						class="p-2 text-[10px] font-bold text-theme-secondary uppercase sticky top-0 bg-theme-surface border-b border-theme-border/50"
					>
						Up Next ({session.upcoming.size})
					</div>
					<div class="flex-1 overflow-y-auto">
						<div class="p-2 space-y-1">
							{#each session.upcoming.items as item, i (item.id)}
								<div
									class="px-3 py-2 rounded text-xs truncate {i === 0
										? 'bg-accent text-white'
										: 'text-theme-secondary opacity-70'}"
								>
									{item.seriesTitle}
								</div>
							{/each}
						</div>
					</div>
					<div class="h-1/3 border-t border-theme-border bg-black/20 overflow-y-auto">
						<div
							class="p-2 text-[10px] font-bold text-theme-secondary uppercase sticky top-0 bg-theme-surface/95 border-b border-theme-border/50"
						>
							History
						</div>
						<div class="p-2 space-y-1">
							{#each session.history as item (item.id)}
								<div class="flex justify-between px-3 py-1 text-xs text-theme-secondary">
									<span class="truncate w-32">{item.seriesTitle}</span>
									<span class={item.status === 'applied' ? 'text-green-400' : 'text-red-400'}>
										{item.status === 'applied' ? '✓' : '✕'}
									</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<div
					class="flex-1 w-full bg-theme-main {isXs
						? 'p-4'
						: 'p-2'} flex flex-col items-center justify-center"
				>
					{#if session.current}
						<div class="flex flex-col w-full h-full max-w-3xl">
							<div class="flex justify-between mb-2">
								<button
									onclick={() => session.rewind()}
									disabled={session.deferred.length === 0}
									class="text-xs text-theme-secondary disabled:opacity-20 hover:text-theme-primary"
								>
									← Back ({session.deferred.length})
								</button>
								<button
									onclick={() => session.defer()}
									disabled={session.upcoming.size <= 1}
									class="text-xs text-theme-secondary disabled:opacity-20 hover:text-theme-primary"
								>
									Skip for now →
								</button>
							</div>
							{@render previewCard(session.current, true)}
						</div>
					{:else}
						<div class="text-center">
							{#if isScraping}
								<div class="text-theme-primary text-lg">Scanning series...</div>
								<p class="text-theme-secondary text-sm mt-2">Please wait while we find metadata.</p>
							{:else}
								<div class="text-theme-primary font-bold text-xl">Queue Empty</div>
								<p class="text-theme-secondary mt-1">All items processed.</p>
								<button
									onclick={clearQueue}
									class="mt-6 px-6 py-2 bg-accent text-white rounded-lg font-bold"
								>
									Finish
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

{#snippet previewCard(preview: ScrapedPreview, isBulk: boolean)}
	<div
		class="{isXs ? 'p-4' : 'p-2'} flex-1 min-h-0 flex flex-col {isBulk
			? 'rounded-xl bg-theme-surface border border-theme-border shadow-lg'
			: ''}"
	>
		<div class="mb-4">
			<h3 class="text-xl font-bold text-theme-primary truncate">{preview.seriesTitle}</h3>
			<p class="hidden sm:inline text-xs text-theme-secondary">
				{isBulk ? 'Reviewing from queue' : 'Single series review'}
			</p>
		</div>

		<div class="mb-4 flex {isXs ? 'flex-row' : 'flex-col'} gap-2">
			<input
				type="text"
				bind:value={preview.searchQuery}
				class="flex-1 px-3 py-2 rounded-lg bg-theme-main border border-theme-border text-sm text-theme-primary"
				placeholder="Search title..."
			/>
			<button
				onclick={() => rescrapeWithQuery(preview)}
				disabled={preview.status === 'applying'}
				class="px-4 py-2 bg-theme-main border border-theme-border rounded-lg text-sm font-semibold hover:bg-theme-surface-hover"
			>
				{preview.status === 'applying' ? 'Searching...' : 'Rescrape'}
			</button>
		</div>

		<div
			class="flex-1 overflow-y-auto border border-theme-border rounded-xl p-4 mb-4 bg-theme-main/20"
		>
			<div class="grid grid-cols-2 gap-4 mb-4 border-b border-theme-border pb-2">
				<div class="text-xs font-bold text-theme-tertiary uppercase">Current</div>
				<div class="text-xs font-bold text-accent uppercase">Scraped</div>
			</div>

			<div class="grid grid-cols-2 gap-4 mb-6">
				<div class="relative max-w-30">
					{#if preview.current.coverPath}
						<img
							src="/api/files/series/{preview.seriesId}/cover"
							alt="Current"
							class="w-full max-w-30 aspect-[7/11] object-cover rounded-lg border border-theme-border"
						/>
					{:else}
						<div
							class="w-full max-w-30 aspect-[7/11] rounded-lg border-2 border-dashed border-theme-border flex items-center justify-center"
						>
							<span class="text-xs text-red-400">No Cover</span>
						</div>
					{/if}
				</div>
				<div>
					{#if preview.scraped.tempCoverPath}
						<div class="relative max-w-30">
							<img
								src="/api/files/preview?path={encodeURIComponent(preview.scraped.tempCoverPath)}"
								alt="New"
								class="w-full max-w-30 aspect-[7/11] rounded-lg border-2 border-dashed border-theme-border flex items-center justify-center"
							/>
							<div
								class="absolute -top-2 -right-2 bg-accent text-white text-[10px] px-2 py-0.5 rounded-full"
							>
								NEW
							</div>
						</div>
					{:else}
						<div
							class="w-full max-w-30 aspect-[7/11] rounded-lg border border-theme-border flex items-center justify-center opacity-50"
						>
							<span class="text-xs">No Change</span>
						</div>
					{/if}
				</div>
			</div>

			{#each [{ label: 'Title', cur: preview.current.title, new: preview.scraped.title }, { label: 'Japanese', cur: preview.current.japaneseTitle, new: preview.scraped.japaneseTitle }, { label: 'Romaji', cur: preview.current.romajiTitle, new: preview.scraped.romajiTitle }] as field}
				<div class="grid grid-cols-2 gap-4 mb-4 border-b border-theme-border/50 pb-2">
					<div>
						<div class="text-[10px] text-theme-secondary mb-1">{field.label}</div>
						<div class="text-sm text-theme-primary">{field.cur || '-'}</div>
					</div>
					<div>
						<div class="text-[10px] text-accent/70 mb-1">{field.label}</div>
						<div class="text-sm {field.new ? 'text-theme-primary' : 'text-theme-secondary italic'}">
							{field.new || 'No change'}
						</div>
					</div>
				</div>
			{/each}

			<div class="grid grid-cols-2 gap-4">
				<div>
					<div class="text-[10px] text-theme-secondary mb-1">Description</div>
					<div class="text-xs text-theme-primary opacity-80">
						{preview.current.description || '-'}
					</div>
				</div>
				<div>
					<div class="text-[10px] text-accent/70 mb-1">Description</div>
					{#if preview.scraped.description}
						<div class="text-xs text-theme-primary">
							{@html preview.scraped.description}
						</div>
					{:else}
						<div class="text-xs text-theme-secondary italic">No change</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="flex gap-3 justify-end pt-4 border-t border-theme-border">
			{#if isBulk}
				<button
					onclick={handleBulkSkip}
					class="p-2 rounded-lg bg-theme-main border border-theme-border text-theme-secondary hover:text-theme-primary"
				>
					Skip (Esc)
				</button>
				<button
					onclick={handleBulkConfirm}
					class="p-2 rounded-lg bg-accent text-white hover:bg-accent/80 font-bold"
				>
					Confirm (Enter)
				</button>
			{:else}
				<button
					onclick={() => (currentPreview = null)}
					class="px-4 py-2 rounded-lg bg-theme-main border border-theme-border text-theme-secondary"
				>
					Cancel
				</button>
				<button
					onclick={handleSingleConfirm}
					disabled={preview.status === 'applying'}
					class="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 font-bold"
				>
					{preview.status === 'applying' ? 'Saving...' : 'Apply'}
				</button>
			{/if}
		</div>
	</div>
{/snippet}
