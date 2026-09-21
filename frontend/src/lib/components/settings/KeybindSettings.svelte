<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import {
    eventToKeyCombo,
    keybindDefinitions,
    type KeybindDefinition,
    type KeybindId
  } from '$lib/keybinds';
  import { keybindStore } from '$lib/stores/keybindStore';
  import { keybindCaptureStore } from '$lib/stores/keybindCaptureStore';
  import { SvelteMap } from 'svelte/reactivity';

  let capturingId = $state<KeybindId | null>(null);
  let errorMessage = $state<string | null>(null);

  const capturingLabel = $derived.by(() => {
    if (!capturingId) return '';
    return keybindDefinitions.find((item) => item.id === capturingId)?.label ?? capturingId;
  });

  const groupedDefinitions = $derived.by(() => {
    const groups = new SvelteMap<string, KeybindDefinition[]>();
    for (const def of keybindDefinitions) {
      const items = groups.get(def.category) ?? [];
      items.push(def);
      groups.set(def.category, items);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  });

  const startCapture = (id: KeybindId) => {
    capturingId = id;
    errorMessage = null;
    keybindCaptureStore.set(true);
  };

  const stopCapture = () => {
    capturingId = null;
    keybindCaptureStore.set(false);
  };

  const handleKeyCapture = async (event: KeyboardEvent) => {
    if (!capturingId) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.key === 'Escape') {
      stopCapture();
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      await keybindStore.clearBindings(capturingId);
      stopCapture();
      return;
    }

    const combo = eventToKeyCombo(event);
    if (!combo) return;
    const result = await keybindStore.addBinding(capturingId, combo);
    if (!result.ok) {
      errorMessage = result.error;
      return;
    }

    stopCapture();
    errorMessage = null;
  };

  onDestroy(() => {
    keybindCaptureStore.set(false);
  });
</script>

<svelte:window onkeydown={handleKeyCapture} />

