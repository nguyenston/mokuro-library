<script lang="ts">
	let {
		label,
		value = $bindable(),
		min = 0,
		step = 1
	} = $props<{
		label: string;
		value: number;
		min?: number;
		step?: number;
	}>();
</script>

<div>
	<div class="block text-sm font-semibold text-gray-400 mb-2">{label}</div>
	<div class="flex items-center gap-2">
		<input
			type="number"
			bind:value
			{min}
			class="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-non flex-1 px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-accent/50 focus:bg-black/30 transition-all duration-200"
		/>
		<button
			onclick={() => (value = Math.max(min, value - step))}
			class="px-3 py-3 rounded-xl bg-black/20 border border-white/10 text-gray-400 hover:text-white hover:bg-black/30 transition-all duration-200"
			title="decrease"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>
		<button
			onclick={() => (value = value + step)}
			class="px-3 py-3 rounded-xl bg-black/20 border border-white/10 text-gray-400 hover:text-white hover:bg-black/30 transition-all duration-200"
			title="increase"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="18 15 12 9 6 15" />
			</svg>
		</button>
	</div>
</div>
