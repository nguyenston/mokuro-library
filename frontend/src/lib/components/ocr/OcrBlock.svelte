<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { MokuroBlock, PatchOperation, Quad, Rect } from '$lib/types';
  import { contextMenu, type MenuOption } from '$lib/stores/contextMenuStore';
  import { lineOrderStore } from '$lib/stores/lineOrderStore';
  import { getImageDeltas, computeSmartFont, getRelativeCoords } from '$lib/utils/ocr/math';
  import { readerState } from '$lib/states/reader/ReaderState.svelte.ts';
  import type { OcrState } from '$lib/states/reader/OcrState.svelte.ts';

  import OcrLine from './OcrLine.svelte';
  import ResizeHandles from './ResizeHandles.svelte';
  import TouchToggle from './TouchToggle.svelte';

  // --- Props ---
  let {
    pageIndex,
    blockIndex,
    block,
    ocrState,
    onDelete
  }: {
    pageIndex: number;
    blockIndex: number;
    block: MokuroBlock;
    ocrState: OcrState;
    onDelete: () => void;
  } = $props();

  // --- Local State ---
  let isHovered = $state(false);
  let blockElement: HTMLDivElement | undefined = $state();

  // Registry of child line components for focus management
  // We use a Map or Array to store bound references
  let lineComponents: Record<number, ReturnType<typeof OcrLine>> = $state({});

  // handle drag or double click
  // on the block level, this helps reject trivial edits
  let doubleClickTimer: ReturnType<typeof setTimeout> | null = null;
  let isPendingDoubleClick = false;

  // handle resize handle visibility on mobile
  let resizeHandleTimer: ReturnType<typeof setTimeout> | null = null;
  let resizeHandleIsVisible = $state(false);
  onMount(() => {});

  // --- Derived Styles ---
  let visualFontSize = $derived(block.font_size);
  let visualDelta: Rect = $state([0, 0, 0, 0]);
  let visualBox: Rect = $derived([
    block.box[0] + visualDelta[0],
    block.box[1] + visualDelta[1],
    block.box[2] + visualDelta[2],
    block.box[3] + visualDelta[3]
  ]);
  let geometry = $derived.by(() => {
    // Safety check
    if (ocrState.imgWidth === 0 || ocrState.imgHeight === 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    const x_min = (visualBox[0] / ocrState.imgWidth) * 100;
    const y_min = (visualBox[1] / ocrState.imgHeight) * 100;
    const width = ((visualBox[2] - visualBox[0]) / ocrState.imgWidth) * 100;
    const height = ((visualBox[3] - visualBox[1]) / ocrState.imgHeight) * 100;

    return { x_min, y_min, width, height };
  });
  let isHighlighted = $derived(readerState.highlightedBlocks.has(`${pageIndex}:${blockIndex}`));
  // let isHighlighted = $derived(true);

  // --- Interactions ---

  // 1. Block Drag
  const handleBlockDragStart = (startEvent: PointerEvent) => {
    // Double click hybrid handling

    // If we are in the middle of a potential double-click,
    // we stop the drag sequence immediately.
    if (isPendingDoubleClick) {
      // put what ever future handle double click here
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
    if (readerState.ocrMode === 'READ') return;
    if (readerState.ocrMode === 'TEXT') readerState.setOcrMode('BOX');
    if (!ocrState.overlayElement || !blockElement) return;
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

      // 1. Visual Update (Screen Space)
      const currentZoom = ocrState.panzoomInstance?.getScale() ?? 1.0;
      totalScreenDeltaX += deltaX / currentZoom;
      totalScreenDeltaY += deltaY / currentZoom;

      if (blockElement) {
        blockElement.style.transform = `translate(${totalScreenDeltaX}px, ${totalScreenDeltaY}px)`;
      }

      // 2. Data Calculation (Image Space)
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

      // Reset Transform
      if (blockElement) {
        blockElement.style.transform = '';
      }

      // If drag time is too short, it's probably a double click.
      // Do not commit, do not mark dirty
      if (isPendingDoubleClick) return;

      // --- REFACTOR: Dispatch Batch Ops ---
      const pIdx = pageIndex;
      const bIdx = blockIndex;
      const ops: PatchOperation[] = [];

      // 1. Update Block Box
      const newBox = [
        block.box[0] + totalImageDeltaX,
        block.box[1] + totalImageDeltaY,
        block.box[2] + totalImageDeltaX,
        block.box[3] + totalImageDeltaY
      ] as Rect;
      ops.push({
        op: 'replace',
        path: `/pages/${pIdx}/blocks/${bIdx}/box`,
        value: newBox,
        old_value: block.box
      });

      // 2. Update All Lines Coords (Independent Coordinates)
      block.lines_coords.forEach((coords, lIdx) => {
        const newCoords = coords.map((pt) => [
          pt[0] + totalImageDeltaX,
          pt[1] + totalImageDeltaY
        ]) as Quad;
        ops.push({
          op: 'replace',
          path: `/pages/${pIdx}/blocks/${bIdx}/lines/${lIdx}/coords`,
          value: newCoords,
          old_value: coords
        });
      });

      readerState.dispatch(ops);
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
  };

  // 2. Block Resize
  const handleResizeStart = (startEvent: PointerEvent, handleType: string) => {
    if (readerState.ocrMode !== 'BOX' || !ocrState.overlayElement) return;
    startEvent.preventDefault();
    startEvent.stopPropagation();

    let lastX = startEvent.clientX;
    let lastY = startEvent.clientY;

    const handleDragMove = (moveEvent: PointerEvent) => {
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

      switch (handleType) {
        case 'top-left':
          visualDelta[0] += imageDeltaX;
          visualDelta[1] += imageDeltaY;
          break;
        case 'top-center':
          visualDelta[1] += imageDeltaY;
          break;
        case 'top-right':
          visualDelta[2] += imageDeltaX;
          visualDelta[1] += imageDeltaY;
          break;
        case 'middle-left':
          visualDelta[0] += imageDeltaX;
          break;
        case 'middle-right':
          visualDelta[2] += imageDeltaX;
          break;
        case 'bottom-left':
          visualDelta[0] += imageDeltaX;
          visualDelta[3] += imageDeltaY;
          break;
        case 'bottom-center':
          visualDelta[3] += imageDeltaY;
          break;
        case 'bottom-right':
          visualDelta[2] += imageDeltaX;
          visualDelta[3] += imageDeltaY;
          break;
      }
    };

    const handleDragEnd = () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', handleDragEnd);
      const pIdx = pageIndex;
      const bIdx = blockIndex;

      // Calculate Final Box
      const newBox: Rect = [
        block.box[0] + visualDelta[0],
        block.box[1] + visualDelta[1],
        block.box[2] + visualDelta[2],
        block.box[3] + visualDelta[3]
      ];

      // Dispatch
      readerState.dispatch([
        {
          op: 'replace',
          path: `/pages/${pIdx}/blocks/${bIdx}/box`,
          value: newBox,
          old_value: block.box
        }
      ]);

      // Reset local visual state immediately
      // (Staging updates synchronously via dispatch, so no jump occurs)
      visualDelta = [0, 0, 0, 0];
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
  };

  // 3. Child Line Actions (Bubbled Up)

  const handleSplit = async (index: number, textBefore: string, textAfter: string) => {
    const pIdx = pageIndex;
    const bIdx = blockIndex;

    // Calculate New Geometry
    const GAP = 2;
    const oldCoords = block.lines_coords[index];
    const width = oldCoords[1][0] - oldCoords[0][0];
    const height = oldCoords[3][1] - oldCoords[0][1];

    let newX = oldCoords[0][0];
    let newY = oldCoords[0][1];

    if (block.vertical) {
      newX = oldCoords[0][0] - width - GAP;
    } else {
      newY = oldCoords[0][1] + height + GAP;
    }

    const newCoords: Quad = [
      [newX, newY],
      [newX + width, newY],
      [newX + width, newY + height],
      [newX, newY + height]
    ];

    // Dispatch Batch
    // 1. Update old line text
    // 2. Add new line (Text + Coords)
    await readerState.dispatch([
      {
        op: 'replace',
        path: `/pages/${pIdx}/blocks/${bIdx}/lines/${index}/text`,
        value: textBefore,
        old_value: block.lines[index]
      },
      {
        op: 'add',
        path: `/pages/${pIdx}/blocks/${bIdx}/lines/${index + 1}`,
        value: { text: textAfter, coords: newCoords }
      }
    ]);

    await tick();
    lineComponents[index + 1]?.focus();
  };

  const handleMerge = async (index: number, text: string) => {
    if (index === 0) return;
    const pIdx = pageIndex;
    const bIdx = blockIndex;
    const prevLength = block.lines[index - 1].length;
    const combinedText = block.lines[index - 1] + text;

    await readerState.dispatch([
      {
        op: 'replace',
        path: `/pages/${pIdx}/blocks/${bIdx}/lines/${index - 1}/text`,
        value: combinedText,
        old_value: block.lines[index - 1]
      },
      {
        op: 'remove',
        path: `/pages/${pIdx}/blocks/${bIdx}/lines/${index}`,
        old_value: block.lines[index]
      }
    ]);

    await tick();
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

  const handleSmartFontRequest = (targetElement: HTMLElement, dry?: boolean) => {
    const smartFont = computeSmartFont(
      [pageIndex, blockIndex],
      targetElement,
      ocrState.imgWidth,
      ocrState.fontScale
    );

    if (!dry) visualFontSize = smartFont ?? block.font_size;
    return smartFont;
  };

  // 4. Block-Level Mutations
  const toggleVertical = () => {
    const pIdx = pageIndex;
    readerState.dispatch([
      {
        op: 'replace',
        path: `/pages/${pIdx}/blocks/${blockIndex}/vertical`,
        value: !block.vertical!,
        old_value: block.vertical!
      }
    ]);
  };

  const deleteLine = (index: number) => {
    if (block.lines.length <= 1) {
      onDelete(); // Block deletion is handled by parent (OcrOverlay)
    } else {
      const pIdx = pageIndex;
      readerState.dispatch([
        {
          op: 'remove',
          path: `/pages/${pIdx}/blocks/${blockIndex}/lines/${index}`,
          old_value: { text: block.lines[index], coords: block.lines_coords[index] }
        }
      ]);
    }
  };

  const handleAddLine = (e: MouseEvent) => {
    if (!ocrState.overlayElement) return;
    const { imgX, imgY } = getRelativeCoords(
      e,
      ocrState.overlayElement,
      ocrState.imgWidth,
      ocrState.imgHeight
    );
    const DEFAULT_S = 100;
    const newBox: Quad = [
      [imgX, imgY],
      [imgX + DEFAULT_S, imgY],
      [imgX + DEFAULT_S, imgY + DEFAULT_S],
      [imgX, imgY + DEFAULT_S]
    ];

    const pIdx = pageIndex;
    // Dispatch Add to end of list ('-')
    readerState.dispatch([
      {
        op: 'add',
        path: `/pages/${pIdx}/blocks/${blockIndex}/lines/${block.lines.length}`,
        value: { text: 'New Text', coords: newBox }
      }
    ]);
  };

  // --- Keyboard Shortcuts (Ctrl+A) ---
  const handleWindowKeydown = (e: KeyboardEvent) => {
    if (!isHovered) return;
    if (readerState.ocrMode !== 'READ') return; // Only in Reader/Neutral mode

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

  // --- Context Menu ---
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const options = [] as MenuOption[];

    if (readerState.ocrMode !== 'READ') {
      options.push({ label: 'Add Line', action: () => handleAddLine(e) });
      options.push({ separator: true });
      options.push({
        label: 'Re-order Lines...',
        action: handleOpenReorder
      });
      options.push({ label: 'Delete Block', action: onDelete });
    }

    if (options.length > 0) contextMenu.open(e.clientX, e.clientY, options);
  };

  const handleOpenReorder = () => {
    lineOrderStore.open(block, (newOrder) => {
      // Dispatch the reorder op
      // Path: /pages/{p}/blocks/{b}/lines (property is implicitly handled by backend for lines)

      ocrState.dispatch(`blocks/${blockIndex}/lines`, 'reorder', null, null, newOrder);
    });
  };
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div
  class="absolute group/block transition-shadow panzoom-exclude"
  class:ring-2={isHighlighted}
  class:ring-accent={isHighlighted}
  class:shadow-[0_0_0.9rem_rgba(56,189,248,0.75)]={isHighlighted}
  class:highlight-pulse={isHighlighted}
  style:left="{geometry.x_min}%"
  style:top="{geometry.y_min}%"
  style:width="{geometry.width}%"
  style:height="{geometry.height}%"
  style:pointer-events="auto"
  bind:this={blockElement}
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  onpointerdown={handleBlockDragStart}
  oncontextmenu={handleContextMenu}
  role="textbox"
  tabindex="-1"
>
  {#if readerState.ocrMode === 'BOX'}
    <ResizeHandles
      variant="block"
      forceVisible={resizeHandleIsVisible}
      onResizeStart={handleResizeStart}
    />
  {/if}

  <TouchToggle
    class="relative h-full w-full"
    forceVisible={isHighlighted ||
      readerState.ocrMode === 'BOX' ||
      (readerState.ocrMode === 'TEXT' &&
        ((readerState.focusedLineCoord[0] === pageIndex &&
          readerState.focusedLineCoord[1] === blockIndex) ||
          $contextMenu.isOpen))}
    mode="overlay"
  >
    {#snippet trigger()}
      <div
        class="absolute top-0 left-0 h-full w-full border transition-opacity z-1"
        class:border-green-500={readerState.showTriggerOutline || readerState.ocrMode !== 'READ'}
        class:border-accent={isHighlighted}
        class:border-transparent={!readerState.showTriggerOutline && readerState.ocrMode === 'READ'}
      ></div>
    {/snippet}

    <!--
			AI NOTE: Text color is forced to black when hovering over OCR text blocks (READ mode).
			This ensures text is always readable against the white background, regardless of theme.
			DO NOT change text-black to use theme colors - text must always be black for readability.
		-->
    <div
      class="relative h-full w-full p-0"
      class:vertical-text={block.vertical}
      class:bg-transparent={readerState.ocrMode !== 'READ'}
      class:bg-white={readerState.ocrMode !== 'BOX' && readerState.ocrMode !== 'TEXT'}
      class:text-black={readerState.ocrMode !== 'BOX' && readerState.ocrMode !== 'TEXT'}
    >
      {#each block.lines as line, i (i)}
        <OcrLine
          bind:this={lineComponents[i]}
          {line}
          coords={block.lines_coords[i]}
          lineIndex={i}
          {pageIndex}
          {blockIndex}
          blockBox={visualBox}
          isVertical={block.vertical ?? false}
          fontSize={visualFontSize ?? 12}
          {ocrState}
          onSplit={handleSplit}
          onMerge={handleMerge}
          onNavigate={handleNavigate}
          onSmartFontRequest={handleSmartFontRequest}
          onFocusRequest={() => {
            readerState.setFocusedLine(pageIndex, blockIndex, i);
            // Optional: update global active element tracking if needed
          }}
          onLineChange={(newText) => {
            const pIdx = pageIndex;
            if (newText === block.lines[i]) return;
            readerState.dispatch([
              {
                op: 'replace',
                path: `/pages/${pIdx}/blocks/${blockIndex}/lines/${i}/text`,
                value: newText,
                old_value: block.lines[i]
              }
            ]);

            // If font_size changed, dispatch
            if (visualFontSize && visualFontSize !== block.font_size) {
              const pIdx = pageIndex;
              readerState.dispatch([
                {
                  op: 'replace',
                  path: `/pages/${pIdx}/blocks/${blockIndex}/font_size`,
                  value: visualFontSize,
                  old_value: block.font_size!
                }
              ]);
            }
          }}
          onCoordChange={(newCoords) => {
            const pIdx = pageIndex;
            readerState.dispatch([
              {
                op: 'replace',
                path: `/pages/${pIdx}/blocks/${blockIndex}/lines/${i}/coords`,
                value: newCoords,
                old_value: block.lines_coords[i]
              }
            ]);

            // If font_size changed, dispatch
            if (visualFontSize && visualFontSize !== block.font_size) {
              const pIdx = pageIndex;
              readerState.dispatch([
                {
                  op: 'replace',
                  path: `/pages/${pIdx}/blocks/${blockIndex}/font_size`,
                  value: visualFontSize,
                  old_value: block.font_size!
                }
              ]);
            }
          }}
          onDeleteRequest={() => deleteLine(i)}
          onToggleVerticalRequest={toggleVertical}
          onReorderRequest={handleOpenReorder}
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

  .highlight-pulse {
    animation: highlightPulse 1.1s ease-in-out infinite;
  }

  @keyframes highlightPulse {
    0% {
      box-shadow:
        0 0 0.35rem rgba(56, 189, 248, 0.5),
        0 0 0.9rem rgba(56, 189, 248, 0.75);
      filter: saturate(1);
    }
    50% {
      box-shadow:
        0 0 0.6rem rgba(56, 189, 248, 0.85),
        0 0 1.4rem rgba(56, 189, 248, 0.95);
      filter: saturate(1.35);
    }
    100% {
      box-shadow:
        0 0 0.35rem rgba(56, 189, 248, 0.5),
        0 0 0.9rem rgba(56, 189, 248, 0.75);
      filter: saturate(1);
    }
  }
</style>
