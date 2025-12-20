<script lang="ts">
	// This component wraps a section of menu items, optionally displaying a title at the top.
	import { type Snippet } from 'svelte';

	let {
		title,
		children,
		fontSize = '12px'
	} = $props<{
		title?: string;
		children: Snippet;
		fontSize?: string;
	}>();
</script>

<div class="flex flex-col py-2">
	{#if title}
		<div class={`px-5 py-2.5`}>
			<span class="text-[{fontSize}] font-black text-theme-secondary uppercase tracking-[0.2em]">
				{title}
			</span>
		</div>
	{/if}

	{@render children()}
</div>
