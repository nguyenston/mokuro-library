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
			class="relative w-full max-w-sm transform overflow-hidden rounded-xl border border-theme-border bg-theme-surface p-6 shadow-2xl transition-all"
		>
			<div class="flex flex-col items-center text-center">
				<div class="mb-4 flex h-16 w-16 scale-[2] items-center justify-center">
					<Logo />
				</div>

				<h3 class="text-xl font-bold text-white">Mokuro</h3>
				<p class="text-xs font-medium text-accent uppercase tracking-widest mt-1">
					Library Manager
				</p>

				<div class="mt-6 w-full space-y-3">
					<div class="flex justify-between border-b border-theme-border-light pb-2 text-sm">
						<span class="text-theme-secondary">Version</span>
						<span class="font-mono text-white">{version}</span>
					</div>
					<div class="flex justify-between border-b border-theme-border-light pb-2 text-sm">
						<span class="text-theme-secondary">License</span>
						<span class="text-white">MIT</span>
					</div>
					<div class="flex justify-between border-b border-theme-border-light pb-2 text-sm">
						<span class="text-theme-secondary">Developer</span>
						<a
							href="https://github.com/nguyenston"
							target="_blank"
							rel="noreferrer"
							class="text-accent hover:text-white transition-colors">@nguyenston</a
						>
					</div>
				</div>

				<button
					onclick={onClose}
					class="mt-8 w-full rounded-lg border border-theme-border-light bg-theme-main py-2 text-sm font-medium text-theme-secondary hover:bg-theme-surface-hover hover:text-white transition-colors"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
