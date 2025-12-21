<script lang="ts">
	import MenuToggle from '$lib/components/menu/MenuToggle.svelte';
	import MenuGridRadio from '$lib/components/menu/MenuGridRadio.svelte';
	import MenuInput from '$lib/components/menu/MenuInput.svelte';
	import MenuStepper from '$lib/components/menu/MenuStepper.svelte';
	import MenuSlider from '$lib/components/menu/MenuSlider.svelte';

	// This component displays Anki Connect settings
	// Since these are default values, we'll create a local state management
	// In a real implementation, you'd want to persist these to localStorage or backend

	type TriggerMethod = 'both' | 'double-click' | 'right-click';

	// Default settings state
	let ankiConnectEnabled = $state(false);
	let pictureField = $state('Picture');
	let sentenceField = $state('Sentence');
	let cropImage = $state(false);
	let overwriteImage = $state(true);
	let grabSentence = $state(false);
	let triggerMethod = $state<TriggerMethod>('both');
	let maxHeight = $state(0);
	let maxWidth = $state(0);
	let quality = $state(0.5);
</script>

<div
	class="w-full max-w-4xl p-10 rounded-3xl bg-black/20 backdrop-blur-3xl border border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
>
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-white mb-2">Anki Connect</h1>
			<p class="text-base text-gray-400">WIP docs coming soon</p>
		</div>
		<button
			class="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 backdrop-blur-2xl border border-white/5 text-gray-400 hover:text-white hover:bg-black/40 transition-all duration-200"
		>
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
			>
				<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
			</svg>
			<span class="font-semibold text-sm">Docs</span>
		</button>
	</div>

	<div class="space-y-5">
		<MenuToggle label="AnkiConnect Integration Enabled" bind:checked={ankiConnectEnabled} />

		<div
			class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg space-y-4"
		>
			<div class="mb-2">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Field Settings</p>
			</div>
			<MenuInput label="Picture field:" bind:value={pictureField} placeholder="Picture" />
			<MenuInput label="Sentence field:" bind:value={sentenceField} placeholder="Sentence" />
		</div>

		<div
			class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg space-y-3"
		>
			<div class="mb-2">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
					Image/Sentence Actions
				</p>
			</div>
			<div class="space-y-3">
				<MenuToggle label="Crop image" bind:checked={cropImage} />
				<MenuToggle label="Overwrite image" bind:checked={overwriteImage} />
				<MenuToggle label="Grab sentence" bind:checked={grabSentence} />
			</div>
		</div>

		<MenuGridRadio
			title="Trigger method:"
			bind:value={triggerMethod}
			layout={[3]}
			options={[
				{ value: 'both', label: 'Both' },
				{ value: 'double-click', label: 'Double Click' },
				{ value: 'right-click', label: 'Right Click' }
			]}
		/>

		<div
			class="rounded-2xl bg-black/30 backdrop-blur-2xl p-6 border border-white/5 shadow-lg space-y-4"
		>
			<div class="mb-2">
				<p class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">
					Quality Settings
				</p>
				<p class="text-xs text-gray-400">
					Allows you to customize the file size stored on your devices.
				</p>
			</div>

			<MenuStepper
				label="Max Height (0 = Ignore; 200 Recommended):"
				bind:value={maxHeight}
				min={0}
			/>
			<MenuStepper label="Max Width (0 = Ignore; 200 Recommended):" bind:value={maxWidth} min={0} />

			<MenuSlider
				label="Quality (Between 0 and 1; 0.5 Recommended):"
				bind:value={quality}
				min={0}
				max={1}
				step={0.1}
				displayValue="{quality.toFixed(1)} (0-1)"
			/>
		</div>
	</div>
</div>
