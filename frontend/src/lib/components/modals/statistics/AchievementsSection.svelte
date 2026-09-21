<script lang="ts">
  import type { Achievement } from './types';

  let { achievements } = $props<{ achievements: Achievement[] }>();
</script>

<div class="mb-6">
  <div class="flex items-center gap-2 mb-4">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-status-warning"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
    <h3 class="text-xl font-bold theme-primary">Achievements</h3>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    {#each achievements as achievement, i (achievement.id ?? i)}
      <div
        class="rounded-2xl bg-theme-main p-4 border border-theme-border-light flex items-center gap-4 {achievement.unlocked
          ? ''
          : 'opacity-50'}"
      >
        <div class="flex-shrink-0">
          {#if achievement.icon === 'trophy'}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class={achievement.color}
            >
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          {:else if achievement.icon === 'ribbon'}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class={achievement.color}
            >
              <path
                d="M17.75 9.01l4.5-2.5a1 1 0 0 0 0-1.78l-4.5-2.5a1 1 0 0 0-.75 0l-4.5 2.5a1 1 0 0 0 0 1.78l4.5 2.5a1 1 0 0 0 .75 0z"
              />
              <path d="M17 22V11a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v11" />
              <path d="M7 10v12" />
              <path d="M12 15v7" />
              <path d="M17 10v12" />
            </svg>
          {/if}
        </div>
        <div>
          <p class="font-bold theme-primary">{achievement.title}</p>
          <p class="text-sm text-gray-400">{achievement.description}</p>
        </div>
      </div>
    {/each}
  </div>
  <button class="text-sm text-theme-secondary hover:theme-primary transition-colors">
    Show All Achievements
  </button>
</div>
