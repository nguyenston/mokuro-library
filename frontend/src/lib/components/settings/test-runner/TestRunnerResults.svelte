<script lang="ts">
  import type { TestResult } from './types';
  import TestRunnerResultCard from './TestRunnerResultCard.svelte';

  let {
    results,
    expandedResults,
    expandedSuites,
    showRawOutput,
    onToggleExpanded,
    onToggleSuite,
    onToggleRawOutput,
    onCopyOutput
  } = $props<{
    results: TestResult[];
    expandedResults: Set<string>;
    expandedSuites: Set<string>;
    showRawOutput: Set<string>;
    onToggleExpanded: (target: string) => void;
    onToggleSuite: (suiteKey: string) => void;
    onToggleRawOutput: (target: string) => void;
    onCopyOutput: (output: string) => void;
  }>();
</script>

{#if results.length > 0}
  <div class="space-y-4">
    {#each results as result, index (result.target)}
      <TestRunnerResultCard
        {result}
        {index}
        isExpanded={expandedResults.has(result.target)}
        showRaw={showRawOutput.has(result.target)}
        {expandedSuites}
        {onToggleExpanded}
        {onToggleSuite}
        {onToggleRawOutput}
        {onCopyOutput}
      />
    {/each}
  </div>
{/if}
