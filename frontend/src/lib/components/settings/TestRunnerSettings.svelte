<script lang="ts">
  import { apiFetch } from '$lib/services/api';
  import { SvelteSet } from 'svelte/reactivity';
  import type { TestResult } from './test-runner/types';
  import TestRunnerHeader from './test-runner/TestRunnerHeader.svelte';
  import TestRunnerActions from './test-runner/TestRunnerActions.svelte';
  import TestRunnerStatus from './test-runner/TestRunnerStatus.svelte';
  import TestRunnerResults from './test-runner/TestRunnerResults.svelte';

  let isRunning = $state(false);
  let lastResults = $state<TestResult[]>([]);
  let lastSuccess = $state<boolean | null>(null);
  let errorMessage = $state<string | null>(null);
  let expandedResults = $state(new SvelteSet<string>());
  let expandedSuites = $state(new SvelteSet<string>());
  let showRawOutput = $state(new SvelteSet<string>());

  const runTests = async (target: 'backend' | 'frontend' | 'all') => {
    if (isRunning) return;
    isRunning = true;
    errorMessage = null;
    lastSuccess = null;
    lastResults = [];
    expandedResults = new SvelteSet();
    expandedSuites = new SvelteSet();
    showRawOutput = new SvelteSet();

    try {
      const response = await apiFetch('/api/tests/run', {
        method: 'POST',
        body: { target }
      });
      lastResults = response.results || [];
      lastSuccess = Boolean(response.success);
    } catch (error) {
      errorMessage = (error as Error).message;
    } finally {
      isRunning = false;
    }
  };

  const toggleExpanded = (target: string) => {
    const next = new SvelteSet(expandedResults);
    if (next.has(target)) {
      next.delete(target);
    } else {
      next.add(target);
    }
    expandedResults = next;
  };

  const toggleSuite = (suiteKey: string) => {
    const next = new SvelteSet(expandedSuites);
    if (next.has(suiteKey)) {
      next.delete(suiteKey);
    } else {
      next.add(suiteKey);
    }
    expandedSuites = next;
  };

  const toggleRawOutput = (target: string) => {
    const next = new SvelteSet(showRawOutput);
    if (next.has(target)) {
      next.delete(target);
    } else {
      next.add(target);
    }
    showRawOutput = next;
  };

  const copyOutput = async (output: string) => {
    try {
      await navigator.clipboard.writeText(output);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
</script>

<div class="w-full max-w-4xl">
  <TestRunnerHeader />

  <div class="rounded-2xl bg-theme-main border border-theme-border-light p-6 space-y-6">
    <TestRunnerActions {isRunning} onRun={runTests} />
    <TestRunnerStatus {errorMessage} {lastSuccess} />
    <TestRunnerResults
      results={lastResults}
      {expandedResults}
      {expandedSuites}
      {showRawOutput}
      onToggleExpanded={toggleExpanded}
      onToggleSuite={toggleSuite}
      onToggleRawOutput={toggleRawOutput}
      onCopyOutput={copyOutput}
    />
  </div>
</div>
