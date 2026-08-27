/**
 * The one-time, on-launch renumbering of every locally-minted id to a real
 * uuid — "omnummeren en meenemen", the owner's words: renumber and carry
 * along, never wipe.
 *
 * WHY THIS EXISTS. id.ts used to mint `meal-lz8k2p-3-a9f2c1`. Every id
 * column in supabase/migrations/** is `uuid`, so a row carrying that
 * string cannot be inserted at all — Postgres refuses it while parsing,
 * before any policy runs. id.ts now mints uuids, which fixes every row
 * created from here on and does nothing whatsoever for the rows already
 * sitting in AsyncStorage on the owner's phone. Those are real recipes,
 * real cook history, real saves. This module is the half that carries them
 * across.
 *
 * REJECTED: clearing storage and re-seeding. It is one line, it is
 * obviously idempotent, and it deletes the owner's library. Not a
 * candidate; it is written down only so nobody re-proposes it as "the
 * simple option".
 *
 * REJECTED: widening the Postgres columns to `text` so the legacy ids
 * travel unchanged. It spreads a device-local id format across ten tables,
 * every foreign key and every future join, to avoid one migration that
 * runs once.
 *
 * ── THE HARD PART IS NOT RENAMING. IT IS NOT ORPHANING. ────────────────
 *
 * A cook event points at a meal. A save points at a meal AND a member AND
 * a household. A decision points at TWO meals (`mealId` and
 * `initialMealId` — see its comment in src/domain/types.ts: collapsing
 * them would destroy Plan §8's headline metric). A directed send
 * (`remy:recipe_shares`, owned by the social repository) points at a local
 * meal too. Renumber the meals table and stop there and every one of those
 * becomes a pointer to nothing — silently, with no crash, on a device
 * whose data cannot be re-fetched from anywhere.
 *
 * AsyncStorage gives one key at a time and no transaction, so the rewrite
 * is genuinely N separate writes and a process kill can land between any
 * two of them. Three ways to survive that were considered:
 *
 *   (a) A JOURNAL: compute the whole old→new plan, persist it to its own
 *       key FIRST, then rewrite tables, then clear it. Standard, and it
 *       works — but the plan becomes a load-bearing artifact that must
 *       itself never be lost or corrupted. Lose it half way and there is
 *       no way back: the meals table already holds new uuids, so
 *       recomputing a plan from "which ids are still legacy" cannot learn
 *       what `meal-lz8k2p-5-…` became, and the cook events pointing at it
 *       are orphaned permanently.
 *
 *   (b) A PERSISTED MAP that grows as it goes, written before each table
 *       it is used for. Same artifact, same fragility, plus a permanent
 *       key full of dead ids and a strict write-ordering discipline that
 *       a later edit can break without any test noticing.
 *
 *   (c) DERIVING the new id from the old one — what this module does.
 *       `deriveUuidFromLegacyId` is a pure function, so `meal-lz8k2p-5-…`
 *       maps to the same uuid in every table, in every run, on every
 *       device, with nothing persisted in between. That single property
 *       replaces the transaction: any subset of tables may be rewritten
 *       and the next run finishes the rest, computing exactly the values
 *       the interrupted run computed. There is no plan to lose, no
 *       ordering to get wrong, and no state that can disagree with the
 *       data.
 *
 * The same property is what makes this idempotent in the required sense:
 * "already migrated" is decided by `isUuid(value)` — the SHAPE of the
 * value in front of us — never by a flag. Run it twice and the second run
 * finds uuids everywhere, changes nothing and writes nothing. Run it on a
 * store where half the rows were migrated by an older build and only the
 * other half move.
 *
 * ── WHY THE MAPPING IS PER-VALUE AND NOT PER-TABLE ─────────────────────
 *
 * Because the derivation is global, this module needs no foreign-key
 * graph: it never has to know that `cook_events.mealId` points into
 * `meals`, only that it holds a LOCAL id. `derive(x)` is the same answer
 * everywhere, so the reference lands on its row by construction. That
 * removes the whole class of bug where the graph says `saves.mealId ->
 * meals` and a typo sends it to `members`. What the table list below still
 * has to get right is narrower and much easier to check: which fields hold
 * an id this device minted, and which hold somebody else's.
 *
 * ── WHICH IDS ARE NOT OURS TO RENAME ───────────────────────────────────
 *
 * Renumbering a foreign id is worse than leaving a legacy one, because it
 * fails silently instead of loudly: the value stays a perfectly valid
 * uuid and simply stops matching the row it named. Four are deliberately
 * untouched, and none of them are minted here:
 *
 *   - `household_members.authUserId` -> `auth.users.id`. Supabase owns
 *     accounts; this app does not get to rename one.
 *   - `meals.recipeId` -> the canonical `recipes` row (0006). Set only
 *     from an import response (`ImportResult.recipeId`), i.e. already a
 *     server uuid. It is the join that makes cook proof work at all —
 *     "we are talking about the same recipe" (see meals.ts's header) — so
 *     rewriting it would unhook every friend's proof from every copy.
 *   - `profiles.id`, and every `*ProfileId` beside it. `UpsertProfileInput`
 *     says it outright: "supplied by the caller, never generated here — a
 *     profile is an existing account's public face". `remy:profiles` is
 *     therefore listed in `TABLES_WITHOUT_LOCAL_IDS` rather than omitted,
 *     so the coverage test can tell "considered and excluded" from
 *     "forgotten".
 *   - `recipe_ratings.recipeId` -> the same canonical `recipes` row.
 *
 * ── WHY THE SOCIAL TABLES ARE IN HERE ──────────────────────────────────
 *
 * src/lib/repository/social/** is another agent's directory and this
 * module does not edit a line of it. But both repositories are built over
 * ONE `KeyValueStore` (localSocialRepository.ts says so in its
 * `SocialTables` comment, and reads `remy:meals` directly), and
 * `recipe_shares.mealId` is a reference INTO the meals table this module
 * renumbers. Skipping those keys on directory-ownership grounds would
 * orphan every directed send the moment this runs. Their own ids
 * (`friendships.id`, `recipe_ratings.id`, `recipe_shares.id`) are minted
 * by `generateLocalId` exactly like a meal's, so they are ours to
 * renumber too.
 *
 * ── THE VERSION STAMP IS A RECORD, NOT A GATE ──────────────────────────
 *
 * `remy:schema_version` is written after a completed pass and read by
 * `readStoreSchemaVersion`. It is deliberately NOT consulted to decide
 * whether to run: a stamp can be written by a build whose table writes
 * then failed, or restored from a backup taken mid-migration, and a
 * migration that trusts it would skip a store that still needs it. The
 * shape of the data cannot lie about itself in that way, so the shape
 * decides and the stamp merely records. Its job is the NEXT migration —
 * one that is not idempotent, or that does drop something — which will
 * need to know what it is looking at before it touches anything. It is
 * also never written backwards, so a store stamped by a future build
 * survives a downgrade unrecorded rather than mislabelled.
 */

