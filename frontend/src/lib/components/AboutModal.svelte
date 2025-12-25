<script lang="ts">
	import Logo from './Logo.svelte';
	let { isOpen, onClose } = $props<{ isOpen: boolean; onClose: () => void }>();
	const version = __COMMIT_HASH__ ?? 'dev';
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
			class="relative w-full max-w-2xl max-h-[90vh] transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all sm:my-8 flex flex-col"
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
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="16" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12.01" y2="8" />
					</svg>
					<div>
						<h2 class="text-2xl font-bold theme-primary">About</h2>
						<p class="text-sm text-theme-secondary">Application information</p>
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
				<div class="flex flex-col items-center text-center">
					<div class="mb-6 flex h-24 w-24 scale-[1.5] items-center justify-center">
						<Logo />
					</div>

					<h3 class="text-3xl font-bold text-theme-primary mb-2">Mokuro</h3>
					<p class="text-sm font-semibold text-accent uppercase tracking-widest mb-8">
						Library Manager
					</p>

					<div class="w-full max-w-md space-y-4">
						<div
							class="flex justify-between items-center rounded-xl bg-theme-main border border-theme-border-light px-5 py-4"
						>
							<span class="text-sm font-medium text-theme-secondary">Version</span>
							<span class="font-mono text-sm font-semibold text-theme-primary">{version}</span>
						</div>
						<div
							class="flex justify-between items-center rounded-xl bg-theme-main border border-theme-border-light px-5 py-4"
						>
							<span class="text-sm font-medium text-theme-secondary">License</span>
							<span class="text-sm font-semibold text-theme-primary">MIT</span>
						</div>
						<div
							class="flex justify-between items-center rounded-xl bg-theme-main border border-theme-border-light px-5 py-4"
						>
							<span class="text-sm font-medium text-theme-secondary">Developer</span>
							<a
								href="https://github.com/nguyenston"
								target="_blank"
								rel="noreferrer"
								class="text-sm font-semibold text-accent hover:text-theme-primary transition-colors"
								>@nguyenston</a
							>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-end gap-3 px-6 py-4 bg-theme-main border-t border-theme-border"
			>
				<button
					onclick={onClose}
					class="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all transform active:scale-95"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
