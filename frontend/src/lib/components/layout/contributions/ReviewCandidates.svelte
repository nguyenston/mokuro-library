<script lang="ts">
  import { onMount } from 'svelte';
  import { getReviewCandidates } from '$lib/services/reviewApi';
  import { fade, scale } from 'svelte/transition';
  import { Dices, Sparkles, ArrowRight, GitMerge, GitPullRequest } from 'lucide-svelte';
  import type { RebaseQueueEntry } from '$lib/types';
  import AuthenticatedImage from '$lib/components/common/AuthenticatedImage.svelte';
  import SubmitReviewModal from '$lib/components/modals/contributions/SubmitReviewModal.svelte';

  let draft = $state<RebaseQueueEntry | null>(null);
  let loading = $state(false);
  let showModal = $state(false);

  async function spin() {
    loading = true;
    try {
      // Small artificial delay for "spin" feel
      await new Promise((r) => setTimeout(r, 400));
      const candidates = await getReviewCandidates(1);
      draft = candidates[0] || null;
    } catch (e) {
      console.error(e);
      draft = null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    spin();
  });
</script>

<div class="mb-8">
  <div class="flex items-center gap-2 mb-3">
    <Sparkles class="w-4 h-4 text-accent" />
    <h3 class="font-bold text-theme-primary text-sm uppercase tracking-wider">Forgotten Drafts</h3>
  </div>

  <div
    class="relative bg-gradient-to-br from-theme-surface to-accent/5 border border-theme-border rounded-2xl p-6 flex flex-col items-center justify-center min-h-[160px] overflow-hidden"
  >
    {#if loading}
      <div
        class="absolute inset-0 flex items-center justify-center bg-theme-surface/50 backdrop-blur-sm z-10"
        transition:fade
      >
        <div class="loading loading-spinner text-accent"></div>
      </div>
    {/if}

    {#if !draft && !loading}
      <div class="text-center space-y-3" transition:fade>
        <div class="p-3 bg-theme-surface rounded-full inline-flex text-theme-tertiary">
          <Dices class="w-8 h-8" />
        </div>
        <p class="text-theme-secondary text-sm">No pending drafts found. You're all caught up!</p>
        <button onclick={spin} class="text-accent text-xs font-bold hover:underline"
          >Check again</button
        >
      </div>
    {/if}

    <!-- Retain the outgoing draft while its transition and image cleanup finish. -->
    {#each draft ? [draft] : [] as candidate (candidate.id)}
      <div class="w-full flex items-center gap-6" transition:scale={{ start: 0.95, duration: 200 }}>
        <div
          class="shrink-0 relative group cursor-pointer"
          onclick={() => (showModal = true)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && (showModal = true)}
        >
          {#if candidate.coverImageName}
            <AuthenticatedImage
              src="/api/files/volume/{candidate.id}/image/{candidate.coverImageName}?w=120&q=80"
              alt={candidate.title}
              class="w-24 h-36 object-cover rounded-lg shadow-lg rotate-[-2deg] group-hover:rotate-0 transition-transform duration-300"
            />
          {:else}
            <div
              class="w-24 h-36 bg-theme-surface border-2 border-theme-border rounded-lg flex items-center justify-center text-theme-tertiary text-2xl font-bold shadow-lg rotate-[-2deg] group-hover:rotate-0 transition-transform duration-300"
            >
              {candidate.title[0]}
            </div>
          {/if}
        </div>

        <div class="flex-1 min-w-0 text-left">
          <div class="text-xs font-bold text-theme-tertiary mb-1 uppercase tracking-wide">
            {candidate.seriesTitle}
          </div>
          <h4 class="text-xl font-bold text-theme-primary truncate mb-2">{candidate.title}</h4>

          <div class="flex flex-wrap gap-2 mb-4">
            <span
              class="px-2 py-1 rounded-md bg-accent/10 text-accent text-xs font-bold border border-accent/20 flex items-center gap-1.5"
            >
              <GitPullRequest class="w-3 h-3" />
              +{candidate.versionInfo.hasAhead} Edits
            </span>
            {#if candidate.versionInfo.hasBehind > 0}
              <span
                class="px-2 py-1 rounded-md bg-status-warning/10 text-status-warning text-xs font-bold border border-status-warning/20 flex items-center gap-1.5"
              >
                <GitMerge class="w-3 h-3" />
                {candidate.versionInfo.hasBehind} Behind
              </span>
            {/if}
          </div>

          <div class="flex items-center gap-3">
            <button
              onclick={() => (showModal = true)}
              class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent-hover shadow-lg shadow-accent/20 border-2 border-transparent transition-all active:scale-95"
            >
              Submit Review
            </button>
            <button
              onclick={spin}
              class="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-base transition-colors"
              title="Skip this one"
            >
              <ArrowRight class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

{#if showModal && draft}
  <SubmitReviewModal
    volume={draft}
    on_close={() => (showModal = false)}
    onSuccess={() => {
      showModal = false;
      spin(); // Auto-load next draft on success
    }}
  />
{/if}
