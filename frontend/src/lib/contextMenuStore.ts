import { writable } from 'svelte/store';

// --- Type Definitions ---
export type MenuAction = {
  label: string;
  action: () => void;
  disabled?: boolean;
};

export type MenuSeparator = {
  separator: true; // This is to create a discriminated union
};

// MenuOption is now a union of an action or a separator
export type MenuOption = MenuAction | MenuSeparator;

type MenuState = {
  isOpen: boolean;
  position: { x: number; y: number };
  options: MenuOption[];
};

// --- Store Creation ---
function createContextMenu() {
  const { subscribe, set, update } = writable<MenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    options: []
  });

  return {
    subscribe,
    /**
     * Opens the context menu at the specified coordinates
     * with the given options.
     */
    open: (x: number, y: number, options: MenuOption[]) =>
      set({
        isOpen: true,
        position: { x, y },
        options
      }),
    /**
     * Closes the context menu.
     */
    close: () =>
      set({
        isOpen: false,
        position: { x: 0, y: 0 },
        options: []
      })
  };
}

/**
 * A global, singleton store for managing the custom context menu.
 */
export const contextMenu = createContextMenu();
