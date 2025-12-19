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
				if (progress.completed) {
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
			{#if uiState.viewMode === 'grid'}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
				>
					{#each library as series (series.id)}
						{@const percent = getSeriesProgress(series)}

						<div
							class={`group relative bg-theme-surface rounded-xl border overflow-hidden transition-all duration-200 flex flex-col ${uiState.selectedIds.has(series.id) ? 'border-accent ring-2 ring-accent ring-offset-2 ring-offset-theme-main' : 'border-theme-border hover:border-theme-border-active'}`}
						>
							{#if uiState.isSelectionMode}
								<div class="absolute top-2 right-2 z-30 pointer-events-none">
									<div
										class={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${uiState.selectedIds.has(series.id) ? 'bg-accent border-accent' : 'bg-black/40 border-white/60'}`}
									>
										{#if uiState.selectedIds.has(series.id)}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="text-white"><polyline points="20 6 9 17 4 12" /></svg
											>
										{/if}
									</div>
								</div>
							{/if}

							<a
								href={`/series/${series.id}`}
								onclick={(e) => handleCardClick(e, series.id)}
								class="absolute inset-0 z-10"
								aria-label={`View ${series.folderName}`}
							></a>

							<div
								class="aspect-[7/11] w-full bg-theme-main relative overflow-hidden pointer-events-none"
							>
								{#if series.coverPath}
									<img
										src={`/api/files/series/${series.id}/cover`}
										alt={series.folderName}
										loading="lazy"
										class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
									/>
								{:else}
									<div
										class="flex h-full w-full items-center justify-center p-4 text-center text-4xl font-bold text-theme-tertiary bg-theme-surface"
									>
										{series.folderName.charAt(0).toUpperCase()}
									</div>
								{/if}

								{#if percent > 0}
									<div class="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
										<div
											class="h-full bg-progress shadow-[0_0_8px_rgba(99,102,241,0.6)]"
											style={`width: ${percent}%`}
										></div>
									</div>
								{/if}

								{#if !uiState.isSelectionMode}
									<div
										class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-start p-2 pointer-events-none z-20"
									>
										<div class="flex justify-end">
											<button
												type="button"
												onclick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													handleDeleteSeries(series.id, series.title ?? series.folderName);
												}}
												class="pointer-events-auto p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-status-danger transition-colors shadow-lg"
												title="Delete Series"
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
													><path d="M3 6h18" /><path
														d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
													/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg
												>
											</button>
										</div>
									</div>
								{/if}
							</div>

							<div class="p-3 flex flex-col gap-1 pointer-events-none bg-theme-surface">
								<div
									class="text-sm font-semibold text-theme-primary line-clamp-1 group-hover:text-accent transition-colors"
								>
									{series.title ?? series.folderName}
								</div>
								<div class="flex items-center justify-between">
									<div class="text-xs text-theme-secondary font-medium">
										{series.volumes.length}
										{series.volumes.length === 1 ? 'Vol' : 'Vols'}
									</div>
									{#if percent === 100}
										<div
											class="h-2 w-2 rounded-full bg-status-success shadow-[0_0_5px_rgba(16,185,129,0.5)]"
											title="Completed"
										></div>
									{:else if percent > 0}
										<div class="text-[10px] font-bold text-progress">{Math.round(percent)}%</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each library as series (series.id)}
						{@const percent = getSeriesProgress(series)}

						<div
							class={`group relative bg-theme-surface rounded-lg border p-2 flex items-center gap-4 transition-all duration-200 ${uiState.selectedIds.has(series.id) ? 'border-accent ring-1 ring-accent' : 'border-theme-border hover:border-theme-border-active'}`}
						>
							{#if uiState.isSelectionMode}
								<div class="pl-2 pointer-events-none z-30">
									<div
										class={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${uiState.selectedIds.has(series.id) ? 'bg-accent border-accent' : 'border-theme-border-light'}`}
									>
										{#if uiState.selectedIds.has(series.id)}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="text-white"><polyline points="20 6 9 17 4 12" /></svg
											>
										{/if}
									</div>
								</div>
							{/if}

							<a
								href={`/series/${series.id}`}
								onclick={(e) => handleCardClick(e, series.id)}
								class="absolute inset-0 z-10"
								aria-label={`View ${series.folderName}`}
							></a>

							<div
								class="w-10 h-14 bg-theme-main rounded overflow-hidden flex-shrink-0 pointer-events-none border border-theme-border relative"
							>
								{#if series.coverPath}
									<img
										src={`/api/files/series/${series.id}/cover`}
										alt={series.folderName}
										class="h-full w-full object-cover"
									/>
								{:else}
									<div
										class="h-full w-full flex items-center justify-center text-xs font-bold text-theme-tertiary"
									>
										{series.folderName.charAt(0)}
									</div>
								{/if}
							</div>

							{#if percent > 0}
								<div class="absolute bottom-0 left-0 right-0 h-1 bg-theme-main/50">
									<div
										class="h-full bg-progress shadow-[0_0_10px_rgba(59,130,246,0.5)]"
										style={`width: ${percent}%`}
									></div>
								</div>
							{/if}

							<div class="flex-grow min-w-0 pointer-events-none">
								<div
									class="text-sm font-semibold text-theme-primary truncate group-hover:text-accent transition-colors"
								>
									{series.title ?? series.folderName}
								</div>
								<div class="text-xs text-theme-secondary flex gap-3 items-center mt-0.5">
									<span class="flex items-center gap-1">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="text-theme-tertiary"
											><path
												d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
											/></svg
										>
										{series.volumes.length} Vols
									</span>
									{#if series.lastReadAt}
										<span class="text-theme-tertiary"
											>• Last read {new Date(series.lastReadAt).toLocaleDateString()}</span
										>
									{/if}
								</div>
							</div>

							{#if !uiState.isSelectionMode}
								<div class="pl-4 border-l border-theme-border relative z-20">
									<button
										type="button"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											handleDeleteSeries(series.id, series.title ?? series.folderName);
										}}
										class="p-2 text-theme-secondary hover:text-status-danger transition-colors rounded-md hover:bg-status-danger/10"
										title="Delete Series"
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
											><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
												d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
											/></svg
										>
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div
			class="fixed bottom-0 left-0 right-0 border-t border-theme-border bg-theme-surface/95 backdrop-blur-md p-4 z-40"
		>
			<div class="max-w-7xl mx-auto flex justify-center">
				<PaginationControls {meta} />
			</div>
		</div>
	{/if}
</div>
