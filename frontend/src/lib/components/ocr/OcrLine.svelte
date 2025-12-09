<script lang="ts">
	import { contextMenu, type MenuOption } from '$lib/contextMenuStore';
	import { getDeltas, ligaturize } from '$lib/utils/ocrMath';
	import ResizeHandles from './ResizeHandles.svelte';
	import type { OcrState } from '$lib/states/OcrState.svelte';

	// --- Props ---
	let {
		line,
		coords,
		lineIndex,
		// Context
		blockBox,
		isVertical,
		fontSize,
		// State Object
		ocrState,
		// Callbacks
		onSplit,
		onMerge,
		onNavigate,
		onSmartResizeRequest,
		onFocusRequest,
		onLineChange,
		onCoordChange,
		onDeleteRequest,
		onToggleVerticalRequest,
		onReorderRequest
	} = $props<{
		line: string;
		coords: [[number, number], [number, number], [number, number], [number, number]];
		lineIndex: number;
		blockBox: [number, number, number, number];
		isVertical: boolean;
		fontSize: number;
		ocrState: OcrState;
		onSplit: (index: number, textBefore: string, textAfter: string) => void;
		onMerge: (index: number, text: string) => void;
		onNavigate: (
			event: KeyboardEvent,
			index: number,
			direction: 'up' | 'down' | 'left' | 'right',
			offset: number
		) => void;
		onSmartResizeRequest: (targetElement: HTMLElement) => void;
		onFocusRequest: (targetElement: HTMLElement) => void;
		onLineChange: (newText: string) => void;
		onCoordChange: (newCoords: string) => void;
		onDeleteRequest: () => void;
		onToggleVerticalRequest: () => void;
		onReorderRequest: () => void;
	}>();

	let lineElement: HTMLElement | undefined = $state();
	let textHoldingElement: HTMLElement | undefined = $state();
	let DPR: number | undefined = $state();
	let finalFontSize = $derived((ocrState.fontScale / (DPR ?? 1)) * fontSize);

	// Clipboard Logic
	const handleClipboardAction = async (command: 'cut' | 'copy' | 'paste') => {
		// Early returns for validation
		if (!lineElement && !textHoldingElement) return;
		const target = (lineElement ?? textHoldingElement) as HTMLElement;
		target.focus();

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const selectedText = selection.toString();

		// Try modern Clipboard API first
		if (navigator.clipboard) {
			try {
				if (command === 'copy') {
					await navigator.clipboard.writeText(selectedText);
				} else if (command === 'cut') {
					await navigator.clipboard.writeText(selectedText);
					selection.deleteFromDocument();
					// manually trigger input handling
					handleInput();
				} else if (command === 'paste') {
					const text = await navigator.clipboard.readText();
					if (!text) return;

					const range = selection.getRangeAt(0);
					range.deleteContents();
					range.insertNode(document.createTextNode(text));

					// move carat to end
					range.collapse(false);
					selection.removeAllRanges();
					selection.addRange(range);
					// manually trigger input handling
					handleInput();
				}
			} catch (err) {
				console.warn(`Clipboard API failed, trying execCommand:`, err);
				// Fall through to execCommand
			}
			return;
		}

		// Fallback to execCommand (HTTP contexts only)
		if (command === 'paste') {
			console.warn('Paste requires HTTPS/localhost. Use Ctrl+V.');
			return;
		}

		try {
			const success = document.execCommand(command);
			if (success && command === 'cut') handleInput();
			if (!success) console.error(`execCommand ${command} failed`);
		} catch (err) {
			console.error(`execCommand ${command} error:`, err);
		}
	};

	// Context Menu
	const handleContextMenu = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const options = [] as MenuOption[];
		const isTouch = (e as PointerEvent).pointerType === 'touch';

		// 1. Text Edit Actions (Edit Mode Only)
		if (ocrState.isEditMode) {
			if (!isTouch) {
				// Check if clipboard is available (HTTPS/localhost)
				const hasClipboard = !!navigator.clipboard;

				if (hasClipboard) {
					// Clipboard API available - show working buttons
					options.push({ label: 'Cut', action: () => handleClipboardAction('cut') });
					options.push({ label: 'Copy', action: () => handleClipboardAction('copy') });
					options.push({ label: 'Paste', action: () => handleClipboardAction('paste') });
				} else {
					// No Clipboard API - show disabled with keyboard hints
					// Copy/cut still work via execCommand fallback
					options.push({ label: 'Cut (Ctrl+X)', action: () => handleClipboardAction('cut') });
					options.push({ label: 'Copy (Ctrl+C)', action: () => handleClipboardAction('copy') });
					options.push({ label: 'Paste (Ctrl+V)', action: () => {}, disabled: true });
				}
			}
		}

		// 2. Structural Actions (Edit OR Box Mode)
		if (ocrState.isEditMode || ocrState.isBoxEditMode) {
			if (options.length > 0) options.push({ separator: true });
			options.push({
				label: isVertical ? 'Set Horizontal' : 'Set Vertical',
				action: onToggleVerticalRequest
			});
			options.push({ label: 'Re-order Lines...', action: onReorderRequest });
			options.push({ label: 'Delete Line', action: onDeleteRequest });
		}

		if (options.length > 0) {
			contextMenu.open(e.clientX, e.clientY, options);
		}
	};

	const handleInput = () => {
		if (ocrState.isSmartResizeMode && textHoldingElement) onSmartResizeRequest(textHoldingElement);

		// Sync local -> parent (upsync)
		let innerText = textHoldingElement?.innerText;
		onLineChange(innerText);
		ocrState.markDirty();
	};

	// --- Derived Geometry ---
	let relativeStyles = $derived.by(() => {
		const blockW = blockBox[2] - blockBox[0];
		const blockH = blockBox[3] - blockBox[1];

		// Safety check to avoid division by zero if block has 0 size
		if (blockW === 0 || blockH === 0) return { left: 0, top: 0, width: 0, height: 0 };

		const x_min = ((coords[0][0] - blockBox[0]) / blockW) * 100;
		const y_min = ((coords[0][1] - blockBox[1]) / blockH) * 100;
		const x_max = ((coords[2][0] - blockBox[0]) / blockW) * 100;
		const y_max = ((coords[2][1] - blockBox[1]) / blockH) * 100;

		return {
			left: x_min,
			top: y_min,
			width: x_max - x_min,
			height: y_max - y_min
		};
	});

	// --- Actions ---

	const handleDragStart = (startEvent: MouseEvent) => {
		if (!ocrState.isBoxEditMode || !ocrState.overlayElement || !lineElement) return;
		startEvent.preventDefault();
		startEvent.stopPropagation();

		let totalScreenDeltaX = 0;
		let totalScreenDeltaY = 0;
		let totalImageDeltaX = 0;
		let totalImageDeltaY = 0;

		const handleDragMove = (moveEvent: MouseEvent) => {
			// 1. Visual Update
			const currentZoom = ocrState.panzoomInstance?.getScale() ?? 1.0;
			totalScreenDeltaX += moveEvent.movementX / currentZoom / devicePixelRatio;
			totalScreenDeltaY += moveEvent.movementY / currentZoom / devicePixelRatio;

			if (lineElement) {
				lineElement.style.transform = `translate(${totalScreenDeltaX}px, ${totalScreenDeltaY}px)`;
			}

			// 2. Data Calculation
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

			if (lineElement) {
				lineElement.style.transform = '';
			}

			// Commit
			const localCoords = JSON.parse(JSON.stringify(coords));
			for (const coord of localCoords) {
				coord[0] += totalImageDeltaX;
				coord[1] += totalImageDeltaY;
			}
			onCoordChange(localCoords);

			ocrState.markDirty();
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};

	const handleResizeStart = (startEvent: MouseEvent, handleType: string) => {
		if (!ocrState.isBoxEditMode || !ocrState.overlayElement) return;
		startEvent.preventDefault();
		startEvent.stopPropagation();

		// 1. Snapshot Initial State
		// We work on a local copy to avoid triggering Svelte updates during drag
		const localCoords = JSON.parse(JSON.stringify(coords));

		// We need block dimensions for percentage calculations
		const blockW = blockBox[2] - blockBox[0];
		const blockH = blockBox[3] - blockBox[1];

		const handleDragMove = (moveEvent: MouseEvent) => {
			const { imageDeltaX, imageDeltaY } = getDeltas(
				moveEvent,
				ocrState.overlayElement!,
				ocrState.imgWidth,
				ocrState.imgHeight
			);

			// 2. Update Local Coordinates (Math Only)
			switch (handleType) {
				case 'top-left':
					localCoords[0][0] += imageDeltaX;
					localCoords[0][1] += imageDeltaY;
					localCoords[1][1] += imageDeltaY;
					localCoords[3][0] += imageDeltaX;
					break;
				case 'top-center':
					localCoords[0][1] += imageDeltaY;
					localCoords[1][1] += imageDeltaY;
					break;
				case 'top-right':
					localCoords[1][0] += imageDeltaX;
					localCoords[1][1] += imageDeltaY;
					localCoords[0][1] += imageDeltaY;
					localCoords[2][0] += imageDeltaX;
					break;
				case 'middle-left':
					localCoords[0][0] += imageDeltaX;
					localCoords[3][0] += imageDeltaX;
					break;
				case 'middle-right':
					localCoords[1][0] += imageDeltaX;
					localCoords[2][0] += imageDeltaX;
					break;
				case 'bottom-left':
					localCoords[3][0] += imageDeltaX;
					localCoords[3][1] += imageDeltaY;
					localCoords[0][0] += imageDeltaX;
					localCoords[2][1] += imageDeltaY;
					break;
				case 'bottom-center':
					localCoords[2][1] += imageDeltaY;
					localCoords[3][1] += imageDeltaY;
					break;
				case 'bottom-right':
					localCoords[2][0] += imageDeltaX;
					localCoords[2][1] += imageDeltaY;
					localCoords[1][0] += imageDeltaX;
					localCoords[3][1] += imageDeltaY;
					break;
			}

			// 3. Visual Update (Direct DOM Style)
			// We must convert absolute image coords back to percentages relative to the block
			if (lineElement && blockW > 0 && blockH > 0) {
				const x_min = ((localCoords[0][0] - blockBox[0]) / blockW) * 100;
				const y_min = ((localCoords[0][1] - blockBox[1]) / blockH) * 100;
				const x_max = ((localCoords[2][0] - blockBox[0]) / blockW) * 100;
				const y_max = ((localCoords[2][1] - blockBox[1]) / blockH) * 100;

				lineElement.style.left = `${x_min}%`;
				lineElement.style.top = `${y_min}%`;
				lineElement.style.width = `${x_max - x_min}%`;
				lineElement.style.height = `${y_max - y_min}%`;
			}

			if (ocrState.isSmartResizeMode && textHoldingElement) {
				onSmartResizeRequest(textHoldingElement);
			}
		};

		const handleDragEnd = () => {
			window.removeEventListener('mousemove', handleDragMove);
			window.removeEventListener('mouseup', handleDragEnd);

			// 4. Commit Data
			// NOTE: No need to clean up style since svelte reactivity will clear it on update
			onCoordChange(localCoords);
			ocrState.markDirty();

			if (ocrState.isSmartResizeMode && textHoldingElement) {
				onSmartResizeRequest(textHoldingElement);
			}
		};

		window.addEventListener('mousemove', handleDragMove);
		window.addEventListener('mouseup', handleDragEnd);
	};

	// --- Text Interaction ---
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key.startsWith('Arrow')) {
			e.stopPropagation();
			const selection = window.getSelection();
			const offset = selection?.anchorOffset ?? 0;
			let dir: 'up' | 'down' | 'left' | 'right' | null = null;
			if (e.key === 'ArrowUp') dir = 'up';
			if (e.key === 'ArrowDown') dir = 'down';
			if (e.key === 'ArrowLeft') dir = 'left';
			if (e.key === 'ArrowRight') dir = 'right';

			if (dir) {
				onNavigate(e, lineIndex, dir, offset);
			}
			return;
		}

		if (e.key === 'Enter') {
			e.preventDefault();
			const selection = window.getSelection();
			if (!selection) return;
			const offset = selection.anchorOffset;
			const textBefore = line.substring(0, offset);
			const textAfter = line.substring(offset);
			onSplit(lineIndex, textBefore, textAfter);
		}

		if (e.key === 'Backspace') {
			const selection = window.getSelection();
			if (selection && selection.anchorOffset === 0 && lineIndex > 0) {
				e.preventDefault();
				onMerge(lineIndex, line);
			}
		}
	};

	export const focus = () => {
		if (textHoldingElement) textHoldingElement.focus();
	};

	export const setCaret = (offset: number) => {
		if (!textHoldingElement) return;

		// Make sure we have focus first
		textHoldingElement.focus();

		const textNode = textHoldingElement.firstChild;
		const selection = window.getSelection();

		if (textNode && selection) {
			try {
				selection.removeAllRanges();
				selection.collapse(textNode, offset);
			} catch (e) {
				// Fallback if offset is out of bounds or node invalid
				console.warn('Failed to set caret', e);
			}
		}
	};
