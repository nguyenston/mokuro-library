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
		onSetLayout,
		onToggleDirection,
		onToggleOffset,
		onToggleZoom,
		onToggleTriggerOutline,
		onNavZoneChange
	} = $props<{
		isOpen: boolean;
		layoutMode: 'single' | 'double' | 'vertical';
		readingDirection: 'ltr' | 'rtl';
		doublePageOffset: 'even' | 'odd';
		retainZoom: boolean;
		currentPageIndex: number;
		totalPages: number;
		currentPages: MokuroPage[];
		volumeTitle: string;
		showTriggerOutline: boolean;
		navZoneWidth: number;
		onSetLayout: (mode: 'single' | 'double' | 'vertical') => void;
		onToggleDirection: () => void;
		onToggleOffset: () => void;
		onToggleZoom: () => void;
		onToggleTriggerOutline: () => void;
		onNavZoneChange: (e: Event) => void;
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
				class="text-gray-400 hover:text-gray-300 cursor-pointer"
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
			<div>
				<div class="mt-2 grid grid-cols-3 gap-1 rounded-md bg-gray-700 p-1">
					<button
						onclick={() => onSetLayout('single')}
						type="button"
						title="Layout Single"
						class="rounded py-2 px-3 flex items-center justify-center cursor-pointer"
						class:bg-indigo-600={layoutMode === 'single'}
						class:bg-gray-700={layoutMode !== 'single'}
						class:hover:bg-gray-600={layoutMode !== 'single'}
					>
						<!-- single page icon -->
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16">
							<path
								fill="currentColor"
								d="M5.5 5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5M5.5 9a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1z"
							/>
							<path
								fill="currentColor"
								fill-rule="evenodd"
								d="M3 4.4c0-.84 0-1.26.163-1.58c.144-.282.373-.512.656-.656c.321-.163.741-.163 1.58-.163h5.2c.84 0 1.26 0 1.58.163c.282.144.512.373.656.656c.164.321.164.741.164 1.58v7.2c0 .84 0 1.26-.164 1.58a1.5 1.5 0 0 1-.656.656c-.321.163-.741.163-1.58.163h-5.2c-.84 0-1.26 0-1.58-.163a1.5 1.5 0 0 1-.656-.656C3 12.859 3 12.439 3 11.6zM5.4 3h5.2c.436 0 .704 0 .904.017a1.3 1.3 0 0 1 .216.034l.008.003a.5.5 0 0 1 .22.227l.01.032c.008.034.017.09.025.184c.016.2.017.467.017.904v7.2c0 .437 0 .704-.017.904a1.3 1.3 0 0 1-.034.216l-.003.007a.5.5 0 0 1-.218.218l-.008.004l-.032.009c-.034.008-.09.017-.184.025c-.2.016-.467.017-.904.017H5.4c-.437 0-.704 0-.904-.017a1.3 1.3 0 0 1-.216-.034l-.007-.004a.5.5 0 0 1-.218-.218l-.004-.007l-.009-.032a1 1 0 0 1-.025-.184c-.016-.2-.017-.467-.017-.904V4.4c0-.437 0-.704.017-.904a1.3 1.3 0 0 1 .034-.216l.004-.008a.5.5 0 0 1 .218-.219l.007-.003l.032-.009a1 1 0 0 1 .184-.025c.2-.016.467-.017.904-.017"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
					<button
						onclick={() => onSetLayout('double')}
						type="button"
						title="Layout Double"
						class="rounded py-2 px-3 flex items-center justify-center cursor-pointer"
						class:bg-indigo-600={layoutMode === 'double'}
						class:bg-gray-700={layoutMode !== 'double'}
						class:hover:bg-gray-600={layoutMode !== 'double'}
					>
						<!-- double page icon -->
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16">
							<path
								fill="currentColor"
								d="M2 5.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5M2.5 7a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zM2 9.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5M10.5 5a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zM10 7.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m.5 1.5a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1z"
							/>
							<path
								fill="currentColor"
								fill-rule="evenodd"
								d="M0 4.4c0-.84 0-1.26.163-1.58c.144-.282.373-.512.656-.656c.321-.163.741-.163 1.58-.163h3.2c.84 0 1.26 0 1.58.163c.282.144.512.373.656.656c.163.321.163.741.163 1.58c0-.84 0-1.26.163-1.58c.144-.282.373-.512.656-.656c.321-.163.741-.163 1.58-.163h3.2c.84 0 1.26 0 1.58.163c.282.144.512.373.656.656c.164.321.164.741.164 1.58v7.2c0 .84 0 1.26-.164 1.58a1.5 1.5 0 0 1-.656.656c-.321.163-.741.163-1.58.163h-3.2c-.84 0-1.26 0-1.58-.163a1.5 1.5 0 0 1-.656-.656c-.163-.321-.163-.741-.163-1.58c0 .84 0 1.26-.163 1.58a1.5 1.5 0 0 1-.656.656c-.321.163-.741.163-1.58.163h-3.2c-.84 0-1.26 0-1.58-.163a1.5 1.5 0 0 1-.656-.656C0 12.859 0 12.439 0 11.6zM2.4 3h3.2c.437 0 .704 0 .904.017a1.3 1.3 0 0 1 .216.034l.007.003a.5.5 0 0 1 .222.227l.009.032c.008.034.017.09.025.184c.016.2.017.467.017.904v7.2c0 .437 0 .704-.017.904a1.3 1.3 0 0 1-.034.216l-.004.007a.5.5 0 0 1-.218.218l-.007.004l-.032.009c-.034.008-.09.017-.184.025c-.2.016-.467.017-.904.017H2.4c-.437 0-.704 0-.904-.017a1.3 1.3 0 0 1-.216-.034l-.007-.004a.5.5 0 0 1-.218-.218l-.004-.007l-.009-.032a1 1 0 0 1-.025-.184c-.016-.2-.017-.467-.017-.904V4.4c0-.437 0-.704.017-.904a1.3 1.3 0 0 1 .034-.216l.004-.008a.5.5 0 0 1 .218-.219l.007-.003l.032-.009a1 1 0 0 1 .184-.025c.2-.016.467-.017.904-.017m8 0h3.2c.436 0 .704 0 .904.017a1.3 1.3 0 0 1 .216.034l.008.003a.5.5 0 0 1 .22.227l.01.032c.008.034.017.09.025.184c.016.2.017.467.017.904v7.2c0 .437 0 .704-.017.904a1.3 1.3 0 0 1-.034.216l-.003.007a.5.5 0 0 1-.218.218l-.008.004l-.032.009c-.034.008-.09.017-.184.025c-.2.016-.467.017-.904.017h-3.2c-.437 0-.704 0-.904-.017a1.3 1.3 0 0 1-.216-.034l-.007-.004a.5.5 0 0 1-.218-.218l-.004-.007l-.009-.032a1 1 0 0 1-.025-.184c-.016-.2-.017-.467-.017-.904V4.4c0-.437 0-.704.017-.904a1.3 1.3 0 0 1 .034-.216l.004-.008a.5.5 0 0 1 .218-.219l.007-.003l.032-.009a1 1 0 0 1 .184-.025c.2-.016.467-.017.904-.017"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
					<button
						onclick={() => onSetLayout('vertical')}
						type="button"
						title="Layout Vertical"
						class="rounded py-2 px-3 flex items-center justify-center cursor-pointer"
						class:bg-indigo-600={layoutMode === 'vertical'}
						class:bg-gray-700={layoutMode !== 'vertical'}
						class:hover:bg-gray-600={layoutMode !== 'vertical'}
					>
						<!-- vertical page icon -->
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16">
							<path
								fill="currentColor"
								d="M5 .5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 .5"
							/>
							<path
								fill="currentColor"
								d="M3 0H2v3.8c0 1.12 0 1.68.218 2.11c.192.376.498.682.874.874c.428.218.988.218 2.11.218h5.6c1.12 0 1.68 0 2.11-.218c.376-.192.682-.498.874-.874c.218-.428.218-.988.218-2.11V0h-1v3.8c0 .577 0 .95-.024 1.23c-.022.272-.06.372-.085.422a1 1 0 0 1-.437.437c-.05.025-.15.063-.422.085c-.283.024-.656.024-1.23.024h-5.6c-.577 0-.949 0-1.23-.024c-.272-.022-.372-.06-.422-.085a1 1 0 0 1-.437-.437c-.025-.05-.063-.15-.085-.422a17 17 0 0 1-.024-1.23V0zm11 16v-3.8c0-1.12 0-1.68-.218-2.11a2 2 0 0 0-.874-.874c-.428-.218-.988-.218-2.11-.218h-5.6c-1.12 0-1.68 0-2.11.218a2 2 0 0 0-.874.874c-.218.428-.218.988-.218 2.11V16h1v-3.8c0-.576 0-.949.024-1.23c.022-.272.06-.372.085-.422c.096-.188.249-.341.437-.437c.05-.025.15-.063.422-.085c.283-.023.656-.024 1.23-.024h5.6c.577 0 .949 0 1.23.024c.272.022.372.06.422.085c.188.096.341.249.437.437c.025.05.063.15.085.422c.023.283.024.656.024 1.23V16h1z"
							/>
							<path
								fill="currentColor"
								d="M5 12.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m.5 2.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zm0-12a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1z"
							/>
						</svg>
					</button>
				</div>
			</div>
			{#if layoutMode === 'double'}
				<button
					onclick={onToggleDirection}
					type="button"
					class="flex w-full justify-between rounded-md p-3 text-left cursor-pointer"
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
					class="flex w-full justify-between rounded-md p-3 text-left cursor-pointer"
					class:bg-indigo-600={doublePageOffset === 'odd'}
					class:bg-gray-700={doublePageOffset === 'even'}
				>
					<span>Cover Offset</span>
					<span class="font-bold uppercase">
						{doublePageOffset}
					</span>
				</button>
			{/if}
			{#if layoutMode !== 'vertical'}
				<button
					onclick={onToggleZoom}
					type="button"
					class="flex w-full justify-between rounded-md p-3 text-left cursor-pointer"
					class:bg-indigo-600={retainZoom}
					class:bg-gray-700={!retainZoom}
				>
					<span>Retain Zoom</span>
					<span class="font-bold capitalize">
						{retainZoom ? 'ON' : 'OFF'}
					</span>
				</button>
			{/if}

			<button
				onclick={onToggleTriggerOutline}
				type="button"
				class="flex w-full justify-between rounded-md p-3 text-left cursor-pointer"
				class:bg-indigo-600={showTriggerOutline}
				class:bg-gray-700={!showTriggerOutline}
			>
				<span>OCR Outline</span>
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
					min="1"
					max="50"
					step="1"
					value={navZoneWidth}
					oninput={onNavZoneChange}
					class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600 accent-indigo-600"
				/>
			</div>
		</div>
	</div>
{/if}
