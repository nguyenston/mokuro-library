<script lang="ts">
	import { apiFetch, triggerDownload } from '$lib/api';
	import { user } from '$lib/authStore';
	import { confirmation } from '$lib/confirmationStore';

	// --- Type definitions ---
	interface UserProgress {
		page: number;
		completed: boolean;
	}
	interface Volume {
		id: string;
		title: string;
		pageCount: number;
		coverImageName: string | null;
		progress: UserProgress[]; // max 1 item
	}
	interface Series {
		id: string;
		title: string;
		coverPath: string | null;
		volumes: Volume[];
	}

	// Track debounce toggleComplete timers for each volume independently
	//// Stores the *intended* completion status for volumes that haven't been saved yet.
	let pendingToggleComplete = new Map<string, boolean>();
	let toggleCompleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

	// --- State ---
	let series = $state<Series | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let fileInput: HTMLInputElement | null = $state(null); // Reference to hidden input
	let coverRefreshTrigger = $state(0); // Used to bust cache on cover update

	// Get the series ID from the URL
	// Get the 'params' prop from SvelteKit's router
	let { params } = $props<{ params: { id: string } }>();

	// --- Fetch Data ---
	$effect(() => {
		// This effect now reactively depends on $user and $page.params.id
		if ($user && params.id) {
			// Pass the reactive ID to the fetch function
			fetchSeriesData(params.id);
		}
		return () => {
			flushPendingToggleComplete();
		};
	});

	// Make the function accept the id as an argument
	const fetchSeriesData = async (seriesId: string) => {
		isLoading = true;
		error = null;
		try {
			// Use the seriesId argument in the API call
			const data = await apiFetch(`/api/library/series/${seriesId}`);
			series = data as Series;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	};

	// --- Opens confirmation to delete a volume
	const handleDeleteVolume = (volumeId: string, volumeTitle: string) => {
		confirmation.open(
			'Delete Volume?',
			`Are you sure you want to permanently delete "${volumeTitle}"? This action cannot be undone.`,
			async () => {
				// This is the onConfirm callback
				try {
					await apiFetch(`/api/library/volume/${volumeId}`, {
						method: 'DELETE'
					});
					// Refresh the series data
					await fetchSeriesData(params.id);
				} catch (e) {
					// Show error in the main UI
					error = `Failed to delete volume: ${(e as Error).message}`;
				}
			}
		);
	};

	// --- Handles cover image upload ---
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

			// Force re-fetch of series data to get updated coverPath if it was null
			await fetchSeriesData(series.id);
			// Update trigger to force <img> reload even if URL is same
			coverRefreshTrigger++;
		} catch (e) {
			error = `Failed to upload cover: ${(e as Error).message}`;
		} finally {
			// Clear input for next use
			fileInput.value = '';
		}
	};

	// Toggles the completion status of a volume with Optimistic UI and Debouncing
	const toggleComplete = async (volumeId: string) => {
		if (!series) return;

		// 1. Find the volume in our local state
		const volumeIndex = series.volumes.findIndex((v) => v.id === volumeId);
		if (volumeIndex === -1) return;

		// 2. Calculate new status based on current LOCAL state
		const vol = series.volumes[volumeIndex];
		// Handle potential missing progress array safely
		vol.progress[0] = vol.progress[0] ?? {
			page: 1,
			completed: false,
			timeRead: 0,
			charsRead: 0
		};
		const newStatus = !vol.progress[0].completed;

		// 3. OPTIMISTIC UI UPDATE: Update local state immediately
		series.volumes[volumeIndex].progress[0].completed = newStatus;

		// 4. DEBOUNCE LOGIC:
		// If a timer already exists for THIS volume, clear it (cancel previous send)
		if (toggleCompleteTimers.has(volumeId)) {
			clearTimeout(toggleCompleteTimers.get(volumeId)!);
		}
		// store new intended status
		pendingToggleComplete.set(volumeId, newStatus);

		// Set a new timer to send the ACTUAL request in 1 second
		const timerId = setTimeout(async () => {
			toggleCompleteTimers.delete(volumeId); // Clean up the map entry
			pendingToggleComplete.delete(volumeId); // Clean up the map entry

			try {
				await apiFetch(`/api/progress/volume/${volumeId}`, {
					method: 'PUT',
					body: { completed: newStatus }
				});
			} catch (e) {
				console.error('Failed to save toggle state:', e);
				// NOTE: In a production app,  revert the
				// optimistic update here if the server request fails.
			}
		}, 1000); // 1-second debounce buffer

		// Store the new timer ID
		toggleCompleteTimers.set(volumeId, timerId);
	};

	// Helper to get progress percentage
	const getProgressPercent = (volume: Volume) => {
		const progress = volume.progress[0];
		if (!progress || !volume.pageCount) return 0;
		// We use (page - 1) because page 1 is 0% complete, not (1 / pageCount)%
		return Math.floor(((progress.page - 1) / (volume.pageCount - 1)) * 100);
	};

	/**
	 * Flushes all pending toggles immediately. Called on unmount.
	 */
	const flushPendingToggleComplete = () => {
		for (const [volumeId, status] of pendingToggleComplete.entries()) {
			// Clear any pending timer for this volume
			if (toggleCompleteTimers.has(volumeId)) {
				clearTimeout(toggleCompleteTimers.get(volumeId)!);
			}

			try {
				apiFetch(`/api/progress/volume/${volumeId}`, {
					method: 'PUT',
					body: { completed: status }
				});
			} catch (e) {
				console.error(`Failed to save toggle for volume ${volumeId}:`, e);
			}
		}
	};
