<script lang="ts" generics="T">
	import { type Snippet } from 'svelte';
	import SettingTooltip from './SettingTooltip.svelte';
	import MenuGrid from './MenuGrid.svelte';

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
		layout,
		gridClass = 'grid gap-3', // Kept for API compatibility, but passed as class to MenuGrid
		itemClass = 'flex flex-col items-center justify-center gap-3 p-3.5',
		children
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

	<MenuGrid
		items={options}
		{layout}
		innerClass="flex flex-col gap-3"
		gap="gap-3"
		className={layout ? '' : gridClass}
	>
		{#snippet children(option: Option<T>)}
			{@render renderItem(option)}
		{/snippet}
	</MenuGrid>
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
