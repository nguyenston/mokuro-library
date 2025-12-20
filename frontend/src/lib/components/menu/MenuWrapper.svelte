<script lang="ts">
	// The main container for your menus. It handles the consistent width, background, border, and animation.
	import { type Snippet } from 'svelte';

	let { children, className = 'w-64' } = $props<{
		children: Snippet;
		className?: string;
	}>();
</script>

<div
	class={`bg-theme-surface border border-theme-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${className}`}
>
	{@render children()}
</div>
