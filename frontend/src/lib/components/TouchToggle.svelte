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

	/**
	 * Filters out genuine mouse clicks (which should only use hover)
	 * while correctly capturing touch/pen 'clicks' that don't have a hover state.
	 */
	function handleClick(e: MouseEvent) {
		// Cast generic MouseEvent to PointerEvent to access the pointerType property
		const pointerEvent = e as PointerEvent;

		// Only toggle if it is NOT a mouse (i.e., it's touch or pen)
		if (pointerEvent.pointerType !== 'mouse') {
			isOpen = !isOpen;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			isOpen = !isOpen;
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

	let isVisible = $derived(isOpen || forceVisible);
</script>

<div
	class="relative {className}"
	onpointerenter={handlePointerEnter}
	onpointerleave={handlePointerLeave}
	onclick={handleClick}
	onkeydown={handleKeyDown}
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
			class="absolute left-0 mt-2 w-max min-w-[200px] origin-top-left transition-all duration-200 ease-out {childClass}
            {isVisible
				? 'scale-100 opacity-100 pointer-events-auto'
				: 'scale-95 opacity-0 pointer-events-none'}"
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
			class="absolute top-0 left-0 h-full w-full transition-opacity duration-200 ease-out {childClass}
            {isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}"
		>
			{@render children()}
		</div>
	{:else}
		<div
			class="{childClass} {isVisible
				? 'opacity-100 pointer-events-auto'
				: 'opacity-0 pointer-events-none'}"
		>
			{@render children()}
		</div>
	{/if}
</div>
