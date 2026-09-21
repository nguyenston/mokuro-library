export type KeybindContext =
  | 'library'
  | 'series'
  | 'reader'
  | 'settings'
  | 'global'
  | 'contributions';

export type KeybindId =
  | 'showShortcuts'
  | 'openMenu'
  | 'openSettings'
  | 'openContributions'
  | 'openUpload'
  | 'toggleStats'
  | 'toggleAppearance'
  | 'focusSearch'
  | 'readerPrevPage'
  | 'readerNextPage'
  | 'readerFirstPage'
  | 'readerLastPage'
  | 'toggleFullscreen'
  | 'toggleNightMode'
  | 'toggleInvertColors'
  | 'toggleHud'
  | 'layoutSingle'
  | 'layoutDouble'
  | 'layoutVertical'
  | 'saveOcr'
  | 'toggleOcrMode'
  | 'toggleSmartResize';

export type KeybindsConfig = Record<KeybindId, string[]>;

export type KeybindDefinition = {
  id: KeybindId;
  label: string;
  description: string;
  category: string;
  defaultKeys: string[];
  contexts?: KeybindContext[];
  preventDefault?: boolean;
};

export const keybindDefinitions: KeybindDefinition[] = [
  {
    id: 'showShortcuts',
    label: 'Show shortcuts',
    description: 'Open the keyboard shortcuts dialog',
    category: 'General',
    defaultKeys: ['?']
  },
  {
    id: 'openMenu',
    label: 'Open menu',
    description: 'Toggle the main menu',
    category: 'General',
    defaultKeys: ['M']
  },
  {
    id: 'openSettings',
    label: 'Open settings',
    description: 'Go to the settings page',
    category: 'General',
    defaultKeys: ['S']
  },
  {
    id: 'openContributions',
    label: 'Open contributions',
    description: 'Go to the contributions page',
    category: 'General',
    defaultKeys: ['C']
  },
  {
    id: 'openUpload',
    label: 'Open upload',
    description: 'Open the upload modal',
    category: 'General',
    defaultKeys: ['U']
  },
  {
    id: 'toggleStats',
    label: 'Toggle stats',
    description: 'Open or close statistics',
    category: 'General',
    defaultKeys: ['T']
  },
  {
    id: 'toggleAppearance',
    label: 'Toggle appearance',
    description: 'Open or close appearance settings',
    category: 'General',
    defaultKeys: ['P']
  },
  {
    id: 'focusSearch',
    label: 'Focus search',
    description: 'Jump to the search input',
    category: 'Library',
    defaultKeys: ['/'],
    contexts: ['library', 'series'],
    preventDefault: true
  },
  {
    id: 'readerPrevPage',
    label: 'Previous page',
    description: 'Move to the previous page',
    category: 'Reader',
    defaultKeys: ['ArrowLeft'],
    contexts: ['reader'],
    preventDefault: true
  },
  {
    id: 'readerNextPage',
    label: 'Next page',
    description: 'Move to the next page',
    category: 'Reader',
    defaultKeys: ['ArrowRight', 'Space'],
    contexts: ['reader'],
    preventDefault: true
  },
  {
    id: 'readerFirstPage',
    label: 'First page',
    description: 'Jump to the first page',
    category: 'Reader',
    defaultKeys: ['Home'],
    contexts: ['reader'],
    preventDefault: true
  },
  {
    id: 'readerLastPage',
    label: 'Last page',
    description: 'Jump to the last page',
    category: 'Reader',
    defaultKeys: ['End'],
    contexts: ['reader'],
    preventDefault: true
  },
  {
    id: 'toggleFullscreen',
    label: 'Toggle fullscreen',
    description: 'Enter or exit fullscreen',
    category: 'Reader',
    defaultKeys: ['F'],
    contexts: ['reader'],
    preventDefault: true
  },
  {
    id: 'toggleNightMode',
    label: 'Night mode',
    description: 'Toggle night mode',
    category: 'Reader',
    defaultKeys: ['N'],
    contexts: ['reader']
  },
  {
    id: 'toggleInvertColors',
    label: 'Invert colors',
    description: 'Toggle color inversion',
    category: 'Reader',
    defaultKeys: ['I'],
    contexts: ['reader']
  },
  {
    id: 'toggleHud',
    label: 'Toggle HUD',
    description: 'Show or hide the reader HUD',
    category: 'Reader',
    defaultKeys: ['H'],
    contexts: ['reader']
  },
  {
    id: 'layoutSingle',
    label: 'Single layout',
    description: 'Switch to single page view',
    category: 'Reader',
    defaultKeys: ['1'],
    contexts: ['reader']
  },
  {
    id: 'layoutDouble',
    label: 'Double layout',
    description: 'Switch to double page view',
    category: 'Reader',
    defaultKeys: ['2'],
    contexts: ['reader']
  },
  {
    id: 'layoutVertical',
    label: 'Vertical layout',
    description: 'Switch to vertical scroll view',
    category: 'Reader',
    defaultKeys: ['3'],
    contexts: ['reader']
  },
  {
    id: 'saveOcr',
    label: 'Save OCR',
    description: 'Save OCR edits',
    category: 'Reader',
    defaultKeys: ['Ctrl+S'],
    contexts: ['reader'],
    preventDefault: true
  },
  {
    id: 'toggleOcrMode',
    label: 'Toggle edit mode',
    description: 'Enter or exit OCR edit mode',
    category: 'Reader',
    defaultKeys: ['E'],
    contexts: ['reader']
  },
  {
    id: 'toggleSmartResize',
    label: 'Smart resize',
    description: 'Toggle smart resize mode',
    category: 'Reader',
    defaultKeys: ['R'],
    contexts: ['reader']
  }
];

