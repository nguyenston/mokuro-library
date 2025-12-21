import type { VolumeResponse, MokuroData, MokuroPage, MokuroBlock } from '$lib/types';
import { user, updateSettings, type ReaderSettingsData } from '$lib/authStore';
import { apiFetch } from '$lib/api';
import { get } from 'svelte/store';
import { browser } from '$app/environment';

export type LayoutMode = 'single' | 'double' | 'vertical';
export type ReadingDirection = 'ltr' | 'rtl';
export type PageOffset = 'even' | 'odd';

class ReaderState {
  // --- Core State ---
  volume = $state<VolumeResponse | null>(null);
  currentPageIndex = $state(0);
  isLoading = $state(true);
  error = $state<string | null>(null);

  // --- Persisted Settings ---
  layoutMode = $state<LayoutMode>('single');
  readingDirection = $state<ReadingDirection>('rtl');
  doublePageOffset = $state<PageOffset>('odd');
  retainZoom = $state(false);
  navZoneWidth = $state(15);
  showTriggerOutline = $state(false);

  // --- Session State (Not Persisted) ---
  ocrMode = $state<'READ' | 'BOX' | 'TEXT'>('READ');
  isSmartResizeMode = $state(false);

  // --- Editing / UI State ---
  focusedBlock = $state<MokuroBlock | null>(null);
  focusedPage = $state<MokuroPage | null>(null);
  hasUnsavedChanges = $state(false);
  isSaving = $state(false);
  saveSuccess = $state(false);

