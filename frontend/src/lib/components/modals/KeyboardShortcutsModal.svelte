<script lang="ts">
  import { keybindDefinitions } from '$lib/keybinds';
  import { keybindStore } from '$lib/stores/keybindStore';
  import { shortcutsStore } from '$lib/stores/shortcutsStore';
  import { SvelteMap } from 'svelte/reactivity';

  let dialog = $state<HTMLDialogElement | null>(null);

  const shortcuts = $derived.by(() => {
    const groups = new SvelteMap<string, { keys: string; description: string }[]>();
    for (const def of keybindDefinitions) {
      const keys = ($keybindStore?.[def.id] || []).join(' / ');
      const items = groups.get(def.category) ?? [];
      items.push({ keys, description: def.description });
      groups.set(def.category, items);
    }

    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items
    }));
  });

  function close() {
    shortcutsStore.close();
  }

  $effect(() => {
    if ($shortcutsStore) {
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog?.open) {
        dialog.close();
      }
    }
  });
</script>

<dialog
  bind:this={dialog}
  class="rounded-lg bg-theme-surface p-0 shadow-2xl backdrop:bg-black/50 max-w-2xl w-full"
  oncancel={close}
>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-theme-primary">Keyboard Shortcuts</h2>
      <button
        class="text-theme-secondary hover:text-theme-primary transition-colors"
        onclick={close}
        aria-label="Close"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="space-y-6">
      {#each shortcuts as { category, items } (category)}
        <div>
          <h3 class="text-sm font-semibold text-theme-secondary uppercase tracking-wider mb-3">
            {category}
          </h3>
          <dl class="space-y-2">
            {#each items as item, i (i)}
              <div class="flex items-center justify-between gap-4">
                <dt
                  class="font-mono text-sm bg-theme-main px-3 py-1.5 rounded border border-theme-border"
                >
                  {item.keys || '-'}
                </dt>
                <dd class="text-theme-secondary flex-1 text-right">{item.description}</dd>
              </div>
            {/each}
          </dl>
        </div>
      {/each}
    </div>

    <div class="mt-6 pt-4 border-t border-theme-border">
      <p class="text-sm text-theme-secondary text-center">
        Press
        <kbd class="font-mono bg-theme-main px-2 py-1 rounded text-xs">
          {($keybindStore.showShortcuts || ['?']).join(' / ')}
        </kbd>
        anytime to show this dialog
      </p>
    </div>
  </div>
</dialog>

<style>
  dialog::backdrop {
    backdrop-filter: blur(4px);
  }
</style>
