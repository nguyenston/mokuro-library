<script lang="ts">
  import AuthView from '$lib/components/auth/AuthView.svelte';
  import backgroundImage from '$lib/assets/auth/background.png';
</script>

<svelte:head>
  <link rel="preload" href="/login" as="fetch" crossorigin="anonymous" />
</svelte:head>

<AuthView
  {backgroundImage}
  initialMode="register"
  registerMode="show-success"
  registerRedirectTo="/login"
  registerSuccessMessage="Account created! Redirecting to login..."
  registerToggleHref="/login"
  redirectOnAuth={true}
/>
