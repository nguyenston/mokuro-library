<script lang="ts">
  import type { Snippet } from 'svelte';

  let { class: className = '', children } = $props<{
    class?: string;
    children?: Snippet;
  }>();

  let badgeClass = $derived(() =>
    `inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`.trim()
  );
</script>

<span class={badgeClass}>
  {@render children?.()}
</span>
