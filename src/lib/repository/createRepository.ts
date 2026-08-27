/**
 * The one place src/app/** gets a `RemyRepository` from. A lazily-created
 * module-level singleton — every screen shares the same instance (and
 * therefore the same in-process view of the data) rather than each
 * constructing its own AsyncStorage-backed store.
 *
 * `ensureSeeded()` is separate from `getAppRepository()` so a screen can
 * await preparation once, on mount, before any other screen reads — every
 * screen that touches the repository does (src/app/(tabs)/index.tsx,
 * recipes.tsx, cook/[mealId].tsx, settings.tsx, friends/add.tsx).
 *
 * THE STORE IS NOW ITS OWN SINGLETON, one level below the repository.
 * `migrateIdsToUuid` operates on the raw `KeyValueStore` — it rewrites
 * table keys the `RemyRepository` interface does not expose, including the
 * social repository's, which live in the same store (see that module's
 * header for why the two share one). Building the store inline inside
 * `getAppRepository` would have meant the migration constructing a SECOND
 * AsyncStorage adapter over the same underlying storage: harmless today
 * because the adapter is stateless, and exactly the kind of accidental
 * second instance that stops being harmless the first time anything
 * caches.
 *
 * WHY THE MIGRATION RUNS HERE, AND FIRST. Legacy ids
 * (`meal-lz8k2p-3-a9f2c1`) cannot be written to a Postgres `uuid` column,
 * so the write-through mirror has nothing valid to send until every row on
 * the device has been renumbered — see migrateIdsToUuid.ts's header. This
 * function is the only place the whole app funnels through before it reads
 * anything, which makes it the only place that can promise "no screen ever
 * sees a legacy id". It runs BEFORE `seedIfEmpty` for the plainest reason
 * available: seeding decides whether to write by counting households, and
 * it should count them in their final, migrated form.
 *
 * AND WHY THE MIRROR BACKFILL RUNS HERE TOO, IMMEDIATELY AFTER IT. The
 * write-through sink below only fires for writes that happen from now on.
 * Every meal, cook event and consent answer already on the device was
 * written before that wiring existed, has no outbox entry, and would never
 * get one — so it would never reach Postgres, and worse,
 * `hasPendingMealMirror` would answer `false` for it and let
 * src/lib/sendRecipe.ts open a door onto a meal with no rows on the other
 * side. `backfillMirrorOutbox` closes that, once, and it belongs in this
 * function for the migration's own reason: this is the one place the whole
 * app funnels through before it reads anything. See
 * `ensureSeeded` below for why its position in the chain is not
 * interchangeable with the migration's.
 *
 * `ensureSeeded` KEEPS ITS NAME even though it now does three things. Its
 * call sites are in five route modules other agents are editing this week,
 * and renaming an export across all of them to say "and also migrates, and
 * also backfills" buys nothing this header does not already say.
 *
 * Failures propagate, exactly as a failed seed already did. A migration
 * that could not write is not something to continue past quietly — doing
 * so would seed fresh uuid rows alongside half-renumbered legacy ones —
 * and because the migration is idempotent and its new ids are derived
 * rather than minted, the next launch simply resumes from wherever this
 * one stopped.
 */

import { supabase } from '@/lib/supabase';
import type { HouseholdSyncEnvironment } from '@/lib/householdSync';
import { createAsyncStorageKeyValueStore } from './asyncStorageKeyValueStore';
import type { KeyValueStore } from './keyValueStore';
import { backfillMirrorOutbox } from './backfillMirrorOutbox';
import { createLocalRepository, type MirrorJobSink } from './localRepository';
import { createMirrorOutbox, mirrorWriteThrough, type MirrorOutbox } from './mirror';
import { migrateIdsToUuid } from './migrateIdsToUuid';
import type { RemyRepository } from './types';

let store: KeyValueStore | null = null;

function getAppStore(): KeyValueStore {
  if (store === null) {
    store = createAsyncStorageKeyValueStore();
  }
  return store;
}

let outbox: MirrorOutbox | null = null;

/**
 * The write-through mirror's durable backlog, on the SAME store every
 * other table lives in — one `remy:` namespace, one thing to migrate, one
 * adapter. A singleton for `getAppStore`'s reason: two outboxes over one
 * storage key would each hold a stale copy of the other's list between a
 * read and a write.
 *
 * Exported because the directed send has to consult it before opening a
 * door onto a meal (`hasPendingMealMirror`, see src/lib/sendRecipe.ts).
 */
