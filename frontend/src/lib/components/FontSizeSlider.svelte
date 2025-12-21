<script lang="ts">
	import { browser } from '$app/environment';
	import type { MokuroBlock } from '$lib/types';
	import MenuSlider from '$lib/components/menu/MenuSlider.svelte';

	// --- Props ---
	let {
		isOpen = $bindable(false),
		block,
		position,
		onOcrChange
	} = $props<{
		isOpen: boolean;
		block: MokuroBlock | null;
		position: { x: number; y: number };
		onOcrChange: () => void;
	}>();

	// --- State ---
	let sliderElement: HTMLDivElement | null = $state(null);
	let internalFontSize = $state(16);
	let finalX = $state(0);
	let finalY = $state(0);

	// --- Effects ---

	// Sync internal state when the block prop changes (when opening)
	$effect(() => {
		if (block) {
			internalFontSize = block.font_size ?? 16;
		}
	});

	// Keep the slider in the viewport
	$effect(() => {
		if (isOpen && sliderElement && browser) {
			const { x, y } = position;
			const menuWidth = sliderElement.offsetWidth;
			const menuHeight = sliderElement.offsetHeight;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Calculate final X
			if (x + menuWidth > viewportWidth) {
				finalX = x - menuWidth;
			} else {
				finalX = x;
			}

			// Calculate final Y
			if (y + menuHeight > viewportHeight) {
				finalY = y - menuHeight;
			} else {
				finalY = y;
			}

			if (finalX < 0) finalX = 0;
			if (finalY < 0) finalY = 0;
		}
	});

	// --- Handlers ---

	const handleSliderInput = (e: Event & { currentTarget: HTMLInputElement }) => {
		internalFontSize = parseFloat(e.currentTarget.value);

		if (block) {
			block.font_size = internalFontSize;
			onOcrChange(); // Mark state as dirty
		}
	};
</script>

<div data-font-slider-popover>
	{#if isOpen}
		<div
			bind:this={sliderElement}
			class="fixed z-50 w-64 rounded-2xl bg-black/60 backdrop-blur-3xl border border-white/10 p-5 shadow-2xl"
			style="left: {finalX}px; top: {finalY}px;"
		>
			<MenuSlider
				label="Font Size"
				bind:value={internalFontSize}
				min={8}
				max={48}
				step={1}
				displayValue="{internalFontSize.toFixed(0)}px"
				onInput={handleSliderInput}
			/>
		</div>
	{/if}
</div>