</script>

<svelte:window bind:devicePixelRatio={DPR} />
{#if ocrState.isBoxEditMode}
	<div
		bind:this={lineElement}
		class="absolute border border-red-500/50 bg-[rgba(239,128,128,0.7)] transition-colors z-2 group/line"
		style:left="{relativeStyles.left}%"
		style:top="{relativeStyles.top}%"
		style:width="{relativeStyles.width}%"
		style:height="{relativeStyles.height}%"
		role="button"
		tabindex="-1"
		onmousedown={handleDragStart}
		oncontextmenu={handleContextMenu}
	>
		<ResizeHandles variant="line" onResizeStart={handleResizeStart} />
		<div
			bind:this={textHoldingElement}
			class="w-fit h-fit whitespace-nowrap pointer-events-none ocr-line-text"
			class:vertical-text={isVertical}
			style:font-size="{finalFontSize}px"
		>
			{ligaturize(line)}
		</div>
	</div>
{:else if ocrState.isEditMode}
	<div
		bind:this={lineElement}
		class="absolute border border-red-500/70 z-2 bg-[rgba(239,128,128,0.85)]"
		style:left="{relativeStyles.left}%"
		style:top="{relativeStyles.top}%"
		style:width="{relativeStyles.width}%"
		style:height="{relativeStyles.height}%"
	>
		<div
			bind:this={textHoldingElement}
			contenteditable="true"
			role="textbox"
			tabindex="0"
			class="w-fit h-fit outline-none p-0 m-0 leading-none whitespace-nowrap ocr-line-text"
			class:vertical-text={isVertical}
			style:cursor={isVertical ? 'vertical-text' : 'text'}
			style:font-size="{finalFontSize}px"
			bind:innerText={line}
			onkeydown={handleKeyDown}
			oninput={handleInput}
			onfocus={(e) => {
				onFocusRequest(e.currentTarget);
				if (ocrState.isSmartResizeMode && textHoldingElement)
					onSmartResizeRequest(textHoldingElement);
			}}
			oncontextmenu={handleContextMenu}
			data-line-index={lineIndex}
		></div>
	</div>
{:else if ocrState.isSmartResizeMode}
	<div
		bind:this={lineElement}
		class="absolute border border-red-500/50 bg-transparent transition-colors z-2 group/line"
		style:left="{relativeStyles.left}%"
		style:top="{relativeStyles.top}%"
		style:width="{relativeStyles.width}%"
		style:height="{relativeStyles.height}%"
	>
		<div
			bind:this={textHoldingElement}
			class="w-fit h-fit whitespace-nowrap ocr-line-text"
			class:vertical-text={isVertical}
			style:font-size="{finalFontSize}px"
			ondblclick={(e) => {
				console.log(isVertical);
				if (ocrState.isSmartResizeMode && textHoldingElement) {
					e.stopPropagation();
					onSmartResizeRequest(textHoldingElement);
				}
			}}
			role="button"
			tabindex="-1"
		>
			{ligaturize(line)}
		</div>
	</div>
{:else}
	<span
		class="relative border border-transparent p-0 m-0 leading-none z-3 inline-flex items-center align-top pointer-events-auto ocr-line-text"
		class:vertical-text={isVertical}
		style:left="{isVertical
			? -100 + relativeStyles.width + relativeStyles.left
			: relativeStyles.width + relativeStyles.left}%"
		style:top="{relativeStyles.top}%"
		style:width="{relativeStyles.width}%"
		style:height="{relativeStyles.height}%"
		style:margin-bottom="-{isVertical ? relativeStyles.height : 0}%"
		style:margin-left="-{isVertical ? 0 : relativeStyles.width}%"
		style:font-size="{finalFontSize}px"
		style:border-color={ocrState.isSmartResizeMode ? 'red' : 'transparent'}
		style:cursor={isVertical ? 'vertical-text' : 'text'}
		role="button"
		tabindex="-1"
	>
		{ligaturize(line)}
	</span>
{/if}

<style>
	.ocr-line-text {
		font-weight: 500;
		white-space: nowrap;
		user-select: text;

		/* Ensure a high-quality CJK font is used */
		font-family: 'Source Han Serif JP', 'Noto Sans JP', sans-serif;
		line-height: 1;
	}
</style>
