<script lang="ts">
	import { apiFetch } from '$lib/api';
	import { fade } from 'svelte/transition';

	// This is how Svelte 5 defines props
	let { isOpen, onClose, onUploadSuccess } = $props<{
		isOpen: boolean;
		onClose: () => void;
		onUploadSuccess: () => void;
	}>();

	// Component State
	let files = $state<FileList | null>(null);
	let isUploading = $state(false);
	let uploadError = $state<string | null>(null);
	let uploadSuccess = $state<string | null>(null);

	// This $effect runs when `files` is changed by the input
	$effect(() => {
		if (files) {
			handleUpload();
		}
	});

	const handleUpload = async () => {
		if (!files) return;

		isUploading = true;
		uploadError = null;
		uploadSuccess = null;

		const formData = new FormData();
		for (const file of files) {
			// We send the file with its full webkitRelativePath
			formData.append('files', file, file.webkitRelativePath);
		}

		try {
			const response = await apiFetch('/api/library/upload', {
				method: 'POST',
				body: formData
			});
			uploadSuccess = `${response.processed} volumes processed, ${response.skipped} skipped.`;
			onUploadSuccess(); // Tell the parent page to refresh the library
		} catch (e) {
			uploadError = (e as Error).message;
		} finally {
			isUploading = false;
			files = null; // Clear the file list
		}
	};
</script>

{#if isOpen}
	<!-- click on background to close-->
	<button
		transition:fade={{ duration: 150 }}
		onclick={onClose}
		type="button"
		class="fixed inset-0 z-40 h-full w-full cursor-auto bg-black/50"
		aria-label="Close modal"
	></button>

	<div
		transition:fade={{ duration: 150 }}
		class="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
	>
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold dark:text-white">Upload Manga</h2>
			<button
				onclick={onClose}
				class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
				aria-label="Close modal"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<div class="mt-4">
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Select the **root** folder of your library containing your processed series or the root
				folder of your series.
			</p>

			<label
				class="mt-4 flex w-full cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-10 text-center hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
			>
				<span class="text-sm text-gray-500 dark:text-gray-400"> Click to select a directory </span>
				<input type="file" class="hidden" webkitdirectory bind:files disabled={isUploading} />
			</label>

			{#if isUploading}
				<p class="mt-4 text-center text-blue-500">Uploading... (This may take a while)</p>
			{/if}
			{#if uploadSuccess}
				<p class="mt-4 text-center text-green-500">{uploadSuccess}</p>
			{/if}
			{#if uploadError}
				<p class="mt-4 text-center text-red-500">{uploadError}</p>
			{/if}
		</div>
	</div>
{/if}
