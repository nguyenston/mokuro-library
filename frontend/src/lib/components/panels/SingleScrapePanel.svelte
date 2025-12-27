<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import MetadataComparisonCard from './MetadataComparisonCard.svelte';
	import type { ScrapedPreview } from '$lib/states/ReviewSession.svelte';
	import { scrapingState } from '$lib/states/ScrapingState.svelte';
	import { lockScroll } from '$lib/actions/lockScroll';

	let {
		isOpen,
		isLoading = false,
		preview = $bindable(),
		provider = 'anilist',
		onClose
	}: {
		isOpen: boolean;
		isLoading?: boolean;
		preview: ScrapedPreview | null;
		provider?: 'anilist' | 'mal' | 'kitsu';
		onClose: () => void;
	} = $props();

	async function handleConfirm() {
		if (!preview) return;
		await scrapingState.session.commitChange(preview);
		if (preview.status === 'applied') {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
		// Only trigger confirm if we actually have a preview
		if (preview && e.key === 'Enter' && !e.shiftKey) {
			if (document.activeElement?.tagName !== 'INPUT') {
				e.preventDefault();
				handleConfirm();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		use:lockScroll
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="relative z-10 bg-theme-surface rounded-2xl border border-theme-border max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<button
				type="button"
				class="absolute top-4 right-4 text-theme-secondary hover:text-theme-primary z-50 p-1 rounded-md hover:bg-theme-main/50 transition-colors"
				onclick={onClose}
				title="Close"
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
					><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
				>
			</button>

			<div class="h-full flex flex-col mt-[24px]">
				{#if isLoading}
					<div class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
						<div
							class="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin"
						></div>
						<div>
							<h3 class="text-lg font-bold text-theme-primary">Fetching Metadata</h3>
							<p class="text-sm text-theme-secondary">Searching {provider} for matches...</p>
						</div>
					</div>
				{:else if preview}
					<div class="flex-1 min-h-0 p-6 flex flex-col">
						<MetadataComparisonCard
							bind:preview
							{provider}
							isBulk={false}
							onConfirm={handleConfirm}
							onCancel={onClose}
						/>
					</div>
				{:else}
					<div class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
						<div
							class="w-16 h-16 rounded-full bg-theme-main flex items-center justify-center text-theme-secondary"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="32"
								height="32"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
									x1="12"
									y1="16"
									x2="12.01"
									y2="16"
								/>
							</svg>
						</div>
						<div class="max-w-md">
							<h3 class="text-xl font-bold text-theme-primary mb-2">No Results Found</h3>
							<p class="text-theme-secondary">
								We couldn't find any metadata for this series on <b>{provider}</b>. Try changing the
								provider or checking the series title.
							</p>
						</div>
						<button
							onclick={onClose}
							class="px-6 py-2 rounded-xl bg-theme-main border border-theme-border text-theme-primary font-semibold hover:bg-theme-surface-hover transition-colors"
						>
							Close
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
