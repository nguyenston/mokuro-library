<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  let { isRunning, onRun } = $props<{
    isRunning: boolean;
    onRun: (target: 'backend' | 'frontend' | 'all') => void;
  }>();
</script>

<div class="flex flex-wrap items-center gap-3">
  <button
    onclick={() => onRun('backend')}
    disabled={isRunning}
    class="group relative px-5 py-2.5 rounded-xl text-sm font-semibold bg-theme-surface hover:bg-theme-surface-hover text-theme-primary border-2 border-theme-border-light hover:border-accent/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
  >
    <span class="relative z-10 flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 17l6-6-6-6M12 19h8" />
      </svg>
      Backend
    </span>
    <div
      class="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/10 to-accent/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
    ></div>
  </button>
  <button
    onclick={() => onRun('frontend')}
    disabled={isRunning}
    class="group relative px-5 py-2.5 rounded-xl text-sm font-semibold bg-theme-surface hover:bg-theme-surface-hover text-theme-primary border-2 border-theme-border-light hover:border-accent/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
  >
    <span class="relative z-10 flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
      Frontend
    </span>
    <div
      class="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/10 to-accent/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
    ></div>
  </button>
  <button
    onclick={() => onRun('all')}
    disabled={isRunning}
    class="group relative px-6 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 border-2 border-accent hover:border-accent/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 overflow-hidden"
  >
    <span class="relative z-10 flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="group-hover:rotate-12 transition-transform duration-300"
      >
        <path d="M5 12l5 5L20 7" />
      </svg>
      Run All Tests
    </span>
    <div
      class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
    ></div>
  </button>
  {#if isRunning}
    <div
      class="flex items-center gap-2 text-accent font-medium"
      in:fly={{ x: -10, duration: 300, easing: quintOut }}
      out:fade={{ duration: 200 }}
    >
      <svg
        class="animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span class="text-sm">Running tests...</span>
    </div>
  {/if}
</div>

<style>
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
