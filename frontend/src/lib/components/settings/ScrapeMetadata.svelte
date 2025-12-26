<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { browser } from '$app/environment';
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';
	import { createId } from '@paralleldrive/cuid2';

	// State & Logic
	import { scrapingState } from '$lib/states/ScrapingState.svelte';
	import type { ScrapedPreview } from '$lib/states/ReviewSession.svelte';

	// Panels
	import ScrapeDescriptionFilterPanel from '$lib/components/panels/ScrapeDescriptionFilterPanel.svelte';
	import BulkScrapePanel from '$lib/components/panels/BulkScrapePanel.svelte';
	import SingleScrapePanel from '$lib/components/panels/SingleScrapePanel.svelte';

	let { inReader = false }: { inReader?: boolean } = $props();

	// --- Definitions ---
	interface SeriesWithMissingData {
		id: string;
		title: string;
		folderName: string;
		missingCover: boolean;
		missingDescription: boolean;
		missingJapaneseTitle: boolean;
		missingRomajiTitle: boolean;
		volumeCount: number;
	}

	type FilterMode = 'all' | 'missing-cover' | 'missing-description' | 'missing-title';

	// --- UI State ---
	let width = $state(0);
	let isXs = $derived(width >= 480);

	let series = $state<SeriesWithMissingData[]>([]);
	let isLoading = $state(true);

	let filterMode = $state<FilterMode>('all');
	let selectedProvider = $state<'anilist' | 'mal' | 'kitsu'>('anilist');

	// --- Component Toggle State ---
	let showMissingData = $state(false);
	let showScraped = $state(false);
	let showExcluded = $state(false);

	// --- Modal State ---
	// Bulk
	let isScraping = $state(false);
	let showBulkModal = $state(false);

	// Single
	let showSingleModal = $state(false);
	let isSingleLoading = $state(false);
	let currentPreview = $state<ScrapedPreview | null>(null);

	// --- Derived Lists (Reactive to Global State) ---
	const missingDataSeries = $derived.by(() => {
		// 1. Filter out excluded and scraped series first (using global state Sets)
		let filtered = series.filter(
			(s) => !scrapingState.excludedSeriesIds.has(s.id) && !scrapingState.scrapedSeriesIds.has(s.id)
		);

		// 2. Apply the specific mode filter
		if (filterMode === 'missing-cover') return filtered.filter((s) => s.missingCover);
		if (filterMode === 'missing-description') return filtered.filter((s) => s.missingDescription);
		if (filterMode === 'missing-title')
			return filtered.filter((s) => s.missingJapaneseTitle || s.missingRomajiTitle);

		return filtered;
	});

	const scrapedSeries = $derived(series.filter((s) => scrapingState.scrapedSeriesIds.has(s.id)));
	const excludedSeries = $derived(series.filter((s) => scrapingState.excludedSeriesIds.has(s.id)));

	// --- API Fetching ---
	async function fetchSeriesWithMissingData() {
		if (!browser) return;
		try {
			isLoading = true;
			const libraryData = await apiFetch('/api/library?limit=10000');
			const allSeries = libraryData.data || [];

			const allSeriesData: SeriesWithMissingData[] = [];

			for (const s of allSeries) {
				const missingCover = !s.coverPath;
				const missingDescription = !s.description?.trim();
				const missingJapaneseTitle = !s.japaneseTitle?.trim();
				const missingRomajiTitle = !s.romajiTitle?.trim();

				// Calculate if complete. If so, mark as scraped in global state automatically
				const isComplete =
					!missingCover && !missingDescription && !missingJapaneseTitle && !missingRomajiTitle;
				if (isComplete) scrapingState.markAsScraped(s.id);

				allSeriesData.push({
					id: s.id,
					title: s.title || s.folderName,
					folderName: s.folderName, // Keep folderName for fallback
					missingCover,
					missingDescription,
					missingJapaneseTitle,
					missingRomajiTitle,
					volumeCount: s.volumes?.length || 0
				});
			}
			series = allSeriesData;
		} catch (error) {
			console.error('Failed to fetch series:', error);
		} finally {
			isLoading = false;
		}
	}

	// --- Actions: Bulk Scrape ---
	async function startBulkScrape() {
		if (isScraping) return;

		isScraping = true;
		showBulkModal = true;

		// Reset session with current missing list
		scrapingState.session.reset(missingDataSeries.length);
		const queue = [...missingDataSeries];

		for (const s of queue) {
			if (!isScraping) break; // Stop flag

			try {
				const { scraped, current } = await scrapingState.scrapeWithFallback(
					s.id,
					s.title,
					selectedProvider
				);
				if (current) {
					const newItem: ScrapedPreview = {
						id: createId(),
						seriesId: s.id,
						seriesTitle: s.title,
						searchQuery: s.title,
						current,
						scraped: scraped, // Description is already filtered by scrapingState
						status: 'pending'
					};
					scrapingState.session.addIncoming(newItem);
				}
			} catch (e) {
				console.error(e);
			} finally {
				scrapingState.session.incrementScrapedCount();
			}
			// Small delay to prevent UI freezing / rate limits
			await new Promise((r) => setTimeout(r, 200));
		}
		isScraping = false;
	}

	function stopScraping() {
		isScraping = false;
	}

	function clearQueue() {
		stopScraping();
		scrapingState.session.reset(0);
		showBulkModal = false;
	}

	// --- Actions: Single Scrape ---
	async function scrapeSingleSeries(seriesId: string, seriesTitle: string) {
		showSingleModal = true;
		isSingleLoading = true;
		currentPreview = null;

		try {
			const { scraped, current } = await scrapingState.scrapeWithFallback(
				seriesId,
				seriesTitle,
				selectedProvider
			);

			if (current) {
				currentPreview = {
					id: createId(),
					seriesId,
					seriesTitle,
					searchQuery: seriesTitle,
					current,
					scraped,
					status: 'pending'
				};
			} else {
				// Modal handles null preview as "No Results"
				currentPreview = null;
			}
		} catch (e) {
			console.error('Failed to scrape:', e);
			currentPreview = null;
		} finally {
			isSingleLoading = false;
		}
	}

	onMount(() => {
		fetchSeriesWithMissingData();
	});
</script>

<svelte:window bind:innerWidth={width} />

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

		<ScrapeDescriptionFilterPanel />

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
					<circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line
						x1="12"
						y1="8"
						x2="12.01"
						y2="8"
					/>
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
										disabled={isSingleLoading}
										class="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-semibold text-sm disabled:opacity-50"
									>
										Scrape
									</button>
									<button
										onclick={() => scrapingState.excludeSeries(item.id)}
										class="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 font-semibold text-sm hover:bg-red-500/30 transition-colors"
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
									class="px-4 py-2 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent/80 transition-colors"
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
							<circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
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
									onclick={() => scrapingState.restoreSeries(item.id)}
									class="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 font-semibold text-sm hover:bg-green-500/30 transition-colors"
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

<SingleScrapePanel
	isOpen={showSingleModal}
	isLoading={isSingleLoading}
	bind:preview={currentPreview}
	provider={selectedProvider}
	onClose={() => (showSingleModal = false)}
/>

{#if showBulkModal}
	<BulkScrapePanel
		{isScraping}
		provider={selectedProvider}
		onStop={stopScraping}
		onClose={clearQueue}
	/>
{/if}
