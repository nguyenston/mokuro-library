<script lang="ts">
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';
	import MenuToggle from '$lib/components/menu/MenuToggle.svelte';
	import MenuSlider from '$lib/components/menu/MenuSlider.svelte';
	import { readerState } from '$lib/states/ReaderState.svelte';

	let { onClose, inReader = false }: { onClose?: () => void; inReader?: boolean } = $props();

	// Helper Proxy for Zoom Mode (Boolean in State <-> String in UI)
	class ZoomProxy {
		get value() {
			return readerState.retainZoom ? 'keep' : 'fit-screen';
		}
		set value(v: string) {
			readerState.retainZoom = v === 'keep';
		}
	}
	const zoomProxy = new ZoomProxy();

	let showCharacterCount = $state(false);
	let showTimer = $state(false);
</script>

{#snippet singleIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="28"
		height="28"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
	</svg>
{/snippet}

{#snippet doubleIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="28"
		height="28"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<rect x="3" y="2" width="7" height="20" rx="1" ry="1" />
		<rect x="14" y="2" width="7" height="20" rx="1" ry="1" />
	</svg>
{/snippet}

{#snippet verticalIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="28"
		height="28"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<rect x="6" y="2" width="12" height="6" rx="1" ry="1" />
		<rect x="6" y="9" width="12" height="6" rx="1" ry="1" />
		<rect x="6" y="16" width="12" height="6" rx="1" ry="1" />
	</svg>
{/snippet}

{#snippet settingsContent()}
	<MenuGridRadio
		title="Page Layout"
		tooltip="Single: one page
      Double: side-by-side
      Vertical: continuous scroll"
		bind:value={readerState.layoutMode}
		layout={[3]}
		options={[
			{ value: 'single', label: 'Single', icon: singleIcon },
			{ value: 'double', label: 'Double', icon: doubleIcon },
			{ value: 'vertical', label: 'Vertical', icon: verticalIcon }
		]}
	/>

	<MenuGridRadio
		title="Reading Direction"
		tooltip="Left-to-Right: Western comics/books
      Right-to-Left: Manga and Japanese books"
		bind:value={readerState.readingDirection}
		layout={[2]}
		options={[
			{ value: 'ltr', label: 'Left-to-Right' },
			{ value: 'rtl', label: 'Right-to-Left' }
		]}
	/>

	<MenuGridRadio
		title="On Page Change"
		tooltip="Fit to Screen: auto-adjust
      Keep Zoom: maintain level"
		bind:value={zoomProxy.value}
		layout={[2]}
		options={[
			{ value: 'fit-screen', label: 'Fit to Screen' },
			// { value: 'fit-width', label: 'Fit to Width' },
			// { value: 'original', label: 'Original Size' },
			{ value: 'keep', label: 'Keep Zoom' }
			// { value: 'keep-pan', label: 'Keep Zoom & Pan Top' }
		]}
	/>

	<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light space-y-4">
		<div
			role="group"
			onpointerenter={() => document.documentElement.style.setProperty('--nav-zone-opacity', '0.3')}
			onpointerleave={() => document.documentElement.style.setProperty('--nav-zone-opacity', '0')}
		>
			<MenuSlider
				label="Nav Zone Width (%)"
				tooltip="Clickable area width on edges.
          Higher = easier nav, smaller OCR area."
				bind:value={readerState.navZoneWidth}
				min={0}
				max={50}
				step={1}
				displayValue="{readerState.navZoneWidth}%"
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<MenuToggle label="First Page Cover" bind:checked={readerState.firstPageIsCover} />
		<MenuToggle label="Auto fullscreen" bind:checked={readerState.autoFullscreen} />
		<MenuToggle label="Autohide HUD" bind:checked={readerState.hideHUD} />
		<MenuToggle
			label="Auto-complete Volume"
			description="Mark volume as read when reaching the last page"
			bind:checked={readerState.autoCompleteVolume}
		/>
		<MenuToggle label="Show Char Count" bind:checked={showCharacterCount} />
		<MenuToggle label="Show Timer" bind:checked={showTimer} />
		<MenuToggle label="OCR Outline" bind:checked={readerState.showTriggerOutline} />
	</div>

	<!-- Night Mode Settings -->
	<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-theme-primary">Night Mode</h3>
			<div class="clean-toggle">
				<MenuToggle bind:checked={readerState.nightMode.enabled} />
			</div>
		</div>
		<MenuSlider
			label="Brightness (%)"
			tooltip="Adjust the brightness level for night mode."
			bind:value={readerState.nightMode.intensity}
			min={0}
			max={100}
			step={1}
			displayValue="{readerState.nightMode.intensity}%"
		/>
		<MenuSlider
			label="Red Shift (%)"
			tooltip="Reduce blue light by shifting colors toward red/orange spectrum.
Helps reduce eye strain during night reading."
			bind:value={readerState.nightMode.redShift}
			min={0}
			max={100}
			step={1}
			displayValue="{readerState.nightMode.redShift}%"
		/>
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm text-theme-secondary">Schedule (Local Time)</span>
				<div class="clean-toggle">
					<MenuToggle bind:checked={readerState.nightMode.scheduleEnabled} />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="flex flex-col">
					<label for="nightModeStartHour" class="text-sm text-theme-secondary mb-1"
						>Start Hr (0-23)</label
					>
					<input
						type="number"
						id="nightModeStartHour"
						bind:value={readerState.nightMode.startHour}
						min={0}
						max={23}
						class="w-full p-2 rounded-md bg-theme-surface border border-theme-border-light text-theme-primary"
					/>
				</div>
				<div class="flex flex-col">
					<label for="nightModeEndHour" class="text-sm text-theme-secondary mb-1"
						>End Hr (0-23)</label
					>
					<input
						type="number"
						id="nightModeEndHour"
						bind:value={readerState.nightMode.endHour}
						min={0}
						max={23}
						class="w-full p-2 rounded-md bg-theme-surface border border-theme-border-light text-theme-primary"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Invert Colors Settings -->
	<div class="rounded-2xl bg-theme-main p-6 border border-theme-border-light space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-theme-primary">Invert Colors</h3>
			<div class="clean-toggle">
				<MenuToggle bind:checked={readerState.invertColor.enabled} />
			</div>
		</div>
		<MenuSlider
			label="Intensity (%)"
			tooltip="Adjust the intensity of color inversion."
			bind:value={readerState.invertColor.intensity}
			min={0}
			max={100}
			step={1}
			displayValue="{readerState.invertColor.intensity}%"
		/>
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm text-theme-secondary">Schedule (Local Time)</span>
				<div class="clean-toggle">
					<MenuToggle bind:checked={readerState.invertColor.scheduleEnabled} />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="flex flex-col">
					<label for="invertColorsStartHour" class="text-sm text-theme-secondary mb-1"
						>Start Hr (0-23)</label
					>
					<input
						type="number"
						id="invertColorsStartHour"
						bind:value={readerState.invertColor.startHour}
						min={0}
						max={23}
						class="w-full p-2 rounded-md bg-theme-surface border border-theme-border-light text-theme-primary"
					/>
				</div>
				<div class="flex flex-col">
					<label for="invertColorsEndHour" class="text-sm text-theme-secondary mb-1"
						>End Hr (0-23)</label
					>
					<input
						type="number"
						id="invertColorsEndHour"
						bind:value={readerState.invertColor.endHour}
						min={0}
						max={23}
						class="w-full p-2 rounded-md bg-theme-surface border border-theme-border-light text-theme-primary"
					/>
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#if inReader}
	<div
		class="w-full max-w-2xl h-full flex flex-col rounded-l-2xl border-l border-t border-b border-theme-border bg-theme-surface shadow-2xl"
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
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
				<h2 class="text-2xl font-bold text-theme-primary">Reader Settings</h2>
			</div>
			<button
				onclick={onClose}
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
			<div class="space-y-5">
				{@render settingsContent()}
			</div>
		</div>
	</div>
{:else}
	<div class="w-full max-w-4xl">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-theme-primary mb-2">Reader Settings</h1>
			<p class="text-base text-theme-secondary">Configure how you read your content.</p>
		</div>

		<div class="space-y-5">
			{@render settingsContent()}
		</div>
	</div>
{/if}

<style>
	/* Hide spin buttons for number inputs */
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	/* Hide the empty label container in MenuToggle when used in clean-toggle context */
	.clean-toggle :global(.flex.flex-col) {
		display: none;
	}

	/* Remove container styling from MenuToggle when used in clean-toggle context */
	.clean-toggle :global(> *) {
		background-color: transparent !important;
		border: none !important;
		padding: 0 !important;
		width: auto !important;
		min-height: 0 !important;
	}

	/* Apply filters to reader content (pages and OCR) */
	:global(.reader-page) {
		/* Apply invert first so brightness dims the result (keeping bg black), not the source */
		filter: brightness(var(--reader-brightness, 100%))
			brightness(var(--reader-invert-brightness, 100%)) invert(var(--reader-invert, 0%))
			sepia(var(--reader-red-shift, 0%)) hue-rotate(-20deg) saturate(120%);
	}
</style>
