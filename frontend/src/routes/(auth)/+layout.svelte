<script lang="ts">
  import { user } from '$lib/stores/authStore';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  let { children } = $props();

  // This effect will run when the component mounts
  // and re-run whenever the $user store changes.
  $effect(() => {
    // The root layout's checkAuth()
    // is populating the $user store.
    if ($user) {
      // If $user is not null, the user is logged in.
      // Redirect them away from the auth pages to the homepage.
      goto(resolve('/', {}));
    }
  });
</script>

<div class="flex min-h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
  <div class="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
    {@render children()}
  </div>
</div>
