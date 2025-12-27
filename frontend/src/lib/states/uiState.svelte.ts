import { SvelteMap } from 'svelte/reactivity';
import type { Series, Volume, LibraryItem } from '$lib/types';

export type AppContext = 'library' | 'series' | 'reader' | 'settings';
export type ViewMode = 'grid' | 'list';
export type SortOrder = 'asc' | 'desc';
export type SortKey = 'title' | 'updated' | 'lastRead' | 'progress';
export type FilterStatus = 'all' | 'reading' | 'read' | 'unread';
export type FilterOrganization = 'all' | 'organized' | 'unorganized';
export type FilterMissing = 'none' | 'cover' | 'description' | 'title' | 'any';

class UiState {
  // --- Context & Navigation ---
  context = $state<AppContext>('library');
  appTitle = $state('Library');
  activeId = $state<string | null>(null);

  // --- Search & View ---
  searchQuery = $state('');
  viewMode = $state<ViewMode>('grid');

  // --- Sorting & Filtering ---
  sortKey = $state<SortKey>('title');
  sortOrder = $state<SortOrder>('asc');
  filterStatus = $state<FilterStatus>('all');
  filterBookmarked = $state(false);
  filterOrganization = $state<FilterOrganization>('all');
  filterMissing = $state<FilterMissing>('none');

  // --- Data Freshness ---
  // Simple counter to force re-fetches
  libraryVersion = $state(0);

  // --- Selection Mode ---
  isSelectionMode = $state(false);
  selection = new SvelteMap<string, LibraryItem>();

  // --- Modals (Global Visibility) ---
  isUploadOpen = $state(false);
  isStatsOpen = $state(false);
  isAboutOpen = $state(false);
  isAppearanceOpen = $state(false);

  // --- Options Configuration ---
  availableSorts = $state<{ key: SortKey; label: string }[]>([
    { key: 'title', label: 'Title' },
    { key: 'updated', label: 'Last Updated' },
    { key: 'lastRead', label: 'Recent' }
  ]);

  constructor() {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('mokuro_view_mode');
      if (savedView === 'grid' || savedView === 'list') {
        this.viewMode = savedView;
      }
    }
  }

  get selectedIdsArray(): string[] {
    return Array.from(this.selection.keys());
  }

  // --- Actions ---

  refreshLibrary() {
    this.libraryVersion += 1;
  }

  setContext(ctx: AppContext, title: string, sorts: { key: SortKey; label: string }[], id: string | null = null) {
    if (this.context === ctx && this.activeId === id) return;

    this.context = ctx;
    this.appTitle = title;
    this.availableSorts = sorts;
    this.activeId = id;

    // Reset transient states
    this.searchQuery = '';
    this.isSelectionMode = false;
    this.selection.clear();
    this.filterStatus = 'all';
    this.filterBookmarked = false;

    if (ctx === 'library') {
      this.sortKey = 'title';
      this.sortOrder = 'asc';
    } else if (ctx === 'series') {
      this.sortKey = 'title';
      this.sortOrder = 'asc';
    }
  }

  enterSelectionMode(initialItem: LibraryItem) {
    if (this.isSelectionMode) return;
    this.selection.clear();
    this.isSelectionMode = true;
    this.selection.set(initialItem.id, initialItem);
  }

  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selection.clear();
  }

  toggleSelectionMode() {
    this.isSelectionMode = !this.isSelectionMode;
    if (!this.isSelectionMode) {
      this.selection.clear();
    }
  }

  toggleSelection(item: LibraryItem) {
    if (this.selection.has(item.id)) {
      this.selection.delete(item.id);
    } else {
      this.selection.set(item.id, item);
    }
  }

  selectAll(items: LibraryItem[]) {
    for (const item of items) {
      this.selection.set(item.id, item);
    }
  }

  deselectAll() {
    this.selection.clear();
  }

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('mokuro_view_mode', mode);
    }
  }

  // Helper: Get strictly typed list (e.g. ensure all are Series)
  // Useful for type guards in the Action Bar
  getSelectedSeries(): Series[] {
    const items = Array.from(this.selection.values());
    // Simple runtime check or assumption based on context
    return items as Series[];
  }
}

export const uiState = new UiState();
