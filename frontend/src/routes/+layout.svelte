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
	import UploadModal from '$lib/components/UploadModal.svelte';
	import StatisticsModal from '$lib/components/StatisticsModal.svelte';
	import AboutModal from '$lib/components/AboutModal.svelte';
	import AppearanceModal from '$lib/components/AppearanceModal.svelte';

	let { children } = $props();

	onMount(() => {
		checkAuth();
		// Initialize theme (themeStore constructor applies saved theme)
		// This ensures theme is applied on page load
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#1e293b" />
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
		<UploadModal
			isOpen={uiState.isUploadOpen}
			onClose={() => (uiState.isUploadOpen = false)}
			onUploadSuccess={() => {
				invalidateAll();
			}}
		/>

		<StatisticsModal isOpen={uiState.isStatsOpen} onClose={() => (uiState.isStatsOpen = false)} />

		<AboutModal isOpen={uiState.isAboutOpen} onClose={() => (uiState.isAboutOpen = false)} />

		<AppearanceModal isOpen={uiState.isAppearanceOpen} onClose={() => (uiState.isAppearanceOpen = false)} />
	{/if}

	<ContextMenu />
	<ConfirmationModal />
</div>
