<script lang="ts">
	import { fade, scale } from 'svelte/transition';

	let { content } = $props<{
		content: string;
	}>();

	// --- State for long press detection ---
	let longPressTimer: ReturnType<typeof setTimeout> | null = $state(null);
	let startX = $state(0);
	let startY = $state(0);
	const LONG_PRESS_DURATION = 500; // 500ms
	const MOVE_THRESHOLD = 10; // 10px drag tolerance

	let isOpen = $state(false);

	function handlePointerEnter(e: PointerEvent) {
		if (e.pointerType === 'mouse') {
			isOpen = true;
		}
	}

	function handlePointerLeave(e: PointerEvent) {
		if (e.pointerType === 'mouse') {
			isOpen = false;
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse') return; // Ignore mouse

		startX = e.clientX;
		startY = e.clientY;

		// Start a timer to detect a long press
		longPressTimer = setTimeout(() => {
			isOpen = !isOpen; // Toggle visibility
			longPressTimer = null;
		}, LONG_PRESS_DURATION);
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerType === 'mouse') return; // Ignore mouse

		// If the timer is still running, the user lifted their finger
		// before the long press duration. This was a "tap".
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (e.pointerType === 'mouse') return; // Ignore mouse

		// If a long press is in progress...
		if (longPressTimer) {
			const deltaX = Math.abs(e.clientX - startX);
			const deltaY = Math.abs(e.clientY - startY);

			// If the user drags their finger too far, cancel the long press.
			if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		}
	}

	// Close on escape key
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			isOpen = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative inline-flex items-center">
	<button
		type="button"
		class="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full border border-theme-border-light text-theme-secondary hover:theme-primary hover:border-accent hover:bg-accent/10 transition-colors cursor-help"
		onpointerenter={handlePointerEnter}
		onpointerleave={handlePointerLeave}
		onpointerdown={handlePointerDown}
		onpointerup={handlePointerUp}
		onpointermove={handlePointerMove}
		aria-label="More information"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
	</button>

	{#if isOpen}
		<div
			class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none"
			transition:fade={{ duration: 150 }}
		>
			<div
				class="relative bg-theme-main border border-theme-border-light rounded-xl shadow-2xl p-4 min-w-[220px] max-w-[320px] pointer-events-auto"
				transition:scale={{ duration: 150, start: 0.95 }}
			>
				<p class="text-sm theme-primary leading-relaxed font-medium whitespace-pre-line">
					{content}
				</p>
				<!-- Arrow -->
				<div
					class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-theme-border-light"
				></div>
				<div
					class="absolute left-1/2 -translate-x-1/2 top-full -mt-px w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-theme-main"
				></div>
			</div>
		</div>
	{/if}
</div>
