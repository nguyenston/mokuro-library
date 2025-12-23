<script lang="ts">
	import { contextMenu, type MenuOption } from '$lib/contextMenuStore';
	import MenuWrapper from '$lib/components/menu/MenuWrapper.svelte';
	import MenuSeparator from '$lib/components/menu/MenuSeparator.svelte';

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

<MenuWrapper className="max-w-60">
	<div class="p-1.5 flex flex-col gap-0.5">
		{#each options as option}
			{#if isSeparator(option)}
				<div class="h-px bg-theme-border-light my-1 mx-5 opacity-50"></div>
			{:else}
				<button
					class="w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition-colors
                           text-theme-primary hover:bg-theme-surface-hover/70 hover:text-white
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-theme-primary"
					disabled={option.disabled ?? false}
					onclick={() => handleAction(option)}
				>
					{option.label}
				</button>
			{/if}
		{/each}
	</div>
</MenuWrapper>
