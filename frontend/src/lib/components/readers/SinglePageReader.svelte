<script lang="ts">
	import type { ReaderState } from '$lib/states/ReaderState.svelte';
	import type { MokuroBlock, MokuroPage } from '$lib/types';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import CachedImage from '$lib/components/CachedImage.svelte';
	import OcrOverlay from '$lib/components/ocr/OcrOverlay.svelte';
	import { panzoom } from '$lib/actions/panzoom';

	let {
		reader,
		panzoomInstance = $bindable(),
		navZoneWidth,

		// Pass-through props for OcrOverlay
		showTriggerOutline,
		onOcrChange,
		onLineFocus,
		onOcrChangeMode
	} = $props<{
		reader: ReaderState;
		panzoomInstance: PanzoomObject | null;
		navZoneWidth: number;
		showTriggerOutline: boolean;
		onOcrChange: () => void;
		onLineFocus: (block: MokuroBlock | null, page: MokuroPage | null) => void;
		onOcrChangeMode: (state: 'READ' | 'BOX' | 'TEXT') => void;
	}>();

	// Navigation handlers derived from reading direction
	const handleClickLeft = () => {
		reader.readingDirection === 'rtl' ? reader.nextPage() : reader.prevPage();
	};

	const handleClickRight = () => {
		reader.readingDirection === 'rtl' ? reader.prevPage() : reader.nextPage();
	};
</script>

<button
	onclick={handleClickLeft}
	type="button"
	class="panzoom-exclude absolute left-0 z-10 h-full hover:cursor-pointer bg-transparent border-none p-0"
	aria-label="Previous Page"
	style={`width: ${navZoneWidth}%`}
></button>

<div
	class="relative flex h-full flex-1 items-center justify-center"
	use:panzoom={{
		options: {
			canvas: true,
			maxScale: 10,
			cursor: 'default',
			origin: '50% 50%',
			disableYAxis: false
		},
		onInit: (pz) => (panzoomInstance = pz)
	}}
>
	{#if reader.visiblePages[0]}
		{@const page = reader.visiblePages[0]}
		<div
			class="relative flex-shrink-0 shadow-2xl"
			style={`aspect-ratio: ${page.img_width} / ${page.img_height}; height: 100%;`}
		>
			<CachedImage src={`/api/files/volume/${reader.id}/image/${page.img_path}`} />
			<OcrOverlay
				{page}
				{panzoomInstance}
				ocrMode={reader.ocrMode}
				isSmartResizeMode={reader.isSmartResizeMode}
				{showTriggerOutline}
				readingDirection={reader.readingDirection}
				{onOcrChange}
				{onLineFocus}
				onChangeMode={onOcrChangeMode}
			/>
		</div>
	{/if}
</div>

<button
	onclick={handleClickRight}
	type="button"
	class="panzoom-exclude absolute right-0 z-10 h-full hover:cursor-pointer bg-transparent border-none p-0"
	aria-label="Next Page"
	style={`width: ${navZoneWidth}%`}
></button>
