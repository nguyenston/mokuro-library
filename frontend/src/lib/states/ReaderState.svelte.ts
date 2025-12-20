import type { VolumeResponse, MokuroData, MokuroPage } from '$lib/types';

/**
 * Layout modes for the manga reader
 */
export type LayoutMode = 'single' | 'double' | 'vertical';

/**
 * Reading direction for manga pages
 */
export type ReadingDirection = 'ltr' | 'rtl';

/**
 * Page offset for double-page mode (determines if cover page is alone)
 */
export type PageOffset = 'even' | 'odd';

/**
 * Reader state management class using Svelte 5 reactive state.
 * Handles volume data, page navigation, layout modes, and OCR settings.
 * Provides derived state for visible pages and navigation controls.
 */
export class ReaderState {
  // --- Core State ---
  volume = $state<VolumeResponse | null>(null);
  currentPageIndex = $state(0);

  // --- Settings ---
  layoutMode = $state<LayoutMode>('single');
  readingDirection = $state<ReadingDirection>('rtl');
  doublePageOffset = $state<PageOffset>('odd');
  ocrMode = $state<'READ' | 'BOX' | 'TEXT'>('READ');
  isSmartResizeMode = $state(false);

  constructor() { }

  /**
   * Loads volume data and initializes the reader state
   * @param volumeData - The volume response data from the API
   * @param initialPage - The page index to start at (0-based)
   */
  load(volumeData: VolumeResponse, initialPage: number = 0): void {
    this.volume = volumeData;
    this.currentPageIndex = initialPage;
  }

  // --- Getters / Compatibility Layers ---

  get id() {
    return this.volume?.id ?? '';
  }

  get seriesId() {
    return this.volume?.seriesId ?? '';
  }

  get volumeTitle() {
    return this.volume?.title ?? ''; // Use the clean display title from DB
  }

  get seriesTitle() {
    return this.mokuroData?.title ?? '';
  }

  // Compatibility getter so components don't break
  get mokuroData(): MokuroData | null {
    return this.volume?.mokuroData ?? null;
  }

  get pages(): MokuroPage[] {
    return this.volume?.mokuroData.pages ?? [];
  }

  // --- Derived State ---

  get totalPages() {
    return this.mokuroData?.pages.length ?? 0;
  }

  get visiblePages(): MokuroPage[] {
    if (!this.mokuroData) return [];

    const page1Index = this.currentPageIndex;
    const page1 = this.mokuroData.pages[page1Index];
    if (!page1) return [];

    // Vertical & Single Mode: Just return the current page anchor
    if (this.layoutMode === 'single' || this.layoutMode === 'vertical') {
      return [page1];
    }

    // Double Mode Logic
    if (this.layoutMode === 'double') {
      const hasOddOffset = this.doublePageOffset === 'odd';

      // Case 1: Cover page (Index 0) with odd offset is always alone
      if (hasOddOffset && page1Index === 0) {
        return [page1];
      }

      const page2Index = page1Index + 1;
      const page2 = this.mokuroData.pages[page2Index];

      if (!page2) {
        return [page1]; // Last page alone
      }

      // We rely on CSS flex-direction: row-reverse to flip them visually for RTL.
      return [page1, page2];
    }
    return [];
  }

  get hasNext() {
    return this.currentPageIndex < this.totalPages - 1;
  }

  get hasPrev() {
    return this.currentPageIndex > 0;
  }

  // --- Actions ---

  /**
   * Calculate the next page index for double-page mode
   */
  private calculateNextPageIndex(currentIndex: number, hasOddOffset: boolean): number {
    let jump = 2;
    // If we're on the solo cover (index 0), the first jump is only 1
    if (hasOddOffset && currentIndex === 0) {
      jump = 1;
    }
    return Math.min(this.totalPages - 1, currentIndex + jump);
  }

  /**
   * Calculate the previous page index for double-page mode
   */
  private calculatePrevPageIndex(currentIndex: number, hasOddOffset: boolean): number {
    const pageIsEven = currentIndex % 2 === 0;
    let jump = 2;
    // Recover from the clamped state after nextPage
    if (hasOddOffset === pageIsEven) {
      jump = 1;
    }
    return Math.max(0, currentIndex - jump);
  }

  nextPage(): void {
    if (this.layoutMode === 'vertical') return; // disable for vertical
    if (!this.hasNext) return; // at the end

    if (this.layoutMode === 'single') {
      this.currentPageIndex += 1;
      return;
    }

    // Dual Page Logic
    const hasOddOffset = this.doublePageOffset === 'odd';
    this.currentPageIndex = this.calculateNextPageIndex(this.currentPageIndex, hasOddOffset);
  }

  prevPage(): void {
    if (this.layoutMode === 'vertical') return; // disable for vertical
    if (!this.hasPrev) return;

    if (this.layoutMode === 'single') {
      this.currentPageIndex -= 1;
      return;
    }

    // Dual Page Logic
    const hasOddOffset = this.doublePageOffset === 'odd';
    this.currentPageIndex = this.calculatePrevPageIndex(this.currentPageIndex, hasOddOffset);
  }

  /**
   * Sets the current page index with bounds checking
   * @param index - The page index to navigate to (0-based)
   */
  setPage(index: number): void {
    if (index >= 0 && index < this.totalPages) {
      this.currentPageIndex = index;
    }
  }

  /**
   * Sets the layout mode and realigns page index for double-page mode
   * @param mode - The layout mode to set
   */
  setLayout(mode: LayoutMode): void {
    this.layoutMode = mode;

    // Re-align index for Double Page Mode
    if (mode === 'double' && this.currentPageIndex > 0) {
      // Not perfect, can cause page drift if repeatedly toggle even-odd
      const hasOddOffset = this.doublePageOffset === 'odd';
      const pageIsEven = this.currentPageIndex % 2 === 0;
      if (hasOddOffset === pageIsEven) this.currentPageIndex -= 1;
    }
  }

  /**
   * Sets the OCR display mode
   * @param mode - The OCR mode: 'READ' (hidden), 'BOX' (boxes visible), or 'TEXT' (editable)
   */
  setOcrMode(mode: 'READ' | 'BOX' | 'TEXT'): void {
    this.ocrMode = mode;
  }

  /**
   * Toggles smart resize mode for automatic font fitting
   */
  toggleSmartResizeMode(): void {
    this.isSmartResizeMode = !this.isSmartResizeMode;
  }

  /**
   * Toggles the double-page offset and realigns pages if in double mode
   */
  toggleOffset(): void {
    this.doublePageOffset = this.doublePageOffset === 'odd' ? 'even' : 'odd';

    // realign double page
    if (this.layoutMode !== 'double') return;
    if (this.currentPageIndex === 0) return;

    const hasOddOffset = this.doublePageOffset === 'odd';
    const pageIsEven = this.currentPageIndex % 2 === 0;

    // If logic mismatch, shift back one to align the spread
    if (hasOddOffset === pageIsEven) {
      this.currentPageIndex -= 1;
    }
  }
}
