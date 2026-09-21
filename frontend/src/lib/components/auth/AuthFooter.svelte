<script lang="ts">
  import { resolve } from '$app/paths';

  let { isRegisterMode, registerToggleHref, onToggleMode } = $props<{
    isRegisterMode: boolean;
    registerToggleHref?: string;
    onToggleMode: () => void;
  }>();
</script>

<div class="px-8 pb-8 pt-6 text-center border-t-2 border-theme-border-light/20">
  <p class="text-base text-theme-secondary">
    {isRegisterMode ? 'Already have an account?' : 'New to Mokuro Library?'}
    {#if isRegisterMode && registerToggleHref}
      <a
        href={resolve(registerToggleHref ?? '/login')}
        data-sveltekit-preload-data="tap"
        class="font-bold text-accent hover:text-accent-hover transition-all ml-2 inline-flex items-center gap-1 hover:gap-2 group"
      >
        Sign in
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transform group-hover:translate-x-0.5 transition-transform"
        >
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </a>
    {:else}
      <button
        type="button"
        onclick={onToggleMode}
        class="font-bold text-accent hover:text-accent-hover transition-all ml-2 inline-flex items-center gap-1 hover:gap-2 group"
      >
        {isRegisterMode ? 'Sign in' : 'Create an account'}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transform group-hover:translate-x-0.5 transition-transform"
        >
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
    {/if}
  </p>
</div>
