<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';

  import { onMount } from 'svelte';
  import { checkAuth, startAuthMonitoring } from '$lib/stores/authStore';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';
  import ToastContainer from '$lib/components/feedback/ToastContainer.svelte';

  let { children } = $props();

  onMount(() => {
    checkAuth();

    const stopMonitoring = startAuthMonitoring();
    let lastMessage = '';
    let lastAt = 0;

    const notify = (message: string) => {
      const now = Date.now();
      if (message && (message !== lastMessage || now - lastAt > 2000)) {
        toastStore.error(message);
        lastMessage = message;
        lastAt = now;
      }
    };

    const onError = (event: ErrorEvent) => {
      if (event?.error?.message) {
        notify(event.error.message);
      } else {
        notify('Unexpected error occurred.');
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (event?.reason instanceof Error) {
        notify(event.reason.message);
      } else {
        notify('Unexpected error occurred.');
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      stopMonitoring();
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <meta name="theme-color" content="#1e293b" />
</svelte:head>

<div class="min-h-screen bg-theme-main text-theme-primary font-sans selection:bg-accent-surface selection:text-white">
  {@render children()}

  <ToastContainer />
</div>
