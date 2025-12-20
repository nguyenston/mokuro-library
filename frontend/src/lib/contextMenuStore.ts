import { writable } from 'svelte/store';
import type { Component } from 'svelte';
import SimpleMenu from '$lib/components/menu/SimpleMenu.svelte';

/**
 * Menu action item with label and callback
 */
export type MenuAction = {
  label: string;
  action: () => void;
  disabled?: boolean;
};

/**
 * Visual separator for menu items
 */
export type MenuSeparator = { separator: true };

/**
 * Union type for menu items (actions or separators)
 */
export type MenuOption = MenuAction | MenuSeparator;

/**
 * Internal state for the context menu store
 */
type MenuState = {
  isOpen: boolean;
  position: { x: number; y: number };
  component: Component<Record<string, unknown>> | null;
  props: Record<string, unknown>;
  anchorElement: HTMLElement | null;
};

/**
 * Creates a context menu store with support for both simple menu arrays
 * and custom Svelte components.
 * @returns Context menu store with open, close, and updatePosition methods
 */
function createContextMenu() {
  const { subscribe, set, update } = writable<MenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    component: null,
    props: {},
    anchorElement: null
  });

  return {
    subscribe,

    /**
     * Opens the context menu at the specified position.
     * Supports two modes:
     * - Simple Mode: Pass an array of MenuOption items
     * - Advanced Mode: Pass a custom Svelte component and props
     * @param x - X coordinate for menu position
     * @param y - Y coordinate for menu position
     * @param componentOrOptions - Either a Svelte component or array of menu options
     * @param props - Props to pass to custom component (ignored in simple mode)
     * @param anchorElement - Optional anchor element for positioning
     */
    open: (
      x: number,
      y: number,
      componentOrOptions: Component<Record<string, unknown>> | MenuOption[],
      props: Record<string, unknown> = {},
      anchorElement: HTMLElement | null = null
    ): void => {
      if (Array.isArray(componentOrOptions)) {
        // SIMPLE MODE: User passed an array of options.
        // We wrap them in the SimpleMenu component automatically.
        set({
          isOpen: true,
          position: { x, y },
          component: SimpleMenu,
          props: { options: componentOrOptions },
          anchorElement
        });
      } else {
        // ADVANCED MODE: User passed a custom component.
        set({
          isOpen: true,
          position: { x, y },
          component: componentOrOptions,
          props,
          anchorElement
        });
      }
    },

    /**
     * Updates the context menu position without closing it
     * @param x - New X coordinate
     * @param y - New Y coordinate
     */
    updatePosition: (x: number, y: number): void => {
      update(state => ({
        ...state,
        position: { x, y }
      }));
    },

    /**
     * Closes the context menu and resets state
     */
    close: (): void =>
      set({
        isOpen: false,
        position: { x: 0, y: 0 },
        component: null,
        props: {},
        anchorElement: null
      })
  };
}

/**
 * Global context menu store instance.
 * Use this to display context menus anywhere in the application.
 */
export const contextMenu = createContextMenu();
