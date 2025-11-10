import { writable } from 'svelte/store';

type ConfirmationState = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  processingLabel: string;
  onConfirm: () => Promise<void>;
};

// Default empty state
const defaultState: ConfirmationState = {
  isOpen: false,
  title: 'Are you sure?',
  message: 'This action cannot be undone.',
  confirmLabel: 'Confirm',
  processingLabel: 'Processing...',
  onConfirm: async () => { } // No-op
};

function createConfirmationStore() {
  const { subscribe, set, update } = writable<ConfirmationState>(defaultState);

  return {
    subscribe,
    /**
     * Opens the confirmation modal with the specified options.
     */
    open: (
      title: string,
      message: string,
      onConfirm: () => Promise<void>,
      confirmLabel: string = 'Confirm',
      processingLabel: string = 'Processing...',
    ) => {
      set({
        isOpen: true,
        title,
        message,
        confirmLabel,
        processingLabel,
        onConfirm
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

export const confirmation = createConfirmationStore();
