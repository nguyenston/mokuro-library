export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoffMultiplier?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, backoffMultiplier = 2, onRetry } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      const waitTime = delay * Math.pow(backoffMultiplier, attempt - 1);
      onRetry?.(error as Error, attempt);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw new Error('Max retries exceeded');
}
