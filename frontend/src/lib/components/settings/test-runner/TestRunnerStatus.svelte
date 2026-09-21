<script lang="ts">
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  let { errorMessage, lastSuccess } = $props<{
    errorMessage: string | null;
    lastSuccess: boolean | null;
  }>();
</script>

{#if errorMessage}
  <div
    class="rounded-xl border-2 border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger flex items-start gap-3"
    in:fly={{ y: -10, duration: 300, easing: quintOut }}
    out:fade={{ duration: 200 }}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="flex-shrink-0 mt-0.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    <span>{errorMessage}</span>
  </div>
{/if}

{#if lastSuccess !== null}
  <div
    class="rounded-xl border-2 px-5 py-3 text-sm font-semibold flex items-center gap-3 {lastSuccess
      ? 'border-status-success/40 bg-status-success/10 text-status-success'
      : 'border-status-danger/40 bg-status-danger/10 text-status-danger'}"
    in:scale={{ start: 0.95, duration: 400, easing: quintOut }}
    out:fade={{ duration: 200 }}
  >
    {#if lastSuccess}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span>All tests passed!</span>
    {:else}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <span>Some tests failed.</span>
    {/if}
  </div>
{/if}
