<script lang="ts">
	import { contextMenu, type MenuOption } from '$lib/contextMenuStore';

	// Accepts the raw options array
	let { options } = $props<{ options: MenuOption[] }>();

	const isSeparator = (option: MenuOption): option is { separator: true } => {
		return (option as any).separator === true;
	};

	const handleAction = (option: any) => {
		if (!option.disabled) {
			option.action();
			contextMenu.close();
		}
	};
</script>

<div
	class="w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 py-1"
>
	{#each options as option}
		{#if isSeparator(option)}
			<div class="my-1 h-px bg-gray-200 dark:bg-gray-700" role="separator"></div>
		{:else}
			<button
				class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:text-gray-500"
				role="menuitem"
				disabled={option.disabled ?? false}
				onclick={() => handleAction(option)}
			>
				{option.label}
			</button>
		{/if}
	{/each}
</div>
