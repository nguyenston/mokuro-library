<script lang="ts">
  import { type Snippet } from 'svelte';
  import { longpress } from '$lib/actions/longPress';
  import { vibrate, HAPTIC_PATTERNS } from '$lib/utils/interaction/haptics';
  import AuthenticatedImage from '$lib/components/common/AuthenticatedImage.svelte';
  import { resolve } from '$app/paths';

  // --- Types ---
  interface EntryData {
    id: string;
    title: string | null;
    folderName: string;
    coverUrl?: string | null;
  }

  interface ProgressData {
    percent: number;
    isRead: boolean;
    hideBar?: boolean;
  }

  interface BadgeData {
    text: string;
    status: 'success' | 'warning' | 'danger' | 'none';
  }

  // --- Props ---
  let {
    entry,
    type = 'volume',
    viewMode = 'grid',
    isSelected = false,
    isSelectionMode = false,
    progress = { percent: 0, isRead: false, hideBar: true },
    href = '#',
    mainStat = '',
    subStat = '',
    onSelect,
    onLongPress,
    circleAction,
    secondaryCircleAction,
    titleAction,
    listActions,
    badge
  }: {
    entry: EntryData;
    type?: 'series' | 'volume';
    viewMode?: 'grid' | 'list';
    isSelected?: boolean;
    isSelectionMode?: boolean;
    progress?: ProgressData;
    href?: string;
    mainStat?: string | number;
    subStat?: string;
    onSelect?: (e: MouseEvent) => void;
    onLongPress?: () => void;
    circleAction?: Snippet;
    secondaryCircleAction?: Snippet;
    titleAction?: Snippet;
    listActions?: Snippet;
    badge?: BadgeData;
  } = $props();

  // Determine read status for badge
  const getStatusBadge = () => {
    if (progress.isRead) return { label: 'READ', color: 'bg-status-success' };
    if (progress.percent > 0) return { label: 'READING', color: 'bg-accent' };
    return { label: 'UNREAD', color: 'bg-status-unread' };
  };

  const status = $derived(getStatusBadge());

  const gridAspectClass = $derived(type === 'series' ? 'aspect-[7/11]' : 'aspect-[2/3]');

  const badgeToneClass = (value: BadgeData['status']) => {
    if (value === 'success') return 'bg-status-success';
    if (value === 'warning') return 'bg-status-warning';
    if (value === 'danger') return 'bg-status-danger';
    return 'bg-theme-secondary';
  };

  const badgeTextClass = (value: BadgeData['status']) => {
    if (value === 'success') return 'text-status-success';
    if (value === 'warning') return 'text-status-warning';
    if (value === 'danger') return 'text-status-danger';
    return 'text-theme-secondary';
  };
</script>

