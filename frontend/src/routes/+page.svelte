<script lang="ts">
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { apiFetch, triggerDownload } from '$lib/api';
	import { confirmation } from '$lib/confirmationStore';
	import { contextMenu } from '$lib/contextMenuStore';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import LibrarySearchBar from '$lib/components/LibrarySearchBar.svelte';
	import PaginationControls from '$lib/components/PaginationControls.svelte';

	// --- Type definitions ---
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
	}

	interface LibraryResponse {
		data: Series[];
		meta: {
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		};
	}

	type ViewMode = 'grid' | 'list';

	// --- State ---
	let library = $state<Series[]>([]);
	let meta = $state({ total: 0, page: 1, limit: 20, totalPages: 1 });
	let isLoadingLibrary = $state(true);
	let libraryError = $state<string | null>(null);
	let isUploadModalOpen = $state(false);

	// UI State (Persisted)
	let viewMode = $derived($page.url.searchParams.get('view') || 'grid');

	// --- API Query Logic ---
	// Create a derived query string that EXCLUDES 'view'.
	// This ensures the fetch effect below only runs when 'q', 'sort', 'page', etc. change.
	let apiQueryString = $derived.by(() => {
		const params = new URLSearchParams($page.url.searchParams);
		params.delete('view'); // Ignore view changes for fetching
		return params.toString();
	});

	// --- Auth Effect ---
	$effect(() => {
		if (browser) {
			if ($user === null) {
				goto('/login');
			}
		}
	});

	// --- Library Fetch Effect ---
	$effect(() => {
		if ($user && browser) {
			fetchLibrary(`?${apiQueryString}`);
		}
	});

	const fetchLibrary = async (queryString: string, silent = false) => {
		try {
			if (!silent) isLoadingLibrary = true;
			libraryError = null;
			const response = await apiFetch(`/api/library${queryString}`);
			library = response.data as Series[];
			meta = response.meta;
		} catch (e) {
			libraryError = (e as Error).message;
		} finally {
			isLoadingLibrary = false;
		}
	};

	const handleDeleteSeries = (seriesId: string, seriesTitle: string) => {
		confirmation.open(
			'Delete Series?',
			`Are you sure you want to permanently delete "${seriesTitle}" and all ${
				library.find((s) => s.id === seriesId)?.volumes.length ?? 'its'
			} volumes?`,
			async () => {
				try {
					await apiFetch(`/api/library/series/${seriesId}`, { method: 'DELETE' });
					await fetchLibrary($page.url.search);
				} catch (e) {
					libraryError = `Failed to delete series: ${(e as Error).message}`;
				}
			}
		);
	};

	const handleLogout = async () => {
		try {
			await apiFetch('/api/auth/logout', { method: 'POST', body: {} });
		} catch (e) {
			console.error('Logout failed:', (e as Error).message);
		}
		user.set(null);
	};

	const openDownloadMenu = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const button = event.currentTarget as HTMLButtonElement;
		const rect = button.getBoundingClientRect();
		contextMenu.open(rect.left, rect.bottom, [
			{
				label: 'Download as ZIP',
				action: () => triggerDownload(`/api/export/zip`)
			},
			{
				label: 'Download Metadata Only (ZIP)',
				action: () => triggerDownload(`/api/export/zip?include_images=false`)
			},
			{
				label: 'Download as PDF',
				action: () => triggerDownload(`/api/export/pdf`)
			}
		]);
	};
</script>

<!-- DYNAMIC TITLE -->
<svelte:head>
	<title>
		{$user ? `${$user.username}'s Library` : 'Library'}
	</title>
</svelte:head>

