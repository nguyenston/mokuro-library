<script lang="ts">
	import PaginationControls from '$lib/components/PaginationControls.svelte';
	import { uiState } from '$lib/states/uiState.svelte';

	let { meta } = $props<{
		meta: {
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		};
	}>();
</script>

<div
	class="fixed bottom-0 left-0 right-0 p-6 z-40 transition-transform duration-300 ease-out pointer-events-none"
	class:-translate-y-20={uiState.isSelectionMode}
>
	<div class="mx-auto flex justify-center pointer-events-auto" style="max-width: 1400px;">
		<PaginationControls {meta} />
	</div>
</div>
