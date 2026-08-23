/**
 * `KeyValueStore` (keyValueStore.ts) backed by
 * `@react-native-async-storage/async-storage`.
 *
 * Why AsyncStorage over expo-sqlite here: expo-sqlite's SDK 51 web support
 * runs on a WASM build (wa-sqlite) that needs cross-origin-isolation
 * headers (COOP/COEP) to use SharedArrayBuffer — headers a plain static
 * `expo export --platform web` bundle, served with no custom server, has
 * no way to set. The founder demos exactly that way. AsyncStorage has
 * shipped a plain `localStorage`-backed web implementation for years,
 * requires no headers, and needs no server at all — the safer choice when
 * "the demo must work in a browser" is non-negotiable. It also works
 * unchanged on iOS/Android via its native implementations, so this is the
 * ONE adapter every platform uses; no per-platform branching lives outside
 * this file. The relational shape SQLite would have given us for free is
 * not lost — it lives in the `RemyRepository` interface and the
 * table-per-key layout below (table.ts), which is exactly the seam that
 * makes a future Supabase swap mechanical regardless of what sits under
 * this adapter today.
 *
 * Every method here is a one-line delegation on purpose — the actual
 * querying/filtering logic lives in table.ts and localRepository.ts,
 * fully unit-tested against the in-memory KeyValueStore. This file is
 * deliberately too thin to need its own tests.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './keyValueStore';

export function createAsyncStorageKeyValueStore(): KeyValueStore {
  return {
    getItem: (key: string) => AsyncStorage.getItem(key),
    setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  };
}
