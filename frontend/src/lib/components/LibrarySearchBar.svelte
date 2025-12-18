<script lang="ts">
	import { page } from '$app/state'; // New SvelteKit 5 state source
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	// Read directly from the reactive page object
	let q = $state(page.url.searchParams.get('q') || '');

	// Derived state for styling active buttons
	let currentSort = $derived(page.url.searchParams.get('sort') || 'title');
	let currentOrder = $derived(page.url.searchParams.get('order') || 'asc');
	let currentView = $derived(page.url.searchParams.get('view') || 'grid');

	let timer: ReturnType<typeof setTimeout>;

	// Debounced Search
	const updateSearch = (newVal: string) => {
		q = newVal;
		clearTimeout(timer);
		timer = setTimeout(() => {
			updateUrl({ q: newVal, page: '1' });
		}, 300);
	};

	// Toggle Order if clicking same sort, otherwise set new sort
	const updateSort = (newSort: string) => {
		let newOrder = newSort === 'title' ? 'asc' : 'desc';
		if (currentSort === newSort) {
			newOrder = currentOrder === 'desc' ? 'asc' : 'desc';
		}
		updateUrl({ sort: newSort, order: newOrder, page: '1' });
	};

	const updateView = (newView: string) => {
		if (browser) {
			localStorage.setItem('library_view_mode', newView);
		}
		// Changing view doesn't need to reset the page
		updateUrl({ view: newView });
	};

	const updateUrl = (changes: Record<string, string | null>) => {
		const params = new URLSearchParams(page.url.searchParams);

		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === '') {
				params.delete(key);
			} else {
				params.set(key, value);
			}
		}

		// keepFocus: true prevents input blur, replaceState: true keeps history clean
		goto(`${page.url.pathname}?${params.toString()}`, { keepFocus: true, replaceState: true });
	};

	// Restore persistence on mount
	$effect(() => {
		if (browser) {
			const savedView = localStorage.getItem('library_view_mode');
			const currentViewParam = page.url.searchParams.get('view');

			// If we have a saved preference and no URL override, apply it
			if (savedView && !currentViewParam) {
				updateUrl({ view: savedView });
			}
		}
	});
</script>

<!-- // Container: Dark Navy Surface -->
<div
	class="flex flex-col gap-4 md:flex-row md:items-center bg-[#161b2e] p-1 rounded-xl border border-gray-800 shadow-xl mb-8"
>
	<!-- // Search Input -->
	<div class="relative flex-1 group">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
			<svg
				class="h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
					clip-rule="evenodd"
				/>
			</svg>
		</div>
		<input
			type="text"
			bind:value={q}
			oninput={(e) => updateSearch(e.currentTarget.value)}
			placeholder="Search library..."
			class="block w-full rounded-lg border-0 bg-[#0a0e17] py-2 pl-10 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all"
		/>
	</div>

	<div class="flex flex-row items-center justify-center gap-1 sm:gap-4">
		<!-- // Sort Controls -->
		<div class="flex items-center gap-3">
			<span class="hidden sm:inline text-xs uppercase tracking-wider font-bold text-gray-500">
				Sort
			</span>
			<div class="flex rounded-lg shadow-sm bg-[#0a0e17] border border-gray-800 p-1">
				{#each ['title', 'created', 'updated', 'recent'] as sortKey}
					<button
						onclick={() => updateSort(sortKey)}
						class={`relative inline-flex items-center justify-center px-3 py-1 text-[14px] font-semibold rounded-md transition-all
            ${
							currentSort === sortKey
								? 'bg-blue-600 text-white shadow-md'
								: 'text-gray-400 hover:text-white hover:bg-gray-800'
						}`}
					>
						{sortKey === 'title' ? 'A-Z' : sortKey.charAt(0).toUpperCase() + sortKey.slice(1)}
						{#if currentSort === sortKey}
							<span class="ml-1 opacity-70">{currentOrder === 'desc' ? '↓' : '↑'}</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- // Separator -->
		<div class="hidden sm:block h-8 w-px bg-gray-800"></div>

		<!-- // View Toggle -->
		<div class="flex rounded-lg shadow-sm bg-[#0a0e17] p-1 border border-gray-800">
			<button
				onclick={() => updateView('grid')}
				class={`relative inline-flex items-center p-1.5 rounded-md transition-all
          ${currentView === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
				title="Grid View"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect
						x="14"
						y="14"
						width="7"
						height="7"
					/><rect x="3" y="14" width="7" height="7" /></svg
				>
			</button>
			<button
				onclick={() => updateView('list')}
				class={`relative inline-flex items-center p-1.5 rounded-md transition-all
          ${currentView === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
				title="List View"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line
						x1="8"
						y1="18"
						x2="21"
						y2="18"
					/><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line
						x1="3"
						y1="18"
						x2="3.01"
						y2="18"
					/></svg
				>
			</button>
		</div>
	</div>
</div>
