<script lang="ts">
	import { confirmation } from '$lib/confirmationStore';
	import { fade, scale } from 'svelte/transition';

	let isProcessing = $state(false);

	async function handleConfirm() {
		isProcessing = true;
		try {
			// Execute the callback passed to the store
			await $confirmation.onConfirm();
		} catch (error) {
			console.error('Confirmation action failed:', error);
		} finally {
			isProcessing = false;
			confirmation.close();
		}
	}
</script>

{#if $confirmation.isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0"
		role="dialog"
		aria-modal="true"
	>
		<button
			transition:fade={{ duration: 150 }}
			class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
			onclick={confirmation.close}
			aria-label="Close modal"
		></button>

		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="relative w-full max-w-md rounded-3xl bg-black/40 backdrop-blur-3xl border border-white/10 p-8 shadow-2xl"
		>
			<div class="mb-2">
				<h2 class="text-2xl font-bold text-white">
					{$confirmation.title}
				</h2>
			</div>

			<p class="text-sm text-gray-300 leading-relaxed mb-8">
				{$confirmation.message}
			</p>

			<div class="flex justify-end gap-3">
				<button
					onclick={confirmation.close}
					disabled={isProcessing}
					class="px-5 py-2.5 rounded-xl border border-transparent text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={handleConfirm}
					disabled={isProcessing}
					class="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isProcessing ? $confirmation.processingLabel : $confirmation.confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
