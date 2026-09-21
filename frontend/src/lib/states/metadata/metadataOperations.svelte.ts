import { apiFetch } from '$lib/services/api';
import { toastStore } from '$lib/stores/toastStore.svelte.ts';
import { apiCache } from '$lib/utils/caching/apiCache';

type RevertCallback = () => void;
type SeriesMetadata = {
  title?: string | null;
  japaneseTitle?: string | null;
  romajiTitle?: string | null;
  synonyms?: string | null;
  description?: string | null;
  bookmarked?: boolean;
  organized?: boolean;
  tempCoverPath?: string;
};
type VolumeMetaData = {
  title?: string | null;
};

class MetadataOperations {
  // Map ID -> { timer, action } so we can execute 'action' immediately on flush
  private pending = new Map<string, { timer: ReturnType<typeof setTimeout>; action: () => void }>();

  /**
   * Force-executes all pending updates immediately.
   * Call this when the component is destroyed or the user navigates away.
   */
  flush() {
    for (const { timer, action } of this.pending.values()) {
      clearTimeout(timer); // Stop the scheduled run
      action(); // Run immediately
    }
    this.pending.clear();
  }

  /**
   * SYNC BOOKMARK (Series)
   * Handles the API call with debounce and error reversion.
   *
   * @param id - The Series ID
   * @param isBookmarked - The NEW state (already applied to UI)
   * @param onRevert - Callback to run if the API call fails (to reset UI)
   */
  syncBookmark(id: string, isBookmarked: boolean, onRevert?: RevertCallback) {
    this.schedule(id, async () => {
      try {
        await this.saveSeriesMetadata(id, { bookmarked: isBookmarked });
        // Success: Do nothing, UI is already correct
      } catch (error) {
        console.error(`Failed to sync bookmark for ${id}`, error);
        toastStore.error('Failed to sync bookmark. Please try again.');
        onRevert?.();
      }
    });
  }

  /**
   * SYNC PROGRESS (Volume)
   * Handles marking a volume as Read/Unread.
   *
   * @param id - The Volume ID
   * @param isCompleted - The NEW completed state
   * @param onRevert - Callback to revert UI on error
   */
  syncVolumeCompletion(id: string, isCompleted: boolean, onRevert?: RevertCallback) {
    this.schedule(id, async () => {
      try {
        const { seriesId } = await apiFetch<{ seriesId: string }>(
          `/api/metadata/volume/${id}/progress`,
          {
            method: 'PATCH',
            body: {
              completed: isCompleted
            }
          }
        );
        apiCache.invalidateLibraryCache(true);
        apiCache.invalidateSeriesCache({ seriesId });
        apiCache.invalidateVolumeCache({ volumeId: id });
      } catch (error) {
        console.error(`Failed to sync progress for ${id}`, error);
        toastStore.error('Failed to mark volume as read/unread. Please try again.');
        onRevert?.();
      }
    });
  }

  saveSeriesMetadata = async (id: string, body: SeriesMetadata) => {
    await apiFetch(`/api/metadata/series/${id}`, {
      method: 'PATCH',
      body
    });
    apiCache.invalidateSeriesCache({ seriesId: id });
    apiCache.invalidateLibraryCache(true);
  };

  saveVolumeMetadata = async (id: string, body: VolumeMetaData) => {
    const { seriesId } = await apiFetch<{ seriesId: string }>(`/api/metadata/volume/${id}`, {
      method: 'PATCH',
      body
    });
    apiCache.invalidateLibraryCache(true);
    apiCache.invalidateSeriesCache({ seriesId });
    apiCache.invalidateVolumeCache({ volumeId: id });
  };

  // --- Helper ---
  private schedule(id: string, action: () => void, delay = 1000) {
    // 1. Clear existing timer for this ID
    if (this.pending.has(id)) {
      clearTimeout(this.pending.get(id)!.timer);
    }

    // 2. Schedule new timer
    const timer = setTimeout(() => {
      action();
      this.pending.delete(id); // Cleanup after running
    }, delay);

    // 3. Store both so we can flush later
    this.pending.set(id, { timer, action });
  }
}

export const metadataOps = new MetadataOperations();
