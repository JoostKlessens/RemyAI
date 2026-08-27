/**
 * The environment variables parse-recipe cannot start without, read the one
 * way that fails loudly.
 *
 * WHY THIS IS A MODULE RATHER THAN A HELPER INSIDE index.ts. The credentials
 * it reads no longer belong to one file: `GEMINI_API_KEY` is index.ts's, and
 * `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` belong to
 * canonicalRecipeStore.ts, which is the only writer of the canonical tables.
 * Exporting the reader from either of those would make one import the other
 * for a nine-line utility, and index.ts already imports the store — a cycle
 * in a Deno module graph bought for nothing. A module both can depend on and
 * neither owns is the smaller thing. The rejected alternative was a second
 * copy of the function in the store; two readers is how one of them quietly
 * stops throwing.
 *
 * WHY IT THROWS RATHER THAN RETURNING A DEFAULT. Same posture as
 * src/lib/supabase.ts's reader. A function that boots without a key does not
 * stop working — it silently degrades: no extraction at all, or (worse,
 * because the canonical cache is deliberately best-effort everywhere else)
 * never deduplicating anything while every import quietly pays full oEmbed
 * and LLM cost. That is the kind of expensive non-failure nobody notices for
 * a month. Refusing to boot is noticed immediately, at deploy time, by the
 * person who caused it. A `console.error` plus an empty-string default was
 * considered and rejected: that is the silent degradation above, wearing a
 * log line.
 *
 * The `.ts` extension importers must spell out here is not optional — see
 * index.ts's header for the Deno resolution rule that makes it load-bearing.
 */

// Minimal ambient declaration for the one Deno global this module uses — see
// index.ts's own copy for why this is not a full `deno.d.ts`.
declare const Deno: {
  readonly env: { readonly get: (name: string) => string | undefined };
};

export function readRequiredEnvVar(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `parse-recipe cannot start: missing required environment variable "${name}". ` +
        'Set it with `supabase secrets set` before deploying this function.',
    );
  }
  return value;
}
