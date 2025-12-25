<script lang="ts">
	import ColorPicker from './ColorPicker.svelte';
	import { themeStore, type ThemeColors } from '$lib/stores/themeStore.svelte';
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';
	import MenuToggle from '$lib/components/menu/MenuToggle.svelte';

	let { isOpen, onClose } = $props<{ isOpen: boolean; onClose: () => void }>();

	let width = $state(0);
	let isXs = $derived(width >= 480);
	let isSm = $derived(width >= 640);
	let isMd = $derived(width >= 768);
	let isLg = $derived(width >= 1024);

	// State for appearance settings
	// Fix: Explicitly type this as keyof ThemeColors to avoid index errors
	let openColorPicker = $state<keyof ThemeColors | null>(null);
	let openColorPickerMode = $state<'dark' | 'light' | null>(null);
	let isDarkColorsExpanded = $state(false);
	let isLightColorsExpanded = $state(false);

	// Use theme store
	const store = themeStore;
	const colorMode = $derived(store.colorMode);
	// We handle theme selection via a proxy to support the store's method
	let selectedThemeId = $derived(
		store.isCustomThemeEnabled ? 'custom' : store.currentTheme?.id || 'mokuro'
	);
	const customThemeEnabled = $derived(store.isCustomThemeEnabled);
	const customColors = $derived(store.customColors);
	const themes = $derived(store.themes);
	const resolvedColorMode = $derived(store.getResolvedColorMode());

	// Fix: Type the array so 'key' is known to be a valid ThemeColors key
	const colorEntries: { key: keyof ThemeColors; label: string; description: string }[] = [
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
			store.isCustomThemeEnabled = true;
			store.applyCustomTheme();
		} else {
			store.setTheme(themeId);
		}
	}

	function handleCustomColorChange(mode: 'dark' | 'light', key: string, value: string) {
		store.updateCustomColor(mode, key as keyof ThemeColors, value);
	}

	// Wrapper for MenuToggle to handle the store logic
	let customThemeToggle = $derived({
		get value() {
			return customThemeEnabled;
		},
		set value(v: boolean) {
			if (!v) {
				store.isCustomThemeEnabled = false;
				if (store.currentTheme) store.applyTheme(store.currentTheme);
			} else {
				handleThemeSelect('custom');
			}
		}
	});

	// Wrapper for Color Mode Radio
	let colorModeValue = $derived({
		get value() {
			return colorMode;
		},
		set value(v) {
			handleColorModeChange(v);
		}
	});

	// Wrapper for Theme Radio
	let themeValue = $derived({
		get value() {
			return selectedThemeId;
		},
		set value(v) {
			handleThemeSelect(v);
		}
	});
</script>

