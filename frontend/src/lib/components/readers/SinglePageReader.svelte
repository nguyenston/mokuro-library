<script lang="ts">
	import { browser } from '$app/environment';
	import { readerState } from '$lib/states/ReaderState.svelte';
	import type { MokuroBlock, MokuroPage } from '$lib/types';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import CachedImage from '$lib/components/CachedImage.svelte';
	import OcrOverlay from '$lib/components/ocr/OcrOverlay.svelte';
	import { panzoom } from '$lib/actions/panzoom';

	let {
		panzoomInstance = $bindable(),
		navZoneWidth,

		// Pass-through props for OcrOverlay
		showTriggerOutline,
		onOcrChange,
		onLineFocus,
		onOcrChangeMode
	} = $props<{
		panzoomInstance: PanzoomObject | null;
		navZoneWidth: number;
		showTriggerOutline: boolean;
		onOcrChange: () => void;
		onLineFocus: (block: MokuroBlock | null, page: MokuroPage | null) => void;
		onOcrChangeMode: (state: 'READ' | 'BOX' | 'TEXT') => void;
	}>();

	// Navigation handlers derived from reading direction
	const handleClickLeft = () => {
		readerState.readingDirection === 'rtl' ? readerState.nextPage() : readerState.prevPage();
	};

	const handleClickRight = () => {
		readerState.readingDirection === 'rtl' ? readerState.prevPage() : readerState.nextPage();
	};

	function applyReaderSettings() {
		if (!browser) return;
		try {
			const nightEnabled = JSON.parse(localStorage.getItem('mokuro_night_mode_enabled') ?? 'false');
			const scheduleEnabled = JSON.parse(
				localStorage.getItem('mokuro_night_mode_schedule_enabled') ?? 'false'
			);
			const brightness = JSON.parse(localStorage.getItem('mokuro_night_mode_brightness') ?? '100');
			const startHour = JSON.parse(localStorage.getItem('mokuro_night_mode_start_hour') ?? '22');
			const endHour = JSON.parse(localStorage.getItem('mokuro_night_mode_end_hour') ?? '6');

			const invertEnabled = JSON.parse(localStorage.getItem('mokuro_invert_enabled') ?? 'false');
			const invertScheduleEnabled = JSON.parse(
				localStorage.getItem('mokuro_invert_schedule_enabled') ?? 'false'
			);
			const invertIntensity = JSON.parse(localStorage.getItem('mokuro_invert_intensity') ?? '100');
			const invertStart = JSON.parse(localStorage.getItem('mokuro_invert_start_hour') ?? '22');
			const invertEnd = JSON.parse(localStorage.getItem('mokuro_invert_end_hour') ?? '6');

			const now = new Date();
			const h = now.getHours();

			let b = 100;
			if (nightEnabled) {
				let active = true;
				if (scheduleEnabled) {
					active =
						startHour <= endHour ? h >= startHour && h < endHour : h >= startHour || h < endHour;
				}
				if (active) b = brightness;
			}

			let inv = 0;
			let invBright = 100;
			if (invertEnabled) {
				let active = true;
				if (invertScheduleEnabled) {
					active =
						invertStart <= invertEnd
							? h >= invertStart && h < invertEnd
							: h >= invertStart || h < invertEnd;
				}
				if (active) {
					inv = 100;
					invBright = 40 + invertIntensity * 0.6;
				}
			}

			document.documentElement.style.setProperty('--reader-brightness', `${b}%`);
			document.documentElement.style.setProperty('--reader-invert', `${inv}%`);
			document.documentElement.style.setProperty('--reader-invert-brightness', `${invBright}%`);
		} catch (e) {
			console.error('Error applying reader settings', e);
		}
	}

	$effect(() => {
		applyReaderSettings();
		const interval = setInterval(applyReaderSettings, 60000);
		return () => clearInterval(interval);
	});

	function handleZoneClick(e: MouseEvent) {
		// If text is selected, don't navigate
		if (window.getSelection()?.toString()) return;

		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const width = rect.width;
		const percent = (x / width) * 100;

		if (percent <= navZoneWidth) {
			handleClickLeft();
		} else if (percent >= 100 - navZoneWidth) {
			handleClickRight();
		}
	}
</script>

<div class="relative h-full w-full flex flex-col" onclick={handleZoneClick} role="presentation">
	<div
		class="panzoom-exclude absolute left-0 z-10 h-full bg-accent transition-opacity duration-200 pointer-events-none"
		style={`width: ${navZoneWidth}%; opacity: var(--nav-zone-opacity, 0);`}
	></div>

	<div
		class="relative flex h-full flex-1 items-center justify-center"
		use:panzoom={{
			options: {
				canvas: true,
				maxScale: 10,
				minScale: 0.5,
				cursor: 'default',
				origin: '50% 50%',
				disableYAxis: false
			},
			onInit: (pz) => (panzoomInstance = pz)
		}}
	>
		{#if readerState.visiblePages[0]}
			{@const page = readerState.visiblePages[0]}
			<div
				class="relative flex-shrink-0 shadow-2xl reader-page"
				style={`aspect-ratio: ${page.img_width} / ${page.img_height}; height: 100%;`}
			>
				<CachedImage src={`/api/files/volume/${readerState.id}/image/${page.img_path}`} />
				<OcrOverlay
					{page}
					{panzoomInstance}
					ocrMode={readerState.ocrMode}
					isSmartResizeMode={readerState.isSmartResizeMode}
					{showTriggerOutline}
					readingDirection={readerState.readingDirection}
					{onOcrChange}
					{onLineFocus}
					onChangeMode={onOcrChangeMode}
				/>
			</div>
		{/if}
	</div>

	<div
		class="panzoom-exclude absolute right-0 z-10 h-full bg-accent transition-opacity duration-200 pointer-events-none"
		style={`width: ${navZoneWidth}%; opacity: var(--nav-zone-opacity, 0);`}
	></div>
</div>

<style>
	.reader-page {
		filter: brightness(var(--reader-brightness, 100%))
			brightness(var(--reader-invert-brightness, 100%)) invert(var(--reader-invert, 0%));
	}
</style>
