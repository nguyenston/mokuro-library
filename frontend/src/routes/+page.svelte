<script lang="ts">
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { apiFetch, triggerDownload } from '$lib/api';
	import { confirmation } from '$lib/confirmationStore';
	import UploadModal from '$lib/components/UploadModal.svelte';

	// --- Type definitions ---
	interface UserProgress {
		page: number;
		completed: boolean;
	}

	interface Volume {
		id: string;
		title: string;
		pageCount: number;
	}

	interface Series {
		id: string;
		title: string;
		coverPath: string | null;
		volumes: Volume[];
	}

	// --- Use $state for all reactive variables ---
	let library = $state<Series[]>([]);
	let isLoadingLibrary = $state(true);
	let libraryError = $state<string | null>(null);
	let isUploadModalOpen = $state(false);

	// --- Auth Effect ---
	$effect(() => {
		if (browser) {
			// ONLY redirect if $user is NULL (check complete, no user)
			// DO NOT redirect if $user is UNDEFINED (still loading)
			if ($user === null) {
				goto('/login');
			}
		}
	});

	// --- Library Fetch Effect ---
	$effect(() => {
		if ($user && browser) {
			fetchLibrary();
		}
	});

	// --- fetchLibrary ---
	const fetchLibrary = async () => {
		try {
			isLoadingLibrary = true;
			libraryError = null;
			const data = await apiFetch('/api/library');
			library = data as Series[];
		} catch (e) {
			libraryError = (e as Error).message;
		} finally {
			isLoadingLibrary = false;
		}
	};

	// --- Opens confirmation to delete a series ---
	const handleDeleteSeries = (seriesId: string, seriesTitle: string) => {
		confirmation.open(
			'Delete Series?',
			`Are you sure you want to permanently delete "${seriesTitle}" and all ${
				library.find((s) => s.id === seriesId)?.volumes.length ?? 'its'
			} volumes? This action cannot be undone.`,
			async () => {
				// This is the onConfirm callback
				try {
					await apiFetch(`/api/library/series/${seriesId}`, {
						method: 'DELETE'
					});
					// Refresh the library list
					await fetchLibrary();
				} catch (e) {
					// Show error in the main UI
					libraryError = `Failed to delete series: ${(e as Error).message}`;
				}
			}
		);
	};

	// --- Logout Handler  ---
	const handleLogout = async () => {
		try {
			await apiFetch('/api/auth/logout', {
				method: 'POST'
			});
		} catch (e) {
			console.error('Logout failed:', (e as Error).message);
		}
		user.set(null);
	};
</script>

<div class="min-h-screen bg-gray-100 p-8 dark:bg-gray-900">
	{#if $user}
		<!-- header -->
		<div
			class="flex flex-col items-center justify-between gap-4 border-b border-gray-300 pb-4 dark:border-gray-700 sm:flex-row"
		>
			<h1 class="text-3xl font-bold dark:text-white">
				{$user.username}'s Library
			</h1>

			<div class="flex items-center gap-4 w-full sm:w-auto sm:ml-auto">
				<!-- Download Library Button -->
				<button
					onclick={() => triggerDownload('/api/library/download')}
					disabled={library.length === 0}
					class="hidden sm:flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-5 w-5 text-gray-500 dark:text-gray-400"
					>
						<path
							d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"
						/>
						<path
							d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"
						/>
					</svg>
					Download All
				</button>
				<!-- upload button -->
				<button
					onclick={() => (isUploadModalOpen = true)}
					class="w-1/2 rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:w-auto"
				>
					Upload
				</button>

				<button
					onclick={handleLogout}
					class="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
				>
					Log Out
				</button>
			</div>
		</div>

		<div class="mt-8">
			{#if isLoadingLibrary}
				<p class="mt-4 text-gray-700 dark:text-gray-300">Loading library...</p>
			{:else if libraryError}
				<p class="mt-4 text-red-500 dark:text-red-400">
					Error loading library: {libraryError}
				</p>
			{:else if library.length === 0}
				<div class="text-center">
					<p class="mt-4 text-lg text-gray-700 dark:text-gray-300">Your library is empty.</p>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Upload some manga to get started.
					</p>
				</div>
			{:else}
				<div
					class="mt-6 grid grid-cols-2 gap-y-10 gap-x-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-x-8"
				>
					{#each library as series (series.id)}
						<div class="group relative">
							<!-- Series Cover Display -->
							<div
								class="aspect-[3/4] w-full overflow-hidden rounded-md bg-gray-200 shadow-md dark:bg-gray-800"
							>
								{#if series.coverPath}
									<img
										src={`/api/files/series/${series.id}/cover`}
										alt={series.title}
										class="h-full w-full object-contain object-center transition-opacity group-hover:opacity-75"
									/>
								{:else}
									<div
										class="flex h-full w-full items-center justify-center p-4 text-center text-xl font-bold text-gray-400"
									>
										{series.title}
									</div>
								{/if}

								<!-- Clickable Link Overlay -->
								<a href={`/series/${series.id}`} class="absolute inset-0">
									<span class="sr-only">View {series.title}</span>
								</a>
							</div>

							<div class="mt-4 flex justify-between">
								<div>
									<h3 class="text-sm font-medium text-gray-900 dark:text-white">
										<a href={`/series/${series.id}`}>
											<span aria-hidden="true" class="absolute inset-0"></span>
											{series.title}
										</a>
									</h3>
									<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
										{series.volumes.length}
										{series.volumes.length === 1 ? 'volume' : 'volumes'}
									</p>
								</div>

								<!-- Delete Button -->
								<button
									type="button"
									aria-label="Delete series"
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										handleDeleteSeries(series.id, series.title);
									}}
									class="relative z-10 -m-2 p-2 text-gray-400 hover:text-red-500"
								>
									<!-- Trash Icon -->
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12l1.41 1.41L13.41 14l2.12 2.12l-1.41 1.41L12 15.41l-2.12 2.12l-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"
										/>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex h-screen items-center justify-center">
			<p class="text-gray-700 dark:text-gray-300">Loading...</p>
		</div>
	{/if}

	<UploadModal
		isOpen={isUploadModalOpen}
		onClose={() => (isUploadModalOpen = false)}
		onUploadSuccess={() => {
			isUploadModalOpen = false;
			fetchLibrary(); // Refresh the library list!
		}}
	/>
</div>
