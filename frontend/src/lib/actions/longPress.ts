export function longpress(node: HTMLElement, options: { touchOnly?: boolean, duration?: number } = {}) {
  let timer: ReturnType<typeof setTimeout>;

  const handleDown = (e: PointerEvent) => {
    if (options.touchOnly && e.pointerType === 'mouse') return;

    // Only trigger on left click / primary touch
    if (e.button !== 0) return;

    timer = setTimeout(() => {
      node.dispatchEvent(new CustomEvent('longpress'));
    }, options.duration ?? 300);
  };

  const handleUp = () => {
    clearTimeout(timer);
  };

  node.addEventListener('pointerdown', handleDown);
  node.addEventListener('pointerup', handleUp);
  node.addEventListener('pointerleave', handleUp);
  // Handle scrolling cancelling the press
  node.addEventListener('pointercancel', handleUp);

  return {
    destroy() {
      node.removeEventListener('pointerdown', handleDown);
      node.removeEventListener('pointerup', handleUp);
      node.removeEventListener('pointerleave', handleUp);
      node.removeEventListener('pointercancel', handleUp);
    }
  };
}