</script>

<div class="min-h-screen bg-gray-100 p-8 dark:bg-gray-900">
	<a
		href="/"
		class="mb-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
	>
		&larr; Back to Library
	</a>

	{#if isLoading}
		<p class="text-gray-700 dark:text-gray-300">Loading series...</p>
	{:else if error}
		<p class="text-red-500 dark:text-red-400">
			Error loading series: {error}
		</p>
	{:else if series}
		<!--  Series Header -->
		<div class="mb-8 flex items-top gap-6">
			<!-- Avatar Container -->
			<div
				class="group relative h-64 w-48 flex-shrink-0 overflow-hidden rounded-md bg-gray-200 shadow-md dark:bg-gray-800"
			>
				{#if series.coverPath}
					<img
						src={`/api/files/series/${series.id}/cover?t=${coverRefreshTrigger}`}
						alt={series.title}
						class="h-full w-full object-contain"
					/>
				{:else}
					<div
						class="flex h-full w-full items-center justify-center text-4xl font-bold text-gray-400"
					>
						{series.title.charAt(0).toUpperCase()}
					</div>
				{/if}

				<!-- Hover Overlay -->
				<button
					type="button"
					onclick={() => fileInput?.click()}
					class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
				>
					<span class="text-sm font-medium text-white">Change Cover</span>
				</button>
			</div>

			<div class="flex flex-col items-center gap-2">
				<h1 class="text-4xl font-bold dark:text-white">{series.title}</h1>

				<!-- Series Download Button -->
				<button
					onclick={() => triggerDownload(`/api/library/series/${series?.id}/download`)}
					class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
				>
					<!-- Download Icon -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-5 w-5"
					>
						<path
							d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"
						/>
						<path
							d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"
						/>
					</svg>
					Download Series
				</button>
			</div>
		</div>

		<!-- Hidden File Input -->
		<input
			type="file"
			accept="image/*"
			class="hidden"
			bind:this={fileInput}
			onchange={handleCoverUpload}
		/>

		<!-- Volume Grid -->
		<div
			class="mt-8 grid grid-cols-2 gap-y-10 gap-x-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-x-8"
		>
			{#each series.volumes as volume (volume.id)}
				{@const percent = getProgressPercent(volume)}
				{@const isCompleted = volume.progress[0]?.completed ?? false}
				<div class="group relative">
					<div class="aspect-[3/4] w-full overflow-hidden rounded-md bg-gray-200 dark:bg-gray-800">
						{#if volume.coverImageName}
							<img
								src={`/api/files/volume/${volume.id}/image/${volume.coverImageName}`}
								alt={volume.title}
								class="h-full w-full object-contain object-center"
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center text-center text-gray-400">
								{volume.title}
							</div>
						{/if}
					</div>
					<div class="flex flex-col justify-between mt-4 h-22">
						<h3 class="text-md font-medium text-gray-900 dark:text-white line-clamp-2">
							<a href={`/volume/${volume.id}`}>
								<span aria-hidden="true" class="absolute inset-0"></span>
								{volume.title}
							</a>
						</h3>

						<div class="flex flex-col gap-1">
							<!-- Progress Text -->
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								{volume.progress[0] ? volume.progress[0].page : 0}/{volume.pageCount} pages
							</p>
							<!-- Progress Bar -->
							<div
								class="bottom-0 left-0 h-1.5 bg-indigo-600 dark:bg-indigo-500"
								style="width: {percent}%"
							></div>
						</div>
					</div>

					<!-- Toggle Complete Button  -->
					<button
						type="button"
						aria-label={isCompleted ? 'Mark as unread' : 'Mark as read'}
						aria-pressed={isCompleted}
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							toggleComplete(volume.id);
						}}
						class="absolute top-2 left-2 z-10 rounded-full p-1 transition-colors cursor-pointer
                     {isCompleted
							? 'bg-green-500 text-white opacity-100'
							: 'bg-black/30 text-white/50 opacity-0 hover:bg-black/50 hover:text-white group-hover:opacity-100 [@media(hover:none)]:opacity-100'}"
					>
						<!-- Check Icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="h-5 w-5"
						>
							<path
								fill-rule="evenodd"
								d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>

					<!-- Volume Actions (Top-Right) -->
					<div
						class="absolute top-2 right-2 z-10 flex flex-col gap-2 transition-opacity opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
					>
						<!-- Volume Download Button -->
						<button
							type="button"
							aria-label="Download volume"
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								triggerDownload(`/api/library/volume/${volume.id}/download`);
							}}
							class="rounded-full bg-black/30 p-1 text-white/70 hover:bg-blue-600 hover:text-white"
						>
							<!-- Download Icon (Small) -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="h-5 w-5"
							>
								<path
									d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"
								/>
								<path
									d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"
								/>
							</svg>
						</button>

						<!-- Delete Button -->
						<button
							type="button"
							aria-label="Delete volume"
							onclick={(e) => {
								e.preventDefault(); // Stop navigation
								e.stopPropagation(); // Stop group click
								handleDeleteVolume(volume.id, volume.title);
							}}
							class="rounded-full bg-black/30
              p-1 text-white/70 hover:bg-red-600
              hover:text-white cursor-pointer"
						>
							<!-- Trash Icon -->
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
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
