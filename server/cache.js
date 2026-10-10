// Tiny in-memory TTL cache. Stores promises so concurrent requests share one fetch.
const entries = new Map();

export function cached(key, ttlMs, load) {
  const hit = entries.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = load();
  entries.set(key, { value, expires: Date.now() + ttlMs });
  // Don't keep failures around.
  value.catch(() => entries.delete(key));
  return value;
}
