<script lang="ts">
	let {
		label,
		value = $bindable(),
		min = 0,
		max = 1,
		step = 0.1,
		displayValue = '',
		onInput
	} = $props<{
		label: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		displayValue?: string;
		onInput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
	}>();
</script>

<div>
	<div class="flex items-center justify-between mb-2">
		<div class="block text-sm font-semibold text-gray-400">{label}</div>
		{#if displayValue}
			<span class="text-xs font-semibold text-accent">{displayValue}</span>
		{/if}
	</div>
	<div class="relative">
		<input
			type="range"
			bind:value
			{min}
			{max}
			{step}
			oninput={onInput}
			class="w-full h-2 rounded-full appearance-none cursor-pointer slider"
			style="--progress: {(value - min) / (max - min)}"
		/>
		<style>
			.slider {
				/* Use --color-accent directly for the filled part (0% to progress%) */
				/* Use white/10 for the empty part (progress% to 100%) */
				background: linear-gradient(
					to right,
					var(--color-accent) 0%,
					var(--color-accent) calc(var(--progress) * 100%),
					rgba(255, 255, 255, 0.1) calc(var(--progress) * 100%),
					rgba(255, 255, 255, 0.1) 100%
				);
			}

			/* Webkit (Chrome, Safari, Edge) Thumb */
			.slider::-webkit-slider-thumb {
				-webkit-appearance: none;
				appearance: none;
				width: 18px;
				height: 18px;
				border-radius: 50%;
				background: var(--color-accent);
				cursor: pointer;
				box-shadow: 0 0 8px color-mix(in srgb, var(--color-accent), transparent 50%);
				margin-top: 0px;
			}

			/* Firefox Thumb */
			.slider::-moz-range-thumb {
				width: 18px;
				height: 18px;
				border-radius: 50%;
				background: var(--color-accent);
				cursor: pointer;
				border: none;
				box-shadow: 0 0 8px color-mix(in srgb, var(--color-accent), transparent 50%);
			}
		</style>
	</div>
</div>
