<script lang="ts">
	import type { MokuroPage } from '$lib/types';
	// These are the props this component accepts
	let {
		isOpen = $bindable(false),
		layoutMode,
		readingDirection,
		doublePageOffset,
		retainZoom,
		currentPageIndex,
		totalPages,
		currentPages,
		volumeTitle,
		showTriggerOutline,
		navZoneWidth,
		onToggleLayout,
		onToggleDirection,
		onToggleOffset,
		onToggleZoom,
		onToggleTriggerOutline,
		onNavZoneChange,

		isEditMode,
		isBoxEditMode,
		onToggleEditMode,
		onToggleBoxEditMode
	} = $props<{
		isOpen: boolean;
		layoutMode: 'single' | 'double';
		readingDirection: 'ltr' | 'rtl';
		doublePageOffset: 'even' | 'odd';
		retainZoom: boolean;
		currentPageIndex: number;
		totalPages: number;
		currentPages: MokuroPage[];
		volumeTitle: string;
		showTriggerOutline: boolean;
		navZoneWidth: number;
		onToggleLayout: () => void;
		onToggleDirection: () => void;
		onToggleOffset: () => void;
		onToggleZoom: () => void;
		onToggleTriggerOutline: () => void;
		onNavZoneChange: (e: Event) => void;

		isEditMode: boolean;
		isBoxEditMode: boolean;
		onToggleEditMode: () => void;
		onToggleBoxEditMode: () => void;
	}>();
</script>

{#if isOpen}
	<button
		onclick={() => (isOpen = false)}
		type="button"
		class="fixed inset-0 z-30 h-full w-full cursor-auto bg-black/50"
		aria-label="Close settings"
	></button>

	<div class="fixed right-0 top-0 z-40 h-full w-72 bg-gray-900 p-6 text-white shadow-lg">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold">Settings</h2>
			<button
				onclick={() => (isOpen = false)}
				type="button"
				class="text-gray-400 hover:text-gray-300"
				aria-label="Close settings"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<div class="mt-4 space-y-2 border-b border-gray-700 pb-4">
			<div>
				<span class="font-semibold">Volume:</span>
				<span class="text-gray-300"> {volumeTitle}</span>
			</div>
			<div>
				<span class="font-semibold">Page:</span>
				<span class="text-gray-300">
					{`${currentPageIndex + 1}${currentPages.length == 2 ? `-${currentPageIndex + 2}` : ''}`} /
					{totalPages}
				</span>
			</div>
		</div>

		<div class="mt-6 space-y-4">
			<button
				onclick={onToggleLayout}
				type="button"
				class="flex w-full justify-between rounded-md p-3 text-left"
				class:bg-indigo-600={layoutMode === 'double'}
				class:bg-gray-700={layoutMode === 'single'}
			>
				<span>Page Layout</span>
				<span class="font-bold uppercase">
					{layoutMode}
				</span>
			</button>

			<button
				onclick={onToggleDirection}
				type="button"
				class="flex w-full justify-between rounded-md p-3 text-left"
				class:bg-indigo-600={readingDirection === 'rtl'}
				class:bg-gray-700={readingDirection === 'ltr'}
			>
				<span>Direction</span>
				<span class="font-bold uppercase">
					{readingDirection}
				</span>
			</button>

			<button
				onclick={onToggleOffset}
				type="button"
				class="flex w-full justify-between rounded-md p-3 text-left"
				class:bg-indigo-600={doublePageOffset === 'odd'}
				class:bg-gray-700={doublePageOffset === 'even'}
			>
				<span>Cover Offset</span>
				<span class="font-bold capitalize">
					{doublePageOffset}
				</span>
			</button>

			<button
				onclick={onToggleZoom}
				type="button"
				class="flex w-full justify-between rounded-md p-3 text-left"
				class:bg-indigo-600={retainZoom}
				class:bg-gray-700={!retainZoom}
			>
				<span>Retain Zoom</span>
				<span class="font-bold capitalize">
					{retainZoom ? 'On' : 'Off'}
				</span>
			</button>

			<button
				onclick={onToggleTriggerOutline}
				type="button"
				class="flex w-full justify-between rounded-md p-3 text-left"
				class:bg-indigo-600={showTriggerOutline}
				class:bg-gray-700={!showTriggerOutline}
			>
				<span>Trigger Box Outline</span>
				<span class="font-bold uppercase">
					{showTriggerOutline ? 'ON' : 'OFF'}
				</span>
			</button>

			<div class="space-y-2 rounded-md bg-gray-700 p-3">
				<label for="navZoneWidth" class="flex justify-between text-sm">
					<span>Nav Zone Width</span>
					<span class="font-bold">{navZoneWidth}%</span>
				</label>
				<input
					type="range"
					id="navZoneWidth"
					min="10"
					max="50"
					step="1"
					value={navZoneWidth}
					oninput={onNavZoneChange}
					class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600 accent-indigo-600"
				/>
			</div>

			<button
				onclick={onToggleEditMode}
				type="button"
				class="flex w-full justify-between rounded-md p-3 text-left"
				class:bg-indigo-600={isEditMode}
				class:bg-gray-700={!isEditMode}
			>
				<span>OCR Edit Mode</span>
				<span class="font-bold uppercase">
					{isEditMode ? 'ON' : 'OFF'}
				</span>
			</button>

			<button
				onclick={onToggleBoxEditMode}
				type="button"
				class="flex w-full justify-between rounded-md p-3 text-left"
				class:bg-indigo-600={isBoxEditMode}
				class:bg-gray-700={!isBoxEditMode}
			>
				<span>OCR Edit Mode (Box)</span>
				<span class="font-bold uppercase">
					{isBoxEditMode ? 'ON' : 'OFF'}
				</span>
			</button>
		</div>
	</div>
{/if}
