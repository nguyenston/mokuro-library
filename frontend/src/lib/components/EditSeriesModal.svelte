<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import MenuInput from '$lib/components/menu/MenuInput.svelte';

	let { isOpen, onClose, onSave, initialTitle, initialDescription } = $props<{
		isOpen: boolean;
		onClose: () => void;
		onSave: (title: string | null, description: string | null) => void;
		initialTitle: string | null;
		initialDescription: string | null;
	}>();

	let title = $state(initialTitle ?? '');
	let description = $state(initialDescription ?? '');

	// Reset state when modal opens
	$effect(() => {
		if (isOpen) {
			title = initialTitle ?? '';
			description = initialDescription ?? '';
		}
	});

	const handleSave = () => {
		onSave(title || null, description || null);
		onClose();
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
				<h2 class="text-2xl font-bold text-white">Edit Series</h2>
				<p class="text-sm text-gray-400">Update display details for this series.</p>
			</div>

			<div class="flex flex-col gap-6">
				<MenuInput
					label="Display Title"
					placeholder="Original folder name will be used if empty"
					bind:value={title}
				/>

				<div>
					<div class="block text-sm font-semibold text-gray-400 mb-2">Description</div>
					<textarea
						bind:value={description}
						rows="5"
						placeholder="Enter a synopsis or notes..."
						class="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 focus:bg-black/30 transition-all duration-200 resize-none"
					></textarea>
				</div>
			</div>

			<div class="mt-8 flex justify-end gap-3">
				<button
					onclick={onClose}
					class="px-5 py-2.5 rounded-xl border border-transparent text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					class="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all transform active:scale-95"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
