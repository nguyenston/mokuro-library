import { SvelteSet } from 'svelte/reactivity';

export type AppContext = 'library' | 'series' | 'reader';
export type ViewMode = 'grid' | 'list';
export type SortOrder = 'asc' | 'desc';
export type SortKey = 'title' | 'updated' | 'lastRead' | 'progress';
export type FilterStatus = 'all' | 'in_progress' | 'read' | 'unread';

class UiState {
  // --- Context & Navigation ---
  context = $state<AppContext>('library');
  appTitle = $state('Mokuro');
  activeId = $state<string | null>(null); // active series id

  // --- Search & View ---
  searchQuery = $state('');
  viewMode = $state<ViewMode>('grid');

  // --- Sorting & Filtering ---
  sortKey = $state<SortKey>('title');
  sortOrder = $state<SortOrder>('asc');
  filterStatus = $state<FilterStatus>('all');

  // --- Selection Mode ---
  isSelectionMode = $state(false);
  selectedIds = new SvelteSet<string>();

  // --- Modals (Global Visibility) ---
  isUploadOpen = $state(false);
  isStatsOpen = $state(false);
  isAboutOpen = $state(false);

  // --- Options Configuration ---
  availableSorts = $state<{ key: SortKey; label: string }[]>([
    { key: 'title', label: 'Title' }
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

  setContext(ctx: AppContext, title: string, sorts: { key: SortKey; label: string }[], id: string | null = null) {
    this.context = ctx;
    this.appTitle = title;
    this.availableSorts = sorts;
    this.activeId = id;

    // Reset transient states
    this.searchQuery = '';
    this.isSelectionMode = false;
    this.selectedIds.clear();
    this.filterStatus = 'all';

    // Default sort based on context
    if (ctx === 'library') {
      this.sortKey = 'title';
      this.sortOrder = 'asc';
    } else if (ctx === 'series') {
      this.sortKey = 'title';
      this.sortOrder = 'asc';
    }
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
