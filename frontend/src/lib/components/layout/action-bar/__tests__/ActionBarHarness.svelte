<script lang="ts">
  import LibraryActionBar from '../LibraryActionBar.svelte';
  import VolumeActions from '../LibraryActionBarVolumeActions.svelte';
  import type { SelectionState } from '$lib/states/selection/SelectionState.svelte';
  import type { Volume } from '$lib/types';

  let {
    selectionState,
    onRefresh
  }: {
    selectionState: SelectionState<Volume>;
    onRefresh: () => void;
  } = $props();
</script>

<LibraryActionBar {selectionState}>
  {#snippet children(selection)}
    <VolumeActions selectionState={selection} {onRefresh} seriesOwnerId="admin" />
  {/snippet}
</LibraryActionBar>
