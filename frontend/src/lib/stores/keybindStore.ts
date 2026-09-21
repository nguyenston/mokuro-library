import { writable, get } from 'svelte/store';
import { updateSettings, type ReaderSettingsData } from '$lib/stores/authStore';
import {
  defaultKeybinds,
  mergeKeybinds,
  normalizeKeyCombo,
  type KeybindId,
  type KeybindsConfig
} from '$lib/keybinds';

type KeybindUpdateResult = { ok: true } | { ok: false; error: string };

const createKeybindStore = () => {
  const store = writable<KeybindsConfig>(defaultKeybinds);
  const { subscribe, set } = store;

  const persist = async (next: KeybindsConfig) => {
    set(next);
    await updateSettings({ keybinds: next } as ReaderSettingsData);
  };

  return {
    subscribe,
    setFromSettings: (settings?: ReaderSettingsData | null) => {
      set(mergeKeybinds(settings?.keybinds as Partial<KeybindsConfig> | undefined));
    },
    addBinding: async (id: KeybindId, combo: string): Promise<KeybindUpdateResult> => {
      const normalized = normalizeKeyCombo(combo);
      if (!normalized) return { ok: false, error: 'Invalid key combo.' };

      const current = get(store);
      for (const [otherId, bindings] of Object.entries(current) as [KeybindId, string[]][]) {
        if (otherId !== id && bindings.includes(normalized)) {
          return { ok: false, error: `Already used by ${otherId}.` };
        }
      }

      const existing = current[id] ?? [];
      if (existing.includes(normalized)) {
        return { ok: false, error: 'Key already assigned.' };
      }

      const next = {
        ...current,
        [id]: [...existing, normalized]
      };

      await persist(next);
      return { ok: true };
    },
    removeBinding: async (id: KeybindId, combo: string) => {
      const normalized = normalizeKeyCombo(combo);
      const current = get(store);
      const next = {
        ...current,
        [id]: (current[id] || []).filter((key) => key !== normalized)
      };
      await persist(next);
    },
    clearBindings: async (id: KeybindId) => {
      const current = get(store);
      const next = {
        ...current,
        [id]: []
      };
      await persist(next);
    },
    resetBinding: async (id: KeybindId) => {
      const current = get(store);
      const next = {
        ...current,
        [id]: defaultKeybinds[id]
      };
      await persist(next);
    },
    resetAll: async () => {
      await persist(defaultKeybinds);
    }
  };
};

export const keybindStore = createKeybindStore();
