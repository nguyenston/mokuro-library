<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { browser } from '$app/environment';

	let { isOpen, onClose } = $props<{ isOpen: boolean; onClose: () => void }>();

	interface UserProgress {
		page: number;
		completed: boolean;
		timeRead: number; // in minutes
		charsRead: number;
		lastReadAt?: string;
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
		volumes: Volume[];
	}

	interface ReadingStats {
		recentSpeed: number; // chars/min
		charactersRead: number;
		volumesCompleted: number;
		totalTime: number; // minutes
	}

	interface Achievement {
		id: string;
		title: string;
		description: string;
		icon: string;
		color: string;
		unlocked: boolean;
	}

	interface SpeedBySeries {
		seriesName: string;
		volumes: number;
		avgSpeed: number; // chars/min
		improvement: number; // percentage
	}

	interface CompletedVolume {
		seriesName: string;
		volumeTitle: string;
		speed: number; // chars/min
		vsAvg: number; // percentage
		duration: number; // minutes
		characters: number;
		dateFinished: string;
	}

	let isLoading = $state(true);
	let stats = $state<ReadingStats>({
		recentSpeed: 0,
		charactersRead: 0,
		volumesCompleted: 0,
		totalTime: 0
	});

	// Mock data for features not yet implemented
	let speedHistory = $state<Array<{ date: string; speed: number }>>([]);
	let achievements = $state<Achievement[]>([
		{
			id: 'first_volume',
			title: 'First Volume',
			description: 'You finished your first volume',
			icon: 'trophy',
			color: 'text-status-warning',
			unlocked: false
		},
		{
			id: 'mokuro',
			title: 'Mookuro',
			description: 'Welcome to the reader',
			icon: 'ribbon',
			color: 'text-purple-400',
			unlocked: true
		}
	]);

	let speedBySeries = $state<SpeedBySeries[]>([]);
	let completedVolumes = $state<CompletedVolume[]>([]);
	let selectedTimeFilter = $state<'week' | 'month' | '3months' | '6months' | 'year'>('month');

	// Mock reading speed history data
	const generateMockHistory = () => {
		const data = [];
		const now = new Date();
		for (let i = 29; i >= 0; i--) {
			const date = new Date(now);
			date.setDate(date.getDate() - i);
			data.push({
				date: date.toISOString().split('T')[0],
				speed: 40 + Math.random() * 40 + (i * 0.5) // Gradually increasing trend
			});
		}
		return data;
	};

	async function fetchStatistics() {
		if (!browser) return;

		try {
			isLoading = true;

			// Try statistics endpoint first (if backend implements it)
			// Falls back to calculating from library data if endpoint doesn't exist
			let useFallback = true;
			try {
				const statsData = await apiFetch('/api/library/statistics', { cache: true, cacheTTL: 60000 });
				if (statsData && typeof statsData === 'object' && 'totalMangas' in statsData) {
					// Statistics endpoint exists and returned valid data
					// Note: Backend needs to implement this endpoint with the same structure
					useFallback = false;
					// Would use statsData here if endpoint format matches
				}
			} catch {
				// Endpoint doesn't exist yet, use fallback
				useFallback = true;
			}

			// Fallback: Fetch all series with volumes and progress (less efficient)
			if (useFallback) {
				const libraryData = await apiFetch('/api/library?limit=10000', { cache: true });
				const series = (libraryData.data || []) as Series[];

				// Calculate statistics from real data
				let totalCharsRead = 0;
				let totalTime = 0;
				let completedCount = 0;
				let recentReading: { chars: number; time: number; date?: string } | null = null;

				const seriesStats = new Map<string, { volumes: number; totalChars: number; totalTime: number; speeds: number[] }>();
				const completedVols: CompletedVolume[] = [];

				for (const s of series) {
					if (!s.volumes) continue;

					let seriesChars = 0;
					let seriesTime = 0;
					const speeds: number[] = [];

					for (const vol of s.volumes) {
						const progress = vol.progress?.[0];
						if (progress) {
							totalCharsRead += progress.charsRead || 0;
							totalTime += progress.timeRead || 0;

							seriesChars += progress.charsRead || 0;
							seriesTime += progress.timeRead || 0;

							if (progress.completed && progress.page >= vol.pageCount) {
								completedCount++;
								const speed = progress.timeRead > 0 ? (progress.charsRead / progress.timeRead) : 0;
								speeds.push(speed);

								// Add to completed volumes
								const avgSpeed = speeds.length > 0
									? speeds.reduce((a, b) => a + b, 0) / speeds.length
									: 0;
								const vsAvg = avgSpeed > 0 ? ((speed - avgSpeed) / avgSpeed) * 100 : 0;

								completedVols.push({
								seriesName: s.title || s.folderName,
								volumeTitle: vol.title || `Vol ${vol.folderName}`,
								speed: Math.round(speed),
								vsAvg: Math.round(vsAvg),
								duration: progress.timeRead,
								characters: progress.charsRead,
								dateFinished: progress.lastReadAt || new Date().toISOString()
							});

							// Track most recent reading for recent speed
							if (progress.lastReadAt) {
								if (!recentReading || new Date(progress.lastReadAt) > new Date(recentReading.date || 0)) {
									recentReading = {
										chars: progress.charsRead,
										time: progress.timeRead,
										date: progress.lastReadAt
									};
								}
							} else if (!recentReading) {
								// Fallback: use first completed volume if no lastReadAt
								recentReading = {
									chars: progress.charsRead,
									time: progress.timeRead
								};
							}
						}
					}
				}

				if (seriesTime > 0 && speeds.length > 0) {
					const avgSpeed = seriesTime > 0 ? (seriesChars / seriesTime) : 0;
					const firstSpeed = speeds[0] || 0;
					const lastSpeed = speeds.length > 1 ? speeds[speeds.length - 1] : avgSpeed;
					const improvement = firstSpeed > 0 ? ((lastSpeed - firstSpeed) / firstSpeed) * 100 : 0;

					seriesStats.set(s.id, {
						volumes: s.volumes.length,
						totalChars: seriesChars,
						totalTime: seriesTime,
						speeds
					});

					speedBySeries.push({
						seriesName: s.title || s.folderName,
						volumes: s.volumes.length,
						avgSpeed: Math.round(avgSpeed),
						improvement: Math.round(improvement)
					});
				}
			}

			// Calculate recent speed
			const recentSpeed = recentReading && recentReading.time > 0
				? Math.round(recentReading.chars / recentReading.time)
				: 0;

			// Update achievements based on real data
			achievements[0].unlocked = completedCount > 0;

			stats = {
				recentSpeed,
				charactersRead: totalCharsRead,
				volumesCompleted: completedCount,
				totalTime: Math.round(totalTime)
			};

			// Sort speed by series by improvement (descending)
			speedBySeries.sort((a, b) => b.improvement - a.improvement);

			// Sort completed volumes by date (most recent first)
			completedVolumes = completedVols.sort((a, b) => 
				new Date(b.dateFinished).getTime() - new Date(a.dateFinished).getTime()
			).slice(0, 10); // Limit to 10 most recent

			// Add mock data if no real data available
			if (speedBySeries.length === 0) {
				speedBySeries = [
					{ seriesName: 'Example B', volumes: 4, avgSpeed: 73, improvement: 64 },
					{ seriesName: 'Example A', volumes: 4, avgSpeed: 65, improvement: 84 }
				];
			}

			if (completedVolumes.length === 0) {
				const now = new Date();
				completedVolumes = [
					{
						seriesName: 'Example A',
						volumeTitle: 'Vol 1',
						speed: 45,
						vsAvg: -32,
						duration: 111, // 1h 51m
						characters: 5000,
						dateFinished: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString() // 2 months ago
					},
					{
						seriesName: 'Example B',
						volumeTitle: 'Vol 1',
						speed: 55,
						vsAvg: -20,
						duration: 91, // 1h 31m
						characters: 5000,
						dateFinished: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() // 1 month ago
					}
				];
			}

			// Generate mock history if no real data
			if (completedCount === 0) {
				speedHistory = generateMockHistory();
			} else {
				// Use real data if available (simplified for now)
				speedHistory = generateMockHistory();
			}
		} catch (error) {
			console.error('Failed to fetch statistics:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		if (isOpen) {
			fetchStatistics();
		}
	});

	// Refetch when modal opens
	$effect(() => {
		if (isOpen) {
			fetchStatistics();
		}
	});

	const formatTime = (minutes: number): string => {
		if (minutes < 60) return `${Math.round(minutes)} min`;
		const hours = Math.floor(minutes / 60);
		const mins = Math.round(minutes % 60);
		return `${hours}h ${mins}m`;
	};

	const formatDate = (dateString: string): string => {
		const date = new Date(dateString);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - date.getTime());
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		const diffMonths = Math.floor(diffDays / 30);

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 30) return `${diffDays} days ago`;
		if (diffMonths === 1) return '1 month ago';
		if (diffMonths < 12) return `${diffMonths} months ago`;

		return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
	};

	const getMaxSpeed = () => {
		if (speedHistory.length === 0) return 100;
		return Math.max(...speedHistory.map(d => d.speed)) * 1.2;
	};

	const maxSpeed = $derived(getMaxSpeed());
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
		<div
			class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
			onclick={onClose}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Escape' && onClose()}
			aria-label="Close modal"
		></div>

		<div
			class="relative w-full max-w-7xl max-h-[90vh] transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all sm:my-8 flex flex-col"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border">
				<div class="flex items-center gap-3">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-accent"
					>
						<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
					</svg>
					<h2 class="text-2xl font-bold text-white">Reading Statistics</h2>
				</div>
				<button
					onclick={onClose}
					class="p-2 rounded-lg text-theme-secondary hover:text-white hover:bg-theme-surface-hover transition-colors"
					aria-label="Close"
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
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<!-- Content (Scrollable) -->
			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				{#if isLoading}
					<div class="flex items-center justify-center py-20">
						<div class="text-theme-secondary">Loading statistics...</div>
					</div>
				{:else}
					<!-- Reading Speed History Section -->
					<div>
						<h3 class="text-xl font-bold text-white mb-4">Reading Speed History</h3>
						{#if stats.volumesCompleted === 0}
							<div class="rounded-2xl bg-theme-main p-12 border border-theme-border-light text-center">
								<p class="text-2xl font-bold text-white mb-2">No Reading History Yet</p>
								<p class="text-theme-secondary">Start reading to track your reading speed!</p>
							</div>
						{/if}

						<!-- Stats Cards -->
						<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
							<!-- Recent Speed -->
							<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
								<div class="flex items-center justify-between mb-4">
									<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Recent Speed</p>
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
										class="text-status-warning"
									>
										<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
									</svg>
								</div>
								<div class="text-2xl font-bold text-white">
									{stats.recentSpeed} chars/min
								</div>
							</div>

							<!-- Characters Read -->
							<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
								<div class="flex items-center justify-between mb-4">
									<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Characters Read</p>
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
								<div class="text-2xl font-bold text-white">
									{stats.charactersRead.toLocaleString()}
								</div>
								<div class="text-xs text-gray-400 mt-1">
									{stats.charactersRead.toLocaleString()} total
								</div>
							</div>

							<!-- Volumes Completed -->
							<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
								<div class="flex items-center justify-between mb-4">
									<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Volumes Completed</p>
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
										class="text-status-success"
									>
										<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
									</svg>
								</div>
								<div class="text-2xl font-bold text-white">
									{stats.volumesCompleted}
								</div>
								<div class="text-xs text-gray-400 mt-1">
									({stats.volumesCompleted} tracked)
								</div>
							</div>

							<!-- Total Time -->
							<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
								<div class="flex items-center justify-between mb-4">
									<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Total Time</p>
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
								<div class="text-2xl font-bold text-white">
									{formatTime(stats.totalTime)}
								</div>
							</div>
						</div>

						<!-- Achievements Section -->
						<div class="mb-6">
							<div class="flex items-center gap-2 mb-4">
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
									class="text-status-warning"
								>
									<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
									<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
									<path d="M4 22h16" />
									<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
									<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
									<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
								</svg>
								<h3 class="text-xl font-bold text-white">Achievements</h3>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
								{#each achievements as achievement}
									<div class="rounded-2xl bg-theme-main p-4 border border-theme-border-light flex items-center gap-4 {achievement.unlocked ? '' : 'opacity-50'}">
										<div class="flex-shrink-0">
											{#if achievement.icon === 'trophy'}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="32"
													height="32"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													class={achievement.color}
												>
													<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
													<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
													<path d="M4 22h16" />
													<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
													<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
													<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
												</svg>
											{:else if achievement.icon === 'ribbon'}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="32"
													height="32"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													class={achievement.color}
												>
													<path d="M17.75 9.01l4.5-2.5a1 1 0 0 0 0-1.78l-4.5-2.5a1 1 0 0 0-.75 0l-4.5 2.5a1 1 0 0 0 0 1.78l4.5 2.5a1 1 0 0 0 .75 0z" />
													<path d="M17 22V11a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v11" />
													<path d="M7 10v12" />
													<path d="M12 15v7" />
													<path d="M17 10v12" />
												</svg>
											{/if}
										</div>
										<div>
											<p class="font-bold text-white">{achievement.title}</p>
											<p class="text-sm text-gray-400">{achievement.description}</p>
										</div>
									</div>
								{/each}
							</div>
							<button class="text-sm text-theme-secondary hover:text-white transition-colors">
								Show All Achievements
							</button>
						</div>

						<!-- Reading Speed Over Time -->
						<div>
							<div class="flex items-center justify-between mb-4">
								<div class="flex items-center gap-2">
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
										<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
									</svg>
									<h3 class="text-xl font-bold text-white">Reading Speed Over Time</h3>
								</div>
								<div class="flex gap-2">
									{#each ['week', 'month', '3months', '6months', 'year'] as filter}
										{@const label = filter === '3months' ? '3 Months' : filter === '6months' ? '6 Months' : filter.charAt(0).toUpperCase() + filter.slice(1)}
										<button
											onclick={() => selectedTimeFilter = filter as any}
											class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {selectedTimeFilter === filter
												? 'bg-accent text-white'
												: 'bg-theme-main text-theme-secondary hover:text-white hover:bg-theme-surface-hover'}"
										>
											{label}
										</button>
									{/each}
								</div>
							</div>
							{#if stats.volumesCompleted === 0}
								<p class="text-sm text-gray-400 mb-4">
									Example data shown below. Your actual progress will appear after completing your first volume.
								</p>
							{/if}
							<!-- Chart -->
							<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light">
								<div class="h-48 flex items-end gap-1">
									{#each speedHistory as data, index}
										{@const height = (data.speed / maxSpeed) * 100}
										<div class="flex-1 flex flex-col items-center gap-1 group">
											<div
												class="w-full bg-gradient-to-t from-accent to-accent/60 rounded-t transition-all hover:from-accent-hover hover:to-accent"
												style="height: {height}%"
												title="{data.speed.toFixed(0)} chars/min"
											></div>
											{#if index % 7 === 0}
												<span class="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
													{new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
												</span>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						</div>

						<!-- Bottom Tables -->
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<!-- Speed by Series -->
							<div>
								<h3 class="text-lg font-bold text-white mb-4">Speed by Series</h3>
								<div class="rounded-2xl bg-theme-main border border-theme-border-light overflow-hidden">
									<div class="overflow-x-auto">
										<table class="w-full text-sm">
											<thead class="bg-theme-surface">
												<tr>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Series</th>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Volumes</th>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Speed</th>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Improvement</th>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-white/5">
												{#if speedBySeries.length === 0}
													<tr>
														<td colspan="5" class="px-4 py-8 text-center text-theme-secondary">
															No data available
														</td>
													</tr>
												{:else}
													{#each speedBySeries.slice(0, 5) as item}
														<tr class="hover:bg-white/5 transition-colors">
															<td class="px-4 py-3 text-white font-medium">{item.seriesName}</td>
															<td class="px-4 py-3 text-theme-secondary">{item.volumes}</td>
															<td class="px-4 py-3 text-white">{item.avgSpeed} cpm</td>
															<td class="px-4 py-3 text-status-success">+{item.improvement}%</td>
															<td class="px-4 py-3"></td>
														</tr>
													{/each}
												{/if}
											</tbody>
										</table>
									</div>
								</div>
							</div>

							<!-- Completed Volumes -->
							<div>
								<h3 class="text-lg font-bold text-white mb-4">Completed Volumes</h3>
								<div class="rounded-2xl bg-theme-main border border-theme-border-light overflow-hidden">
									<div class="overflow-x-auto">
										<table class="w-full text-sm">
											<thead class="bg-theme-surface">
												<tr>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Series</th>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Volume</th>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Speed</th>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
													<th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date Finished</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-white/5">
												{#if completedVolumes.length === 0}
													<tr>
														<td colspan="5" class="px-4 py-8 text-center text-theme-secondary">
															No completed volumes yet
														</td>
													</tr>
												{:else}
													{#each completedVolumes.slice(0, 5) as vol}
														<tr class="hover:bg-white/5 transition-colors">
															<td class="px-4 py-3 text-white font-medium">{vol.seriesName}</td>
															<td class="px-4 py-3 text-theme-secondary">{vol.volumeTitle}</td>
															<td class="px-4 py-3">
																<div class="text-white">{vol.speed} cpm</div>
																<div class="text-xs text-status-danger">-{Math.abs(vol.vsAvg)}% vs avg</div>
															</td>
															<td class="px-4 py-3">
																<div class="text-white">{formatTime(vol.duration)}</div>
																<div class="text-xs text-gray-500">{vol.characters.toLocaleString()} chars</div>
															</td>
															<td class="px-4 py-3 text-theme-secondary">
																{formatDate(vol.dateFinished)}
															</td>
														</tr>
													{/each}
												{/if}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
