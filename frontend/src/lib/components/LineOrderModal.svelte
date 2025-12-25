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
		<div
			transition:fade={{ duration: 150 }}
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={handleDone}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Escape' && handleDone()}
			aria-label="Close modal"
		></div>

		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="relative w-full max-w-lg transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all flex flex-col max-h-[90vh]"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border flex-shrink-0"
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
						<line x1="3" y1="6" x2="21" y2="6" />
						<line x1="3" y1="12" x2="21" y2="12" />
						<line x1="3" y1="18" x2="21" y2="18" />
					</svg>
					<div>
						<h2 class="text-2xl font-bold theme-primary">Re-order Lines</h2>
						<p class="text-xs text-theme-secondary mt-0.5">Adjust the reading order for text selection.</p>
					</div>
				</div>
				<button
					onclick={handleDone}
					class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover transition-colors"
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

			<!-- Content (Scrollable) -->
			<div class="flex-1 overflow-y-auto p-6">
				<div class="space-y-2">
					{#each $lineOrderStore.block.lines as line, lineIndex (lineIndex)}
						<div
							class="flex items-center justify-between gap-4 rounded-xl bg-theme-main border border-theme-border-light p-3 text-sm theme-primary transition-colors hover:bg-theme-surface-hover"
						>
							<span class="truncate font-medium flex-1">
								<span class="text-accent mr-2 font-bold">{lineIndex + 1}.</span>
								{line}
							</span>

							<div class="flex flex-shrink-0 gap-1 bg-theme-surface rounded-lg p-1 border border-theme-border">
								<button
									type="button"
									onclick={() => handleMoveUp(lineIndex)}
									disabled={lineIndex === 0}
									class="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
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
									class="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
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
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 bg-theme-main border-t border-theme-border flex justify-end flex-shrink-0">
				<button
					type="button"
					onclick={handleDone}
					class="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/80 shadow-lg shadow-accent/20 transition-all transform active:scale-95"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
