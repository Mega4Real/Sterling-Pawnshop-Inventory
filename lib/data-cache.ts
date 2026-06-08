import { useEffect, useState, useCallback, useRef } from 'react';

type Fetcher<T> = () => Promise<T>;

interface CacheEntry<T = any> {
  data: T | undefined;
  timestamp: number;
  error?: any;
  promise?: Promise<T>;
}

// Global cache store
const cache = new Map<string, CacheEntry>();

// Global event listeners to notify components when data changes
const listeners = new Map<string, Set<() => void>>();

const DEFAULT_STALE_TIME = 30_000; // 30 seconds default stale time

/**
 * Hook to retrieve and cache data on the client side with a Stale-While-Revalidate pattern.
 *
 * @param key - The cache key (e.g., 'inventory', 'customers')
 * @param fetcher - Async function that retrieves the data
 * @param options - Configure staleTime and enabled/disabled state
 */
export function useCachedData<T>(
  key: string,
  fetcher: Fetcher<T>,
  options?: { staleTime?: number; enabled?: boolean }
) {
  const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME;
  const enabled = options?.enabled ?? true;

  const [, forceUpdate] = useState({});
  const triggerUpdate = useCallback(() => forceUpdate({}), []);

  // Register listener for key updates
  useEffect(() => {
    if (!enabled) return;

    if (!listeners.has(key)) {
      listeners.set(key, new Set());
    }
    listeners.get(key)!.add(triggerUpdate);

    return () => {
      const keyListeners = listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(triggerUpdate);
        if (keyListeners.size === 0) {
          listeners.delete(key);
        }
      }
    };
  }, [key, enabled, triggerUpdate]);

  // Execute fetch and update cache
  const executeFetch = useCallback(async () => {
    let entry = cache.get(key);
    if (!entry) {
      entry = { data: undefined, timestamp: 0 };
      cache.set(key, entry);
    }

    if (entry.promise) {
      return entry.promise;
    }

    const promise = fetcher()
      .then((freshData) => {
        const currentEntry = cache.get(key);
        if (currentEntry) {
          currentEntry.data = freshData;
          currentEntry.timestamp = Date.now();
          currentEntry.error = undefined;
          delete currentEntry.promise;
        }
        // Notify all listeners
        const keyListeners = listeners.get(key);
        if (keyListeners) {
          keyListeners.forEach((cb) => cb());
        }
        return freshData;
      })
      .catch((err) => {
        const currentEntry = cache.get(key);
        if (currentEntry) {
          currentEntry.error = err;
          delete currentEntry.promise;
        }
        // Notify all listeners of the error state
        const keyListeners = listeners.get(key);
        if (keyListeners) {
          keyListeners.forEach((cb) => cb());
        }
        throw err;
      });

    entry.promise = promise;
    triggerUpdate();
    return promise;
  }, [key, fetcher, triggerUpdate]);

  // Determine if cache needs background revalidation
  const entry = cache.get(key);
  const isStale = !entry || Date.now() - entry.timestamp > staleTime;

  useEffect(() => {
    if (enabled && isStale) {
      executeFetch().catch((err) => {
        console.error(`Error background fetching cache key "${key}":`, err);
      });
    }
  }, [key, enabled, isStale, executeFetch]);

  return {
    data: entry?.data as T | undefined,
    error: entry?.error,
    isLoading: !entry || (entry.data === undefined && !entry.error && !!entry.promise),
    isRevalidating: !!entry?.promise,
    refetch: executeFetch,
  };
}

/**
 * Invalidates cache entries matching a prefix and forces any active components using them to refetch.
 *
 * @param keyPattern - Prefix or exact cache key to invalidate
 */
export function invalidateCache(keyPattern: string) {
  for (const key of Array.from(cache.keys())) {
    if (key === keyPattern || key.startsWith(`${keyPattern}/`)) {
      const entry = cache.get(key);
      if (entry) {
        // Clear timestamp to make it immediately stale
        entry.timestamp = 0;
        // Optionally preserve data for SWR display while revalidating
      }
      
      // Notify active listeners so they re-run their useEffect and fetch fresh data
      const keyListeners = listeners.get(key);
      if (keyListeners) {
        keyListeners.forEach((cb) => cb());
      }
    }
  }
}

/**
 * Clears the entire in-memory cache and triggers updates for active listeners.
 */
export function clearAllCache() {
  cache.clear();
  listeners.forEach((set) => set.forEach((cb) => cb()));
}

/**
 * Hook to wrap mutations (e.g. Save, Delete) with a loading state and an execution lock.
 * Prevents rapid double-clicks or parallel submissions.
 *
 * @param mutationFn - The actual operation to run
 * @param options - Success and error handlers
 */
export function useMutation<TArgs extends any[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  options?: {
    onSuccess?: (result: TResult) => void | Promise<void>;
    onError?: (error: any) => void;
  }
) {
  const [loading, setLoading] = useState(false);
  const isPending = useRef(false);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (isPending.current) {
        console.warn('Mutation execution blocked: operation is already in progress.');
        return;
      }

      isPending.current = true;
      setLoading(true);

      try {
        const result = await mutationFn(...args);
        if (options?.onSuccess) {
          await options.onSuccess(result);
        }
        return result;
      } catch (error) {
        if (options?.onError) {
          options.onError(error);
        } else {
          console.error('Mutation failed:', error);
        }
      } finally {
        isPending.current = false;
        setLoading(false);
      }
    },
    [mutationFn, options]
  );

  return { execute, loading };
}
