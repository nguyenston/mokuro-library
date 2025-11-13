<script lang="ts">
	import { contextMenu, type MenuOption } from '$lib/contextMenuStore';
	import { browser } from '$app/environment';

	let menuElement: HTMLDivElement | null = $state(null);

	/**
	 * Global click listener.
	 * Closes the menu if the click is outside the menu itself.
	 */
	const handleWindowClick = (event: MouseEvent) => {
		if ($contextMenu.isOpen && menuElement && !menuElement.contains(event.target as Node)) {
			contextMenu.close();
		}
	};

	// Helper type guard to check if an option is a separator
	const isSeparator = (option: MenuOption): option is { separator: true } => {
		return (option as any).separator === true;
	};

	/**
	 * This effect recalculates the menu's position
	 * to keep it within the viewport boundaries.
	 */
	// Local state to hold the *adjusted* position
	let finalX = $state(0);
	let finalY = $state(0);
	$effect(() => {
		if ($contextMenu.isOpen && menuElement && browser) {
			const { x, y } = $contextMenu.position;

			// Get menu and viewport dimensions
			const menuWidth = menuElement.offsetWidth;
			const menuHeight = menuElement.offsetHeight;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Calculate final X position
			if (x + menuWidth > viewportWidth) {
				// Clicks near right edge: open menu to the left
				finalX = x - menuWidth;
			} else {
				// Default: open menu to the right
				finalX = x;
			}

			// Calculate final Y position
			if (y + menuHeight > viewportHeight) {
				// Clicks near bottom edge: open menu upwards
				finalY = y - menuHeight;
			} else {
				// Default: open menu downwards
				finalY = y;
			}

			// Handle over-correction (ensure it's not off-screen left or top)
			if (finalX < 0) finalX = 0;
			if (finalY < 0) finalY = 0;
		} else {
			// When closed, reset position
			finalX = 0;
			finalY = 0;
		}
	});
</script>

<svelte:window on:click={handleWindowClick} />

<!-- Render the menu if it's open -->
{#if $contextMenu.isOpen}
	<div
		bind:this={menuElement}
		class="fixed z-50 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800"
		style="left: {finalX}px; top: {finalY}px;"
		role="menu"
		aria-orientation="vertical"
		onmousedown={(event) => event.preventDefault()}
		tabindex="0"
	>
		<div class="py-1" role="none">
			{#each $contextMenu.options as option}
				{#if isSeparator(option)}
					<!-- Render a separator -->
					<div class="my-1 h-px bg-gray-200 dark:bg-gray-700" role="separator"></div>
				{:else}
					<!-- Render a button -->
					<button
						class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:text-gray-500"
						role="menuitem"
						disabled={option.disabled ?? false}
						onclick={() => {
							option.action(); // Execute the passed-in action
							contextMenu.close(); // Close the menu
						}}
					>
						{option.label}
					</button>
				{/if}
			{/each}
		</div>
	</div>
{/if}
