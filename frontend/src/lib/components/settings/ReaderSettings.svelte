<script lang="ts">
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';
	import MenuToggle from '$lib/components/menu/MenuToggle.svelte';
	import MenuSlider from '$lib/components/menu/MenuSlider.svelte';
	import { readerState } from '$lib/states/ReaderState.svelte';

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

	// Placeholder local states for settings NOT yet in ReaderState
	// These remain local until we decide to persist them in the backend
	let autoFullscreen = $state(false);
	let hideHUD = $state(false);
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

<div
	class="w-full max-w-4xl p-10 rounded-3xl bg-black/20 backdrop-blur-3xl border border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
>
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-white mb-2">Reader Settings</h1>
		<p class="text-base text-gray-400">Configure how you read your content by default.</p>
	</div>

	<div class="space-y-5">
		<MenuGridRadio
			title="Page Layout"
			bind:value={readerState.layoutMode}
			layout={[3]}
			options={[
				{ value: 'single', label: 'Single', icon: singleIcon },
				{ value: 'double', label: 'Double', icon: doubleIcon },
				{ value: 'vertical', label: 'Vertical', icon: verticalIcon }
			]}
		/>

		<div class="grid grid-cols-2 gap-5">
			<MenuGridRadio
				title="Direction"
				bind:value={readerState.readingDirection}
				layout={[2]}
				options={[
					{ value: 'ltr', label: 'LTR' },
					{ value: 'rtl', label: 'RTL' }
				]}
			/>

			<MenuGridRadio
				title="Cover Offset"
				bind:value={readerState.doublePageOffset}
				layout={[3]}
				options={[
					{ value: 'off', label: 'Off' },
					{ value: 'odd', label: 'Odd' },
					{ value: 'even', label: 'Even' }
				]}
			/>
		</div>

		<MenuGridRadio
			title="On Page Change"
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

		<div
			class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg space-y-4"
		>
			<MenuSlider
				label="Nav Zone Width (%)"
				bind:value={readerState.navZoneWidth}
				min={0}
				max={50}
				step={1}
				displayValue="{readerState.navZoneWidth}%"
			/>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<MenuToggle label="Auto fullscreen in reading mode" bind:checked={autoFullscreen} />
			<MenuToggle label="Hide HUD unless hovered" bind:checked={hideHUD} />
			<MenuToggle label="Show Character Count" bind:checked={showCharacterCount} />
			<MenuToggle label="Show Timer" bind:checked={showTimer} />
			<MenuToggle label="OCR Outline" bind:checked={readerState.showTriggerOutline} />
		</div>
	</div>
</div>
