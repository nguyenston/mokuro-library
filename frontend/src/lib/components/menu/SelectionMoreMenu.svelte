<script lang="ts">
  import { contextMenu } from '$lib/stores/contextMenuStore';
  import { apiFetch } from '$lib/services/api';
  import { type MenuOption } from '$lib/stores/contextMenuStore';
  import { apiCache } from '$lib/utils/caching/apiCache';

  let {
    selectionCount,
    selectedIds,
    onScrape,
    onRefresh,
    onExitSelection
  }: {
    selectionCount: number;
    selectedIds: string[];
    onScrape?: () => void;
    onRefresh: () => void;
    onExitSelection?: () => void;
  } = $props();

  async function handleOrganize(value: boolean) {
    const ids = selectedIds;
    try {
      await apiFetch('/api/metadata/batch/organize', {
        method: 'POST',
        body: { ids, value }
      });
      for (const id of ids) {
        apiCache.invalidateSeriesCache({ seriesId: id });
      }
      apiCache.invalidateLibraryCache(true);
      onExitSelection?.();
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
    }
  }

  function openMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const menuItems: MenuOption[] = [
      // Section: Organization
      {
        label: 'Mark as Organized',
        action: () => handleOrganize(true)
      },
      {
        label: 'Mark as Unorganized',
        action: () => handleOrganize(false)
      }
    ];

    if (typeof onScrape === 'function') {
      menuItems.push({ label: 'Scrape metadata', action: () => onScrape() });
    }

    contextMenu.open(rect.left, rect.top, menuItems, {}, { anchorElement: target, yAlign: 'top' });
  }
</script>

<button
  onclick={openMenu}
  class="p-2.5 rounded-xl hover:bg-theme-primary/10 text-theme-secondary hover:text-theme-primary transition-colors"
  title="More Actions"
  aria-label={`More actions for ${selectionCount} selected`}
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
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
</button>
