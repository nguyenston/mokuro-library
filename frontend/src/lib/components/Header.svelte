<script lang="ts">
	import Logo from './Logo.svelte';
	import { uiState } from '$lib/states/uiState.svelte';
	import { user } from '$lib/authStore';
	import { apiFetch, triggerDownload } from '$lib/api';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';

	let isFilterMenuOpen = $state(false);
	let isAppMenuOpen = $state(false);
	let isMobileSearchOpen = $state(false);
	let isDownloadSubmenuOpen = $state(false);

	// local state
	let searchValue = $state(uiState.searchQuery);
	let searchTimer: ReturnType<typeof setTimeout>;

	// Sync Global State -> Input (e.g. when loading from URL or Back button)
	$effect(() => {
		if (uiState.searchQuery !== untrack(() => searchValue)) {
			searchValue = uiState.searchQuery;
		}
	});

	// --- Handlers ---

	// Debounced Handler: Input -> Global State
	const handleSearchInput = (e: Event) => {
		const val = (e.target as HTMLInputElement).value;
		searchValue = val; // Update UI immediately

		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			uiState.searchQuery = searchValue; // Trigger fetch after 400ms
		}, 400);
	};

	const handleLogout = async () => {
		try {
			await apiFetch('/api/auth/logout', { method: 'POST', body: {} });
		} catch (e) {
			console.error('Logout failed:', e);
		}
		user.set(null);
		isAppMenuOpen = false;
	};

	const handleDownloadSelected = () => {
		// TODO: Connect to Backend Batch Download Endpoint
		console.log('Requesting download for items:', [...uiState.selectedIds]);
		alert(`Downloading ${uiState.selectedIds.size} items... (Backend implementation pending)`);

		// Optional: Exit selection mode after download starts
		// uiState.toggleSelectionMode();
	};

	const handleUploadClick = () => {
		uiState.isUploadOpen = true;
		isAppMenuOpen = false;
	};

	const handleStatsClick = () => {
		uiState.isStatsOpen = true;
		isAppMenuOpen = false;
	};

	const handleAboutClick = () => {
		uiState.isAboutOpen = true;
		isAppMenuOpen = false;
	};

	const handleDownloadAll = (type: 'zip' | 'meta' | 'pdf') => {
		let url = '';

		if (uiState.context === 'library') {
			if (type === 'zip') url = '/api/export/zip';
			if (type === 'meta') url = '/api/export/zip?include_images=false';
			if (type === 'pdf') url = '/api/export/pdf';
		} else if (uiState.context === 'series' && uiState.activeId) {
			if (type === 'zip') url = `/api/export/series/${uiState.activeId}/zip`;
			if (type === 'meta') url = `/api/export/series/${uiState.activeId}/zip?include_images=false`;
			if (type === 'pdf') url = `/api/export/series/${uiState.activeId}/pdf`;
		}

		if (url) {
			triggerDownload(url);
			isAppMenuOpen = false;
		}
	};

	// Close menus when selection mode changes
	$effect(() => {
		if (uiState.isSelectionMode) {
			isFilterMenuOpen = false;
			isAppMenuOpen = false;
			isMobileSearchOpen = false;
		}
	});
</script>

<header
	class="sticky top-0 z-40 w-full border-b border-theme-border bg-theme-surface/95 backdrop-blur-md transition-all duration-200"
