<script lang="ts">
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { apiFetch } from '$lib/api';
	import { confirmation } from '$lib/confirmationStore';
	import { uiState } from '$lib/states/uiState.svelte';
	import PaginationControls from '$lib/components/PaginationControls.svelte';
	import LibraryEntry from '$lib/components/LibraryEntry.svelte';

	// --- Type Definitions ---
	interface UserProgress {
		page: number;
		completed: boolean;
	}

	interface Volume {
		id: string;
		title: string | null;
		folderName: string;
		pageCount: number;
		progress: UserProgress[];
	}

	interface Series {
		id: string;
		title: string | null;
		folderName: string;
		coverPath: string | null;
		volumes: Volume[];
		updatedAt: string;
		lastReadAt?: string | null;
	}

	// --- State ---
	let library = $state<Series[]>([]);
	let meta = $state({ total: 0, page: 1, limit: 24, totalPages: 1 });
	let isLoadingLibrary = $state(true);
	let libraryError = $state<string | null>(null);

	// --- Helper: Calculate Series Progress ---
	const getSeriesProgress = (series: Series) => {
		let totalPages = 0;
		let readPages = 0;

		if (!series.volumes || series.volumes.length === 0) return 0;

		for (const vol of series.volumes) {
			const pCount = vol.pageCount || 0;
			totalPages += pCount;

			const progress = vol.progress?.[0];
			if (progress) {
				// Only consider completed if page number has reached the last page (pageCount)
				// Note: page numbers are typically 1-indexed, so we check if page >= pageCount
				const actuallyCompleted = progress.completed && progress.page >= pCount;

				if (actuallyCompleted) {
					readPages += pCount;
				} else {
					readPages += progress.page || 0;
				}
			}
		}

		if (totalPages === 0) return 0;
		return Math.min(100, Math.max(0, (readPages / totalPages) * 100));
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
			const params = $page.url.searchParams;

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

			// Filter (Note: Backend currently ignores 'status', but we keep it in URL for future)
			const status = params.get('status');
			// if (status && uiState.filterStatus !== status) {
			// 	uiState.filterStatus = status;
			// }
		}
	});

	// --- Auth Check ---
	$effect(() => {
		if (browser && $user === null) {
			goto('/login');
		}
	});

	// --- Data Fetching & URL Sync ---
	$effect(() => {
		if ($user && browser) {
			const currentParams = new URLSearchParams($page.url.searchParams);
			const newParams = new URLSearchParams(currentParams);

			// A. Construct Query Params (Map UI -> Backend)

			// 1. Search (q)
			if (uiState.searchQuery) newParams.set('q', uiState.searchQuery);
			else newParams.delete('q');

			// 2. Sort & Order (Separate keys, matching backend library.ts)
			let backendSort = 'title';
			if (uiState.sortKey === 'updated') backendSort = 'updated';
			if (uiState.sortKey === 'lastRead') backendSort = 'recent'; // 'recent' maps to lastReadAt in backend

			newParams.set('sort', backendSort);
			newParams.set('order', uiState.sortOrder);

			// 3. Status (Client-side tracking for now)
			if (uiState.filterStatus !== 'all') {
				newParams.set('status', uiState.filterStatus);
			} else {
				newParams.delete('status');
			}

			// B. Handle Pagination Reset
			// Detect if query criteria changed (excluding page)
			const criteriaChanged =
				currentParams.get('q') !== newParams.get('q') ||
				currentParams.get('sort') !== newParams.get('sort') ||
				currentParams.get('order') !== newParams.get('order') ||
				currentParams.get('status') !== newParams.get('status');

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

	// --- Actions ---
	const handleDeleteSeries = (seriesId: string, seriesTitle: string) => {
		confirmation.open(
			'Delete Series?',
			`Are you sure you want to permanently delete "${seriesTitle}" and all ${
				library.find((s) => s.id === seriesId)?.volumes.length ?? 'its'
			} volumes?`,
			async () => {
				try {
					await apiFetch(`/api/library/series/${seriesId}`, { method: 'DELETE' });
					const params = new URLSearchParams($page.url.searchParams);
					fetchLibrary(`?${params.toString()}`, true);
				} catch (e) {
					libraryError = `Failed to delete series: ${(e as Error).message}`;
				}
			}
		);
	};

	const openSeriesContextMenu = (e: MouseEvent, series: Series) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
		contextMenu.open(rect.left, rect.bottom, [
			{ label: 'View Files', action: () => console.log('View Files - TBD') },
			{ label: 'Version History', action: () => console.log('Version History - TBD') },
			{ separator: true },
			{
				label: 'Download',
				action: () => {
					// TODO: Add download functionality
					console.log('Download series:', series.id);
				}
			},
			{ separator: true },
			{ label: 'Bookmark Series', action: () => console.log('Bookmark Series - TBD') },
			{ separator: true },
			{
				label: 'Delete Series',
				action: () => handleDeleteSeries(series.id, series.title ?? series.folderName)
			}
		]);
	};

	const handleCardClick = (e: MouseEvent, seriesId: string) => {
		if (uiState.isSelectionMode) {
			e.preventDefault();
			e.stopPropagation();
			uiState.toggleSelection(seriesId);
		}
	};
</script>

<div class="flex flex-col min-h-[calc(100vh-5rem)] max-w-7xl mx-auto p-4 sm:p-6">
	{#if isLoadingLibrary && library.length === 0}
		<div class="flex-grow flex items-center justify-center text-theme-secondary">
			<svg
				class="animate-spin -ml-1 mr-3 h-8 w-8 text-accent"
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
			Loading library...
		</div>
	{:else if libraryError}
		<div class="flex-grow p-4">
			<div
				class="p-4 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger"
			>
				Error loading library: {libraryError}
			</div>
		</div>
	{:else if library.length === 0}
		<div class="flex-grow flex flex-col items-center justify-center py-20 text-center">
			<div class="bg-theme-surface p-6 rounded-full mb-4 shadow-lg shadow-black/20">
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
			<p class="text-xl font-medium text-theme-primary">Your library is empty</p>
			<p class="mt-2 text-theme-secondary max-w-sm">
				Upload some Mokuro-processed manga volumes to get started building your collection.
			</p>
			<button
				onclick={() => (uiState.isUploadOpen = true)}
				class="mt-6 text-accent hover:text-accent-hover font-medium hover:underline transition-colors"
			>
				Upload Now &rarr;
			</button>
		</div>
	{:else}
		<div class="flex-grow pb-24">
			<div
				class={uiState.viewMode === 'grid'
					? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
					: 'flex flex-col gap-3'}
			>
				{#each library as series (series.id)}
					{@const percent = getSeriesProgress(series)}
					{@const isSelected = uiState.selectedIds.has(series.id)}

					<LibraryEntry
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
							isRead: percent === 100,
							showBar: percent > 0
						}}
						href={`/series/${series.id}`}
						mainStat={`${series.volumes.length} ${series.volumes.length === 1 ? 'Vol' : 'Vols'}`}
						subStat={series.lastReadAt
							? `Last read ${new Date(series.lastReadAt).toLocaleDateString()}`
							: ''}
						onSelect={(e) => handleCardClick(e, series.id)}
					>
						{#snippet menuAction()}
							<button
								type="button"
								onclick={(e) => openSeriesContextMenu(e, series)}
								class="p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-theme-surface-hover transition-colors shadow-lg"
								title="Series Actions"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle
										cx="12"
										cy="19"
										r="1"
									/></svg
								>
							</button>
						{/snippet}

						{#snippet listActions()}
							<button
								type="button"
								onclick={(e) => openSeriesContextMenu(e, series)}
								class="p-2 text-theme-secondary hover:text-white transition-colors rounded-md hover:bg-theme-surface-hover"
								title="Series Actions"
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
									><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle
										cx="12"
										cy="19"
										r="1"
									/></svg
								>
							</button>
						{/snippet}
					</LibraryEntry>
				{/each}
			</div>
		</div>

		<div class="fixed bottom-0 left-0 right-0 bg-transparent p-6 z-40">
			<div class="max-w-7xl mx-auto flex justify-center">
				<PaginationControls {meta} />
			</div>
		</div>
	{/if}
</div>
