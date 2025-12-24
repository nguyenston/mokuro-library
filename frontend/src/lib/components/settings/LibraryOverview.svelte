<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { browser } from '$app/environment';

	let { inReader = false }: { inReader?: boolean } = $props();

	interface Statistics {
		totalMangas: number;
		totalPages: number;
		totalUsers: number;
		readingTime: number; // in hours
	}

	interface StorageUsage {
		total: number; // in GB
		categories: {
			images: number;
			mokuro: number;
			mokuroLib: number;
			metadata: number;
			database: number;
		};
	}

	interface RecentActivity {
		username: string;
		action: string;
		timeAgo: string;
	}

	let statistics = $state<Statistics>({
		totalMangas: 0,
		totalPages: 0,
		totalUsers: 0,
		readingTime: 0
	});

	let storageUsage = $state<StorageUsage>({
		total: 124.5,
		categories: {
			images: 80.2,
			mokuro: 25.8,
			mokuroLib: 12.1,
			metadata: 4.2,
			database: 2.2
		}
	});

	let recentActivity = $state<RecentActivity[]>([
		{ username: 'Maxou', action: 'Read pages 0-24 of The Eminence in Shadow', timeAgo: 'just now' },
		{
			username: 'MightyMoogle',
			action: 'Finished Shiroyama to Mita-san',
			timeAgo: 'in 1 hr 27 mins'
		},
		{ username: 'Admin', action: 'Read pages 1040-1055 of One Piece', timeAgo: '2 hours ago' },
		{ username: 'Viewer', action: 'Read pages 1-15 of Berserk', timeAgo: '5 hours ago' }
	]);

	let isLoading = $state(true);
	let users = $state<Array<{ id: string; username: string }>>([]);

	// Fetch statistics from the database
	async function fetchStatistics() {
		if (!browser) return;

		try {
			isLoading = true;

			// Fetch all series to calculate statistics
			const libraryData = await apiFetch('/api/library?limit=10000');
			const series = libraryData.data || [];

			// Calculate total pages
			let totalPages = 0;
			for (const s of series) {
				if (s.volumes) {
					for (const vol of s.volumes) {
						totalPages += vol.pageCount || 0;
					}
				}
			}

			// Fetch users (we'll need to create an endpoint or use auth endpoint)
			// For now, we'll use a placeholder
			// TODO: Create a users endpoint if needed
			const totalUsers = 3; // Placeholder

			// Calculate reading time from progress
			// We'll need to aggregate timeRead from UserProgress
			// For now, using a calculated value based on pages
			const readingTime = Math.round((totalPages * 0.11) / 60); // Rough estimate: 0.11 min per page

			statistics = {
				totalMangas: series.length,
				totalPages,
				totalUsers,
				readingTime
			};
		} catch (error) {
			console.error('Failed to fetch statistics:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchStatistics();
	});

	// Calculate storage percentages
	const storagePercentages = $derived({
		images: (storageUsage.categories.images / storageUsage.total) * 100,
		mokuro: (storageUsage.categories.mokuro / storageUsage.total) * 100,
		mokuroLib: (storageUsage.categories.mokuroLib / storageUsage.total) * 100,
		metadata: (storageUsage.categories.metadata / storageUsage.total) * 100,
		database: (storageUsage.categories.database / storageUsage.total) * 100
	});

	// Calculate cumulative positions for the progress bar
	const cumulativePositions = $derived({
		images: 0,
		mokuro: storagePercentages.images,
		mokuroLib: storagePercentages.images + storagePercentages.mokuro,
		metadata: storagePercentages.images + storagePercentages.mokuro + storagePercentages.mokuroLib,
		database:
			storagePercentages.images +
			storagePercentages.mokuro +
			storagePercentages.mokuroLib +
			storagePercentages.metadata
	});
</script>

<div class="w-full p-8 {inReader ? 'max-w-2xl' : 'max-w-4xl'}">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-white mb-2">Library Overview (WIP)</h1>
		<p class="text-base text-theme-secondary">View statistics and usage of your library.</p>
	</div>

	<div class="space-y-5">
		<!-- Overview Statistics -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<!-- Total Mangas -->
			<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
				<div class="flex items-center justify-between mb-4">
					<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Total Mangas</p>
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
						class="text-gray-400"
					>
						<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
					</svg>
				</div>
				{#if isLoading}
					<div class="text-2xl font-bold text-white">...</div>
				{:else}
					<div class="text-2xl font-bold text-white">
						{statistics.totalMangas.toLocaleString()}
					</div>
				{/if}
			</div>

			<!-- Total Pages -->
			<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
				<div class="flex items-center justify-between mb-4">
					<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Total Pages</p>
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
						class="text-gray-400"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
						<line x1="16" y1="13" x2="8" y2="13" />
						<line x1="16" y1="17" x2="8" y2="17" />
						<polyline points="10 9 9 9 8 9" />
					</svg>
				</div>
				{#if isLoading}
					<div class="text-2xl font-bold text-white">...</div>
				{:else}
					<div class="text-2xl font-bold text-white">
						{statistics.totalPages.toLocaleString()}
					</div>
				{/if}
			</div>

			<!-- Total Users -->
			<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
				<div class="flex items-center justify-between mb-4">
					<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Total Users</p>
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
						class="text-gray-400"
					>
						<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
						<circle cx="9" cy="7" r="4" />
						<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
						<path d="M16 3.13a4 4 0 0 1 0 7.75" />
					</svg>
				</div>
				<div class="flex items-center gap-3">
					{#if isLoading}
						<div class="text-2xl font-bold text-white">...</div>
					{:else}
						<div class="text-2xl font-bold text-white">{statistics.totalUsers}</div>
						<div class="flex gap-1.5">
							<div
								class="w-6 h-6 rounded-full bg-accent-surface border border-accent/50 flex items-center justify-center text-[10px] font-bold text-accent"
							>
								A
							</div>
							<div
								class="w-6 h-6 rounded-full bg-accent-surface border border-accent/50 flex items-center justify-center text-[10px] font-bold text-accent"
							>
								E
							</div>
							<div
								class="w-6 h-6 rounded-full bg-accent-surface border border-accent/50 flex items-center justify-center text-[10px] font-bold text-accent"
							>
								V
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Reading Time -->
			<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
				<div class="flex items-center justify-between mb-4">
					<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Reading Time</p>
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
						class="text-gray-400"
					>
						<circle cx="12" cy="12" r="10" />
						<polyline points="12 6 12 12 16 14" />
					</svg>
				</div>
				{#if isLoading}
					<div class="text-2xl font-bold text-white">...</div>
				{:else}
					<div class="text-2xl font-bold text-white">{statistics.readingTime}h</div>
				{/if}
			</div>
		</div>

		<!-- Storage Usage -->
		<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
			<div class="mb-4 flex items-center gap-2">
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
					class="text-status-success"
				>
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
					<line x1="9" y1="3" x2="9" y2="21" />
				</svg>
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Storage Usage</p>
			</div>

			<div class="mb-4 flex items-center justify-between">
				<div class="relative w-full h-4 rounded-full bg-theme-surface overflow-hidden">
					<!-- Images (Green) -->
					<div
						class="absolute left-0 top-0 h-full bg-status-success"
						style="width: {storagePercentages.images}%"
					></div>
					<!-- .mokuro (Blue) -->
					<div
						class="absolute left-0 top-0 h-full bg-blue-500"
						style="left: {cumulativePositions.mokuro}%; width: {storagePercentages.mokuro}%"
					></div>
					<!-- mokuro-lib (Purple) -->
					<div
						class="absolute left-0 top-0 h-full bg-accent"
						style="left: {cumulativePositions.mokuroLib}%; width: {storagePercentages.mokuroLib}%"
					></div>
					<!-- Metadata (Orange) -->
					<div
						class="absolute left-0 top-0 h-full bg-orange-500"
						style="left: {cumulativePositions.metadata}%; width: {storagePercentages.metadata}%"
					></div>
					<!-- Database (Red) -->
					<div
						class="absolute left-0 top-0 h-full bg-red-500"
						style="left: {cumulativePositions.database}%; width: {storagePercentages.database}%"
					></div>
				</div>
				<span class="ml-4 text-sm font-bold text-white whitespace-nowrap"
					>{storageUsage.total} GB</span
				>
			</div>

			<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-status-success"></div>
					<span class="text-xs text-gray-400">Images</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-blue-500"></div>
					<span class="text-xs text-gray-400">.mokuro</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-accent"></div>
					<span class="text-xs text-gray-400">mokuro-lib</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-orange-500"></div>
					<span class="text-xs text-gray-400">Metadata</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full bg-red-500"></div>
					<span class="text-xs text-gray-400">Database</span>
				</div>
			</div>
		</div>

		<!-- Recent Activity -->
		<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
			<div class="mb-4 flex items-center gap-2">
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
					<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
				</svg>
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
					Recent Activity
				</p>
			</div>

			<div class="space-y-3">
				{#each recentActivity as activity (activity.username)}
					<div
						class="flex items-center gap-4 p-3 rounded-xl bg-theme-surface hover:bg-theme-surface-hover transition-colors"
					>
						<div
							class="w-10 h-10 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0"
						>
							{activity.username.charAt(0).toUpperCase()}
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold text-white truncate">{activity.username}</p>
							<p class="text-xs text-gray-400 truncate">{activity.action}</p>
						</div>
						<span class="text-xs text-gray-500 whitespace-nowrap">{activity.timeAgo}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
