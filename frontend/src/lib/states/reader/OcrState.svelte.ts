import type { PanzoomObject } from '@panzoom/panzoom';
import type { MokuroPage, PatchOperation } from '$lib/types';
import { readerState } from '$lib/states/reader/ReaderState.svelte';

export class OcrState {
  // --- Raw State ---
  page = $state<MokuroPage | null>(null);
  panzoomInstance = $state<PanzoomObject | null>(null);
  overlayElement = $state<HTMLElement | null>(null);

  pageIndex = $state<number>(-1); // Critical for path generation

  constructor(init?: Partial<OcrState>) {
    Object.assign(this, init);
  }

  // --- Derived State ---

  // Originally calculated in OcrOverlay
  fontScale = $derived.by(() => {
    if (!this.overlayElement || !this.page || !this.panzoomInstance) return 1;

    // We need the rect of the *rendered* container (parent of overlay)
    const container = this.overlayElement.parentElement;
    if (!container) return 1;

    const rect = container.getBoundingClientRect();
    if (!rect.height) return 1;

    // Font scale is ratio of Rendered Height / Image Height / Zoom
    return (
      (rect.height / this.page.img_height / this.panzoomInstance.getScale()) * devicePixelRatio
    );
  });

  imgWidth = $derived(this.page?.img_width ?? 0);
  imgHeight = $derived(this.page?.img_height ?? 0);

  dispatch(
    subPath: string,
    op: 'replace' | 'add' | 'remove' | 'reorder', // Added 'reorder'
    value: unknown,
    oldValue?: unknown,
    newOrder?: number[] // Added specific optional param
  ) {
    if (this.pageIndex === -1) return;

    const patch: PatchOperation = {
      op: op as PatchOperation['op'],
      path: `/pages/${this.pageIndex}/${subPath}`,
      ...(op === 'reorder' ? { new_order: newOrder } : { value, old_value: oldValue })
    } as PatchOperation;

    readerState.dispatch([patch]);
  }
}
