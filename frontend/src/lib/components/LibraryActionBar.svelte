<script lang="ts">
	import { uiState } from '$lib/states/uiState.svelte';
	import { apiFetch } from '$lib/api';
	import { confirmation } from '$lib/confirmationStore';
	import { triggerDownload } from '$lib/api';
	import { contextMenu } from '$lib/contextMenuStore';
	import { onMount, onDestroy } from 'svelte';
	import { scrapingState } from '$lib/states/ScrapingState.svelte';
	import type { Series } from '$lib/types';
	import SelectionMoreMenu from './menu/SelectionMoreMenu.svelte';
	import BulkScrapePanel from './panels/BulkScrapePanel.svelte';

	let {
		type = 'series',
		onRename,
		onRefresh
	} = $props<{
		type: 'series' | 'volume';
		onRename: () => void;
		onRefresh: () => void;
	}>();

	let isProcessing = $state(false);
	let showScrapeModal = $state(false);
	let selectionCount = $derived(uiState.selection.size);

	// Handle Escape key to exit selection mode
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			if (showScrapeModal) return; // Don't exit selection if modal is open
			if (uiState.isSelectionMode) uiState.exitSelectionMode();
		}
	};

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeyDown);
	});

	// --- Actions ---

	// --- 1. Batch ZIP Logic (Ticket Pattern) ---
	const executeBatchDownload = async (includeImages: boolean) => {
		if (selectionCount === 0) return;
		const ids = Array.from(uiState.selection.keys());

		try {
			isProcessing = true;

			// A. Request Ticket
			const response = await apiFetch('/api/export/batch/ticket', {
				method: 'POST',
				body: {
					ids,
					type,
					options: { include_images: includeImages }
				}
			});

			const { ticket } = response as { ticket: string };

			// B. Trigger Download via Link
			triggerDownload(`/api/export/batch?ticket=${ticket}`);
		} catch (e) {
			console.error(e);
			alert('Failed to start download.');
		} finally {
			isProcessing = false;
		}
	};

	// --- 2. Single PDF Logic (Legacy GET) ---
	const executePdfDownload = () => {
		const id = Array.from(uiState.selection.keys())[0];
		if (!id) return;

		// Use existing GET endpoint for single PDF
		triggerDownload(`/api/export/${type}/${id}/pdf`);
		uiState.exitSelectionMode();
	};

	// --- 3. Menu Trigger ---
	const openDownloadMenu = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const target = e.currentTarget as HTMLButtonElement;
		const rect = target.getBoundingClientRect();

		// Define Menu Options
		const menuItems: any[] = [
			{
				label: `Download ZIP ${selectionCount > 1 ? '(Batch)' : ''}`,
				action: () => executeBatchDownload(true)
			},
			{
				label: 'Download Metadata',
				action: () => executeBatchDownload(false)
			}
		];

		// Conditionally add PDF for Single Selection
		if (selectionCount === 1) {
			menuItems.push({ separator: true });
			menuItems.push({
				label: 'Download as PDF',
				action: executePdfDownload
			});
		}

		// Open Menu (Use rect.top to open UPWARDS since bar is at bottom)
		// We subtract a small buffer to ensure it doesn't overlap the cursor/button weirdly
		contextMenu.open(rect.left, rect.top, menuItems, { yEdgeAlign: 'top' }, target);
	};
	const handleDelete = () => {
		const ids = Array.from(uiState.selection.keys());

		confirmation.open(
			`Delete ${selectionCount} item${selectionCount > 1 ? 's' : ''}?`,
			'This action cannot be undone. Files and progress will be permanently removed.',
			async () => {
				try {
					isProcessing = true;
					// apiFetch automatically handles JSON.stringify for objects
					await apiFetch('/api/library/batch/delete', {
						method: 'POST',
						body: { ids, type }
					});

					uiState.exitSelectionMode();
					onRefresh();
				} catch (e) {
					console.error(e);
					alert('Batch delete failed');
				} finally {
					isProcessing = false;
				}
			}
		);
	};

	// Scrape Setup (The New Logic)
	async function startScrapeSession() {
		if (type !== 'series') return;

		// Get the full objects from our map (Instant O(1) access)
		// We cast to Series[] because we checked type === 'series' above
		const selectedItems = Array.from(uiState.selection.values()) as Series[];

		// Initialize the state machine
		scrapingState.initSession(selectedItems);

		// Open the UI (The Panel will auto-start the queue on mount)
		showScrapeModal = true;
	}

	function handleScrapeClose() {
		showScrapeModal = false;
		// Refresh library to show new covers/titles/organized status
		onRefresh();
		uiState.exitSelectionMode();
	}
</script>

{#if uiState.isSelectionMode}
	<div
		class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center p-2 rounded-2xl bg-theme-surface/90 backdrop-blur-xl border border-theme-primary/20 shadow-2xl animate-in slide-in-from-bottom-10"
	>
		<div class="px-2 font-bold text-theme-primary flex items-center gap-2">
			<span
				class="bg-accent text-white text-xs rounded-full w-6 h-6 flex items-center justify-center"
			>
				{selectionCount}
			</span>
			<span class="hidden sm:inline">Selected</span>
		</div>

		{#if selectionCount >= 1}
			<div class="w-[2px] h-8 bg-theme-tertiary/70 mx-1"></div>
			<div class="flex items-center gap-1">
				<button
					onclick={openDownloadMenu}
					disabled={isProcessing}
					class="p-2.5 rounded-xl hover:bg-theme-primary/10 text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
					title="Download"
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
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="7 10 12 15 17 10"></polyline>
						<line x1="12" y1="15" x2="12" y2="3"></line>
					</svg>
				</button>

				{#if selectionCount === 1}
					<button
						onclick={onRename}
						disabled={isProcessing}
						class="p-2.5 rounded-xl hover:bg-theme-primary/10 text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
						title="Rename"
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
						>
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
						</svg>
					</button>
				{/if}

				<button
					onclick={handleDelete}
					disabled={isProcessing}
					class="p-2.5 rounded-xl hover:bg-red-500/20 text-status-danger transition-colors disabled:opacity-50"
					title="Delete"
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
					>
						<polyline points="3 6 5 6 21 6"></polyline>
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
						></path>
					</svg>
				</button>

				{#if type === 'series'}
					<SelectionMoreMenu {selectionCount} onScrape={startScrapeSession} {onRefresh} />
				{/if}
			</div>
		{/if}

		<div class="w-[2px] h-8 bg-theme-tertiary/70 mx-1"></div>
		<div class="ml-1">
			<button
				onclick={() => uiState.exitSelectionMode()}
				class="p-2 rounded-full hover:bg-white/20 text-theme-secondary hover:text-white transition-colors"
				title="exit selection"
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
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>
	</div>
{/if}

{#if showScrapeModal}
	<BulkScrapePanel provider={scrapingState.preferredProvider} onClose={handleScrapeClose} />
{/if}