<!-- Main Container: Dark Navy Theme -->
<div class="min-h-screen bg-[#0a0e17] text-white p-6 font-sans">
	{#if $user}
		<!-- Content Wrapper -->
		<div class="max-w-7xl mx-auto">
			<!-- HEADER SECTION -->
			<div
				class="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-gray-800 pb-6 mb-8"
			>
				<!-- Title -->
				<div class="flex items-center gap-3">
					<div class="h-10 w-1 bg-blue-500 rounded-full"></div>
					<h1 class="text-3xl font-bold tracking-tight text-white">
						{$user.username}'s Library
					</h1>
				</div>

				<!-- Actions Group -->
				<div class="flex items-center justify-end gap-3 w-full md:w-auto">
					<!-- Download All -->
					<button
						onclick={openDownloadMenu}
						disabled={library.length === 0}
						class="flex items-center gap-2 px-4 py-2 bg-[#161b2e] border border-gray-700 text-gray-300 rounded-md hover:bg-gray-800 hover:text-white disabled:opacity-50 transition-colors text-sm font-medium"
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
						<span class="hidden sm:inline">Download All</span>
					</button>

					<!-- Upload -->
					<button
						onclick={() => (isUploadModalOpen = true)}
						class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors text-sm font-medium shadow-lg shadow-blue-900/20"
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
								points="17 8 12 3 7 8"
							/><line x1="12" x2="12" y1="3" y2="15" /></svg
						>
						Upload
					</button>

					<!-- Logout -->
					<button
						onclick={handleLogout}
						class="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
						title="Log Out"
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
							><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline
								points="16 17 21 12 16 7"
							/><line x1="21" x2="9" y1="12" y2="12" /></svg
						>
					</button>
				</div>
			</div>

			<!-- CONTROLS AREA -->
			<div class="mb-6 flex flex-col sm:flex-row gap-4 items-end sm:items-center">
				<!-- Search Bar Container -->
				<div class="w-full">
					<LibrarySearchBar />
				</div>
			</div>

			<!-- LIBRARY CONTENT -->
			{#if isLoadingLibrary}
				<div class="flex h-64 items-center justify-center text-gray-500">
					<svg
						class="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						><circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle><path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path></svg
					>
					Loading library...
				</div>
			{:else if libraryError}
				<div class="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
					Error loading library: {libraryError}
				</div>
			{:else if library.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center">
					<div class="bg-[#161b2e] p-6 rounded-full mb-4">
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
							class="text-gray-600"
							><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg
						>
					</div>
					<p class="text-xl font-medium text-gray-300">Your library is empty</p>
					<p class="mt-2 text-gray-500 max-w-sm">
						Upload some Mokuro-processed manga volumes to get started building your collection.
					</p>
					<button
						onclick={() => (isUploadModalOpen = true)}
						class="mt-6 text-blue-400 hover:text-blue-300 font-medium hover:underline"
					>
						Upload Now &rarr;
					</button>
				</div>
			{:else}
				<!-- GRID VIEW -->
				{#if viewMode === 'grid'}
					<div
						class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
					>
						{#each library as series (series.id)}
							<div
								class="group relative bg-[#161b2e] rounded-xl border border-gray-800 overflow-hidden hover:border-gray-600 transition-colors flex flex-col"
							>
								<!-- Full Link Overlay (Behind actions) -->
								<a
									href={`/series/${series.id}`}
									class="absolute inset-0 z-0"
									aria-label={`View ${series.folderName}`}
								></a>

								<!-- Cover Image -->
								<div
									class="aspect-[2/3] w-full bg-gray-900 relative overflow-hidden pointer-events-none"
								>
									{#if series.coverPath}
										<img
											src={`/api/files/series/${series.id}/cover`}
											alt={series.folderName}
											class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
										/>
									{:else}
										<div
											class="flex h-full w-full items-center justify-center p-4 text-center text-4xl font-bold text-gray-700 bg-gray-800"
										>
											{series.folderName.charAt(0).toUpperCase()}
										</div>
									{/if}

									<!-- Hover Actions Overlay -->
									<div
										class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-start p-2 pointer-events-none"
									>
										<div class="flex justify-end">
											<button
												type="button"
												onclick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													handleDeleteSeries(series.id, series.title ?? series.folderName);
												}}
												class="pointer-events-auto p-1.5 bg-black/50 rounded-full text-white hover:bg-red-600 transition-colors relative z-10"
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
								</div>

								<!-- Info Section -->
								<div class="p-3 flex flex-col gap-1 pointer-events-none">
									<div
										class="text-sm font-semibold text-white line-clamp-1 group-hover:text-blue-400 transition-colors"
									>
										{series.title ?? series.folderName}
									</div>
									<div class="text-xs text-gray-500 font-medium">
										{series.volumes.length}
										{series.volumes.length === 1 ? 'Volume' : 'Volumes'}
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- LIST VIEW -->
				{:else}
					<div class="flex flex-col gap-3">
						{#each library as series (series.id)}
							<div
								class="group relative bg-[#161b2e] rounded-lg border border-gray-800 p-2 flex items-center gap-4 hover:border-gray-600 transition-colors"
							>
								<!-- Full Link Overlay -->
								<a
									href={`/series/${series.id}`}
									class="absolute inset-0 z-0"
									aria-label={`View ${series.folderName}`}
								></a>

								<!-- Thumbnail -->
								<div
									class="w-10 h-14 bg-gray-900 rounded overflow-hidden flex-shrink-0 pointer-events-none"
								>
									{#if series.coverPath}
										<img
											src={`/api/files/series/${series.id}/cover`}
											alt={series.folderName}
											class="h-full w-full object-cover"
										/>
									{:else}
										<div
											class="h-full w-full flex items-center justify-center text-xs font-bold text-gray-600 bg-gray-800"
										>
											{series.folderName.charAt(0)}
										</div>
									{/if}
								</div>

								<!-- Info -->
								<div class="flex-grow min-w-0 pointer-events-none">
									<div
										class="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors"
									>
										{series.title ?? series.folderName}
									</div>
									<div class="text-xs text-gray-500 flex gap-2 items-center mt-0.5">
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
												class="text-gray-600"
												><path
													d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
												/></svg
											>
											{series.volumes.length} Vols
										</span>
									</div>
								</div>

								<!-- Actions -->
								<div class="pl-4 border-l border-gray-800">
									<button
										type="button"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											handleDeleteSeries(series.id, series.title ?? series.folderName);
										}}
										class="pointer-events-auto relative z-10 p-2 text-gray-500 hover:text-red-500 transition-colors"
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
							</div>
						{/each}
					</div>
				{/if}

				<!-- PAGINATION -->
				<div class="mt-8 flex justify-center">
					<PaginationControls {meta} />
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex h-screen items-center justify-center text-gray-500">Loading...</div>
	{/if}

	<UploadModal
		isOpen={isUploadModalOpen}
		onClose={() => (isUploadModalOpen = false)}
		onUploadSuccess={() => {
			fetchLibrary($page.url.search, true);
		}}
	/>
</div>
