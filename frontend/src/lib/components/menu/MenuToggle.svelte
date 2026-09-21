<script lang="ts">
  let {
    label = '',
    description = '',
    shortcut,
    checked = $bindable()
  } = $props<{
    label?: string;
    description?: string;
    shortcut?: string;
    checked: boolean;
  }>();
</script>

<button
  onclick={() => (checked = !checked)}
  title={shortcut ? `${label} (${shortcut})` : undefined}
  class="w-full text-left rounded-2xl bg-black/0 backdrop-blur-2xl px-5 py-4 border border-theme-primary/20 shadow-theme-secondary/20 shadow-lg flex items-center justify-between hover:bg-black/40 transition-all duration-200 group"
>
  <div class="flex flex-col">
    <span
      class="font-semibold text-sm text-theme-secondary group-hover:text-theme-primary transition-colors"
    >
      {label}
    </span>
    {#if description || true}
      <span class="text-xs text-theme-secondary mt-0.5">{description}</span>
    {/if}
  </div>

  <div
    class="w-10 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 {checked
      ? 'bg-accent-surface border-2 border-accent'
      : 'bg-black/40 border-2 border-white/10'}"
  >
    <div
      class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-300 ease-in-out
    {checked ? 'translate-x-4 bg-accent shadow-lg shadow-accent/50' : 'translate-x-0 bg-gray-600'}"
    ></div>
  </div>
</button>