import { formatUuidV4, isUuid } from './id';
import type { KeyValueStore } from './keyValueStore';

/** Where the stamp lives. `remy:`-prefixed like every table key (local/tables.ts). */
export const SCHEMA_VERSION_KEY = 'remy:schema_version';

/** Bumped by the NEXT migration, never by an edit to this one. */
export const STORE_SCHEMA_VERSION = 1;

/** What an unstamped — or unreadable — store reports. */
const UNSTAMPED_SCHEMA_VERSION = 0;

export interface LocalIdTable {
  /** The `KeyValueStore` key this table is stored under. */
  readonly key: string;
  /**
   * Fields on each row that hold an id THIS DEVICE minted — its own `id`
   * plus every reference to another local row. Fields holding a
   * server-owned id are absent on purpose; see this file's header.
   */
  readonly idFields: readonly string[];
}

/**
 * Every table whose rows carry at least one locally-minted id, derived
 * field by field from src/domain/types.ts and the modules that write them
 * (src/lib/repository/local/*.ts, and localSocialRepository.ts for the
 * last three).
 */
export const LOCAL_ID_TABLES: readonly LocalIdTable[] = [
  { key: 'remy:households', idFields: ['id'] },
  // `authUserId` is `auth.users.id` and is deliberately absent.
  { key: 'remy:household_members', idFields: ['id', 'householdId'] },
  { key: 'remy:member_restrictions', idFields: ['id', 'memberId'] },
  // `householdId` is nullable here — null means curated, visible to every
  // household — and `recipeId` points at the canonical `recipes` row, so
  // it is deliberately absent.
  { key: 'remy:meals', idFields: ['id', 'householdId'] },
  { key: 'remy:meal_ingredients', idFields: ['id', 'mealId'] },
  { key: 'remy:meal_steps', idFields: ['id', 'mealId'] },
  { key: 'remy:saves', idFields: ['id', 'householdId', 'memberId', 'mealId'] },
  { key: 'remy:cook_events', idFields: ['id', 'householdId', 'mealId', 'decisionId'] },
  // Both meal references, and they must stay two distinct rows.
  { key: 'remy:decisions', idFields: ['id', 'householdId', 'mealId', 'initialMealId'] },
  // Social, and only their own ids: requester/addressee/blockedBy are profiles.
  { key: 'remy:friendships', idFields: ['id'] },
  { key: 'remy:recipe_ratings', idFields: ['id'] },
  // The one social row that references a local meal.
  { key: 'remy:recipe_shares', idFields: ['id', 'mealId'] },
];

