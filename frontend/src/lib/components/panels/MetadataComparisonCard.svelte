<script lang="ts">
	import { scrapingState } from '$lib/states/ScrapingState.svelte';
	import type { ScrapedPreview } from '$lib/states/ReviewSession.svelte';

	let {
		preview = $bindable(),
		isBulk = false,
		provider = 'anilist',
		onConfirm,
		onCancel
	}: {
		preview: ScrapedPreview;
		isBulk?: boolean;
		provider?: 'anilist' | 'mal' | 'kitsu';
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	// --- Actions ---

	async function rescrapeWithQuery() {
		if (!preview) return;

		preview.status = 'applying';
		try {
			const { scraped, current } = await scrapingState.scrapeWithFallback(
				preview.seriesId,
				preview.searchQuery,
				provider
			);

			if (!current) {
				console.error('Re-scrape failed: no results from provider');
				preview.status = 'error';
				return;
			}

			// Update the preview with new scraped data (preserving the ID to avoid UI jumps if keyed)
			// We generate a new ID if we want to force re-render, but usually mutating state is fine in Svelte 5.
			preview.current = current;
			preview.scraped = {
				...scraped,
				// The scrapingState.scrapeWithFallback already filters the description,
				// but we ensure consistency here.
				description: scrapingState.filterDescription(scraped.description)
			};
			preview.status = 'pending';
		} catch (error) {
			console.error(`Failed to re-scrape metadata:`, error);
			preview.status = 'error';
		}
	}
</script>

<div class="flex-1 min-h-0 flex flex-col">
	<div class="mb-4">
		<h3 class="text-xl font-bold text-theme-primary truncate">{preview.seriesTitle}</h3>
		<p class="hidden sm:inline text-xs text-theme-secondary">
			{isBulk ? 'Reviewing from queue' : 'Single series review'}
		</p>
	</div>

	<div class="mb-4 flex flex-col sm:flex-row gap-2">
		<input
			type="text"
			bind:value={preview.searchQuery}
			class="flex-1 px-3 py-2 rounded-lg bg-theme-main border border-theme-border text-sm text-theme-primary"
			placeholder="Search title..."
			onkeydown={(e) => e.key === 'Enter' && rescrapeWithQuery()}
		/>
		<button
			onclick={rescrapeWithQuery}
			disabled={preview.status === 'applying'}
			class="px-4 py-2 bg-theme-main border border-theme-border rounded-lg text-sm font-semibold hover:bg-theme-surface-hover transition-colors disabled:opacity-50"
		>
			{preview.status === 'applying' ? 'Searching...' : 'Rescrape'}
		</button>
	</div>

	<div
		class="flex-1 overflow-y-auto border border-theme-border rounded-xl p-4 mb-4 bg-theme-main/20"
	>
		<div class="grid grid-cols-2 gap-4 mb-4 border-b border-theme-border pb-2">
			<div class="text-xs font-bold text-theme-tertiary uppercase">Current</div>
			<div class="text-xs font-bold text-accent uppercase">Scraped</div>
		</div>

		<div class="grid grid-cols-2 gap-4 mb-6">
			<div class="relative max-w-[120px]">
				{#if preview.current.coverPath}
					<img
						src="/api/files/series/{preview.seriesId}/cover"
						alt="Current"
						class="w-full aspect-[7/11] object-cover rounded-lg border border-theme-border"
					/>
				{:else}
					<div
						class="w-full aspect-[7/11] rounded-lg border-2 border-dashed border-theme-border flex items-center justify-center"
					>
						<span class="text-xs text-red-400">No Cover</span>
					</div>
				{/if}
			</div>
			<div>
				{#if preview.scraped.tempCoverPath}
					<div class="relative max-w-[120px]">
						<img
							src="/api/files/preview?path={encodeURIComponent(preview.scraped.tempCoverPath)}"
							alt="New"
							class="w-full aspect-[7/11] rounded-lg border-2 border-dashed border-theme-border flex items-center justify-center object-cover"
						/>
						<div
							class="absolute -top-2 -right-2 bg-accent text-white text-[10px] px-2 py-0.5 rounded-full shadow-md"
						>
							NEW
						</div>
					</div>
				{:else}
					<div
						class="w-full aspect-[7/11] rounded-lg border border-theme-border flex items-center justify-center opacity-50 max-w-[120px]"
					>
						<span class="text-xs">No Change</span>
					</div>
				{/if}
			</div>
		</div>

		{#each [{ label: 'Title', cur: preview.current.title, new: preview.scraped.title }, { label: 'Japanese', cur: preview.current.japaneseTitle, new: preview.scraped.japaneseTitle }, { label: 'Romaji', cur: preview.current.romajiTitle, new: preview.scraped.romajiTitle }] as field}
			<div class="grid grid-cols-2 gap-4 mb-4 border-b border-theme-border/50 pb-2">
				<div>
					<div class="text-[10px] text-theme-secondary mb-1">{field.label}</div>
					<div class="text-sm text-theme-primary break-words">{field.cur || '-'}</div>
				</div>
				<div>
					<div class="text-[10px] text-accent/70 mb-1">{field.label}</div>
					<div
						class="text-sm break-words {field.new
							? 'text-theme-primary'
							: 'text-theme-secondary italic'}"
					>
						{field.new || 'No change'}
					</div>
				</div>
			</div>
		{/each}

		<div class="grid grid-cols-2 gap-4">
			<div>
				<div class="text-[10px] text-theme-secondary mb-1">Description</div>
				<div class="text-xs text-theme-primary opacity-80 whitespace-pre-wrap">
					{preview.current.description || '-'}
				</div>
			</div>
			<div>
				<div class="text-[10px] text-accent/70 mb-1">Description</div>
				{#if preview.scraped.description}
					<div class="text-xs text-theme-primary whitespace-pre-wrap">
						{@html preview.scraped.description}
					</div>
				{:else}
					<div class="text-xs text-theme-secondary italic">No change</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex gap-3 justify-end pt-4 border-t border-theme-border">
		{#if isBulk}
			<button
				onclick={onCancel}
				class="p-2 rounded-lg bg-theme-main border border-theme-border text-theme-secondary hover:text-theme-primary transition-colors"
			>
				Skip (Esc)
			</button>
			<button
				onclick={onConfirm}
				class="p-2 rounded-lg bg-accent text-white hover:bg-accent/80 font-bold transition-colors shadow-lg shadow-accent/20"
			>
				Confirm (Enter)
			</button>
		{:else}
			<button
				onclick={onCancel}
				class="px-4 py-2 rounded-lg bg-theme-main border border-theme-border text-theme-secondary hover:bg-theme-surface-hover transition-colors"
			>
				Cancel
			</button>
			<button
				onclick={onConfirm}
				disabled={preview.status === 'applying'}
				class="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 font-bold transition-colors shadow-lg shadow-accent/20 disabled:opacity-50"
			>
				{preview.status === 'applying' ? 'Saving...' : 'Apply'}
			</button>
		{/if}
	</div>
</div>
