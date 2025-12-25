<script lang="ts">
	import { goto } from '$app/navigation';
	import { readerState } from '$lib/states/ReaderState.svelte';
	import FontSizeSlider from '$lib/components/FontSizeSlider.svelte';
	import { fade } from 'svelte/transition';

	// --- Props ---
	let { settingsOpen = $bindable() } = $props<{
		settingsOpen: boolean;
	}>();

	// --- Local State ---
	let headerForceVisible = $state(false); // Matches original logic where hover handles mouse, this handles touch override
	let headerTimer: ReturnType<typeof setTimeout> | null = null;

	// Font Slider State
	let isFontSizeOpen = $state(false);
	let fontSizePos = $state({ x: 0, y: 0 });

	let headerIsVisible = $derived(
		!readerState.hideHUD || headerForceVisible || isFontSizeOpen || readerState.isSaving
	);

	// --- Handlers ---
	const toggleFontSlider = (e: MouseEvent) => {
		e.stopPropagation();
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();

		fontSizePos = {
			x: rect.left - 80,
			y: rect.bottom + 10
		};
		isFontSizeOpen = !isFontSizeOpen;
	};
</script>

<header
	class="absolute top-0 left-0 right-0 z-40 flex h-12 items-center justify-between px-4
  text-white touch-none transition-opacity duration-300 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
	class:opacity-0={!headerIsVisible}
	onpointerenter={(e) => {
		if (e.pointerType === 'mouse') headerForceVisible = true;
	}}
	onpointerleave={(e) => {
		if (e.pointerType === 'mouse') headerForceVisible = false;
	}}
	onpointerup={(e: PointerEvent) => {
		// Make header visible on touch devices
		if (e.pointerType !== 'mouse') {
			setTimeout(() => {
				headerForceVisible = true;
			}, 100);
			if (headerTimer) clearTimeout(headerTimer); // Clear any old timer just in case

			headerTimer = setTimeout(() => {
				headerForceVisible = false;
				headerTimer = null;
			}, 4000);
		}
	}}
