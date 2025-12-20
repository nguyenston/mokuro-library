<script lang="ts">
	import { uiState } from '$lib/states/uiState.svelte';
	import { user } from '$lib/authStore';
	import { apiFetch, triggerDownload } from '$lib/api';
	import { contextMenu } from '$lib/contextMenuStore';
	import MenuWrapper from '$lib/components/menu/MenuWrapper.svelte';
	import MenuItem from '$lib/components/menu/MenuItem.svelte';
	import MenuSeparator from '$lib/components/menu/MenuSeparator.svelte';
	import MenuGrid from '$lib/components/menu/MenuGrid.svelte';
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

<MenuWrapper className="w-80">
	<div class="px-6 py-2">
		<span class="text-[11px] font-black text-theme-tertiary uppercase tracking-[0.2em]">Menu</span>
	</div>

	<MenuGrid>
		<MenuGridItem
			label="Upload"
			variant="primary"
			onClick={() => {
				uiState.isUploadOpen = true;
				contextMenu.close();
			}}
		>
			{#snippet icon()}
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
						points="17 8 12 3 7 8"
					/><line x1="12" x2="12" y1="3" y2="15" /></svg
				>
			{/snippet}
		</MenuGridItem>

		{#if uiState.context !== 'reader'}
			<MenuGridItem
				label="Download"
				variant="success"
				onClick={() => (isDownloadOpen = !isDownloadOpen)}
			>
				{#snippet icon()}
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
			</MenuGridItem>
		{/if}

		<MenuGridItem
			label="Stats"
			variant="stats"
			onClick={() => {
				uiState.isStatsOpen = true;
				contextMenu.close();
			}}
		>
			{#snippet icon()}
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
					><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line
						x1="6"
						x2="6"
						y1="20"
						y2="16"
					/></svg
				>
			{/snippet}
		</MenuGridItem>

		<MenuGridItem
			label="Select"
			variant="warning"
			onClick={() => {
				uiState.toggleSelectionMode();
				contextMenu.close();
			}}
		>
			{#snippet icon()}
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
					><path d="m9 11 3 3L22 4" /><path
						d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
					/></svg
				>
			{/snippet}
		</MenuGridItem>
	</MenuGrid>

	{#if isDownloadOpen && uiState.context !== 'reader'}
		<div
			class="mx-4 mb-3 bg-theme-main/30 border border-theme-border-light rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-150"
		>
			<button
				onclick={() => handleDownload('zip')}
				class="w-full pl-4 pr-4 py-2.5 text-left text-xs font-medium text-theme-secondary hover:text-white hover:bg-white/5 transition-colors border-b border-theme-border-light/50"
			>
				Download as ZIP
			</button>
			<button
				onclick={() => handleDownload('meta')}
				class="w-full pl-4 pr-4 py-2.5 text-left text-xs font-medium text-theme-secondary hover:text-white hover:bg-white/5 transition-colors border-b border-theme-border-light/50"
			>
				Metadata Only (ZIP)
			</button>
			<button
				onclick={() => handleDownload('pdf')}
				class="w-full pl-4 pr-4 py-2.5 text-left text-xs font-medium text-theme-secondary hover:text-white hover:bg-white/5 transition-colors"
			>
				Download as PDF
			</button>
		</div>
	{/if}

	<MenuSeparator />

	<div class="px-2 space-y-0.5">
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
	</div>
</MenuWrapper>
