<script lang="ts">
  import { fade } from 'svelte/transition';
  import { submissionState } from '$lib/states/contributions/SubmissionState.svelte';
  import { lockScroll } from '$lib/actions/lockScroll';
  import SubmitSeriesCard from './SubmitSeriesCard.svelte';
  import Button from '$lib/components/controls/Button.svelte';

  let { onClose } = $props<{ onClose: () => void }>();

  const session = $derived(submissionState.session);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (document.activeElement === document.body) {
        onClose();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if session}
  <div
    use:lockScroll
    class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="bg-theme-main rounded-2xl border border-accent max-w-6xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl"
    >
      <div
        class="bg-theme-surface border-b border-theme-border p-4 flex items-center justify-between"
      >
        <div class="flex items-center gap-4">
          <h2 class="hidden sm:inline text-lg font-bold text-theme-primary">
            Submit to Shared Library
          </h2>

          <div class="flex items-center gap-2 text-xs font-mono">
            <span
              class="px-2 py-1 rounded bg-theme-main border border-theme-border text-theme-secondary"
            >
              Total: {session.progress.total}
            </span>
            <span
              class="px-2 py-1 rounded bg-theme-main border border-theme-border text-status-success"
            >
              Submitted: {session.progress.done}
            </span>
          </div>
        </div>

        <Button variant="ghost" onclick={onClose}>Close</Button>
      </div>

      <div class="flex-1 flex overflow-hidden">
        <div class="hidden md:flex w-64 border-r border-theme-border bg-theme-surface flex-col">
          <div
            class="p-2 text-[10px] font-bold text-theme-secondary uppercase sticky top-0 bg-theme-surface border-b border-theme-border/50"
          >
            Series List
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1">
            {#each session.items as item, index (item.id)}
              <button
                onclick={() => session!.select(index)}
                class="w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-all flex items-center gap-2
                  {session.currentIndex === index
                  ? 'bg-accent text-white shadow-md'
                  : 'text-theme-secondary hover:bg-white/5'}"
              >
                {#if item.status === 'submitted'}
                  <span class="text-status-success font-bold">✓</span>
                {:else if item.status === 'error'}
                  <span class="text-status-danger font-bold">!</span>
                {:else if item.status === 'submitting'}
                  <span class="animate-pulse">...</span>
                {:else}
                  <span class="opacity-30">○</span>
                {/if}

                <span class="truncate flex-1 {item.status === 'submitted' ? 'opacity-50' : ''}">
                  {item.sourceSeries.sortTitle}
                </span>
              </button>
            {/each}
          </div>
        </div>

        <div
          class="flex-1 bg-theme-main p-4 md:p-6 flex items-center justify-center overflow-hidden"
        >
          {#if session.current}
            {#key session.current.id}
              <SubmitSeriesCard item={session.current} />
            {/key}
          {:else}
            <div class="text-center">
              <p class="text-theme-secondary">No series selected.</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
