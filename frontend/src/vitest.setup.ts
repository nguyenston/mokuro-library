// Mock SvelteKit globals that $app/paths needs
// @ts-expect-error - SvelteKit internal global
globalThis.__SVELTEKIT_PATHS_BASE__ = '';
// @ts-expect-error - SvelteKit internal global
globalThis.__SVELTEKIT_PATHS_ASSETS__ = '';
// @ts-expect-error - SvelteKit internal global
globalThis.__SVELTEKIT_PATHS_RESOLVE__ = (path: string) => path;
// @ts-expect-error - SvelteKit internal global
globalThis.__SVELTEKIT_EMBEDDED__ = false;
// @ts-expect-error - SvelteKit internal global
globalThis.__SVELTEKIT_APP_DIR__ = '/_app';
// @ts-expect-error - SvelteKit internal global
globalThis.__SVELTEKIT_APP_VERSION_FILE__ = '/_app/version.json';
// @ts-expect-error - SvelteKit internal global
globalThis.__SVELTEKIT_APP_VERSION_POLL_INTERVAL__ = 0;
// @ts-expect-error - SvelteKit internal global
globalThis.__SVELTEKIT_PATHS_RELATIVE__ = false;

if (!globalThis.crypto) {
  globalThis.crypto = {
    randomUUID: () =>
      'test-uuid-test-uuid-test-uuid-test' as `${string}-${string}-${string}-${string}-${string}`,
    subtle: {} as SubtleCrypto,
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => array as T
  } as Crypto;
}

if (!Element.prototype.animate) {
  Element.prototype.animate = () =>
    ({
      cancel: () => {},
      finished: Promise.resolve()
    }) as unknown as Animation;
}

if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    }
  } as Storage;
}

// Mock sessionStorage (needed for device fingerprint)
if (!globalThis.sessionStorage || typeof globalThis.sessionStorage.getItem !== 'function') {
  const sessionStore = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (key: string) => (sessionStore.has(key) ? sessionStore.get(key)! : null),
    setItem: (key: string, value: string) => {
      sessionStore.set(key, String(value));
    },
    removeItem: (key: string) => {
      sessionStore.delete(key);
    },
    clear: () => {
      sessionStore.clear();
    },
    key: (index: number) => Array.from(sessionStore.keys())[index] ?? null,
    get length() {
      return sessionStore.size;
    }
  } as Storage;
}

// Mock BroadcastChannel (used by token refresh for multi-tab coordination)
if (typeof globalThis.BroadcastChannel === 'undefined') {
  globalThis.BroadcastChannel = class MockBroadcastChannel {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;

    constructor(name: string) {
      this.name = name;
    }

    postMessage(_message: unknown) {
      // No-op in tests
    }

    close() {
      // No-op in tests
    }

    addEventListener(_type: string, _listener: EventListener) {
      // No-op in tests
    }

    removeEventListener(_type: string, _listener: EventListener) {
      // No-op in tests
    }

    dispatchEvent(_event: Event): boolean {
      return true;
    }
  } as unknown as typeof BroadcastChannel;
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }) as MediaQueryList;
}
