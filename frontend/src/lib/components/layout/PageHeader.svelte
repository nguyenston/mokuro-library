<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    description = '',
    class: className = '',
    children
  } = $props<{
    title: string;
    description?: string;
    class?: string;
    children?: Snippet;
  }>();

  let wrapperClass = $derived(() =>
    `flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${className}`.trim()
  );
</script>

<div class={wrapperClass}>
  <div class="space-y-1">
    <h1 class="text-2xl font-bold text-theme-primary">{title}</h1>
    {#if description}
      <p class="text-sm text-theme-secondary">{description}</p>
    {/if}
  </div>
  <div class="flex items-center gap-2">
    {@render children?.()}
  </div>
</div>
