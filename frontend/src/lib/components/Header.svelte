<script lang="ts">
	import Logo from './Logo.svelte';
	import { uiState } from '$lib/states/uiState.svelte';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { contextMenu } from '$lib/contextMenuStore';
	import { fade, scale } from 'svelte/transition';

	// Import your new Menu Components
	import FilterMenu from '$lib/components/menu/FilterMenu.svelte';
	import AppMenu from '$lib/components/menu/AppMenu.svelte';

	// --- Local State ---
	let isMobileSearchOpen = $state(false);
	let searchValue = $state(uiState.searchQuery);
	let searchTimer: ReturnType<typeof setTimeout>;
	let isScrolled = $state(false);
	let scrollY = $state(0);
	let lastScrollY = $state(0);
	let isScrollingDown = $state(false);

	// --- Effects ---
	// Track scroll position and direction (only in library view)
	$effect(() => {
		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			isScrolled = currentScrollY > 20;

			// Only apply auto-hide behavior in library view
			if (uiState.context === 'library') {
				// Detect scroll direction
				const scrollDifference = currentScrollY - lastScrollY;
				if (Math.abs(scrollDifference) > 1) {
					// Only update direction if there's meaningful scroll movement
					isScrollingDown = scrollDifference > 0;
				}

				scrollY = currentScrollY;
				lastScrollY = currentScrollY;
			} else {
				// Always show header in other views
				scrollY = 0;
				isScrollingDown = false;
				lastScrollY = currentScrollY;
			}
		};

		if (typeof window !== 'undefined') {
			scrollY = window.scrollY;
			lastScrollY = window.scrollY;
			window.addEventListener('scroll', handleScroll, { passive: true });
			return () => window.removeEventListener('scroll', handleScroll);
		}
	});

	// Calculate header translateY based on scroll position and direction
	// When scrolling down: gradually hide proportionally
	// When scrolling up: show immediately
	const headerOffset = $derived.by(() => {
		if (uiState.context !== 'library') return 0;

		// If scrolling up or at top, always show (return to 0)
		if (!isScrollingDown || scrollY < 20) {
			return 0;
		}

		// When scrolling down, gradually hide based on scroll amount
		const startHide = 20;
		const fullHide = 100;
		const headerHeight = 64; // h-16 = 4rem = 64px

		// Calculate progress from startHide to fullHide
		const progress = Math.min(1, (scrollY - startHide) / (fullHide - startHide));

		// Translate by progress * headerHeight (negative to move up)
		// When fully hidden, use a value larger than header height to ensure it's completely off-screen
		return -progress * (headerHeight + 10); // +10px extra to ensure it's fully hidden
	});

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

		const element = e.currentTarget as HTMLElement;
		const rect = element.getBoundingClientRect();
		// Open aligned to the bottom-right of the button
		contextMenu.open(rect.right, rect.bottom + 10, FilterMenu, { edgeAlign: 'right' }, element);
	};

	const toggleAppMenu = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if ($contextMenu.component === AppMenu) {
			contextMenu.close();
			return;
		}

		const element = e.currentTarget as HTMLElement;
		const rect = element.getBoundingClientRect();
		// Open aligned to the bottom-right of the button
		contextMenu.open(rect.right, rect.bottom + 10, AppMenu, { edgeAlign: 'right' }, element);
	};

	// --- Configuration for filter button styles
	const filterConfig = {
		unread: {
			activeColor: 'text-status-unread',
			activeBorder: 'border-status-unread/50'
		},
		reading: {
			activeColor: 'text-accent',
			activeBorder: 'border-accent/50'
		},
		read: {
			activeColor: 'text-status-success',
			activeBorder: 'border-status-success/50'
		}
	} as const; // 'as const' helps with type inference if needed
</script>

<header
	class="sticky top-0 z-40 w-full bg-theme-main/95 backdrop-blur-md transition-transform duration-300 ease-out"
	style="transform: translateY({headerOffset}px);"
