<script lang="ts">
	import { uiState } from '$lib/states/uiState.svelte';
	import MenuWrapper from '$lib/components/menu/MenuWrapper.svelte';
	import MenuGroup from '$lib/components/menu/MenuGroup.svelte';
	import MenuGrid from '$lib/components/menu/MenuGrid.svelte';
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
												? 'bg-accent/20 text-accent border-2 border-accent/60 shadow-lg shadow-accent/40'
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

	<MenuGrid title="Filter Status" className="lg:hidden">
		{#each ['all', 'in_progress', 'unread', 'read'] as filter}
			{@const isActive = uiState.filterStatus === filter}

			{@const activeClass =
				filter === 'unread'
					? 'bg-status-unread/30 text-status-unread border-2 border-status-unread/70 shadow-lg shadow-status-unread/30'
					: filter === 'in_progress'
						? 'bg-accent/40 text-accent border-2 border-accent/70 shadow-lg shadow-accent/40'
						: filter === 'read'
							? 'bg-status-success/30 text-status-success border-2 border-status-success/70 shadow-lg shadow-status-success/30'
							: 'bg-theme-primary/25 text-theme-primary border-2 border-theme-primary/50 shadow-lg shadow-theme-primary/20'}

			<button
				onclick={() => (uiState.filterStatus = filter as any)}
				class={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200
                ${
									isActive
										? activeClass
										: 'bg-theme-surface-hover/50 border-theme-border text-theme-primary hover:bg-theme-surface-hover/80 hover:text-white'
								}`}
			>
				{#if filter === 'all'}
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
						><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path
							d="M9 21V9"
						/></svg
					>
				{:else if filter === 'unread'}
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
				{:else if filter === 'in_progress'}
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
						><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path
							d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
						/></svg
					>
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
		{/each}
	</MenuGrid>
</MenuWrapper>