/**
 * Named rather than omitted, so "we looked at this and it has nothing of
 * ours in it" is a statement the coverage test can check, and a new table
 * that nobody classified fails that test instead of quietly missing out.
 */
export const TABLES_WITHOUT_LOCAL_IDS: readonly string[] = ['remy:profiles'];

export interface IdMigrationResult {
  /** Keys actually written. Empty on a store that needed nothing. */
  readonly rewrittenTables: readonly string[];
  /** How many rows had at least one id rewritten. */
  readonly remappedRowCount: number;
}

// ---------------------------------------------------------------------------
// Deriving the new id from the old one
// ---------------------------------------------------------------------------

/**
 * MurmurHash3 (32-bit), the standard implementation, used four times with
 * four different seeds to fill a 128-bit uuid.
 *
 * REJECTED: uuid v5, the RFC's own name-based scheme, which is exactly
 * this idea done properly. It is defined over SHA-1, and there is no SHA-1
 * in this runtime — implementing one to name some rows would be far more
 * code, and far more code to get subtly wrong, than the collision
 * resistance question actually demands.
 *
 * REJECTED: a single 32-bit hash stretched over 16 bytes. That is 32 bits
 * of distinct values, which collides in practice at a few tens of
 * thousands of rows.
 *
 * The bar here is modest and worth stating plainly: the input set is one
 * household's ids — thousands, not billions — and every one of them is
 * already unique, so all that is required is that the mapping stay
 * injective over that set. Murmur3's avalanche is far more than enough,
 * and four independent seeds mean a collision needs all four 32-bit hashes
 * to collide at once.
 *
 * The result is SHAPED as a v4 uuid by `formatUuidV4` (version and variant
 * nibbles set) because that is what makes it storable and recognisable
 * everywhere, but it is derived, not random. That is the whole point — see
 * this file's header on why determinism replaces the transaction — and it
 * is safe to say out loud because these ids are row names, not secrets.
 */
const MURMUR_C1 = 0xcc9e2d51;
const MURMUR_C2 = 0x1b873593;

