<script lang="ts">
  let { message } = $props<{ message: string }>();
</script>

<div class="rounded-xl bg-theme-main border border-theme-border p-12 text-center">
  <div class="text-4xl mb-2">❌</div>
  <div class="text-sm text-status-danger">{message}</div>
</div>