export function getAppMirrorOutbox(): MirrorOutbox {
  if (outbox === null) {
    outbox = createMirrorOutbox(getAppStore());
  }
  return outbox;
}

/**
 * The one place the local repository is joined to Postgres.
 *
 * THIS FILE IS WHERE THE SUPABASE CLIENT BELONGS AND localRepository.ts IS
 * NOT. That module is pure and local by construction — see its header —
 * and importing src/lib/supabase.ts there would drag a module that throws
 * at scope without env vars into every repository test. Here the client is
 * already a legitimate dependency, so the binding costs nothing that was
 * not already spent.
 *
 * NEVER AWAITED, AND ITS REJECTION IS HANDLED RATHER THAN VOIDED. The
 * local write has already returned by the time this runs; a `void` alone
 * would leave an escaped rejection as an unhandled one, which is a crash
 * caused by being offline. `mirrorWriteThrough` enqueues durably BEFORE it
 * attempts the request, so a job whose request never happens — or whose
 * process dies mid-flight — is still in the backlog for the next flush.
 *
 * THE CONSEQUENCE FOR THE BARREL, stated so nobody discovers it the hard
 * way: `@/lib/repository` now transitively requires EXPO_PUBLIC_SUPABASE_*
 * at import time. The app already did (the root layout pulls `useSession`,
 * which pulls the same client), and no test imports this file — every
 * suite in tests/repository/** constructs `createLocalRepository` or
 * `createRepositoryTables` directly. Keep it that way.
 */
const mirrorToPostgres: MirrorJobSink = (job) => {
  const settled = (): void => {};
  void mirrorWriteThrough(supabase, getAppMirrorOutbox(), job).then(settled, settled);
};

let singleton: RemyRepository | null = null;

export function getAppRepository(): RemyRepository {
  if (singleton === null) {
    singleton = createLocalRepository(getAppStore(), mirrorToPostgres);
  }
  return singleton;
}

/**
 * Everything src/lib/householdSync.ts needs, assembled from the singletons
 * above. Built here rather than in src/app/_layout.tsx because a route
 * module assembling four dependencies is four things a test cannot see.
 *
 * The repository is handed over whole and narrowed by the parameter type
 * to three reads — `HouseholdSyncRepository` is a `Pick`, so the bootstrap
 * structurally cannot write a meal.
 */
export function getAppHouseholdSyncEnvironment(): HouseholdSyncEnvironment {
  return {
    repository: getAppRepository(),
    ensureSeeded,
    client: supabase,
    outbox: getAppMirrorOutbox(),
  };
}

let prepared: Promise<void> | null = null;

/**
 * Renumbers stored ids to uuids, hands every already-stored row to the
 * mirror's outbox, then seeds a fresh install's single default household.
 * Idempotent in all three halves: safe to call from more than one screen's
 * mount effect, and safe to run on a store that has already been through
 * it.
 *
 * THE ORDER OF THE FIRST TWO IS LOAD-BEARING AND IS NOT AN ACCIDENT OF
 * WRITING. `backfillMirrorOutbox` enqueues rows exactly as they are stored,
 * and a job carrying a legacy id earns a 22P02 — which mirror/rows.ts
 * classifies as `rejected` and mirror/index.ts parks FOREVER, with the
 * added consequence that a parked meal entry makes `hasPendingMealMirror`
 * answer `true` for that meal for the rest of the install's life and
 * blocks every send of it. So the renumbering has to be finished before a
 * single job is queued. The backfill defends the same rule from its own
 * side (it refuses to enqueue a non-uuid id and refuses to mark itself
 * done while any remain), and tests/repository/mirrorBackfill.test.ts
 * asserts this chain's order directly, because an ordering that lives in
 * exactly one expression is one an edit can invert in silence.
 *
 * BOTH RUN BEFORE `seedIfEmpty`, which is the same reason the migration
 * always did: seeding decides whether to write by counting households, and
 * it should count them in their final, migrated form. It also keeps the
 * backfill honest about its own name — it carries rows that PREDATE the
 * mirror across, so a household this launch invented is none of its
 * business, and a fresh install completes the pass with nothing queued.
 */
export function ensureSeeded(): Promise<void> {
  if (prepared === null) {
    prepared = migrateIdsToUuid(getAppStore())
      .then(() => backfillMirrorOutbox(getAppStore()))
      .then(() => getAppRepository().seedIfEmpty());
  }
  return prepared;
}
