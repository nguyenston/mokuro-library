<script lang="ts">
  import type { RebaseConflict, RebaseResolution } from '../../lib/types';
  import { getAvailableResolutions, getConflictTypeLabel } from '../../lib/utils';

  let { isOpen, rebaseModal, onAbort, onResolve } = $props<{
    isOpen: boolean;
    rebaseModal: {
      volumeId: string | null;
      volumeTitle: string | null;
      seriesTitle: string | null;
      conflicts: RebaseConflict[];
      currentConflictIndex: number;
    };
    onAbort: () => void;
    onResolve: (resolution: RebaseResolution) => void;
  }>();
</script>

{#if isOpen}
  {@const currentConflict = rebaseModal.conflicts[rebaseModal.currentConflictIndex]}
  {@const availableResolutions = getAvailableResolutions(currentConflict.type)}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
    onclick={onAbort}
    onkeydown={(e) => e.key === 'Escape' && onAbort()}
    role="button"
    tabindex="0"
  >
    <div
      class="bg-theme-main border border-accent/50 sm:border-2 rounded-xl sm:rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <!-- Header -->
      <div
        class="bg-gradient-to-r from-accent/20 to-accent/10 p-3 sm:p-6 border-b border-accent/30 flex-shrink-0"
      >
        <div class="flex items-start justify-between gap-2 sm:gap-4">
          <div class="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div class="text-xl sm:text-3xl flex-shrink-0">🔄</div>
            <div class="flex-1 min-w-0">
              <h2 class="text-base sm:text-xl font-extrabold text-theme-primary mb-0.5 sm:mb-1">
                Rebase Conflict
              </h2>
              <p class="text-xs sm:text-sm text-theme-secondary truncate">
                {rebaseModal.seriesTitle} - {rebaseModal.volumeTitle}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span
              class="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-accent/20 text-accent text-[10px] sm:text-xs font-bold border border-accent/30"
            >
              {rebaseModal.currentConflictIndex + 1} / {rebaseModal.conflicts.length}
            </span>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
        <!-- Conflict Type Badge & Location -->
        <div class="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          <span
            class="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-status-warning/20 text-status-warning text-[10px] sm:text-sm font-bold border border-status-warning/30"
          >
            {getConflictTypeLabel(currentConflict.type)}
          </span>
          <span class="text-[10px] sm:text-xs text-theme-tertiary font-semibold">
            Page {currentConflict.context.pageNumber} · Block {currentConflict.context.blockIndex}
            {#if currentConflict.context.lineIndex !== undefined}
              · Line {currentConflict.context.lineIndex}
            {/if}
          </span>
        </div>

        <!-- Compact Explanation -->
        <div class="bg-status-warning/10 border border-status-warning/30 rounded-lg p-2 sm:p-3">
          <div class="text-[10px] sm:text-xs text-theme-secondary leading-snug sm:leading-relaxed">
            {#if currentConflict.type === 'content_conflict'}
              Both you and the admin edited the same text. Choose which version to keep.
            {:else if currentConflict.type === 'dead_zone'}
              The admin deleted this block, but you had edited it. You can skip your changes or
              resurrect the block with your edits.
            {:else if currentConflict.type === 'double_delete'}
              Both you and the admin deleted this item. Your deletion will be skipped as it's
              redundant.
            {:else if currentConflict.type === 'reorder_length_change'}
              The admin added or removed items from an array you reordered. Your reorder will be
              skipped.
            {:else if currentConflict.type === 'competing_reorder'}
              Both you and the admin reordered the same items. Choose which order to keep.
            {:else}
              A conflict occurred that needs your attention.
            {/if}
          </div>
        </div>

        <!-- Visual Comparison -->
        <div class="grid grid-cols-2 gap-2 sm:gap-3">
          <!-- Admin Version -->
          <div
            class="bg-theme-surface/30 border border-accent/30 sm:border-2 rounded-lg sm:rounded-xl overflow-hidden"
          >
            <div class="bg-accent/20 px-2 py-1.5 sm:px-3 sm:py-2 border-b border-accent/30">
              <span class="text-[10px] sm:text-xs font-bold text-accent">✓ Official</span>
            </div>
            <div class="p-2 sm:p-3 space-y-2">
              <!-- Readable Image -->
              <div
                class="bg-theme-main border border-theme-border rounded-md overflow-hidden w-full h-32 sm:h-40 md:h-48 lg:h-56 flex items-center justify-center flex-shrink-0"
              >
                <div class="text-center text-theme-tertiary">
                  <div class="text-3xl sm:text-4xl md:text-5xl mb-2">📄</div>
                  <div class="text-xs sm:text-sm">Panel</div>
                </div>
              </div>
              <!-- Text -->
              <div class="bg-theme-main border border-theme-border rounded-md p-2 sm:p-3">
                <div class="text-[9px] sm:text-xs text-theme-tertiary mb-1 sm:mb-1.5 font-semibold">
                  Text:
                </div>
                {#if currentConflict.adminValue !== null}
                  <div
                    class="text-xs sm:text-base md:text-sm text-theme-primary font-medium leading-snug sm:leading-relaxed break-words max-h-24 sm:max-h-32 md:max-h-40 overflow-y-auto"
                  >
                    {currentConflict.adminValue}
                  </div>
                {:else}
                  <div class="text-[10px] sm:text-sm text-status-danger italic">[Deleted]</div>
                {/if}
              </div>
            </div>
          </div>

          <!-- User Version -->
          <div
            class="bg-theme-surface/30 border border-theme-primary/30 sm:border-2 rounded-lg sm:rounded-xl overflow-hidden"
          >
            <div
              class="bg-theme-primary/20 px-2 py-1.5 sm:px-3 sm:py-2 border-b border-theme-primary/30"
            >
              <span class="text-[10px] sm:text-xs font-bold text-theme-primary">✏️ Your Edit</span>
            </div>
            <div class="p-2 sm:p-3 space-y-2">
              <!-- Readable Image -->
              <div
                class="bg-theme-main border border-theme-border rounded-md overflow-hidden w-full h-32 sm:h-40 md:h-48 lg:h-56 flex items-center justify-center flex-shrink-0"
              >
                <div class="text-center text-theme-tertiary">
                  <div class="text-3xl sm:text-4xl md:text-5xl mb-2">📄</div>
                  <div class="text-xs sm:text-sm">Panel</div>
                </div>
              </div>
              <!-- Text -->
              <div class="bg-theme-main border border-theme-border rounded-md p-2 sm:p-3">
                <div class="text-[9px] sm:text-xs text-theme-tertiary mb-1 sm:mb-1.5 font-semibold">
                  Text:
                </div>
                <div
                  class="text-xs sm:text-base md:text-sm text-theme-primary font-medium leading-snug sm:leading-relaxed break-words max-h-24 sm:max-h-32 md:max-h-40 overflow-y-auto"
                >
                  {currentConflict.userValue}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Compact Resolution Options -->
        <div class="space-y-2">
          <div class="text-xs font-bold text-theme-tertiary uppercase tracking-wide">
            Choose Resolution:
          </div>
          <div class="grid grid-cols-1 gap-2">
            {#each availableResolutions as resolution (resolution)}
              <button
                onclick={() => onResolve(resolution)}
                class="p-3 rounded-lg border-2 transition-all text-left {resolution === 'keep_admin'
                  ? 'bg-accent/10 border-accent/30 hover:bg-accent/20 hover:border-accent'
                  : resolution === 'keep_mine'
                    ? 'bg-theme-primary/10 border-theme-primary/30 hover:bg-theme-primary/20 hover:border-theme-primary'
                    : resolution === 'resurrect'
                      ? 'bg-status-success/10 border-status-success/30 hover:bg-status-success/20 hover:border-status-success'
                      : 'bg-theme-surface/60 border-theme-border hover:bg-theme-surface-hover'}"
              >
                <div class="flex items-center gap-3">
                  <div class="text-xl flex-shrink-0">
                    {#if resolution === 'keep_admin'}
                      ✓
                    {:else if resolution === 'keep_mine'}
                      ✏️
                    {:else if resolution === 'resurrect'}
                      ♻️
                    {:else}
                      ⏭️
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div
                      class="font-bold text-sm {resolution === 'keep_admin'
                        ? 'text-accent'
                        : resolution === 'keep_mine'
                          ? 'text-theme-primary'
                          : resolution === 'resurrect'
                            ? 'text-status-success'
                            : 'text-theme-secondary'}"
                    >
                      {#if resolution === 'keep_admin'}
                        Keep Official
                      {:else if resolution === 'keep_mine'}
                        Keep Mine
                      {:else if resolution === 'resurrect'}
                        Resurrect Block
                      {:else}
                        Skip
                      {/if}
                    </div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="p-3 sm:p-6 bg-theme-surface/30 border-t border-theme-border flex gap-2 sm:gap-3 flex-shrink-0 items-center"
      >
        <button
          onclick={onAbort}
          class="px-3 py-1.5 sm:px-6 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm bg-theme-surface text-theme-primary hover:bg-theme-surface-hover border sm:border-2 border-theme-border transition-all"
        >
          Abort
        </button>
        <div class="flex-1"></div>
        <div class="text-[10px] sm:text-xs text-theme-tertiary flex items-center">
          <span class="hidden sm:inline">Resolve conflicts to complete rebase</span>
          <span class="sm:hidden">Resolve to complete</span>
        </div>
      </div>
    </div>
  </div>
{/if}