function rotateLeft32(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function scrambleBlock(block: number): number {
  return Math.imul(rotateLeft32(Math.imul(block, MURMUR_C1) >>> 0, 15), MURMUR_C2) >>> 0;
}

function finalMix32(value: number): number {
  const a = (value ^ (value >>> 16)) >>> 0;
  const b = Math.imul(a, 0x85ebca6b) >>> 0;
  const c = (b ^ (b >>> 13)) >>> 0;
  const d = Math.imul(c, 0xc2b2ae35) >>> 0;
  return (d ^ (d >>> 16)) >>> 0;
}

/**
 * Two bytes per UTF-16 code unit rather than a UTF-8 encode: `TextEncoder`
 * is not guaranteed on Hermes, and this only has to be INJECTIVE (distinct
 * strings produce distinct byte sequences), which splitting each code unit
 * into low and high byte trivially is. Legacy ids are ASCII anyway; this
 * just means an unexpected character cannot silently fold onto another.
 */
function toBytes(value: string): readonly number[] {
  return Array.from({ length: value.length * 2 }, (_unused, index) => {
    const code = value.charCodeAt(index >> 1);
    return (index % 2 === 0 ? code : code >>> 8) & 0xff;
  });
}

function murmur3(bytes: readonly number[], seed: number): number {
  const blockCount = bytes.length >>> 2;
  let hash = seed >>> 0;

  for (let block = 0; block < blockCount; block += 1) {
    const at = block * 4;
    const word =
      ((bytes[at] ?? 0) |
        ((bytes[at + 1] ?? 0) << 8) |
        ((bytes[at + 2] ?? 0) << 16) |
        ((bytes[at + 3] ?? 0) << 24)) >>>
      0;
    hash = (hash ^ scrambleBlock(word)) >>> 0;
    hash = rotateLeft32(hash, 13);
    hash = (Math.imul(hash, 5) + 0xe6546b64) >>> 0;
  }

  const tailAt = blockCount * 4;
  const tailLength = bytes.length - tailAt;
  if (tailLength > 0) {
    const tail =
      ((bytes[tailAt] ?? 0) |
        (tailLength > 1 ? (bytes[tailAt + 1] ?? 0) << 8 : 0) |
        (tailLength > 2 ? (bytes[tailAt + 2] ?? 0) << 16 : 0)) >>>
      0;
    hash = (hash ^ scrambleBlock(tail)) >>> 0;
  }

  return finalMix32((hash ^ bytes.length) >>> 0);
}

/** Four arbitrary, fixed, well-separated seeds. Changing one re-numbers every device again — don't. */
const DERIVATION_SEEDS: readonly number[] = [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f];

/**
 * The pure old-id -> new-id function the whole crash-safety argument rests
 * on. Exported so a future migration, a debugging session, or a support
 * question ("what did this meal become?") can answer without the device.
 */
export function deriveUuidFromLegacyId(legacyId: string): string {
  const bytes = toBytes(legacyId);
  const uuidBytes = DERIVATION_SEEDS.flatMap((seed) => {
    const word = murmur3(bytes, seed);
    return [(word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff];
  });
  return formatUuidV4(uuidBytes);
}

// ---------------------------------------------------------------------------
// Rewriting the store
// ---------------------------------------------------------------------------

type StoredRow = Record<string, unknown>;

/**
 * Deliberately NOT `createTableAccessor` (table.ts), even though it parses
 * the same JSON defensively. Two reasons, both about not losing data: its
 * `list()` degrades corrupt storage to `[]`, and its `replaceAll()` writes
 * unconditionally — so the pair would happily overwrite a table this
 * module could not read with an empty array. Reading raw lets a table that
 * cannot be parsed be left EXACTLY as it is, which is the only honest
 * thing to do with bytes we do not understand and cannot re-fetch.
 *
 * The row test matches table.ts's `isPlainObjectArray` so both layers
 * agree on what counts as a table.
 */
function parseRows(raw: string): readonly StoredRow[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }
  return parsed.every((entry) => typeof entry === 'object' && entry !== null)
    ? (parsed as readonly StoredRow[])
    : null;
}

/**
 * Returns the same row object when nothing needs changing — reference
 * equality is how the caller counts what moved, and how an untouched table
 * avoids a pointless write.
 *
 * A field is remapped only when it holds a NON-UUID STRING. That single
 * condition covers every case correctly: `null` (a curated meal's
 * household, a save with no member, a cook event outside the decision
 * flow) stays null; an absent optional key stays absent rather than being
 * invented as `undefined`; a row already carrying a uuid is left alone;
 * and a corrupt non-string value is left for a human rather than coerced.
 */
function remapRow(row: StoredRow, idFields: readonly string[]): StoredRow {
  const patch = idFields.reduce<Record<string, string>>((accumulated, field) => {
    const value = row[field];
    if (typeof value !== 'string' || isUuid(value)) {
      return accumulated;
    }
    return { ...accumulated, [field]: deriveUuidFromLegacyId(value) };
  }, {});

  return Object.keys(patch).length === 0 ? row : { ...row, ...patch };
}

async function migrateTable(store: KeyValueStore, table: LocalIdTable): Promise<number> {
  const raw = await store.getItem(table.key);
  if (raw === null) {
    // Never written on this device. Writing `[]` here would invent a table
    // the app has so far correctly treated as absent.
    return 0;
  }

  const rows = parseRows(raw);
  if (rows === null) {
    return 0;
  }

  const next = rows.map((row) => remapRow(row, table.idFields));
  const remapped = next.reduce((count, row, index) => (row === rows[index] ? count : count + 1), 0);
  if (remapped === 0) {
    return 0;
  }

  await store.setItem(table.key, JSON.stringify(next));
  return remapped;
}

export async function readStoreSchemaVersion(store: KeyValueStore): Promise<number> {
  const raw = await store.getItem(SCHEMA_VERSION_KEY);
  if (raw === null) {
    return UNSTAMPED_SCHEMA_VERSION;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : UNSTAMPED_SCHEMA_VERSION;
}

async function stampSchemaVersion(store: KeyValueStore): Promise<void> {
  const stored = await readStoreSchemaVersion(store);
  if (stored >= STORE_SCHEMA_VERSION) {
    // Already at or beyond this version. Not writing keeps a completed
    // store byte-identical across launches, which is what lets the
    // "second run performs no writes at all" guarantee be tested rather
    // than merely asserted.
    return;
  }
  await store.setItem(SCHEMA_VERSION_KEY, String(STORE_SCHEMA_VERSION));
}

/**
 * Renumbers every locally-minted id in `store` to a uuid, repointing every
 * reference, and stamps the schema version.
 *
 * Tables are handled ONE AT A TIME rather than with `Promise.all`. The
 * concurrency would buy nothing on a store this size, and sequential
 * writes give a failure a comprehensible meaning: everything before the
 * throw is durably rewritten, everything after is untouched, and the next
 * launch continues from there with identical derived ids. The stamp is
 * written LAST so an interrupted run is never recorded as a finished one.
 *
 * Errors propagate. A store that cannot be written is not a condition to
 * paper over by carrying on and seeding fresh rows next to half-migrated
 * ones; the caller (createRepository.ts's `ensureSeeded`) surfaces it the
 * same way it already surfaces a failed seed, and the next launch retries
 * from wherever this one stopped.
 */
export async function migrateIdsToUuid(store: KeyValueStore): Promise<IdMigrationResult> {
  const rewrittenTables: string[] = [];
  let remappedRowCount = 0;

  for (const table of LOCAL_ID_TABLES) {
    const remapped = await migrateTable(store, table);
    if (remapped > 0) {
      rewrittenTables.push(table.key);
      remappedRowCount += remapped;
    }
  }

  await stampSchemaVersion(store);

  return { rewrittenTables, remappedRowCount };
}
