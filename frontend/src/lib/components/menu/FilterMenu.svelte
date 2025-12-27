<script lang="ts">
	import { uiState, type FilterMissing } from '$lib/states/uiState.svelte';
	import MenuWrapper from '$lib/components/menu/MenuWrapper.svelte';
	import MenuGroup from '$lib/components/menu/MenuGroup.svelte';
	import MenuGrid from '$lib/components/menu/MenuGrid.svelte';
	import MenuSeparator from './MenuSeparator.svelte';
	import MenuToggle from './MenuToggle.svelte';

	// Configuration for filter button styles
	const filterConfig = {
		unread: {
			activeColor: 'text-status-unread',
			activeBorder: 'border-status-unread/70',
			activeBg: 'bg-status-unread/30',
			shadow: 'shadow-status-unread/30'
		},
		reading: {
			activeColor: 'text-accent',
			activeBorder: 'border-accent/70',
			activeBg: 'bg-accent/25',
			shadow: 'shadow-accent/40'
		},
		read: {
			activeColor: 'text-status-success',
			activeBorder: 'border-status-success/70',
			activeBg: 'bg-status-success/30',
			shadow: 'shadow-status-success/30'
		},
		bookmarked: {
			activeColor: 'text-status-warning',
			activeBorder: 'border-status-warning/70',
			activeBg: 'bg-status-warning/20',
			shadow: 'shadow-status-warning/30'
		}
	} as const;

	function toggleOrganization(target: 'organized' | 'unorganized') {
		if (uiState.filterOrganization === target) {
			uiState.filterOrganization = 'all'; // Toggle off
		} else {
			uiState.filterOrganization = target; // Mutually exclusive switch
		}
	}

	function toggleMissing(target: Exclude<FilterMissing, 'none'>) {
		if (uiState.filterMissing === target) {
			uiState.filterMissing = 'none'; // Toggle off (Default)
		} else {
			uiState.filterMissing = target;
		}
	}
</script>

