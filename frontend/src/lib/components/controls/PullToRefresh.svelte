<script lang="ts">
  // browser not required here

  let {
    onRefresh,
    threshold = 80,
    children
  }: {
    onRefresh: () => void | Promise<void>;
    threshold?: number;
    children?: (() => unknown) | undefined;
  } = $props();

  let pullDistance = $state(0);
  let touchStartY = $state(0);
  let isRefreshing = $state(false);
  let canPull = $state(false);

  function handleTouchStart(e: TouchEvent) {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop === 0) {
      touchStartY = e.touches[0].clientY;
      canPull = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!canPull || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;

    if (diff > 0) {
      pullDistance = Math.min(diff * 0.5, threshold + 20); // Damping effect
      if (pullDistance > 10) {
        e.preventDefault(); // Prevent scroll when pulling
      }
    }
  }

  async function handleTouchEnd() {
    if (!canPull) return;

    if (pullDistance >= threshold) {
      isRefreshing = true;
      try {
        await onRefresh();
      } finally {
        isRefreshing = false;
      }
    }

    pullDistance = 0;
    touchStartY = 0;
    canPull = false;
  }

  const pullPercentage = $derived(Math.min((pullDistance / threshold) * 100, 100));
  const shouldRelease = $derived(pullDistance >= threshold);
</script>

<div
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  class="relative"
>
  {#if pullDistance > 0 || isRefreshing}
    <div
      class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-theme-surface/95 backdrop-blur transition-all"
      style="height: {Math.max(pullDistance, isRefreshing ? 60 : 0)}px"
    >
      <div class="flex flex-col items-center gap-2">
        {#if isRefreshing}
          <div
            class="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent"
          ></div>
          <span class="text-sm text-theme-secondary">Refreshing...</span>
        {:else}
          <svg
            class="h-6 w-6 transition-transform"
            style="transform: rotate({pullPercentage * 1.8}deg)"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span class="text-sm text-theme-secondary">
            {shouldRelease ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        {/if}
      </div>
    </div>
  {/if}

  {@render children?.()}
</div>
