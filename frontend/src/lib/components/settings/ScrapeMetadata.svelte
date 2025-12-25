<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { browser } from '$app/environment';
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';

	let { inReader = false }: { inReader?: boolean } = $props();

	interface SeriesWithMissingData {
		id: string;
		title: string;
		missingCover: boolean;
		missingDescription: boolean;
		volumeCount: number;
	}

	interface ScrapedPreview {
		seriesId: string;
		seriesTitle: string;
		searchQuery: string;
		current: {
			title: string | null;
			japaneseTitle?: string | null;
			romajiTitle?: string | null;
			synonyms?: string | null;
			description: string | null;
			hasCover: boolean;
			coverPath?: string | null;
		};
		scraped: {
			title?: string;
			japaneseTitle?: string;
			romajiTitle?: string;
			synonyms?: string;
			description?: string;
			hasCover?: boolean;
			tempCoverPath?: string; // Changed from coverPath
		};
		status: 'pending' | 'applying' | 'applied' | 'error';
	}

	type FilterMode = 'all' | 'missing-cover' | 'missing-description';

	let width = $state(0);
	let isXs = $derived(width >= 480);
	let isSm = $derived(width >= 640);
	let isMd = $derived(width >= 768);
	let isLg = $derived(width >= 1024);

	let series = $state<SeriesWithMissingData[]>([]);
	let isLoading = $state(true);
	let filterMode = $state<FilterMode>('all');
	let selectedProvider = $state<'anilist' | 'mal' | 'kitsu'>('anilist');

	// Description filters (loaded from localStorage)
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

	// Tracks current scraping preview (for individual scrape)
	let currentPreview = $state<ScrapedPreview | null>(null);
	let isSingleScraping = $state(false);

	// Tracks all pending previews (for bulk scrape)
	let pendingPreviews = $state<ScrapedPreview[]>([]);
	let isBulkScraping = $state(false);

	// Progress tracking for bulk scrape
	let scrapeProgress = $state({
		total: 0,
		scraped: 0,
		confirmed: 0,
		denied: 0
	});

	// Fetch all series and filter those with missing metadata
	// TODO: use backend filtering
	async function fetchSeriesWithMissingData() {
		if (!browser) return;

		try {
			isLoading = true;

			// Fetch all series from the library
			const libraryData = await apiFetch('/api/library?limit=10000');
			const allSeries = libraryData.data || [];

			// Filter series with missing cover or description
			const seriesWithMissing: SeriesWithMissingData[] = [];

			for (const s of allSeries) {
				const missingCover = !s.coverPath;
				const missingDescription = !s.description || s.description.trim() === '';

				if (missingCover || missingDescription) {
					seriesWithMissing.push({
						id: s.id,
						title: s.title || s.folderName,
						missingCover,
						missingDescription,
						volumeCount: s.volumes?.length || 0
					});
				}
			}

			series = seriesWithMissing;
		} catch (error) {
			console.error('Failed to fetch series:', error);
		} finally {
			isLoading = false;
		}
	}

	// Filter series based on selected filter mode
	const filteredSeries = $derived.by(() => {
		if (filterMode === 'all') return series;
		if (filterMode === 'missing-cover') return series.filter((s) => s.missingCover);
		if (filterMode === 'missing-description') return series.filter((s) => s.missingDescription);
		return series;
	});

	// Apply all enabled filters to description
	function filterDescription(description: string | undefined): string | undefined {
		if (!description) return description;

		let result = description;

		for (const filter of descriptionFilters) {
			if (!filter.enabled) continue;

			try {
				if (filter.isRegex) {
					const regex = new RegExp(filter.pattern, 'gi');
					result = result.replace(regex, '');
				} else {
					// Simple text replacement
					result = result.split(filter.pattern).join('');
				}
			} catch (e) {
				console.warn(`Invalid filter pattern: ${filter.pattern}`, e);
			}
		}

		// Clean up excessive whitespace
		result = result.replace(/\s+/g, ' ').trim();

		return result;
	}

	// Save filters to localStorage
	function saveFilters() {
		if (browser) {
			localStorage.setItem('mokuro_scrape_description_filters', JSON.stringify(descriptionFilters));
		}
	}

	// Load filters from localStorage
	function loadFilters() {
		if (browser) {
			const saved = localStorage.getItem('mokuro_scrape_description_filters');
			if (saved) {
				try {
					descriptionFilters = JSON.parse(saved);
				} catch (e) {
					console.error('Failed to load filters:', e);
					descriptionFilters = [];
				}
			}
		}
	}

	// Add default filters
	function addDefaultFilters() {
		const newFilters = defaultFilters.map((f) => ({
			...f,
			id: crypto.randomUUID(),
			enabled: true
		}));
		descriptionFilters = [...descriptionFilters, ...newFilters];
		saveFilters();
	}

	// Add custom filter
	function addCustomFilter() {
		if (!newFilterText.trim()) return;

		descriptionFilters = [
			...descriptionFilters,
			{
				id: crypto.randomUUID(),
				pattern: newFilterText,
				enabled: true,
				isRegex: newFilterIsRegex
			}
		];

		newFilterText = '';
		newFilterIsRegex = false;
		saveFilters();
	}

	// Remove filter
	function removeFilter(id: string) {
		descriptionFilters = descriptionFilters.filter((f) => f.id !== id);
		saveFilters();
	}

	// Toggle filter enabled state
	function toggleFilter(id: string) {
		descriptionFilters = descriptionFilters.map((f) =>
			f.id === id ? { ...f, enabled: !f.enabled } : f
		);
		saveFilters();
	}

	// Scrape metadata for a single series (shows preview)
	async function scrapeSingleSeries(seriesId: string, seriesTitle: string) {
		try {
			isSingleScraping = true;

			console.log('Scraping metadata for:', { seriesId, seriesTitle, provider: selectedProvider });

			const response = await apiFetch('/api/metadata/series/scrape', {
				method: 'POST',
				body: {
					seriesId,
					seriesName: seriesTitle,
					provider: selectedProvider
				}
			});

			console.log('Scrape response:', response);

			if (response.error) {
				console.error('Scrape failed:', response.error);
				alert(`Failed to scrape metadata: ${response.error}`);
				return;
			}

			// Show preview modal with filtered description
			currentPreview = {
				seriesId,
				seriesTitle,
				searchQuery: seriesTitle,
				current: response.current,
				scraped: {
					...response.scraped,
					description: filterDescription(response.scraped.description),
					tempCoverPath: response.scraped.tempCoverPath
				},
				status: 'pending'
			};
		} catch (error) {
			console.error(`Failed to scrape metadata for ${seriesTitle}:`, error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			alert(
				`Failed to scrape metadata for "${seriesTitle}":\n\n${errorMessage}\n\nCheck the browser console (F12) for more details.`
			);
		} finally {
			isSingleScraping = false;
		}
	}

	// Apply scraped metadata after confirmation
	async function applyMetadata(preview: ScrapedPreview) {
		preview.status = 'applying';

		try {
			// Updated to PATCH /api/metadata/series/:id
			await apiFetch(`/api/metadata/series/${preview.seriesId}`, {
				method: 'PATCH',
				body: {
					title: preview.scraped.title,
					japaneseTitle: preview.scraped.japaneseTitle,
					romajiTitle: preview.scraped.romajiTitle,
					synonyms: preview.scraped.synonyms,
					description: preview.scraped.description,
					tempCoverPath: preview.scraped.tempCoverPath
				}
			});

			preview.status = 'applied';

			// Remove from pending list if in bulk mode
			if (isBulkScraping) {
				scrapeProgress.confirmed++;
				pendingPreviews = pendingPreviews.filter((p) => p.seriesId !== preview.seriesId);
				// Auto-close bulk modal when all items are processed
				if (pendingPreviews.length === 0) {
					isBulkScraping = false;
				}
			}

			// Close single preview modal
			if (currentPreview?.seriesId === preview.seriesId) {
				currentPreview = null;
			}

			// Refresh the list
			await fetchSeriesWithMissingData();
		} catch (error) {
			console.error('Failed to apply metadata:', error);
			preview.status = 'error';
		}
	}

	// Deny/skip scraped metadata
	function denyMetadata(preview: ScrapedPreview | null) {
		if (!preview) return;
		if (isBulkScraping) {
			scrapeProgress.denied++;
			pendingPreviews = pendingPreviews.filter((p) => p.seriesId !== preview.seriesId);
			// Auto-close bulk modal when all items are processed
			if (pendingPreviews.length === 0) {
				isBulkScraping = false;
			}
		}
		if (currentPreview?.seriesId === preview.seriesId) {
			currentPreview = null;
		}
	}

	// Scrape all filtered series (bulk mode) with progressive loading
	async function scrapeAll() {
		isBulkScraping = true;
		pendingPreviews = [];

		const seriesToScrape = filteredSeries;

		// Initialize progress tracker
		scrapeProgress = {
			total: seriesToScrape.length,
			scraped: 0,
			confirmed: 0,
			denied: 0
		};

		// Progressive loading: add results as they come in
		for (const s of seriesToScrape) {
			try {
				const response = await apiFetch('/api/metadata/series/scrape', {
					method: 'POST',
					body: {
						seriesId: s.id,
						seriesName: s.title,
						provider: selectedProvider
					}
				});

				if (!response.error) {
					// Add to pendingPreviews immediately so it appears in UI
					pendingPreviews = [
						...pendingPreviews,
						{
							seriesId: s.id,
							seriesTitle: s.title,
							searchQuery: s.title,
							current: response.current,
							scraped: {
								...response.scraped,
								description: filterDescription(response.scraped.description)
							},
							status: 'pending'
						}
					];

					// Update progress
					scrapeProgress.scraped++;
				} else {
					// Still count as scraped even if error
					scrapeProgress.scraped++;
				}

				// Add delay to avoid rate limiting
				await new Promise((resolve) => setTimeout(resolve, 1000));
			} catch (error) {
				console.error(`Failed to scrape ${s.title}:`, error);
				scrapeProgress.scraped++;
			}
		}
	}

	// Re-scrape with updated search query
	async function rescrapeWithQuery(preview: ScrapedPreview) {
		try {
			preview.status = 'applying';

			const response = await apiFetch('/api/metadata/series/scrape', {
				method: 'POST',
				body: {
					seriesId: preview.seriesId,
					seriesName: preview.searchQuery,
					provider: selectedProvider
				}
			});

			if (response.error) {
				console.error('Re-scrape failed:', response.error);
				preview.status = 'error';
				return;
			}

			// Update the preview with new scraped data
			preview.current = response.current;
			preview.scraped = {
				...response.scraped,
				description: filterDescription(response.scraped.description)
			};
			preview.status = 'pending';
		} catch (error) {
			console.error(`Failed to re-scrape metadata:`, error);
			preview.status = 'error';
		}
	}

	// Cleanup: save filters when component is destroyed
	$effect(() => {
		return () => {
			saveFilters();
		};
	});

	onMount(() => {
		loadFilters();
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
		<!-- Provider Selection -->
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

		<!-- Filter Options -->
		<MenuGridRadio
			title="Filter"
			tooltip="Filter series by what metadata is missing"
			bind:value={filterMode}
			layout={isXs ? [3] : [1, 1, 1]}
			options={[
				{ value: 'all', label: 'All Missing' },
				{ value: 'missing-cover', label: 'Missing Cover' },
				{ value: 'missing-description', label: 'Missing Desc' }
			]}
		/>

		<!-- Advanced Description Filters -->
		<div
			class="rounded-2xl backdrop-blur-2xl p-6 border border-theme-primary/10 shadow-theme-secondary/20 shadow-lg space-y-3"
		>
			<div class="flex items-center justify-between mb-2">
				<div>
					<p class="text-[10px] font-bold text-theme-secondary uppercase tracking-[0.2em]">
						Description Filters
					</p>
					<p class="text-xs text-theme-secondary mt-1">
						Remove unwanted text from descriptions (source tags, HTML, etc.)
					</p>
				</div>
				<div class="flex gap-2">
					{#if descriptionFilters.length === 0}
						<button
							onclick={addDefaultFilters}
							class="px-3 py-1 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-xs font-semibold"
						>
							Add Defaults
						</button>
					{/if}
					<button
						onclick={() => (showFilterManager = !showFilterManager)}
						class="px-3 py-1 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-xs font-semibold"
					>
						{showFilterManager ? 'Close' : 'Manage'} ({descriptionFilters.filter((f) => f.enabled)
							.length})
					</button>
				</div>
			</div>

			{#if showFilterManager}
				<!-- Add New Filter -->
				<div class="p-4 rounded-xl bg-theme-surface border border-theme-border space-y-3">
					<p class="text-xs font-semibold text-theme-primary">Add New Filter</p>
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={newFilterText}
							placeholder="Text or regex pattern..."
							class="flex-1 px-3 py-2 rounded-lg bg-theme-main border border-theme-border text-theme-primary placeholder-gray-500 focus:border-accent focus:outline-none transition-colors text-sm font-mono"
						/>
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

				<!-- Active Filters List -->
				<div class="space-y-2 max-h-96 overflow-y-auto">
					{#if descriptionFilters.length === 0}
						<div class="text-center py-8 text-theme-secondary text-sm">
							No filters configured. Click "Add Defaults" to get started.
						</div>
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
									class="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
									title="Remove filter"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
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
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Summary Card -->
		<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
			<div class="flex {isXs ? 'flex-row' : 'flex-col gap-2'} items-center justify-between mb-4">
				<div class="flex items-center gap-2">
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
				{#if !isLoading}
					<button
						onclick={scrapeAll}
						disabled={filteredSeries.length === 0 || isBulkScraping}
						class="px-4 py-2 rounded-xl bg-accent text-white font-semibold
              text-sm hover:bg-accent/80 transition-colors disabled:opacity-50
              disabled:cursor-not-allowed {isXs ? '' : 'w-full'}"
					>
						{isBulkScraping ? 'Scraping...' : `Scrape All (${filteredSeries.length})`}
					</button>
				{/if}
			</div>

			{#if isLoading}
				<div class="text-center py-8">
					<div class="text-theme-secondary">Loading series...</div>
				</div>
			{:else}
				<div class="grid grid-cols-3 gap-4">
					<div class="text-center">
						<div class="text-2xl font-bold theme-primary">{series.length}</div>
						<div class="text-xs text-gray-400 mt-1">Total Missing</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold theme-primary">
							{series.filter((s) => s.missingCover).length}
						</div>
						<div class="text-xs text-gray-400 mt-1">Missing Cover</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold theme-primary">
							{series.filter((s) => s.missingDescription).length}
						</div>
						<div class="text-xs text-gray-400 mt-1">Missing Description</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Series List -->
		{#if !isBulkScraping}
			<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
				<div class="mb-4 flex {isXs ? 'flex-row' : 'flex-col gap-2'} items-center gap-2">
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
						Series with Missing Data
					</p>
				</div>

				{#if isLoading}
					<div class="text-center py-8">
						<div class="text-theme-secondary">Loading...</div>
					</div>
				{:else if filteredSeries.length === 0}
					<div class="text-center py-8">
						<div class="text-theme-secondary">
							{filterMode === 'all'
								? 'All series have complete metadata!'
								: `No series found with ${filterMode === 'missing-cover' ? 'missing covers' : 'missing descriptions'}.`}
						</div>
					</div>
				{:else}
					<div class="space-y-3 max-h-[600px] overflow-y-auto">
						{#each filteredSeries as item (item.id)}
							<div
								class="flex {isXs
									? 'flex-row items-center'
									: 'flex-col gap-2'} gap-4 p-4 rounded-xl bg-theme-surface
                  hover:bg-theme-surface-hover transition-colors"
							>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold theme-primary truncate">
										{item.title}
									</p>
									<div class="flex items-center gap-2 mt-1">
										<span class="text-xs text-gray-400"
											>{item.volumeCount} {item.volumeCount === 1 ? 'Vol' : 'Vols'}</span
										>
										{#if item.missingCover}
											<span
												class="px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] font-bold uppercase"
											>
												No Cov
											</span>
										{/if}
										{#if item.missingDescription}
											<span
												class="px-1.5 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/50 text-orange-400 text-[10px] font-bold uppercase"
											>
												No Desc
											</span>
										{/if}
									</div>
								</div>

								<button
									onclick={() => scrapeSingleSeries(item.id, item.title)}
									disabled={isSingleScraping}
									class="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-all
                    duration-200 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed
                    flex justify-center gap-2 {isXs ? '' : 'w-full'}"
								>
									{#if isSingleScraping}
										<svg
											class="animate-spin h-4 w-4"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											></circle>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
									{/if}
									{isSingleScraping ? 'Scraping...' : 'Scrape'}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Single Preview Modal -->
{#if currentPreview}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default w-full h-full border-none p-0"
			onclick={() => denyMetadata(currentPreview)}
			aria-label="Close modal"
		></button>

		<div
			class="relative z-10 bg-theme-surface rounded-2xl border border-theme-border max-w-4xl w-full max-h-[90vh] overflow-y-auto"
		>
			{@render previewCard(currentPreview, true)}
		</div>
	</div>
{/if}

<!-- Bulk Scrape Modal -->
{#if isBulkScraping}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div
			class="bg-theme-main rounded-2xl border border-accent max-w-6xl w-full max-h-[90vh] overflow-y-auto"
		>
			<div class="sticky top-0 bg-theme-main border-b border-accent p-6 z-10">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
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
							class="text-accent"
						>
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
							<polyline points="22 4 12 14.01 9 11.01" />
						</svg>
						<div>
							<h2 class="text-xl font-bold text-white">Bulk Scrape Results</h2>
							<p class="text-sm text-theme-secondary">
								Review & confirm {pendingPreviews.length} pending changes
							</p>
						</div>
					</div>
					<button
						onclick={() => {
							pendingPreviews = [];
							isBulkScraping = false;
						}}
						class="p-2 text-theme-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors"
						title="Close and discard all"
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

				<!-- Progress Tracker -->
				<div class="grid grid-cols-3 gap-4 text-center">
					<div class="p-3 rounded-xl bg-theme-surface border border-theme-border">
						<div class="text-2xl font-bold text-accent">
							{scrapeProgress.scraped}/{scrapeProgress.total}
						</div>
						<div class="text-xs text-gray-400 mt-1">Scraped</div>
					</div>
					<div class="p-3 rounded-xl bg-theme-surface border border-green-500/30">
						<div class="text-2xl font-bold text-green-400">{scrapeProgress.confirmed}</div>
						<div class="text-xs text-gray-400 mt-1">Confirmed</div>
					</div>
					<div class="p-3 rounded-xl bg-theme-surface border border-red-500/30">
						<div class="text-2xl font-bold text-red-400">{scrapeProgress.denied}</div>
						<div class="text-xs text-gray-400 mt-1">Denied</div>
					</div>
				</div>
			</div>

			<div class="p-6 space-y-4">
				{#if pendingPreviews.length === 0}
					<div class="text-center py-12">
						<svg
							class="animate-spin h-12 w-12 text-accent mx-auto mb-4"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<p class="text-theme-secondary text-lg font-medium">Scraping metadata...</p>
						<p class="text-theme-tertiary text-sm mt-2">
							Results will appear here as they complete
						</p>
					</div>
				{:else}
					{#each pendingPreviews as preview (preview.seriesId)}
						{@render previewCard(preview)}
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}

{#snippet previewCard(preview: ScrapedPreview, isModal = false)}
	<div class="p-6 {isModal ? '' : 'rounded-xl bg-theme-surface border border-theme-border'}">
		<div class="mb-4">
			<h3 class="text-xl font-bold text-theme-primary mb-1">{preview.seriesTitle}</h3>
			<p class="text-xs text-theme-secondary">Review changes before applying</p>
		</div>

		<!-- Editable Search Query -->
		<div class="mb-6 p-4 rounded-xl bg-theme-main border border-theme-border">
			<div class="block text-xs text-theme-secondary mb-2">Search Query (edit if needed)</div>
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={preview.searchQuery}
					placeholder="Enter title to search for..."
					class="flex-1 px-3 py-2 rounded-lg bg-theme-surface border border-theme-border text-theme-primary placeholder-gray-500 focus:border-accent focus:outline-none transition-colors text-sm"
				/>
				<button
					onclick={() => rescrapeWithQuery(preview)}
					disabled={preview.status === 'applying' || !preview.searchQuery.trim()}
					class="px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm flex items-center gap-2"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class={preview.status === 'applying' ? 'animate-spin' : ''}
					>
						<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
						<path d="M21 3v5h-5" />
					</svg>
					{preview.status === 'applying' ? 'Searching...' : 'Re-scrape'}
				</button>
			</div>
			<p class="text-xs text-theme-tertiary mt-2">
				Tip: Try using the English or Japanese title if the current query doesn't find the right
				match
			</p>
		</div>

		<div class="mb-6">
			<!-- Column Headers -->
			<div class="grid grid-cols-2 gap-6 mb-6">
				<div class="flex items-center gap-2">
					<div class="w-2 h-2 rounded-full bg-gray-500"></div>
					<h4 class="text-sm font-bold text-theme-tertiary uppercase tracking-wider">Current</h4>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-2 h-2 rounded-full bg-accent"></div>
					<h4 class="text-sm font-bold text-accent uppercase tracking-wider">Scraped</h4>
				</div>
			</div>

			<!-- Title Row -->
			<div class="grid grid-cols-2 gap-6 mb-4">
				<div>
					<p class="text-xs text-theme-secondary mb-1">Title (English/Romaji)</p>
					<p class="text-sm text-theme-primary">
						{#if preview.current.title}
							{preview.current.title}
						{:else}
							<span class="text-theme-secondary italic">None</span>
						{/if}
					</p>
				</div>
				<div>
					<p class="text-xs text-theme-secondary mb-1">Title (English/Romaji)</p>
					<p class="text-sm text-theme-primary">
						{#if preview.scraped.title}
							{preview.scraped.title}
						{:else}
							<span class="text-theme-secondary italic">No change</span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Japanese Title Row -->
			<div class="grid grid-cols-2 gap-6 mb-4">
				<div>
					<p class="text-xs text-theme-secondary mb-1">Japanese Title (Kanji/Kana)</p>
					<p class="text-sm text-theme-primary">
						{#if preview.current.japaneseTitle}
							{preview.current.japaneseTitle}
						{:else}
							<span class="text-theme-secondary italic">None</span>
						{/if}
					</p>
				</div>
				<div>
					<p class="text-xs text-theme-secondary mb-1">Japanese Title (Kanji/Kana)</p>
					<p class="text-sm text-theme-primary">
						{#if preview.scraped.japaneseTitle}
							{preview.scraped.japaneseTitle}
						{:else}
							<span class="text-theme-secondary italic">No change</span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Romaji Title Row -->
			<div class="grid grid-cols-2 gap-6 mb-4">
				<div>
					<p class="text-xs text-theme-secondary mb-1">Romaji Title</p>
					<p class="text-sm text-theme-primary">
						{#if preview.current.romajiTitle}
							{preview.current.romajiTitle}
						{:else}
							<span class="text-theme-secondary italic">None</span>
						{/if}
					</p>
				</div>
				<div>
					<p class="text-xs text-theme-secondary mb-1">Romaji Title</p>
					<p class="text-sm text-theme-primary">
						{#if preview.scraped.romajiTitle}
							{preview.scraped.romajiTitle}
						{:else}
							<span class="text-theme-secondary italic">No change</span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Synonyms Row -->
			<div class="grid grid-cols-2 gap-6 mb-4">
				<div>
					<p class="text-xs text-theme-secondary mb-1">Alternative Titles (Synonyms)</p>
					<p class="text-sm text-theme-primary">
						{#if preview.current.synonyms}
							{@const parsedSynonyms = JSON.parse(preview.current.synonyms)}
							{#if Array.isArray(parsedSynonyms) && parsedSynonyms.length > 0}
								{parsedSynonyms.join(', ')}
							{:else}
								<span class="text-theme-secondary italic">None</span>
							{/if}
						{:else}
							<span class="text-theme-secondary italic">None</span>
						{/if}
					</p>
				</div>
				<div>
					<p class="text-xs text-theme-secondary mb-1">Alternative Titles (Synonyms)</p>
					<p class="text-sm text-theme-primary">
						{#if preview.scraped.synonyms}
							{@const parsedSynonyms = JSON.parse(preview.scraped.synonyms)}
							{#if Array.isArray(parsedSynonyms) && parsedSynonyms.length > 0}
								{parsedSynonyms.join(', ')}
							{:else}
								<span class="text-theme-secondary italic">No change</span>
							{/if}
						{:else}
							<span class="text-theme-secondary italic">No change</span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Description Row -->
			<div class="grid grid-cols-2 gap-6 mb-4">
				<div>
					<p class="text-xs text-theme-secondary mb-1">Description</p>
					<div class="h-20 overflow-hidden">
						<p class="text-sm theme-primary line-clamp-4">
							{#if preview.current.description}
								{preview.current.description}
							{:else}
								<span class="text-theme-secondary italic">None</span>
							{/if}
						</p>
					</div>
				</div>
				<div>
					<p class="text-xs text-theme-secondary mb-1">Description</p>
					<div class="h-20 overflow-hidden">
						<p class="text-sm theme-primary line-clamp-4">
							{#if preview.scraped.description}
								{@html preview.scraped.description}
							{:else}
								<span class="text-theme-secondary italic">No change</span>
							{/if}
						</p>
					</div>
				</div>
			</div>

			<!-- Cover Row -->
			<div class="grid grid-cols-2 gap-6">
				<div>
					<p class="text-xs text-theme-secondary mb-2">Cover</p>
					{#if preview.current.coverPath}
						<img
							src="/api/files/series/{preview.seriesId}/cover"
							alt="Current cover"
							class="w-32 h-48 object-cover rounded-lg border border-theme-border"
						/>
					{:else}
						<div
							class="w-32 h-48 rounded-lg border-2 border-dashed border-theme-border flex items-center justify-center"
						>
							<span class="text-sm text-red-400">No cover</span>
						</div>
					{/if}
				</div>
				<div>
					<p class="text-xs text-theme-secondary mb-2">Cover</p>
					{#if preview.scraped.tempCoverPath}
						<div class="relative">
							<img
								src="/api/files/preview?path={encodeURIComponent(preview.scraped.tempCoverPath)}"
								alt="Scraped cover"
								class="w-32 h-48 object-cover rounded-lg border-2 border-accent shadow-lg shadow-accent/20"
							/>
							<div
								class="absolute -top-2 -right-2 bg-accent text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg"
							>
								NEW
							</div>
						</div>
					{:else if preview.scraped.hasCover}
						<div
							class="w-32 h-48 rounded-lg border border-theme-border flex items-center justify-center bg-theme-surface"
						>
							<span class="text-sm text-green-400">✓ Has cover</span>
						</div>
					{:else}
						<div
							class="w-32 h-48 rounded-lg border border-theme-border flex items-center justify-center bg-theme-surface"
						>
							<span class="text-sm text-theme-secondary italic">No change</span>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex gap-3 justify-end">
			<button
				onclick={() => denyMetadata(preview)}
				disabled={preview.status === 'applying'}
				class="px-6 py-2 rounded-lg bg-theme-main border border-theme-border text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
			>
				Skip
			</button>
			<button
				onclick={() => applyMetadata(preview)}
				disabled={preview.status === 'applying'}
				class="px-6 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
			>
				{preview.status === 'applying' ? 'Applying...' : 'Confirm'}
			</button>
		</div>
	</div>
{/snippet}

<style>
	.line-clamp-4 {
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