{#if viewMode === 'grid'}
  <div
    use:longpress
    onlongpress={() => {
      vibrate(HAPTIC_PATTERNS.medium);
      onLongPress?.();
    }}
    class={`library-entry library-entry-grid group relative rounded-2xl border-2 border-theme-primary bg-theme-surface/20 flex flex-col transition-all duration-300 overflow-hidden
    shadow-theme-secondary/10 shadow-[0_4px_16px_0] hover:shadow-[0_8px_24px_0]
    ${
      isSelected
        ? 'border-accent/50 ring-1 ring-accent shadow-[0_0_20px_rgba(99,102,241,0.4)] z-30 scale-[1.02]'
        : 'border-theme-primary/10 hover:border-theme-primary/20 z-10'
    }
    ${isSelectionMode && !isSelected ? 'opacity-40 grayscale-[0.4]' : 'opacity-100'}`}
  >
    <a
      {href}
      onpointerdown={onSelect}
      onclick={(e) => {
        if (isSelectionMode) e.preventDefault();
      }}
      class="absolute inset-0 z-10"
      aria-label={`View ${entry.title || entry.folderName}`}
      data-sveltekit-preload-data="off"
    ></a>

    <div
      class={`${gridAspectClass} w-full bg-theme-main relative overflow-hidden pointer-events-none z-10`}
    >
      {#if entry.coverUrl}
        <AuthenticatedImage
          src={entry.coverUrl}
          alt={entry.folderName}
          loading="lazy"
          class="h-full w-full object-cover transition-transform duration-700 md:group-hover:scale-110"
        />
      {:else}
        <div
          class="flex h-full w-full items-center justify-center text-theme-tertiary bg-theme-surface font-bold text-xl"
        >
          {entry.folderName[0]}
        </div>
      {/if}

      <div
        class="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-40 h-20"
      ></div>

      {#if badge}
        <div class="absolute top-3 right-0 z-20">
          <span
            class="relative inline-flex items-center justify-center text-center min-w-[44px] pl-5 pr-2 py-1 text-[10px] font-black uppercase tracking-[0.22em]
            text-accent bg-gradient-to-b from-theme-surface via-theme-main to-theme-surface
            border border-theme-border/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_6px_12px_rgba(15,23,42,0.4)]
            rounded-l-md rounded-r-none"
            title={badge.text}
          >
            <span class="subtle-neon-glow">{badge.text}</span>
          </span>
          <span
            class={`absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${badgeTextClass(
              badge.status
            )} ${badgeToneClass(badge.status)} ${badge.status === 'none' ? '' : 'neon-glow'}`}
            aria-hidden="true"
          ></span>
        </div>
      {/if}

      <div
        class="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10"
      ></div>
      <div class="absolute bottom-0 left-0 right-0 p-3 pb-2 z-20 flex flex-col justify-end">
        <div class="font-bold text-white text-sm leading-tight line-clamp-2 drop-shadow-md">
          {entry.title || entry.folderName}
        </div>
      </div>
    </div>

    <div
      class="px-3 py-2 bg-theme-surface/60 flex items-center justify-between gap-3 relative z-20 border-t border-theme-border/30"
    >
      <div class="flex flex-col gap-1.5 min-w-0 flex-1">
        {#if mainStat}
          <div
            class={`text-[12px] font-bold uppercase tracking-[0.1em] leading-none ${
              status.color === 'bg-status-success'
                ? 'text-status-success'
                : status.color === 'bg-accent'
                  ? 'text-accent'
                  : 'text-status-unread'
            }`}
          >
            {mainStat}
          </div>
        {/if}

        {#if subStat && mainStat}
          <div class="w-full h-[1px] bg-theme-border/90"></div>
        {/if}

        {#if subStat}
          <div class="text-[11px] text-theme-secondary font-medium leading-none">
            {subStat}
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-1">
        {#if secondaryCircleAction}
          <div
            class="z-30 pointer-events-auto opacity-60 hover:opacity-100 transition-opacity duration-200"
          >
            {@render secondaryCircleAction()}
          </div>
        {/if}
        {#if circleAction || !progress.hideBar}
          <div class="relative grid place-items-center w-11 h-11 flex-shrink-0">
            {#if circleAction}
              <div class="z-30 col-start-1 row-start-1 pointer-events-auto">
                {@render circleAction()}
              </div>
            {/if}

            {#if !progress.hideBar}
              <svg
                class="col-start-1 row-start-1 w-11 h-11 transform -rotate-90 overflow-visible pointer-events-none"
                viewBox="0 0 44 44"
              >
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="currentColor"
                  stroke-width="3.5"
                  fill="none"
                  class="text-theme-border-light"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="currentColor"
                  stroke-width="3.5"
                  fill="none"
                  class="intense-neon-glow transition-all duration-700 {status.color ===
                  'bg-status-success'
                    ? 'text-status-success'
                    : status.color === 'bg-accent'
                      ? 'text-accent'
                      : 'text-status-unread'}"
                  stroke-dasharray="113.10"
                  stroke-dashoffset={113.1 -
                    (113.1 * (progress.isRead ? 100 : progress.percent)) / 100}
                  stroke-linecap="round"
                />
              </svg>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div
    use:longpress
    onlongpress={() => {
      vibrate(HAPTIC_PATTERNS.medium);
      onLongPress?.();
    }}
    class={`library-entry library-entry-list group relative rounded-2xl border-2 bg-theme-surface/30 flex items-center
    transition-all duration-300 overflow-hidden h-32
    shadow-theme-secondary/10 shadow-[0_4px_16px_0] hover:shadow-[0_8px_24px_0]
    ${
      isSelected
        ? 'border-accent/50 ring-1 ring-accent shadow-[0_0_20px_rgba(99,102,241,0.4)] z-30'
        : 'border-theme-primary/10 hover:border-theme-primary/20 z-10'
    }
    ${isSelectionMode && !isSelected ? 'opacity-40 grayscale-[0.4]' : 'opacity-100'}`}
  >
    <a
      {href}
      onpointerdown={onSelect}
      onclick={(e) => {
        if (isSelectionMode) e.preventDefault();
      }}
      class="absolute inset-0 z-0 block"
      aria-label={`View ${entry.title || entry.folderName}`}
      data-sveltekit-preload-data="off"
    ></a>

    <div
      class="relative h-full aspect-[7/11] bg-theme-main flex-shrink-0 pointer-events-none border-r border-theme-primary/20 overflow-hidden z-10"
    >
      {#if entry.coverUrl}
        <AuthenticatedImage
          src={entry.coverUrl}
          alt=""
          loading="lazy"
          class="h-full w-full object-cover transition-transform duration-700 md:group-hover:scale-110"
        />
      {:else}
        <div
          class="h-full w-full flex items-center justify-center text-2xl font-bold text-theme-tertiary"
        >
          #
        </div>
      {/if}
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"
      ></div>
    </div>
    {#if badge}
      <div class="absolute z-20" style="top: -3px; left: calc(81.5px + 1rem);">
        <span
          class="relative inline-flex items-center justify-center text-center min-w-[48px] pl-5 pr-2 py-1 text-[11px] font-black uppercase tracking-[0.2em]
          text-accent bg-gradient-to-b from-theme-surface via-theme-main to-theme-surface
          border border-theme-border/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_6px_12px_rgba(15,23,42,0.4)]
          shadow-theme-secondary/10 shadow-[0_8px_16px_-13px_rgba(148,163,184,0.35)]
          rounded-b-md rounded-t-none"
          title={badge.text}
        >
          <span class="subtle-neon-glow">{badge.text}</span>
        </span>
        <span
          class={`absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${badgeTextClass(
            badge.status
          )} ${badgeToneClass(badge.status)} ${badge.status === 'none' ? '' : 'neon-glow'}`}
          aria-hidden="true"
        ></span>
      </div>
    {/if}

    <div
      class="flex-grow min-w-0 py-4 px-4 sm:px-6 pointer-events-none z-10 flex flex-col justify-center"
    >
      <div class="flex items-start gap-2">
        <div
          class="text-base sm:text-lg font-bold text-theme-primary transition-colors group-hover:text-accent
                line-clamp-2 leading-tight flex-grow"
        >
          {entry.title || entry.folderName}
        </div>

        {#if titleAction}
          <div
            class="pointer-events-auto relative z-20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
          >
            {@render titleAction()}
          </div>
        {/if}
      </div>

      <div class="text-xs sm:text-sm flex flex-wrap gap-x-4 gap-y-0.5 items-center mt-1.5">
        {#if mainStat}
          <span
            class={`font-bold transition-colors ${progress.isRead ? 'text-status-success' : 'text-theme-secondary'}`}
          >
            {mainStat}
          </span>
        {/if}

        {#if mainStat && subStat}
          <span class="text-theme-tertiary font-medium whitespace-nowrap"> • </span>
        {/if}

        {#if subStat}
          <span class="text-theme-tertiary font-medium whitespace-nowrap">{subStat}</span>
        {/if}
      </div>
    </div>

    <div
      class="flex items-center gap-4 pr-5 pl-5 border-l border-theme-primary/20 h-12 relative z-20 flex-shrink-0"
    >
      {@render listActions?.()}
    </div>

    {#if !progress.hideBar}
      <div class="absolute bottom-0 left-[81.5px] right-0 -ml-[4px] h-1 bg-theme-surface/50 z-20">
        <div
          class="intense-neon-glow h-full transition-all duration-700 {progress.isRead
            ? 'bg-status-success text-status-success'
            : 'bg-accent text-accent'}"
          style="width: {progress.isRead ? 100 : progress.percent}%"
        ></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .library-entry {
    content-visibility: auto;
    contain: content;
    contain-intrinsic-size: auto 420px;
  }

  .library-entry-list {
    contain-intrinsic-size: auto 128px;
  }

  .intense-neon-glow {
    /* Layer 1: Sharp definition (The "hot" edge) */
    filter: drop-shadow(0 0 1px currentColor) /* Layer 2: Immediate bloom */
      drop-shadow(0 0 3px currentColor)
      /* Layer 3: The fast-decaying outer edge (reduced from 12px to 7px) */
      drop-shadow(0 0 7px currentColor);
  }
</style>
