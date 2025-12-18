<script lang="ts">
	import { apiFetch, triggerDownload } from '$lib/api';
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { confirmation } from '$lib/confirmationStore';
	import { contextMenu } from '$lib/contextMenuStore';
	import { renameStore } from '$lib/renameStore';

	// --- Type definitions ---
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
		// max 1 item
	}
	interface Series {
		id: string;
		title: string | null;
		folderName: string;
		coverPath: string | null;
		volumes: Volume[];
	}

	type ViewMode = 'grid' | 'list';
	type SortMode = 'title_asc' | 'title_desc' | 'created_desc' | 'created_asc' | 'recent';

	// --- State ---
	let series = $state<Series | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// UI State
	let currentPage = $state(1);
	let itemsPerPage = $state(50);
	let fileInput: HTMLInputElement | null = $state(null);
	let coverRefreshTrigger = $state(0);

	// UI State (with Persistence)
	// Initialize from LocalStorage if available to restore user preference
	// UI State (with Persistence)
	let viewMode = $state<ViewMode>(
		(browser && (localStorage.getItem('seriesViewMode') as ViewMode)) || 'grid'
	);
	let sortMode = $state<SortMode>(
		(browser && (localStorage.getItem('seriesSortMode') as SortMode)) || 'title_asc'
	);
	let pushReadToEnd = $state(
		(browser && localStorage.getItem('seriesSortRead') === 'true') || false
	);

	// Optimistic UI Timers
	let pendingToggleComplete = new Map<string, boolean>();
	let toggleCompleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

	let { params } = $props<{ params: { id: string } }>();

	// --- Persistence Effect ---
	// Saves settings whenever they change
	$effect(() => {
		if (browser) {
			localStorage.setItem('seriesViewMode', viewMode);
			localStorage.setItem('seriesSortMode', sortMode);
			localStorage.setItem('seriesSortRead', String(pushReadToEnd));
		}
	});

	// --- Auth Effect ---
	$effect(() => {
		if (browser && $user === null) {
			goto('/login');
		}
	});

	// --- Fetch Data ---
	$effect(() => {
		if ($user && params.id) {
			fetchSeriesData(params.id);
		}
		return () => {
			flushPendingToggleComplete();
		};
	});

	const fetchSeriesData = async (seriesId: string) => {
		isLoading = true;
		error = null;
		try {
			const data = await apiFetch(`/api/library/series/${seriesId}`);
			series = data as Series;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	};

	// --- Derived Statistics ---
	// Calculates totals for the Header Hero section
	let stats = $derived.by(() => {
		if (!series) return { volsRead: 0, totalVols: 0, totalCharsRead: 0, totalTime: 0 };

		const vols = series.volumes;
		return {
			totalVols: vols.length,
			volsRead: vols.filter((v) => v.progress[0]?.completed).length,
			// Sum of charsRead from user progress
			totalCharsRead: vols.reduce((acc, v) => acc + (v.progress[0]?.charsRead || 0), 0),
			// Assuming timeRead is in seconds
			totalTime: vols.reduce((acc, v) => acc + (v.progress[0]?.timeRead || 0), 0)
		};
	});

	// --- Derived Pagination & Sorting ---
	let sortedVolumes = $derived.by(() => {
		if (!series) return [];
		// Create a shallow copy to sort
		const vols = [...series.volumes];

		// 1. Primary Sort
		vols.sort((a, b) => {
			switch (sortMode) {
				case 'title_asc':
					// Use numeric collation so "Vol 10" comes after "Vol 2"
					return (a.sortTitle || a.folderName).localeCompare(
						b.sortTitle || b.folderName,
						undefined,
						{ numeric: true }
					);
				case 'title_desc':
					return (b.sortTitle || b.folderName).localeCompare(
						a.sortTitle || a.folderName,
						undefined,
						{ numeric: true }
					);
				case 'created_desc':
					return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
				case 'created_asc':
					return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				case 'recent':
					// Sort by lastReadAt, fallback to 0
					const dateA = a.progress[0]?.lastReadAt
						? new Date(a.progress[0].lastReadAt).getTime()
						: 0;
					const dateB = b.progress[0]?.lastReadAt
						? new Date(b.progress[0].lastReadAt).getTime()
						: 0;
					return dateB - dateA; // Descending (most recent first)
				default:
					return 0;
			}
		});

		// 2. Secondary "Push Read to End" Sort (Stable)
		if (pushReadToEnd) {
			vols.sort((a, b) => {
				const aComplete = a.progress[0]?.completed ?? false;
				const bComplete = b.progress[0]?.completed ?? false;
				if (aComplete === bComplete) return 0;
				return aComplete ? 1 : -1;
			});
		}
		return vols;
	});

	let paginatedVolumes = $derived.by(() => {
		if (!series) return [];
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		// Slice from the sorted array instead of series.volumes
		return sortedVolumes.slice(start, end);
	});

	let totalPages = $derived(series ? Math.ceil(series.volumes.length / itemsPerPage) : 0);

	// --- Helpers ---

	const formatTime = (seconds: number) => {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	};

	const getProgressPercent = (volume: Volume) => {
		const progress = volume.progress[0];
		if (!progress || !volume.pageCount) return 0;
		return Math.floor(((progress.page - 1) / (volume.pageCount - 1)) * 100);
	};

	// --- Actions (Rename, Delete, Upload, Download) ---

	const handleCoverUpload = async () => {
		if (!fileInput || !fileInput.files || fileInput.files.length === 0 || !series) return;
		const file = fileInput.files[0];
		const formData = new FormData();
		formData.append('cover', file);

		try {
			await apiFetch(`/api/library/series/${series.id}/cover`, {
				method: 'POST',
				body: formData
			});
			await fetchSeriesData(series.id);
			coverRefreshTrigger++;
		} catch (e) {
			error = `Failed to upload cover: ${(e as Error).message}`;
		} finally {
			fileInput.value = '';
		}
	};

	const handleDeleteVolume = (volumeId: string, volumeTitle: string) => {
		confirmation.open(
			'Delete Volume?',
			`Are you sure you want to permanently delete "${volumeTitle}"?`,
			async () => {
				try {
					await apiFetch(`/api/library/volume/${volumeId}`, { method: 'DELETE' });
					await fetchSeriesData(params.id);
				} catch (e) {
					error = `Failed to delete volume: ${(e as Error).message}`;
				}
			}
		);
	};

	const openRenameSeries = () => {
		if (!series) return;
		renameStore.open(series.title ?? '', async (newTitle) => {
			newTitle = newTitle === '' ? null : newTitle;
			await apiFetch(`/api/metadata/series/${series!.id}`, {
				method: 'PATCH',
				body: { title: newTitle }
			});
			await fetchSeriesData(params.id);
		});
	};

	const openRenameVolume = (e: Event, vol: Volume) => {
		e.preventDefault();
		e.stopPropagation();
		renameStore.open(vol.title ?? '', async (newTitle) => {
			newTitle = newTitle === '' ? null : newTitle;
			await apiFetch(`/api/metadata/volume/${vol.id}`, {
				method: 'PATCH',
				body: { title: newTitle }
			});
			await fetchSeriesData(params.id);
		});
	};

	const openDownloadMenu = (event: MouseEvent, id: string, kind: 'series' | 'volume') => {
		event.preventDefault();
		event.stopPropagation();
		const button = event.currentTarget as HTMLButtonElement;
		const rect = button.getBoundingClientRect();
		contextMenu.open(rect.left, rect.bottom, [
			{ label: 'Download as ZIP', action: () => triggerDownload(`/api/export/${kind}/${id}/zip`) },
			{
				label: 'Download Metadata Only',
				action: () => triggerDownload(`/api/export/${kind}/${id}/zip?include_images=false`)
			},
			{ label: 'Download as PDF', action: () => triggerDownload(`/api/export/${kind}/${id}/pdf`) }
		]);
	};

	const toggleComplete = async (volumeId: string) => {
		if (!series) return;
		const volumeIndex = series.volumes.findIndex((v) => v.id === volumeId);
		if (volumeIndex === -1) return;

		const vol = series.volumes[volumeIndex];
		vol.progress[0] = vol.progress[0] ?? { page: 1, completed: false, timeRead: 0, charsRead: 0 };
		const newStatus = !vol.progress[0].completed;

		// Optimistic Update
		series.volumes[volumeIndex].progress[0].completed = newStatus;

		if (toggleCompleteTimers.has(volumeId)) {
			clearTimeout(toggleCompleteTimers.get(volumeId)!);
		}
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
				console.error('Failed to save toggle state:', e);
			}
		}, 1000);
		toggleCompleteTimers.set(volumeId, timerId);
	};

	const flushPendingToggleComplete = () => {
		for (const [volumeId, status] of pendingToggleComplete.entries()) {
			if (toggleCompleteTimers.has(volumeId)) clearTimeout(toggleCompleteTimers.get(volumeId)!);
			try {
				apiFetch(`/api/metadata/volume/${volumeId}/progress`, {
					method: 'PATCH',
					body: { completed: status }
				});
			} catch (e) {
				console.error(`Failed to save toggle for volume ${volumeId}:`, e);
			}
		}
	};
