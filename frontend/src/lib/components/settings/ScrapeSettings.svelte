<script lang="ts">
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';
	import ScrapeDescriptionFilterPanel from '$lib/components/panels/ScrapeDescriptionFilterPanel.svelte';
	import { scrapingState } from '$lib/states/ScrapingState.svelte';

	let width = $state(0);
	let isXs = $derived(width >= 480);
</script>

<svelte:window bind:innerWidth={width} />

<div class="max-w-4xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-theme-primary mb-2">Metadata Sources</h1>
		<p class="text-base text-theme-secondary">
			Configure where Mokuro fetches cover art and series descriptions.
		</p>
	</div>

	<div class="space-y-8">
		<section>
			<MenuGridRadio
				title="Default Provider"
				tooltip="The primary source used for 'Quick Scrape' and Batch operations."
				bind:value={scrapingState.preferredProvider}
				layout={isXs ? [3] : [1, 1, 1]}
				options={[
					{ value: 'anilist', label: 'AniList' },
					{ value: 'mal', label: 'MyAnimeList' },
					{ value: 'kitsu', label: 'Kitsu' }
				]}
			/>
			<p class="mt-2 text-xs text-theme-tertiary px-1">
				* AniList is recommended for best rate limits and image quality.
			</p>
		</section>

		<section>
			<div class="mb-4">
				<h3 class="text-lg font-bold text-theme-primary">Description Cleaning</h3>
				<p class="text-sm text-theme-secondary">
					Automatically remove unwanted text (like "Source: Wikipedia" or HTML tags) from scraped
					descriptions.
				</p>
			</div>
			<ScrapeDescriptionFilterPanel />
		</section>
	</div>
</div>
