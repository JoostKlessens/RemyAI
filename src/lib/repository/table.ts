/**
 * One JSON-array-per-key "table" on top of a KeyValueStore — the storage
 * primitive every entity-specific module in this directory (meals, saves,
 * cook events, decisions, ...) builds its queries/mutations on. Kept
 * generic and tiny on purpose: the actual domain logic (filtering,
 * joins, id assignment) belongs one layer up, in localRepository.ts,
 * fully unit-testable against createInMemoryKeyValueStore.
 *
 * Defensive parsing: stored data is trusted less than "our own code wrote
 * it a moment ago" would suggest — a schema could change between app
 * versions, or storage could be hand-edited. A corrupt or unexpected shape
 * degrades to an empty table rather than throwing and taking the whole
 * repository down; the coding standard's "never trust external data"
 * applies to persisted storage exactly as it does to a network response.
 */

import type { KeyValueStore } from './keyValueStore';

export interface TableAccessor<T> {
  readonly list: () => Promise<readonly T[]>;
  readonly replaceAll: (rows: readonly T[]) => Promise<void>;
}

function isPlainObjectArray(value: unknown): value is readonly Record<string, unknown>[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'object' && entry !== null);
}

export function createTableAccessor<T>(store: KeyValueStore, key: string): TableAccessor<T> {
  return {
    async list(): Promise<readonly T[]> {
      const raw = await store.getItem(key);
      if (raw === null) {
        return [];
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
      return isPlainObjectArray(parsed) ? (parsed as unknown as readonly T[]) : [];
    },
    async replaceAll(rows: readonly T[]): Promise<void> {
      await store.setItem(key, JSON.stringify(rows));
    },
  };
}
