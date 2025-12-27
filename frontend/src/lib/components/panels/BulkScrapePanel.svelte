<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { scrapingState } from '$lib/states/ScrapingState.svelte';
	import { lockScroll } from '$lib/actions/lockScroll';
	import MetadataComparisonCard from './MetadataComparisonCard.svelte';

	let {
		onClose,
		provider = 'anilist'
	}: {
		onClose: () => void;
		provider?: 'anilist' | 'mal' | 'kitsu';
	} = $props();

	// Computed props from the global session
	const session = scrapingState.session;

	// Local UI state
	let width = $state(0);
	let isXs = $derived(width >= 480);

	// --- Lifecycle ---

	onMount(() => {
		// Auto-start the machine when the panel opens
		scrapingState.startScrapingQueue(provider);
	});

	onDestroy(() => {
		// Safety: Ensure we stop fetching if the user force-closes the modal
		scrapingState.stopScraping();
	});

	// --- Inputs ---

	function handleKeydown(e: KeyboardEvent) {
		if (document.activeElement?.tagName === 'INPUT') {
			if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
			return;
		}

		switch (e.key) {
			case 'ArrowRight':
				session.defer();
				break;
			case 'ArrowLeft':
				session.rewind();
				break;
			case 'Enter':
				e.preventDefault();
				session.confirmCurrent();
				break;
			case 'Escape':
				e.preventDefault();
				session.skipCurrent();
				break;
		}
	}
</script>

<svelte:window bind:innerWidth={width} onkeydown={handleKeydown} />

<div
	use:lockScroll
	class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
	transition:fade={{ duration: 200 }}
>
	<div
		class="bg-theme-main rounded-2xl border border-accent max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl"
	>
		<div
			class="bg-theme-surface border-b border-theme-border p-4 flex items-center justify-between"
		>
			<div class="flex items-center gap-4">
				<h2 class="hidden sm:inline text-lg font-bold text-theme-primary">Bulk Review</h2>

				<div class="flex items-center gap-2 text-xs font-mono">
					<span
						class="px-2 py-1 rounded bg-theme-main border border-theme-border text-theme-secondary"
					>
						Remaining: {session.totalPending}
					</span>
					<span
						class="px-2 py-1 rounded bg-theme-main border border-theme-border text-status-success"
					>
						Applied: {session.stats.success}
					</span>
				</div>
			</div>

			<div class="flex gap-2">
				{#if scrapingState.isScraping}
					<button
						onclick={() => scrapingState.stopScraping()}
						class="p-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2"
						title="Stop Scan"
					>
						<span class="text-xs font-bold uppercase">Stop</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<rect x="6" y="6" width="12" height="12" rx="2" />
						</svg>
					</button>
				{:else if session.totalPending > 0}
					<button
						onclick={() => scrapingState.startScrapingQueue(provider)}
						class="p-2 text-accent bg-accent/10 border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors"
						title="Resume Scan"
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
						>
							<polygon points="5 3 19 12 5 21 5 3"></polygon>
						</svg>
					</button>
				{/if}

				<button
					onclick={onClose}
					class="p-2 text-theme-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors"
					title="Close"
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
		</div>

		<div class="flex-1 flex overflow-hidden">
			<div class="w-64 border-r border-theme-border bg-theme-surface hidden md:flex flex-col">
				<div
					class="p-2 text-[10px] font-bold text-theme-secondary uppercase sticky top-0 bg-theme-surface border-b border-theme-border/50"
				>
					Up Next
				</div>
				<div class="flex-1 overflow-y-auto p-2 space-y-1">
					{#each session.upcoming.items as item, i (item.id)}
						<div
							class="px-3 py-2 rounded text-xs truncate transition-colors {i === 0
								? 'bg-accent text-white shadow-md'
								: 'text-theme-secondary opacity-70'}"
						>
							<div class="flex justify-between items-center gap-1">
								<span class="truncate max-w-[94%]">{item.seriesTitle}</span>
								{#if item.status === 'scraping'}
									<div
										class="block w-[8px] aspect-square rounded-full bg-theme-tertiary animate-pulse"
									></div>
								{:else if item.status === 'pending'}
									<div class="block w-[8px] aspect-square rounded-full bg-status-success"></div>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<div class="h-1/3 border-t border-theme-border bg-black/20 overflow-y-auto">
					<div
						class="p-2 text-[10px] font-bold text-theme-secondary uppercase sticky top-0 bg-theme-surface border-b border-theme-border/50"
					>
						History
					</div>
					<div class="p-2 space-y-1">
						{#each session.history as item (item.id)}
							<div class="flex justify-between px-3 py-1 text-xs text-theme-secondary">
								<span class="truncate w-32 opacity-50">{item.seriesTitle}</span>
								<span
									class={item.status === 'applied' ? 'text-status-success' : 'text-status-danger'}
								>
									{item.status === 'applied' ? '✓' : '✕'}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div
				class="flex-1 w-full bg-theme-main {isXs
					? 'p-4'
					: 'p-2'} flex flex-col items-center justify-center"
			>
				{#if session.current}
					<div class="flex flex-col w-full h-full max-w-3xl">
						<div class="flex justify-between mb-2">
							<button
								onclick={() => session.rewind()}
								disabled={session.deferred.length === 0}
								class="text-xs text-theme-secondary disabled:opacity-20 hover:text-theme-primary transition-colors"
							>
								← Back ({session.deferred.length})
							</button>
							<button
								onclick={() => session.defer()}
								disabled={session.upcoming.size <= 1}
								class="text-xs text-theme-secondary disabled:opacity-20 hover:text-theme-primary transition-colors"
							>
								Skip for now →
							</button>
						</div>

						<MetadataComparisonCard
							bind:preview={session.upcoming.items[0]}
							{provider}
							isBulk={true}
							onConfirm={() => session.confirmCurrent()}
							onCancel={() => session.skipCurrent()}
						/>
					</div>
				{:else}
					<div class="text-center">
						{#if scrapingState.isScraping}
							<div class="text-theme-primary text-lg animate-pulse">Scanning series...</div>
							<p class="text-theme-secondary text-sm mt-2">Waiting for results...</p>
						{:else}
							<div class="text-theme-primary font-bold text-xl">Session Complete</div>
							<p class="text-theme-secondary mt-1">
								Success: <span class="text-status-success">{session.stats.success}</span> / Skipped:
								<span class="text-status-danger">{session.stats.skipped}</span>
							</p>
							<button
								onclick={onClose}
								class="mt-6 px-6 py-2 bg-accent text-white rounded-lg font-bold hover:bg-accent/80 transition-colors"
							>
								Finish
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
