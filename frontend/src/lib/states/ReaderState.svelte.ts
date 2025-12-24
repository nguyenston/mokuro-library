import type { VolumeReaderResponse, MokuroData, MokuroPage, MokuroBlock } from '$lib/types';
import { user, updateSettings, type ReaderSettingsData } from '$lib/authStore';
import { apiFetch } from '$lib/api';
import { fromStore, get } from 'svelte/store';
import { browser } from '$app/environment';
import { untrack } from 'svelte';

export type LayoutMode = 'single' | 'double' | 'vertical';
export type ReadingDirection = 'ltr' | 'rtl';

class ReaderState {
  // --- Core State ---
  volume = $state<VolumeReaderResponse | null>(null);
  currentPageIndex = $state(0);
  isLoading = $state(true);
  error = $state<string | null>(null);
  user = fromStore(user);

  // --- Persisted Settings ---
  layoutMode = $state<LayoutMode>('single');
  readingDirection = $state<ReadingDirection>('rtl');
  firstPageIsCover = $state(false);
  retainZoom = $state(false);
  navZoneWidth = $state(15);
  showTriggerOutline = $state(false);
  autoFullscreen = $state(false);
  hideHUD = $state(false);
  autoCompleteVolume = $state(false);
  nightMode = $state({
    enabled: false,
    scheduleEnabled: false,
    intensity: 100,
    redShift: 0,
    startHour: 22,
    endHour: 6,
  });
  invertColor = $state({
    enabled: false,
    scheduleEnabled: false,
    intensity: 100,
    startHour: 22,
    endHour: 6,
  });

  // --- Session State (Not Persisted) ---
  ocrMode = $state<'READ' | 'BOX' | 'TEXT'>('READ');
  isSmartResizeMode = $state(false);
  now = $state(new Date()); // for scheduled settings

  isNightModeActive = $derived.by(() => {
    if (!readerState.nightMode.enabled) return false;
    if (!readerState.nightMode.scheduleEnabled) return true;
    const h = this.now.getHours();
    const startHour = readerState.nightMode.startHour;
    const endHour = readerState.nightMode.endHour;
    if (startHour <= endHour) {
      return h >= startHour && h < endHour;
    } else {
      return h >= startHour || h < endHour;
    }
  });

