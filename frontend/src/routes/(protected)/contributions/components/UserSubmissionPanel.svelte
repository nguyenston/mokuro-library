<script lang="ts">
  import type { Series } from '$lib/types';
  import { apiFetch } from '$lib/services/api';
  import { toastStore } from '$lib/stores/toastStore.svelte.ts';
  import { contributionsSummaryState } from '$lib/states/contributions/ContributionsSummaryState.svelte';
  import { onMount } from 'svelte';
  import AuthenticatedImage from '$lib/components/common/AuthenticatedImage.svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  let loading = $state(false);
  let submitting = $state(false);
  let allUserSeries = $state<Series[]>([]);
  let adminSeries = $state<Series[]>([]);

  // Expandable state per series
  let expandedSeriesIds = new SvelteSet<string>();

  // Selected volumes per series
  let selectedVolumeIdsBySeriesId = new SvelteMap<string, Set<string>>();

  // Merge decisions per series: null = create new, string = merge into that admin series ID
  let mergeDecisions = new SvelteMap<string, string | null>();

  // Fuzzy match detection
  function fuzzyMatchSeries(userTitle: string, adminTitle: string): boolean {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const u = normalize(userTitle);
    const a = normalize(adminTitle);

    // Must be at least 3 characters to match
    if (u.length < 3 || a.length < 3) return false;

    // Exact match
    if (u === a) return true;

    // Substring match only if one is significantly contained in the other
    // and the shorter string is at least 60% of the longer
    const longer = u.length > a.length ? u : a;
    const shorter = u.length > a.length ? a : u;

    if (longer.includes(shorter)) {
      const ratio = shorter.length / longer.length;
      return ratio >= 0.6; // At least 60% match
    }
  }

  function findMatchingAdminSeries(userS: Series): Series | null {
    if (!userS.title) return null;

    return (
      adminSeries.find((adminS) => {
        if (!adminS.title) return false;

        if (fuzzyMatchSeries(userS.title!, adminS.title)) return true;

        const userTitles = [
          userS.title,
          userS.romajiTitle,
          userS.japaneseTitle,
          ...(userS.synonyms?.split(',').map((s: string) => s.trim()) || [])
        ].filter(Boolean);

        const adminTitles = [
          adminS.title,
          adminS.romajiTitle,
          adminS.japaneseTitle,
          ...(adminS.synonyms?.split(',').map((s: string) => s.trim()) || [])
        ].filter(Boolean);

        return userTitles.some((ut) => adminTitles.some((at) => fuzzyMatchSeries(ut!, at!)));
      }) || null
    );
  }

  // Check volume conflicts
  function getVolumeConflicts(userVolumes: Series['volumes'], adminS: Series | null): Set<string> {
    const conflicts = new SvelteSet<string>();
    if (!adminS || !adminS.volumes || !userVolumes) return conflicts;

    userVolumes.forEach((userVol) => {
      const userTitle = (userVol.title || userVol.folderName || '').toLowerCase().trim();
      if (!userTitle) return; // Skip if no title or folderName

      const hasConflict = adminS.volumes!.some((adminVol) => {
        const adminTitle = (adminVol.title || adminVol.folderName || '').toLowerCase().trim();
        if (!adminTitle) return false; // Skip if no title or folderName
        return userTitle === adminTitle;
      });
      if (hasConflict) conflicts.add(userVol.id);
    });

    return conflicts;
  }

  // Suggested matches with conflict detection
  let suggestedMatches = $derived.by(() => {
    const matches = new SvelteMap<
      string,
      { adminSeries: Series; conflictVolumeIds: Set<string> }
    >();

    allUserSeries.forEach((userS) => {
      const matchedAdmin = findMatchingAdminSeries(userS);
      if (matchedAdmin) {
        const conflictVolumeIds = getVolumeConflicts(userS.volumes, matchedAdmin);
        matches.set(userS.id, { adminSeries: matchedAdmin, conflictVolumeIds });
      }
    });

    return matches;
  });

  // Load data
  async function loadSeriesData() {
    loading = true;
    try {
      const userLibraryResponse = await apiFetch<{ data: Series[] }>('/api/library');

      const adminLibraryResponse = await apiFetch<{ data: Series[] }>(
        '/api/library?owner=admin&limit=1000',
        {
          showErrorToast: false
        }
      );

      // Only include admin series that have at least one volume
      adminSeries = (adminLibraryResponse.data || []).filter(
        (s: Series) => s._count && s._count.volumes > 0
      );

      // User series (only editable series with at least one volume)
      allUserSeries = (userLibraryResponse.data || []).filter(
        (s: Series) => s.canEdit && s.volumes && s.volumes.length > 0
      );

      // Auto-expand fuzzy matched series
      initializeExpandedState();
    } catch (err: unknown) {
      console.error('Failed to load series data', err);
      toastStore.error('Failed to load library data');
    } finally {
      loading = false;
    }
  }

  function initializeExpandedState() {
    const newExpandedIds = new SvelteSet<string>();

    allUserSeries.forEach((series: Series) => {
      const match = suggestedMatches.get(series.id);
      if (match && series.id) {
        newExpandedIds.add(series.id);
      }
    });

    expandedSeriesIds = newExpandedIds;
  }

  function toggleExpanded(seriesId: string) {
    if (expandedSeriesIds.has(seriesId)) {
      expandedSeriesIds.delete(seriesId);
    } else {
      expandedSeriesIds.add(seriesId);
    }
    expandedSeriesIds = expandedSeriesIds;
  }

  function toggleVolume(seriesId: string, volumeId: string) {
    const selected = selectedVolumeIdsBySeriesId.get(seriesId) || new SvelteSet();
    if (selected.has(volumeId)) {
      selected.delete(volumeId);
    } else {
      selected.add(volumeId);
    }
    selectedVolumeIdsBySeriesId.set(seriesId, selected);
    selectedVolumeIdsBySeriesId = selectedVolumeIdsBySeriesId;
  }

  function selectAllVolumes(seriesId: string, volumes: Series['volumes']) {
    if (!volumes) return;

    const match = suggestedMatches.get(seriesId);
    const selectableVolumes = volumes.filter((v) => !match || !match.conflictVolumeIds.has(v.id));

    const selected = selectedVolumeIdsBySeriesId.get(seriesId) || new SvelteSet();
    const allSelected = selectableVolumes.every((v) => selected.has(v.id));

    if (allSelected) {
      selectableVolumes.forEach((v) => selected.delete(v.id));
    } else {
      selectableVolumes.forEach((v) => selected.add(v.id));
    }

    selectedVolumeIdsBySeriesId.set(seriesId, selected);
    selectedVolumeIdsBySeriesId = selectedVolumeIdsBySeriesId;
  }

  function setMergeDecision(seriesId: string, adminSeriesId: string | null) {
    mergeDecisions.set(seriesId, adminSeriesId);
    mergeDecisions = mergeDecisions;
  }

  // Get total selected volumes across all series
  let totalSelectedVolumes = $derived(
    Array.from(selectedVolumeIdsBySeriesId.values()).reduce((sum, set) => sum + set.size, 0)
  );

  async function handleSubmit() {
    if (totalSelectedVolumes === 0) {
      toastStore.error('Please select at least one volume');
      return;
    }

    submitting = true;
    try {
      // Submit each series separately with its merge decision
      for (const series of allUserSeries) {
        const selectedVolumes = selectedVolumeIdsBySeriesId.get(series.id);
        if (!selectedVolumes || selectedVolumes.size === 0) continue;

        const targetSeriesId = mergeDecisions.get(series.id);

        await apiFetch('/api/contributions/submissions', {
          method: 'POST',
          body: {
            volumeIds: Array.from(selectedVolumes),
            targetSeriesId:
              targetSeriesId === null || targetSeriesId === undefined ? undefined : targetSeriesId
          }
        });
      }

      await contributionsSummaryState.refresh({ force: true });
      toastStore.success(`Submitted ${totalSelectedVolumes} volume(s) successfully`);

      // Clear selections
      selectedVolumeIdsBySeriesId = new SvelteMap();
      mergeDecisions = new SvelteMap();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit volumes';
      toastStore.error(message);
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    loadSeriesData();
  });
