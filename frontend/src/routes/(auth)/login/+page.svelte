<script lang="ts">
  import AuthView from '$lib/components/auth/AuthView.svelte';
  import backgroundImage from '$lib/assets/auth/background.png';
</script>

<AuthView {backgroundImage} registerMode="show-success" redirectOnAuth={true} />