<MenuWrapper className="w-80 !bg-theme-surface !border-theme-border shadow-2xl">
	<MenuGroup title="Layout Style">
		<div
			class="relative flex bg-theme-main/70 p-1.5 rounded-2xl border-2 border-theme-border overflow-hidden shadow-inner"
		>
			<div
				class="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-accent rounded-xl shadow-lg shadow-accent/20 transition-transform duration-100 ease-out"
				style:transform={uiState.viewMode === 'list' ? 'translateX(100%)' : 'translateX(0%)'}
			></div>

			<button
				onclick={() => uiState.setViewMode('grid')}
				class="relative z-10 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-colors duration-200"
				class:text-white={uiState.viewMode === 'grid'}
				class:text-theme-primary={uiState.viewMode !== 'grid'}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class={uiState.viewMode === 'grid' ? 'drop-shadow-sm' : ''}
				>
					<rect width="7" height="7" x="3" y="3" rx="1" /><rect
						width="7"
						height="7"
						x="14"
						y="3"
						rx="1"
					/>
					<rect width="7" height="7" x="14" y="14" rx="1" /><rect
						width="7"
						height="7"
						x="3"
						y="14"
						rx="1"
					/>
				</svg>
				Grid
			</button>

			<button
				onclick={() => uiState.setViewMode('list')}
				class="relative z-10 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-colors duration-200"
				class:text-white={uiState.viewMode === 'list'}
				class:text-theme-primary={uiState.viewMode !== 'list'}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class={uiState.viewMode === 'list' ? 'drop-shadow-sm' : ''}
				>
					<line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line
						x1="8"
						x2="21"
						y1="18"
						y2="18"
					/>
					<line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line
						x1="3"
						x2="3.01"
						y1="18"
						y2="18"
					/>
				</svg>
				List
			</button>
		</div>
	</MenuGroup>

	<MenuGroup title="Ordering">
		{#each uiState.availableSorts as sort}
			{@const isActive = uiState.sortKey === sort.key}
			<button
				onclick={() => {
					if (isActive) uiState.toggleSortOrder();
					else uiState.sortKey = sort.key;
				}}
				class={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200
                    ${
											isActive
												? 'bg-accent-surface text-accent border-2 border-accent/60 shadow-lg shadow-accent/40'
												: 'text-theme-primary hover:bg-theme-surface-hover/70 hover:text-white border-2 border-transparent'
										}`}
			>
				<span class="capitalize">{sort.label}</span>

				{#if isActive}
					<div class="flex items-center gap-2">
						<span class="text-[10px] opacity-70 uppercase tracking-wider font-bold">
							{uiState.sortOrder === 'asc' ? 'Asc' : 'Desc'}
						</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							class={`transition-transform duration-200 drop-shadow-sm ${uiState.sortOrder === 'desc' ? 'rotate-180' : ''}`}
							><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg
						>
					</div>
				{/if}
			</button>
		{/each}
	</MenuGroup>

	<div class="lg:hidden">
		<MenuSeparator />
		{#snippet statusFilter()}
			<MenuGrid items={['unread', 'reading', 'read']} innerClass="" layout={[3]}>
				{#snippet children(filter)}
					{@const isActive = uiState.filterStatus === filter}
					{@const styles = filterConfig[filter as keyof typeof filterConfig]}

					{@const activeClass = isActive
						? `${styles.activeBg} ${styles.activeColor} ${styles.activeBorder} shadow-lg ${styles.shadow}`
						: 'bg-theme-surface-hover/50 border-theme-border text-theme-primary hover:bg-theme-surface-hover/80 hover:text-white'}

					<button
						onclick={() =>
							(uiState.filterStatus = isActive ? 'all' : (filter as 'unread' | 'reading' | 'read'))}
						class={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${activeClass}`}
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
								stroke-linejoin="round"><circle cx="12" cy="12" r="10" /></svg
							>
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
								><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline
									points="22 4 12 14.01 9 11.01"
								/></svg
							>
						{/if}

						<span class="text-[10px] font-bold uppercase tracking-wider capitalize">
							{filter.replace('_', ' ')}
						</span>
					</button>
				{/snippet}
			</MenuGrid>
		{/snippet}

		{#snippet bookmarkFilter()}
			{@const isBookmarked = uiState.filterBookmarked}
			{@const bmStyles = filterConfig.bookmarked}

			{@const bmActiveClass = isBookmarked
				? `${bmStyles.activeBg} ${bmStyles.activeColor} ${bmStyles.activeBorder} shadow-lg ${bmStyles.shadow}`
				: 'bg-theme-surface-hover/50 border-theme-border text-theme-primary hover:bg-theme-surface-hover/80 hover:text-white'}

			<button
				onclick={() => (uiState.filterBookmarked = !uiState.filterBookmarked)}
				class={`w-full flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${bmActiveClass}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill={isBookmarked ? 'currentColor' : 'none'}
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
				</svg>

				<span class="text-[10px] font-bold uppercase tracking-wider"> Bookmarked Only </span>
			</button>
		{/snippet}

		<MenuGroup title="Status">
			<MenuGrid items={['status', 'bookmark']} innerClass="pb-2 gap-2" layout={[1, 1]}>
				{#snippet children(index)}
					{#if index === 'status'}
						{@render statusFilter()}
					{:else if uiState.context === 'library'}
						{@render bookmarkFilter()}
					{/if}
				{/snippet}
			</MenuGrid>
		</MenuGroup>
	</div>

	{#if uiState.context === 'library'}
		<MenuGroup title="Organization">
			<div class="flex gap-2">
				<button
					onclick={() => toggleOrganization('unorganized')}
					class="flex-1 py-2.5 rounded-xl border-2 text-xs font-bold uppercase tracking-wider transition-all duration-200
					{uiState.filterOrganization === 'unorganized'
						? 'border-blue-500/70 bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/30'
						: 'bg-theme-surface-hover/50 border-theme-border text-theme-primary hover:bg-theme-surface-hover/80 hover:text-white'}"
				>
					Inbox
				</button>

				<button
					onclick={() => toggleOrganization('organized')}
					class="flex-1 py-2.5 rounded-xl border-2 text-xs font-bold uppercase tracking-wider transition-all duration-200
					{uiState.filterOrganization === 'organized'
						? 'border-purple-500/70 bg-purple-500/20 text-purple-400 shadow-lg shadow-purple-500/30'
						: 'bg-theme-surface-hover/50 border-theme-border text-theme-primary hover:bg-theme-surface-hover/80 hover:text-white'}"
				>
					Archive
				</button>
			</div>
		</MenuGroup>

		<MenuGroup title="Maintenance">
			<div class="grid grid-cols-2 gap-2">
				{#each [{ key: 'any', label: 'Any Missing' }, { key: 'cover', label: 'No Cover' }, { key: 'description', label: 'No Desc' }, { key: 'title', label: 'No Title' }] as item}
					{@const k = item.key as Exclude<FilterMissing, 'none'>}
					<button
						onclick={() => toggleMissing(k)}
						class="px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all duration-200
						{uiState.filterMissing === k
							? 'border-status-danger/70 bg-status-danger/20 text-status-danger shadow-lg shadow-status-danger/30'
							: 'bg-theme-surface-hover/50 border-theme-border text-theme-primary hover:bg-theme-surface-hover/80 hover:text-white'}"
					>
						{item.label}
					</button>
				{/each}
			</div>
		</MenuGroup>
	{/if}
</MenuWrapper>
