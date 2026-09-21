<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { uiState } from '$lib/states/ui/uiState.svelte.ts';
  import { onMount, type Component } from 'svelte';

  // Lazy load setting panels - only load when needed
  const loadReaderSettings = () => import('$lib/components/settings/ReaderSettings.svelte');
  // (Anki & Library overview loaders removed for now)
  const loadScrapeSettings = () => import('$lib/components/settings/ScrapeSettings.svelte');
  const loadKeybindSettings = () => import('$lib/components/settings/KeybindSettings.svelte');
  const loadTestRunnerSettings = () => import('$lib/components/settings/TestRunnerSettings.svelte');

  // Define available categories with lazy loaders
  type Category = {
    id: string;
    label: string;
    icon: string;
    loader: () => Promise<{ default: Component }>;
  };

  const categories: Category[] = [
    { id: 'reader', label: 'Reader Settings', icon: 'book', loader: loadReaderSettings },
    { id: 'scrape', label: 'Scrape Settings', icon: 'download', loader: loadScrapeSettings },
    { id: 'keybinds', label: 'Keybinds', icon: 'keyboard', loader: loadKeybindSettings },
    { id: 'tests', label: 'Test Runner', icon: 'flask', loader: loadTestRunnerSettings }
  ];

  // WIP categories for future implementation
  // const categories_WIP = [
  // 	{ id: 'anki', label: 'Anki Connect', icon: 'link', loader: loadAnkiSettings },
  // 	{ id: 'library', label: 'Library Overview', icon: 'library', loader: loadLibraryOverview }
  // ];

  // State
  let activeCategory = $state('reader');
  let LoadedComponent = $state<Component | null>(null);
  let isLoadingComponent = $state(false);

  // Load component when category changes
  $effect(() => {
    const category = categories.find((c) => c.id === activeCategory);
    if (category) {
      isLoadingComponent = true;
      category
        .loader()
        .then((module) => {
          LoadedComponent = module.default;
          isLoadingComponent = false;
        })
        .catch((err) => {
          console.error('Failed to load component:', err);
          isLoadingComponent = false;
        });
    }
  });

  // Initialize
  onMount(() => {
    uiState.setSubtext('settings', 'Settings');

    // Check URL params for category
    if (browser) {
      const cat = page.url.searchParams.get('category');
      if (cat && categories.some((c) => c.id === cat)) {
        activeCategory = cat;
      }
    }
  });

  // Sync category with URL
  $effect(() => {
    if (browser) {
      const newParams = new SvelteURLSearchParams(page.url.searchParams);
      newParams.set('category', activeCategory);
      const queryString = newParams.toString();
      const currentQuery = page.url.searchParams.toString();
      if (queryString !== currentQuery) {
        goto(resolve(`/settings?${queryString}`, {}), {
          replaceState: true,
          keepFocus: true,
          noScroll: true
        });
      }
    }
  });

  // Get icon SVG path
  const getIconPath = (icon: string) => {
    const icons: Record<string, string> = {
      book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
      link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
      users:
        'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
      library: 'M22 12h-4l-3 9L9 3l-3 9H2',
      clock: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2',
      download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
      keyboard: 'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
      flask: 'M10 2h4v2h-1v4.6l5.7 9.9a2 2 0 0 1-1.7 3H7a2 2 0 0 1-1.7-3L11 8.6V4h-1V2z',
      settings:
        'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'
    };
    return icons[icon] || icons.settings;
  };

  // Find active component
  $effect(() => {
    const cat = categories.find((c) => c.id === activeCategory);
    if (!cat) activeCategory = 'reader';
  });
</script>

<div class="flex min-h-[calc(100vh-4rem)] max-w-7xl mx-auto bg-theme-main">
  <aside class="w-15 lg:w-66 bg-theme-main pl-4 py-6 lg:px-6">
    <div class="mb-6 lg:px-0 text-center lg:text-left overflow-hidden">
      <p
        class="hidden lg:block text-[11px] font-black text-theme-tertiary uppercase tracking-[0.2em] whitespace-nowrap"
      >
        Categories
      </p>
      <p
        class="block lg:hidden text-[11px] font-black text-theme-tertiary uppercase tracking-[0.2em] whitespace-nowrap"
      >
        Cat
      </p>
    </div>

    <nav class="space-y-2">
      {#each categories as category (category.id)}
        {@const isActive = activeCategory === category.id}
        <button
          onclick={() => (activeCategory = category.id)}
          class="group w-full flex flex-col lg:flex-row items-center lg:justify-start gap-0 lg:gap-3 p-1
            lg:px-4 lg:py-3 rounded-xl border-2 transition-colors duration-200 {isActive
            ? 'bg-accent-surface text-accent border-accent/50 shadow-lg shadow-accent/20'
            : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover/70 border-theme-border/50 hover:border-theme-border/80'}"
        >
          <div class="relative flex items-center justify-center w-8 h-8 shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="transition-transform duration-300 {isActive
                ? 'scale-110 drop-shadow-md'
                : 'group-hover:scale-110'}"
            >
              {#if category.icon === 'book'}
                <path d={getIconPath(category.icon)} />
              {:else if category.icon === 'link'}
                <path d={getIconPath(category.icon)} />
                <path d="m14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              {:else if category.icon === 'users'}
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              {:else if category.icon === 'library'}
                <path d={getIconPath(category.icon)} />
              {:else if category.icon === 'clock'}
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              {:else if category.icon === 'download'}
                <path d={getIconPath(category.icon)} />
              {:else if category.icon === 'keyboard'}
                <path d={getIconPath(category.icon)} />
                <path d="M7 10h1M10 10h1M13 10h1M16 10h1" />
                <path d="M7 14h10" />
              {:else if category.icon === 'flask'}
                <path d={getIconPath(category.icon)} />
              {:else}
                <path d={getIconPath(category.icon)} />
                <circle cx="12" cy="12" r="3" />
              {/if}
            </svg>
          </div>

          <div
            class="grid transition-[grid-template-rows,opacity,padding] duration-300 ease-in-out
                        {isActive
              ? 'grid-rows-[1fr] opacity-100 py-2 lg:py-0'
              : 'grid-rows-[0fr] opacity-0 lg:grid-rows-[1fr] lg:opacity-100 lg:py-0'}"
          >
            <div class="overflow-hidden">
              <span
                class="block font-medium text-xs lg:text-sm whitespace-nowrap
                                [writing-mode:vertical-rl] rotate-180
                                lg:[writing-mode:horizontal-tb] lg:rotate-0
                                mx-auto lg:mx-0"
              >
                {category.label}
              </span>
            </div>
          </div>

          <div
            class="{isActive
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-2'} hidden lg:block ml-auto w-1 h-4 rounded-full bg-accent transition-all duration-300"
          ></div>
        </button>
      {/each}
    </nav>
  </aside>

  <main class="flex-1 p-4 overflow-y-auto">
    {#if isLoadingComponent}
      <div class="flex items-center justify-center p-12">
        <div class="text-theme-secondary">Loading...</div>
      </div>
    {:else if LoadedComponent}
      <LoadedComponent />
    {/if}
  </main>
</div>