export const defaultKeybinds: KeybindsConfig = keybindDefinitions.reduce((acc, def) => {
  acc[def.id] = [...def.defaultKeys];
  return acc;
}, {} as KeybindsConfig);

export const normalizeKeyCombo = (combo: string) =>
  combo
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.length === 1 ? part.toUpperCase() : part))
    .join('+');

const normalizeKey = (key: string) => {
  if (key === ' ') return 'Space';
  if (key === 'Escape') return 'Esc';
  if (key.length === 1) return key.toUpperCase();
  return key;
};

export const eventToKeyCombo = (event: KeyboardEvent): string | null => {
  const key = normalizeKey(event.key);
  if (key === 'Shift' || key === 'Ctrl' || key === 'Alt' || key === 'Meta') return null;

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.metaKey) parts.push('Meta');
  if (event.altKey) parts.push('Alt');
  if ((event.ctrlKey || event.metaKey || event.altKey) && event.shiftKey) {
    parts.push('Shift');
  }

  parts.push(key);
  return normalizeKeyCombo(parts.join('+'));
};

export const mergeKeybinds = (overrides?: Partial<KeybindsConfig> | null) => {
  const merged: KeybindsConfig = { ...defaultKeybinds };
  if (!overrides) return merged;

  for (const [key, value] of Object.entries(overrides)) {
    const id = key as KeybindId;
    if (!merged[id]) continue;
    const keys = Array.isArray(value) ? value.filter(Boolean).map(normalizeKeyCombo) : [];
    merged[id] = keys.length ? keys : merged[id];
  }

  return merged;
};

export const buildKeybindLookup = (config: KeybindsConfig) => {
  const lookup = new Map<string, KeybindId>();
  for (const [id, keys] of Object.entries(config) as [KeybindId, string[]][]) {
    for (const key of keys) {
      const normalized = normalizeKeyCombo(key);
      if (!normalized) continue;
      lookup.set(normalized, id);
    }
  }
  return lookup;
};

export const resolveKeybind = (config: KeybindsConfig, combo: string) => {
  const lookup = buildKeybindLookup(config);
  return lookup.get(normalizeKeyCombo(combo)) ?? null;
};
