<script lang="ts">
	import { confirmation } from '$lib/confirmationStore';
	import { fade } from 'svelte/transition';

	let isProcessing = $state(false);

	async function handleConfirm() {
		isProcessing = true;
		try {
			// Execute the callback passed to the store
			await $confirmation.onConfirm();
		} catch (error) {
			console.error('Confirmation action failed:', error);
			// We could show an error here, but for now just close
		} finally {
			isProcessing = false;
			confirmation.close();
		}
	}
</script>

{#if $confirmation.isOpen}
	<!-- click on background to close-->
	<button
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-40 h-full w-full bg-black/50"
		onclick={confirmation.close}
		aria-label="Close modal"
	></button>

	<div
		transition:fade={{ duration: 150 }}
		class="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
		role="alertdialog"
		aria-labelledby="dialog-title"
		aria-describedby="dialog-description"
	>
		<h2 id="dialog-title" class="text-xl font-semibold text-gray-900 dark:text-white">
			{$confirmation.title}
		</h2>

		<p id="dialog-description" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			{$confirmation.message}
		</p>

		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				onclick={confirmation.close}
				disabled={isProcessing}
				class="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleConfirm}
				disabled={isProcessing}
				class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
			>
				{isProcessing ? $confirmation.processingLabel : $confirmation.confirmLabel}
			</button>
		</div>
	</div>
{/if}
