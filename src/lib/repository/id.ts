/**
 * UUID minting and recognition for every row this app creates on-device.
 *
 * WHAT CHANGED, AND WHY IT HAD TO. This file used to mint
 * `meal-lz8k2p-3-a9f2c1` — a prefix, a base36 clock reading, a counter and
 * six random characters — and its old header argued that shape was fine
 * because "every `*Id` type in src/domain/types.ts is a plain `string`
 * alias, so callers never assume a particular id shape". That was true of
 * the CALLERS and false of the DESTINATION. Every id column in
 * supabase/migrations/0001_init.sql onwards is `uuid`, not `text`, so a
 * row carrying a legacy id cannot be inserted at all: Postgres rejects it
 * at parse time, before any policy or constraint is consulted. The old
 * header's escape hatch — "once a meal is written to the real backend its
 * id becomes a server-generated uuid" — assumed the server would mint the
 * identity. The owner's decision is write-through: local stays the read
 * path and the LOCAL id is the one that travels. So the id this file mints
 * has to be a uuid on the device, from the first row, or the mirror has
 * nothing valid to send.
 *
 * WHERE THE RANDOMNESS COMES FROM, IN ORDER, AND WHY NO NEW DEPENDENCY.
 * React Native has no single guaranteed source, so the two functions below
 * try three in descending order of quality:
 *
 *   1. `crypto.randomUUID()` — present on web (all current browsers), on
 *      Node (the vitest environment), and on any runtime that has already
 *      polyfilled Web Crypto. Returned verbatim; it is already RFC 4122.
 *   2. `crypto.getRandomValues()` — the CSPRNG without the convenience
 *      wrapper. Present wherever a polyfill (react-native-get-random-values,
 *      expo-crypto's global install, a client library's own environment
 *      shims) has run, which is common and cannot be relied on.
 *   3. `Math.random()` — Hermes with nothing polyfilled at all.
 *
 * REJECTED: adding `expo-crypto` (or `react-native-get-random-values`) to
 * package.json to make step 1 unconditional. Both are native modules on an
 * SDK 51 app: adding one obliges every developer and every CI lane to
 * rebuild the dev client before the JS bundle will even load, and two
 * other agents are editing this tree right now. The cost is real and the
 * benefit is not, because of what these ids ARE: row identifiers, never
 * secrets. Nothing in this codebase treats an id as a bearer token — a
 * directed send is authorised by a `recipe_shares` ROW (0009), a rating is
 * world-readable by design (PD-014), and household data is gated by
 * `is_household_member`, not by whether you can guess a uuid. So the
 * property that matters is COLLISION resistance, not unpredictability, and
 * Hermes's `Math.random` (xorshift128+, seeded per process) leaves
 * collision odds negligible across the number of rows a household could
 * plausibly ever create. The day an id does become a capability, this
 * comment is the thing that has to be revisited, and making step 1
 * unconditional is the fix.
 *
 * WHAT HAPPENED TO THE PREFIX. It is GONE from the value, and it had to
 * be: `meal-<uuid>` does not parse as a `uuid` column any better than the
 * old format did, so keeping it would defeat the entire point. The
 * parameter survives on `generateLocalId` so its call sites and their
 * tests keep compiling and keep reading as documentation
 * (`generateLocalId('cook-event')` still says what kind of row is being
 * born), but nothing consumes it.
 *
 * NOTHING OF VALUE WAS LOST WITH IT, and that is a claim from the code
 * rather than a hope: no file anywhere parses, splits, matches or
 * dispatches on an id prefix (`grep` for `startsWith('meal-` and
 * `.split('-')` across src/ and tests/ returns nothing). Its only use was
 * eyeballing raw AsyncStorage JSON, and that information is still fully
 * present there twice over — every row lives under a key that names its
 * table (`remy:cook_events`, local/tables.ts) and every reference is
 * spelled by a field that names its target (`mealId`, `decisionId`). The
 * prefix was a third copy of a fact the storage layout already states, and
 * it was the only copy a `uuid` column could not hold.
 */

