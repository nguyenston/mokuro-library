<script lang="ts">
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { apiFetch } from '$lib/api';
	import type { Series as GlobalSeries, Volume as GlobalVolume, LibraryItem } from '$lib/types';
	import { uiState } from '$lib/states/uiState.svelte';
	import { metadataOps } from '$lib/states/metadataOperations.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LibraryActionBar from '$lib/components/LibraryActionBar.svelte';
	import LibraryEntry from '$lib/components/LibraryEntry.svelte';
	import EditSeriesModal from '$lib/components/EditSeriesModal.svelte';
	import type { FilterStatus, FilterMissing, FilterOrganization } from '$lib/states/uiState.svelte';
	import { formatLastReadDate } from '$lib/utils/dateHelpers';

	// --- Type Definitions ---
	interface UserProgress {
		page: number;
		completed: boolean;
	}

	type Volume = Pick<GlobalVolume, 'pageCount' | 'progress'>;

	type Series = Omit<GlobalSeries, 'volumes'> & {
		volumes: Volume[];
	};

	// --- State ---
	let library = $state<Series[]>([]);
	let meta = $state({ total: 0, page: 1, limit: 24, totalPages: 1 });
	let isLoadingLibrary = $state(true);
	let libraryError = $state<string | null>(null);

	let isEditModalOpen = $state(false);
	let editModalTarget: Series | null = $state(null);

	// --- Helper: Calculate Series Progress ---
	const getSeriesProgress = (series: Series) => {
		let totalPages = 0;
		let readPages = 0;
		let completedCount = 0;

		if (!series.volumes || series.volumes.length === 0) return { percent: 0, isRead: false };

		for (const vol of series.volumes) {
			const pCount = vol.pageCount || 0;
			totalPages += pCount;

			const progress = vol.progress?.[0];
			if (progress) {
				if (progress.completed) {
					readPages += pCount;
					completedCount += 1;
				} else {
					readPages += progress.page || 0;
				}
			}
		}

		if (totalPages === 0) return { percent: 0, isRead: false };
		return {
			percent: Math.min(100, Math.max(0, (readPages / totalPages) * 100)),
			isRead: completedCount === series.volumes.length
		};
	};

	// --- Initialization & URL Hydration ---

	onMount(() => {
		// Register Context
		uiState.setContext('library', 'Library', [
			{ key: 'title', label: 'Title' },
			{ key: 'updated', label: 'Last Updated' },
			{ key: 'lastRead', label: 'Recent' }
		]);
	});

	onMount(() => {
		// Hydrate State from URL
		if (browser) {
			const params = page.url.searchParams;

			// Search
			const q = params.get('q');
			if (q !== null && q !== uiState.searchQuery) {
				uiState.searchQuery = q;
			}

			// Sort & Order (Split params)
			const sort = params.get('sort');
			const order = params.get('order');

			if (sort) {
				// Map Backend -> UI
				if (sort === 'updated') uiState.sortKey = 'updated';
				else if (sort === 'recent') uiState.sortKey = 'lastRead';
				else uiState.sortKey = 'title';
			}

			if (order === 'asc' || order === 'desc') {
				uiState.sortOrder = order;
			}

			// Filters
			const status = params.get('status');
			if (status && uiState.filterStatus !== status) {
				uiState.filterStatus = status as FilterStatus;
			}

			const bookmarked = params.get('bookmarked');
			if (bookmarked === 'true') {
				uiState.filterBookmarked = true;
			}

			// Organization
			const isOrganized = params.get('is_organized');
			if (isOrganized === 'true') uiState.filterOrganization = 'organized';
			else if (isOrganized === 'false') uiState.filterOrganization = 'unorganized';
			else uiState.filterOrganization = 'all';

			// Missing Metadata
			const missing = params.get('filter_missing');
			if (missing) {
				uiState.filterMissing = missing as FilterMissing;
			}
		}
	});

	// --- Auth Check ---
	$effect(() => {
		if (browser && $user === null) {
			goto('/login');
		}
		// CLEANUP: Flush pending writes when leaving the library view
		return () => {
			metadataOps.flush();
		};
	});

	// --- Data Fetching & URL Sync ---
	$effect(() => {
		if ($user && browser) {
			// Dependency tracking: include libraryVersion
			const _version = uiState.libraryVersion;

			const currentParams = new URLSearchParams(page.url.searchParams);
			const newParams = new URLSearchParams(currentParams);

			// A. Construct Query Params (Map UI -> Backend)

			// 1. Search
			if (uiState.searchQuery) newParams.set('q', uiState.searchQuery);
			else newParams.delete('q');

			// 2. Sort
			let backendSort = 'title';
			if (uiState.sortKey === 'updated') backendSort = 'updated';
			if (uiState.sortKey === 'lastRead') backendSort = 'recent';

			newParams.set('sort', backendSort);
			newParams.set('order', uiState.sortOrder);

			// 3. Status
			if (uiState.filterStatus !== 'all') {
				newParams.set('status', uiState.filterStatus);
			} else {
				newParams.delete('status');
			}

			// 4. Bookmarked
			if (uiState.filterBookmarked) {
				newParams.set('bookmarked', 'true');
			} else {
				newParams.delete('bookmarked');
			}

			// 5. Organization
			if (uiState.filterOrganization !== 'all') {
				// Map UI 'organized'/'unorganized' -> Backend 'true'/'false'
				newParams.set(
					'is_organized',
					uiState.filterOrganization === 'organized' ? 'true' : 'false'
				);
			} else {
				newParams.delete('is_organized');
			}

			// 6. Missing Metadata
			if (uiState.filterMissing !== 'none') {
				newParams.set('filter_missing', uiState.filterMissing);
			} else {
				newParams.delete('filter_missing');
			}

			// B. Handle Pagination Reset
			// Detect if query criteria changed (excluding page)
			const criteriaChanged =
				currentParams.get('q') !== newParams.get('q') ||
				currentParams.get('sort') !== newParams.get('sort') ||
				currentParams.get('order') !== newParams.get('order') ||
				currentParams.get('status') !== newParams.get('status') ||
				currentParams.get('bookmarked') !== newParams.get('bookmarked') ||
				currentParams.get('is_organized') !== newParams.get('is_organized') ||
				currentParams.get('filter_missing') !== newParams.get('filter_missing');

			if (criteriaChanged) {
				newParams.set('page', '1');
			}

			// C. Update URL
			const queryString = newParams.toString();
			if (queryString !== currentParams.toString()) {
				goto(`?${queryString}`, { replaceState: true, keepFocus: true, noScroll: true });
			}

			// D. Trigger Fetch
			fetchLibrary(`?${queryString}`);
		}
	});

	const fetchLibrary = async (queryString: string, silent = false) => {
		try {
			if (!silent) isLoadingLibrary = true;
			libraryError = null;

			// Backend expects: /api/library?page=1&limit=24&q=...&sort=title&order=asc
			const response = await apiFetch(`/api/library${queryString}`);
			library = response.data as Series[];
			meta = response.meta;
		} catch (e) {
			libraryError = (e as Error).message;
		} finally {
			isLoadingLibrary = false;
		}
	};

	const toggleBookmark = async (e: Event, series: Series) => {
		e.preventDefault();
		e.stopPropagation();

		// 1. Optimistic Update
		const oldState = series.bookmarked;
		series.bookmarked = !series.bookmarked;

		// 2. Sync with Debounce
		metadataOps.syncBookmark(series.id, series.bookmarked, () => {
			// Revert on failure
			series.bookmarked = oldState;
		});
	};

	// --- Actions ---
	//
	const handleOpenEdit = () => {
		const series = Array.from(uiState.selection.values())[0] as Series;
		if (series) {
			editModalTarget = series;
			isEditModalOpen = true;
		}
	};

	const handleCardClick = (e: MouseEvent, series: Series) => {
		if (uiState.isSelectionMode) {
			e.preventDefault();
			e.stopPropagation();
			uiState.toggleSelection(series as GlobalSeries);
		}
	};

	const handleRefresh = () => {
		const params = new URLSearchParams(page.url.searchParams);
		fetchLibrary(`?${params.toString()}`, true);
	};
