<script lang="ts">
  import { browser } from '$app/environment';
  import { user } from '$lib/stores/authStore';
  import { metadataOps } from '$lib/states/metadata/metadataOperations.svelte.ts';
  import LibraryView from './home/components/LibraryView.svelte';

  $effect(() => {
    if (browser && $user === null) {
      metadataOps.flush();
    }
  });
</script>

<svelte:head>
  <title>{$user ? `${$user.username}'s Library` : 'Mokuro Library'}</title>
</svelte:head>

{#if $user}
  <LibraryView />
{:else}
  <div class="flex min-h-[60vh] items-center justify-center text-theme-secondary">
    Redirecting...
  </div>
{/if}
