export function lockScroll(node: HTMLElement) {
  // Save the original value to restore later
  const originalOverflow = document.body.style.overflow;

  // Lock scrolling
  document.body.style.overflow = 'hidden';

  return {
    destroy() {
      // Restore the original value when the element (modal) is removed
      document.body.style.overflow = originalOverflow;
    }
  };
}