  // --- Internals ---
  private initialPageIndex = 0;
  private settingsInitialized = false;
  private cleanupEffectRoot: (() => void) | null = null;
  private progressSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Global Watchers: These run for the lifetime of the app
    $effect.root(() => {

      // 1. Sync Settings from User Store (One-way: DB -> State)
      // This ensures settings are loaded even if we are just on the Settings page
      $effect(() => {
        const userData = get(user); // Access store value
        if (userData && !this.settingsInitialized) {
          const s = userData.settings;

          // Apply DB values to state
          if (s.layoutMode) this.layoutMode = s.layoutMode;
          if (s.readingDirection) this.readingDirection = s.readingDirection;
          if (s.doublePageOffset) this.doublePageOffset = s.doublePageOffset;
          if (s.retainZoom !== undefined) this.retainZoom = s.retainZoom;
          if (s.navZoneWidth !== undefined) this.navZoneWidth = s.navZoneWidth;
          if (s.showTriggerOutline !== undefined) this.showTriggerOutline = s.showTriggerOutline;

          this.settingsInitialized = true;
        }
      });

      // 2. Watch Settings -> Save to DB (One-way: State -> DB)
      $effect(() => {
        // Dependency tracking
        const _ = {
          l: this.layoutMode,
          d: this.readingDirection,
          o: this.doublePageOffset,
          z: this.retainZoom,
          n: this.navZoneWidth,
          t: this.showTriggerOutline
        };

        // Don't save if we haven't loaded initial values yet (prevents overwriting DB with defaults)
        if (!this.settingsInitialized) return;

        if (this.settingsSaveTimer) clearTimeout(this.settingsSaveTimer);
        this.settingsSaveTimer = setTimeout(() => {
          this.saveSettings();
        }, 2000);
      });
    });
  }

  /**
   * Initialize the reader with a volume ID.
   */
  async mount(volumeId: string) {
    this.cleanup(); // Reset volume data
    this.isLoading = true;
    this.error = null;

    try {
      await this.loadVolumeData(volumeId);
      this.setupVolumeWatchers(volumeId);
    } catch (e) {
      console.error('Reader Load Error:', e);
      this.error = (e as Error).message;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Cleanup method called when leaving the reader page.
   */
  cleanup() {
    // 1. Flush pending volume progress save
    if (this.progressSaveTimer) {
      clearTimeout(this.progressSaveTimer);
      if (this.volume?.id) this.saveProgress(this.volume.id);
    }

    // 2. Kill volume-specific watchers
    if (this.cleanupEffectRoot) {
      this.cleanupEffectRoot();
      this.cleanupEffectRoot = null;
    }

    this.progressSaveTimer = null;

    // 3. Reset Volume State Only
    this.volume = null;
    this.focusedBlock = null;
    this.focusedPage = null;
    this.hasUnsavedChanges = false;
    // DO NOT reset settingsInitialized or settingsSaveTimer
  }

  private async loadVolumeData(volumeId: string) {
    const [volData, progressData] = await Promise.all([
      apiFetch(`/api/library/volume/${volumeId}`) as Promise<VolumeResponse>,
      apiFetch(`/api/metadata/volume/${volumeId}/progress`)
    ]);

    let startPage = 0;
    if (progressData && typeof progressData.page === 'number') {
      startPage = Math.max(0, progressData.page - 1);
    }

    this.volume = volData;
    this.currentPageIndex = startPage;
    this.initialPageIndex = startPage;
  }

  private setupVolumeWatchers(volumeId: string) {
    // scoped to this mount instance
    this.cleanupEffectRoot = $effect.root(() => {
      $effect(() => {
        const currentPage = this.currentPageIndex;
        if (currentPage !== this.initialPageIndex && this.volume?.id === volumeId) {
          if (this.progressSaveTimer) clearTimeout(this.progressSaveTimer);
          this.progressSaveTimer = setTimeout(() => {
            this.saveProgress(volumeId);
          }, 2000);
        }
      });
    });
  }

  // --- Saving Logic ---

  private async saveProgress(volumeId: string) {
    if (!this.volume) return;
    try {
      await apiFetch(`/api/metadata/volume/${volumeId}/progress`, {
        method: 'PATCH',
        body: { page: this.currentPageIndex + 1 }
      });
      this.initialPageIndex = this.currentPageIndex;
    } catch (e) {
      console.error('Failed to save progress', e);
    }
  }

  private async saveSettings() {
    try {
      const currentSettings: Partial<ReaderSettingsData> = {
        layoutMode: this.layoutMode,
        readingDirection: this.readingDirection,
        doublePageOffset: this.doublePageOffset,
        retainZoom: this.retainZoom,
        navZoneWidth: this.navZoneWidth,
        showTriggerOutline: this.showTriggerOutline
      };
      await updateSettings(currentSettings);
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  async saveOcr() {
    if (!this.volume || !this.volume.mokuroData || this.isSaving) return;

    this.isSaving = true;
    this.saveSuccess = false;
    this.error = null;

    try {
      await apiFetch(`/api/library/volume/${this.volume.id}/ocr`, {
        method: 'PUT',
        body: this.volume.mokuroData.pages
      });
      this.saveSuccess = true;
      this.hasUnsavedChanges = false;
      setTimeout(() => (this.saveSuccess = false), 3000);
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.isSaving = false;
    }
  }

  // --- Getters / Compatibility ---

  get id() { return this.volume?.id ?? ''; }
  get seriesId() { return this.volume?.seriesId ?? ''; }
  get volumeTitle() { return this.volume?.title ?? ''; }
  get seriesTitle() { return this.mokuroData?.title ?? ''; }
  get mokuroData(): MokuroData | null { return this.volume?.mokuroData ?? null; }
  get pages(): MokuroPage[] { return this.volume?.mokuroData.pages ?? []; }
  get totalPages() { return this.mokuroData?.pages.length ?? 0; }

  get visiblePages(): MokuroPage[] {
    if (!this.mokuroData) return [];

    const page1Index = this.currentPageIndex;
    const page1 = this.mokuroData.pages[page1Index];
    if (!page1) return [];

    if (this.layoutMode === 'single' || this.layoutMode === 'vertical') {
      return [page1];
    }

    if (this.layoutMode === 'double') {
      const hasOddOffset = this.doublePageOffset === 'odd';
      if (hasOddOffset && page1Index === 0) {
        return [page1];
      }

      const page2Index = page1Index + 1;
      const page2 = this.mokuroData.pages[page2Index];

      if (!page2) {
        return [page1];
      }
      return [page1, page2];
    }
    return [];
  }

  get hasNext() { return this.currentPageIndex < this.totalPages - 1; }
  get hasPrev() { return this.currentPageIndex > 0; }

  // --- Actions ---

  nextPage() {
    if (this.layoutMode === 'vertical') return;
    if (!this.hasNext) return;

    if (this.layoutMode === 'single') {
      this.currentPageIndex += 1;
      return;
    }

    const hasOddOffset = this.doublePageOffset === 'odd';
    let jump = 2;
    if (hasOddOffset && this.currentPageIndex === 0) {
      jump = 1;
    }
    this.currentPageIndex = Math.min(this.totalPages - 1, this.currentPageIndex + jump);
  }

  prevPage() {
    if (this.layoutMode === 'vertical') return;
    if (!this.hasPrev) return;

    if (this.layoutMode === 'single') {
      this.currentPageIndex -= 1;
      return;
    }

    const hasOddOffset = this.doublePageOffset === 'odd';
    const pageIsEven = this.currentPageIndex % 2 === 0;
    let jump = 2;
    if (hasOddOffset === pageIsEven) {
      jump = 1;
    }
    this.currentPageIndex = Math.max(0, this.currentPageIndex - jump);
  }

  setPage(index: number) {
    if (index >= 0 && index < this.totalPages) {
      this.currentPageIndex = index;
    }
  }

  setLayout(mode: LayoutMode) {
    this.layoutMode = mode;
    if (mode === 'double' && this.currentPageIndex > 0) {
      const hasOddOffset = this.doublePageOffset === 'odd';
      const pageIsEven = this.currentPageIndex % 2 === 0;
      if (hasOddOffset === pageIsEven) this.currentPageIndex -= 1;
    }
  }

  setOcrMode(mode: 'READ' | 'BOX' | 'TEXT') {
    this.ocrMode = mode;
    if (mode === 'READ') this.focusedBlock = null;
  }

  toggleSmartResizeMode() {
    this.isSmartResizeMode = !this.isSmartResizeMode;
  }

  toggleOffset() {
    this.doublePageOffset = this.doublePageOffset === 'odd' ? 'even' : 'odd';
    if (this.layoutMode !== 'double') return;
    if (this.currentPageIndex === 0) return;

    const hasOddOffset = this.doublePageOffset === 'odd';
    const pageIsEven = this.currentPageIndex % 2 === 0;

    if (hasOddOffset === pageIsEven) {
      this.currentPageIndex -= 1;
    }
  }

  onOcrChange() {
    this.hasUnsavedChanges = true;
  }

  setFocusedBlock(block: MokuroBlock | null, page: MokuroPage | null) {
    this.focusedBlock = block;
    this.focusedPage = page;
  }
}

// Export Singleton
export const readerState = new ReaderState();
