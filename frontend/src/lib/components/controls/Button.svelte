<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  type Size = 'sm' | 'md' | 'lg';

  let {
    variant = 'primary',
    size = 'md',
    is_loading = false,
    disabled = false,
    type = 'button',
    onclick,
    class: className = '',
    icon,
    children
  } = $props<{
    variant?: Variant;
    size?: Size;
    is_loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (event: MouseEvent) => void;
    class?: string;
    icon?: Snippet;
    children?: Snippet;
  }>();

  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses: Record<Variant, string> = {
    primary: 'bg-accent border-accent text-white hover:bg-accent-hover',
    secondary: 'bg-white/5 border-white/10 text-white hover:bg-white/10',
    danger: 'bg-red-500 border-red-500 text-white hover:bg-red-600',
    success: 'bg-green-500 border-green-500 text-white hover:bg-green-600',
    ghost: 'bg-transparent border-transparent text-white/80 hover:bg-white/10'
  };

  const sizeClasses: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  };

  let buttonClasses = $derived(
    `${baseClasses} ${sizeClasses[size as Size] ?? sizeClasses.md} ${
      variantClasses[variant as Variant] ?? variantClasses.primary
    } ${className}`.trim()
  );
</script>

<button {type} class={buttonClasses} {onclick} disabled={disabled || is_loading}>
  {#if is_loading}
    <span
      class="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    ></span>
  {/if}
  {@render icon?.()}
  {@render children?.()}
</button>
