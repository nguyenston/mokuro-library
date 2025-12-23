<script lang="ts">
	import { lineOrderStore } from '$lib/lineOrderStore';
	import { fade, scale } from 'svelte/transition';

	/**
	 * Swaps two elements in an array.
	 * This function mutates the array to trigger reactivity.
	 */
	const swap = (arr: any[], i: number, j: number) => {
		[arr[i], arr[j]] = [arr[j], arr[i]];
	};

	const handleMoveUp = (lineIndex: number) => {
		const { block } = $lineOrderStore;
		if (!block || lineIndex === 0) return;

		swap(block.lines, lineIndex, lineIndex - 1);
		swap(block.lines_coords, lineIndex, lineIndex - 1);
	};

	const handleMoveDown = (lineIndex: number) => {
		const { block } = $lineOrderStore;
		if (!block || lineIndex === block.lines.length - 1) return;

		swap(block.lines, lineIndex, lineIndex + 1);
		swap(block.lines_coords, lineIndex, lineIndex + 1);
	};

	const handleDone = () => {
		$lineOrderStore.onSave();
		lineOrderStore.close();
	};
</script>

{#if $lineOrderStore.isOpen && $lineOrderStore.block}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0"
		role="dialog"
		aria-modal="true"
	>
		<button
			transition:fade={{ duration: 150 }}
			class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
			onclick={handleDone}
			aria-label="Close modal"
		></button>

		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="relative w-full max-w-lg rounded-3xl bg-black/40 backdrop-blur-3xl border border-white/10 p-8 shadow-2xl"
		>
			<div class="mb-6">
				<h2 class="text-2xl font-bold text-white">Re-order Lines</h2>
				<p class="text-sm text-gray-400 mt-1">Adjust the reading order for text selection.</p>
			</div>

			<div class="max-h-[50vh] overflow-y-auto pr-2 -mr-2 space-y-2">
				{#each $lineOrderStore.block.lines as line, lineIndex (lineIndex)}
					<div
						class="flex items-center justify-between gap-4 rounded-xl bg-white/5 border border-white/5 p-3 text-sm text-gray-200 transition-colors hover:bg-white/10"
					>
						<span class="truncate font-medium flex-1">
							<span class="text-accent mr-2 font-bold">{lineIndex + 1}.</span>
							{line}
						</span>

						<div class="flex flex-shrink-0 gap-1 bg-black/20 rounded-lg p-1 border border-white/5">
							<button
								type="button"
								onclick={() => handleMoveUp(lineIndex)}
								disabled={lineIndex === 0}
								class="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
								aria-label="Move line up"
							>
								<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M14.77 12.79a.75.75 0 01-1.06 0L10 9.06l-3.71 3.73a.75.75 0 11-1.06-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>

							<button
								type="button"
								onclick={() => handleMoveDown(lineIndex)}
								disabled={lineIndex === $lineOrderStore.block.lines.length - 1}
								class="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
								aria-label="Move line down"
							>
								<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M5.23 7.21a.75.75 0 011.06 0L10 10.94l3.71-3.73a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 010-1.06z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-8 flex justify-end">
				<button
					type="button"
					onclick={handleDone}
					class="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all transform active:scale-95"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