<div class="w-full max-w-4xl">
  <div class="mb-8">
    <div class="flex items-center gap-3 mb-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-accent"
      >
        <path d="M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        <path d="M7 10h1M10 10h1M13 10h1M16 10h1" />
        <path d="M7 14h10" />
      </svg>
      <h1 class="text-3xl font-bold text-theme-primary">Keybinds</h1>
    </div>
    <p class="text-base text-theme-secondary">
      Customize shortcuts for the actions you use the most.
    </p>
  </div>

  <div class="mb-6 flex flex-wrap items-center gap-3">
    <button
      onclick={() => keybindStore.resetAll()}
      class="group relative px-5 py-2.5 rounded-xl text-sm font-semibold bg-theme-main border-2 border-theme-border-light text-theme-primary hover:bg-theme-surface-hover hover:border-accent/50 transition-all duration-300 overflow-hidden"
    >
      <span class="relative z-10 flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="group-hover:rotate-180 transition-transform duration-500"
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
        Reset All
      </span>
      <div
        class="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/10 to-accent/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
      ></div>
    </button>
    <div
      class="flex items-center gap-2 px-3 py-2 rounded-xl bg-theme-surface/50 border border-theme-border-light"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-accent"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span class="text-xs text-theme-tertiary font-medium">
        Press a key to assign · <kbd class="font-mono">Backspace</kbd> clears ·
        <kbd class="font-mono">Esc</kbd> cancels
      </span>
    </div>
  </div>

  {#if errorMessage}
    <div
      class="mb-6 rounded-xl border-2 border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger flex items-start gap-3"
      in:fly={{ y: -10, duration: 300, easing: quintOut }}
      out:fade={{ duration: 200 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0 mt-0.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{errorMessage}</span>
    </div>
  {/if}

  <div class="space-y-6">
    {#each groupedDefinitions as group, groupIndex (group.category)}
      <div
        class="rounded-2xl bg-theme-main border-2 border-theme-border-light p-6 space-y-5 hover:border-accent/20 transition-all duration-300"
        in:fly={{ y: 20, duration: 300, delay: groupIndex * 50, easing: quintOut }}
      >
        <div class="flex items-center justify-between pb-3 border-b border-theme-border-light/50">
          <h2 class="text-lg font-bold text-theme-primary flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
            {group.category}
          </h2>
          {#if capturingId && group.items.some((item) => item.id === capturingId)}
            <div
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border-2 border-accent/30"
              in:scale={{ start: 0.9, duration: 200, easing: quintOut }}
              out:fade={{ duration: 150 }}
            >
              <div class="relative flex items-center justify-center">
                <div class="absolute w-3 h-3 bg-accent rounded-full animate-ping opacity-75"></div>
                <div class="relative w-2 h-2 bg-accent rounded-full"></div>
              </div>
              <span class="text-xs text-accent font-bold">
                Listening for "{capturingLabel}"
              </span>
            </div>
          {/if}
        </div>

        <div class="space-y-4">
          {#each group.items as item (item.id)}
            {@const isCapturing = capturingId === item.id}
            {@const hasBindings = ($keybindStore[item.id] || []).length > 0}
            <div
              class="group flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-theme-surface/40 hover:bg-theme-surface transition-all duration-200 border border-transparent hover:border-theme-border-light {isCapturing
                ? 'ring-2 ring-accent/50 bg-accent/5'
                : ''}"
            >
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <div class="text-sm font-bold text-theme-primary">{item.label}</div>
                  {#if hasBindings}
                    <span
                      class="w-1.5 h-1.5 rounded-full bg-status-success"
                      in:scale={{ start: 0, duration: 200 }}
                    ></span>
                  {/if}
                </div>
                <div class="text-xs text-theme-tertiary mt-0.5">{item.description}</div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                {#each $keybindStore[item.id] || [] as key, i (key)}
                  <div
                    class="group/key inline-flex items-center gap-2 rounded-lg bg-theme-main px-3 py-1.5 text-xs font-mono font-semibold text-theme-primary border-2 border-theme-border-light hover:border-accent/50 transition-all duration-200 shadow-sm"
                    in:scale={{ start: 0.8, duration: 200, delay: i * 50, easing: quintOut }}
                    out:scale={{ start: 1, duration: 150 }}
                  >
                    <kbd class="font-mono">{key}</kbd>
                    <button
                      type="button"
                      class="flex items-center justify-center w-4 h-4 rounded text-theme-tertiary hover:text-status-danger hover:bg-status-danger/10 transition-all duration-200"
                      onclick={() => keybindStore.removeBinding(item.id, key)}
                      aria-label={`Remove ${key}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                {/each}
                <button
                  type="button"
                  onclick={() => startCapture(item.id)}
                  class="group/btn relative px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all duration-200 overflow-hidden {isCapturing
                    ? 'border-accent bg-accent text-white'
                    : 'border-theme-border-light text-theme-secondary hover:text-theme-primary hover:border-accent/50'}"
                >
                  <span class="relative z-10 flex items-center gap-1.5">
                    {#if isCapturing}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="animate-pulse"
                      >
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    {:else}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    {/if}
                    {isCapturing ? 'Press key...' : 'Add'}
                  </span>
                  {#if !isCapturing}
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/10 to-accent/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"
                    ></div>
                  {/if}
                </button>
                <button
                  type="button"
                  onclick={() => keybindStore.resetBinding(item.id)}
                  class="group/btn relative px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-theme-border-light text-theme-secondary hover:text-theme-primary hover:border-accent/50 transition-all duration-200 overflow-hidden"
                >
                  <span class="relative z-10 flex items-center gap-1.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="group-hover/btn:rotate-180 transition-transform duration-500"
                    >
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                    Reset
                  </span>
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/10 to-accent/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"
                  ></div>
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  @keyframes ping {
    75%,
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }
  .animate-ping {
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  kbd {
    background: transparent;
    border: none;
    padding: 0;
    font-size: inherit;
    font-family: inherit;
  }
</style>
