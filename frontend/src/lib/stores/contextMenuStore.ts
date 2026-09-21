/* eslint-disable @typescript-eslint/no-explicit-any */
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

export type AlignmentOptions = {
  anchorElement?: HTMLElement;
  xAlign?: 'left' | 'right';
  yAlign?: 'top' | 'bottom';
};

type MenuState = {
  isOpen: boolean;
  position: { x: number; y: number };
  component: Component<any> | null;
  props: Record<string, any>;
  alignmentOptions?: AlignmentOptions;
};

function createContextMenu() {
  const { subscribe, set, update } = writable<MenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    component: null,
    props: {}
  });

  // --- OVERLOAD DEFINITIONS ---
  // We define the function separately here so TypeScript can handle the overloads correctly.

  // Overload 1: Simple Mode (Array)
  function open(
    x: number,
    y: number,
    options: MenuOption[],
    props?: Record<string, any>,
    alignmentOptions?: AlignmentOptions
  ): void;

  // Overload 2: Advanced Mode (Component)
  function open<T extends Record<string, any>>(
    x: number,
    y: number,
    component: Component<T>,
    props: T,
    alignmentOptions?: AlignmentOptions
  ): void;

  // Implementation
  function open(
    x: number,
    y: number,
    componentOrOptions: Component<any> | MenuOption[],
    props: Record<string, any> = {},
    alignmentOptions?: AlignmentOptions
  ) {
    if (Array.isArray(componentOrOptions)) {
      // SIMPLE MODE
      set({
        isOpen: true,
        position: { x, y },
        component: SimpleMenu,
        props: { ...props, options: componentOrOptions },
        alignmentOptions
      });
    } else {
      // ADVANCED MODE
      set({
        isOpen: true,
        position: { x, y },
        component: componentOrOptions,
        props,
        alignmentOptions
      });
    }
  }

  return {
    subscribe,
    open,
    updatePosition: (x: number, y: number) => {
      update((state) => ({
        ...state,
        position: { x, y }
      }));
    },

    close: () =>
      set({
        isOpen: false,
        position: { x: 0, y: 0 },
        component: null,
        props: {},
        alignmentOptions: undefined // Reset alignment options
      })
  };
}

export const contextMenu = createContextMenu();
