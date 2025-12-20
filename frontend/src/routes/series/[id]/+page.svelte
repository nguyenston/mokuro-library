<script lang="ts">
	import { apiFetch, triggerDownload } from '$lib/api';
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { confirmation } from '$lib/confirmationStore';
	import { contextMenu } from '$lib/contextMenuStore';
	import { uiState } from '$lib/states/uiState.svelte';

	import EditSeriesModal from '$lib/components/EditSeriesModal.svelte';
	import RenameModal from '$lib/components/RenameModal.svelte';
	import LibraryEntry from '$lib/components/LibraryEntry.svelte';
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
	}

	let { params } = $props<{ params: { id: string } }>();

	// --- State ---
	let series = $state<Series | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let seriesId = $derived(params.id);

	let coverRefreshTrigger = $state(0);

	let isEditModalOpen = $state(false);
	let isRenameOpen = $state(false);
	let renameTarget = $state<{ id: string; title: string | null; type: 'series' | 'volume' } | null>(
		null
	);

	let pendingToggleComplete = new Map<string, boolean>();
	let toggleCompleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

	// --- Helpers ---
	const formatTime = (seconds: number) => {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	};

	const getVolumeStats = (vol: Volume) => {
		const p = vol.progress?.[0];
		const isRead = p?.completed ?? false;
		const currentPage = p?.page ?? 0;
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
				if (uiState.filterStatus === 'in_progress') return !isRead && percent > 0;
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
			volsRead: vols.filter((v) => v.progress[0]?.completed).length,
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

	const saveSeriesMetadata = async (newTitle: string | null, newDescription: string | null) => {
		if (!series) return;
		try {
			await apiFetch(`/api/metadata/series/${series.id}`, {
				method: 'PATCH',
				body: { title: newTitle, description: newDescription }
			});
			await fetchSeriesData(series.id);
		} catch (e: any) {
			error = e.message;
		}
	};

	const openRenameVolume = (e: Event, vol: Volume) => {
		e.preventDefault();
		e.stopPropagation();
		renameTarget = { id: vol.id, title: vol.title, type: 'volume' };
		isRenameOpen = true;
	};

	const handleRenameSave = async (newTitle: string | null) => {
		if (!renameTarget) return;
		const endpoint =
			renameTarget.type === 'series'
				? `/api/metadata/series/${renameTarget.id}`
				: `/api/metadata/volume/${renameTarget.id}`;
		await apiFetch(endpoint, { method: 'PATCH', body: { title: newTitle } });
		await fetchSeriesData(seriesId);
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

	const openGridVolumeMenu = (e: MouseEvent, vol: Volume) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
		contextMenu.open(rect.left, rect.bottom, [
			{
				label: 'Rename',
				action: () => {
					renameTarget = { id: vol.id, title: vol.title, type: 'volume' };
					isRenameOpen = true;
				}
			},
			{ label: 'Download ZIP', action: () => triggerDownload(`/api/export/volume/${vol.id}/zip`) },
			{
				label: 'Download Metadata',
				action: () => triggerDownload(`/api/export/volume/${vol.id}/zip?include_images=false`)
			},
			{ label: 'Download PDF', action: () => triggerDownload(`/api/export/volume/${vol.id}/pdf`) },
			{ label: 'Delete', action: () => handleDeleteVolume(vol.id, vol.title || vol.folderName) }
		]);
	};

	const toggleComplete = async (volumeId: string) => {
		if (!series) return;
		const volumeIndex = series.volumes.findIndex((v) => v.id === volumeId);
		if (volumeIndex === -1) return;

		const vol = series.volumes[volumeIndex];
		vol.progress[0] = vol.progress[0] ?? { page: 1, completed: false, timeRead: 0, charsRead: 0 };
		const newStatus = !vol.progress[0].completed;

		series.volumes[volumeIndex].progress[0].completed = newStatus;

		if (toggleCompleteTimers.has(volumeId)) clearTimeout(toggleCompleteTimers.get(volumeId)!);
		pendingToggleComplete.set(volumeId, newStatus);

		const timerId = setTimeout(async () => {
			toggleCompleteTimers.delete(volumeId);
			pendingToggleComplete.delete(volumeId);
			try {
				await apiFetch(`/api/metadata/volume/${volumeId}/progress`, {
					method: 'PATCH',
					body: { completed: newStatus }
				});
			} catch (e) {
				console.error(e);
			}
		}, 1000);
		toggleCompleteTimers.set(volumeId, timerId);
	};

	const flushPendingToggleComplete = () => {
		for (const [volumeId, status] of pendingToggleComplete.entries()) {
			if (toggleCompleteTimers.has(volumeId)) clearTimeout(toggleCompleteTimers.get(volumeId)!);
			apiFetch(`/api/metadata/volume/${volumeId}/progress`, {
				method: 'PATCH',
				body: { completed: status }
			}).catch(console.error);
		}
	};

	const handleVolumeClick = (e: MouseEvent, volId: string) => {
		if (uiState.isSelectionMode) {
			e.preventDefault();
			e.stopPropagation();
			uiState.toggleSelection(volId);
		}
	};

	const handleContinueReading = () => {
		if (!series) return;
		const nextVol = series.volumes.find((v) => !v.progress[0]?.completed) || series.volumes[0];
		if (nextVol) goto(`/volume/${nextVol.id}`);
	};

	// --- Effects ---
	$effect(() => {
		if (browser && $user === null) goto('/login');
	});
	$effect(() => {
		if (seriesId && $user) fetchSeriesData(seriesId);
		return () => flushPendingToggleComplete();
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
			onEditMetadata={() => (isEditModalOpen = true)}
			onDownload={(e) => openDownloadMenu(e, seriesId, 'series')}
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
							subStat={vol.progress[0]?.timeRead
								? `${formatTime(vol.progress[0].timeRead)} read`
								: ''}
							onSelect={(e) => handleVolumeClick(e, vol.id)}
						>
							{#snippet menuAction()}
								<button
									onclick={(e) => openGridVolumeMenu(e, vol)}
									class="p-2 text-theme-secondary hover:text-accent active:bg-theme-main rounded-full transition-colors"
									title="Actions"
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
										><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle
											cx="12"
											cy="19"
											r="1"
										/></svg
									>
								</button>
							{/snippet}

							{#snippet quickAction()}
								<button
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										toggleComplete(vol.id);
									}}
									class={`p-1.5 rounded-md transition-all ${stats.isRead ? 'text-status-success' : 'text-theme-tertiary hover:text-white'}`}
									title="ToggleComplete"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M20 6L9 17l-5-5" />
									</svg>
								</button>
							{/snippet}

							{#snippet titleAction()}
								<button
									onclick={(e) => openRenameVolume(e, vol)}
									class="text-theme-secondary hover:text-white transition-colors"
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
								<div
									class="flex flex-col sm:flex-row items-center justify-center h-full gap-1 sm:gap-4 px-3 py-2"
								>
									<button
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											toggleComplete(vol.id);
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

									<button
										onclick={(e) => openDownloadMenu(e, vol.id, 'volume')}
										class="p-1.5 text-theme-secondary hover:text-white transition-colors"
										title="Download"
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
											<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
											<polyline points="7 10 12 15 17 10" />
											<line x1="12" x2="12" y1="15" y2="3" />
										</svg>
									</button>

									<button
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											handleDeleteVolume(vol.id, vol.title || vol.folderName);
										}}
										class="p-1.5 text-theme-secondary hover:text-status-danger transition-colors"
										title="Delete"
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
											<path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
											<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
										</svg>
									</button>
								</div>
							{/snippet}
						</LibraryEntry>
					{/each}
				</div>
			{/if}
		</LibraryListWrapper>
	{/if}

	<EditSeriesModal
		isOpen={isEditModalOpen}
		onClose={() => (isEditModalOpen = false)}
		onSave={saveSeriesMetadata}
		initialTitle={series?.title ?? null}
		initialDescription={series?.description ?? null}
	/>

	<RenameModal
		bind:isOpen={isRenameOpen}
		initialTitle={renameTarget?.title ?? null}
		onSave={handleRenameSave}
		onClose={() => (renameTarget = null)}
	/>
</div>
