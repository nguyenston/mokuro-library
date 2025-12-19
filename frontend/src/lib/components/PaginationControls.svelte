<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	let { meta } = $props<{
		meta: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	}>();

	const updateParams = (changes: Record<string, string>) => {
		const params = new URLSearchParams(page.url.searchParams);
		for (const [key, value] of Object.entries(changes)) {
			params.set(key, value);
		}
		goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true });
	};

	const setPage = (p: number) => {
		if (p < 1 || p > meta.totalPages) return;
		updateParams({ page: p.toString() });
	};

	const setLimit = (l: number) => {
		// Save preference to localStorage
		if (browser) {
			localStorage.setItem('pagination_limit', l.toString());
		}
		// Reset to page 1 when changing limit to avoid out-of-bounds
		updateParams({ limit: l.toString(), page: '1' });
	};

	// Restore preference on load if no limit param is present
	$effect(() => {
		if (browser) {
			const saved = localStorage.getItem('pagination_limit');
			const current = page.url.searchParams.get('limit');

			// If we have a saved limit, no URL override, and it differs from current display
			if (saved && !current && Number(saved) !== meta.limit) {
				updateParams({ limit: saved });
			}
		}
	});
</script>

{#if meta.total > 0}
	<div
		class="flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900 sm:px-6 rounded-lg gap-4"
	>
		<div class="text-sm text-gray-700 dark:text-gray-400 text-center sm:text-left">
			Showing
			<span class="font-medium">{(meta.page - 1) * meta.limit + 1}</span>
			to
			<span class="font-medium">{Math.min(meta.page * meta.limit, meta.total)}</span>
			of
			<span class="font-medium">{meta.total}</span>
			results
		</div>

		<div class="flex flex-col sm:flex-row items-center gap-4">
			<div class="flex items-center gap-2">
				<span class="text-sm text-gray-500 dark:text-gray-400">Show:</span>
				<select
					value={meta.limit}
					onchange={(e) => setLimit(Number(e.currentTarget.value))}
					class="block rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value={10}>10</option>
					<option value={20}>20</option>
					<option value={50}>50</option>
					<option value={100}>100</option>
				</select>
			</div>

			{#if meta.totalPages > 1 || true}
				<nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
					<button
						onclick={() => setPage(meta.page - 1)}
						disabled={meta.page === 1}
						class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 dark:ring-gray-600 dark:hover:bg-gray-800"
					>
						<span class="sr-only">Previous</span>
						<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>

					<span
						class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 dark:text-white dark:ring-gray-600"
					>
						{meta.page} / {meta.totalPages}
					</span>

					<button
						onclick={() => setPage(meta.page + 1)}
						disabled={meta.page === meta.totalPages}
						class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 dark:ring-gray-600 dark:hover:bg-gray-800"
					>
						<span class="sr-only">Next</span>
						<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</nav>
			{/if}
		</div>
	</div>
{/if}
