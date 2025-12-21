<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import MenuInput from '$lib/components/menu/MenuInput.svelte';

	let {
		isOpen = $bindable(),
		initialTitle,
		onSave,
		onClose
	} = $props<{
		isOpen: boolean;
		initialTitle: string | null;
		onSave: (newTitle: string | null) => Promise<void> | void;
		onClose: () => void;
	}>();

	let title = $state(initialTitle ?? '');
	let isSaving = $state(false);
	let error = $state<string | null>(null);

	// Reset local state when the modal opens
	$effect(() => {
		if (isOpen) {
			title = initialTitle ?? '';
			error = null;
			isSaving = false;
		}
	});

	const handleSubmit = async () => {
		if (isSaving) return;

		isSaving = true;
		error = null;
		try {
			// Convert empty string back to null to revert to folder name
			const val = title.trim() === '' ? null : title.trim();
			await onSave(val);
			handleClose();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isSaving = false;
		}
	};

	const handleClose = () => {
		isOpen = false;
		onClose();
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') handleSubmit();
		if (e.key === 'Escape') handleClose();
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
			onclick={handleClose}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Escape' && handleClose()}
			aria-label="Close modal"
		></div>

		<div
			class="relative w-full max-w-lg rounded-3xl bg-black/40 backdrop-blur-3xl border border-white/10 p-8 shadow-2xl"
			transition:scale={{ duration: 200, start: 0.95 }}
			onkeydown={handleKeydown}
			role="presentation"
		>
			<div class="mb-6">
				<h2 class="text-2xl font-bold text-white">Rename Series</h2>
				<p class="text-sm text-gray-400">Update the display title for this item.</p>
			</div>

			<div class="flex flex-col gap-4">
				<MenuInput
					label="Display Title"
					placeholder="Leave empty to use folder name"
					bind:value={title}
				/>
				<p class="text-xs text-gray-500 ml-1">Leave blank to revert to the original folder name.</p>
			</div>

			{#if error}
				<div
					class="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200"
				>
					{error}
				</div>
			{/if}

			<div class="mt-8 flex justify-end gap-3">
				<button
					onclick={handleClose}
					disabled={isSaving}
					class="px-5 py-2.5 rounded-xl border border-transparent text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={handleSubmit}
					disabled={isSaving}
					class="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
				>
					{isSaving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
