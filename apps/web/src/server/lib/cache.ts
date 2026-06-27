import "server-only";

// In-memory cache store on globalThis to survive hot-reloads in Next.js development mode
const globalCache = (globalThis as any)._serviceCache || new Map<string, any>();
if (!(globalThis as any)._serviceCache) {
  (globalThis as any)._serviceCache = globalCache;
}

export function getFromCache<T>(key: string): T | undefined {
  return globalCache.get(key);
}

export function setToCache<T>(key: string, value: T): void {
  globalCache.set(key, value);
}

export function invalidateCache(key: string): void {
  globalCache.delete(key);
}

export function invalidateCachePattern(pattern: string): void {
  for (const key of globalCache.keys()) {
    if (key.includes(pattern)) {
      globalCache.delete(key);
    }
  }
}

export async function getOrSetCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (globalCache.has(key)) {
    return globalCache.get(key) as T;
  }
  const result = await fn();
  globalCache.set(key, result);
  return result;
}

export function clearAllCache(): void {
  globalCache.clear();
}
