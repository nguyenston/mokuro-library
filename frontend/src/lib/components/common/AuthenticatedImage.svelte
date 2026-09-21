<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fetchAuthenticatedImage, revokeImageUrl } from '$lib/services/api';

  let {
    src,
    alt = '',
    class: className = '',
    loading = 'lazy' as 'lazy' | 'eager',
    onload,
    onerror,
    ...restProps
  } = $props<{
    src: string;
    alt?: string;
    class?: string;
    loading?: 'lazy' | 'eager';
    onload?: (event: Event) => void;
    onerror?: (event: Event) => void;
    [key: string]: unknown;
  }>();

  let blobUrl = $state('');
  let isLoading = $state(true);
  let hasError = $state(false);
  let imgElement: HTMLImageElement | null = $state(null);

  // Fetch authenticated image and create blob URL
  async function loadImage() {
    if (!src) {
      isLoading = false;
      return;
    }

    isLoading = true;
    hasError = false;

    try {
      blobUrl = await fetchAuthenticatedImage(src, true);
      isLoading = false;
    } catch (error) {
      console.error('[AuthenticatedImage] Failed to load image:', src, error);
      hasError = true;
      isLoading = false;
      if (onerror) {
        onerror(new Event('error'));
      }
    }
  }

  // Load image on mount and when src changes
  $effect(() => {
    loadImage();
  });

  // Cleanup on unmount
  onDestroy(() => {
    if (blobUrl) {
      revokeImageUrl(blobUrl, src);
    }
  });

  function handleLoad(event: Event) {
    isLoading = false;
    if (onload) {
      onload(event);
    }
  }

  function handleError(event: Event) {
    hasError = true;
    isLoading = false;
    if (onerror) {
      onerror(event);
    }
  }
</script>

{#if hasError}
  <div
    class="authenticated-image-error {className}"
    role="img"
    aria-label={alt || 'Failed to load image'}
  >
    <div class="error-content">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <span>Failed to load image</span>
    </div>
  </div>
{:else if isLoading}
  <div class="authenticated-image-loading {className}" role="img" aria-label={alt || 'Loading...'}>
    <div class="loading-spinner"></div>
  </div>
{:else}
  <img
    bind:this={imgElement}
    src={blobUrl}
    {alt}
    class={className}
    {loading}
    onload={handleLoad}
    onerror={handleError}
    {...restProps}
  />
{/if}

<style>
  .authenticated-image-error,
  .authenticated-image-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-surface, #f5f5f5);
    border: 1px solid var(--theme-border, #e0e0e0);
    border-radius: 4px;
    min-height: 100px;
    width: 100%;
  }

  .error-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--theme-text-muted, #666);
    padding: 1rem;
    text-align: center;
  }

  .error-content svg {
    opacity: 0.5;
  }

  .error-content span {
    font-size: 0.875rem;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--theme-border, #e0e0e0);
    border-top-color: var(--accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
