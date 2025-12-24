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
	<div class="block text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">{label}</div>
	<input
		type="text"
		bind:value
		{placeholder}
		class="w-full px-4 py-3 rounded-xl bg-theme-main border border-theme-border text-theme-primary placeholder-gray-500 focus:outline-none focus:border-accent transition-all duration-200"
	/>
</div>
