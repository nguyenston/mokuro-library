import type { Series } from '$lib/types';

export type AppContext = 'library' | 'series';
export type ViewMode = 'grid' | 'list';
export type SortOrder = 'asc' | 'desc';
export type SortKey = 'title' | 'updated' | 'lastRead' | 'progress';
export type FilterStatus = 'all' | 'reading' | 'read' | 'unread';
export type FilterOrganization = 'all' | 'organized' | 'unorganized';
export type FilterMissing = 'none' | 'cover' | 'description' | 'title' | 'any';
export type FilterOwner = 'all' | 'private' | 'shared';

class UiState {
  // --- Context & Navigation ---
  context = $state<AppContext>('library');
  subtext = $state<string | null>(null);
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
  filterOwner = $state<FilterOwner>('all');

  // --- Data Freshness ---
  // Simple counter to force re-fetches
  libraryVersion = $state(0);

  // --- Modals (Global Visibility) ---
  isUploadOpen = $state(false);
  isStatsOpen = $state(false);
  isAboutOpen = $state(false);
  isAppearanceOpen = $state(false);

  // --- Return Navigation ---
  returnPath = $state<string | null>(null);
  returnLabel = $state<string>('Back to Series');

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

  setSubtext(subtext: string, title: string) {
    this.subtext = subtext;
    this.appTitle = title;
  }

  setContext(
    ctx: AppContext,
    title: string,
    sorts: { key: SortKey; label: string }[],
    id: string | null = null
  ) {
    this.subtext = null;
    if (this.context === ctx && this.activeId === id) return;

    this.context = ctx;
    this.appTitle = title;
    this.availableSorts = sorts;
    this.activeId = id;

    // Reset transient states
    this.searchQuery = '';
    this.filterStatus = 'all';
    this.filterBookmarked = false;
    this.filterOwner = 'all';

    if (ctx === 'library') {
      this.sortKey = 'title';
      this.sortOrder = 'asc';
    } else if (ctx === 'series') {
      this.sortKey = 'title';
      this.sortOrder = 'asc';
    }
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

  setReturnPath(path: string | null, label: string = 'Back to Series') {
    this.returnPath = path;
    this.returnLabel = label;
  }

  clearReturnPath() {
    this.returnPath = null;
    this.returnLabel = 'Back to Series';
  }
}

export const uiState = new UiState();