>
	<div class="flex-1 justify-start overflow-hidden">
		<button
			disabled={!headerIsVisible}
			onclick={(e) => {
				e.stopPropagation();
				goto(`/series/${readerState.seriesId}`);
			}}
			class="group flex items-center gap-2 pr-4 text-theme-secondary hover:text-theme-primary transition-colors"
		>
			<div class="p-2 rounded-xl group-hover:bg-white/10 transition-colors">
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
					class="transition-transform group-hover:-translate-x-1"
				>
					<path d="m15 18-6-6 6-6" />
				</svg>
			</div>
			<span class="text-sm font-medium hidden sm:inline">Back to Series</span>
		</button>
	</div>

	<div class="flex-1 flex justify-center">
		{#if readerState.ocrMode === 'TEXT' && readerState.focusedBlock}
			<div class="relative">
				<button
					onclick={toggleFontSlider}
					class="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group"
					title="Change Font Size"
				>
					<span
						class="text-[10px] font-bold text-theme-secondary uppercase tracking-wider group-hover:text-theme-primary"
						>Size</span
					>
					<span class="text-sm font-bold text-white min-w-[1.5rem] text-center">
						{readerState.focusedBlock.font_size?.toFixed(0) ?? 16}
					</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-theme-secondary"
					>
						<path d="m6 9 6 6 6-6" />
					</svg>
				</button>

				<FontSizeSlider
					bind:isOpen={isFontSizeOpen}
					block={readerState.focusedBlock}
					position={fontSizePos}
					onOcrChange={() => readerState.onOcrChange()}
				/>
			</div>
		{:else if readerState.isSaving}
			<div
				transition:fade
				class="flex items-center z-50 gap-2 px-3 py-1.5 rounded-full bg-blue-500/50 text-blue-200 border border-blue-500/30"
			>
				<svg class="animate-spin h-3 w-3" viewBox="0 0 24 24"
					><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle><path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path></svg
				>
				<span class="text-xs font-bold">Saving...</span>
			</div>
		{:else if readerState.saveSuccess}
			<div
				transition:fade
				class="flex items-center z-50 gap-2 px-3 py-1.5 rounded-full bg-emerald-500/50 text-emerald-200 border border-emerald-500/30"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
				>
				<span class="text-xs font-bold">Saved!</span>
			</div>
		{/if}
	</div>

	<div class="flex flex-1 justify-end gap-2 items-center">
		<span
			class="hidden sm:flex items-center flex-nowrap whitespace-nowrap px-3 py-1 mr-2
        rounded-xl bg-black/20 border border-white/5 text-xs font-medium text-theme-primary font-mono"
		>
			<span class="mr-1">
				{readerState.currentPageIndex + 1}{readerState.visiblePages.length === 2
					? `-${readerState.currentPageIndex + 2}`
					: ''}
			</span>
			<span>/ {readerState.totalPages}</span>
		</span>

		{#if readerState.hasUnsavedChanges}
			<button
				onclick={(e) => {
					e.stopPropagation();
					readerState.saveOcr();
				}}
				disabled={readerState.isSaving || !headerIsVisible}
				class="p-2 rounded-xl text-theme-secondary hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors relative group"
				title="Save OCR"
			>
				<div
					class="absolute top-2 right-2 w-2 h-2 rounded-full bg-status-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]"
				></div>
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
					><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline
						points="17 21 17 13 7 13 7 21"
					/><polyline points="7 3 7 8 15 8" /></svg
				>
			</button>
		{/if}

		<button
			disabled={!headerIsVisible}
			onclick={(e) => {
				e.stopPropagation();
				readerState.toggleSmartResizeMode();
			}}
			class={`p-2 rounded-xl transition-all duration-200 ${
				readerState.isSmartResizeMode
					? 'bg-amber-500 text-black shadow-lg shadow-amber-500/25'
					: 'text-theme-secondary hover:text-white hover:bg-white/10'
			}`}
			title="Smart Resize Mode"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 256 256"
				fill="currentColor"
				><path
					d="M208 144a15.78 15.78 0 0 1-10.42 14.94l-51.65 19l-19 51.61a15.92 15.92 0 0 1-29.88 0L78 178l-51.62-19a15.92 15.92 0 0 1 0-29.88l51.65-19l19-51.61a15.92 15.92 0 0 1 29.88 0l19 51.65l51.61 19A15.78 15.78 0 0 1 208 144Zm-56-96h16v16a8 8 0 0 0 16 0V48h16a8 8 0 0 0 0-16h-16V16a8 8 0 0 0-16 0v16h-16a8 8 0 0 0 0 16Zm88 32h-8v-8a8 8 0 0 0-16 0v8h-8a8 8 0 0 0 0 16h8v8a8 8 0 0 0 16 0v-8h8a8 8 0 0 0 0-16Z"
				/></svg
			>
		</button>

		<button
			disabled={!headerIsVisible}
			onclick={(e) => {
				e.stopPropagation();
				readerState.setOcrMode(readerState.ocrMode === 'BOX' ? 'READ' : 'BOX');
			}}
			class={`p-2 rounded-xl transition-all duration-200 ${
				readerState.ocrMode !== 'READ'
					? 'bg-accent text-white shadow-lg shadow-accent/25'
					: 'text-theme-secondary hover:text-white hover:bg-white/10'
			}`}
			title={readerState.ocrMode === 'READ' ? 'Enter Edit Mode' : 'Exit Edit Mode'}
		>
			{#if readerState.ocrMode === 'BOX'}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path
						d="M23 15h-2v2h2v-2zm0-4h-2v2h2v-2zm0 8h-2v2c1 0 2-1 2-2zM15 3h-2v2h2V3zm8 4h-2v2h2V7zm-2-4v2h2c0-1-1-2-2-2zM3 21h8v-6H1v4c0 1.1.9 2 2 2zM3 7H1v2h2V7zm12 12h-2v2h2v-2zm4-16h-2v2h2V3zm0 16h-2v2h2v-2zM3 3C2 3 1 4 1 5h2V3zm0 8H1v2h2v-2zm8-8H9v2h2V3zM7 3H5v2h2V3z"
					/></svg
				>
			{:else if readerState.ocrMode === 'TEXT'}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="currentColor"><path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" /></svg
				>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="currentColor"
					><path
						d="M3 17.46v3.04c0 .28.22.5.5.5h3.04c.13 0 .26-.05.35-.15L17.81 9.94l-3.75-3.75L3.15 17.1c-.1.1-.15.22-.15.36zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83l3.75 3.75l1.83-1.83z"
					/></svg
				>
			{/if}
		</button>

		<button
			disabled={!headerIsVisible}
			onclick={(e) => {
				e.stopPropagation();
				settingsOpen = true;
			}}
			class="p-2 rounded-xl text-theme-secondary hover:text-white hover:bg-white/10 transition-colors"
			title="Settings"
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
				<path
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<circle cx="12" cy="12" r="3" />
			</svg>
		</button>
	</div>
</header>