>
	<div
		class="mx-auto flex h-16 items-center justify-between px-4 sm:px-6"
		style="max-width: 1400px;"
	>
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

							<span class="inline md:hidden lg:inline text-sm font-medium">Back to Library</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>

		{#if uiState.context !== 'settings'}
			<div
				transition:fade={{ duration: 200 }}
				class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden w-full md:block z-0 transition-all duration-300"
				style="max-width: 32rem; padding-left: 1rem; padding-right: 1rem;"
			>
				<div class="relative group">
					<div
						class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-theme-secondary group-focus-within:text-accent"
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
							><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
						>
					</div>

					<input
						type="text"
						value={searchValue}
						oninput={handleSearchInput}
						placeholder={uiState.context === 'library' ? 'Search library...' : 'Search volumes...'}
						aria-label="Search"
						class="block w-full rounded-full border border-theme-border-light bg-theme-main h-10 pl-12 pr-16 text-base text-theme-primary placeholder-theme-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent shadow-inner transition-all text-center placeholder:text-center"
						style="line-height: 2.5rem;"
					/>

					<button
						onclick={toggleFilterMenu}
						class="absolute top-1/2 -translate-y-1/2 right-3 flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-theme-secondary hover:text-white hover:bg-theme-surface-hover"
						title="Filter & Sort"
						aria-label="Filter and Sort Options"
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
				</div>
			</div>
		{/if}

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
				{#if uiState.context !== 'settings'}
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
							stroke-linejoin="round"
							><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
						>
					</button>

					<button
						onclick={toggleFilterMenu}
						class="md:hidden p-2 rounded-lg transition-colors text-theme-secondary hover:text-white hover:bg-theme-surface-hover hover:border-theme-border-light border border-transparent"
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

					<!-- Filter Status Buttons (Desktop only) -->
					<div class="hidden lg:flex items-center gap-2">
						{#each ['unread', 'reading', 'read'] as filter}
							{@const isActive = uiState.filterStatus === filter}
							{@const styles = filterConfig[filter as keyof typeof filterConfig]}

							{@const iconColor = isActive ? styles.activeColor : 'text-theme-secondary'}
							{@const borderColor = isActive ? styles.activeBorder : 'border-theme-border-light'}

							<button
								onclick={() => {
									// Toggle: If clicking the active one, revert to 'all'
									uiState.filterStatus = isActive ? 'all' : (filter as any);
								}}
								class="w-10 h-10 flex items-center justify-center rounded-2xl border-2 transition-all duration-200 hover:border-theme-primary/50 {iconColor} {borderColor}"
								title={filter.replace('_', ' ')}
								aria-label="Filter by {filter.replace('_', ' ')}"
							>
								{#if filter === 'unread'}
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
										<circle cx="12" cy="12" r="10" />
									</svg>
								{:else if filter === 'reading'}
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
										<circle cx="12" cy="12" r="10" />
										<path d="M7 12 Q 9.5 8 12 12 T 17 12" />
									</svg>
								{:else}
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
										<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
										<polyline points="22 4 12 14.01 9 11.01" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				{/if}

				<button
					onclick={toggleAppMenu}
					class="w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-theme-border-light transition-all duration-200 text-theme-secondary hover:text-white hover:border-theme-primary/50"
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
		<div
			class="absolute inset-0 bg-theme-main/95 backdrop-blur-md px-4 md:hidden z-50 flex items-center gap-3"
		>
			<div class="flex-1 relative group">
				<div
					class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-theme-secondary group-focus-within:text-accent"
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
						stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
					>
				</div>

				<input
					type="text"
					bind:value={uiState.searchQuery}
					placeholder={uiState.context === 'library' ? 'Search library...' : 'Search volumes...'}
					aria-label="Search"
					class="block w-full rounded-full border border-theme-border-light bg-theme-main h-10 pl-12 pr-4 text-base text-theme-primary placeholder-theme-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent shadow-inner transition-all text-center placeholder:text-center"
					style="line-height: 2.5rem;"
				/>
			</div>

			<button
				onclick={() => (isMobileSearchOpen = false)}
				class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-theme-secondary hover:text-white hover:bg-theme-surface-hover transition-colors"
				aria-label="Close search"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	{/if}
</header>
