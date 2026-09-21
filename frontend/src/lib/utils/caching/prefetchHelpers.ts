import { browser } from '$app/environment';

const isSlowConnection = () => {
  if (!browser) return true;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  const effectiveType = connection.effectiveType;
  return effectiveType === 'slow-2g' || effectiveType === '2g';
};

export const shouldPrefetch = () => browser && !isSlowConnection();

export function runWhenIdle<T>(task: () => Promise<T> | T, timeout = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      }
    };

    const requestIdle = (
      globalThis as {
        requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (requestIdle) {
      requestIdle(run, { timeout });
    } else {
      setTimeout(run, 0);
    }
  });
}
