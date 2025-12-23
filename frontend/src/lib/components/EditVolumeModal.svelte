<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { metadataOps } from '$lib/states/metadataOperations.svelte';
	import MenuInput from '$lib/components/menu/MenuInput.svelte';

	interface Volume {
		id: string;
		title: string | null;
	}

	let { volume, isOpen, onClose, onRefresh } = $props<{
		volume: Volume | null;
		isOpen: boolean;
		onClose: () => void;
		onRefresh: () => void;
	}>();

	let title = $state(volume?.title ?? '');

	// Reset state when modal opens
	$effect(() => {
		if (isOpen) {
			title = volume?.title ?? '';
		}
	});

	const saveVolumeMetadata = async () => {
		if (!volume) return;
		try {
			await metadataOps.saveVolumeMetadata(volume.id, { title: title || null });
			onRefresh();
			onClose();
		} catch (e: any) {
			console.error(e);
			alert('Edit volume metadata failed');
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
			class="relative w-full max-w-lg rounded-3xl bg-black/40 backdrop-blur-3xl border border-white/10 p-8 shadow-2xl"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div class="mb-6">
				<h2 class="text-2xl font-bold text-white">Edit Volume</h2>
				<p class="text-sm text-gray-400">Update display details for this volume.</p>
			</div>

			<div class="flex flex-col gap-6">
				<MenuInput
					label="Display Title"
					placeholder="Original folder name will be used if empty"
					bind:value={title}
				/>
			</div>

			<div class="mt-8 flex justify-end gap-3">
				<button
					onclick={onClose}
					class="px-5 py-2.5 rounded-xl border border-transparent text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={() => saveVolumeMetadata()}
					class="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all transform active:scale-95"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
