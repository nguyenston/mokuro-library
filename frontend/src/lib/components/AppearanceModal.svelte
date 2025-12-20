<script lang="ts">
	import ColorPicker from './ColorPicker.svelte';
	import { themeStore } from '$lib/stores/themeStore.svelte';

	let { isOpen, onClose } = $props<{ isOpen: boolean; onClose: () => void }>();

	// State for appearance settings
	let openColorPicker = $state<string | null>(null);
	let openColorPickerMode = $state<'dark' | 'light' | null>(null);

	// Use theme store
	const store = themeStore;
	const colorMode = $derived(store.colorMode);
	const selectedTheme = $derived(store.isCustomThemeEnabled ? 'custom' : (store.currentTheme?.id || 'mokuro'));
	const customThemeEnabled = $derived(store.isCustomThemeEnabled);
	const customColors = $derived(store.customColors);
	const themes = $derived(store.themes);
	const resolvedColorMode = $derived(store.getResolvedColorMode());

	const colorEntries = [
		{
			key: 'main-background',
			label: 'MAIN BACKGROUND',
			description: 'Page background, library view background'
		},
		{
			key: 'card-background',
			label: 'CARD BACKGROUND',
			description: 'Series cards, modal backgrounds, settings panels'
		},
		{
			key: 'card-highlight',
			label: 'CARD HIGHLIGHT',
			description: 'Card hover states, surface highlights'
		},
		{
			key: 'border-color',
			label: 'BORDER COLOR',
			description: 'Card borders, dividers, input borders'
		},
		{
			key: 'primary-color',
			label: 'PRIMARY COLOR',
			description: 'Buttons, links, active states, progress circles'
		},
		{
			key: 'primary-hover',
			label: 'PRIMARY HOVER',
			description: 'Button hover states, link hover colors'
		},
		{
			key: 'main-text',
			label: 'MAIN TEXT',
			description: 'Primary text, titles, headings'
		},
		{
			key: 'muted-text',
			label: 'MUTED TEXT',
			description: 'Secondary text, descriptions, metadata'
		},
		{
			key: 'reading-color',
			label: 'READING COLOR',
			description: 'Progress indicators, reading status circles'
		}
	];

	function resetDefaults() {
		store.resetCustomColors();
	}

	function handleColorModeChange(mode: 'dark' | 'light' | 'system') {
		store.setColorMode(mode);
	}

	function handleThemeSelect(themeId: string) {
		if (themeId === 'custom') {
			// Enable custom theme
			store.isCustomThemeEnabled = true;
			store.applyCustomTheme();
		} else {
			store.setTheme(themeId);
		}
	}

	function handleCustomColorChange(mode: 'dark' | 'light', key: string, value: string) {
		store.updateCustomColor(mode, key as any, value);
	}
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
			class="relative w-full max-w-4xl max-h-[90vh] transform overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl transition-all sm:my-8 flex flex-col"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border">
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
						<rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
						<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
						<line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
					</svg>
					<h2 class="text-2xl font-bold text-white">Appearance</h2>
				</div>
				<button
					onclick={onClose}
					class="p-2 rounded-lg text-theme-secondary hover:text-white hover:bg-white/10 transition-colors"
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
			<div class="flex-1 overflow-y-auto p-6 space-y-8">
				<!-- COLOR MODE Section -->
				<div>
					<h3 class="text-sm font-bold text-white uppercase tracking-[0.2em] mb-4">COLOR MODE</h3>
					<div class="flex gap-3">
						<!-- Dark Mode -->
						<button
							onclick={() => handleColorModeChange('dark')}
								class="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all {colorMode === 'dark'
								? 'border-accent/50 bg-accent/10'
								: 'border-theme-border bg-theme-main hover:border-theme-border-light'}"
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
								class="text-white"
							>
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
							</svg>
							<span class="text-white font-medium">Dark</span>
						</button>

						<!-- Light Mode -->
						<button
							onclick={() => handleColorModeChange('light')}
								class="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all {colorMode === 'light'
								? 'border-accent/50 bg-accent/10'
								: 'border-theme-border bg-theme-main hover:border-theme-border-light'}"
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
								class="text-white"
							>
								<circle cx="12" cy="12" r="5" />
								<line x1="12" y1="1" x2="12" y2="3" />
								<line x1="12" y1="21" x2="12" y2="23" />
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
								<line x1="1" y1="12" x2="3" y2="12" />
								<line x1="21" y1="12" x2="23" y2="12" />
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
							</svg>
							<span class="text-white font-medium">Light</span>
						</button>

						<!-- System Mode -->
						<button
							onclick={() => handleColorModeChange('system')}
								class="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all {colorMode === 'system'
								? 'border-accent/50 bg-accent/10'
								: 'border-theme-border bg-theme-main hover:border-theme-border-light'}"
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
								class="text-white"
							>
								<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
								<line x1="8" y1="21" x2="16" y2="21" />
								<line x1="12" y1="17" x2="12" y2="21" />
							</svg>
							<span class="text-white font-medium">System</span>
						</button>
					</div>
				</div>

				<!-- SELECT THEME Section -->
				<div>
					<h3 class="text-sm font-bold text-white uppercase tracking-[0.2em] mb-4">SELECT THEME</h3>
					<div class="grid grid-cols-2 gap-3">
						{#each themes as theme}
							{@const previewColors = theme.previewColors[resolvedColorMode]}
							<button
								onclick={() => handleThemeSelect(theme.id)}
								class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all {selectedTheme === theme.id
									? 'border-accent/50 bg-accent/10'
									: 'border-white/5 bg-black/30 hover:border-white/10'}"
							>
								<span class="text-white font-medium flex-shrink-0">{theme.name}</span>
								<div class="flex-1"></div>
								<!-- Color Palette - Shows 5 main colors: main-bg, card-bg, card-highlight, primary, border -->
								<div class="flex gap-1 flex-shrink-0">
									{#each previewColors as color}
										<div
											class="w-4 h-4 rounded border border-theme-border-light"
											style="background-color: {color};"
										></div>
									{/each}
								</div>
								{#if selectedTheme === theme.id}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-accent flex-shrink-0 ml-1"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Custom Theme Section -->
				<div>
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="text-lg font-bold text-white mb-1">Custom Theme</h3>
							<p class="text-sm text-theme-secondary">Create your own color palette</p>
						</div>
						<!-- Toggle Switch -->
						<button
							onclick={() => {
								if (customThemeEnabled) {
									// Disable custom theme, revert to current theme
									store.isCustomThemeEnabled = false;
									if (store.currentTheme) {
										store.applyTheme(store.currentTheme);
									}
								} else {
									// Enable custom theme
									handleThemeSelect('custom');
								}
							}}
							class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {customThemeEnabled
								? 'bg-accent'
								: 'bg-theme-border-light'}"
							role="switch"
							aria-checked={customThemeEnabled}
						>
							<span
								class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {customThemeEnabled
									? 'translate-x-6'
									: 'translate-x-1'}"
							></span>
						</button>
					</div>

					{#if customThemeEnabled}
						<div class="space-y-6">
							<!-- Reset Defaults Button -->
							<div class="flex justify-end">
								<button
									onclick={resetDefaults}
									class="flex items-center gap-2 px-4 py-2 rounded-xl border border-theme-border-light bg-theme-main hover:bg-theme-surface-hover text-theme-secondary hover:text-white transition-colors"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
										<path d="M21 3v5h-5" />
										<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
										<path d="M3 21v-5h5" />
									</svg>
									Reset Defaults
								</button>
							</div>

							<!-- Dark Mode Colors -->
							<div>
								<div class="flex items-center gap-2 mb-4">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-white"
									>
										<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
									</svg>
									<h4 class="text-sm font-bold text-white uppercase tracking-wider">Dark Mode Colors</h4>
								</div>
								<div class="grid grid-cols-1 gap-3">
									{#each colorEntries as entry}
										{@const colorValue = customColors.dark[entry.key]}
										<button
											onclick={() => {
												openColorPicker = entry.key;
												openColorPickerMode = 'dark';
											}}
											class="flex items-center gap-4 px-4 py-3 rounded-xl border border-theme-border-light bg-theme-main hover:bg-theme-surface-hover hover:border-theme-border transition-all text-left group"
										>
											<div
												class="w-14 h-14 rounded-lg border-2 border-white/20 flex-shrink-0 shadow-lg"
												style="background-color: {colorValue};"
											></div>
											<div class="flex-1 min-w-0">
												<div class="text-xs font-bold text-white uppercase tracking-wider mb-1">
													{entry.label}
												</div>
												<div class="text-xs text-theme-secondary mb-1">
													{entry.description}
												</div>
												<div class="text-sm font-mono text-theme-tertiary">
													{colorValue.toUpperCase()}
												</div>
											</div>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="text-theme-secondary group-hover:text-white transition-colors"
											>
												<path d="M7 7h10v10" />
												<path d="M7 17L17 7" />
											</svg>
										</button>
									{/each}
								</div>
							</div>

							<!-- Light Mode Colors -->
							<div>
								<div class="flex items-center gap-2 mb-4">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-white"
									>
										<circle cx="12" cy="12" r="5" />
										<line x1="12" y1="1" x2="12" y2="3" />
										<line x1="12" y1="21" x2="12" y2="23" />
										<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
										<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
										<line x1="1" y1="12" x2="3" y2="12" />
										<line x1="21" y1="12" x2="23" y2="12" />
										<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
										<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
									</svg>
									<h4 class="text-sm font-bold text-white uppercase tracking-wider">Light Mode Colors</h4>
								</div>
								<div class="grid grid-cols-1 gap-3">
									{#each colorEntries as entry}
										{@const colorValue = customColors.light[entry.key]}
										<button
											onclick={() => {
												openColorPicker = entry.key;
												openColorPickerMode = 'light';
											}}
											class="flex items-center gap-4 px-4 py-3 rounded-xl border border-theme-border-light bg-theme-main hover:bg-theme-surface-hover hover:border-theme-border transition-all text-left group"
										>
											<div
												class="w-14 h-14 rounded-lg border-2 border-white/20 flex-shrink-0 shadow-lg"
												style="background-color: {colorValue};"
											></div>
											<div class="flex-1 min-w-0">
												<div class="text-xs font-bold text-white uppercase tracking-wider mb-1">
													{entry.label}
												</div>
												<div class="text-xs text-theme-secondary mb-1">
													{entry.description}
												</div>
												<div class="text-sm font-mono text-theme-tertiary">
													{colorValue.toUpperCase()}
												</div>
											</div>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="text-theme-secondary group-hover:text-white transition-colors"
											>
												<path d="M7 7h10v10" />
												<path d="M7 17L17 7" />
											</svg>
										</button>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Color Picker Modal -->
{#if openColorPicker && openColorPickerMode}
	{@const currentColor = customColors[openColorPickerMode][openColorPicker]}
	<ColorPicker
		color={currentColor}
		onClose={() => {
			openColorPicker = null;
			openColorPickerMode = null;
		}}
		onColorChange={(color) => handleCustomColorChange(openColorPickerMode, openColorPicker, color)}
	/>
{/if}

