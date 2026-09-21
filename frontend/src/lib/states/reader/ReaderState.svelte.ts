import type {
  Volume,
  MokuroData,
  MokuroPage,
  UserProgress,
  PatchOperation
} from '$lib/types';
import { user, updateSettings, type ReaderSettingsData } from '$lib/stores/authStore';
import { apiFetch } from '$lib/services/api';
import { fromStore } from 'svelte/store';
import { browser } from '$app/environment';
import { untrack } from 'svelte';
import { imageStore, optimizeSrc } from '$lib/stores/cachedImageStore';
import { apiCache } from '$lib/utils/caching/apiCache';
import { PatchApplicator } from '$lib/utils/ocr/PatchApplicator';
import { toastStore } from '$lib/stores/toastStore.svelte';
import { SvelteMap, SvelteSet, SvelteDate } from 'svelte/reactivity';

export type LayoutMode = 'single' | 'double' | 'vertical';
export type ReadingDirection = 'ltr' | 'rtl';
export type UndoRedoResponse = {
  success: boolean;
  newHeadId: string;
  newVersion: number;
  patch: PatchOperation;
};

// How many pages to keep ready in the cache
const PREFETCH_COUNT = 3;
interface PatchTask {
  ops: PatchOperation[];
  resolve: () => void;
  reject: (reason: unknown) => void;
}

