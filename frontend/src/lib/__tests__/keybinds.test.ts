import { describe, expect, it } from 'vitest';
import {
  defaultKeybinds,
  eventToKeyCombo,
  keybindDefinitions,
  resolveKeybind
} from '$lib/keybinds';

describe('keybinds', () => {
  it('maps every default key to its action', () => {
    for (const def of keybindDefinitions) {
      for (const combo of def.defaultKeys) {
        expect(resolveKeybind(defaultKeybinds, combo)).toBe(def.id);
      }
    }
  });

  it('does not duplicate default bindings across actions', () => {
    const seen = new Map<string, string>();

    for (const def of keybindDefinitions) {
      for (const combo of def.defaultKeys) {
        if (seen.has(combo)) {
          throw new Error(`Duplicate keybind: ${combo} for ${def.id} and ${seen.get(combo)}`);
        }
        seen.set(combo, def.id);
      }
    }
  });

  it('normalizes key events to combos', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    expect(eventToKeyCombo(event)).toBe('Ctrl+S');
  });
});
