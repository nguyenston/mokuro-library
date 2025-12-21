<script lang="ts">
	let {
		label,
		value = $bindable(),
		placeholder = ''
	} = $props<{
		label: string;
		value: string;
		placeholder?: string;
	}>();
</script>

<div>
	<div class="block text-sm font-semibold text-gray-400 mb-2">{label}</div>
	<input
		type="text"
		bind:value
		{placeholder}
		class="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 focus:bg-black/30 transition-all duration-200"
	/>
</div>
