import { SvelteSet } from 'svelte/reactivity';

/**
 * Application context types - determines which section of the app is active
 */
export type AppContext = 'library' | 'series' | 'reader' | 'settings';

/**
 * View mode for library display
 */
export type ViewMode = 'grid' | 'list';

/**
 * Sort order direction
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Available sort keys for library items
 */
export type SortKey = 'title' | 'updated' | 'lastRead' | 'progress';

/**
 * Filter status for reading progress
 */
export type FilterStatus = 'all' | 'in_progress' | 'read' | 'unread';

/**
 * Global UI state management class using Svelte 5 reactive state.
 * Handles application-wide UI concerns including navigation context,
 * search, filtering, sorting, selection mode, and modal visibility.
 */
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
  isAppearanceOpen = $state(false);

  // --- Options Configuration ---
  availableSorts = $state<{ key: SortKey; label: string }[]>([
    { key: 'title', label: 'Title' }
  ]);

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedView = localStorage.getItem('mokuro_view_mode');
        if (savedView === 'grid' || savedView === 'list') {
          this.viewMode = savedView;
        }
      } catch (e) {
        console.warn('Failed to read view mode from localStorage:', e);
      }
    }
  }

  // --- Actions ---

  /**
   * Sets the current application context and configures available options.
   * Resets transient state like search query and selection mode.
   * @param ctx - The application context to switch to
   * @param title - Display title for the current context
   * @param sorts - Available sort options for this context
   * @param id - Optional ID for the active item (e.g., series ID)
   */
  setContext(ctx: AppContext, title: string, sorts: { key: SortKey; label: string }[], id: string | null = null): void {
    this.context = ctx;
    this.appTitle = title;
    this.availableSorts = sorts;
    this.activeId = id;

    // Reset transient states
    this.searchQuery = '';
    this.isSelectionMode = false;
    this.selectedIds.clear();
    this.filterStatus = 'all';

    // Default sort for all contexts
    this.sortKey = 'title';
    this.sortOrder = 'asc';
  }

  /**
   * Toggles selection mode on/off. Clears all selections when disabling.
   */
  toggleSelectionMode(): void {
    this.isSelectionMode = !this.isSelectionMode;
    if (!this.isSelectionMode) {
      this.selectedIds.clear();
    }
  }

  /**
   * Toggles the selection state of a single item
   * @param id - The item ID to toggle
   */
  toggleSelection(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  /**
   * Selects all items from the provided list
   * @param ids - Array of item IDs to select
   */
  selectAll(ids: string[]): void {
    for (const id of ids) {
      this.selectedIds.add(id);
    }
  }

  /**
   * Clears all selected items
   */
  deselectAll(): void {
    this.selectedIds.clear();
  }

  /**
   * Toggles the sort order between ascending and descending
   */
  toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
  }

  /**
   * Sets the library view mode and persists to localStorage
   * @param mode - The view mode to set ('grid' or 'list')
   */
  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mokuro_view_mode', mode);
      } catch (e) {
        console.warn('Failed to save view mode to localStorage:', e);
      }
    }
  }
}

export const uiState = new UiState();
