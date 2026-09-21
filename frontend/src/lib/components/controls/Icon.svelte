<script lang="ts">
  import type { ComponentType } from 'svelte';

  let {
    icon,
    size,
    strokeWidth = 2,
    class: className = ''
  } = $props<{
    icon: ComponentType;
    size?: number;
    strokeWidth?: number;
    class?: string;
  }>();
</script>

{#if icon}
  {@const IconComponent = icon}
  <IconComponent class={className} {size} {strokeWidth} />
{/if}
