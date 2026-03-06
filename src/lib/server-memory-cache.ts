interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const CACHE_STORE_KEY = "__pmpn_in_memory_cache__";

function getStore() {
  const globalScope = globalThis as typeof globalThis & {
    [CACHE_STORE_KEY]?: Map<string, CacheEntry<unknown>>;
  };

  if (!globalScope[CACHE_STORE_KEY]) {
    globalScope[CACHE_STORE_KEY] = new Map<string, CacheEntry<unknown>>();
  }

  return globalScope[CACHE_STORE_KEY];
}

export function getCachedValue<T>(key: string): T | null {
  const store = getStore();
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  const store = getStore();
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}
