/**
 * The narrow async key-value contract every table accessor (table.ts) is
 * built against. Deliberately tiny — get/set only, one string key at a
 * time — so it's trivial to implement against anything: an in-memory Map
 * (tests, and a safe fallback), or `@react-native-async-storage/async-
 * storage` (the app's real, cross-platform store — see
 * asyncStorageKeyValueStore.ts). This is the seam that keeps table.ts and
 * localRepository.ts's business logic fully unit-testable under vitest's
 * `node` environment without touching React Native at all.
 */

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * Pure in-memory implementation. Used by the domain-adjacent test suite
 * (tests/repository/**) and available as a same-shape fallback anywhere a
 * real persistent store can't be constructed (e.g. a platform without
 * AsyncStorage available) — data simply won't survive a restart in that
 * case, which is a strictly better failure mode than crashing the app.
 */
export function createInMemoryKeyValueStore(): KeyValueStore {
  const backing = new Map<string, string>();
  return {
    async getItem(key: string): Promise<string | null> {
      return backing.has(key) ? (backing.get(key) as string) : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      backing.set(key, value);
    },
  };
}
