<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/services/api';
  import { Hourglass, Check, X, Calendar, Clock } from 'lucide-svelte';

  type Stats = {
    pending: number;
    accepted: number;
    rejected: number;
    last7Days: number;
    averageReviewTime: number; // in hours
  };

  let stats = $state<Stats | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      loading = true;
      const data = (await apiFetch('/api/contributions/stats')) as Stats;
      stats = data;
    } catch (e) {
      error = (e as Error).message || 'Failed to load statistics.';
    } finally {
      loading = false;
    }
  });

  const statCards = $derived.by(() => {
    if (!stats) return [];
    return [
      { title: 'Pending', value: stats.pending, icon: Hourglass, color: 'text-yellow-400' },
      { title: 'Accepted', value: stats.accepted, icon: Check, color: 'text-green-400' },
      { title: 'Rejected', value: stats.rejected, icon: X, color: 'text-red-400' },
      { title: 'Last 7 Days', value: stats.last7Days, icon: Calendar, color: 'text-blue-400' },
      {
        title: 'Avg Review Time',
        value: `${stats.averageReviewTime}h`,
        icon: Clock,
        color: 'text-purple-400'
      }
    ];
  });
</script>

<div class="mb-6">
  <h3 class="text-lg font-bold mb-2">Submission Statistics</h3>
  {#if loading}
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
      {#each [0, 1, 2, 3, 4] as i (i)}
        <div class="bg-white/5 border border-white/10 rounded-lg p-4 h-24">
          <div class="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
          <div class="h-8 bg-white/10 rounded w-1/2"></div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="text-sm p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
      <strong>Error:</strong>
      {error}
    </div>
  {:else if stats}
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      {#each statCards as card (card.title)}
        {@const Icon = card.icon}
        <div class="bg-white/5 border border-white/10 rounded-lg p-4">
          <div class="flex items-center gap-2">
            <Icon class="w-4 h-4 {card.color}" />
            <span class="text-sm font-semibold text-white/60">{card.title}</span>
          </div>
          <p class="text-2xl font-bold mt-2">{card.value}</p>
        </div>
      {/each}
    </div>
  {/if}
</div>
