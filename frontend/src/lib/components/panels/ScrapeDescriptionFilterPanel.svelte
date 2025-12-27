<script lang="ts">
	import { scrapingState } from '$lib/states/ScrapingState.svelte';

	let newFilterText = $state('');
	let newFilterIsRegex = $state(false);
	let showManager = $state(false);

	function addCustomFilter() {
		if (!newFilterText.trim()) return;
		scrapingState.addFilter(newFilterText, newFilterIsRegex);
		newFilterText = '';
	}

	function confirmClear() {
		if (confirm('Clear all filters?')) {
			scrapingState.clearAllFilters();
		}
	}
</script>

<div
	class="rounded-2xl backdrop-blur-2xl p-6 border border-theme-primary/10 shadow-theme-secondary/20 shadow-lg space-y-3"
>
	<div class="flex flex-col gap-2 sm:flex-row items-center justify-between mb-2">
		<div class="w-max-10">
			<p class="text-[10px] font-bold text-theme-secondary uppercase tracking-[0.2em]">
				Description Filters
			</p>
			<p class="text-xs text-theme-secondary mt-1">
				Remove unwanted text from descriptions (source tags, HTML, etc.)
			</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => scrapingState.addPresetFilters()}
				class="px-3 py-1 w-20 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-xs font-semibold"
			>
				Add Presets
			</button>
			<button
				onclick={confirmClear}
				disabled={scrapingState.descriptionFilters.length === 0}
				class="px-3 py-1 w-15 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Clear All
			</button>
			<button
				onclick={() => (showManager = !showManager)}
				class="px-3 py-1 w-20 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-xs font-semibold"
			>
				{showManager ? 'Close' : 'Manage'} ({scrapingState.descriptionFilters.filter(
					(f) => f.enabled
				).length})
			</button>
		</div>
	</div>

	{#if showManager}
		<div class="p-4 rounded-xl bg-theme-surface border border-theme-border space-y-3">
			<p class="text-xs font-semibold text-theme-primary">Add New Filter</p>
			<div class="flex flex-col sm:flex-row gap-2">
				<input
					type="text"
					bind:value={newFilterText}
					placeholder="Text or regex pattern..."
					class="flex-1 px-3 py-2 rounded-lg bg-theme-main border border-theme-border text-theme-primary placeholder-gray-500 focus:border-accent focus:outline-none transition-colors text-sm font-mono"
				/>
				<div class="flex gap-2">
					<label
						class="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-main border border-theme-border cursor-pointer hover:border-accent transition-colors"
					>
						<input type="checkbox" bind:checked={newFilterIsRegex} class="accent-accent" />
						<span class="text-xs text-theme-primary">Regex</span>
					</label>
					<button
						onclick={addCustomFilter}
						disabled={!newFilterText.trim()}
						class="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
					>
						Add
					</button>
				</div>
			</div>
		</div>

		<div class="space-y-2 max-h-96 overflow-y-auto">
			{#if scrapingState.descriptionFilters.length === 0}
				<div class="text-center py-8 text-theme-secondary text-sm">No filters configured.</div>
			{:else}
				{#each scrapingState.descriptionFilters as filter (filter.id)}
					<div
						class="flex items-center gap-3 p-3 rounded-lg bg-theme-surface border border-theme-border hover:border-accent/50 transition-colors"
					>
						<input
							type="checkbox"
							checked={filter.enabled}
							onchange={() => scrapingState.toggleFilter(filter.id)}
							class="accent-accent"
						/>
						<div class="flex-1 min-w-0">
							<p class="text-sm text-theme-primary font-mono truncate">{filter.pattern}</p>
							<p class="text-xs text-theme-secondary">{filter.isRegex ? 'Regex' : 'Text'}</p>
						</div>
						<button
							onclick={() => scrapingState.removeFilter(filter.id)}
							class="text-red-400 hover:text-red-300 text-xs transition-colors"
						>
							Remove
						</button>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>
