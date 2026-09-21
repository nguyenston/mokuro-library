import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from '../+page.svelte';

type SimpleStore<T> = {
  subscribe: (run: (value: T) => void) => () => void;
  set: (value: T) => void;
  update: (fn: (value: T) => T) => void;
};

const { userStore, pageState, components } = vi.hoisted(() => {
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

  const makeStub = (testId: string) => (anchor: Comment) => {
    const element = document.createElement('div');
    element.dataset.testid = testId;
    if (anchor?.parentNode) {
      anchor.parentNode.insertBefore(element, anchor);
      return;
    }
    document.body.appendChild(element);
  };

  return {
    userStore: store,
    pageState: { url: new URL('http://localhost/settings') },
    components: {
      ReaderSettings: makeStub('reader-settings'),
      AnkiSettings: makeStub('anki-settings'),
      LibraryOverview: makeStub('library-overview'),
      ScrapeSettings: makeStub('scrape-settings'),
      KeybindSettings: makeStub('keybind-settings'),
      TestRunnerSettings: makeStub('test-runner-settings')
    }
  };
});

const gotoMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/stores/authStore', () => ({ user: userStore }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: gotoMock }));
vi.mock('$app/state', () => ({ page: pageState }));

vi.mock('$lib/components/settings/ReaderSettings.svelte', () => ({
  default: components.ReaderSettings
}));
vi.mock('$lib/components/settings/AnkiSettings.svelte', () => ({
  default: components.AnkiSettings
}));
vi.mock('$lib/components/settings/LibraryOverview.svelte', () => ({
  default: components.LibraryOverview
}));
vi.mock('$lib/components/settings/ScrapeSettings.svelte', () => ({
  default: components.ScrapeSettings
}));
vi.mock('$lib/components/settings/KeybindSettings.svelte', () => ({
  default: components.KeybindSettings
}));
vi.mock('$lib/components/settings/TestRunnerSettings.svelte', () => ({
  default: components.TestRunnerSettings
}));

afterEach(() => {
  gotoMock.mockReset();
});

describe('settings page', () => {
  it('renders reader settings by default', async () => {
    pageState.url = new URL('http://localhost/settings');

    render(Page);

    expect(await screen.findByTestId('reader-settings')).toBeTruthy();
  });

  it('honors category query param', async () => {
    pageState.url = new URL('http://localhost/settings?category=keybinds');

    render(Page);

    expect(await screen.findByTestId('keybind-settings')).toBeTruthy();
  });
});
