<script lang="ts">
	import { contextMenu } from '$lib/contextMenuStore';
	import MenuWrapper from '$lib/components/menu/MenuWrapper.svelte';

	let { onEdit, onScrape } = $props<{
		onEdit: () => void;
		onScrape: () => void;
	}>();

	function handleAction(action: () => void) {
		action();
		contextMenu.close();
	}
</script>

<MenuWrapper className="w-48">
	<div class="flex flex-col p-1">
		<button
			onclick={() => handleAction(onEdit)}
			class="w-full text-left px-4 py-2.5 text-sm text-theme-primary hover:bg-theme-surface-hover/70 hover:text-white rounded-xl transition-colors flex items-center gap-3"
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
				class="text-theme-secondary group-hover:text-white"
			>
				<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
			</svg>
			Edit Metadata
		</button>
		<button
			onclick={() => handleAction(onScrape)}
			class="w-full text-left px-4 py-2.5 text-sm text-theme-primary hover:bg-theme-surface-hover/70 hover:text-white rounded-xl transition-colors flex items-center gap-3"
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
				class="text-theme-secondary group-hover:text-white"
			>
				<circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
			</svg>
			Scrape Metadata
		</button>
	</div>
</MenuWrapper>
