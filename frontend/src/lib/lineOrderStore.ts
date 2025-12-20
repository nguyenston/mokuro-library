import { writable } from 'svelte/store';
import type { MokuroBlock } from './types';

/**
 * State shape for the line order modal
 */
type LineOrderState = {
  isOpen: boolean;
  block: MokuroBlock | null;
  onSave: () => void;
};

/**
 * Default line order modal state
 */
const defaultState: LineOrderState = {
  isOpen: false,
  block: null,
  onSave: () => { } // No-op
};

/**
 * Creates a line order modal store for reordering OCR text lines within a block.
 * @returns Line order store with open and close methods
 */
function createLineOrderStore() {
  const { subscribe, set } = writable<LineOrderState>(defaultState);

  return {
    subscribe,
    /**
     * Opens the line order modal for editing a specific OCR block.
     * @param block - The Mokuro OCR block to edit
     * @param onSave - Callback to invoke when changes are saved
     */
    open: (block: MokuroBlock, onSave: () => void) => {
      set({
        isOpen: true,
        block,
        onSave
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

/**
 * Global line order modal store instance.
 * Use this to allow users to reorder OCR text lines within a block.
 */
export const lineOrderStore = createLineOrderStore();
