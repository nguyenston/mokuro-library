import type { PanzoomOptions, PanzoomObject } from '@panzoom/panzoom';

export type PanzoomActionParams = {
  options?: PanzoomOptions;
  disabled?: boolean;
  onInit?: (instance: PanzoomObject) => void;
};

export function panzoom(panzoomElement: HTMLElement, params: PanzoomActionParams = {}) {
  let pz: PanzoomObject | null = null;
  let options = params.options || {};
  // Cache the parent element to ensure cleanup works even if node is detached
  let attachedParent: HTMLElement | null = null;

  const init = async () => {
    const PanzoomModule = await import('@panzoom/panzoom');
    const Panzoom = PanzoomModule.default;

    // create a PanzoomObject bound to panzoomElement
    pz = Panzoom(panzoomElement, {
      cursor: 'default',
      ...options
    });

    if (params.onInit && pz) {
      params.onInit(pz);
    }
    // If the Y-axis is disabled (Vertical Mode), we want the native scroll to happen,
    // so we shouldn't attach a blocking (non-passive) listener at all.
    if (options.disableYAxis) return;
    // Attach listener to parent to capture wheel events
    attachedParent = panzoomElement.parentElement;
    if (attachedParent) {
      attachedParent.addEventListener('wheel', onWheel, { passive: false });
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (!pz) return;

    // Standard Mode (Single/Double):
    e.preventDefault();
    pz.zoomWithWheel(e);
  };

  if (!params.disabled) {
    init();
  }

  return {
    update(newParams: PanzoomActionParams) {
      options = newParams.options || {};
      if (pz) {
        pz.setOptions(options);
      }
      // Note: We don't dynamically add/remove listeners here because layout mode
      // switches destroy/recreate the component (and this action), which is safer.
    },
    destroy() {
      if (pz) {
        pz.destroy();
      }

      // Use the cached parent reference for cleanup
      if (attachedParent) {
        attachedParent.removeEventListener('wheel', onWheel);
        attachedParent = null;
      }
    }
  };
}