/**
 * Deliberately NOT version-specific. `[1-5]` in the version nibble would
 * reject a perfectly valid id minted elsewhere — a Supabase v7 default, a
 * hand-written test uuid — and the only question this predicate is ever
 * asked is "can Postgres store this as-is", whose answer is yes for any
 * 8-4-4-4-12 hex string. Case-insensitive for the same reason: Postgres
 * normalises `A1B2...` to lowercase on input rather than refusing it, so
 * an uppercase id is already migrated and must not be renumbered.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Takes `unknown` rather than `string` on purpose: its callers are the
 * migration (migrateIdsToUuid.ts), which reads untyped values straight out
 * of persisted JSON, and tests. A `typeof` check inside is one line; the
 * same check repeated at every call site is a line each and one of them
 * eventually gets forgotten.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

interface RandomSource {
  readonly randomUUID?: () => string;
  readonly getRandomValues?: (array: Uint8Array) => Uint8Array;
}

/**
 * Read through `globalThis` and structurally typed rather than relying on
 * the ambient DOM `crypto`: this project's tsconfig extends
 * expo/tsconfig.base, whose lib set is not guaranteed to declare Web
 * Crypto, and the whole point here is that the object may be absent at
 * RUNTIME. Typing it as definitely-there would turn a supported fallback
 * path into a compile-time fiction.
 */
function randomSource(): RandomSource | null {
  const candidate = (globalThis as { crypto?: unknown }).crypto;
  return typeof candidate === 'object' && candidate !== null ? (candidate as RandomSource) : null;
}

const UUID_BYTE_LENGTH = 16;
const BYTE_MAX_EXCLUSIVE = 256;

function fallbackRandomBytes(): readonly number[] {
  return Array.from({ length: UUID_BYTE_LENGTH }, () => Math.floor(Math.random() * BYTE_MAX_EXCLUSIVE));
}

function randomBytes(): readonly number[] {
  const source = randomSource();
  if (source === null || typeof source.getRandomValues !== 'function') {
    return fallbackRandomBytes();
  }
  try {
    return Array.from(source.getRandomValues(new Uint8Array(UUID_BYTE_LENGTH)));
  } catch {
    // A polyfill that exists but refuses (some throw when the platform
    // entropy pool is unavailable) is not a reason to fail a write. The
    // fallback is weaker, never absent.
    return fallbackRandomBytes();
  }
}

const VERSION_BYTE_INDEX = 6;
const VARIANT_BYTE_INDEX = 8;

/**
 * Formats 16 bytes as a canonical RFC 4122 version-4 uuid.
 *
 * The two fixed nibbles are applied HERE rather than by the caller so that
 * every producer in this codebase — the random mint below and the
 * migration's deterministic derivation — is incapable of emitting a string
 * that reads as some other uuid version. Written as a fresh array rather
 * than by mutating the input, so a caller's buffer is never altered
 * underneath it.
 */
export function formatUuidV4(bytes: readonly number[]): string {
  const hex = Array.from({ length: UUID_BYTE_LENGTH }, (_unused, index) => {
    const byte = bytes[index] ?? 0;
    if (index === VERSION_BYTE_INDEX) {
      return ((byte & 0x0f) | 0x40).toString(16).padStart(2, '0');
    }
    if (index === VARIANT_BYTE_INDEX) {
      return ((byte & 0x3f) | 0x80).toString(16).padStart(2, '0');
    }
    return (byte & 0xff).toString(16).padStart(2, '0');
  }).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A fresh random uuid — the honest name for what `generateLocalId` does. */
export function generateUuid(): string {
  const source = randomSource();
  if (source !== null && typeof source.randomUUID === 'function') {
    try {
      return source.randomUUID();
    } catch {
      // Some browsers expose `randomUUID` but throw outside a secure
      // context. Fall through to the byte-level path rather than crashing
      // a save.
    }
  }
  return formatUuidV4(randomBytes());
}

/**
 * The name every write path in src/lib/repository/** still calls. Kept as
 * a one-line alias rather than renamed across its call sites, several of
 * them in files other agents are editing this week; the `prefix` argument
 * is retained for the same reason and is documentation only — see this
 * file's header for why it can no longer travel inside the value.
 */
export function generateLocalId(_prefix: string): string {
  return generateUuid();
}