>
	<div class="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
		<!-- // --- LEFT: Logo & Back --- -->
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

		<!-- // --- CENTER: Search Bar (Desktop) --- -->
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

		<!-- // --- RIGHT: Action Menus --- -->
		<div class="flex flex-shrink-0 items-center gap-2 z-10">
			{#if uiState.isSelectionMode}
				<!-- // Selection Actions -->
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
				<!-- // Mobile Search Toggle -->
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

				<!-- // MENU 1: Query (Filter/Sort) -->
				<div class="relative">
					<button
						onclick={() => {
							isFilterMenuOpen = !isFilterMenuOpen;
							isAppMenuOpen = false;
						}}
						class={`p-2 rounded-lg transition-colors border ${isFilterMenuOpen ? 'bg-accent/20 text-accent border-accent/30' : 'text-theme-secondary border-transparent hover:text-white hover:bg-theme-surface-hover hover:border-theme-border-light'}`}
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

					{#if isFilterMenuOpen}
						<div
							class="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-xl border border-theme-border bg-theme-surface p-3 shadow-2xl z-50"
						>
							<!-- // View Mode -->
							<div class="mb-4">
								<span
									class="text-xs font-bold uppercase tracking-wider text-theme-tertiary block mb-2"
									>View Mode</span
								>
								<div class="flex rounded-lg border border-theme-border-light bg-theme-main p-1">
									<!-- Grid View -->
									<button
										onclick={() => uiState.setViewMode('grid')}
										class={`gap-1 flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium ${uiState.viewMode === 'grid' ? 'bg-accent text-white shadow-sm' : 'text-theme-secondary hover:text-white'}`}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<rect width="7" height="7" x="3" y="3" rx="1" />
											<rect width="7" height="7" x="14" y="3" rx="1" />
											<rect width="7" height="7" x="14" y="14" rx="1" />
											<rect width="7" height="7" x="3" y="14" rx="1" />
										</svg>
										Grid
									</button>

									<!-- List view -->
									<button
										onclick={() => uiState.setViewMode('list')}
										class={`gap-1 flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium ${uiState.viewMode === 'list' ? 'bg-accent text-white shadow-sm' : 'text-theme-secondary hover:text-white'}`}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<line x1="8" x2="21" y1="6" y2="6" />
											<line x1="8" x2="21" y1="12" y2="12" />
											<line x1="8" x2="21" y1="18" y2="18" />
											<line x1="3" x2="3.01" y1="6" y2="6" />
											<line x1="3" x2="3.01" y1="12" y2="12" />
											<line x1="3" x2="3.01" y1="18" y2="18" />
										</svg>
										List
									</button>
								</div>
							</div>

							<div class="h-px bg-theme-border-light mb-4"></div>

							<!-- // Sort Options -->
							<div class="mb-4">
								<span
									class="text-xs font-bold uppercase tracking-wider text-theme-tertiary block mb-2"
									>Sort By</span
								>
								<div class="flex flex-col gap-1">
									{#each uiState.availableSorts as sort}
										<button
											onclick={() => (uiState.sortKey = sort.key)}
											class={`flex w-full items-center justify-between rounded px-3 py-2 text-sm transition-colors ${uiState.sortKey === sort.key ? 'bg-accent/10 text-accent' : 'text-theme-secondary hover:bg-theme-surface-hover hover:text-white'}`}
										>
											{sort.label}
											{#if uiState.sortKey === sort.key}
												<div
													role="button"
													tabindex="0"
													onkeydown={(e) => e.key === 'Enter' && uiState.toggleSortOrder()}
													onclick={(e) => {
														e.stopPropagation();
														uiState.toggleSortOrder();
													}}
													class="p-1 rounded hover:bg-theme-surface cursor-pointer"
													title={uiState.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
												>
													<span class="text-xs">{uiState.sortOrder === 'asc' ? '↑' : '↓'}</span>
												</div>
											{/if}
										</button>
									{/each}
								</div>
							</div>

							<div class="h-px bg-theme-border-light mb-4"></div>

							<!-- // Filter Options -->
							<div>
								<span
									class="text-xs font-bold uppercase tracking-wider text-theme-tertiary block mb-2"
									>Status</span
								>
								<div class="flex flex-col gap-1">
									{#each ['all', 'in_progress', 'unread', 'read'] as filter}
										<button
											onclick={() => (uiState.filterStatus = filter as any)}
											class={`flex w-full items-center justify-between rounded px-3 py-2 text-sm capitalize transition-colors ${uiState.filterStatus === filter ? 'bg-accent/10 text-accent' : 'text-theme-secondary hover:bg-theme-surface-hover hover:text-white'}`}
										>
											{filter.replace('_', ' ')}
											{#if uiState.filterStatus === filter}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="14"
													height="14"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
												>
											{/if}
										</button>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- // MENU 2: App Actions (Burger) -->
				<div class="relative">
					<button
						onclick={() => {
							isAppMenuOpen = !isAppMenuOpen;
							isFilterMenuOpen = false;
						}}
						class={`p-2 rounded-lg transition-colors border ${isAppMenuOpen ? 'bg-theme-surface-hover text-white border-theme-border-light' : 'text-theme-secondary border-transparent hover:text-white hover:bg-theme-surface-hover hover:border-theme-border-light'}`}
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

					{#if isAppMenuOpen}
						<div
							class="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl border border-theme-border bg-theme-surface py-2 shadow-2xl z-50"
						>
							<button
								onclick={handleUploadClick}
								class="w-full px-4 py-2.5 text-left text-sm text-theme-secondary hover:bg-accent/10 hover:text-accent flex items-center gap-3 transition-colors"
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
									><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
										points="17 8 12 3 7 8"
									/><line x1="12" x2="12" y1="3" y2="15" /></svg
								>
								Upload
							</button>

							{#if uiState.context !== 'reader'}
								<div class="relative">
									<button
										onclick={(e) => {
											e.stopPropagation();
											isDownloadSubmenuOpen = !isDownloadSubmenuOpen;
										}}
										class="w-full px-4 py-2.5 text-left text-sm text-theme-secondary hover:bg-accent/10 hover:text-accent flex items-center justify-between transition-colors"
									>
										<div class="flex items-center gap-3">
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
												><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
													points="7 10 12 15 17 10"
												/><line x1="12" x2="12" y1="15" y2="3" /></svg
											>
											Download All
										</div>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class={`transition-transform ${isDownloadSubmenuOpen ? 'rotate-180' : ''}`}
											><polyline points="6 9 12 15 18 9" /></svg
										>
									</button>

									{#if isDownloadSubmenuOpen}
										<div class="bg-theme-main/50 border-y border-theme-border-light">
											<button
												onclick={() => handleDownloadAll('zip')}
												class="w-full pl-11 pr-4 py-2 text-left text-xs text-theme-secondary hover:text-white hover:bg-theme-surface-hover"
											>
												Download as ZIP
											</button>
											<button
												onclick={() => handleDownloadAll('meta')}
												class="w-full pl-11 pr-4 py-2 text-left text-xs text-theme-secondary hover:text-white hover:bg-theme-surface-hover"
											>
												Metadata Only (ZIP)
											</button>
											<button
												onclick={() => handleDownloadAll('pdf')}
												class="w-full pl-11 pr-4 py-2 text-left text-xs text-theme-secondary hover:text-white hover:bg-theme-surface-hover"
											>
												Download as PDF
											</button>
										</div>
									{/if}
								</div>
							{/if}
							<button
								onclick={() => {
									isAppMenuOpen = false;
									uiState.toggleSelectionMode();
								}}
								class="w-full px-4 py-2.5 text-left text-sm text-theme-secondary hover:bg-accent/10 hover:text-accent flex items-center gap-3 transition-colors"
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
									><path d="m9 11 3 3L22 4" /><path
										d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
									/></svg
								>
								Select Items
							</button>

							<div class="h-px bg-theme-border-light my-1"></div>

							<button
								onclick={handleStatsClick}
								class="w-full px-4 py-2.5 text-left text-sm text-theme-secondary hover:bg-accent/10 hover:text-accent flex items-center gap-3 transition-colors"
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
									><line x1="12" x2="12" y1="20" y2="10" /><line
										x1="18"
										x2="18"
										y1="20"
										y2="4"
									/><line x1="6" x2="6" y1="20" y2="16" /></svg
								>
								Statistics
							</button>
							<button
								onclick={handleAboutClick}
								class="w-full px-4 py-2.5 text-left text-sm text-theme-secondary hover:bg-accent/10 hover:text-accent flex items-center gap-3 transition-colors"
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
									><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path
										d="M12 8h.01"
									/></svg
								>
								About
							</button>

							<div class="h-px bg-theme-border-light my-1"></div>

							<button
								onclick={handleLogout}
								class="w-full px-4 py-2.5 text-left text-sm text-status-danger hover:bg-status-danger/10 flex items-center gap-3 transition-colors"
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
									><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline
										points="16 17 21 12 16 7"
									/><line x1="21" x2="9" y1="12" y2="12" /></svg
								>
								Logout
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- // Mobile Search Expansion -->
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
