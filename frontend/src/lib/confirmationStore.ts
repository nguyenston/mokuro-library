import { writable } from 'svelte/store';

/**
 * State shape for the confirmation modal
 */
type ConfirmationState = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  processingLabel: string;
  onConfirm: () => Promise<void>;
};

/**
 * Default confirmation modal state
 */
const defaultState: ConfirmationState = {
  isOpen: false,
  title: 'Are you sure?',
  message: 'This action cannot be undone.',
  confirmLabel: 'Confirm',
  processingLabel: 'Processing...',
  onConfirm: async () => { } // No-op
};

/**
 * Creates a confirmation modal store for user confirmations of destructive actions.
 * @returns Confirmation store with open and close methods
 */
function createConfirmationStore() {
  const { subscribe, set, update } = writable<ConfirmationState>(defaultState);

  return {
    subscribe,
    /**
     * Opens the confirmation modal with custom text and callback.
     * @param title - Modal title
     * @param message - Confirmation message to display
     * @param onConfirm - Async function to call when user confirms
     * @param confirmLabel - Label for the confirm button (default: 'Confirm')
     * @param processingLabel - Label shown while processing (default: 'Processing...')
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

/**
 * Global confirmation modal store instance.
 * Use this to request user confirmation for destructive actions.
 */
export const confirmation = createConfirmationStore();
