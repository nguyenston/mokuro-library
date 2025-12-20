import { type PanzoomObject } from '@panzoom/panzoom';
import type { MokuroBlock, MokuroPage } from '$lib/types';

/**
 * OCR state management class using Svelte 5 reactive state.
 * Manages OCR overlay display, editing modes, and page-level OCR data.
 * Coordinates with panzoom for proper scaling and positioning.
 */
export class OcrState {
  // --- Raw State ---
  page = $state<MokuroPage | null>(null);
  panzoomInstance = $state<PanzoomObject | null>(null);
  overlayElement = $state<HTMLElement | null>(null);

  // --- Modes ---
  ocrMode = $state<'READ' | 'BOX' | 'TEXT'>('READ');
  isSmartResizeMode = $state(false);
  showTriggerOutline = $state(false);
  readingDirection = $state('rtl');

  // --- Focus Tracking ---
  focusedBlock = $state<MokuroBlock | null>(null);

  // --- Callbacks (Injected) ---
  onOcrChange = $state<() => void>(() => { });
  // This function is purely to coordinate font slider logic on the top-level
  // I should rethink this
  onLineFocus = $state<(block: MokuroBlock | null, page: MokuroPage | null) => void>(() => { });
  onChangeMode = $state<(state: 'READ' | 'BOX' | 'TEXT') => void>(() => { });

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
    return rect.height / this.page.img_height / this.panzoomInstance.getScale() * devicePixelRatio;
  });

  imgWidth = $derived(this.page?.img_width ?? 0);
  imgHeight = $derived(this.page?.img_height ?? 0);

  // --- Actions ---

  /**
   * Marks OCR data as modified, triggering the onChange callback
   */
  markDirty() {
    this.onOcrChange();
  }

  /**
   * Sets the OCR mode and triggers the mode change callback
   * @param mode - The OCR mode to set
   */
  setMode(mode: 'READ' | 'BOX' | 'TEXT') {
    this.onChangeMode(mode);
  }

  /**
   * Sets the currently focused OCR block
   * @param block - The block to focus, or null to clear focus
   */
  setFocus(block: MokuroBlock | null) {
    this.focusedBlock = block;
    this.onLineFocus(block, this.page);
  }
}
