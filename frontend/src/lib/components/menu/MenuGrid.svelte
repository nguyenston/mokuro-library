<script lang="ts" generics="T">
	import { type Snippet } from 'svelte';

	let {
		items,
		children,
		layout, // Array of column counts per row (e.g. [2, 2] for a 2x2 grid)
		title,
		fontSize = '12px',
		gap = 'gap-2',
		innerClass = 'px-5 pb-2 gap-2'
	} = $props<{
		items: T[];
		children: Snippet<[T]>;
		layout?: number[];
		title?: string;
		fontSize?: string;
		gap?: string;
		innerClass?: string;
	}>();

	// Calculate rows based on layout.
	// If no layout provided, default to a single row containing all items.
	const rows = $derived.by(() => {
		const effectiveLayout = layout ?? [items.length];
		let res = [];
		let idx = 0;
		for (const count of effectiveLayout) {
			res.push({
				items: items.slice(idx, idx + count),
				cols: count
			});
			idx += count;
		}
		return res;
	});
</script>

<div class="flex flex-col">
	{#if title}
		<div class="px-3 py-2">
			<span class="text-[{fontSize}] font-black text-theme-tertiary uppercase tracking-[0.2em]">
				{title}
			</span>
		</div>
	{/if}

	<div class="flex flex-col {innerClass}">
		{#each rows as row}
			<div class="grid {gap}" style="grid-template-columns: repeat({row.cols}, minmax(0, 1fr));">
				{#each row.items as item}
					{@render children(item)}
				{/each}
			</div>
		{/each}
	</div>
</div>
