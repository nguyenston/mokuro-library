<script lang="ts">
  import type { VolumeContribution } from '../../lib/types';

  let { isOpen, volume, onClose, onStartRebase } = $props<{
    isOpen: boolean;
    volume: VolumeContribution | null;
    onClose: () => void;
    onStartRebase: () => void;
  }>();
</script>

{#if isOpen && volume}
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="0"
  >
    <div
      class="bg-theme-main rounded-2xl border-2 border-theme-primary/30 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <!-- Header -->
      <div
        class="bg-gradient-to-r from-theme-primary/20 to-theme-primary/10 p-6 border-b border-theme-primary/30 flex-shrink-0"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <div class="text-3xl flex-shrink-0">👁️</div>
            <div class="flex-1 min-w-0">
              <h2 class="text-xl font-extrabold text-theme-primary mb-1">OCR Diff Viewer</h2>
              <p class="text-sm text-theme-secondary truncate">
                {volume.title || 'Volume'} — Compare Your Version vs Official
              </p>
            </div>
          </div>
          <button
            onclick={onClose}
            class="p-2 rounded-lg hover:bg-theme-surface transition-colors text-theme-secondary hover:text-theme-primary"
            aria-label="Close diff viewer"
          >
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
              ><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
            >
          </button>
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="p-4 bg-theme-surface/30 border-b border-theme-border flex gap-4 flex-shrink-0">
        <div class="flex items-center gap-2 text-xs">
          <span class="font-bold text-theme-secondary">Your Edits:</span>
          <span class="px-2 py-1 rounded-lg bg-accent/20 text-accent font-bold"
            >{volume.userPatchCount}</span
          >
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="font-bold text-theme-secondary">Behind By:</span>
          <span class="px-2 py-1 rounded-lg bg-status-warning/20 text-status-warning font-bold"
            >{volume.behindByCount}</span
          >
        </div>
        <div class="flex items-center gap-2 text-xs ml-auto">
          <span class="font-bold text-emerald-400">Sample Data</span>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <div class="text-xs text-theme-secondary mb-4">
          Note: This is a preview of the diff viewer. In the real implementation, this would show
          actual OCR blocks side-by-side with highlighted differences.
        </div>

        <!-- Sample Diff Blocks -->
        {#each [0, 1, 2] as blockIdx (blockIdx)}
          <div class="rounded-lg border border-theme-border sm:border-2 overflow-hidden">
            <div class="bg-theme-surface p-1.5 sm:p-2 border-b border-theme-border">
              <span class="text-[10px] sm:text-xs font-bold text-theme-secondary"
                >Block {blockIdx + 1}</span
              >
            </div>
            <div class="grid grid-cols-2 divide-x divide-theme-border">
              <!-- Admin Version -->
              <div class="p-2 sm:p-4 bg-theme-main">
                <div class="text-[9px] sm:text-xs font-bold text-accent mb-1.5 sm:mb-2">
                  Official
                </div>
                <div
                  class="text-[10px] sm:text-sm text-theme-primary font-mono leading-snug sm:leading-relaxed"
                >
                  これは公式バージョンのテキストです。
                  {#if blockIdx === 1}
                    <span class="bg-red-500/20 text-red-400">古いテキスト</span>
                  {/if}
                </div>
              </div>

              <!-- User Version -->
              <div class="p-2 sm:p-4 bg-theme-main">
                <div class="text-[9px] sm:text-xs font-bold text-theme-primary mb-1.5 sm:mb-2">
                  Your Edit
                </div>
                <div
                  class="text-[10px] sm:text-sm text-theme-primary font-mono leading-snug sm:leading-relaxed"
                >
                  これは公式バージョンのテキストです。
                  {#if blockIdx === 1}
                    <span class="bg-green-500/20 text-green-400">新しいテキスト</span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Footer -->
      <div
        class="p-4 bg-theme-surface/30 border-t border-theme-border flex gap-2 justify-end flex-shrink-0"
      >
        <button
          onclick={onClose}
          class="px-4 py-2 rounded-lg bg-theme-border text-theme-secondary hover:bg-theme-border/80 transition-all text-sm font-bold"
        >
          Close
        </button>
        <button
          onclick={onStartRebase}
          class="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-all text-sm font-bold"
        >
          Start Rebase
        </button>
      </div>
    </div>
  </div>
{/if}
