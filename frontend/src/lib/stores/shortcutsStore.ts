import { writable } from 'svelte/store';

const createShortcutsStore = () => {
  const { subscribe, set } = writable(false);

  return {
    subscribe,
    open: () => set(true),
    close: () => set(false)
  };
};

export const shortcutsStore = createShortcutsStore();