</script>

<svelte:head>
	<title>{$user ? `${$user.username}'s Library` : 'Loading library...'}</title>
</svelte:head>

<div
	class="flex flex-col min-h-[calc(100vh-5rem)] mx-auto px-4 sm:px-6 pt-1 sm:pt-2 pb-6"
	style="max-width: 1400px;"
>
	{#if isLoadingLibrary && library.length === 0}
		<div class="flex-grow flex items-center justify-center">
			<div
				class="rounded-3xl bg-black/20 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 flex items-center gap-4"
			>
				<svg
					class="animate-spin h-8 w-8 text-accent"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				<span class="text-theme-secondary">Loading library...</span>
			</div>
		</div>
	{:else if libraryError}
		<div class="flex-grow flex items-center justify-center p-4">
			<div
				class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-status-danger/20 text-status-danger shadow-[0_4px_16px_0_rgba(0,0,0,0.3)]"
			>
				Error loading library: {libraryError}
			</div>
		</div>
	{:else if library.length === 0}
		<div class="flex-grow flex flex-col items-center justify-center py-20 text-center">
			<div
				class="rounded-3xl backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 sm:p-12 max-w-md"
			>
				<div
					class="bg-theme-surface-hover backdrop-blur-2xl p-6 rounded-full mb-6 border border-white/5 inline-block"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="48"
						height="48"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-theme-tertiary"
					>
						<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
					</svg>
				</div>
				<p class="text-xl font-medium text-theme-primary mb-2">Your library is empty</p>
				<p class="text-theme-secondary max-w-sm mb-6">
					Upload some Mokuro-processed manga volumes to get started building your collection.
				</p>
				<button
					onclick={() => (uiState.isUploadOpen = true)}
					class="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors shadow-lg shadow-indigo-900/20"
				>
					Upload Now &rarr;
				</button>
			</div>
		</div>
	{:else}
		<div class="flex-grow pb-24 relative">
			<!-- Glassmorphic container wrapper with fade on background only -->
			<div class="relative p-3 sm:p-4">
				<!-- Background layer with fade mask - only fades the background, not content -->
				<div
					class="absolute inset-0 bg-black/20 backdrop-blur-3xl pointer-events-none z-0"
					style="mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); mask-composite: intersect; -webkit-mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%); -webkit-mask-composite: source-in;"
				></div>

				<!-- Content layer (series cards) - fully visible, not affected by fade -->
				<div
					class="relative z-10 {uiState.viewMode === 'grid'
						? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
						: 'flex flex-col gap-3'}"
				>
					{#each library as series (series.id)}
						{@const { percent, isRead } = getSeriesProgress(series)}
						{@const isSelected = uiState.selection.has(series.id)}

						<LibraryEntry
							onLongPress={() => {
								uiState.enterSelectionMode(series as GlobalSeries);
							}}
							entry={{
								id: series.id,
								title: series.title,
								folderName: series.folderName,
								coverUrl: series.coverPath ? `/api/files/series/${series.id}/cover` : null
							}}
							type="series"
							viewMode={uiState.viewMode}
							{isSelected}
							isSelectionMode={uiState.isSelectionMode}
							progress={{
								percent: percent,
								isRead: isRead,
								showBar: percent > 0
							}}
							href={`/series/${series.id}`}
							mainStat={`${series.volumes.length} ${series.volumes.length === 1 ? 'Vol' : 'Vols'}`}
							subStat={formatLastReadDate(series.lastReadAt)}
							onSelect={(e) => handleCardClick(e, series)}
						>
							{#snippet circleAction()}
								<button
									onclick={(e) => toggleBookmark(e, series)}
									class={`z-30 col-start-1 row-start-1 relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 pointer-events-auto hover:bg-white/10 active:scale-75 ${
										series.bookmarked ? 'text-status-warning' : 'text-theme-secondary'
									}`}
									title={series.bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										height="18"
										width="18"
										viewBox="0 0 24 24"
										fill={series.bookmarked ? 'currentColor' : 'none'}
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										class={`relative transition-all ${
											series.bookmarked ? 'animate-pop neon-glow' : 'neon-off'
										}`}
									>
										<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
									</svg>
								</button>
							{/snippet}

							{#snippet listActions()}
								<button
									onclick={(e) => toggleBookmark(e, series)}
									class={`z-30 col-start-1 row-start-1 relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 pointer-events-auto hover:bg-white/10 active:scale-75 ${
										series.bookmarked ? 'text-status-warning' : 'text-theme-secondary'
									}`}
									title={series.bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										height="18"
										width="18"
										viewBox="0 0 24 24"
										fill={series.bookmarked ? 'currentColor' : 'none'}
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										class={`relative transition-all ${
											series.bookmarked ? 'animate-pop neon-glow' : 'neon-off'
										}`}
									>
										<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
									</svg>
								</button>
							{/snippet}
						</LibraryEntry>
					{/each}
				</div>
			</div>
		</div>

		<Footer {meta} />
		<LibraryActionBar type="series" onRefresh={handleRefresh} onRename={handleOpenEdit} />

		<EditSeriesModal
			series={editModalTarget}
			isOpen={isEditModalOpen}
			onClose={() => (isEditModalOpen = false)}
			onRefresh={handleRefresh}
		/>
	{/if}
</div>

<style>
	/* Intensity Control: Change the % next to transparent to adjust glow strength */
	.neon-glow {
		transition: filter 0.6s cubic-bezier(0.4, 0, 0.2, 1);
		filter: drop-shadow(0 0 1px color-mix(in srgb, var(--color-status-warning), transparent 30%))
			drop-shadow(0 0 3px color-mix(in srgb, var(--color-status-warning), transparent 50%))
			drop-shadow(0 0 6px color-mix(in srgb, var(--color-status-warning), transparent 70%));
	}

	.neon-off {
		transition: filter 0.8s ease-in;
		/* Transitioning to 100% transparent version of the SAME variable */
		filter: drop-shadow(0 0 0px color-mix(in srgb, var(--color-status-warning), transparent 100%))
			drop-shadow(0 0 0px color-mix(in srgb, var(--color-status-warning), transparent 100%))
			drop-shadow(0 0 0px color-mix(in srgb, var(--color-status-warning), transparent 100%));
	}

	@keyframes bookmark-pop {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.4);
		}
		100% {
			transform: scale(1);
		}
	}

	.animate-pop {
		animation: bookmark-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}
</style>
