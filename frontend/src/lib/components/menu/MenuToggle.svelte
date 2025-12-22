<script lang="ts">
	let {
		label = '',
		description = '',
		checked = $bindable()
	} = $props<{
		label?: string;
		description?: string;
		checked: boolean;
	}>();
</script>

<button
	onclick={() => (checked = !checked)}
	class="w-full text-left rounded-2xl bg-black/30 backdrop-blur-2xl px-5 py-4 border border-white/5 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
>
	<div class="flex flex-col">
		<span class="font-semibold text-sm text-gray-400 group-hover:text-white transition-colors">
			{label}
		</span>
		{#if description}
			<span class="text-xs text-gray-500 mt-0.5">{description}</span>
		{/if}
	</div>

	<div
		class="w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 {checked
			? 'bg-accent/20 border-2 border-accent'
			: 'bg-black/40 border-2 border-white/10'}"
	>
		<div
			class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 {checked
				? 'right-0.5 bg-accent shadow-lg shadow-accent/50'
				: 'left-0.5 bg-gray-600'}"
		></div>
	</div>
</button>
