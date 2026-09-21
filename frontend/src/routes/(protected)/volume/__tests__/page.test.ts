import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from '../[id]/+page.svelte';

type SimpleStore<T> = {
  subscribe: (run: (value: T) => void) => () => void;
  set: (value: T) => void;
  update: (fn: (value: T) => T) => void;
};

const { userStore } = vi.hoisted(() => {
  let value: unknown = { id: 'user-1', username: 'tester', settings: {} };
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

const beforeNavigateMock = vi.hoisted(() => vi.fn());
const gotoMock = vi.hoisted(() => vi.fn());
const readerStateMock = vi.hoisted(() => ({
  isLoading: true,
  error: null as string | null,
  volume: null as unknown,
  layoutMode: 'single',
  navZoneWidth: 15,
  showTriggerOutline: false,
  retainZoom: false,
  focusedBlock: null as unknown,
  focusedPage: null as unknown,
  hasUnsavedChanges: false,
  mount: vi.fn(),
  cleanup: vi.fn(),
  setOcrMode: vi.fn(),
  setFocusedBlock: vi.fn(),
  onOcrChange: vi.fn(),
  seriesTitle: 'Series',
  volumeTitle: 'Volume'
}));

vi.mock('$lib/stores/authStore', () => ({ user: userStore }));
vi.mock('$lib/stores/cachedImageStore', () => ({ imageStore: { clear: vi.fn() } }));
vi.mock('$lib/stores/confirmationStore', () => ({ confirmation: { open: vi.fn() } }));
vi.mock('$lib/states/reader/ReaderState.svelte.ts', () => ({ readerState: readerStateMock }));
vi.mock('$app/navigation', () => ({
  beforeNavigate: beforeNavigateMock,
  goto: gotoMock
}));
vi.mock('$app/environment', () => ({ browser: true }));

afterEach(() => {
  beforeNavigateMock.mockReset();
  gotoMock.mockReset();
  readerStateMock.mount.mockReset();
  readerStateMock.cleanup.mockReset();
});

describe('volume page', () => {
  it('renders loading state while volume is fetching', () => {
    readerStateMock.isLoading = true;
    readerStateMock.error = null;
    readerStateMock.volume = null;

    const { container } = render(Page, { props: { params: { id: 'vol-1' } } });

    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(readerStateMock.mount).toHaveBeenCalledWith('vol-1');
  });

  it('renders error state when reader fails', () => {
    readerStateMock.isLoading = false;
    readerStateMock.error = 'Failed to load';
    readerStateMock.volume = null;

    render(Page, { props: { params: { id: 'vol-1' } } });

    expect(screen.getByText('Error: Failed to load')).toBeTruthy();
  });
});
