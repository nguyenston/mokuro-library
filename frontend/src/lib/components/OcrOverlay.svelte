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
</script>

<div class="absolute top-0 left-0 h-full w-full" bind:this={overlayRootElement}>
	{#each page.blocks as block, blockIndex}
		{@const box_x_min = (block.box[0] / page.img_width) * 100}
		{@const box_y_min = (block.box[1] / page.img_height) * 100}
		{@const box_width = ((block.box[2] - block.box[0]) / page.img_width) * 100}
		{@const box_height = ((block.box[3] - block.box[1]) / page.img_height) * 100}

		<div
			class="absolute group transition-shadow panzoom-exclude"
			style={`
        left: ${box_x_min}%;
        top: ${box_y_min}%;
        width: ${box_width}%;
        height: ${box_height}%;
      `}
			onmousedown={(e) => handleBlockDragStart(e, block)}
			role={isBoxEditMode ? 'button' : undefined}
		>
			<div
				class={`
          ${showTriggerOutline ? 'border-green-500/70' : 'border-transparent'}
          absolute top-0 left-0 h-full w-full border transition-opacity
        `}
			>
				<div
					class={`
            ${false ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
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
                transition-opacity leading-none
              `}
							class:vertical-text={block.vertical}
							style={`
              left: ${relative_x_min}%;
              top: ${relative_y_min}%;
              width: ${width}%;
              height: ${height}%;
              background-color: ${isEditMode ? 'rgba(239, 68, 68, 0.5)' : 'transparent'}; /* Red background only in edit mode */
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
		text-align: center;

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

	/* Vertical Text Cursor (UX improvement for edit mode) */
	.vertical-text[readonly='false'] {
		cursor: ns-resize; /* North-South resize pointer for vertical text */
	}
</style>
