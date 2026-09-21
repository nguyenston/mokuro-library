<script lang="ts">
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';
  import { fly } from 'svelte/transition';

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const colorMap = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
  {#each toastStore.toasts as toast (toast.id)}
    <div
      class="pointer-events-auto flex items-center gap-3 rounded-lg shadow-lg px-4 py-3 text-white min-w-[300px] max-w-[500px] {colorMap[
        toast.type
      ]}"
      transition:fly={{ y: 50, duration: 300 }}
    >
      <span class="text-xl">{iconMap[toast.type]}</span>
      <p class="flex-1 text-sm">{toast.message}</p>
      <button class="text-white/80 hover:text-white" onclick={() => toastStore.dismiss(toast.id)}>
        ✕
      </button>
    </div>
  {/each}
</div>
