import { writable } from 'svelte/store';
import type { MokuroBlock } from '$lib/types';

type LineOrderState = {
  isOpen: boolean;
  block: MokuroBlock | null;
  onCommit: (newOrder: number[]) => void;
};

// Default empty state
const defaultState: LineOrderState = {
  isOpen: false,
  block: null,
  onCommit: () => {}
};

function createLineOrderStore() {
  const { subscribe, set } = writable<LineOrderState>(defaultState);

  return {
    subscribe,
    /**
     * Opens the line order modal for a specific block.
     */
    open: (block: MokuroBlock, onCommit: (newOrder: number[]) => void) => {
      set({
        isOpen: true,
        block,
        onCommit
      });
    },
    /**
     * Closes the modal and resets to default state.
     */
    close: () => {
      set(defaultState);
    }
  };
}

export const lineOrderStore = createLineOrderStore();
