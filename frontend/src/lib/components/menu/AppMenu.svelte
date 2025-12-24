<script lang="ts">
	import { uiState } from '$lib/states/uiState.svelte';
	import { user } from '$lib/authStore';
	import { apiFetch, triggerDownload } from '$lib/api';
	import { contextMenu } from '$lib/contextMenuStore';
	import { goto } from '$app/navigation';
	import MenuWrapper from '$lib/components/menu/MenuWrapper.svelte';
	import MenuItem from '$lib/components/menu/MenuItem.svelte';
	import MenuSeparator from '$lib/components/menu/MenuSeparator.svelte';
	import MenuGrid from '$lib/components/menu/MenuGrid.svelte';
	import MenuGroup from './MenuGroup.svelte';
	import MenuGridItem from '$lib/components/menu/MenuGridItem.svelte';

	let isDownloadOpen = $state(false);

	const handleLogout = async () => {
		try {
			await apiFetch('/api/auth/logout', { method: 'POST', body: {} });
		} catch (e) {
			console.error('Logout failed:', e);
		}
		user.set(null);
		contextMenu.close();
	};

	const handleDownload = (type: 'zip' | 'meta' | 'pdf') => {
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
			contextMenu.close();
		}
	};
</script>

{#snippet iconUpload()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="22"
		height="22"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="drop-shadow-sm"
		><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line
			x1="12"
			x2="12"
			y1="3"
			y2="15"
		/></svg
	>
{/snippet}

{#snippet iconDownload()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="22"
		height="22"
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
{/snippet}

{#snippet iconStats()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="22"
		height="22"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="drop-shadow-sm"
		><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line
			x1="6"
			x2="6"
			y1="20"
			y2="16"
		/></svg
	>
{/snippet}

{#snippet iconAppearanceGrid()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="22"
		height="22"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="drop-shadow-sm"
	>
		<rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
		<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
		<line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
	</svg>
{/snippet}

<MenuWrapper className="w-80 !bg-theme-surface !border-theme-border shadow-2xl">
	<div class="px-5 py-3">
		<span class="text-[11px] font-black text-theme-secondary uppercase tracking-[0.2em]">Menu</span>
	</div>

	{@const menuItems =
		uiState.context === 'reader'
			? ['upload', 'stats', 'appearance']
			: ['upload', 'download', 'stats', 'appearance']}
	{@const layout = menuItems.length === 4 ? [2, 2] : [2, 1]}

	<MenuGrid items={menuItems} {layout}>
		{#snippet children(itemKey)}
			{#if itemKey === 'upload'}
				<MenuGridItem
					label="Upload"
					variant="primary"
					onClick={() => {
						uiState.isUploadOpen = true;
						contextMenu.close();
					}}
				>
					{#snippet icon()}{@render iconUpload()}{/snippet}
				</MenuGridItem>
			{:else if itemKey === 'download'}
				<MenuGridItem
					label="Download"
					variant="success"
					onClick={() => (isDownloadOpen = !isDownloadOpen)}
				>
					{#snippet icon()}{@render iconDownload()}{/snippet}
				</MenuGridItem>
			{:else if itemKey === 'stats'}
				<MenuGridItem
					label="Stats (WIP)"
					variant="stats"
					onClick={() => {
						uiState.isStatsOpen = true;
						contextMenu.close();
					}}
				>
					{#snippet icon()}{@render iconStats()}{/snippet}
				</MenuGridItem>
			{:else if itemKey === 'appearance'}
				<MenuGridItem
					label="Appearance"
					variant="warning"
					onClick={() => {
						uiState.isAppearanceOpen = true;
						contextMenu.close();
					}}
				>
					{#snippet icon()}{@render iconAppearanceGrid()}{/snippet}
				</MenuGridItem>
			{/if}
		{/snippet}
	</MenuGrid>

	{#if isDownloadOpen && uiState.context !== 'reader'}
		<div
			class="mx-3 mb-3 bg-theme-main border border-theme-border-light rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-150"
		>
			<button
				onclick={() => handleDownload('zip')}
				class="w-full pl-4 pr-4 py-2.5 text-left text-xs font-medium text-theme-primary hover:text-white hover:bg-theme-surface-hover/70 transition-colors border-b border-theme-border/30 rounded-t-xl"
			>
				Download as ZIP
			</button>
			<button
				onclick={() => handleDownload('meta')}
				class="w-full pl-4 pr-4 py-2.5 text-left text-xs font-medium text-theme-primary hover:text-white hover:bg-theme-surface-hover/70 transition-colors border-b border-theme-border/30"
			>
				Metadata Only (ZIP)
			</button>
			<button
				onclick={() => handleDownload('pdf')}
				class="w-full pl-4 pr-4 py-2.5 text-left text-xs font-medium text-theme-primary hover:text-white hover:bg-theme-surface-hover/70 transition-colors rounded-b-xl"
			>
				Download as PDF
			</button>
		</div>
	{/if}

	<MenuSeparator />
	<MenuGroup>
		<MenuItem
			label="Settings"
			onClick={() => {
				goto('/settings');
				contextMenu.close();
			}}
			className="rounded-xl"
		>
			{#snippet icon()}
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
					><path
						d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
					/><circle cx="12" cy="12" r="3" /></svg
				>
			{/snippet}
		</MenuItem>

		<MenuItem
			label="Documentation"
			onClick={() => {
				window.open('https://nguyenston.github.io/mokuro-library/', '_blank');
				contextMenu.close();
			}}
			className="rounded-xl"
		>
			{#snippet icon()}
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
					><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg
				>
			{/snippet}
		</MenuItem>

		<MenuItem
			label="GitHub Repository"
			onClick={() => {
				window.open('https://github.com/nguyenston/mokuro-library', '_blank');
				contextMenu.close();
			}}
			className="rounded-xl"
		>
			{#snippet icon()}
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
					><path
						d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
					/><path d="M9 18c-4.51 2-5-2-7-2" /></svg
				>
			{/snippet}
		</MenuItem>

		<MenuItem
			label="Discord Server"
			onClick={() => {
				contextMenu.close();
			}}
			className="rounded-xl"
		>
			{#snippet icon()}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path
						d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"
					/></svg
				>
			{/snippet}
		</MenuItem>

		<MenuItem
			label="About"
			onClick={() => {
				uiState.isAboutOpen = true;
				contextMenu.close();
			}}
			className="rounded-xl"
		>
			{#snippet icon()}
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
					><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg
				>
			{/snippet}
		</MenuItem>

		<MenuItem label="Logout" variant="danger" onClick={handleLogout} className="rounded-xl">
			{#snippet icon()}
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
			{/snippet}
		</MenuItem>
	</MenuGroup>
</MenuWrapper>
