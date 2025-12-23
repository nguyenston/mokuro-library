<script lang="ts">
	import { type Snippet } from 'svelte';

	let { children } = $props<{
		children: Snippet;
	}>();
</script>

<div
	class="relative w-full bg-theme-surface/40 backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-6 sm:p-8 mb-10"
>
	<div class="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
		<div class="w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-30"></div>
	</div>

	<div class="relative z-10">
		{@render children()}
	</div>
</div>
