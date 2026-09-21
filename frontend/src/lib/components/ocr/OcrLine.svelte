<script lang="ts">
  import { contextMenu, type MenuOption } from '$lib/stores/contextMenuStore';
  import { getImageDeltas, ligaturize } from '$lib/utils/ocr/math';
  import ResizeHandles from './ResizeHandles.svelte';
  import type { OcrState } from '$lib/states/reader/OcrState.svelte.ts';
  import type { Quad, Rect } from '$lib/types';
  import { readerState } from '$lib/states/reader/ReaderState.svelte';
  import { onMount, untrack } from 'svelte';

  // --- Props ---
  let {
    line,
    coords,
    lineIndex,
    // Context
    pageIndex,
    blockIndex,
    blockBox,
    isVertical,
    fontSize,
    // State Object
    ocrState,
    // Callbacks
    onSplit,
    onMerge,
    onNavigate,
    onSmartFontRequest,
    onFocusRequest,
    onLineChange,
    onCoordChange,
    onDeleteRequest,
    onToggleVerticalRequest,
    onReorderRequest
  }: {
    line: string;
    coords: Quad;
    lineIndex: number;
    pageIndex: number;
    blockIndex: number;
    blockBox: Rect;
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
    onSmartFontRequest: (targetElement: HTMLElement, dry?: boolean) => number | undefined;
    onFocusRequest: (targetElement: HTMLElement) => void;
    onLineChange: (newText: string) => void;
    onCoordChange: (newCoords: Quad) => void;
    onDeleteRequest: () => void;
    onToggleVerticalRequest: () => void;
    onReorderRequest: () => void;
  } = $props();

  // Mark props intentionally unused to satisfy linter where appropriate
  void fontSize;

  let lineElement: HTMLElement | undefined = $state();
  let textHoldingElement: HTMLElement | undefined = $state();
  let isEmpty = $derived(!textHoldingElement || textHoldingElement.textContent.trim() === '');
  let visualFontSize = $state(12);
  let finalFontSize = $derived.by(() => {
    return (ocrState.fontScale / devicePixelRatio) * visualFontSize;
  });
  let visualCoordsDelta: Quad = $state([
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0]
  ]);
  let visualCoords: Quad = $derived(
    coords.map((pair, i) => [
      pair[0] + visualCoordsDelta[i][0],
      pair[1] + visualCoordsDelta[i][1]
    ]) as Quad
  );
  let hasPendingInputChange: boolean = false;

  let requestFont = $state(false);
  onMount(() => {
    let idx = `${pageIndex}:${blockIndex}:${lineIndex}`;
    let smartFont = readerState.smartFontCache.get(idx);
    if (smartFont) {
      visualFontSize = smartFont;
      return;
    }
    firstTrigger = false;
    requestFont = true;
  });

  // --- Automatic font syncing effects ---
  let firstTrigger = true;
  $effect(() => {
    void line;
    void coords;
    void requestFont;
    if (firstTrigger) {
      firstTrigger = false;
      return;
    }

    let textElem = untrack(() => textHoldingElement);
    let empty = untrack(() => isEmpty);
    let smartFont;
    if (!empty) smartFont = onSmartFontRequest(textElem!, true);

    if (smartFont) {
      readerState.smartFontCache.set(`${pageIndex}:${blockIndex}:${lineIndex}`, smartFont);
      visualFontSize = smartFont;
    }
  });

  // handle drag or double click
  let doubleClickTimer: ReturnType<typeof setTimeout> | null = null;
  let isPendingDoubleClick = false;

  // handle resize handle visibility on mobile
  let resizeHandleTimer: ReturnType<typeof setTimeout> | null = null;
  let resizeHandleIsVisible = $state(false);

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
    if (readerState.ocrMode === 'TEXT') {
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
    if (readerState.ocrMode !== 'READ') {
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
    hasPendingInputChange = true;
    if (readerState.isSmartResizeMode && !isEmpty) {
      onSmartFontRequest(textHoldingElement!);
    }
  };
  const handleBlur = () => {
    // Sync local -> parent (upsync)
    console.log('blurring');
    if (hasPendingInputChange) {
      let innerText = textHoldingElement?.innerText;
      onLineChange(innerText ?? '');
      hasPendingInputChange = false;
    }
  };

  // --- Derived Geometry ---
  let relativeStyles = $derived.by(() => {
    const blockW = blockBox[2] - blockBox[0];
    const blockH = blockBox[3] - blockBox[1];

    // Safety check to avoid division by zero if block has 0 size
    if (blockW === 0 || blockH === 0 || false) return { left: 0, top: 0, width: 0, height: 0 };

    const x_min = ((visualCoords[0][0] - blockBox[0]) / blockW) * 100;
    const y_min = ((visualCoords[0][1] - blockBox[1]) / blockH) * 100;
    const x_max = ((visualCoords[2][0] - blockBox[0]) / blockW) * 100;
    const y_max = ((visualCoords[2][1] - blockBox[1]) / blockH) * 100;

    return {
      left: x_min,
      top: y_min,
      width: x_max - x_min,
      height: y_max - y_min
    };
  });

  // --- Actions ---

  const handleDoubleClick = (event: MouseEvent) => {
    // 1. Prioritize DBLCLICK action
    readerState.setOcrMode('TEXT');
    onFocusRequest(event.currentTarget as HTMLElement);

    // 2. Crucial State Reset & Drag Prevention
    if (doubleClickTimer) {
      clearTimeout(doubleClickTimer);
    }
    isPendingDoubleClick = false;

    // You must also prevent the immediately preceding drag attempt
    // If you used a listener manager, you'd stop listeners here.
    // In this model, the check below handles the prevention.

    event.stopPropagation();
  };

  const handleDragStart = (startEvent: PointerEvent) => {
    // Double click hybrid handling

    // If we are in the middle of a potential double-click,
    // we stop the drag sequence immediately.
    if (isPendingDoubleClick) {
      handleDoubleClick(startEvent);
      startEvent.stopPropagation();
      return;
    }

    // If this is the start of a new interaction,
    // set the double-click timer.
    isPendingDoubleClick = true;
    if (doubleClickTimer) {
      clearTimeout(doubleClickTimer); // Clear any old timer just in case
    }
    doubleClickTimer = setTimeout(() => {
      // If the timer expires before a second click, it was a single click/drag
      isPendingDoubleClick = false;
      doubleClickTimer = null;
    }, 300); // Standard double-click interval (e.g., 300ms)

    // Make handle visible on touch devices
    if (startEvent.pointerType !== 'mouse') {
      resizeHandleIsVisible = true;
      if (resizeHandleTimer) {
        clearTimeout(resizeHandleTimer); // Clear any old timer just in case
      }
      resizeHandleTimer = setTimeout(() => {
        resizeHandleIsVisible = false;
        resizeHandleTimer = null;
      }, 1000);
    }

    // Actual handle drag start
    if (readerState.ocrMode === 'TEXT') readerState.setOcrMode('BOX');
    if (!ocrState.overlayElement || !lineElement) return;
    startEvent.preventDefault();
    startEvent.stopPropagation();

    let totalScreenDeltaX = 0;
    let totalScreenDeltaY = 0;
    let totalImageDeltaX = 0;
    let totalImageDeltaY = 0;

    let lastX = startEvent.clientX;
    let lastY = startEvent.clientY;

    const handleDragMove = (moveEvent: PointerEvent) => {
      // 0. Compute delta
      // We do this manually because movementX and movementY is inconsistent
      const deltaX = moveEvent.clientX - lastX;
      const deltaY = moveEvent.clientY - lastY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;

      // 1. Visual Update
      const currentZoom = ocrState.panzoomInstance?.getScale() ?? 1.0;
      totalScreenDeltaX += deltaX / currentZoom;
      totalScreenDeltaY += deltaY / currentZoom;

      if (lineElement) {
        lineElement.style.transform = `translate(${totalScreenDeltaX}px, ${totalScreenDeltaY}px)`;
      }

      // 2. Data Calculation
      const { imageDeltaX, imageDeltaY } = getImageDeltas(
        { movementX: deltaX, movementY: deltaY },
        ocrState.overlayElement!,
        ocrState.imgWidth,
        ocrState.imgHeight
      );
      totalImageDeltaX += imageDeltaX;
      totalImageDeltaY += imageDeltaY;
    };

    const handleDragEnd = () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', handleDragEnd);

      if (lineElement) {
        lineElement.style.transform = '';
      }

      // If drag time is too short, it's probably a double click.
      // Do not commit, do not mark dirty
      if (isPendingDoubleClick) return;

      // Commit
      const localCoords = coords.map((pair) => [pair[0], pair[1]]) as Quad;
      for (const coord of localCoords) {
        coord[0] += totalImageDeltaX;
        coord[1] += totalImageDeltaY;
      }
      onCoordChange(localCoords);
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
  };

  const handleResizeStart = (startEvent: PointerEvent, handleType: string) => {
    if (readerState.ocrMode !== 'BOX' || !ocrState.overlayElement) return;
    startEvent.preventDefault();
    startEvent.stopPropagation();

    // Block dimensions were previously calculated here but are unused.

    let lastX = startEvent.clientX;
    let lastY = startEvent.clientY;

    const handleDragMove = (moveEvent: MouseEvent) => {
      // 0. Compute delta
      // We do this manually because movementX and movementY is inconsistent
      const deltaX = moveEvent.clientX - lastX;
      const deltaY = moveEvent.clientY - lastY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;

      const { imageDeltaX, imageDeltaY } = getImageDeltas(
        { movementX: deltaX, movementY: deltaY },
        ocrState.overlayElement!,
        ocrState.imgWidth,
        ocrState.imgHeight
      );

      // 2. Update Local Coordinates (Math Only)
      switch (handleType) {
        case 'top-left':
          visualCoordsDelta[0][0] += imageDeltaX;
          visualCoordsDelta[0][1] += imageDeltaY;
          visualCoordsDelta[1][1] += imageDeltaY;
          visualCoordsDelta[3][0] += imageDeltaX;
          break;
        case 'top-center':
          visualCoordsDelta[0][1] += imageDeltaY;
          visualCoordsDelta[1][1] += imageDeltaY;
          break;
        case 'top-right':
          visualCoordsDelta[1][0] += imageDeltaX;
          visualCoordsDelta[1][1] += imageDeltaY;
          visualCoordsDelta[0][1] += imageDeltaY;
          visualCoordsDelta[2][0] += imageDeltaX;
          break;
        case 'middle-left':
          visualCoordsDelta[0][0] += imageDeltaX;
          visualCoordsDelta[3][0] += imageDeltaX;
          break;
        case 'middle-right':
          visualCoordsDelta[1][0] += imageDeltaX;
          visualCoordsDelta[2][0] += imageDeltaX;
          break;
        case 'bottom-left':
          visualCoordsDelta[3][0] += imageDeltaX;
          visualCoordsDelta[3][1] += imageDeltaY;
          visualCoordsDelta[0][0] += imageDeltaX;
          visualCoordsDelta[2][1] += imageDeltaY;
          break;
        case 'bottom-center':
          visualCoordsDelta[2][1] += imageDeltaY;
          visualCoordsDelta[3][1] += imageDeltaY;
          break;
        case 'bottom-right':
          visualCoordsDelta[2][0] += imageDeltaX;
          visualCoordsDelta[2][1] += imageDeltaY;
          visualCoordsDelta[1][0] += imageDeltaX;
          visualCoordsDelta[3][1] += imageDeltaY;
          break;
      }

      let smartFont;
      if (readerState.isSmartResizeMode && !isEmpty) {
        smartFont = onSmartFontRequest(textHoldingElement!);
      }

      if (!smartFont && !isEmpty) {
        smartFont = onSmartFontRequest(textHoldingElement!, true);
        visualFontSize = smartFont ?? 12;
      }
    };

    const handleDragEnd = () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', handleDragEnd);

      // 4. Commit Data
      onCoordChange(visualCoords);
      visualCoordsDelta = [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ];
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
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
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const selection = window.getSelection();
      if (!selection) return;
      const offset = selection.anchorOffset;
      const textBefore = line.substring(0, offset);
      const textAfter = line.substring(offset);
      hasPendingInputChange = false;
      onSplit(lineIndex, textBefore, textAfter);
    }

    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.anchorOffset === 0 && lineIndex > 0) {
        e.preventDefault();
        e.stopPropagation();
        hasPendingInputChange = false;
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

{#if readerState.ocrMode === 'BOX'}
  <div
    bind:this={lineElement}
    class="absolute border border-red-500/50 bg-[rgba(239,128,128,0.7)] transition-colors z-2 group/line"
    style:left="{relativeStyles.left}%"
    style:top="{relativeStyles.top}%"
    style:width="{relativeStyles.width}%"
    style:height="{relativeStyles.height}%"
    role="button"
    tabindex="-1"
    onpointerdown={handleDragStart}
    oncontextmenu={handleContextMenu}
  >
    <ResizeHandles
      variant="line"
      forceVisible={resizeHandleIsVisible}
      onResizeStart={handleResizeStart}
    />
    <div
      bind:this={textHoldingElement}
      class="w-fit h-fit whitespace-nowrap pointer-events-none ocr-line-text"
      class:vertical-text={isVertical}
      style:font-size="{finalFontSize}px"
    >
      {ligaturize(line)}
    </div>
  </div>
{:else if readerState.ocrMode === 'TEXT'}
  <div
    bind:this={lineElement}
    class="absolute border border-red-500/70 z-2 bg-[rgba(239,128,128,0.85)]"
    style:left="{relativeStyles.left}%"
    style:top="{relativeStyles.top}%"
    style:width="{relativeStyles.width}%"
    style:height="{relativeStyles.height}%"
    onpointerdown={handleDragStart}
    role="button"
    tabindex="-1"
  >
    <div
      bind:this={textHoldingElement}
      contenteditable="true"
      role="textbox"
      tabindex="0"
      class="{isEmpty
        ? 'w-full h-full'
        : 'w-fit h-fit'} bg-blue outline-none p-0 m-0 leading-none whitespace-nowrap ocr-line-text"
      class:vertical-text={isVertical}
      style:cursor={isVertical ? 'vertical-text' : 'text'}
      style:font-size="{finalFontSize}px"
      bind:innerText={line}
      onpointerdown={(e) => e.stopPropagation()}
      onkeydown={handleKeyDown}
      oninput={handleInput}
      onblur={handleBlur}
      onfocus={(e) => {
        onFocusRequest(e.currentTarget);
        if (
          readerState.isSmartResizeMode &&
          textHoldingElement &&
          textHoldingElement.textContent !== ''
        )
          onSmartFontRequest(textHoldingElement);
      }}
      oncontextmenu={handleContextMenu}
      data-line-index={lineIndex}
    ></div>
  </div>
{:else if readerState.isSmartResizeMode}
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
        if (readerState.isSmartResizeMode && textHoldingElement) {
          e.stopPropagation();
          onSmartFontRequest(textHoldingElement);
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
    class="relative border border-transparent p-0 m-0 leading-none z-3 inline-flex align-top pointer-events-auto ocr-line-text"
    style:left="{isVertical
      ? -100 + relativeStyles.width + relativeStyles.left
      : relativeStyles.width + relativeStyles.left}%"
    style:top="{relativeStyles.top}%"
    style:width="{relativeStyles.width}%"
    style:height="{relativeStyles.height}%"
    style:margin-bottom="-{isVertical ? relativeStyles.height : 0}%"
    style:margin-left="-{isVertical ? 0 : relativeStyles.width}%"
    style:border-color={readerState.isSmartResizeMode ? 'red' : 'transparent'}
    style:cursor={isVertical ? 'vertical-text' : 'text'}
    role="button"
    tabindex="-1"
  >
    <span
      bind:this={textHoldingElement}
      class="w-fit h-fit whitespace-nowrap ocr-line-text"
      class:vertical-text={isVertical}
      style:font-size="{finalFontSize}px"
    >
      {ligaturize(line)}
    </span>
  </span>
{/if}

<style>
  .ocr-line-text {
    font-weight: 500;
    white-space: nowrap;
    user-select: text;

    /* AI NOTE: Text color is always black for readability in all OCR modes.
		   DO NOT change this to use theme colors - text must remain black. */
    color: black;

    /* Ensure a high-quality CJK font is used */
    font-family: 'Noto Sans JP', sans-serif;
    line-height: 1;
  }
</style>
