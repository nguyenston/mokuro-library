import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { browser } from '$app/environment';
import AppMenu from '$lib/components/menu/AppMenu.svelte';
import { contextMenu } from '$lib/stores/contextMenuStore';
import { readerState } from '$lib/states/reader/ReaderState.svelte.ts';
import { uiState } from '$lib/states/ui/uiState.svelte.ts';
import { keybindStore } from '$lib/stores/keybindStore';
import { keybindCaptureStore } from '$lib/stores/keybindCaptureStore';
import {
  eventToKeyCombo,
  keybindDefinitions,
  resolveKeybind,
  type KeybindContext,
  type KeybindId
} from '$lib/keybinds';
import { shortcutsStore } from '$lib/stores/shortcutsStore';

const editableTags = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const isEditableTarget = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (editableTags.has(target.tagName)) return true;
  return target.isContentEditable;
};

const getContext = (): KeybindContext => {
  return uiState.context ?? 'global';
};

const openAppMenu = () => {
  const current = get(contextMenu);
  if (current.component === AppMenu) {
    contextMenu.close();
    return;
  }

  if (!browser) return;
  const x = Math.max(0, window.innerWidth - 16);
  const y = 72;
  contextMenu.open(x, y, AppMenu, {}, { xAlign: 'right' });
};

const focusSearch = () => {
  if (!browser) return;
  const input = document.querySelector('input[aria-label="Search"]') as HTMLInputElement | null;
  if (input) {
    input.focus();
    input.select();
  }
};

const toggleFullscreen = async () => {
  if (!browser) return;
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
};

const readerPrev = () => {
  readerState.prevPage();
};

const readerNext = () => {
  readerState.nextPage();
};

const actions: Record<KeybindId, () => void> = {
  showShortcuts: () => shortcutsStore.open(),
  openMenu: () => openAppMenu(),
  openSettings: () => goto(resolve('/settings', {})),
  openContributions: () => goto(resolve('/contributions', {})),
  openUpload: () => {
    uiState.isUploadOpen = true;
    contextMenu.close();
  },
  toggleStats: () => {
    uiState.isStatsOpen = !uiState.isStatsOpen;
    contextMenu.close();
  },
  toggleAppearance: () => {
    uiState.isAppearanceOpen = !uiState.isAppearanceOpen;
    contextMenu.close();
  },
  focusSearch: () => focusSearch(),
  readerPrevPage: () => readerPrev(),
  readerNextPage: () => readerNext(),
  readerFirstPage: () => readerState.setPage(0),
  readerLastPage: () => readerState.setPage(Math.max(0, readerState.totalPages - 1)),
  toggleFullscreen: () => void toggleFullscreen(),
  toggleNightMode: () => {
    readerState.nightMode.enabled = !readerState.nightMode.enabled;
  },
  toggleInvertColors: () => {
    readerState.invertColor.enabled = !readerState.invertColor.enabled;
  },
  toggleHud: () => {
    readerState.hideHUD = !readerState.hideHUD;
  },
  layoutSingle: () => readerState.setLayout('single'),
  layoutDouble: () => readerState.setLayout('double'),
  layoutVertical: () => readerState.setLayout('vertical'),
  saveOcr: () => {
    if (readerState.hasUnsavedChanges && !readerState.isSaving) {
      readerState.saveOcr();
    }
  },
  toggleOcrMode: () => {
    readerState.setOcrMode(readerState.ocrMode === 'READ' ? 'BOX' : 'READ');
  },
  toggleSmartResize: () => readerState.toggleSmartResizeMode()
};

const isAllowedInContext = (
  definitionContexts: KeybindContext[] | undefined,
  context: KeybindContext
) => {
  if (!definitionContexts || definitionContexts.length === 0) return true;
  return definitionContexts.includes(context);
};

export const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (get(keybindCaptureStore)) return;
  if (isEditableTarget(event.target)) return;

  const combo = eventToKeyCombo(event);
  if (!combo) return;

  const config = get(keybindStore);
  let actionId = resolveKeybind(config, combo);
  if (!actionId) return;

  const context = getContext();
  const isArrowCombo = combo.endsWith('ArrowLeft') || combo.endsWith('ArrowRight');
  if (
    context === 'reader' &&
    isArrowCombo &&
    readerState.readingDirection === 'rtl' &&
    (actionId === 'readerPrevPage' || actionId === 'readerNextPage')
  ) {
    actionId = actionId === 'readerPrevPage' ? 'readerNextPage' : 'readerPrevPage';
  }

  const definition = keybindDefinitions.find((item) => item.id === actionId);

  if (definition && !isAllowedInContext(definition.contexts, context)) {
    return;
  }

  if (definition?.preventDefault) {
    event.preventDefault();
  }

  const handler = actions[actionId];
  handler?.();
};
