<script lang="ts">
	import Logo from './Logo.svelte';
	import { uiState } from '$lib/states/uiState.svelte';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { contextMenu } from '$lib/contextMenuStore';

	// Import your new Menu Components
	import FilterMenu from '$lib/components/menu/FilterMenu.svelte';
	import AppMenu from '$lib/components/menu/AppMenu.svelte';

	// --- Local State ---
	let isMobileSearchOpen = $state(false);
	let searchValue = $state(uiState.searchQuery);
	let searchTimer: ReturnType<typeof setTimeout>;

	// --- Effects ---
	// Sync Global State -> Input (e.g. back button navigation)
	$effect(() => {
		if (uiState.searchQuery !== untrack(() => searchValue)) {
			searchValue = uiState.searchQuery;
		}
	});

	// Close menus when selection mode activates
	$effect(() => {
		if (uiState.isSelectionMode) {
			isMobileSearchOpen = false;
			contextMenu.close();
		}
	});

	// --- Handlers ---
	const handleSearchInput = (e: Event) => {
		const val = (e.target as HTMLInputElement).value;
		searchValue = val;

		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			uiState.searchQuery = searchValue;
		}, 400);
	};

	const handleDownloadSelected = () => {
		// Placeholder for batch download
		alert(`Downloading ${uiState.selectedIds.size} items... (Backend implementation pending)`);
	};

	// --- Menu Openers ---
	const toggleFilterMenu = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if ($contextMenu.component === FilterMenu) {
			contextMenu.close();
			return;
		}

		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		// Open aligned to the bottom-right of the button
		contextMenu.open(rect.right, rect.bottom + 10, FilterMenu, { edgeAlign: 'right' });
	};

	const toggleAppMenu = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if ($contextMenu.component === AppMenu) {
			contextMenu.close();
			return;
		}

		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		// Open aligned to the bottom-right of the button
		contextMenu.open(rect.right, rect.bottom + 10, AppMenu, { edgeAlign: 'right' });
	};
</script>

<header
	class="sticky top-0 z-40 w-full border-b border-theme-border bg-theme-surface/95 backdrop-blur-md transition-all duration-200"
>
	<div class="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
		<div class="flex flex-shrink-0 items-center gap-4 z-10">
			{#if uiState.isSelectionMode}
				<div
					class="h-8 w-1 rounded-full bg-status-success shadow-[0_0_10px_rgba(16,185,129,0.5)]"
				></div>
				<span class="text-lg font-bold text-white">
					{uiState.selectedIds.size} Selected
				</span>
			{:else}
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<div
							class="hidden h-8 w-1 rounded-full bg-accent sm:block shadow-[0_0_10px_rgba(99,102,241,0.5)]"
						></div>
						<div class="flex items-center gap-4 min-w-0">
							<a href="/" class="flex-shrink-0" aria-label="Home">
								<Logo />
							</a>
						</div>
					</div>

					{#if uiState.context !== 'library'}
						<div class="h-5 w-px bg-white/10" aria-hidden="true"></div>

						<button
							onclick={() => goto('/')}
							class="group flex items-center gap-2 text-theme-secondary hover:text-white"
							title="Back to Library"
							aria-label="Back to Library"
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
								class="transition-all duration-200 group-hover:-translate-x-1.5 group-hover:scale-120"
							>
								<path d="m15 18-6-6 6-6" />
							</svg>

							<span class="text-sm font-medium">Back to Library</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<div
			class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden w-full max-w-md md:block z-0 px-4"
		>
			<div class="relative group">
				<div
					class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-theme-secondary group-focus-within:text-accent"
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
						stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
					>
				</div>

				<input
					type="text"
					value={searchValue}
					oninput={handleSearchInput}
					placeholder={uiState.context === 'library' ? 'Search library...' : 'Search volumes...'}
					aria-label="Search"
					class="block w-full rounded-full border border-theme-border-light bg-theme-main py-2 pl-10 pr-4 text-sm text-theme-primary placeholder-theme-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent shadow-inner transition-all"
				/>
			</div>
		</div>

		<div class="flex flex-shrink-0 items-center gap-2 z-10">
			{#if uiState.isSelectionMode}
				<button
					onclick={() => uiState.toggleSelectionMode()}
					class="rounded-md border border-theme-border px-3 py-1.5 text-sm font-medium text-theme-secondary hover:bg-theme-surface-hover hover:text-white"
				>
					Cancel
				</button>
				<button
					onclick={handleDownloadSelected}
					disabled={uiState.selectedIds.size === 0}
					class="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-900/20 hover:bg-accent-hover disabled:opacity-50"
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
						><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
							points="7 10 12 15 17 10"
						/><line x1="12" x2="12" y1="15" y2="3" /></svg
					>
					<span class="hidden sm:inline">Download</span>
				</button>
			{:else}
				<button
					class="md:hidden p-2 text-theme-secondary hover:text-white"
					onclick={() => (isMobileSearchOpen = !isMobileSearchOpen)}
					aria-label="Toggle Search"
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
						stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
					>
				</button>

				<button
					onclick={toggleFilterMenu}
					class="p-2 rounded-lg transition-colors text-theme-secondary hover:text-white hover:bg-theme-surface-hover hover:border-theme-border-light border border-transparent"
					title="Filter & Sort"
					aria-label="Filter and Sort Options"
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
						><line x1="21" x2="14" y1="4" y2="4" /><line x1="10" x2="3" y1="4" y2="4" /><line
							x1="21"
							x2="12"
							y1="12"
							y2="12"
						/><line x1="8" x2="3" y1="12" y2="12" /><line x1="21" x2="16" y1="20" y2="20" /><line
							x1="12"
							x2="3"
							y1="20"
							y2="20"
						/><line x1="14" x2="14" y1="2" y2="6" /><line x1="8" x2="8" y1="10" y2="14" /><line
							x1="16"
							x2="16"
							y1="18"
							y2="22"
						/></svg
					>
				</button>

				<button
					onclick={toggleAppMenu}
					class="p-2 rounded-lg transition-colors text-theme-secondary hover:text-white hover:bg-theme-surface-hover hover:border-theme-border-light border border-transparent"
					title="Menu"
					aria-label="Main Menu"
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
						><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line
							x1="4"
							x2="20"
							y1="18"
							y2="18"
						/></svg
					>
				</button>
			{/if}
		</div>
	</div>

	{#if !uiState.isSelectionMode && isMobileSearchOpen}
		<div class="border-t border-theme-border bg-theme-main px-4 py-2 md:hidden">
			<input
				type="text"
				bind:value={uiState.searchQuery}
				placeholder={uiState.context === 'library' ? 'Search library...' : 'Search volumes...'}
				class="block w-full rounded-md border border-theme-border-light bg-theme-surface py-1.5 px-3 text-sm text-white focus:border-accent focus:outline-none"
			/>
		</div>
	{/if}
</header>
