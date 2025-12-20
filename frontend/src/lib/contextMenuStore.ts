import { writable } from 'svelte/store';
import type { Component } from 'svelte';
import SimpleMenu from '$lib/components/menu/SimpleMenu.svelte';

// --- Types ---
export type MenuAction = {
  label: string;
  action: () => void;
  disabled?: boolean;
};
export type MenuSeparator = { separator: true };
export type MenuOption = MenuAction | MenuSeparator;

type MenuState = {
  isOpen: boolean;
  position: { x: number; y: number };
  component: Component<any> | null;
  props: Record<string, any>;
};

function createContextMenu() {
  const { subscribe, set } = writable<MenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    component: null,
    props: {}
  });

  return {
    subscribe,

    /**
     * Opens the context menu.
     * * Signature A: open(x, y, Component, props) 
     * -> Renders a custom Svelte component (Advanced Mode)
     * * Signature B: open(x, y, options[]) 
     * -> Renders the built-in SimpleMenu (Simple Mode)
     */
    open: (
      x: number,
      y: number,
      componentOrOptions: Component<any> | MenuOption[],
      props: Record<string, any> = {}
    ) => {
      if (Array.isArray(componentOrOptions)) {
        // SIMPLE MODE: User passed an array of options.
        // We wrap them in the SimpleMenu component automatically.
        set({
          isOpen: true,
          position: { x, y },
          component: SimpleMenu,
          props: { options: componentOrOptions }
        });
      } else {
        // ADVANCED MODE: User passed a custom component.
        set({
          isOpen: true,
          position: { x, y },
          component: componentOrOptions,
          props
        });
      }
    },

    close: () =>
      set({
        isOpen: false,
        position: { x: 0, y: 0 },
        component: null,
        props: {}
      })
  };
}

export const contextMenu = createContextMenu();
