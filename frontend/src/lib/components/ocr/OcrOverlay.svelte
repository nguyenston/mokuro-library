<script lang="ts">
	import type { MokuroPage, MokuroBlock } from '$lib/types';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import { contextMenu } from '$lib/contextMenuStore';
	import { OcrState } from '$lib/states/OcrState.svelte';
	import { getRelativeCoords, getScaleRatios } from '$lib/utils/ocrMath';

	import OcrBlock from './OcrBlock.svelte';

	// --- Props ---
	let {
		page,
		panzoomInstance,
		ocrMode,
		isSmartResizeMode,
		showTriggerOutline,
		readingDirection,
		onOcrChange,
		onLineFocus,
		onChangeMode
	} = $props<{
		page: MokuroPage;
		panzoomInstance: PanzoomObject | null;
		ocrMode: 'READ' | 'BOX' | 'TEXT';
		isSmartResizeMode: boolean;
		showTriggerOutline: boolean;
		readingDirection: string;
		onOcrChange: () => void;
		onLineFocus: (block: MokuroBlock | null, page: MokuroPage | null) => void;
		onChangeMode: (state: 'READ' | 'BOX' | 'TEXT') => void;
	}>();

	// --- State Initialization ---
	// We use a singleton state class for this tree.
	// We pass the references. Since `page` and `panzoomInstance` can change,
	// we need to keep the state object updated.

	const ocrState = new OcrState({
		onOcrChange: () => onOcrChange(),
		onLineFocus: (b, p) => onLineFocus(b, p),
		onChangeMode: (m) => onChangeMode(m)
	});

	// Sync props to state (One-way flow mainly)
	$effect(() => {
		ocrState.page = page;
		ocrState.panzoomInstance = panzoomInstance;
		ocrState.isSmartResizeMode = isSmartResizeMode;
		ocrState.showTriggerOutline = showTriggerOutline;
		ocrState.readingDirection = readingDirection;
		// Callbacks are stable, no need to sync usually, but handled in constructor
	});

	// Sync prop, isolated because this is affected by onChangeMode
	$effect(() => {
		ocrState.ocrMode = ocrMode;
	});

	// --- Actions ---

	const handleOverlayClick = (e: MouseEvent) => {
		// Only act on clicks directly on the background (not bubbling from block)
		if (e.target !== e.currentTarget) return;

		// Blur focus if clicking empty space
		if (ocrMode === 'TEXT') {
			ocrState.setFocus(null);
			ocrState.setMode('BOX');
		}

		// Clear Selection
		const selection = window.getSelection();
		if (selection) selection.removeAllRanges();
	};

	const handleCreateBlock = (event: MouseEvent) => {
		if (!ocrState.overlayElement || !page.blocks) return;

		// 1. Get click position (Image Coordinates)
		const { imgX, imgY } = getRelativeCoords(
			event,
			ocrState.overlayElement,
			page.img_width,
			page.img_height
		);

		// 2. Calculate dynamic size (15% of viewport)
		// We need scale ratios to convert "Viewport Pixels" -> "Image Pixels"
		const { scaleRatioX, scaleRatioY } = getScaleRatios(
			ocrState.overlayElement,
			page.img_width,
			page.img_height
		);

		const rect = ocrState.overlayElement.parentElement?.getBoundingClientRect();
		if (!rect) return;

		const BOX_WIDTH_VIEWPORT = rect.width * 0.15;
		const BOX_HEIGHT_VIEWPORT = rect.height * 0.15;

		const BOX_WIDTH_IMAGE = BOX_WIDTH_VIEWPORT * scaleRatioX;
		const BOX_HEIGHT_IMAGE = BOX_HEIGHT_VIEWPORT * scaleRatioY;

		// 3. Define default line (90% of box)
		const LINE_WIDTH = BOX_WIDTH_IMAGE * 0.9;
		const LINE_HEIGHT = BOX_HEIGHT_IMAGE * 0.9;

		const newLineCoords: [[number, number], [number, number], [number, number], [number, number]] =
			[
				[imgX - LINE_WIDTH / 2, imgY - LINE_HEIGHT / 2],
				[imgX + LINE_WIDTH / 2, imgY - LINE_HEIGHT / 2],
				[imgX + LINE_WIDTH / 2, imgY + LINE_HEIGHT / 2],
				[imgX - LINE_WIDTH / 2, imgY + LINE_HEIGHT / 2]
			];

		// 4. Create Block Object
		const newBlock: MokuroBlock = {
			box: [
				imgX - BOX_WIDTH_IMAGE / 2, // x_min
				imgY - BOX_HEIGHT_IMAGE / 2, // y_min
				imgX + BOX_WIDTH_IMAGE / 2, // x_max
				imgY + BOX_HEIGHT_IMAGE / 2 // y_max
			],
			lines: ['New Text'],
			lines_coords: [newLineCoords],
			vertical: false,
			font_size: Math.min(page.img_width, page.img_height) / 50 // Default font size heuristic
		};

		page.blocks.push(newBlock);
		ocrState.markDirty();
	};

	const handleDeleteBlock = (blockToDelete: MokuroBlock) => {
		const index = page.blocks.indexOf(blockToDelete);
		if (index > -1) {
			page.blocks.splice(index, 1);
			ocrState.markDirty();
		}
	};

	const handleContextMenu = (event: MouseEvent) => {
		// Only on empty background
		if (event.target !== event.currentTarget) return;

		if (ocrMode !== 'NONE') {
			event.preventDefault();
			event.stopPropagation();

			contextMenu.open(event.clientX, event.clientY, [
				{
					label: 'Add Block',
					action: () => handleCreateBlock(event)
				}
			]);
		}
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="absolute top-0 left-0 h-full w-full ocr-top-layer"
	bind:this={ocrState.overlayElement}
	onclick={handleOverlayClick}
	oncontextmenu={handleContextMenu}
>
	{#each page.blocks as block, i (block)}
		<OcrBlock block={page.blocks[i]} {ocrState} onDelete={() => handleDeleteBlock(block)} />
	{/each}
</div>
