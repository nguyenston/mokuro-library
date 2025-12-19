<script lang="ts">
	let { isOpen, onClose } = $props<{ isOpen: boolean; onClose: () => void }>();
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
		<div
			class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
			onclick={onClose}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Escape' && onClose()}
			aria-label="Close modal"
		></div>

		<div
			class="relative w-full max-w-md transform overflow-hidden rounded-xl border border-theme-border bg-theme-surface p-6 shadow-2xl transition-all sm:my-8"
		>
			<div class="text-center">
				<div
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 mb-4"
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
						class="text-accent"
						><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line
							x1="6"
							x2="6"
							y1="20"
							y2="16"
						/></svg
					>
				</div>
				<h3 class="text-lg font-semibold leading-6 text-white">Statistics</h3>
				<div class="mt-2">
					<p class="text-sm text-theme-secondary">
						Detailed reading insights and library statistics are coming soon.
					</p>
				</div>
			</div>

			<div class="mt-6">
				<button
					type="button"
					onclick={onClose}
					class="inline-flex w-full justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
				>
					Got it
				</button>
			</div>
		</div>
	</div>
{/if}
