<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  let { title, on_close, children } = $props<{
    title: string;
    on_close: () => void;
    children?: Snippet;
  }>();
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  role="dialog"
  aria-modal="true"
>
  <button
    class="absolute inset-0 bg-black/60 backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={on_close}
    onkeydown={(event) => event.key === 'Escape' && on_close()}
    aria-label="Close modal"
  ></button>
  <div
    class="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl"
    transition:scale={{ duration: 200, start: 0.97 }}
  >
    <div
      class="flex items-center justify-between px-6 py-4 bg-theme-main border-b border-theme-border"
    >
      <h2 class="text-lg font-bold text-theme-primary">{title}</h2>
      <button
        onclick={on_close}
        class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover"
        aria-label="Close"
      >
        <span aria-hidden="true">x</span>
      </button>
    </div>
    <div class="max-h-[80vh] overflow-y-auto">
      {@render children?.()}
    </div>
  </div>
</div>
