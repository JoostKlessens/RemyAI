/**
 * The one place src/app/** gets a `RemyRepository` from. A lazily-created
 * module-level singleton — every screen shares the same instance (and
 * therefore the same in-process view of the data) rather than each
 * constructing its own AsyncStorage-backed store.
 *
 * `ensureSeeded()` is separate from `getAppRepository()` so a screen can
 * await seeding once (e.g. the root layout, on mount) before any other
 * screen reads — see src/app/_layout.tsx.
 */

import { createAsyncStorageKeyValueStore } from './asyncStorageKeyValueStore';
import { createLocalRepository } from './localRepository';
import type { RemyRepository } from './types';

let singleton: RemyRepository | null = null;

export function getAppRepository(): RemyRepository {
  if (singleton === null) {
    singleton = createLocalRepository(createAsyncStorageKeyValueStore());
  }
  return singleton;
}

let seeded: Promise<void> | null = null;

/** Idempotent: safe to call from more than one screen's mount effect. */
export function ensureSeeded(): Promise<void> {
  if (seeded === null) {
    seeded = getAppRepository().seedIfEmpty();
  }
  return seeded;
}
