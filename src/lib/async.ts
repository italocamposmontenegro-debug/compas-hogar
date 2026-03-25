export async function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function queryWithTimeout<T>(
  run: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve(run(controller.signal)),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

export async function retryOnceOnTransientNetworkError<T>(
  run: () => Promise<T>,
  retryDelayMs = 1200,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return run();
  }
}
