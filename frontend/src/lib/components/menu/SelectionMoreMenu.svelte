<script lang="ts">
	import { contextMenu } from '$lib/contextMenuStore';
	import { uiState } from '$lib/states/uiState.svelte';
	import { apiFetch } from '$lib/api';
	import { type MenuOption } from '$lib/contextMenuStore';

	let {
		selectionCount,
		onScrape,
		onRefresh
	}: {
		selectionCount: number;
		onScrape: () => void;
		onRefresh: () => void;
	} = $props();

	async function handleOrganize(value: boolean) {
		const ids = uiState.selectedIdsArray;
		try {
			await apiFetch('/api/metadata/batch/organize', {
				method: 'POST',
				body: { ids, value }
			});
			uiState.exitSelectionMode();
			onRefresh();
		} catch (e) {
			console.error(e);
			alert('Failed to update status');
		}
	}

	function openMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();

		const menuItems: MenuOption[] = [
			// Section: Organization
			{
				label: 'Mark as Organized',
				action: () => handleOrganize(true)
			},
			{
				label: 'Mark as Unorganized',
				action: () => handleOrganize(false)
			}
		];

		contextMenu.open(rect.left, rect.top, menuItems, { yEdgeAlign: 'top' }, target);
	}
</script>

<button
	onclick={openMenu}
	class="p-2.5 rounded-xl hover:bg-theme-primary/10 text-theme-secondary hover:text-theme-primary transition-colors"
	title="More Actions"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<circle cx="12" cy="12" r="1" />
		<circle cx="12" cy="5" r="1" />
		<circle cx="12" cy="19" r="1" />
	</svg>
</button>
