import { SvelteMap } from 'svelte/reactivity';

export class SelectionState<T extends { id: string }> {
  isSelectionMode = $state(false);
  selection = new SvelteMap<string, T>();

  get selectedIdsArray(): string[] {
    return Array.from(this.selection.keys());
  }

  enterSelectionMode(initialItem?: T) {
    if (this.isSelectionMode) return;
    this.selection.clear();
    this.isSelectionMode = true;
    // Seed selection for long-press entry into selection mode.
    if (initialItem) this.selection.set(initialItem.id, initialItem);
  }

  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selection.clear();
  }

  toggleSelection(item: T) {
    // Toggle by id for stable selection across re-renders.
    if (this.selection.has(item.id)) {
      this.selection.delete(item.id);
    } else {
      this.selection.set(item.id, item);
    }
  }

  selectAll(items: T[]) {
    for (const item of items) {
      this.selection.set(item.id, item);
    }
  }

  deselectAll() {
    this.selection.clear();
  }
}
