<script lang="ts">
	import { user } from '$lib/authStore';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { uiState } from '$lib/states/uiState.svelte';
	import { onMount } from 'svelte';

	// Import setting panels
	import ReaderSettings from '$lib/components/settings/ReaderSettings.svelte';
	import AnkiSettings from '$lib/components/settings/AnkiSettings.svelte';
	import LibraryOverview from '$lib/components/settings/LibraryOverview.svelte';

	// Define available categories
	const categories = [
		{ id: 'reader', label: 'Reader Settings', icon: 'book', component: ReaderSettings },
		{ id: 'anki', label: 'Anki Connect', icon: 'link', component: AnkiSettings }, // TODO: Implement as part of Anki integration feature
		{ id: 'library', label: 'Library Overview', icon: 'library', component: LibraryOverview }
		// Add more categories here as you create them
		// { id: 'users', label: 'User Management', icon: 'users', component: UserManagement },
		// { id: 'version', label: 'Version History', icon: 'clock', component: VersionHistory },
		// { id: 'defaults', label: 'Default Values', icon: 'settings', component: DefaultValues },
	];

	// State
	let activeCategory = $state('reader');

	// Initialize
	onMount(() => {
		uiState.setContext('settings', 'Settings', []);

		// Check URL params for category
		if (browser) {
			const cat = page.url.searchParams.get('category');
			if (cat && categories.some((c) => c.id === cat)) {
				activeCategory = cat;
			}
		}
	});

	// Auth check
	$effect(() => {
		if (browser && $user === null) goto('/login');
	});

	// Sync category with URL
	$effect(() => {
		if (browser) {
			const newParams = new URLSearchParams(page.url.searchParams);
			newParams.set('category', activeCategory);
			const queryString = newParams.toString();
			const currentQuery = page.url.searchParams.toString();
			if (queryString !== currentQuery) {
				goto(`/settings?${queryString}`, { replaceState: true, keepFocus: true, noScroll: true });
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
	<aside class="w-[72px] md:w-64 bg-theme-main px-2 py-6 md:p-6">
		<div class="mb-6 md:px-0 text-center md:text-left overflow-hidden">
			<p
				class="hidden md:block text-[11px] font-black text-theme-tertiary uppercase tracking-[0.2em] whitespace-nowrap"
			>
				Categories
			</p>
		</div>

		<nav class="space-y-2">
			{#each categories as category}
				{@const isActive = activeCategory === category.id}
				<button
					onclick={() => (activeCategory = category.id)}
					class="group w-full flex flex-col md:flex-row items-center md:justify-start gap-0 md:gap-3 p-2 md:px-4 md:py-3 rounded-xl border-2 transition-colors duration-200 {isActive
						? 'bg-accent-surface text-accent border-accent/50 shadow-lg shadow-accent/20'
						: 'text-theme-primary hover:text-white hover:bg-theme-surface-hover/70 border-transparent hover:border-theme-border/50'}"
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
							{:else}
								<path d={getIconPath(category.icon)} />
								<circle cx="12" cy="12" r="3" />
							{/if}
						</svg>
					</div>

					<div
						class="grid transition-[grid-template-rows,opacity,padding] duration-300 ease-in-out
                        {isActive
							? 'grid-rows-[1fr] opacity-100 py-2 md:py-0'
							: 'grid-rows-[0fr] opacity-0 md:grid-rows-[1fr] md:opacity-100 md:py-0'}"
					>
						<div class="overflow-hidden">
							<span
								class="block font-medium text-xs md:text-sm whitespace-nowrap
                                [writing-mode:vertical-rl] rotate-180
                                md:[writing-mode:horizontal-tb] md:rotate-0
                                mx-auto md:mx-0"
							>
								{category.label}
							</span>
						</div>
					</div>

					<div
						class="{isActive
							? 'opacity-100 translate-x-0'
							: 'opacity-0 translate-x-2'} hidden md:block ml-auto w-1 h-4 rounded-full bg-accent transition-all duration-300"
					></div>
				</button>
			{/each}
		</nav>
	</aside>

	<main class="flex-1 p-6 overflow-y-auto">
		{#each categories as category}
			{#if activeCategory === category.id}
				<div class="animate-in fade-in slide-in-from-bottom-2 duration-300">
					<category.component />
				</div>
			{/if}
		{/each}
	</main>
</div>
