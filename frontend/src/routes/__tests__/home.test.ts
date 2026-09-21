import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from '../(protected)/+page.svelte';

type SimpleStore<T> = {
  subscribe: (run: (value: T) => void) => () => void;
  set: (value: T) => void;
  update: (fn: (value: T) => T) => void;
};

const { userStore } = vi.hoisted(() => {
  let value: unknown = null;
  const subscribers = new Set<(value: unknown) => void>();
  const store: SimpleStore<unknown> = {
    subscribe(run) {
      run(value);
      subscribers.add(run);
      return () => subscribers.delete(run);
    },
    set(next) {
      value = next;
      subscribers.forEach((run) => run(value));
    },
    update(fn) {
      store.set(fn(value));
    }
  };
  return { userStore: store };
});

const apiFetchMock = vi.hoisted(() => vi.fn());
const gotoMock = vi.hoisted(() => vi.fn());
const pageState = vi.hoisted(() => ({ url: new URL('http://localhost/') }));
vi.mock('$lib/services/api', () => ({
  apiFetch: apiFetchMock,
  triggerDownload: vi.fn()
}));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: gotoMock }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$lib/stores/authStore', () => ({ user: userStore }));

afterEach(() => {
  userStore.set(null);
  apiFetchMock.mockReset();
  gotoMock.mockReset();
});

describe('home page', () => {
  it('renders a redirect placeholder when unauthenticated', () => {
    render(Page);

    expect(screen.getByText('Redirecting...')).toBeTruthy();
  });

  it('renders the library view and fetches data for authenticated users', async () => {
    vi.useFakeTimers();

    userStore.set({ id: 'user-1', username: 'tester', settings: {} });
    apiFetchMock.mockResolvedValue({
      data: [
        {
          id: 'series-1',
          title: 'Series One',
          folderName: 'Series One',
          sortTitle: 'Series One',
          japaneseTitle: null,
          romajiTitle: null,
          synonyms: null,
          description: null,
          coverPath: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownerId: 'admin',
          bookmarked: false,
          status: 0,
          organized: false,
          lastReadAt: new Date().toISOString(),
          isOfficial: true,
          canEdit: true,
          totalPageCount: 0,
          totalVolumeCount: 0,
          readPageCount: 0,
          completedVolumeCount: 0,
          volumes: []
        }
      ],
      meta: { total: 1, page: 1, limit: 24, totalPages: 1 }
    });

    render(Page);

    await vi.runAllTimersAsync();

    expect(apiFetchMock).toHaveBeenCalled();
    expect(screen.getByText('Series One')).toBeTruthy();

    vi.useRealTimers();
  });
});