</script>

<div class="space-y-4">
  {#if loading}
    <div class="bg-theme-surface/30 border border-theme-border rounded-xl p-12 text-center">
      <div class="text-5xl mb-3 animate-pulse">⏳</div>
      <div class="text-theme-secondary font-medium">Loading your private library...</div>
    </div>
  {:else if allUserSeries.length === 0}
    <div class="bg-theme-surface/30 border-2 border-theme-border rounded-xl p-12 text-center">
      <div class="text-5xl mb-3">📚</div>
      <div class="text-lg font-semibold text-theme-primary mb-2">No Private Volumes</div>
      <div class="text-sm text-theme-tertiary">
        Upload some volumes to your private library to submit them to the shared library
      </div>
    </div>
  {:else}
    <!-- Submit Summary Sticky Bar -->
    {#if totalSelectedVolumes > 0}
      <div
        class="bg-gradient-to-r from-accent/15 to-accent/5 border-2 border-accent rounded-xl p-4 flex items-center gap-4 sticky top-0 z-20 shadow-lg shadow-accent/10 animate-slideIn"
      >
        <div class="flex-1">
          <div class="font-bold text-base text-accent">
            {totalSelectedVolumes} Volume{totalSelectedVolumes > 1 ? 's' : ''} Selected
          </div>
          <div class="text-sm text-theme-secondary">
            Configure destinations below and click submit
          </div>
        </div>
        <button
          onclick={() => {
            selectedVolumeIdsBySeriesId = new SvelteMap();
            mergeDecisions = new SvelteMap();
          }}
          class="px-4 py-2 rounded-lg text-sm font-semibold bg-theme-surface text-theme-primary hover:bg-theme-surface-hover border-2 border-theme-border transition-all"
        >
          Clear All
        </button>
        <button
          onclick={handleSubmit}
          disabled={submitting}
          class="px-6 py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-accent to-accent/80 text-white hover:from-accent-hover hover:to-accent border-2 border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
        >
          {#if submitting}
            <span class="flex items-center gap-2">
              <svg
                class="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Submitting...
            </span>
          {:else}
            <span class="flex items-center gap-2">
              <span>📤</span>
              Submit to Library
            </span>
          {/if}
        </button>
      </div>
    {/if}

    <!-- Series List -->
    <div class="space-y-4">
      {#each allUserSeries as series (series.id)}
        {@const isExpanded = expandedSeriesIds.has(series.id)}
        {@const match = suggestedMatches.get(series.id)}
        {@const selectedVolumes = selectedVolumeIdsBySeriesId.get(series.id) || new Set()}
        {@const mergeDecision = mergeDecisions.get(series.id)}
        {@const conflictCount = match ? match.conflictVolumeIds.size : 0}
        {@const volumes = series.volumes || []}
        {@const selectableVolumes = volumes.filter(
          (v) => !match || !match.conflictVolumeIds.has(v.id)
        )}

        <div
          class="bg-gradient-to-br from-theme-surface/40 to-theme-surface/20 border-2 rounded-xl overflow-hidden {match
            ? 'border-yellow-500/40 shadow-lg shadow-yellow-500/10'
            : 'border-theme-border hover:border-accent/30'} transition-all"
        >
          <!-- Series Header -->
          <div class="bg-theme-surface/60 border-b-2 border-theme-border/50 p-4">
            <div class="flex items-start gap-3">
              <!-- Cover Image -->
              {#if series.coverPath}
                <AuthenticatedImage
                  src="/api/files/series/{series.id}/cover?w=80&q=60&format=avif"
                  alt=""
                  class="w-12 h-16 object-cover rounded-lg border-2 border-theme-border flex-shrink-0"
                />
              {:else}
                <div
                  class="w-12 h-16 rounded-lg border-2 border-theme-border bg-theme-surface flex items-center justify-center text-theme-tertiary font-bold flex-shrink-0"
                >
                  #
                </div>
              {/if}

              <button
                onclick={() => toggleExpanded(series.id)}
                class="p-2 hover:bg-theme-primary/10 rounded-lg transition-colors flex-shrink-0"
                aria-label={isExpanded ? 'Collapse volumes' : 'Expand volumes'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  class="text-theme-primary transition-transform {isExpanded ? 'rotate-90' : ''}"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <div class="font-bold text-base text-theme-primary">
                    {series.title || series.folderName}
                  </div>
                  {#if match}
                    <div
                      class="px-2 py-0.5 rounded-md bg-yellow-500/20 border border-yellow-500/40 flex items-center gap-1.5"
                    >
                      <span class="text-sm">⚠️</span>
                      <span class="text-[10px] font-bold text-yellow-300 uppercase"
                        >Match Found</span
                      >
                    </div>
                  {:else}
                    <div
                      class="px-2 py-0.5 rounded-md bg-green-500/20 border border-green-500/40 flex items-center gap-1.5"
                    >
                      <span class="text-sm">✨</span>
                      <span class="text-[10px] font-bold text-green-300 uppercase">New</span>
                    </div>
                  {/if}
                </div>
                <div class="flex items-center gap-2 text-sm text-theme-tertiary">
                  <span>{volumes.length} volume{volumes.length > 1 ? 's' : ''}</span>
                  {#if selectedVolumes.size > 0}
                    <span>•</span>
                    <span class="text-accent font-semibold">{selectedVolumes.size} selected</span>
                  {/if}
                  {#if conflictCount > 0}
                    <span>•</span>
                    <span class="text-yellow-400 font-semibold"
                      >{conflictCount} conflict{conflictCount > 1 ? 's' : ''}</span
                    >
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <!-- Match Warning -->
          {#if match}
            <div class="bg-yellow-500/5 border-b-2 border-yellow-500/20 p-4">
              <div class="flex items-start gap-3">
                <div class="text-2xl">💡</div>
                <div class="flex-1">
                  <div class="font-bold text-sm text-yellow-300 mb-1">Similar Series Detected</div>
                  <div class="text-xs text-theme-secondary mb-2">
                    Your series matches <strong class="text-theme-primary"
                      >{match.adminSeries.title || match.adminSeries.folderName}</strong
                    >
                    in the shared library ({match.adminSeries._count?.volumes || 0} volumes).
                  </div>
                  {#if conflictCount > 0}
                    <div class="text-xs text-yellow-400 mt-2 flex items-start gap-2">
                      <span>⚠️</span>
                      <span
                        >{conflictCount} volume{conflictCount > 1 ? 's' : ''} already exist{conflictCount ===
                        1
                          ? 's'
                          : ''} and cannot be submitted</span
                      >
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}

          <!-- Volumes List (Expandable) -->
          {#if isExpanded}
            <div class="bg-theme-main/30 border-b-2 border-theme-border/50">
              <!-- Select All Header -->
              {#if selectableVolumes.length > 0}
                <div
                  class="px-4 py-2 bg-theme-surface/30 border-b border-theme-border/30 flex items-center justify-between"
                >
                  <span class="text-xs text-theme-tertiary font-medium">
                    Select volumes to submit:
                  </span>
                  <button
                    onclick={() => selectAllVolumes(series.id, volumes)}
                    class="px-3 py-1 rounded-md text-xs font-bold bg-accent/10 text-accent hover:bg-accent/20 border border-accent/30 transition-all"
                  >
                    {selectableVolumes.every((v) => selectedVolumes.has(v.id))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
              {/if}

              <!-- Scrollable Volume List -->
              <div class="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {#each volumes as volume (volume.id)}
                  {@const isConflict = match && match.conflictVolumeIds.has(volume.id)}
                  {@const isSelected = selectedVolumes.has(volume.id)}

                  <button
                    onclick={() => !isConflict && toggleVolume(series.id, volume.id)}
                    disabled={isConflict}
                    class="w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all {isConflict
                      ? 'bg-yellow-500/5 border-yellow-500/20 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'bg-accent/10 border-accent shadow-sm'
                        : 'bg-theme-surface/40 border-theme-border hover:border-accent/30 hover:bg-theme-surface'}"
                  >
                    <!-- Checkbox -->
                    <div
                      class="w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center {isConflict
                        ? 'border-yellow-500/40 bg-yellow-500/10'
                        : isSelected
                          ? 'bg-accent border-accent'
                          : 'border-theme-border'}"
                    >
                      {#if isConflict}
                        <span class="text-yellow-400 text-xs font-bold">⚠</span>
                      {:else if isSelected}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                          class="text-white"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      {/if}
                    </div>

                    <!-- Volume Info -->
                    <div class="flex-1 min-w-0 text-left">
                      <div class="text-sm font-medium text-theme-primary truncate">
                        {volume.title || volume.folderName}
                      </div>
                      {#if isConflict}
                        <div class="text-xs text-yellow-400">Already exists in shared library</div>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Merge Decision (shown when volumes are selected) -->
          {#if selectedVolumes.size > 0}
            <div class="bg-theme-surface/40 border-t-2 border-theme-border/50 p-4">
              <div class="text-xs font-bold text-theme-tertiary uppercase tracking-wide mb-3">
                📍 Destination for selected volumes:
              </div>

              <div class="space-y-2">
                <!-- Create New Series Option -->
                <label
                  class="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all {mergeDecision ===
                  null
                    ? 'bg-accent/10 border-accent shadow-sm'
                    : 'bg-theme-surface/20 border-theme-border hover:border-accent/30 hover:bg-theme-surface/40'}"
                >
                  <input
                    type="radio"
                    name="merge-{series.id}"
                    checked={mergeDecision === null}
                    onchange={() => setMergeDecision(series.id, null)}
                    class="w-5 h-5 accent-accent"
                  />
                  <div class="flex-1">
                    <div class="font-semibold text-sm text-theme-primary flex items-center gap-2">
                      <span>✨</span>
                      <span>Create New Series</span>
                    </div>
                    <div class="text-xs text-theme-tertiary mt-0.5">
                      Add as a new series in the shared library
                    </div>
                  </div>
                </label>

                <!-- Merge with Suggested Match -->
                {#if match}
                  <label
                    class="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all {mergeDecision ===
                    match.adminSeries.id
                      ? 'bg-accent/10 border-accent shadow-sm'
                      : 'bg-theme-surface/20 border-yellow-500/30 hover:border-accent/30 hover:bg-theme-surface/40'}"
                  >
                    <input
                      type="radio"
                      name="merge-{series.id}"
                      checked={mergeDecision === match.adminSeries.id}
                      onchange={() => setMergeDecision(series.id, match.adminSeries.id)}
                      class="w-5 h-5 accent-accent"
                    />
                    <div class="flex-1">
                      <div class="font-semibold text-sm text-theme-primary flex items-center gap-2">
                        <span>🔗</span>
                        <span
                          >Merge into: {match.adminSeries.title ||
                            match.adminSeries.folderName}</span
                        >
                        <span
                          class="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-bold"
                        >
                          SUGGESTED
                        </span>
                      </div>
                      <div class="text-xs text-theme-tertiary mt-0.5">
                        Add volumes to existing shared series
                      </div>
                    </div>
                  </label>
                {/if}

                <!-- Other Merge Options (if needed) -->
                {#if adminSeries.length > 0 && (!match || adminSeries.length > 1)}
                  <details class="group">
                    <summary
                      class="text-xs text-theme-tertiary hover:text-theme-primary cursor-pointer px-2 py-1"
                    >
                      Or merge into different series...
                    </summary>
                    <div class="mt-2 space-y-1.5 max-h-40 overflow-y-auto px-1">
                      {#each adminSeries as adminS (adminS.id)}
                        {#if !match || adminS.id !== match.adminSeries.id}
                          <label
                            class="flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all {mergeDecision ===
                            adminS.id
                              ? 'bg-accent/10 border-accent'
                              : 'bg-theme-surface/20 border-theme-border hover:border-accent/30'}"
                          >
                            <input
                              type="radio"
                              name="merge-{series.id}"
                              checked={mergeDecision === adminS.id}
                              onchange={() => setMergeDecision(series.id, adminS.id)}
                              class="w-4 h-4 accent-accent"
                            />
                            <div class="flex-1 min-w-0">
                              <div class="text-xs font-medium text-theme-primary truncate">
                                {adminS.title || adminS.folderName}
                              </div>
                              <div class="text-[10px] text-theme-tertiary">
                                {adminS._count?.volumes || 0} volume(s)
                              </div>
                            </div>
                          </label>
                        {/if}
                      {/each}
                    </div>
                  </details>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slideIn {
    animation: slideIn 0.2s ease-out;
  }
</style>