  isInvertActive = $derived.by(() => {
    if (!readerState.invertColor.enabled) return false;
    if (!readerState.invertColor.scheduleEnabled) return true;
    const h = this.now.getHours();
    const startHour = readerState.invertColor.startHour;
    const endHour = readerState.invertColor.endHour;
    if (startHour <= endHour) {
      return h >= startHour && h < endHour;
    } else {
      return h >= startHour || h < endHour;
    }
  });

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
        const userData = this.user.current;
        if (userData && !this.settingsInitialized) {
          const s = userData.settings;

          // Apply DB values to state
          if (s.layoutMode) this.layoutMode = s.layoutMode;
          if (s.readingDirection) this.readingDirection = s.readingDirection;
          if (s.nightMode) this.nightMode = s.nightMode;
          if (s.invertColor) this.invertColor = s.invertColor;
          if (s.autoFullscreen !== undefined) this.autoFullscreen = s.autoFullscreen;
          if (s.hideHUD !== undefined) this.hideHUD = s.hideHUD;
          if (s.firstPageIsCover !== undefined) this.firstPageIsCover = s.firstPageIsCover;
          if (s.retainZoom !== undefined) this.retainZoom = s.retainZoom;
          if (s.navZoneWidth !== undefined) this.navZoneWidth = s.navZoneWidth;
          if (s.showTriggerOutline !== undefined) this.showTriggerOutline = s.showTriggerOutline;
          if (s.autoCompleteVolume !== undefined) this.autoCompleteVolume = s.autoCompleteVolume;

          this.settingsInitialized = true;
        }
      });

      // 2. Watch Settings -> Save to DB (One-way: State -> DB)
      $effect(() => {
        // Dependency tracking
        const _ = {
          l: this.layoutMode,
          d: this.readingDirection,
          a: this.autoFullscreen,
          h: this.hideHUD,
          b: this.nightMode,
          i: this.invertColor,
          c: this.firstPageIsCover,
          z: this.retainZoom,
          n: this.navZoneWidth,
          t: this.showTriggerOutline,
          ac: this.autoCompleteVolume
        };

        // Don't save if we haven't loaded initial values yet (prevents overwriting DB with defaults)
        if (!this.settingsInitialized) return;

        if (this.settingsSaveTimer) clearTimeout(this.settingsSaveTimer);
        this.settingsSaveTimer = setTimeout(() => {
          this.settingsSaveTimer = null;
          this.saveSettings();
        }, 2000);
      });

      // Update "now" for scheduled settings
      $effect(() => {
        const interval = setInterval(() => {
          this.now = new Date();
        }, 60000);
        return () => clearInterval(interval);
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

    const handleError = (e: any) => console.log(`Set fullscreen state failed ${e}`);
    const shouldFullscreen = untrack(() => this.autoFullscreen);
    if (browser && shouldFullscreen && !document.fullscreenElement)
      document.documentElement.requestFullscreen().catch(handleError);

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
      this.progressSaveTimer = null;
      if (this.volume?.id) this.saveProgress(this.volume.id);
    }

    // 2. Kill volume-specific watchers
    if (this.cleanupEffectRoot) {
      this.cleanupEffectRoot();
      this.cleanupEffectRoot = null;
    }

    // 3. Reset Volume State Only
    this.volume = null;
    this.focusedBlock = null;
    this.focusedPage = null;
    this.hasUnsavedChanges = false;

    // 4. Exit fullscreen if automated
    const handleError = (e: any) => console.log(`Set fullscreen state failed ${e}`);
    const shouldExitFullscreen = untrack(() => this.autoFullscreen);
    if (browser && shouldExitFullscreen && document.fullscreenElement)
      document.exitFullscreen().catch(handleError);
  }

  private async loadVolumeData(volumeId: string) {
    const [volData, progressData] = await Promise.all([
      apiFetch(`/api/library/volume/${volumeId}`) as Promise<VolumeReaderResponse>,
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

      $effect(() => {
        const b = this.isNightModeActive ? this.nightMode.intensity : 100;
        const redShift = this.isNightModeActive ? this.nightMode.redShift : 0;

        // Smart Invert Logic:
        // If active, fully invert (100%), but use intensity to adjust brightness (so it's not too harsh).
        // We map intensity 0-100 to brightness 40%-100% to ensure text remains visible.
        const inv = this.isInvertActive ? 100 : 0;
        const invBright = this.isInvertActive ? 40 + this.invertColor.intensity * 0.6 : 100;

        document.documentElement.style.setProperty('--reader-brightness', `${b}%`);
        document.documentElement.style.setProperty('--reader-invert', `${inv}%`);
        document.documentElement.style.setProperty('--reader-invert-brightness', `${invBright}%`);
        document.documentElement.style.setProperty('--reader-red-shift', `${redShift}%`);
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
      const currentSettings: ReaderSettingsData = {
        layoutMode: this.layoutMode,
        readingDirection: this.readingDirection,
        autoFullscreen: this.autoFullscreen,
        hideHUD: this.hideHUD,
        nightMode: this.nightMode,
        invertColor: this.invertColor,
        firstPageIsCover: this.firstPageIsCover,
        retainZoom: this.retainZoom,
        navZoneWidth: this.navZoneWidth,
        showTriggerOutline: this.showTriggerOutline,
        autoCompleteVolume: this.autoCompleteVolume
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
      // If first page is cover and we're on page 1, show it alone
      if (this.firstPageIsCover && page1Index === 0) {
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
      // Auto-complete volume when reaching the last page
      if (this.autoCompleteVolume && this.currentPageIndex === this.totalPages - 1 && this.volume?.id) {
        this.markVolumeComplete();
      }
      return;
    }

    // In double mode: jump by 2, unless we're on the cover (page 0) and firstPageIsCover is true
    let jump = 2;
    if (this.firstPageIsCover && this.currentPageIndex === 0) {
      jump = 1;
    }
    this.currentPageIndex = Math.min(this.totalPages - 1, this.currentPageIndex + jump);

    // Auto-complete volume when reaching the last page
    if (this.autoCompleteVolume && this.currentPageIndex === this.totalPages - 1 && this.volume?.id) {
      this.markVolumeComplete();
    }
  }

  prevPage() {
    if (this.layoutMode === 'vertical') return;
    if (!this.hasPrev) return;

    if (this.layoutMode === 'single') {
      this.currentPageIndex -= 1;
      return;
    }

    // In double mode: jump by 2, but handle cover page specially
    let jump = 2;
    if (this.firstPageIsCover && this.currentPageIndex === 1) {
      jump = 1; // From page 1 (after cover), go back to page 0 (cover)
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
    // No special adjustment needed with firstPageIsCover - pages align naturally
  }

  setOcrMode(mode: 'READ' | 'BOX' | 'TEXT') {
    this.ocrMode = mode;
    if (mode === 'READ') this.focusedBlock = null;
  }

  toggleSmartResizeMode() {
    this.isSmartResizeMode = !this.isSmartResizeMode;
  }

  onOcrChange() {
    this.hasUnsavedChanges = true;
  }

  setFocusedBlock(block: MokuroBlock | null, page: MokuroPage | null) {
    this.focusedBlock = block;
    this.focusedPage = page;
  }

  async markVolumeComplete() {
    if (!this.volume?.id) return;
    try {
      await apiFetch(`/api/metadata/volume/${this.volume.id}/progress`, {
        method: 'PATCH',
        body: { completed: true }
      });
    } catch (e) {
      console.error('Failed to mark volume as complete', e);
    }
  }
}

// Export Singleton
export const readerState = new ReaderState();