<svelte:window bind:innerWidth={width} />
{#snippet darkIcon()}
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
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
	</svg>
{/snippet}

{#snippet lightIcon()}
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
{/snippet}

{#snippet systemIcon()}
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
		<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
		<line x1="8" y1="21" x2="16" y2="21" />
		<line x1="12" y1="17" x2="12" y2="21" />
	</svg>
{/snippet}

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
						<rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
						<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
						<line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
					</svg>
					<h2 class="text-2xl font-bold text-theme-primary">Appearance</h2>
				</div>
				<button
					onclick={onClose}
					class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-white/10 transition-colors"
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

			<div class="flex-1 overflow-y-auto p-6 space-y-8">
				<MenuGridRadio
					title="Color Mode"
					bind:value={colorModeValue.value}
					layout={isSm ? [3] : [1, 1, 1]}
					itemClass="flex flex-row items-center gap-3 px-4 py-3"
					options={[
						{ value: 'dark', label: 'Dark', icon: darkIcon },
						{ value: 'light', label: 'Light', icon: lightIcon },
						{ value: 'system', label: 'System', icon: systemIcon }
					]}
				>
					{#snippet children(option, isSelected)}
						<div class={isSelected ? 'text-accent' : 'text-theme-primary'}>
							{@render option.icon?.()}
						</div>
						<span class="font-medium {isSelected ? 'text-accent' : 'text-theme-primary'}">
							{option.label}
						</span>
					{/snippet}
				</MenuGridRadio>

				<MenuGridRadio
					title="Select Theme"
					bind:value={themeValue.value}
					layout={[2, 2]}
					itemClass="flex items-center gap-3 sm:px-4 py-3"
					options={themes.map((t) => ({
						value: t.id,
						label: t.name,
						colors: t.previewColors[resolvedColorMode]
					}))}
				>
					{#snippet children(option, isSelected)}
						<div class="flex flex-1 flex-col items-center sm:flex-row sm:justify-between gap-2">
							<span
								class="font-medium flex-shrink-0 text-left {isSelected
									? 'text-accent'
									: 'text-theme-primary'}">{option.label}</span
							>
							<div class="flex gap-0 sm:gap-1 flex-shrink-0">
								{#each option.colors as color}
									<div
										class="w-3 h-4 sm:w-4 sm:rounded sm:border border-theme-border-light"
										style="background-color: {color};"
									></div>
								{/each}
							</div>
						</div>
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
							class="hidden sm:inline text-accent flex-shrink-0 ml-1 {!isSelected
								? 'opacity-0'
								: ''}"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
					{/snippet}
				</MenuGridRadio>

				<div>
					<div class="mb-4">
						<MenuToggle
							label="Custom Theme"
							description="Create your own color palette"
							bind:checked={customThemeToggle.value}
						/>
					</div>

					{#if customThemeEnabled}
						<div class="space-y-6">
							<div class="flex items-center justify-between gap-4">
								<a
									href="https://github.com/nguyenston/mokuro-library/issues"
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-2 text-xs text-theme-secondary hover:text-theme-primary transition-colors group"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="currentColor"
										class="group-hover:scale-110 transition-transform"
									>
										<path
											d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
										/>
									</svg>
									<span>Share your theme on GitHub</span>
								</a>
								<button
									onclick={resetDefaults}
									class="flex items-center gap-2 px-4 py-2 rounded-xl border border-theme-border-light bg-theme-main hover:bg-theme-surface-hover text-theme-secondary hover:text-theme-primary transition-colors"
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

							<div
								class="rounded-2xl border border-theme-border-light bg-theme-main overflow-hidden"
							>
								<button
									onclick={() => (isDarkColorsExpanded = !isDarkColorsExpanded)}
									class="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-theme-surface-hover transition-colors"
								>
									<div class="flex items-center gap-2">
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
											class="text-theme-primary"
										>
											<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
										</svg>
										<h4 class="text-sm font-bold text-theme-primary uppercase tracking-wider">
											Dark Mode Colors
										</h4>
									</div>
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
										class="text-theme-secondary transition-transform {isDarkColorsExpanded
											? 'rotate-180'
											: ''}"
									>
										<polyline points="6 9 12 15 18 9" />
									</svg>
								</button>
								{#if isDarkColorsExpanded}
									<div class="px-4 pb-4 pt-2 space-y-3 border-t border-theme-border-light">
										{#each colorEntries as entry}
											{@const colorValue = customColors.dark[entry.key]}
											<button
												onclick={() => {
													openColorPicker = entry.key;
													openColorPickerMode = 'dark';
												}}
												class="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-theme-border-light bg-theme-surface hover:bg-theme-surface-hover hover:border-theme-border transition-all text-left group"
											>
												<div
													class="w-14 h-14 rounded-lg border-2 border-white/20 flex-shrink-0 shadow-lg"
													style="background-color: {colorValue};"
												></div>
												<div class="flex-1 min-w-0">
													<div
														class="text-xs font-bold text-theme-primary uppercase tracking-wider mb-1"
													>
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
													class="text-theme-secondary group-hover:text-theme-primary transition-colors"
												>
													<path d="M7 7h10v10" />
													<path d="M7 17L17 7" />
												</svg>
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<div
								class="rounded-2xl border border-theme-border-light bg-theme-main overflow-hidden"
							>
								<button
									onclick={() => (isLightColorsExpanded = !isLightColorsExpanded)}
									class="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-theme-surface-hover transition-colors"
								>
									<div class="flex items-center gap-2">
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
											class="text-theme-primary"
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
										<h4 class="text-sm font-bold text-theme-primary uppercase tracking-wider">
											Light Mode Colors
										</h4>
									</div>
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
										class="text-theme-secondary transition-transform {isLightColorsExpanded
											? 'rotate-180'
											: ''}"
									>
										<polyline points="6 9 12 15 18 9" />
									</svg>
								</button>
								{#if isLightColorsExpanded}
									<div class="px-4 pb-4 pt-2 space-y-3 border-t border-theme-border-light">
										{#each colorEntries as entry}
											{@const colorValue = customColors.light[entry.key]}
											<button
												onclick={() => {
													openColorPicker = entry.key;
													openColorPickerMode = 'light';
												}}
												class="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-theme-border-light bg-theme-surface hover:bg-theme-surface-hover hover:border-theme-border transition-all text-left group"
											>
												<div
													class="w-14 h-14 rounded-lg border-2 border-white/20 flex-shrink-0 shadow-lg"
													style="background-color: {colorValue};"
												></div>
												<div class="flex-1 min-w-0">
													<div
														class="text-xs font-bold text-theme-primary uppercase tracking-wider mb-1"
													>
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
													class="text-theme-secondary group-hover:text-theme-primary transition-colors"
												>
													<path d="M7 7h10v10" />
													<path d="M7 17L17 7" />
												</svg>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

{#if openColorPicker && openColorPickerMode}
	{@const currentColor = customColors[openColorPickerMode][openColorPicker]}
	<ColorPicker
		color={currentColor}
		onClose={() => {
			openColorPicker = null;
			openColorPickerMode = null;
		}}
		onColorChange={(color) =>
			handleCustomColorChange(openColorPickerMode!, openColorPicker!, color)}
	/>
{/if}
