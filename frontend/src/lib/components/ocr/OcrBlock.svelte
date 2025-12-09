<script lang="ts">
	import { tick } from 'svelte';
	import type { MokuroBlock } from '$lib/types';
	import { contextMenu, type MenuOption } from '$lib/contextMenuStore';
	import { lineOrderStore } from '$lib/lineOrderStore';
	import { getDeltas, smartResizeFont, getRelativeCoords } from '$lib/utils/ocrMath';
	import type { OcrState } from '$lib/states/OcrState.svelte';

	import OcrLine from './OcrLine.svelte';
	import ResizeHandles from './ResizeHandles.svelte';
	import TouchToggle from '$lib/components/TouchToggle.svelte';
	import { preventDefault } from 'svelte/legacy';

	// --- Props ---
	let { block, ocrState, onDelete } = $props<{
		block: MokuroBlock;
		ocrState: OcrState;
		onDelete: () => void;
	}>();

	// --- Local State ---
	let isHovered = $state(false);
	let blockElement: HTMLDivElement | undefined = $state();

	// Registry of child line components for focus management
	// We use a Map or Array to store bound references
	let lineComponents: Record<number, any> = $state({});

	// --- Derived Styles ---
	let geometry = $derived.by(() => {
		// Safety check
		if (ocrState.imgWidth === 0 || ocrState.imgHeight === 0) {
			return { left: 0, top: 0, width: 0, height: 0 };
		}

		const x_min = (block.box[0] / ocrState.imgWidth) * 100;
		const y_min = (block.box[1] / ocrState.imgHeight) * 100;
		const width = ((block.box[2] - block.box[0]) / ocrState.imgWidth) * 100;
		const height = ((block.box[3] - block.box[1]) / ocrState.imgHeight) * 100;

		return { x_min, y_min, width, height };
	});

	// --- Interactions ---

	// 1. Block Drag
	const handleBlockDragStart = (startEvent: MouseEvent) => {
		if (ocrState.ocrMode === 'TEXT') ocrState.setMode('BOX');
		if (!ocrState.overlayElement || !blockElement) return;
		startEvent.preventDefault();
		startEvent.stopPropagation();

		let totalScreenDeltaX = 0;
		let totalScreenDeltaY = 0;
		let totalImageDeltaX = 0;
		let totalImageDeltaY = 0;

		const handleDragMove = (moveEvent: MouseEvent) => {
			// 1. Visual Update (Screen Space)
			const currentZoom = ocrState.panzoomInstance?.getScale() ?? 1.0;
			totalScreenDeltaX += moveEvent.movementX / currentZoom / window.devicePixelRatio;
			totalScreenDeltaY += moveEvent.movementY / currentZoom / window.devicePixelRatio;

			if (blockElement) {
				blockElement.style.transform = `translate(${totalScreenDeltaX}px, ${totalScreenDeltaY}px)`;
			}

			// 2. Data Calculation (Image Space)
			const { imageDeltaX, imageDeltaY } = getDeltas(
				moveEvent,
				ocrState.overlayElement!,
				ocrState.imgWidth,
				ocrState.imgHeight
			);
			totalImageDeltaX += imageDeltaX;
			totalImageDeltaY += imageDeltaY;
		};

		const handleDragEnd = () => {
			window.removeEventListener('mousemove', handleDragMove);
			window.removeEventListener('mouseup', handleDragEnd);

			// Reset Transform
			if (blockElement) {
				blockElement.style.transform = '';
			}

			// Commit Data Changes
			const box = block.box; // circumvent mutation warning
			box[0] += totalImageDeltaX;
			box[1] += totalImageDeltaY;
			box[2] += totalImageDeltaX;
			box[3] += totalImageDeltaY;

			// Update Children
			for (const lineCoords of block.lines_coords) {
				for (const coord of lineCoords) {
					coord[0] += totalImageDeltaX;
					coord[1] += totalImageDeltaY;
				}
			}

			ocrState.markDirty();
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};

	// 2. Block Resize
	const handleResizeStart = (startEvent: MouseEvent, handleType: string) => {
		if (ocrState.ocrMode !== 'BOX' || !ocrState.overlayElement) return;
		startEvent.preventDefault();
		startEvent.stopPropagation();

		const handleDragMove = (moveEvent: MouseEvent) => {
			const { imageDeltaX, imageDeltaY } = getDeltas(
				moveEvent,
				ocrState.overlayElement!,
				ocrState.imgWidth,
				ocrState.imgHeight
			);

			const box = block.box; // circumvent mutation warning
			switch (handleType) {
				case 'top-left':
					box[0] += imageDeltaX;
					box[1] += imageDeltaY;
					break;
				case 'top-center':
					box[1] += imageDeltaY;
					break;
				case 'top-right':
					box[2] += imageDeltaX;
					box[1] += imageDeltaY;
					break;
				case 'middle-left':
					box[0] += imageDeltaX;
					break;
				case 'middle-right':
					box[2] += imageDeltaX;
					break;
				case 'bottom-left':
					box[0] += imageDeltaX;
					box[3] += imageDeltaY;
					break;
				case 'bottom-center':
					box[3] += imageDeltaY;
					break;
				case 'bottom-right':
					box[2] += imageDeltaX;
					box[3] += imageDeltaY;
					break;
			}
		};

		const handleDragEnd = () => {
			window.removeEventListener('mousemove', handleDragMove);
			window.removeEventListener('mouseup', handleDragEnd);
			ocrState.markDirty();
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};

	// 3. Child Line Actions (Bubbled Up)

	const handleSplit = async (index: number, textBefore: string, textAfter: string) => {
		// 1. Update current line
		block.lines[index] = textBefore;

		// 2. Calculate Geometry for new line (Simple heuristic: place below or next to)
		const GAP = 2;
		const oldCoords = block.lines_coords[index];
		const width = oldCoords[1][0] - oldCoords[0][0];
		const height = oldCoords[3][1] - oldCoords[0][1];

		// Simple offset logic based on verticality
		let newX = oldCoords[0][0];
		let newY = oldCoords[0][1];

		if (block.vertical) {
			// Assuming RTL for vertical typically, but let's just stick to "next to it"
			// Logic from original: check readingDirection or default to Left shift?
			// Original used `readingDirection` global. We'll default to left-shift for vertical (standard manga).
			newX = oldCoords[0][0] - width - GAP;
		} else {
			newY = oldCoords[0][1] + height + GAP;
		}

		const newCoords: [[number, number], [number, number], [number, number], [number, number]] = [
			[newX, newY],
			[newX + width, newY],
			[newX + width, newY + height],
			[newX, newY + height]
		];

		// 3. Insert new data
		block.lines.splice(index + 1, 0, textAfter);
		block.lines_coords.splice(index + 1, 0, newCoords);

		ocrState.markDirty();
		await tick();

		// 4. Focus new line
		lineComponents[index + 1]?.focus();
	};

	const handleMerge = async (index: number, text: string) => {
		if (index === 0) return;

		// 1. Capture the length of the previous line BEFORE the merge.
		// This is where the caret should go.
		const prevLength = block.lines[index - 1].length;

		// 2. Perform Data Merge
		block.lines[index - 1] += text;
		block.lines.splice(index, 1);
		block.lines_coords.splice(index, 1);

		ocrState.markDirty();
		await tick();

		// 3. Focus and Set Caret
		const prevComponent = lineComponents[index - 1];
		if (prevComponent) {
			prevComponent.focus();
			prevComponent.setCaret(prevLength);
		}
	};

	const handleNavigate = (
		e: KeyboardEvent,
		index: number,
		dir: 'up' | 'down' | 'left' | 'right',
		offset: number
	) => {
		let targetIndex = -1;

		// Map visual direction to logical index based on writing mode
		if (!block.vertical) {
			if (dir === 'up') targetIndex = index - 1;
			if (dir === 'down') targetIndex = index + 1;
		} else {
			// Vertical Text (RTL flow is standard for manga)
			// Right Arrow -> Previous Line (Index - 1)
			// Left Arrow -> Next Line (Index + 1)
			if (dir === 'left') targetIndex = index + 1;
			if (dir === 'right') targetIndex = index - 1;
			// We ignore Up/Down for line switching in vertical mode (it moves cursor within line)
		}

		if (targetIndex < 0 || targetIndex >= block.lines.length) return;
		e.preventDefault();
		const targetComponent = lineComponents[targetIndex];
		const targetLineLength = block.lines[targetIndex].length;
		const clampedOffset = Math.min(offset, targetLineLength);
		// Set the caret position within the element, this also focuses the element
		targetComponent?.setCaret(clampedOffset);
	};

	const handleSmartResize = (targetElement: HTMLElement) => {
		// Execute the math utility on THIS block
		smartResizeFont(block, targetElement, ocrState.imgWidth, ocrState.fontScale);
		ocrState.markDirty();
	};

	// 4. Block-Level Mutations
	const toggleVertical = () => {
		block.vertical = !block.vertical;
		ocrState.markDirty();
	};

	const deleteLine = (index: number) => {
		if (block.lines.length <= 1) {
			// If it's the last line, delete the whole block
			onDelete();
		} else {
			block.lines.splice(index, 1);
			block.lines_coords.splice(index, 1);
			ocrState.markDirty();
		}
	};
	// --- Keyboard Shortcuts (Ctrl+A) ---
	const handleWindowKeydown = (e: KeyboardEvent) => {
		if (!isHovered) return;
		if (ocrState.ocrMode !== 'READ') return; // Only in Reader/Neutral mode

		if (e.ctrlKey && e.key === 'a') {
			e.preventDefault();
			// Select all text in this block
			const selection = window.getSelection();
			if (selection && blockElement) {
				selection.removeAllRanges();
				const range = document.createRange();
				range.selectNodeContents(blockElement);
				selection.addRange(range);
			}
		}
	};

	const handleAddLine = (e: MouseEvent) => {
		if (!ocrState.overlayElement) return;

		// 1. Get relative image coordinates
		const { imgX, imgY } = getRelativeCoords(
			e,
			ocrState.overlayElement,
			ocrState.imgWidth,
			ocrState.imgHeight
		);

		const DEFAULT_WIDTH = 100;
		const DEFAULT_HEIGHT = 100;

		// 2. Create the box (Standard Mokuro 4-point polygon)
		const newBox: [[number, number], [number, number], [number, number], [number, number]] = [
			[imgX, imgY],
			[imgX + DEFAULT_WIDTH, imgY],
			[imgX + DEFAULT_WIDTH, imgY + DEFAULT_HEIGHT],
			[imgX, imgY + DEFAULT_HEIGHT]
		];

		// 3. Mutate
		block.lines.push('New Text');
		block.lines_coords.push(newBox);

		ocrState.markDirty();
	};

	// --- Context Menu ---
	const handleContextMenu = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const options = [] as MenuOption[];

		if (ocrState.ocrMode !== 'READ') {
			options.push({ label: 'Add Line', action: () => handleAddLine(e) });
			options.push({ separator: true });
			options.push({
				label: 'Re-order Lines...',
				action: () => lineOrderStore.open(block, ocrState.onOcrChange)
			});
			options.push({ label: 'Delete Block', action: onDelete });
		}

		if (options.length > 0) contextMenu.open(e.clientX, e.clientY, options);
	};

	// Callback Context Menu Logic for Lines
	const handleLineContextMenuAction = (action: 'delete' | 'toggle-vertical', lineIndex: number) => {
		if (action === 'delete') deleteLine(lineIndex);
		if (action === 'toggle-vertical') toggleVertical();
	};
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div
	class="absolute group/block transition-shadow panzoom-exclude"
	style:left="{geometry.x_min}%"
	style:top="{geometry.y_min}%"
	style:width="{geometry.width}%"
	style:height="{geometry.height}%"
	style:pointer-events="auto"
	bind:this={blockElement}
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
	onmousedown={handleBlockDragStart}
	oncontextmenu={handleContextMenu}
	role="textbox"
	tabindex="-1"
>
	{#if ocrState.ocrMode === 'BOX'}
		<ResizeHandles variant="block" onResizeStart={handleResizeStart} />
	{/if}

	<TouchToggle
		class="relative h-full w-full"
		forceVisible={ocrState.ocrMode === 'BOX' ||
			(ocrState.ocrMode === 'TEXT' &&
				(isHovered || ocrState.focusedBlock === block || $contextMenu.isOpen))}
		mode="overlay"
	>
		{#snippet trigger()}
			<div
				class="absolute top-0 left-0 h-full w-full border transition-opacity z-1"
				class:border-green-500={ocrState.showTriggerOutline}
				class:border-transparent={!ocrState.showTriggerOutline}
			></div>
		{/snippet}

		<div
			class="relative h-full w-full p-0"
			class:vertical-text={block.vertical}
			class:bg-transparent={ocrState.ocrMode !== 'READ'}
			class:bg-white={ocrState.ocrMode !== 'BOX' && ocrState.ocrMode !== 'TEXT'}
		>
			{#each block.lines as line, i}
				<OcrLine
					bind:this={lineComponents[i]}
					line={block.lines[i]}
					coords={block.lines_coords[i]}
					lineIndex={i}
					blockBox={block.box}
					isVertical={block.vertical ?? false}
					fontSize={block.font_size ?? 12}
					{ocrState}
					onSplit={handleSplit}
					onMerge={handleMerge}
					onNavigate={handleNavigate}
					onSmartResizeRequest={handleSmartResize}
					onFocusRequest={(el) => {
						ocrState.setFocus(block);
						// Optional: update global active element tracking if needed
					}}
					onLineChange={(newText) => {
						// This function is necessary because block.lines[i] is passed by value
						const line = block.lines; // circumvent warning
						line[i] = newText;
						/* Note: ocrState.markDirty() is called by the Line component */
					}}
					onCoordChange={(newCoords) => {
						const coords = block.lines_coords[i]; // circumvent mutation warning
						for (let j = 0; j < coords.length; j++) {
							const coord = coords[j];
							coord[0] = newCoords[j][0];
							coord[1] = newCoords[j][1];
						}
					}}
					onDeleteRequest={() => deleteLine(i)}
					onToggleVerticalRequest={toggleVertical}
					onReorderRequest={() => lineOrderStore.open(block, ocrState.onOcrChange)}
				/>
			{/each}
		</div>
	</TouchToggle>
</div>

<style>
	.vertical-text {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		font-feature-settings:
			'vhal' 1,
			'locl' 1;
	}
</style>
