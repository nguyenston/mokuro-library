<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authReady, user } from '$lib/stores/authStore';
  import { uiState } from '$lib/states/ui/uiState.svelte.ts';
  import { contributionsSummaryState } from '$lib/states/contributions/ContributionsSummaryState.svelte';
  import { keybindStore } from '$lib/stores/keybindStore';
  import { handleGlobalKeydown } from '$lib/keybinds/runtime';
  import { prefetchAppData } from '$lib/utils/caching/eagercache';
  import { prefetchCommonRoutes } from '$lib/utils/caching/prefetch';
  import type { Component } from 'svelte';

  // Components - Critical components loaded immediately
  import Header from '$lib/components/layout/Header.svelte';
  import ContextMenu from '$lib/components/menu/ContextMenu.svelte';
  import ConfirmationModal from '$lib/components/modals/ConfirmationModal.svelte';
  import KeyboardShortcutsModal from '$lib/components/modals/KeyboardShortcutsModal.svelte';
  import { apiCache } from '$lib/utils/caching/apiCache';
  import { rebaseState } from '$lib/states/rebase/RebaseState.svelte';

  // Lazy load modals that are less frequently used
  const loadUploadModal = () => import('$lib/components/modals/UploadModal.svelte');
  const loadStatisticsModal = () => import('$lib/components/modals/StatisticsModal.svelte');
  const loadAboutModal = () => import('$lib/components/modals/AboutModal.svelte');
  const loadAppearanceModal = () => import('$lib/components/modals/AppearanceModal.svelte');
  const loadRebaseModal = () => import('$lib/components/modals/rebase/RebaseManagerModal.svelte');

  // UploadModal has an extra 'onUploadSuccess' prop
  type UploadModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
  };

  // The other modals only share these two props
  type BaseModalProps = {
    isOpen: boolean;
    onClose: () => void;
  };

  let { children } = $props();

  // Lazy-loaded modal components
  let UploadModal = $state<Component<UploadModalProps> | null>(null);
  let StatisticsModal = $state<Component<BaseModalProps> | null>(null);
  let AboutModal = $state<Component<BaseModalProps> | null>(null);
  let AppearanceModal = $state<Component<BaseModalProps> | null>(null);
  let RebaseManagerModal = $state<Component<{}> | null>(null);
  let didPrefetch = $state(false);
  let isRedirectingToLogin = false;

  // Load modals when needed
  $effect(() => {
    if (uiState.isUploadOpen && !UploadModal) {
      loadUploadModal().then((m) => (UploadModal = m.default));
    }
  });

  $effect(() => {
    if (uiState.isStatsOpen && !StatisticsModal) {
      loadStatisticsModal().then((m) => (StatisticsModal = m.default));
    }
  });

  $effect(() => {
    if (uiState.isAboutOpen && !AboutModal) {
      loadAboutModal().then((m) => (AboutModal = m.default));
    }
  });

  $effect(() => {
    if (uiState.isAppearanceOpen && !AppearanceModal) {
      loadAppearanceModal().then((m) => (AppearanceModal = m.default));
    }
  });

  $effect(() => {
    if (rebaseState.isModalOpen && !RebaseManagerModal) {
      loadRebaseModal().then((m) => (RebaseManagerModal = m.default));
    }
  });

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      handleGlobalKeydown(event);
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  $effect(() => {
    if (!$user || didPrefetch) return;
    didPrefetch = true;

    contributionsSummaryState.refresh();

    // Prefetch app data after login
    prefetchAppData();
    prefetchCommonRoutes();
  });

  $effect(() => {
    if ($user === null) {
      didPrefetch = false;
    }
  });

  $effect(() => {
    if (!$authReady) return;
    if ($user !== null) return;
    if (isRedirectingToLogin) return;
    isRedirectingToLogin = true;
    goto('/login', { replaceState: true }).finally(() => {
      isRedirectingToLogin = false;
    });
  });

  $effect(() => {
    keybindStore.setFromSettings($user?.settings ?? null);
  });
</script>

<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="min-h-screen bg-theme-main text-theme-primary font-sans selection:bg-accent-surface selection:text-white">
  {#if $user && uiState.subtext !== 'reader'}
    <Header />
  {/if}

  <main id="main-content" class="relative" tabindex="-1">
    {@render children()}
  </main>

  {#if $user}
    {#if uiState.isUploadOpen && UploadModal}
      <UploadModal
        isOpen={uiState.isUploadOpen}
        onClose={() => (uiState.isUploadOpen = false)}
        onUploadSuccess={() => {
          apiCache.invalidateSeriesCache();
          apiCache.invalidateLibraryCache(true);
          uiState.refreshLibrary();
        }}
      />
    {/if}

    {#if uiState.isStatsOpen && StatisticsModal}
      <StatisticsModal isOpen={uiState.isStatsOpen} onClose={() => (uiState.isStatsOpen = false)} />
    {/if}

    {#if uiState.isAboutOpen && AboutModal}
      <AboutModal isOpen={uiState.isAboutOpen} onClose={() => (uiState.isAboutOpen = false)} />
    {/if}

    {#if uiState.isAppearanceOpen && AppearanceModal}
      <AppearanceModal
        isOpen={uiState.isAppearanceOpen}
        onClose={() => (uiState.isAppearanceOpen = false)}
      />
    {/if}

    {#if rebaseState.isModalOpen && RebaseManagerModal}
      <RebaseManagerModal />
    {/if}
  {/if}

  <ContextMenu />
  <ConfirmationModal />
  <KeyboardShortcutsModal />
</div>

<style>
  .skip-link {
    position: absolute;
    top: -3rem;
    left: 0;
    background: var(--color-accent);
    color: white;
    padding: 0.75rem 1rem;
    z-index: 9999;
    text-decoration: none;
    font-weight: 500;
    border-radius: 0 0 0.25rem 0;
    transition: top 0.2s ease;
  }

  .skip-link:focus {
    top: 0;
    outline: 2px solid white;
    outline-offset: 2px;
  }
</style>
