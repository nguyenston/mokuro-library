<script lang="ts">
	import type { MokuroPage, MokuroBlock } from '$lib/types';
	import { contextMenu, type MenuOption } from '$lib/contextMenuStore';
	import { lineOrderStore } from '$lib/lineOrderStore';
	import TouchToggle from '$lib/components/TouchToggle.svelte';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import { tick } from 'svelte';

	let {
		page,
		panzoomInstance,
		isEditMode,
		isBoxEditMode,
		isSmartResizeMode,
		showTriggerOutline,
		readingDirection,
		isSliderHovered,
		onOcrChange,
		onLineFocus
	} = $props<{
		page: MokuroPage;
		panzoomInstance: PanzoomObject | null;
		isEditMode: boolean;
		isBoxEditMode: boolean;
		isSmartResizeMode: boolean;
		showTriggerOutline: boolean;
		readingDirection: string;
		isSliderHovered: boolean;
		onOcrChange: () => void; // callback to indicate orc data change
		onLineFocus: (block: MokuroBlock | null, page: MokuroPage | null) => void; // callback to update the focused block state
	}>();

	// --- States ---
	// current focused mokuroBlock for hovering behavior
	let focusedBlock = $state<MokuroBlock | null>(null);
	let hoveredBlock = $state<MokuroBlock | null>(null);

	//stable reference to the root element, should be the same size as the view port
	let overlayRootElement: HTMLDivElement | null = $state(null);

	// Track the currently focused line div
	let focusedLineElement: HTMLDivElement | null = $state(null);

	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	let fontScale = $derived.by(() => {
		const rect = overlayRootElement?.getBoundingClientRect();
		if (!rect?.height) return 1;
		return rect.height / page.img_height;
	});

	/**
	 * Replaces predetermined sequences with their combined character
	 */
	const ligaturize = (text: string, isVertical: boolean) => {
		const ellipsis = '\u2026'; // vertically centered 1.5em variant: '．\ufe01．\ufe01．\ufe01'
		const doubleExcl = '\u203C';
		const exclQuest = '\u2049';

		const regexes = new Map<RegExp, string>();
		regexes.set(/[\.．。]{2,}/g, ellipsis);
		regexes.set(/[!！]{2,}/g, doubleExcl);
		regexes.set(/[!！][?？]/g, exclQuest);
		let s = text;
		for (const [reg, pattern] of regexes) {
			s = s.replaceAll(reg, pattern);
		}
		return s;
	};

	/**
	 * Automatically set the font of the current block such than
	 * the text fits snug to the current line's box
	 * starts with a small size, then use stepping
	 */
	function smartResizeFont(block: MokuroBlock, lineElement: HTMLElement) {
		if (!lineElement) return;
		if (!lineElement.parentElement) return;

		const isVertical = block.vertical ?? false;

		// 1. Get Target Dimension
		const parentRect = lineElement.parentElement.getBoundingClientRect();
		const targetMeasure = isVertical ? parentRect.height : parentRect.width;

		// 2. Define search range
		const MIN_FONT_SIZE = 8;
		const MAX_FONT_SIZE = page.img_width / 2;

		// 3. Helper function to measure the DOM at a specific size
		const range = document.createRange();
		range.selectNodeContents(lineElement);
		const measure = (size: number): number => {
			lineElement.style.fontSize = `${fontScale * size}px`;
			const rect = lineElement.getBoundingClientRect();
			return isVertical ? rect.height : rect.width;
		};

		// 4. Binary search
		let min = MIN_FONT_SIZE;
		let max = MAX_FONT_SIZE;
		let minMeasure = measure(min);
		let maxMeasure = measure(max);
		let guess = min + ((targetMeasure - minMeasure) / (maxMeasure - minMeasure)) * (max - min);
		let bestGuess = guess;

		for (let i = 0; i < 100; i++) {
			let guessMeasure = measure(guess);
			let delta = targetMeasure - guessMeasure;

			if (delta > 0) {
				min = guess;
				minMeasure = guessMeasure;
				bestGuess = guess;
			}
			if (delta < 0) {
				max = guess;
				maxMeasure = guessMeasure;
			}
			if (max - min < 0.001 || Math.abs(delta) < 0.1) {
				break;
			}

			guess = min + ((targetMeasure - minMeasure) / (maxMeasure - minMeasure)) * (max - min);
		}
		// 5. State Update
		block.font_size = +bestGuess.toFixed(3);
		lineElement.style.fontSize = `${fontScale * block.font_size}px`;

		// 6. Persistence
		onOcrChange();
		// 7. cleanup
		range.detach();
	}

	/**
	 * Gets the scale ratio of rendered pixels to image pixels.
	 * Uses your corrected logic of measuring the parentElement.
	 */
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

		// these two numbers should be the same since aspect ratio is preserved,
		// but better safe than sorry
		return { scaleRatioX, scaleRatioY };
	};

	/**
	 * Gets the real image pixel coordinates from a mouse click event,
	 * accounting for current panzoom scale and offset.
	 */
	const getCoords = (event: MouseEvent) => {
		if (!overlayRootElement?.parentElement || !panzoomInstance) {
			return { imgX: 0, imgY: 0 };
		}

		const { scaleRatioX, scaleRatioY } = getScaleRatios();
		// rect is the page's bounding box, *including* pan and zoom
		const rect = overlayRootElement.parentElement.getBoundingClientRect();

		// 1. Get click position relative to the panned, zoomed container
		const relativeX = event.clientX - rect.left;
		const relativeY = event.clientY - rect.top;

		// 2. Convert container-relative pixels to image-absolute pixels
		const imgX = relativeX * scaleRatioX;
		const imgY = relativeY * scaleRatioY;

		return { imgX, imgY };
	};

	/**
	 * Gets the real image pixel deltas from a mouse move event,
	 * accounting for the current panzoom scale.
	 */
	const getDeltas = (moveEvent: MouseEvent) => {
		// getScaleRatio already accounts for zoom
		const { scaleRatioX, scaleRatioY } = getScaleRatios();

		// 1. Get mouse movement delta, corrected for zoom
		const relativeDeltaX = moveEvent.movementX;
		const relativeDeltaY = moveEvent.movementY;

		// 2. Convert container-relative delta to image-absolute delta
		const imageDeltaX = relativeDeltaX * scaleRatioX;
		const imageDeltaY = relativeDeltaY * scaleRatioY;

		return { imageDeltaX, imageDeltaY };
	};

	/**
	 * Handles dragging the *entire block* (outer container).
	 */
	const handleBlockDragStart = (startEvent: MouseEvent, block: MokuroBlock) => {
		if (!isBoxEditMode) return;
		startEvent.preventDefault();
		startEvent.stopPropagation();

		const draggedElement = startEvent.currentTarget as HTMLDivElement;

		let totalScreenDeltaX = 0;
		let totalScreenDeltaY = 0;
		let totalImageDeltaX = 0;
		let totalImageDeltaY = 0;

		const handleDragMove = (moveEvent: MouseEvent) => {
			const currentZoom = panzoomInstance?.getScale() ?? 1.0;
			totalScreenDeltaX += moveEvent.movementX / currentZoom;
			totalScreenDeltaY += moveEvent.movementY / currentZoom;
			draggedElement.style.transform = `translate(${totalScreenDeltaX}px, ${totalScreenDeltaY}px)`;

			const { imageDeltaX, imageDeltaY } = getDeltas(moveEvent);
			totalImageDeltaX += imageDeltaX;
			totalImageDeltaY += imageDeltaY;
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
		startEvent.stopPropagation(); // Stops block drag

		const draggedElement = startEvent.currentTarget as HTMLDivElement;

		let totalScreenDeltaX = 0;
		let totalScreenDeltaY = 0;
		let totalImageDeltaX = 0;
		let totalImageDeltaY = 0;

		const handleDragMove = (moveEvent: MouseEvent) => {
			const currentZoom = panzoomInstance?.getScale() ?? 1.0;
			totalScreenDeltaX += moveEvent.movementX / currentZoom;
			totalScreenDeltaY += moveEvent.movementY / currentZoom;
			draggedElement.style.transform = `translate(${totalScreenDeltaX}px, ${totalScreenDeltaY}px)`;

			const { imageDeltaX, imageDeltaY } = getDeltas(moveEvent);
			totalImageDeltaX += imageDeltaX;
			totalImageDeltaY += imageDeltaY;
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

		const handleDragMove = (moveEvent: MouseEvent) => {
			const { imageDeltaX, imageDeltaY } = getDeltas(moveEvent);

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

		// 1. Get the handle that was clicked
		const handleElement = startEvent.currentTarget as HTMLElement;
		// 2. Get its parent, which is the group/line div
		const groupLineElement = handleElement.parentElement;
		if (!groupLineElement) return;

		// 3. Find the text element inside the group/line div using the predefined static selector
		const textElement = groupLineElement.querySelector('[data-line-index]') as HTMLElement;
		if (!textElement) return; // Safety check

		const lineCoords = block.lines_coords[lineIndex];

		const handleDragMove = (moveEvent: MouseEvent) => {
			const { imageDeltaX, imageDeltaY } = getDeltas(moveEvent);

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

			if (isSmartResizeMode) {
				// Use the prop
				smartResizeFont(block, textElement);
			}
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};

	/**
	 * Executes a document command (cut, copy, paste) on the focused line.
	 */
	const execCommandOnLine = async (
		command: 'cut' | 'copy' | 'paste',
		block: MokuroBlock,
		lineIndex: number
	) => {
		if (!focusedLineElement) return;
		focusedLineElement.focus(); // just to be double sure

		// Get selection details
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		let range: Range | null = null;
		try {
			range = selection.getRangeAt(0);
		} catch (e) {
			return; // No valid range
		}

		// Ensure the selection is within the focused line
		if (!focusedLineElement.contains(range.commonAncestorContainer)) {
			return;
		}

		try {
			if (command === 'copy') {
				if (range && !range.collapsed) {
					await navigator.clipboard.writeText(selection.toString());
				}
			} else if (command === 'cut') {
				if (range && !range.collapsed) {
					await navigator.clipboard.writeText(selection.toString());
					range.deleteContents(); // Delete the selected text
					// Manually dispatch 'input' event to sync bind:innerText
					focusedLineElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
				}
			} else if (command === 'paste') {
				const textToPaste = await navigator.clipboard.readText();
				if (!textToPaste) return;

				// Replace selection or insert at caret
				range.deleteContents();
				range.insertNode(document.createTextNode(textToPaste));

				// Move caret to end of inserted text
				selection.collapseToEnd();

				// Manually dispatch 'input' event to sync bind:innerText
				focusedLineElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
			}
		} catch (err) {
			console.error(`Clipboard ${command} failed:`, err);
		}
	};

	/**
	 * Toggles the vertical property for the entire block.
	 */
	const toggleVertical = (block: MokuroBlock) => {
		block.vertical = !block.vertical;
		onOcrChange();
	};

	/**
	 * Deletes the entire block from the page.
	 */
	const deleteBlock = (block: MokuroBlock) => {
		if (!page.blocks) return;
		const index = page.blocks.indexOf(block);
		if (index > -1) {
			page.blocks.splice(index, 1);
			onOcrChange();
		}
	};

	/**
	 * Deletes a line from a block.
	 */
	const deleteLine = (block: MokuroBlock, lineIndex: number) => {
		// Check if it's the last line
		if (block.lines.length === 1) {
			deleteBlock(block);
			return; // Stop execution
		}

		block.lines.splice(lineIndex, 1);
		block.lines_coords.splice(lineIndex, 1);
		onOcrChange();
	};

	/**
	 * Creates a new line in a block at the clicked position.
	 */
	const createNewLine = (event: MouseEvent, block: MokuroBlock) => {
		if (!overlayRootElement?.parentElement) return;

		const { imgX, imgY } = getCoords(event);
		if (imgX === undefined) return;

		const DEFAULT_WIDTH = 100;
		const DEFAULT_HEIGHT = 100;

		// The Mokuro spec defines lines_coords as [top-left, top-right, bottom-right, bottom-left]
		const newBox: [[number, number], [number, number], [number, number], [number, number]] = [
			[imgX, imgY], // top-left [0]
			[imgX + DEFAULT_WIDTH, imgY], // top-right [1]
			[imgX + DEFAULT_WIDTH, imgY + DEFAULT_HEIGHT], // bottom-right [2]
			[imgX, imgY + DEFAULT_HEIGHT] // bottom-left [3]
		];

		// Force new text to be editable if we are in Edit Mode, ensuring it has focus
		block.lines.push('New Text');
		block.lines_coords.push(newBox);

		onOcrChange();
	};

	/**
	 * Creates a new block on the page.
	 */
	const createNewBlock = (event: MouseEvent) => {
		if (!overlayRootElement?.parentElement || !page.blocks) return;

		// 1. Get rendered container dimensions and scale ratios
		const rect = overlayRootElement.parentElement.getBoundingClientRect();
		const { scaleRatioX, scaleRatioY } = getScaleRatios();

		// 2. Get click position in image coordinates
		const { imgX, imgY } = getCoords(event);

		// --- 3. Calculate new size based on viewport ---
		// Get 15% of the *rendered* container size
		const BOX_WIDTH_VIEWPORT = rect.width * 0.15;
		const BOX_HEIGHT_VIEWPORT = rect.height * 0.15;

		// Convert the viewport size back to absolute image pixels
		const BOX_WIDTH_IMAGE = BOX_WIDTH_VIEWPORT * scaleRatioX;
		const BOX_HEIGHT_IMAGE = BOX_HEIGHT_VIEWPORT * scaleRatioY;

		// --- 4. Define a default line (e.g., 90% of box width) ---
		const LINE_WIDTH = BOX_WIDTH_IMAGE * 0.9;
		const LINE_HEIGHT = BOX_HEIGHT_IMAGE * 0.9; // Keep line height fixed for now
		const newLineCoords: [[number, number], [number, number], [number, number], [number, number]] =
			[
				[imgX - LINE_WIDTH / 2, imgY - LINE_HEIGHT / 2], // top-left
				[imgX + LINE_WIDTH / 2, imgY - LINE_HEIGHT / 2], // top-right
				[imgX + LINE_WIDTH / 2, imgY + LINE_HEIGHT / 2], // bottom-right
				[imgX - LINE_WIDTH / 2, imgY + LINE_HEIGHT / 2] // bottom-left
			];

		// --- 5. Define the block box surrounding the line ---
		const newBlockBox: [number, number, number, number] = [
			imgX - BOX_WIDTH_IMAGE / 2, // x_min
			imgY - BOX_HEIGHT_IMAGE / 2, // y_min
			imgX + BOX_WIDTH_IMAGE / 2, // x_max
			imgY + BOX_HEIGHT_IMAGE / 2 // y_max
		];

		// --- 6. Create the new block object ---
		const newBlock: MokuroBlock = {
			box: newBlockBox,
			lines: ['New Text'],
			lines_coords: [newLineCoords],
			vertical: false,
			font_size: Math.min(page.img_width, page.img_height) / 10 // Default font size
		};

		page.blocks.push(newBlock);
		onOcrChange();
	};

	/**
	 * Opens the modal for re-ordering lines in the given block.
	 */
	const openLineOrderModal = (block: MokuroBlock) => {
		// Pass the block and the onOcrChange callback to the store
		lineOrderStore.open(block, onOcrChange);
	};

	/**
	 * Opens the context menu for the empty space in page.
	 */
	const openOverlayContextMenu = (event: MouseEvent) => {
		// This logic handles blurring focused text boxes
		if (isEditMode && focusedLineElement && event.target === event.currentTarget) {
			focusedLineElement.blur();
		}

		// This logic opens the "Add Block" menu
		if (isBoxEditMode && event.target === event.currentTarget) {
			event.preventDefault();
			event.stopPropagation();
			contextMenu.open(event.clientX, event.clientY, [
				{
					label: 'Add Block',
					action: () => createNewBlock(event)
				}
			]);
		}
	};

	/**
	 * Opens the context menu for the *outer block*.
	 */
	const openBlockContextMenu = (event: MouseEvent, block: MokuroBlock) => {
		event.preventDefault(); // suppress native context menu at all times
		event.stopPropagation();

		const options: MenuOption[] = [];
		if (isBoxEditMode) {
			options.push({
				label: 'Add Line',
				action: () => createNewLine(event, block)
			});
		}

		if (isBoxEditMode || isEditMode) {
		}

		contextMenu.open(event.clientX, event.clientY, [
			{
				label: 'Re-order Lines...',
				action: () => openLineOrderModal(block)
			}
		]);

		// Open the menu only if we have options to show
		if (options.length > 0) {
			contextMenu.open(event.clientX, event.clientY, options);
			options.push({
				label: 'Re-order Lines...',
				action: () => openLineOrderModal(block)
			});
		}
	};

	/**
	 * Opens the context menu for an individual line.
	 */
	const openLineContextMenu = (event: MouseEvent, block: MokuroBlock, lineIndex: number) => {
		// Stop the browser menu in all modes
		event.preventDefault();
		event.stopPropagation(); // Prevents block context menu

		const options: MenuOption[] = [];
		// At runtime, modern browsers pass a PointerEvent
		const isTouchEvent = (event as PointerEvent).pointerType === 'touch';

		if (isEditMode) {
			// Text Edit Mode options
			if (!isTouchEvent) {
				// Text Edit Mode options (Mouse only)
				options.push({
					label: 'Cut',
					action: async () => await execCommandOnLine('cut', block, lineIndex)
				});
				options.push({
					label: 'Copy',
					action: async () => await execCommandOnLine('copy', block, lineIndex)
				});
				options.push({
					label: 'Paste',
					action: async () => await execCommandOnLine('paste', block, lineIndex)
				});
				options.push({ separator: true });
			}
			options.push({
				label: block.vertical ? 'Set Horizontal' : 'Set Vertical',
				action: () => toggleVertical(block)
			});
		}

		if (isBoxEditMode) {
			if (options.length > 0) {
				// Only add a separator if text options are also present
				options.push({ separator: true });
			}
		}

		// Add re-order and delete options if in *either* edit mode
		if (isEditMode || isBoxEditMode) {
			if (options.length > 0) {
				options.push({ separator: true });
			}
			// Add "Re-order Lines" option
			options.push({
				label: 'Re-order Lines...',
				action: () => openLineOrderModal(block)
			});
			options.push({
				label: 'Delete Line',
				action: () => deleteLine(block, lineIndex)
			});
		}

		// Open the menu only if we have options to show
		if (options.length > 0) {
			contextMenu.open(event.clientX, event.clientY, options);
		}
	};

	/**
	 * Handles clicks on the empty overlay background.
	 */
	const handleOverlayClick = (e: MouseEvent) => {
		// Only act on clicks directly on the background (not a block/line)
		if (e.target !== e.currentTarget) {
			return;
		}
		// Check if in text edit mode, a line is focused,
		// and the click was on the background (target === currentTarget)
		if (isEditMode && focusedLineElement) {
			focusedLineElement.blur();
			return;
		}

		// In Neutral or Box Edit Mode, the goal is to clear any text selection
		const selection = window.getSelection();
		if (selection) {
			selection.removeAllRanges();
		}
	};
	const handleKeydown = (event: KeyboardEvent) => {
		const isNeutralMode = !isEditMode && !isBoxEditMode;

		// Check for Ctrl+A, in neutral mode, and if a block is hovered
		if (event.ctrlKey && event.key === 'a' && isNeutralMode && hoveredBlock?.domElement) {
			// Prevent the default browser action (selecting the entire page)
			event.preventDefault();

			const selection = window.getSelection();
			if (selection) {
				const range = document.createRange();
				// Select all contents of the hovered block's common parent
				range.selectNodeContents(hoveredBlock.domElement);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		}
	};

	/**
	 * Intercepts 'Enter' key to split a line into two.
	 * Helper function for handleLineKeyDown
	 */
	const handleLineSplinter = async (
		event: KeyboardEvent,
		block: MokuroBlock,
		lineIndex: number
	) => {
		if (event.key !== 'Enter') return;

		// 1. Stop the browser from inserting a <br>
		event.preventDefault();

		// 2. Get cursor position and text
		const selection = window.getSelection();
		if (!selection || !selection.anchorNode) return;

		const anchorOffset = selection.anchorOffset;
		const fullText = block.lines[lineIndex];

		// 3. Splinter the text
		const textBefore = fullText.substring(0, anchorOffset);
		const textAfter = fullText.substring(anchorOffset);

		// 4. Update the original line
		block.lines[lineIndex] = textBefore;

		// 5. Calculate new line's position
		const GAP = 2; // 5px gap in image coordinates
		const originalCoords = block.lines_coords[lineIndex];
		const width = originalCoords[1][0] - originalCoords[0][0];
		const height = originalCoords[3][1] - originalCoords[0][1];

		let newTopLeft_X = originalCoords[0][0];
		let newTopLeft_Y = originalCoords[0][1];

		if (block.vertical) {
			if (readingDirection === 'rtl') {
				newTopLeft_X = originalCoords[0][0] - width - GAP; // New box to the left
			} else {
				newTopLeft_X = originalCoords[0][0] + width + GAP; // New box to the right
			}
		} else {
			newTopLeft_Y = originalCoords[0][1] + height + GAP; // New box below
		}

		// 6. Create the new line's coordinates
		const newCoords: [[number, number], [number, number], [number, number], [number, number]] = [
			[newTopLeft_X, newTopLeft_Y], // top-left
			[newTopLeft_X + width, newTopLeft_Y], // top-right
			[newTopLeft_X + width, newTopLeft_Y + height], // bottom-right
			[newTopLeft_X, newTopLeft_Y + height] // bottom-left
		];

		// 7. Insert the new line data into the block
		block.lines.splice(lineIndex + 1, 0, textAfter);
		block.lines_coords.splice(lineIndex + 1, 0, newCoords);

		// 8. Mark as dirty and wait for Svelte to re-render
		onOcrChange();
		await tick();

		// 9. Find the newly created div and focus it
		const parentBlockElement = (event.target as HTMLElement).closest('.group\\/block');
		if (!parentBlockElement) return;

		const newLineElement = parentBlockElement.querySelector(
			`[data-line-index="${lineIndex + 1}"]`
		) as HTMLDivElement;

		if (newLineElement) {
			newLineElement.focus();
		}
	};

	/**
	 * Intercepts 'Backspace' key to merge 2 lines
	 * Helper function for handleLineKeyDown
	 */
	const handleLineMerge = async (event: KeyboardEvent, block: MokuroBlock, lineIndex: number) => {
		if (event.key !== 'Backspace') return;
		if (lineIndex === 0) return;

		// 1. Get cursor position and text
		const selection = window.getSelection();
		if (!selection || !selection.anchorNode) return;

		const anchorOffset = selection.anchorOffset;
		const text = block.lines[lineIndex];
		if (anchorOffset !== 0) return;

		// 2. Stop the browser from default behavior
		event.preventDefault();

		const parentBlockElement = (event.target as HTMLElement).closest('.group\\/block');
		const newOffset = block.lines[lineIndex - 1].length;
		block.lines[lineIndex - 1] += text;
		deleteLine(block, lineIndex);

		await tick();

		// Find the recieving div and focus it, preserve carat location
		if (!parentBlockElement) return;

		const newLineElement = parentBlockElement.querySelector(
			`[data-line-index="${lineIndex - 1}"]`
		) as HTMLDivElement;

		// focus the line before and set cursor to end of line
		if (newLineElement) {
			newLineElement.focus();
			// Get the text node inside the new element
			const textNode = newLineElement.firstChild;
			const newSelection = window.getSelection();
			if (textNode && newSelection) {
				// Create a new range and selection to set the cursor
				newSelection.removeAllRanges();
				newSelection.collapse(textNode, newOffset);
			}
		}
	};

	/**
	 * Jump focused line in edit mode using arrow keys
	 * Helper function for handleLineKeyDown
	 */
	const handleLineNavigation = async (
		event: KeyboardEvent,
		block: MokuroBlock,
		lineIndex: number
	) => {
		const selection = window.getSelection();
		let currentOffset = 0;
		if (selection) {
			currentOffset = selection.anchorOffset;
		}

		let targetLineIndex = -1;

		if (!block.vertical) {
			// Horizontal Block
			if (event.key === 'ArrowUp') {
				targetLineIndex = lineIndex - 1;
			} else if (event.key === 'ArrowDown') {
				targetLineIndex = lineIndex + 1;
			}
		} else {
			// Vertical Block
			if (readingDirection === 'rtl') {
				if (event.key === 'ArrowLeft') {
					targetLineIndex = lineIndex + 1; // "Next" line
				} else if (event.key === 'ArrowRight') {
					targetLineIndex = lineIndex - 1; // "Previous" line
				}
			} else {
				// 'ltr'
				if (event.key === 'ArrowLeft') {
					targetLineIndex = lineIndex - 1; // "Previous" line
				} else if (event.key === 'ArrowRight') {
					targetLineIndex = lineIndex + 1; // "Next" line
				}
			}
		}

		// If a valid target was found, change focus
		if (targetLineIndex >= 0 && targetLineIndex < block.lines.length) {
			// This is a navigation action, so prevent default cursor movement
			event.preventDefault();

			const parentBlockElement = (event.target as HTMLElement).closest('.group\\/block');
			if (!parentBlockElement) return;

			const newLineElement = parentBlockElement.querySelector(
				`[data-line-index="${targetLineIndex}"]`
			) as HTMLDivElement;

			if (newLineElement) {
				newLineElement.focus();
				// Get the text node inside the new element
				const textNode = newLineElement.firstChild;
				const newSelection = window.getSelection();
				if (textNode && newSelection) {
					// Cap the desired offset at the new line's max length
					const newOffset = Math.min(currentOffset, textNode.textContent?.length || 0);

					// Create a new range and selection to set the cursor
					newSelection.removeAllRanges();
					newSelection.collapse(textNode, newOffset);
				}
			}
		}

		// If no target was found (e.g., ArrowLeft on a horizontal line),
		// don't call preventDefault(), and the browser
		// moves the text cursor normally.
	};

	const handleLineKeyDown = async (event: KeyboardEvent, block: MokuroBlock, lineIndex: number) => {
		await handleLineSplinter(event, block, lineIndex);
		await handleLineMerge(event, block, lineIndex);
		handleLineNavigation(event, block, lineIndex);
	};
</script>

<svelte:window
	bind:innerWidth={viewportWidth}
	bind:innerHeight={viewportHeight}
	onkeydown={handleKeydown}
/>
<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="absolute top-0 left-0 h-full w-full ocr-top-layer"
	bind:this={overlayRootElement}
	onclick={handleOverlayClick}
	oncontextmenu={openOverlayContextMenu}
>
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
        pointer-events: auto;
      `}
			onmouseenter={() => (hoveredBlock = block)}
			onmouseleave={() => (hoveredBlock = null)}
			onmousedown={(e) => handleBlockDragStart(e, block)}
			oncontextmenu={(e) => openBlockContextMenu(e, block)}
			role={isBoxEditMode ? 'button' : undefined}
		>
			<!-- Resize handles -->
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
			<TouchToggle
				class={`
        relative h-full w-full
      `}
				forceVisible={(isEditMode || $contextMenu.isOpen) && focusedBlock === block}
				mode="overlay"
			>
				{#snippet trigger()}
					<div
						class={`
              ${showTriggerOutline ? 'border-green-500/70' : 'border-transparent'}
              absolute top-0 left-0 h-full w-full border transition-opacity z-1
            `}
					></div>
				{/snippet}
				<div
					class={`
            ${isBoxEditMode || isEditMode ? 'bg-transparent' : 'bg-white'}
            relative h-full w-full p-0
          `}
					class:vertical-text={block.vertical}
					bind:this={block.domElement}
					role="group"
				>
					{#if !isBoxEditMode && !isEditMode && !isSmartResizeMode}
						<!-- scan mode, allow tools like yomitan to scan across lines -->
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
							<span
								class={`
                  border-transparent border p-0 m-0 background-transparent
                  leading-none z-3
                  inline-flex relative pointer-events-auto
                  ocr-line-text items-center align-top
                `}
								style={`
                  width: ${width}%;
                  height: ${height}%;
                  left: ${(block.vertical ? -100 : 0) + width + relative_x_min}%;
                  top: ${relative_y_min}%;
                  font-size: ${fontScale * block.font_size}px;
                  cursor: ${block.vertical ? 'vertical-text' : 'text'};

                  /* Space Collapse (Mimics Absolute Flow Removal) */
                  margin-bottom: -${block.vertical ? height : 0}%;
                  margin-left: -${block.vertical ? 0 : width}%;

                `}
								oncontextmenu={(e) => openLineContextMenu(e, block, lineIndex)}
							>
								{ligaturize(line, block.vertical)}
							</span>
						{/each}
					{:else}
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
                ${isEditMode || isSmartResizeMode ? 'border-red-500/70' : 'border-transparent'}
                absolute border p-0 m-0 placeholder-transparent
                transition-opacity leading-none z-2 group/line
                flex items-center
              `}
								style={`
                left: ${relative_x_min}%;
                top: ${relative_y_min}%;
                width: ${width}%;
                height: ${height}%;
                background-color: ${isEditMode ? 'rgba(239, 128, 128, 0.85)' : isBoxEditMode ? 'rgba(239, 68, 68, 0.5)' : 'transparent'};
              `}
								role={isBoxEditMode ? 'button' : undefined}
								onmousedown={(e) => handleLineDragStart(e, block, lineIndex)}
								oncontextmenu={(e) => openLineContextMenu(e, block, lineIndex)}
							>
								<!-- Inner Line Resize Handles -->
								{#if isBoxEditMode}
									<div
										class="absolute -left-0.75 -top-0.75 z-20 h-1.5 w-1.5 cursor-nwse-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
										onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'top-left')}
										role={isBoxEditMode ? 'button' : undefined}
									></div>
									<div
										class="absolute -top-0.75 left-1/2 z-20 h-1.5 w-1.5 -translate-x-1/2 cursor-ns-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
										onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'top-center')}
										role={isBoxEditMode ? 'button' : undefined}
									></div>
									<div
										class="absolute -right-0.75 -top-0.75 z-20 h-1.5 w-1.5 cursor-nesw-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
										onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'top-right')}
										role={isBoxEditMode ? 'button' : undefined}
									></div>
									<div
										class="absolute -left-0.75 top-1/2 z-20 h-1.5 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
										onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'middle-left')}
										role={isBoxEditMode ? 'button' : undefined}
									></div>
									<div
										class="absolute -right-0.75 top-1/2 z-20 h-1.5 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
										onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'middle-right')}
										role={isBoxEditMode ? 'button' : undefined}
									></div>
									<div
										class="absolute -bottom-0.75 -left-0.75 z-20 h-1.5 w-1.5 cursor-nesw-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
										onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'bottom-left')}
										role={isBoxEditMode ? 'button' : undefined}
									></div>
									<div
										class="absolute -bottom-0.75 left-1/2 z-20 h-1.5 w-1.5 -translate-x-1/2 cursor-ns-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
										onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'bottom-center')}
										role={isBoxEditMode ? 'button' : undefined}
									></div>
									<div
										class="absolute -bottom-0.75 -right-0.75 z-20 h-1.5 w-1.5 cursor-nwse-resize rounded-full bg-yellow-400 opacity-0 group-hover/line:opacity-100"
										onmousedown={(e) => handleLineResizeStart(e, block, lineIndex, 'bottom-right')}
										role={isBoxEditMode ? 'button' : undefined}
									></div>
								{/if}

								{#if isEditMode}
									<!-- avoid toggle when long pressing onto text in edit mode -->
									<div
										data-ignore-long-press="true"
										data-line-index={lineIndex}
										contenteditable="true"
										role="textbox"
										tabindex="0"
										class="ocr-line-text"
										class:vertical-text={block.vertical}
										style={`
                    cursor: ${block.vertical ? 'vertical-text' : 'text'};
                    font-size: ${fontScale * block.font_size}px;
                  `}
										bind:innerText={block.lines[lineIndex]}
										onkeydown={(e) => handleLineKeyDown(e, block, lineIndex)}
										oninput={() => {
											onOcrChange();
										}}
										onblur={(e) => {
											if (!isSliderHovered) {
												onLineFocus(null, null);
												focusedLineElement = null;
												focusedBlock = null;
											}

											if (isSmartResizeMode) {
												smartResizeFont(block, e.currentTarget as HTMLElement);
											}
										}}
										onfocus={(e) => {
											focusedLineElement = e.currentTarget;
											focusedBlock = block;
											onLineFocus(block, page);
										}}
									></div>
								{:else}
									<div
										data-line-index={lineIndex}
										class="ocr-line-text"
										class:vertical-text={block.vertical}
										style={`
                    cursor: ${isBoxEditMode ? 'grab' : block.vertical ? 'vertical-text' : 'text'};
                    font-size: ${fontScale * block.font_size}px;
                  `}
										ondblclick={(e) => {
											if (!isEditMode && !isBoxEditMode && isSmartResizeMode) {
												e.stopPropagation();
												smartResizeFont(block, e.currentTarget as HTMLElement);
											}
										}}
									>
										{ligaturize(line, block.vertical)}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</TouchToggle>
		</div>
	{/each}
</div>

<style>
	.ocr-line-text {
		font-weight: 500;
		white-space: nowrap;
		user-select: text;

		/* Ensure a high-quality CJK font is used */
		font-family: 'Source Han Serif JP', 'Noto Sans JP', sans-serif;
		line-height: 1;
	}
	/* Vertical Text Flow (Tategaki) */
	.vertical-text {
		writing-mode: vertical-rl;
		text-orientation: mixed;

		/* Minimal, beneficial font features (keeping only vertical kerning/alternates) */
		/* font-variant-east-asian: normal; */
		font-feature-settings:
			'vhal' 1,
			'locl' 1;
	}
	:global(.vertical-text .ellipsis) {
		/* Combines the content into a single horizontal block */
		/* display: inline-block; */
		/* width: 1.5em; */
		font-feature-settings: 'vhal' 1;
	}
</style>
