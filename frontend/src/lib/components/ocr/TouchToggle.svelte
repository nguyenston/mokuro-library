<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		trigger: Snippet;
		children: Snippet;
		class?: string;
		mode?: 'tooltip' | 'overlay' | 'custom';
		childClass?: string;
		forceVisible?: boolean;
	}

	let {
		trigger,
		children,
		class: className = '',
		mode = 'tooltip',
		childClass = '',
		forceVisible = false
	}: Props = $props();

	// --- State for long press detection ---
	let longPressTimer: ReturnType<typeof setTimeout> | null = $state(null);
	let startX = $state(0);
	let startY = $state(0);
	const LONG_PRESS_DURATION = 500; // 500ms
	const MOVE_THRESHOLD = 10; // 10px drag tolerance

	let isOpen = $state(false);
	let containsFocus = $state(false);

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

	function handleFocusIn() {
		containsFocus = true;
	}

	function handleFocusOut(e: FocusEvent) {
		const wrapper = e.currentTarget as HTMLElement;
		if (!e.relatedTarget || !wrapper.contains(e.relatedTarget as Node)) {
			containsFocus = false;
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse') return; // Ignore mouse

		// If the press started on a text line, ignore it
		// and let the browser handle native text selection.
		if ((e.target as HTMLElement).closest('[data-ignore-long-press="true"]')) {
			return;
		}

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

	let isVisible = $derived(isOpen || forceVisible);
</script>

<div
	class="relative {className}"
	onpointerenter={handlePointerEnter}
	onpointerleave={handlePointerLeave}
	onpointerdown={handlePointerDown}
	onpointerup={handlePointerUp}
	onpointermove={handlePointerMove}
	onfocusin={handleFocusIn}
	onfocusout={handleFocusOut}
	role="button"
	tabindex="0"
>
	{@render trigger()}

	{#if mode === 'tooltip'}
		<!--
      TOOLTIP MODE:
      - absolute left-0 mt-2: Positions the tooltip below the trigger, aligned to the left edge.
      - w-max: Sets width to the intrinsic maximum width of the content.
      - min-w-[200px]: Enforces a minimum width for usability.
      - origin-top-left: Ensures the scale transition appears to grow from the trigger.
      - scale-100/95: Provides the "zoom" entrance/exit animation effect.
    -->
		<div
			class="absolute left-0 mt-2 w-max min-w-[200px] origin-top-left transition-all duration-200 ease-out
        pointer-events-auto {childClass}
        {isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}"
		>
			{@render children()}
		</div>
	{:else if mode === 'overlay'}
		<!--
      OVERLAY MODE:
      - absolute top-0 left-0: Anchors the overlay exactly to the top-left corner of the parent container.
      - h-full w-full: Forces the overlay to match the exact dimensions of the parent container.
      - transition-opacity: Limits animation to opacity only, avoiding sub-pixel bleeding from scale transforms.
      - opacity-100/0: Controls visual visibility without removing the element from the render tree (needed for persistent OCR).
      - pointer-events-auto/none: Manually manages interaction capability. critical when opacity is 0 so clicks pass through to the trigger.
    -->
		<div
			class="absolute top-0 left-0 h-full w-full transition-opacity duration-200 ease-out
        pointer-events-auto {childClass}
        {isVisible ? 'opacity-100' : 'opacity-0'}"
		>
			{@render children()}
		</div>
	{:else}
		<div class="{childClass} {isVisible ? 'opacity-100' : 'opacity-0'}">
			{@render children()}
		</div>
	{/if}
</div>
