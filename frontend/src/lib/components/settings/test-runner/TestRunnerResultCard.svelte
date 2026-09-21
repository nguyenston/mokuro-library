<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { TestResult } from './types';

  let {
    result,
    index,
    isExpanded,
    showRaw,
    expandedSuites,
    onToggleExpanded,
    onToggleSuite,
    onToggleRawOutput,
    onCopyOutput
  } = $props<{
    result: TestResult;
    index: number;
    isExpanded: boolean;
    showRaw: boolean;
    expandedSuites: Set<string>;
    onToggleExpanded: (target: string) => void;
    onToggleSuite: (suiteKey: string) => void;
    onToggleRawOutput: (target: string) => void;
    onCopyOutput: (output: string) => void;
  }>();

  let isPassed = $derived(result.code === 0);
</script>

<div
  class="group rounded-xl border-2 border-theme-border-light bg-theme-surface/60 hover:bg-theme-surface transition-all duration-300 overflow-hidden {isPassed
    ? 'hover:border-status-success/30'
    : 'hover:border-status-danger/30'}"
  in:fly={{ y: 20, duration: 300, delay: index * 100, easing: quintOut }}
>
  <button
    onclick={() => onToggleExpanded(result.target)}
    class="w-full px-5 py-4 flex items-center justify-between text-left transition-colors duration-200"
  >
    <div class="flex items-center gap-4 flex-1">
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 {isPassed
          ? 'bg-status-success/10 text-status-success group-hover:bg-status-success/20'
          : 'bg-status-danger/10 text-status-danger group-hover:bg-status-danger/20'}"
      >
        {#if isPassed}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        {/if}
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-3 flex-wrap">
          <h3 class="text-base font-bold text-theme-primary">
            {result.target.toUpperCase()}
          </h3>
          <span
            class="px-2 py-0.5 rounded-full text-xs font-semibold {isPassed
              ? 'bg-status-success/20 text-status-success'
              : 'bg-status-danger/20 text-status-danger'}"
          >
            {isPassed ? 'PASS' : 'FAIL'}
          </span>
          {#if result.summary}
            <div class="flex items-center gap-2 text-xs font-medium">
              <span class="text-status-success">{result.summary.passed} passed</span>
              {#if result.summary.failed > 0}
                <span class="text-status-danger">{result.summary.failed} failed</span>
              {/if}
              {#if result.summary.skipped > 0}
                <span class="text-theme-tertiary">{result.summary.skipped} skipped</span>
              {/if}
            </div>
          {/if}
        </div>
        <div class="flex items-center gap-4 mt-1 text-xs text-theme-tertiary font-medium">
          <span class="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {(result.durationMs / 1000).toFixed(1)}s
          </span>
          <span>Exit code: {result.code}</span>
          {#if result.suites}
            <span>{result.suites.length} test files</span>
          {/if}
        </div>
      </div>
    </div>
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
      class="text-theme-tertiary transition-transform duration-300 {isExpanded ? 'rotate-180' : ''}"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>

  {#if isExpanded}
    <div
      class="border-t border-theme-border-light bg-theme-main/50"
      in:fly={{ y: -10, duration: 300, easing: quintOut }}
      out:fade={{ duration: 200 }}
    >
      {#if result.suites && result.suites.length > 0}
        <div class="p-5 space-y-3">
          {#each result.suites as suite, suiteIdx (suite.name ?? suiteIdx)}
            {@const suiteKey = `${result.target}-${suiteIdx}`}
            {@const isSuiteExpanded = expandedSuites.has(suiteKey)}
            {@const suitePassed = suite.failed === 0}
            <div
              class="rounded-lg border border-theme-border-light bg-theme-surface/40 overflow-hidden"
              in:fly={{ y: 10, duration: 200, delay: suiteIdx * 50, easing: quintOut }}
            >
              <button
                onclick={() => onToggleSuite(suiteKey)}
                class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-theme-surface transition-colors"
              >
                <div class="flex items-center gap-3 flex-1">
                  <div
                    class="w-8 h-8 rounded flex items-center justify-center {suitePassed
                      ? 'bg-status-success/10 text-status-success'
                      : 'bg-status-danger/10 text-status-danger'}"
                  >
                    {#if suitePassed}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    {:else}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    {/if}
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-semibold text-theme-primary font-mono">
                      {suite.name}
                    </div>
                    <div class="flex items-center gap-3 mt-0.5 text-xs font-medium">
                      <span class="text-status-success">{suite.passed}/{suite.total}</span>
                      {#if suite.failed > 0}
                        <span class="text-status-danger">{suite.failed} failed</span>
                      {/if}
                      {#if suite.skipped > 0}
                        <span class="text-theme-tertiary">{suite.skipped} skipped</span>
                      {/if}
                    </div>
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-theme-tertiary transition-transform duration-300 {isSuiteExpanded
                    ? 'rotate-180'
                    : ''}"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {#if isSuiteExpanded && suite.tests.length > 0}
                <div
                  class="border-t border-theme-border-light px-4 py-3 space-y-2"
                  in:fly={{ y: -5, duration: 200, easing: quintOut }}
                >
                  {#each suite.tests as test, testIdx (test.name ?? testIdx)}
                    <div
                      class="flex items-center justify-between py-2 px-3 rounded bg-theme-main/50"
                      in:fly={{ x: -5, duration: 150, delay: testIdx * 30, easing: quintOut }}
                    >
                      <div class="flex items-center gap-2 flex-1">
                        {#if test.status === 'pass'}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="text-status-success flex-shrink-0"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        {:else if test.status === 'fail'}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="text-status-danger flex-shrink-0"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        {:else}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="text-theme-tertiary flex-shrink-0"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                          </svg>
                        {/if}
                        <span class="text-xs text-theme-primary font-medium">{test.name}</span>
                      </div>
                      {#if test.duration}
                        <span class="text-xs text-theme-tertiary">{test.duration}ms</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="px-5 py-4 border-t border-theme-border-light space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 text-xs font-bold text-theme-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-accent"
            >
              <path d="M4 17l6-6-6-6M12 19h8" />
            </svg>
            Test Output
          </div>
          <div class="flex items-center gap-2">
            {#if result.suites && result.suites.length > 0}
              <button
                onclick={() => onToggleRawOutput(result.target)}
                class="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all {showRaw
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-theme-border-light text-theme-secondary hover:text-theme-primary hover:border-accent/50'}"
              >
                {showRaw ? 'Show Structured' : 'Show Raw'}
              </button>
            {/if}
            <button
              onclick={() => onCopyOutput(result.output)}
              class="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-theme-border-light text-theme-secondary hover:text-theme-primary hover:border-accent/50 transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy Output
            </button>
          </div>
        </div>
        <pre
          class="max-h-96 overflow-auto rounded-lg bg-theme-main border border-theme-border px-4 py-3 text-xs text-theme-secondary whitespace-pre-wrap font-mono leading-relaxed">{result.output ||
            'No output.'}</pre>
      </div>
    </div>
  {/if}
</div>