class ReaderState {
  // --- Core State ---
  volume = $state<Volume | null>(null);
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
    endHour: 6
  });
  invertColor = $state({
    enabled: false,
    scheduleEnabled: false,
    intensity: 100,
    startHour: 22,
    endHour: 6
  });

  // --- Session State (Not Persisted) ---
  ocrMode = $state<'READ' | 'BOX' | 'TEXT'>('READ');
  isSmartResizeMode = $state(false);
  smartFontCache = new SvelteMap<string, number>();
  now = $state(new SvelteDate()); // for scheduled settings

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

  prefetchUrls = $derived.by(() => {
    if (!this.volume || !this.mokuroData) return [];

    const urls: string[] = [];
    // Calculate start based on visible pages to stay ahead of the view
    const nextStart = this.currentPageIndex + this.visiblePages.length;

    for (let i = 0; i < PREFETCH_COUNT; i++) {
      const targetIndex = nextStart + i;
      if (targetIndex < this.totalPages) {
        const page = this.mokuroData.pages[targetIndex];
        const baseUrl = `/api/files/volume/${this.id}/image/${page.img_path}`;
        const url = optimizeSrc(baseUrl, browser);
        urls.push(url);
      }
    }
    return urls;
  });

  // --- Editing / UI State ---
  focusedLineCoord: [number, number, number] = $state([-1, -1, -1]);
  hasUnsavedChanges = $state(false);
  isSaving = $state(false);
  saveSuccess = $state(false);
  jumpToPage: (pageIndex: number) => void = () => { };
  highlightDurationMs = 1000;
  highlightedBlocks = new SvelteSet<string>();

  // --- Version Control ---
  branchVersion = $state(0);
  isPatching = $state(false);
  private patchQueue: PatchTask[] = [];
  mokuroStagingData = $state<MokuroData | null>(null);
  hasUndo = $derived(!!(this.volume?.id && !this.isPatching));
  hasRedo = $derived(!!(this.volume?.id && !this.isPatching));

  // --- Internals ---
  private initialPageIndex = 0;
  private settingsInitialized = false;
  private canLazyServe = false;
  private cleanupEffectRoot: (() => void) | null = null;
  private progressSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSaveTime: number = 0;
  private highlightTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
        void _;

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
          this.now = new SvelteDate();
        }, 60000);
        return () => clearInterval(interval);
      });

      // prefetch X images ahead for responsiveness
      $effect(() => {
        if (!browser) return;

        // Whenever prefetchUrls changes, tell the store to fetch them
        this.prefetchUrls.forEach((url) => {
          imageStore.get(url).catch(() => { });
        });
      });
    });
  }

  /**
   * Initialize the reader with a volume ID.
   */
  async mount(volumeId: string, options?: { isPreview?: boolean }) {
    await this.cleanup(); // Reset volume data
    this.isLoading = true;
    this.error = null;
    this.canLazyServe = true;
    this.lastSaveTime = Date.now();

    const handleError = (e: unknown) => console.log(`Set fullscreen state failed ${String(e)}`);
    const shouldFullscreen = untrack(() => this.autoFullscreen);
    if (browser && shouldFullscreen && !document.fullscreenElement)
      document.documentElement.requestFullscreen().catch(handleError);

    try {
      await this.loadVolumeData(volumeId, options?.isPreview);
      this.setupVolumeWatchers(volumeId, options?.isPreview);
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
  async cleanup() {
    // 1. Flush pending volume progress save
    if (this.progressSaveTimer) {
      clearTimeout(this.progressSaveTimer);
      this.progressSaveTimer = null;
      if (this.volume?.id) {
        const timeSpent = Math.round((Date.now() - this.lastSaveTime) / 1000);
        await this.saveProgress(this.volume.id, timeSpent);
      }
    }

    // 2. Kill volume-specific watchers
    if (this.cleanupEffectRoot) {
      this.cleanupEffectRoot();
      this.cleanupEffectRoot = null;
    }

    // 3. Reset Volume State Only
    this.canLazyServe = false;
    this.volume = null;
    this.focusedLineCoord = [-1, -1, -1];
    this.hasUnsavedChanges = false;
    this.ocrMode = 'READ';
    this.isSmartResizeMode = false;
    this.smartFontCache = new SvelteMap();
    this.clearHighlightedBlocks();

    // 4. Exit fullscreen if automated
    const handleError = (e: unknown) => console.log(`Set fullscreen state failed ${String(e)}`);
    const shouldExitFullscreen = untrack(() => this.autoFullscreen);
    if (browser && shouldExitFullscreen && document.fullscreenElement)
      document.exitFullscreen().catch(handleError);
  }

  private async loadVolumeData(volumeId: string, isPreview = false) {
    const promises: [Promise<Volume>, Promise<UserProgress | undefined>] = [
      apiFetch<Volume>(`/api/library/volume/${volumeId}`, {
        cache: true,
        onStaleRefetch: (data) => {
          if (this.canLazyServe) this.volume = data as Volume;
        }
      }),
      isPreview
        ? Promise.resolve(undefined)
        : (apiFetch(`/api/metadata/volume/${volumeId}/progress`) as Promise<UserProgress>)
    ];

    const [volData, progressData] = await Promise.all(promises);

    let startPage = 0;
    if (!isPreview && progressData && typeof progressData.page === 'number') {
      startPage = Math.max(0, progressData.page - 1);
    }

    this.volume = volData;
    this.mokuroStagingData = structuredClone(volData.mokuroData);
    this.branchVersion = volData.versionInfo.branchVersion;
    this.currentPageIndex = startPage;
    this.initialPageIndex = startPage;
  }

  private setupVolumeWatchers(volumeId: string, isPreview = false) {
    // scoped to this mount instance
    this.cleanupEffectRoot = $effect.root(() => {
      // Don't save progress in preview mode
      if (!isPreview) {
        $effect(() => {
          const currentPage = this.currentPageIndex;
          if (currentPage !== this.initialPageIndex && this.volume?.id === volumeId) {
            if (this.progressSaveTimer) clearTimeout(this.progressSaveTimer);
            this.progressSaveTimer = setTimeout(() => {
              const timeSpent = Math.round((Date.now() - this.lastSaveTime) / 1000); // in seconds
              this.saveProgress(volumeId, timeSpent);
              this.lastSaveTime = Date.now();
            }, 2000);
          }
        });
      }

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


      $effect(() => {
        // Auto-complete volume when reaching the last page
        if (
          this.autoCompleteVolume &&
          this.mokuroStagingData &&
          this.visiblePages[this.visiblePages.length - 1].index === this.mokuroStagingData.pages.length - 1
        ) {
          this.markVolumeComplete();
        }
      });
    });
  }

  // --- Saving Logic ---
  /**
   * Entry point for components to request changes.
   * 1. Applies ALL operations immediately to 'staging' (Optimistic UI).
   * 2. Enqueues the batch as a single Task to be processed sequentially.
   */
  async dispatch(ops: PatchOperation[]) {
    if (!this.volume?.id || ops.length === 0) return;

    if (!this.mokuroStagingData) {
      console.error('ReaderState: Cannot dispatch, staging data missing.');
      return;
    }

    // 1. Optimistic Update (Batch)
    // The UI updates instantly for all ops in the array
    try {
      PatchApplicator.applyAll(this.mokuroStagingData, ops);
    } catch (e) {
      console.error('ReaderState: Optimistic apply failed', e);
      toastStore.error(`Invalid Patch: ${String(e)}`);
      return;
    }

    for (const op of ops) {
      toastStore.info(`applied patch ${op}`);
    }

    // 2. Queue for Serial Execution
    return new Promise<void>((resolve, reject) => {
      this.patchQueue.push({ ops, resolve, reject });
      if (!this.isPatching) {
        this.processQueue();
      }
    });
  }

  /**
   * Serial Processor
   * Handles "One Patch at a Time" constraint.
   * If a Task has 50 ops, it sends 50 distinct HTTP requests sequentially.
   */
  private async processQueue() {
    if (this.patchQueue.length === 0) {
      this.isPatching = false;
      return;
    }

    this.isPatching = true;

    while (this.patchQueue.length > 0) {
      const task = this.patchQueue[0];

      try {
        // Iterate through the batch and send 1-by-1
        for (const op of task.ops) {
          const res = await apiFetch<{ patch: PatchOperation; newVersion: number }>(
            `/api/library/volume/${this.volume!.id}/patch`,
            {
              method: 'POST',
              body: {
                operation: op,
                branchVersion: this.branchVersion
              }
            }
          );

          // Update Authoritative State (Committed) step-by-step
          // This keeps 'committed' strictly in sync with the server's truth
          if (this.volume?.mokuroData && res.patch) {
            PatchApplicator.apply(this.volume.mokuroData, res.patch);
          }

          // Update Version (Critical for the next iteration of the loop)
          if (res.newVersion) {
            this.branchVersion = res.newVersion;
          }
        }

        // Entire batch succeeded
        task.resolve();
      } catch (e) {
        console.error('Patch Dispatch Failed:', e);
        toastStore.error('Sync failed.');

        // If the batch fails halfway, 'staging' is now ahead of 'committed'
        // in a way that might not be reconcilable.
        // In a full implementation, you might force a re-fetch here.
        task.reject(e);
      } finally {
        this.patchQueue.shift(); // Remove task
      }
    }

    this.isPatching = false;
  }

  async undo() {
    // The getter now handles the checks, but we keep the guard for safety
    if (!this.hasUndo) return;
    await this.performVersionOp('undo');
  }

  async redo() {
    if (!this.hasRedo) return;
    await this.performVersionOp('redo');
  }

  private async performVersionOp(op: 'undo' | 'redo') {
    this.isPatching = true;
    try {
      // 1. Call API
      // Response matches UserAPIAccessStrategy: { success, newHeadId, newVersion, patch }
      const res = await apiFetch<UndoRedoResponse>(`/api/library/volume/${this.volume!.id}/${op}`, {
        method: 'POST',
        body: { branchVersion: this.branchVersion }
      });

      // 2. Apply the Single Patch (Inverse or Original)
      if (this.volume?.mokuroData && res.patch) {
        const parts = res.patch.path.split('/').filter((x) => x);
        const op = res.patch.op;
        if (op !== 'genesis') {
          const pageIndex = parseInt(parts[1]);
          this.jumpToPage(pageIndex);
          this.highlightBlocksFromPath(res.patch.path);
        }

        // Apply to COMMITTED (Server Truth)
        PatchApplicator.apply(this.volume.mokuroData, res.patch);

        // Apply to STAGING (UI)
        // We must apply it to staging to see the revert/redo visually
        if (this.mokuroStagingData) {
          PatchApplicator.apply(this.mokuroStagingData, res.patch);
        }
      }

      // 3. Update Versioning
      if (res.newVersion) {
        this.branchVersion = res.newVersion;
      }

      // 4. Update Flags & Head Pointer
      // Since backend doesn't return full versionInfo, we must update optimistically/logically
      if (this.volume?.versionInfo) {
        this.volume.versionInfo.branchVersion = res.newVersion;
        this.volume.versionInfo.headPatchId = res.newHeadId;
      }
    } catch (e) {
      console.error(`${op} failed:`, e);
    } finally {
      this.isPatching = false;
    }
  }

  private highlightBlocksFromPath(path: string) {
    const match = path.match(/\/pages\/(\d+)\/blocks\/(\d+)/);
    if (!match) return;
    const pageIndex = Number(match[1]);
    const blockIndex = Number(match[2]);
    if (Number.isNaN(pageIndex) || Number.isNaN(blockIndex)) return;
    this.highlightBlocks([{ pageIndex, blockIndex }]);
  }

  private highlightBlocks(blocks: Array<{ pageIndex: number; blockIndex: number }>) {
    if (blocks.length === 0) return;
    for (const block of blocks) {
      const key = `${block.pageIndex}:${block.blockIndex}`;
      const existing = this.highlightTimers.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        this.highlightedBlocks.delete(key);
        this.highlightTimers.delete(key);
      }, this.highlightDurationMs);
      this.highlightTimers.set(key, timer);
      this.highlightedBlocks.add(key);
    }
  }

  private clearHighlightedBlocks() {
    for (const timer of this.highlightTimers.values()) {
      clearTimeout(timer);
    }
    this.highlightTimers.clear();
    this.highlightedBlocks.clear();
  }

  private async saveProgress(volumeId: string, timeSpent: number) {
    if (!this.volume) return;

    let charsRead = 0;
    if (this.mokuroData) {
      for (let i = this.initialPageIndex; i < this.currentPageIndex; i++) {
        const page = this.mokuroData.pages[i];
        if (page) {
          for (const block of page.blocks) {
            for (const line of block.lines) {
              charsRead += line.length;
            }
          }
        }
      }
    }

    try {
      const { seriesId } = await apiFetch<{ seriesId: string }>(
        `/api/metadata/volume/${volumeId}/progress`,
        {
          method: 'PATCH',
          body: {
            page: this.currentPageIndex + 1,
            timeRead: timeSpent,
            charsRead: charsRead
          }
        }
      );
      apiCache.invalidateSeriesCache({ seriesId: seriesId ?? undefined });
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

  get id() {
    return this.volume?.id ?? '';
  }
  get seriesId() {
    return this.volume?.seriesId ?? '';
  }
  get volumeTitle() {
    return this.volume?.title ?? '';
  }
  get seriesTitle() {
    return this.mokuroData?.title ?? '';
  }
  get mokuroData(): MokuroData | null {
    return this.volume?.mokuroData ?? null;
  }
  get pages(): MokuroPage[] {
    return this.volume?.mokuroData.pages ?? [];
  }
  get totalPages() {
    return this.mokuroData?.pages.length ?? 0;
  }

  visiblePages: (MokuroPage & { index: number })[] = $derived.by(() => {
    if (!this.mokuroStagingData) return [];

    const page1Index = this.currentPageIndex;
    const page1 = this.mokuroStagingData.pages[page1Index];
    if (!page1) return [];

    if (this.layoutMode === 'single' || this.layoutMode === 'vertical') {
      return [{ ...page1, index: page1Index }];
    }

    if (this.layoutMode === 'double') {
      // If first page is cover and we're on page 1, show it alone
      if (this.firstPageIsCover && page1Index === 0) {
        return [{ ...page1, index: page1Index }];
      }

      const page2Index = page1Index + 1;
      const page0Index = page1Index - 1;
      const page2 = this.mokuroStagingData.pages[page2Index];
      const page0 = this.mokuroStagingData.pages[page0Index];

      const page1IsEven = page1Index % 2 === 0;

      let firstPage;
      let secondPage;
      if (this.firstPageIsCover === page1IsEven) {
        firstPage = page0 ? { ...page0, index: page0Index } : undefined;
        secondPage = { ...page1, index: page1Index };
      } else {
        firstPage = { ...page1, index: page1Index };
        secondPage = page2 ? { ...page2, index: page2Index } : undefined;
      }

      return [
        firstPage,
        secondPage
      ].filter(Boolean) as (MokuroPage & { index: number })[];
    }
    return [];
  });

  get hasNext() {
    return this.currentPageIndex < this.totalPages - 1;
  }
  get hasPrev() {
    return this.currentPageIndex > 0;
  }

  // --- Actions ---

  nextPage() {
    if (this.layoutMode === 'vertical') return;
    if (!this.hasNext) return;


    let jump = 0;
    if (this.layoutMode === 'single') {
      jump = 1;
    }
    if (this.layoutMode === 'double') {
      jump = 2;
    }

    this.currentPageIndex = Math.min(this.totalPages - 1, this.currentPageIndex + jump);
  }

  prevPage() {
    if (this.layoutMode === 'vertical') return;
    if (!this.hasPrev) return;

    let jump = 0;
    if (this.layoutMode === 'single') {
      jump = 1;
    }
    if (this.layoutMode === 'double') {
      jump = 2;
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
    if (mode === 'READ') {
      this.unsetFocusedLine();
    }
  }

  toggleSmartResizeMode() {
    this.isSmartResizeMode = !this.isSmartResizeMode;
  }

  onOcrChange() {
    this.hasUnsavedChanges = true;
  }

  unsetFocusedLine() {
    if (this.volume?.mokuroData)
      this.mokuroStagingData = $state.snapshot(this.volume).mokuroData as MokuroData;
    this.focusedLineCoord = [-1, -1, -1];
  }

  setFocusedLine(pageIndex: number, blockIndex: number, lineIndex: number) {
    // 1. Guard: Staging data must exist
    if (!this.mokuroStagingData) {
      console.warn('setFocusedLine called before data loaded');
      return;
    }

    // 2. Validate Page
    const page = this.mokuroStagingData.pages[pageIndex];
    if (!page) {
      console.warn(`setFocusedLine: Invalid page index ${pageIndex}`);
      return;
    }

    // 3. Validate Block
    const block = page.blocks[blockIndex];
    if (!block) {
      console.warn(`setFocusedLine: Invalid block index ${blockIndex} on page ${pageIndex}`);
      return;
    }

    // 4. Validate Line
    // We check against block.lines array length
    if (lineIndex < 0 || lineIndex >= block.lines.length) {
      console.warn(`setFocusedLine: Invalid line index ${lineIndex} on block ${blockIndex}`);
      return;
    }

    // 5. Apply
    this.focusedLineCoord = [pageIndex, blockIndex, lineIndex];
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
