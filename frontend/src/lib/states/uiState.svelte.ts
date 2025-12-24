import { SvelteSet } from 'svelte/reactivity';

export type AppContext = 'library' | 'series' | 'reader' | 'settings';
export type ViewMode = 'grid' | 'list';
export type SortOrder = 'asc' | 'desc';
export type SortKey = 'title' | 'updated' | 'lastRead' | 'progress';
export type FilterStatus = 'all' | 'reading' | 'read' | 'unread';

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

  // --- Data Freshness ---
  // Simple counter to force re-fetches
  libraryVersion = $state(0);

  // --- Selection Mode ---
  isSelectionMode = $state(false);
  selectedIds = new SvelteSet<string>();

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
    this.selectedIds.clear();
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

  enterSelectionMode(initialId: string) {
    if (this.isSelectionMode) return;
    this.selectedIds.clear();
    this.isSelectionMode = true;
    this.selectedIds.add(initialId);
  }

  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selectedIds.clear();
  }

  toggleSelectionMode() {
    this.isSelectionMode = !this.isSelectionMode;
    if (!this.isSelectionMode) {
      this.selectedIds.clear();
    }
  }

  toggleSelection(id: string) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  selectAll(ids: string[]) {
    for (const id of ids) {
      this.selectedIds.add(id);
    }
  }

  deselectAll() {
    this.selectedIds.clear();
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
}

export const uiState = new UiState();
