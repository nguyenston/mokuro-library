<script lang="ts">
	// This component wraps a section of menu items, optionally displaying a title at the top.
	import { type Snippet } from 'svelte';

	let {
		title,
		children,
		fontSize = '12px',
		className = ''
	} = $props<{
		title?: string;
		children: Snippet;
		fontSize?: string;
		className?: string;
	}>();
</script>

<div class="flex flex-col pt-1 pb-2">
	{#if title}
		<div class={`px-5 py-2`}>
			<span class="text-[{fontSize}] font-black text-theme-secondary uppercase tracking-[0.2em]">
				{title}
			</span>
		</div>
	{/if}

	<div class="space-y-1.5 px-2 {className}">
		{@render children()}
	</div>
</div>
