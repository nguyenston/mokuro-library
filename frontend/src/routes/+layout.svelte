<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { checkAuth, user } from '$lib/authStore';
	import { uiState } from '$lib/states/uiState.svelte';
	import { themeStore } from '$lib/stores/themeStore.svelte';

	// Components
	import Header from '$lib/components/Header.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	// Code splitting: Load modals only when needed
	let UploadModal: typeof import('$lib/components/UploadModal.svelte').default | null = $state(null);
	let StatisticsModal: typeof import('$lib/components/StatisticsModal.svelte').default | null = $state(null);
	let AboutModal: typeof import('$lib/components/AboutModal.svelte').default | null = $state(null);
	let AppearanceModal: typeof import('$lib/components/AppearanceModal.svelte').default | null = $state(null);

	let { children } = $props();

	// Lazy load modals when they're opened
	async function loadUploadModal() {
		if (!UploadModal) {
			const module = await import('$lib/components/UploadModal.svelte');
			UploadModal = module.default;
		}
	}

	async function loadStatisticsModal() {
		if (!StatisticsModal) {
			const module = await import('$lib/components/StatisticsModal.svelte');
			StatisticsModal = module.default;
		}
	}

	async function loadAboutModal() {
		if (!AboutModal) {
			const module = await import('$lib/components/AboutModal.svelte');
			AboutModal = module.default;
		}
	}

	async function loadAppearanceModal() {
		if (!AppearanceModal) {
			const module = await import('$lib/components/AppearanceModal.svelte');
			AppearanceModal = module.default;
		}
	}

	// Load modals when they're opened
	$effect(() => {
		if (uiState.isUploadOpen) loadUploadModal();
		if (uiState.isStatsOpen) loadStatisticsModal();
		if (uiState.isAboutOpen) loadAboutModal();
		if (uiState.isAppearanceOpen) loadAppearanceModal();
	});

	onMount(() => {
		checkAuth();
		// Initialize theme (themeStore constructor applies saved theme)
		// This ensures theme is applied on page load
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#1e293b" />

	<!-- Preload critical fonts to reduce FOUT (Flash of Unstyled Text) -->
	<link
		rel="preload"
		href="/fonts/noto-sans-jp-v55-japanese_latin-regular.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link
		rel="preload"
		href="/fonts/noto-sans-jp-v55-japanese_latin-500.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
</svelte:head>

<div
	class="min-h-screen bg-theme-main text-theme-primary font-sans selection:bg-accent/30 selection:text-white"
>
	{#if $user && uiState.context !== 'reader'}
		<Header />
	{/if}

	<main class="relative">
		{@render children()}
	</main>

	{#if $user}
		{#if UploadModal && uiState.isUploadOpen}
			<svelte:component
				this={UploadModal}
				isOpen={uiState.isUploadOpen}
				onClose={() => (uiState.isUploadOpen = false)}
			onUploadSuccess={async () => {
				const { clearApiCache } = await import('$lib/api');
				clearApiCache();
				invalidateAll();
			}}
			/>
		{/if}

		{#if StatisticsModal && uiState.isStatsOpen}
			<svelte:component
				this={StatisticsModal}
				isOpen={uiState.isStatsOpen}
				onClose={() => (uiState.isStatsOpen = false)}
			/>
		{/if}

		{#if AboutModal && uiState.isAboutOpen}
			<svelte:component
				this={AboutModal}
				isOpen={uiState.isAboutOpen}
				onClose={() => (uiState.isAboutOpen = false)}
			/>
		{/if}

		{#if AppearanceModal && uiState.isAppearanceOpen}
			<svelte:component
				this={AppearanceModal}
				isOpen={uiState.isAppearanceOpen}
				onClose={() => (uiState.isAppearanceOpen = false)}
			/>
		{/if}
	{/if}

	<ContextMenu />
	<ConfirmationModal />
</div>
