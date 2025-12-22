<script lang="ts" generics="T">
	import { type Snippet } from 'svelte';
	import SettingTooltip from './SettingTooltip.svelte';

	// Allow the option object to carry extra data (like color arrays)
	type Option<T> = {
		value: T;
		label: string;
		icon?: Snippet;
		[key: string]: any;
	};

	let {
		title,
		tooltip,
		value = $bindable(),
		options,
		layout, // Optional: if provided, splits into rows. If undefined, uses single grid.
		gridClass = 'grid gap-3', // Class for the container in single-grid mode
		itemClass = 'flex flex-col items-center justify-center gap-3 p-3.5', // Default to "Reader" style
		children // Optional snippet for custom content: (option, selected)
	} = $props<{
		title?: string;
		tooltip?: string;
		value: T;
		options: Option<T>[];
		layout?: number[];
		gridClass?: string;
		itemClass?: string;
		children?: Snippet<[Option<T>, boolean]>;
	}>();

	// Helper to split options into rows based on layout configuration (Legacy/Specific layouts)
	function getRows() {
		if (!layout) return [];
		let rows = [];
		let currentIndex = 0;
		for (const count of layout) {
			rows.push({
				items: options.slice(currentIndex, currentIndex + count),
				cols: count
			});
			currentIndex += count;
		}
		return rows;
	}

	const rows = $derived(getRows());
	// Find the label of the currently selected option for the header
	const selectedLabel = $derived(options.find((o: Option<T>) => o.value === value)?.label ?? '');
</script>

<div
	class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg space-y-3"
>
	{#if title}
		<div class="mb-1 flex items-center justify-between">
			<div class="flex items-center">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
					{title}
				</p>
				{#if tooltip}
					<SettingTooltip content={tooltip} />
				{/if}
			</div>
			<span class="text-xs font-bold text-accent uppercase tracking-wider">
				{selectedLabel}
			</span>
		</div>
	{/if}

	{#if layout}
		{#each rows as row}
			<div class="grid gap-3" style="grid-template-columns: repeat({row.cols}, minmax(0, 1fr));">
				{#each row.items as option}
					{@render renderItem(option)}
				{/each}
			</div>
		{/each}
	{:else}
		<div class={gridClass}>
			{#each options as option}
				{@render renderItem(option)}
			{/each}
		</div>
	{/if}
</div>

{#snippet renderItem(option: Option<T>)}
	{@const isSelected = value === option.value}
	<button
		onclick={() => (value = option.value)}
		class="{itemClass} rounded-xl border-2 transition-all duration-200 {isSelected
			? 'bg-accent-surface border-accent text-accent shadow-lg shadow-accent/50'
			: 'bg-black/20 border-white/10 text-gray-500 hover:border-accent/40 hover:bg-black/30 hover:text-gray-300'}"
	>
		{#if children}
			{@render children(option, isSelected)}
		{:else}
			{#if option.icon}
				{@render option.icon()}
			{/if}
			<span
				class="{option.icon ? 'text-xs' : 'text-sm'} font-bold uppercase tracking-wider text-center"
			>
				{option.label}
			</span>
		{/if}
	</button>
{/snippet}
