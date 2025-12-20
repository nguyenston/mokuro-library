<script lang="ts">
	import { type Snippet } from 'svelte';

	let {
		children,
		title,
		fontSize = '12px',
		className = ''
	} = $props<{
		children: Snippet;
		title?: string;
		fontSize?: string;
		className?: string;
	}>();
</script>

<div class="flex flex-col {className}">
	{#if title}
		<div class={`px-3 py-2`}>
			<span class="text-[{fontSize}] font-black text-theme-tertiary uppercase tracking-[0.2em]">
				{title}
			</span>
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-2 px-5 pb-2">
		{@render children()}
	</div>
</div>
