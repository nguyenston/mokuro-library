<script lang="ts">
  import PaginationControls from '$lib/components/controls/PaginationControls.svelte';

  let { meta } = $props<{
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>();
</script>

<div class="fixed bottom-0 left-0 right-0 p-6 z-40 pointer-events-none">
  <div class="mx-auto flex justify-center pointer-events-auto" style="max-width: 1400px;">
    <PaginationControls {meta} />
  </div>
</div>
