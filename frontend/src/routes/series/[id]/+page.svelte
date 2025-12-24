<script lang="ts">
	import { apiFetch, triggerDownload } from '$lib/api';
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { confirmation } from '$lib/confirmationStore';
	import { contextMenu } from '$lib/contextMenuStore';
	import { uiState } from '$lib/states/uiState.svelte';
	import { metadataOps } from '$lib/states/metadataOperations.svelte';

	import EditSeriesModal from '$lib/components/EditSeriesModal.svelte';
	import EditVolumeModal from '$lib/components/EditVolumeModal.svelte';
	import LibraryEntry from '$lib/components/LibraryEntry.svelte';
	import LibraryActionBar from '$lib/components/LibraryActionBar.svelte';
	import LibraryListWrapper from '$lib/components/LibraryListWrapper.svelte';
	import SeriesHero from '$lib/components/SeriesHero.svelte';

	// --- Type Definitions ---
	interface UserProgress {
		page: number;
		completed: boolean;
		timeRead: number;
		charsRead: number;
		lastReadAt?: string;
	}
	interface Volume {
		id: string;
		title: string | null;
		folderName: string;
		sortTitle: string;
		pageCount: number;
		coverImageName: string | null;
		createdAt: string;
		progress: UserProgress[];
	}
	interface Series {
		id: string;
		title: string | null;
		folderName: string;
		description: string | null;
		coverPath: string | null;
		volumes: Volume[];
		bookmarked?: boolean;
	}

	let { params } = $props<{ params: { id: string } }>();

	// --- State ---
	let series = $state<Series | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let seriesId = $derived(params.id);

	let coverRefreshTrigger = $state(0);

	let isEditSeriesOpen = $state(false);
	let isEditVolumeOpen = $state(false);
	let editVolumeTarget = $state<{ id: string; title: string | null } | null>(null);

	// --- Helpers ---
	const formatTime = (seconds: number) => {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	};

	const getVolumeStats = (vol: Volume) => {
		const p = vol.progress?.[0];
		const currentPage = p?.page ?? 0;
		const isRead = p?.completed ?? false;
		const percent = isRead
			? 100
			: Math.min(100, Math.max(0, (currentPage / (vol.pageCount || 1)) * 100));
		const lastRead = p?.lastReadAt ? new Date(p.lastReadAt).getTime() : 0;
		return { isRead, percent, lastRead };
	};

	// --- Derived State ---
	let processedVolumes = $derived.by(() => {
		if (!series) return [];
		let vols = [...series.volumes];

		if (uiState.searchQuery) {
			const q = uiState.searchQuery.toLowerCase();
			vols = vols.filter((v) => (v.title || v.folderName).toLowerCase().includes(q));
		}

		if (uiState.filterStatus !== 'all') {
			vols = vols.filter((v) => {
				const { isRead, percent } = getVolumeStats(v);
				if (uiState.filterStatus === 'read') return isRead;
				if (uiState.filterStatus === 'unread') return !isRead && percent === 0;
				if (uiState.filterStatus === 'reading') return !isRead && percent > 0;
				return true;
			});
		}

		vols.sort((a, b) => {
			const statsA = getVolumeStats(a);
			const statsB = getVolumeStats(b);
			switch (uiState.sortKey) {
				case 'title':
					const tA = a.sortTitle || a.title || a.folderName;
					const tB = b.sortTitle || b.title || b.folderName;
					return (
						(uiState.sortOrder === 'asc' ? 1 : -1) *
						tA.localeCompare(tB, undefined, { numeric: true })
					);
				case 'updated':
					return (
						(uiState.sortOrder === 'asc' ? 1 : -1) *
						(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
					);
				case 'lastRead':
					return (uiState.sortOrder === 'asc' ? 1 : -1) * (statsA.lastRead - statsB.lastRead);
				default:
					return 0;
			}
		});
		return vols;
	});

	let stats = $derived.by(() => {
		if (!series) return { volsRead: 0, totalVols: 0, totalCharsRead: 0, totalTime: 0 };
		const vols = series.volumes;
		return {
			totalVols: vols.length,
			volsRead: vols.filter((v) => {
				const p = v.progress[0];
				return p?.completed;
			}).length,
			totalCharsRead: vols.reduce((acc, v) => acc + (v.progress[0]?.charsRead || 0), 0),
			totalTime: vols.reduce((acc, v) => acc + (v.progress[0]?.timeRead || 0), 0)
		};
	});

	// --- API Handlers ---
	const fetchSeriesData = async (id: string) => {
		isLoading = true;
		error = null;
		try {
			const data = await apiFetch(`/api/library/series/${id}`);
			series = data as Series;
			if (series) {
				uiState.setContext(
					'series',
					series.title || series.folderName,
					[
						{ key: 'title', label: 'Number' },
						{ key: 'updated', label: 'Date Added' },
						{ key: 'lastRead', label: 'Recent' }
					],
					series.id
				);
			}
		} catch (e: any) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	};

	const handleCoverUpload = async (e: Event, fileInput: HTMLInputElement | undefined) => {
		if (!fileInput || !fileInput.files || fileInput.files.length === 0 || !series) return;
		const formData = new FormData();
		formData.append('cover', fileInput.files[0]);
		try {
			await apiFetch(`/api/library/series/${series.id}/cover`, { method: 'POST', body: formData });
			await fetchSeriesData(series.id);
			coverRefreshTrigger++;
		} catch (e: any) {
			error = e.message;
		}
		fileInput.value = '';
	};

	const handleDeleteVolume = (volumeId: string, volumeTitle: string) => {
		confirmation.open(
			'Delete Volume?',
			`Are you sure you want to permanently delete "${volumeTitle}"?`,
			async () => {
				try {
					await apiFetch(`/api/library/volume/${volumeId}`, { method: 'DELETE' });
					await fetchSeriesData(seriesId);
				} catch (e: any) {
					error = e.message;
				}
			}
		);
	};

	const handleOpenVolumeEdit = () => {
		const selectedId = Array.from(uiState.selectedIds)[0];
		if (!selectedId) return;

		const volume = series?.volumes.find((s) => s.id === selectedId);
		if (volume) {
			editVolumeTarget = volume;
			isEditVolumeOpen = true;
		}
	};

	const handleRefresh = () => {
		if (!series) return;
		fetchSeriesData(series?.id);
	};

	const openDownloadMenu = (event: MouseEvent, id: string, kind: 'series' | 'volume') => {
		event.preventDefault();
		event.stopPropagation();
		const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
		contextMenu.open(rect.left, rect.bottom, [
			{ label: 'Download as ZIP', action: () => triggerDownload(`/api/export/${kind}/${id}/zip`) },
			{
				label: 'Download Metadata',
				action: () => triggerDownload(`/api/export/${kind}/${id}/zip?include_images=false`)
			},
			{ label: 'Download as PDF', action: () => triggerDownload(`/api/export/${kind}/${id}/pdf`) }
		]);
	};

	const toggleComplete = (vol: Volume) => {
		if (!series) return;

		// Initialize progress if it doesn't exist
		if (!vol.progress[0]) {
			vol.progress[0] = { page: 1, completed: false, timeRead: 0, charsRead: 0 };
		}

		const newStatus = !vol.progress[0].completed;

		// 1. Optimistic UI Update
		vol.progress[0].completed = newStatus;

		// 2. Sync with Debounce
		metadataOps.syncVolumeCompletion(vol.id, newStatus, () => {
			// Revert on failure
			if (vol.progress[0]) vol.progress[0].completed = !newStatus;
		});
	};

	const handleVolumeClick = (e: MouseEvent, volId: string) => {
		if (uiState.isSelectionMode) {
			e.preventDefault();
			e.stopPropagation();
			uiState.toggleSelection(volId);
		}
	};

	const toggleBookmark = async () => {
		if (!series) return;
		// 1. Optimistic Update
		const oldState = series.bookmarked;
		series.bookmarked = !series.bookmarked;

		// 2. Sync with Debounce
		metadataOps.syncBookmark(series.id, series.bookmarked, () => {
			// Revert on failure
			if (!series) return;
			series.bookmarked = oldState;
		});
	};

	// --- Effects ---
	$effect(() => {
		if (browser && $user === null) goto('/login');
	});
	$effect(() => {
		// Dependency tracking: include libraryVersion to force re-fetches
		const _version = uiState.libraryVersion;
		if (seriesId && $user) fetchSeriesData(seriesId);
		// CLEANUP: Flush pending writes when leaving this page
		return () => {
			metadataOps.flush();
		};
	});
</script>

<svelte:head>
	<title>{series ? (series.title ?? series.folderName) : 'Loading Series...'}</title>
</svelte:head>

<div class="flex flex-col min-h-[calc(100vh-5rem)] max-w-7xl mx-auto p-4 sm:p-6 pb-24">
	{#if isLoading && !series}
		<div class="flex h-64 items-center justify-center text-theme-secondary">Loading series...</div>
	{:else if error}
		<div
			class="p-4 bg-status-danger/10 text-status-danger rounded-lg border border-status-danger/20"
		>
			Error: {error}
		</div>
	{:else if series}
		<SeriesHero
			{series}
			{stats}
			{coverRefreshTrigger}
			onCoverUpload={handleCoverUpload}
			onEditMetadata={() => (isEditSeriesOpen = true)}
			onBookmarkToggle={toggleBookmark}
			isBookmarked={series.bookmarked ?? false}
		/>

		<LibraryListWrapper>
			{#if processedVolumes.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center rounded-2xl">
					<p class="text-theme-secondary">No volumes found matching your filters.</p>
					<button
						onclick={() => {
							uiState.searchQuery = '';
							uiState.filterStatus = 'all';
						}}
						class="mt-4 text-accent hover:underline text-sm">Clear filters</button
					>
				</div>
			{:else}
				<h2
					class="text-2xl sm:text-3xl font-bold text-white mb-6 drop-shadow-md flex items-center gap-3"
				>
					Volumes
					<span class="text-lg font-normal text-theme-secondary opacity-80">
						({processedVolumes.length})
					</span>
				</h2>

				<div
					class={uiState.viewMode === 'grid'
						? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
						: 'flex flex-col gap-3'}
				>
					{#each processedVolumes as vol (vol.id)}
						{@const stats = getVolumeStats(vol)}
						{@const isSelected = uiState.selectedIds.has(vol.id)}

						<LibraryEntry
							onLongPress={() => {
								uiState.enterSelectionMode(vol.id);
							}}
							entry={{
								id: vol.id,
								title: vol.title,
								folderName: vol.folderName,
								coverUrl: vol.coverImageName
									? `/api/files/volume/${vol.id}/image/${vol.coverImageName}`
									: null
							}}
							type="volume"
							viewMode={uiState.viewMode}
							{isSelected}
							isSelectionMode={uiState.isSelectionMode}
							progress={{
								percent: stats.percent,
								isRead: stats.isRead,
								showBar: stats.percent > 0 || stats.isRead
							}}
							href={`/volume/${vol.id}`}
							mainStat={`${vol.progress[0]?.page ?? 0}/${vol.pageCount} P`}
							subStat={vol.progress[0]?.lastReadAt
								? `READ ${new Date(vol.progress[0].lastReadAt).toLocaleDateString()}`
								: 'UNREAD'}
							onSelect={(e) => handleVolumeClick(e, vol.id)}
						>
							{#snippet circleAction()}
								<button
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										toggleComplete(vol);
									}}
									class={`z-30 col-start-1 row-start-1 flex items-center justify-center w-9 h-9 rounded-full transition-transform duration-200 active:scale-90 active:w-10 active:h-10 pointer-events-auto ${
										stats.isRead
											? 'bg-status-success text-white shadow-sm'
											: 'text-theme-secondary hover:bg-white/5'
									}`}
									title={stats.isRead ? 'Mark Unread' : 'Mark Read'}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										height="18"
										width="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="transform translate-x-[0.5px]"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</button>
							{/snippet}

							{#snippet titleAction()}
								<button
									class="hidden text-theme-secondary hover:text-white transition-colors"
									title="Rename"
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
										><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg
									>
								</button>
							{/snippet}

							{#snippet listActions()}
								<button
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										toggleComplete(vol);
									}}
									class={`p-2 rounded-full border transition-all duration-200 active:scale-90 ${
										stats.isRead
											? 'bg-status-success border-status-success text-white'
											: 'border-theme-border text-theme-secondary hover:text-white hover:border-white'
									}`}
									title={stats.isRead ? 'Mark Unread' : 'Mark Read'}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</button>
							{/snippet}
						</LibraryEntry>
					{/each}
				</div>
			{/if}
		</LibraryListWrapper>
	{/if}

	<LibraryActionBar type="volume" onRefresh={handleRefresh} onRename={handleOpenVolumeEdit} />
	<EditSeriesModal
		{series}
		isOpen={isEditSeriesOpen}
		onClose={() => (isEditSeriesOpen = false)}
		onRefresh={handleRefresh}
	/>

	<EditVolumeModal
		volume={editVolumeTarget}
		isOpen={isEditVolumeOpen}
		onClose={() => (isEditVolumeOpen = false)}
		onRefresh={handleRefresh}
	/>
</div>
