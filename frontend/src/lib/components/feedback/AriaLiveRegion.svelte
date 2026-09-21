<script lang="ts">
  let {
    message = $bindable(''),
    politeness = 'polite'
  }: {
    message?: string;
    politeness?: 'polite' | 'assertive';
  } = $props();
</script>

<!-- Screen reader only announcement region -->
<div class="sr-only" role="status" aria-live={politeness} aria-atomic="true">
  {message}
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
