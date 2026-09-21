<script lang="ts">
  import type { MokuroPage, MokuroBlock } from '$lib/types';
  import type { PanzoomObject } from '@panzoom/panzoom';
  import { contextMenu } from '$lib/stores/contextMenuStore';
  import { OcrState } from '$lib/states/reader/OcrState.svelte.ts';
  import { getRelativeCoords, getScaleRatios } from '$lib/utils/ocr/math';
  import OcrBlock from './OcrBlock.svelte';
  import { readerState } from '$lib/states/reader/ReaderState.svelte';
  import { PatchApplicator } from '$lib/utils/ocr/PatchApplicator';

  let {
    page,
    pageIndex, // New Prop
    panzoomInstance
  }: {
    page: MokuroPage;
    pageIndex: number;
    panzoomInstance: PanzoomObject | null;
  } = $props();

  // Initialize State with Page Index
  let ocrState = new OcrState({
    page,
    pageIndex,
    panzoomInstance
  });

  // Sync Props
  $effect(() => {
    ocrState.page = page;
    ocrState.pageIndex = pageIndex;
    ocrState.panzoomInstance = panzoomInstance;
  });

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const activeElement = document.activeElement;
    if (readerState.ocrMode === 'TEXT') {
      readerState.unsetFocusedLine();
      readerState.setOcrMode('BOX');
    }
    if (activeElement instanceof HTMLElement) activeElement.blur();
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  };

  const handleCreateBlock = (event: MouseEvent) => {
    if (!ocrState.overlayElement || !page.blocks) return;

    // 1. Math (Viewport -> Image Coords)
    const { imgX, imgY } = getRelativeCoords(
      event,
      ocrState.overlayElement,
      page.img_width,
      page.img_height
    );
    const { scaleRatioX, scaleRatioY } = getScaleRatios(
      ocrState.overlayElement,
      page.img_width,
      page.img_height
    );

    const rect = ocrState.overlayElement.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const BOX_WIDTH_IMAGE = rect.width * 0.15 * scaleRatioX;
    const BOX_HEIGHT_IMAGE = rect.height * 0.15 * scaleRatioY;
    const LINE_WIDTH = BOX_WIDTH_IMAGE * 0.9;
    const LINE_HEIGHT = BOX_HEIGHT_IMAGE * 0.9;

    const newLineCoords: [[number, number], [number, number], [number, number], [number, number]] =
      [
        [imgX - LINE_WIDTH / 2, imgY - LINE_HEIGHT / 2],
        [imgX + LINE_WIDTH / 2, imgY - LINE_HEIGHT / 2],
        [imgX + LINE_WIDTH / 2, imgY + LINE_HEIGHT / 2],
        [imgX - LINE_WIDTH / 2, imgY + LINE_HEIGHT / 2]
      ];

    // 2. Define New Block
    const newBlock: MokuroBlock = {
      box: [
        imgX - BOX_WIDTH_IMAGE / 2,
        imgY - BOX_HEIGHT_IMAGE / 2,
        imgX + BOX_WIDTH_IMAGE / 2,
        imgY + BOX_HEIGHT_IMAGE / 2
      ],
      lines: ['New Text'],
      lines_coords: [newLineCoords],
      vertical: false,
      font_size: Math.min(page.img_width, page.img_height) / 50
    };

    // 3. Dispatch 'ADD' Op
    // Path: /pages/{p}/blocks/- (Append)
    ocrState.dispatch('blocks/-', 'add', PatchApplicator.nativeBlockToUnified(newBlock));
  };

  const handleDeleteBlock = (blockToDelete: MokuroBlock) => {
    const index = page.blocks.indexOf(blockToDelete);
    if (index > -1) {
      // Dispatch 'REMOVE' Op
      ocrState.dispatch(
        `blocks/${index}`,
        'remove',
        null,
        PatchApplicator.nativeBlockToUnified(blockToDelete)
      );
    }
  };

  const handleContextMenu = (event: MouseEvent) => {
    if (event.target !== event.currentTarget) return;
    if (readerState.ocrMode !== 'READ') {
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
    <OcrBlock
      {pageIndex}
      blockIndex={i}
      block={page.blocks[i]}
      {ocrState}
      onDelete={() => handleDeleteBlock(block)}
    />
  {/each}
</div>
