<script lang="ts">
	import type { MokuroPage, MokuroBlock } from '$lib/types';

	let { page, isEditMode, isBoxEditMode, showTriggerOutline, onOcrChange } = $props<{
		page: MokuroPage;
		isEditMode: boolean;
		isBoxEditMode: boolean;
		showTriggerOutline: boolean;
		onOcrChange: () => void; // callback to indicate orc data change
	}>();

	const wrapDotSequences = (text: string) => {
		const ellipsisGlyph = '\u2026';
		// Regex Explanation:
		// ([\.．]{2,}): Matches two or more consecutive occurrences of
		//              EITHER the ASCII period (\.) OR the Fullwidth Full Stop (．).
		// g: Global flag to match all occurrences in the string.
		const regex = /([\.．]{2,})/g;

		// Replace the matched dot sequence ($&) with the span wrapper.
		return text.replace(regex, ellipsisGlyph);
	};

	/**
	 * Gets the scale ratio of rendered pixels to image pixels.
	 * Uses your corrected logic of measuring the parentElement.
	 */
	//stable reference to the root element, should be the same size as the view port
	let overlayRootElement: HTMLDivElement | null = $state(null);
	const getScaleRatios = () => {
		if (!overlayRootElement?.parentElement) {
			return { scaleRatioX: 1, scaleRatioY: 1 };
		}
		// This rect is the size of the image container as rendered
		// in the viewport (e.g., 800px wide)
		const rect = overlayRootElement.parentElement.getBoundingClientRect();

		// page.img_width is the original image file width (e.g., 2400px)
		const scaleRatioX = page.img_width / rect.width;
		const scaleRatioY = page.img_height / rect.height;

		return { scaleRatioX, scaleRatioY };
	};

	/**
	 * Handles dragging the *entire block* (outer container).
	 */
	const handleBlockDragStart = (startEvent: MouseEvent, block: MokuroBlock) => {
		if (!isBoxEditMode) return;
		startEvent.preventDefault();
		startEvent.stopPropagation();

		const { scaleRatioX, scaleRatioY } = getScaleRatios();
		const draggedElement = startEvent.currentTarget as HTMLDivElement;

		let totalScreenDeltaX = 0;
		let totalScreenDeltaY = 0;
		let totalImageDeltaX = 0;
		let totalImageDeltaY = 0;

		const handleDragMove = (moveEvent: MouseEvent) => {
			totalScreenDeltaX += moveEvent.movementX;
			totalScreenDeltaY += moveEvent.movementY;
			draggedElement.style.transform = `translate(${totalScreenDeltaX}px, ${totalScreenDeltaY}px)`;

			totalImageDeltaX += moveEvent.movementX * scaleRatioX;
			totalImageDeltaY += moveEvent.movementY * scaleRatioY;
		};

		const handleDragEnd = () => {
			window.removeEventListener('mousemove', handleDragMove);
			window.removeEventListener('mouseup', handleDragEnd);
			draggedElement.style.transform = '';

			// Update the block box
			block.box[0] += totalImageDeltaX;
			block.box[1] += totalImageDeltaY;
			block.box[2] += totalImageDeltaX;
			block.box[3] += totalImageDeltaY;

			// ALSO update all associated lines_coords
			for (const lineCoords of block.lines_coords) {
				for (const coord of lineCoords) {
					coord[0] += totalImageDeltaX;
					coord[1] += totalImageDeltaY;
				}
			}

			onOcrChange();
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};

	/**
	 * Handles dragging an *individual line* (inner red div).
	 */
	const handleLineDragStart = (startEvent: MouseEvent, block: MokuroBlock, lineIndex: number) => {
		if (!isBoxEditMode) return;
		startEvent.preventDefault();
		startEvent.stopPropagation(); // <-- Stops block drag

		const { scaleRatioX, scaleRatioY } = getScaleRatios();
		const draggedElement = startEvent.currentTarget as HTMLDivElement;

		let totalScreenDeltaX = 0;
		let totalScreenDeltaY = 0;
		let totalImageDeltaX = 0;
		let totalImageDeltaY = 0;

		const handleDragMove = (moveEvent: MouseEvent) => {
			totalScreenDeltaX += moveEvent.movementX;
			totalScreenDeltaY += moveEvent.movementY;
			draggedElement.style.transform = `translate(${totalScreenDeltaX}px, ${totalScreenDeltaY}px)`;

			totalImageDeltaX += moveEvent.movementX * scaleRatioX;
			totalImageDeltaY += moveEvent.movementY * scaleRatioY;
		};

		const handleDragEnd = () => {
			window.removeEventListener('mousemove', handleDragMove);
			window.removeEventListener('mouseup', handleDragEnd);
			draggedElement.style.transform = '';

			// Update *only* the specific line's coords
			const lineCoords = block.lines_coords[lineIndex];
			for (const coord of lineCoords) {
				coord[0] += totalImageDeltaX;
				coord[1] += totalImageDeltaY;
			}

			onOcrChange();
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};

	/**
	 * Handles resizing the *entire block*.
	 */
	const handleResizeStart = (startEvent: MouseEvent, block: MokuroBlock, handleType: string) => {
		if (!isBoxEditMode) return;
		startEvent.preventDefault();
		startEvent.stopPropagation();

		const { scaleRatioX, scaleRatioY } = getScaleRatios();

		const handleDragMove = (moveEvent: MouseEvent) => {
			const imageDeltaX = moveEvent.movementX * scaleRatioX;
			const imageDeltaY = moveEvent.movementY * scaleRatioY;

			// Update block.box based on which handle is being dragged
			switch (handleType) {
				case 'top-left':
					block.box[0] += imageDeltaX; // x_min
					block.box[1] += imageDeltaY; // y_min
					break;
				case 'top-center':
					block.box[1] += imageDeltaY; // y_min
					break;
				case 'top-right':
					block.box[2] += imageDeltaX; // x_max
					block.box[1] += imageDeltaY; // y_min
					break;
				case 'middle-left':
					block.box[0] += imageDeltaX; // x_min
					break;
				case 'middle-right':
					block.box[2] += imageDeltaX; // x_max
					break;
				case 'bottom-left':
					block.box[0] += imageDeltaX; // x_min
					block.box[3] += imageDeltaY; // y_max
					break;
				case 'bottom-center':
					block.box[3] += imageDeltaY; // y_max
					break;
				case 'bottom-right':
					block.box[2] += imageDeltaX; // x_max
					block.box[3] += imageDeltaY; // y_max
					break;
			}
		};

		const handleDragEnd = () => {
			window.removeEventListener('mousemove', handleDragMove);
			window.removeEventListener('mouseup', handleDragEnd);
			onOcrChange(); // Fire change event once
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};

	/**
	 * Handles resizing an *individual line*.
	 */
	const handleLineResizeStart = (
		startEvent: MouseEvent,
		block: MokuroBlock,
		lineIndex: number,
		handleType: string
	) => {
		if (!isBoxEditMode) return;
		startEvent.preventDefault();
		startEvent.stopPropagation(); // Stop line drag, block drag, and block resize

		const { scaleRatioX, scaleRatioY } = getScaleRatios();
		const lineCoords = block.lines_coords[lineIndex];

		const handleDragMove = (moveEvent: MouseEvent) => {
			const imageDeltaX = moveEvent.movementX * scaleRatioX;
			const imageDeltaY = moveEvent.movementY * scaleRatioY;

			// lineCoords is [top-left, top-right, bottom-right, bottom-left]
			switch (handleType) {
				case 'top-left':
					lineCoords[0][0] += imageDeltaX; // top-left x
					lineCoords[0][1] += imageDeltaY; // top-left y
					lineCoords[1][1] += imageDeltaY; // top-right y
					lineCoords[3][0] += imageDeltaX; // bottom-left x
					break;
				case 'top-center':
					lineCoords[0][1] += imageDeltaY; // top-left y
					lineCoords[1][1] += imageDeltaY; // top-right y
					break;
				case 'top-right':
					lineCoords[1][0] += imageDeltaX; // top-right x
					lineCoords[1][1] += imageDeltaY; // top-right y
					lineCoords[0][1] += imageDeltaY; // top-left y
					lineCoords[2][0] += imageDeltaX; // bottom-right x
					break;
				case 'middle-left':
					lineCoords[0][0] += imageDeltaX; // top-left x
					lineCoords[3][0] += imageDeltaX; // bottom-left x
					break;
				case 'middle-right':
					lineCoords[1][0] += imageDeltaX; // top-right x
					lineCoords[2][0] += imageDeltaX; // bottom-right x
					break;
				case 'bottom-left':
					lineCoords[3][0] += imageDeltaX; // bottom-left x
					lineCoords[3][1] += imageDeltaY; // bottom-left y
					lineCoords[0][0] += imageDeltaX; // top-left x
					lineCoords[2][1] += imageDeltaY; // bottom-right y
					break;
				case 'bottom-center':
					lineCoords[2][1] += imageDeltaY; // bottom-right y
					lineCoords[3][1] += imageDeltaY; // bottom-left y
					break;
				case 'bottom-right':
					lineCoords[2][0] += imageDeltaX; // bottom-right x
					lineCoords[2][1] += imageDeltaY; // bottom-right y
					lineCoords[1][0] += imageDeltaX; // top-right x
					lineCoords[3][1] += imageDeltaY; // bottom-left y
					break;
			}
		};

		const handleDragEnd = () => {
			window.removeEventListener('mousemove', handleDragMove);
			window.removeEventListener('mouseup', handleDragEnd);
			onOcrChange(); // Fire change event once
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};
</script>

<div class="absolute top-0 left-0 h-full w-full" bind:this={overlayRootElement}>
	{#each page.blocks as block, blockIndex}
		{@const box_x_min = (block.box[0] / page.img_width) * 100}
		{@const box_y_min = (block.box[1] / page.img_height) * 100}
		{@const box_width = ((block.box[2] - block.box[0]) / page.img_width) * 100}
		{@const box_height = ((block.box[3] - block.box[1]) / page.img_height) * 100}

		<div
			class="absolute group/block transition-shadow panzoom-exclude"
			style={`
        left: ${box_x_min}%;
        top: ${box_y_min}%;
        width: ${box_width}%;
        height: ${box_height}%;
      `}
			onmousedown={(e) => handleBlockDragStart(e, block)}
			role={isBoxEditMode ? 'button' : undefined}
		>
			<!-- MODIFIED: Added resize handles -->
			{#if isBoxEditMode}
				<!-- Top-Left -->
				<div
					class="absolute -left-1 -top-1 z-10 h-2 w-2 cursor-nwse-resize rounded-full bg-blue-500 opacity-0 group-hover/block:opacity-100"
					onmousedown={(e) => handleResizeStart(e, block, 'top-left')}
					role={isBoxEditMode ? 'button' : undefined}
				></div>
				<!-- Top-Center -->
				<div
					class="absolute -top-1 left-1/2 z-10 h-2 w-2 -translate-x-1/2 cursor-ns-resize rounded-full bg-blue-500 opacity-0 group-hover/block:opacity-100"
					onmousedown={(e) => handleResizeStart(e, block, 'top-center')}
					role={isBoxEditMode ? 'button' : undefined}
				></div>
				<!-- Top-Right -->
				<div
					class="absolute -right-1 -top-1 z-10 h-2 w-2 cursor-nesw-resize rounded-full bg-blue-500 opacity-0 group-hover/block:opacity-100"
					onmousedown={(e) => handleResizeStart(e, block, 'top-right')}
					role={isBoxEditMode ? 'button' : undefined}
				></div>
				<!-- Middle-Left -->
				<div
					class="absolute -left-1 top-1/2 z-10 h-2 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-blue-500 opacity-0 group-hover/block:opacity-100"
					onmousedown={(e) => handleResizeStart(e, block, 'middle-left')}
					role={isBoxEditMode ? 'button' : undefined}
				></div>
				<!-- Middle-Right -->
				<div
					class="absolute -right-1 top-1/2 z-10 h-2 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-blue-500 opacity-0 group-hover/block:opacity-100"
					onmousedown={(e) => handleResizeStart(e, block, 'middle-right')}
					role={isBoxEditMode ? 'button' : undefined}
				></div>
				<!-- Bottom-Left -->
				<div
					class="absolute -bottom-1 -left-1 z-10 h-2 w-2 cursor-nesw-resize rounded-full bg-blue-500 opacity-0 group-hover/block:opacity-100"
					onmousedown={(e) => handleResizeStart(e, block, 'bottom-left')}
					role={isBoxEditMode ? 'button' : undefined}
				></div>
				<!-- Bottom-Center -->
				<div
					class="absolute -bottom-1 left-1/2 z-10 h-2 w-2 -translate-x-1/2 cursor-ns-resize rounded-full bg-blue-500 opacity-0 group-hover/block:opacity-100"
					onmousedown={(e) => handleResizeStart(e, block, 'bottom-center')}
					role={isBoxEditMode ? 'button' : undefined}
				></div>
				<!-- Bottom-Right -->
				<div
					class="absolute -bottom-1 -right-1 z-10 h-2 w-2 cursor-nwse-resize rounded-full bg-blue-500 opacity-0 group-hover/block:opacity-100"
					onmousedown={(e) => handleResizeStart(e, block, 'bottom-right')}
					role={isBoxEditMode ? 'button' : undefined}
				></div>
			{/if}
			<div
				class={`
          ${showTriggerOutline ? 'border-green-500/70' : 'border-transparent'}
          absolute top-0 left-0 h-full w-full border transition-opacity
        `}
			>
				<div
					class={`
            ${false ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'}
            ${isBoxEditMode ? 'bg-transparent' : 'bg-white'}
            relative h-full w-full
          `}
					class:vertical-text={block.vertical}
					bind:this={block.domElement}
					oncontextmenu={(e) => {
						if (!isEditMode) {
							e.preventDefault();
						}
					}}
					role="group"
				>
					{#each block.lines as line, lineIndex}
						{@const coords = block.lines_coords[lineIndex]}

						{@const relative_x_min =
							((coords[0][0] - block.box[0]) / (block.box[2] - block.box[0])) * 100}
						{@const relative_y_min =
							((coords[0][1] - block.box[1]) / (block.box[3] - block.box[1])) * 100}
						{@const relative_x_max =
							((coords[2][0] - block.box[0]) / (block.box[2] - block.box[0])) * 100}
						{@const relative_y_max =
							((coords[2][1] - block.box[1]) / (block.box[3] - block.box[1])) * 100}
						{@const width = relative_x_max - relative_x_min}
						{@const height = relative_y_max - relative_y_min}

						<div
							class={`
                ${isEditMode ? 'border-red-500/70' : 'border-transparent'}
                absolute border p-0 m-0 text-black placeholder-transparent 
                transition-opacity leading-none group/line
              `}
							class:vertical-text={block.vertical}
							style={`
              left: ${relative_x_min}%;
              top: ${relative_y_min}%;
              width: ${width}%;
              height: ${height}%;
              background-color: ${isEditMode || isBoxEditMode ? 'rgba(239, 68, 68, 0.5)' : 'transparent'}; /* Red background only in edit mode */
              cursor: ${isEditMode ? 'text' : 'pointer'}; 
              font-size: calc(calc(90vh / ${page.img_height}) * ${block.font_size});
              font-weight: bold;
              white-space: nowrap;
              user-select: text;
            `}
							contenteditable={isEditMode}
							role={isEditMode ? 'textbox' : isBoxEditMode ? 'button' : undefined}
							onblur={(e) => {
								block.lines[lineIndex] = (e.currentTarget as HTMLDivElement).innerText;
								onOcrChange();
							}}
							onmousedown={(e) => handleLineDragStart(e, block, lineIndex)}
						>
							<!-- ADDED: Inner Line Resize Handles -->
							{#if isBoxEditMode}
								<div
									class="absolute -left-0.5 -top-0.5 z-20 h-1.5 w-1.5 cursor-nwse-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
									onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'top-left')}
									role={isBoxEditMode ? 'button' : undefined}
								></div>
								<div
									class="absolute -top-0.5 left-1/2 z-20 h-1.5 w-1.5 -translate-x-1/2 cursor-ns-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
									onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'top-center')}
									role={isBoxEditMode ? 'button' : undefined}
								></div>
								<div
									class="absolute -right-0.5 -top-0.5 z-20 h-1.5 w-1.5 cursor-nesw-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
									onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'top-right')}
									role={isBoxEditMode ? 'button' : undefined}
								></div>
								<div
									class="absolute -left-0.5 top-1/2 z-20 h-1.5 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
									onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'middle-left')}
									role={isBoxEditMode ? 'button' : undefined}
								></div>
								<div
									class="absolute -right-0.5 top-1/2 z-20 h-1.5 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
									onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'middle-right')}
									role={isBoxEditMode ? 'button' : undefined}
								></div>
								<div
									class="absolute -bottom-0.5 -left-0.5 z-20 h-1.5 w-1.5 cursor-nesw-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
									onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'bottom-left')}
									role={isBoxEditMode ? 'button' : undefined}
								></div>
								<div
									class="absolute -bottom-0.5 left-1/2 z-20 h-1.5 w-1.5 -translate-x-1/2 cursor-ns-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
									onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'bottom-center')}
									role={isBoxEditMode ? 'button' : undefined}
								></div>
								<div
									class="absolute -bottom-0.5 -right-0.5 z-20 h-1.5 w-1.5 cursor-nwse-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
									onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'bottom-right')}
									role={isBoxEditMode ? 'button' : undefined}
								></div>
							{/if}
							{isEditMode ? line : wrapDotSequences(line)}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	/* Vertical Text Flow (Tategaki) */
	.vertical-text {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		display: inline-block;
		line-height: 1;

		/* FIX for Alignment: Forces horizontal centering within the vertical column.
     * This centers fullwidth punctuation marks like U+FF01 and U+2026.
     */
		/* text-align: center; */

		/* Minimal, beneficial font features (keeping only vertical kerning/alternates) */
		font-feature-settings:
			'vpal' on,
			'vkrn' on;

		-webkit-font-feature-settings:
			'vpal' on,
			'vkrn' on;

		-moz-font-feature-settings:
			'vpal' on,
			'vkrn' on;

		/* Ensure a high-quality CJK font is used */
		font-family: 'Noto Sans CJK JP', 'Yu Gothic', sans-serif;
	}
</style>
