<script lang="ts">
	import { contextMenu } from '$lib/contextMenuStore';
	import { browser } from '$app/environment';

	let menuElement: HTMLDivElement | null = $state(null);

	const handleWindowClick = (event: MouseEvent) => {
		if ($contextMenu.isOpen && menuElement && !menuElement.contains(event.target as Node)) {
			contextMenu.close();
		}
	};

	let finalX = $state(0);
	let finalY = $state(0);

	const handleResize = () => {
		if ($contextMenu.isOpen && $contextMenu.anchorElement) {
			// Recalculate position based on anchor element
			const rect = $contextMenu.anchorElement.getBoundingClientRect();
			const finalX = $contextMenu.props.xEdgeAlign === 'right' ? rect.right : rect.left;
			const finalY = $contextMenu.props.yEdgeAlign === 'top' ? rect.top : rect.bottom;
			contextMenu.updatePosition(finalX, finalY);
		}
	};

	// Position Calculation Effect
	$effect(() => {
		if ($contextMenu.isOpen && menuElement && browser) {
			// 1. Capture current values (untrack if necessary, but here we want the trigger)
			const { x, y } = $contextMenu.position;

			// 2. Measure DOM
			const menuWidth = menuElement.offsetWidth;
			const menuHeight = menuElement.offsetHeight;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// 3. Calculate with "Small Viewport" safety
			let nextX = x;
			let nextY = y;

			// Horizontal logic: Flip if no space, but don't go off-screen left
			if (x + menuWidth > viewportWidth || $contextMenu.props.xEdgeAlign === 'right') {
				nextX = Math.max(0, x - menuWidth);
			}

			// Vertical logic: Flip if no space, but don't go off-screen top
			if (y + menuHeight > viewportHeight || $contextMenu.props.yEdgeAlign === 'top') {
				nextY = Math.max(0, y - menuHeight);
			}

			// 4. Update state only if values actually changed to prevent unnecessary cycles
			if (finalX !== nextX) finalX = nextX;
			if (finalY !== nextY) finalY = nextY;
		}
	});

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') contextMenu.close();
	};
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} onresize={handleResize} />

{#if $contextMenu.isOpen && $contextMenu.component}
	{@const ActiveComponent = $contextMenu.component}
	<div
		bind:this={menuElement}
		class="fixed z-[100] transition-opacity duration-150 ease-out"
		style="left: {finalX}px; top: {finalY}px;"
		role="menu"
		tabindex="-1"
	>
		<ActiveComponent {...$contextMenu.props} />
	</div>
{/if}
