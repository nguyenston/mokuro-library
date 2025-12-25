<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { metadataOps } from '$lib/states/metadataOperations.svelte';
	import MenuInput from '$lib/components/menu/MenuInput.svelte';

	interface Series {
		id: string;
		title: string | null;
		japaneseTitle?: string | null;
		romajiTitle?: string | null;
		description: string | null;
	}

	let { series, isOpen, onClose, onRefresh } = $props<{
		series: Series | null;
		isOpen: boolean;
		onClose: () => void;
		onRefresh: () => void;
	}>();

	let title = $state(series?.title ?? '');
	let japaneseTitle = $state(series?.japaneseTitle ?? '');
	let romajiTitle = $state(series?.romajiTitle ?? '');
	let description = $state(series?.description ?? '');

	// Reset state when modal opens
	$effect(() => {
		if (isOpen) {
			title = series?.title ?? '';
			japaneseTitle = series?.japaneseTitle ?? '';
			romajiTitle = series?.romajiTitle ?? '';
			description = series?.description ?? '';
		}
	});

	const saveSeriesMetadata = async () => {
		if (!series) return;
		try {
			await metadataOps.saveSeriesMetadata(series.id, {
				title: title || null,
				japaneseTitle: japaneseTitle || null,
				romajiTitle: romajiTitle || null,
				description: description || null
			});
			onRefresh();
			onClose();
		} catch (e: any) {
			console.error(e);
			alert('Edit series metadata failed');
		}
	};
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
			transition:fade={{ duration: 150 }}
			onclick={onClose}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Escape' && onClose()}
			aria-label="Close modal"
		></div>

		<div
			class="relative w-full max-w-2xl max-h-[90vh] transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all sm:my-8 flex flex-col"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border"
			>
				<div class="flex items-center gap-3">
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
						class="text-accent"
					>
						<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
						<path d="m15 5 4 4" />
					</svg>
					<div>
						<h2 class="text-2xl font-bold text-theme-primary">Edit Series</h2>
						<p class="text-sm text-theme-secondary">Update metadata and display details</p>
					</div>
				</div>
				<button
					onclick={onClose}
					class="p-2 rounded-lg text-theme-secondary hover:text-white hover:bg-theme-surface-hover transition-colors"
					aria-label="Close"
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
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto p-6">
				<div class="flex flex-col gap-6">
					<MenuInput
						label="Display Title (English)"
						placeholder="Original folder name will be used if empty"
						bind:value={title}
					/>

					<MenuInput
						label="Japanese Title (Kanji/Kana)"
						placeholder="e.g., 進撃の巨人"
						bind:value={japaneseTitle}
					/>

					<MenuInput
						label="Romaji Title"
						placeholder="e.g., Shingeki no Kyojin"
						bind:value={romajiTitle}
					/>

					<div>
						<div class="block text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">
							Description
						</div>
						<textarea
							bind:value={description}
							rows="6"
							placeholder="Enter a synopsis or notes..."
							class="w-full px-4 py-3 rounded-xl bg-theme-main border border-theme-border text-theme-primary placeholder-gray-500 focus:outline-none focus:border-accent transition-all duration-200 resize-none"
						></textarea>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-end gap-3 px-6 py-4 bg-theme-main border-t border-theme-border"
			>
				<button
					onclick={onClose}
					class="px-5 py-2.5 rounded-xl border border-theme-border text-sm font-semibold text-theme-secondary hover:text-white hover:bg-theme-surface-hover transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={() => saveSeriesMetadata()}
					class="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all transform active:scale-95"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
