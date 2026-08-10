/** Tiny TTL cache for identical route validations (serverless best-effort). */

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string, now = Date.now()): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (now >= hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number, now = Date.now()): void {
  store.set(key, { value, expiresAt: now + ttlMs });
  // Opportunistic cleanup
  if (store.size > 200) {
    for (const [k, v] of store) {
      if (now >= v.expiresAt) store.delete(k);
    }
  }
}

export function cacheReset(): void {
  store.clear();
}