</script>

<!-- DYNAMIC TITLE -->
<svelte:head>
	<title>
		{series ? (series.title ?? series.folderName) : 'Loading Series...'}
	</title>
</svelte:head>

<!-- Main Container -->
<div class="min-h-screen bg-[#0a0e17] text-white p-6 font-sans">
	<!-- Content Wrapper: Limited Width -->
	<div class="max-w-7xl mx-auto">
		<!-- Back button -->
		<a
			href="/"
			class="mb-6 inline-flex items-center text-sm font-medium text-gray-400 hover:text-white transition-colors"
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
				class="mr-2"><path d="m15 18-6-6 6-6" /></svg
			>
			Back to Library
		</a>

		{#if isLoading}
			<!-- Loading State -->
			<div class="flex h-64 items-center justify-center text-gray-400">Loading series...</div>
		{:else if error}
			<!-- Error State -->
			<div class="text-red-400">Error: {error}</div>
		{:else if series}
			<!-- HEADER / HERO SECTION -->
			<div class="mb-12 flex flex-col md:flex-row gap-8">
				<!-- Cover Image (Left) -->
				<div
					class="relative group flex-shrink-0 w-48 md:w-56 rounded-lg shadow-2xl overflow-hidden bg-[#161b2e]"
				>
					{#if series.coverPath}
						<img
							src={`/api/files/series/${series.id}/cover?t=${coverRefreshTrigger}`}
							alt={series.folderName}
							class="w-full h-auto object-cover aspect-[2/3]"
						/>
					{:else}
						<div
							class="w-full h-full aspect-[2/3] flex items-center justify-center text-4xl font-bold text-gray-600"
						>
							{series.folderName.charAt(0).toUpperCase()}
						</div>
					{/if}
					<!-- Change Cover Overlay -->
					<button
						onclick={() => fileInput?.click()}
						class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
					>
						<span class="text-xs font-bold uppercase tracking-wider text-white">Change Cover</span>
					</button>
					<input
						type="file"
						accept="image/*"
						class="hidden"
						bind:this={fileInput}
						onchange={handleCoverUpload}
					/>
				</div>

				<!-- Info & Stats (Right) -->
				<div class="flex-1 flex flex-col justify-start">
					<!-- Title Row -->
					<div class="flex items-start justify-between">
						<div>
							<!-- Title Group -->
							<div class="flex items-center gap-3 group">
								<h1 class="text-3xl md:text-4xl font-bold text-white tracking-tight">
									{series.title ?? series.folderName}
								</h1>
								<button
									onclick={openRenameSeries}
									class="text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
									title="Rename"
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
										><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path
											d="m15 5 4 4"
										/></svg
									>
								</button>
							</div>
							<!-- Placeholder Description -->
							<p class="mt-4 text-gray-400 text-sm leading-relaxed max-w-2xl">
								A placeholder description for the {series.title ?? series.folderName} collection. Perfect
								for learners mastering complex grammar and varied vocabulary. Dive into stories that
								challenge your comprehension while keeping you engaged.
							</p>
						</div>

						<!-- Download Button -->
						<button
							onclick={(e) => openDownloadMenu(e, params.id, 'series')}
							class="flex items-center gap-2 px-4 py-2 bg-[#161b2e] border border-gray-700 hover:bg-[#1f263f] text-sm text-gray-200 rounded-md transition-colors"
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
								><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
									points="7 10 12 15 17 10"
								/><line x1="12" x2="12" y1="15" y2="3" /></svg
							>
							Download
						</button>
					</div>

					<!-- Stats Grid -->
					<div class="mt-auto pt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
						<!-- Stat Card: Volumes -->
						<div class="bg-[#161b2e] p-4 rounded-lg border border-gray-800 flex items-center gap-3">
							<div class="p-2 bg-blue-500/10 rounded-md text-blue-400">
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
									><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg
								>
							</div>
							<div>
								<div class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
									Volumes
								</div>
								<div class="text-lg font-semibold text-white">
									{stats.volsRead} / {stats.totalVols}
								</div>
							</div>
						</div>

						<!-- Stat Card: Characters Read -->
						<div class="bg-[#161b2e] p-4 rounded-lg border border-gray-800 flex items-center gap-3">
							<div class="p-2 bg-purple-500/10 rounded-md text-purple-400">
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
									><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg
								>
							</div>
							<div>
								<div class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
									Characters Read
								</div>
								<div class="text-lg font-semibold text-white">
									{stats.totalCharsRead.toLocaleString()}
								</div>
							</div>
						</div>

						<!-- Stat Card: Time -->
						<div class="bg-[#161b2e] p-4 rounded-lg border border-gray-800 flex items-center gap-3">
							<div class="p-2 bg-green-500/10 rounded-md text-green-400">
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
									><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg
								>
							</div>
							<div>
								<div class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
									Time Read
								</div>
								<div class="text-lg font-semibold text-white">{formatTime(stats.totalTime)}</div>
							</div>
						</div>

						<!-- Stat Card: Status (Calculated) -->
						<div class="bg-[#161b2e] p-4 rounded-lg border border-gray-800 flex items-center gap-3">
							<div class="p-2 bg-orange-500/10 rounded-md text-orange-400">
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
									><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline
										points="22 4 12 14.01 9 11.01"
									/></svg
								>
							</div>
							<div>
								<div class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
									Status
								</div>
								<div class="text-lg font-semibold text-white">
									{stats.totalVols > 0 && stats.volsRead === stats.totalVols
										? 'Completed'
										: 'Reading'}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- CONTROL BAR -->
			<div
				class="flex flex-col sm:flex-row items-start justify-between mb-6 border-b border-gray-800 pb-4 gap-4"
			>
				<!-- Bar Title -->
				<h2 class="text-xl font-bold text-white">Volumes</h2>

				<div class="flex flex-row items-center gap-2 w-full sm:w-auto">
					<!-- Pagination -->
					<div
						class="h-9 flex items-center bg-[#161b2e] rounded-md border border-gray-700 overflow-hidden"
					>
						<button
							class="h-full px-1 hover:bg-gray-700 disabled:opacity-50 flex items-center"
							disabled={currentPage === 1}
							onclick={() => currentPage--}
						>
							&larr;
						</button>
						<span
							class="h-full px-3 flex items-center text-xs font-medium border-l border-r border-gray-700"
						>
							{currentPage} / {totalPages}
						</span>
						<button
							class="h-full px-1 hover:bg-gray-700 disabled:opacity-50 flex items-center"
							disabled={currentPage === totalPages}
							onclick={() => currentPage++}
						>
							&rarr;
						</button>
					</div>

					<!-- Sort Dropdown -->
					<div class="relative h-9 flex-1 sm:max-w-60">
						<select
							bind:value={sortMode}
							class="h-full w-full appearance-none bg-[#161b2e] border border-gray-700 text-gray-300 text-[12px] sm:text-[14px] font-medium rounded-md pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center cursor-pointer hover:bg-gray-800 transition-colors"
						>
							<option value="title_asc">Title (Asc)</option>
							<option value="title_desc">Title (Desc)</option>
							<option value="created_desc">Date Added (Newest)</option>
							<option value="created_asc">Date Added (Oldest)</option>
							<option value="recent">Recently Read</option>
						</select>
						<div
							class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
						>
							<svg
								class="h-3 w-3 fill-current"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								><path
									d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
								/></svg
							>
						</div>
					</div>

					<!-- Push Read to End Toggle -->
					<button
						onclick={() => (pushReadToEnd = !pushReadToEnd)}
						class={`h-9 flex items-center gap-2 px-3 rounded-md text-[14px] font-medium transition-all rounded-md border border-gray-700 ${pushReadToEnd ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:text-gray-200 bg-[#161b2e]'}`}
						title="Push completed volumes to the end"
					>
						{#if pushReadToEnd}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></svg
							>
						{:else}
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
								><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg
							>
						{/if}
						<span class="hidden sm:inline">Sort Read</span>
					</button>

					<!-- View Toggle -->
					<div class="h-9 flex bg-[#161b2e] rounded-md p-0.5 border border-gray-700">
						<button
							class={`h-full aspect-square rounded flex items-center justify-center ${viewMode === 'grid' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
							onclick={() => (viewMode = 'grid')}
							title="Grid View"
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
								><rect x="3" y="3" width="7" height="7" /><rect
									x="14"
									y="3"
									width="7"
									height="7"
								/><rect x="14" y="14" width="7" height="7" /><rect
									x="3"
									y="14"
									width="7"
									height="7"
								/></svg
							>
						</button>
						<button
							class={`h-full aspect-square rounded flex items-center justify-center ${viewMode === 'list' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
							onclick={() => (viewMode = 'list')}
							title="List View"
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
								><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line
									x1="8"
									y1="18"
									x2="21"
									y2="18"
								/><line x1="3" y1="6" x2="3.01" y2="6" /><line
									x1="3"
									y1="12"
									x2="3.01"
									y2="12"
								/><line x1="3" y1="18" x2="3.01" y2="18" /></svg
							>
						</button>
					</div>
				</div>
			</div>

			<!-- CONTENT BODY -->
			{#if viewMode === 'grid'}
				<!-- GRID VIEW LAYOUT -->
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
					{#each paginatedVolumes as volume (volume.id)}
						{@const percent = getProgressPercent(volume)}
						{@const isCompleted = volume.progress[0]?.completed ?? false}

						<!-- Grid Card Container -->
						<div
							class="group relative bg-[#161b2e] rounded-xl border border-gray-800 overflow-hidden hover:border-gray-600 transition-colors flex flex-col"
						>
							<!-- Full Card Link (Layer behind buttons) -->
							<a
								href={`/volume/${volume.id}`}
								class="absolute inset-0 z-0"
								aria-label={volume.title ?? volume.folderName}
							></a>

							<!-- Cover Image Area  - pointer-events-none allows clicks to pass to card link -->
							<div
								class="aspect-[2/3] w-full bg-gray-900 relative overflow-hidden pointer-events-none"
							>
								{#if volume.coverImageName}
									<img
										src={`/api/files/volume/${volume.id}/image/${volume.coverImageName}`}
										alt={volume.folderName}
										class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
									/>
								{:else}
									<div
										class="flex h-full w-full items-center justify-center text-center text-gray-600 p-2 text-sm"
									>
										{volume.folderName}
									</div>
								{/if}

								<!-- Overlay Actions (Hover) -->
								<div
									class="absolute inset-0 hover-hover:bg-black/40 opacity-100 hover-hover:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 pointer-events-none"
								>
									<div class="flex justify-end gap-1">
										<!-- Download Btn -->
										<button
											onclick={(e) => openDownloadMenu(e, volume.id, 'volume')}
											class="pointer-events-auto p-1.5 bg-black/50 rounded-full text-white hover:bg-blue-600 relative z-10"
											title="Download"
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
												><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
													points="7 10 12 15 17 10"
												/><line x1="12" x2="12" y1="15" y2="3" /></svg
											>
										</button>
										<!-- Delete Btn -->
										<button
											onclick={(e) => {
												e.preventDefault();
												handleDeleteVolume(volume.id, volume.title || volume.folderName);
											}}
											class="pointer-events-auto p-1.5 bg-black/50 rounded-full text-white hover:bg-red-600 relative z-10"
											title="Delete"
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
												><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
													d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
												/></svg
											>
										</button>
									</div>
									<!-- Toggle Read Button (Bottom Left) -->
									<button
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											toggleComplete(volume.id);
										}}
										class={`pointer-events-auto self-start p-1.5 rounded-full relative z-10 ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-600/80 text-gray-300 hover:bg-green-500 hover:text-white'}`}
										title={isCompleted ? 'Mark Unread' : 'Mark Read'}
									>
										{#if isCompleted}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
											>
										{:else}
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
												><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline
													points="22 4 12 14.01 9 11.01"
												/></svg
											>
										{/if}
									</button>
								</div>
							</div>

							<!-- Content Area -->
							<div class="p-3 flex flex-col gap-2 flex-grow pointer-events-none">
								<!-- Title -->
								<div class="flex justify-between items-start gap-2">
									<div
										class="text-sm font-semibold text-white line-clamp-2 group-hover:text-blue-400 transition-colors"
									>
										{volume.title ?? volume.folderName}
									</div>
									<!-- Rename Icon -->
									<button
										onclick={(e) => openRenameVolume(e, volume)}
										class="pointer-events-auto opacity-100 hover-hover:opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white z-10 relative"
										title="Rename"
									>
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
											><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg
										>
									</button>
								</div>

								<!-- Progress Stats -->
								<div class="mt-auto">
									<div
										class="flex justify-between text-[12px] font-bold {isCompleted
											? 'text-green-600'
											: 'text-gray-400'} uppercase tracking-wide mb-1"
									>
										<span>{isCompleted ? 'Read' : `${percent}%`}</span>
										<span>{volume.progress[0]?.page ?? 0}/{volume.pageCount} p</span>
									</div>
									<!-- Progress Bar -->
									<div class="h-1 w-full bg-gray-700 rounded-full overflow-hidden">
										<div
											class={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
											style={`width: ${isCompleted ? 100 : percent}%`}
										></div>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- LIST VIEW LAYOUT -->
				<div class="flex flex-col gap-3">
					{#each paginatedVolumes as volume (volume.id)}
						{@const percent = getProgressPercent(volume)}
						{@const isCompleted = volume.progress[0]?.completed ?? false}

						<!-- List Row Container -->
						<div
							class="group relative bg-[#161b2e] rounded-lg border border-gray-800 p-2 flex items-center gap-4 hover:border-gray-600 transition-colors"
						>
							<!-- Full Row Link -->
							<a
								href={`/volume/${volume.id}`}
								class="absolute inset-0 z-0"
								aria-label={volume.title ?? volume.folderName}
							></a>

							<!-- Tiny Thumbnail -->
							<div
								class="w-10 h-14 bg-gray-900 rounded overflow-hidden flex-shrink-0 pointer-events-none"
							>
								{#if volume.coverImageName}
									<img
										src={`/api/files/volume/${volume.id}/image/${volume.coverImageName}`}
										alt={volume.folderName}
										class="h-full w-full object-cover"
									/>
								{:else}
									<div
										class="h-full w-full flex items-center justify-center text-[8px] text-gray-500"
									>
										{volume.folderName.substring(0, 3)}
									</div>
								{/if}
							</div>

							<!-- Main Info -->
							<div class="flex-grow min-w-0 pointer-events-none">
								<!-- Title Row -->
								<div class="flex items-center gap-2">
									<!-- Title Text -->
									<div
										class="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors"
									>
										{volume.title ?? volume.folderName}
									</div>
									<!-- Rename Button -->
									<button
										onclick={(e) => openRenameVolume(e, volume)}
										class="pointer-events-auto opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white relative z-10"
										title="Rename"
									>
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
											><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg
										>
									</button>
								</div>
								<!-- Meta Row (Chars/Time) -->
								<div class="text-xs text-gray-500 flex gap-4 mt-0.5">
									{#if volume.progress[0]}
										<span class="flex items-center gap-1">
											<svg
												class="w-3 h-3"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												><path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
												/></svg
											>
											{(volume.progress[0].charsRead ?? 0).toLocaleString()} chars
										</span>
										<span class="flex items-center gap-1">
											<svg
												class="w-3 h-3"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												><circle cx="12" cy="12" r="10" /><polyline
													points="12 6 12 12 16 14"
												/></svg
											>
											{formatTime(volume.progress[0].timeRead ?? 0)}
										</span>
									{/if}
								</div>
							</div>

							<!-- Page Stats (Fixed Width) -->
							<div class="hidden sm:flex flex-col items-end w-24 flex-shrink-0 pointer-events-none">
								<div class="text-xs font-medium text-gray-300 flex items-center gap-1">
									<svg
										class="w-3 h-3 text-gray-500"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										><path
											d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
										/><polyline points="14 2 14 8 20 8" /></svg
									>
									{volume.pageCount} pages
								</div>
								<div class="text-[12px] text-gray-500">
									{volume.progress[0]?.page ?? 0} read
								</div>
							</div>

							<!-- Status Check -->
							<div class="flex h-full items-center gap-4 pl-4 border-l border-gray-800">
								<!-- Toggle Button -->
								<button
									onclick={() => toggleComplete(volume.id)}
									class={`pointer-events-auto h-full relative z-10 p-1.5 rounded-full border transition-colors ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-gray-600 text-gray-600 hover:border-gray-400 hover:text-gray-400'}`}
									title={isCompleted ? 'Mark Unread' : 'Mark Read'}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
										stroke-linecap="round"
										stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
									>
								</button>

								<!-- Download Button -->
								<button
									onclick={(e) => openDownloadMenu(e, volume.id, 'volume')}
									class="pointer-events-auto h-full relative z-10 text-gray-500 hover:text-white"
									title="Download"
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
										><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
											points="7 10 12 15 17 10"
										/><line x1="12" x2="12" y1="15" y2="3" /></svg
									>
								</button>

								<!-- Delete Button -->
								<button
									onclick={(e) => {
										e.preventDefault();
										handleDeleteVolume(volume.id, volume.title || volume.folderName);
									}}
									class="pointer-events-auto h-full relative z-10 text-gray-500 hover:text-red-500"
									title="Delete"
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
										><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
											d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
										/></svg
									>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
