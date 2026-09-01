/**
 * The environment variables parse-recipe reads, and the two different
 * answers a missing one is allowed to get.
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
 * ---
 *
 * WHEN THROWING IS THE WRONG INSTRUMENT — `readOptionalEnvVar` below.
 *
 * The argument above is not about secrets in general; it is about a secret
 * the WHOLE function is useless without. Without `GEMINI_API_KEY` every
 * import of every platform fails, so a refusal to boot costs nothing that
 * was going to work anyway, and it is paid at deploy time by the person who
 * caused it rather than at 18:30 by someone holding a phone. Same for the
 * two Supabase credentials: no service role, no canonical cache, and the
 * degradation is invisible rather than loud.
 *
 * That reasoning does not survive contact with a credential exactly one
 * route needs. `YOUTUBE_API_KEY` is read by fetchSourceText.ts for the
 * Data API call and by nothing else in this function — so reading it with
 * the thrower above would take TikTok extraction, the JSON-LD web route
 * and the canonical cache down over a key none of them touch. That is not
 * a louder failure than the alternative, it is a WIDER one: the blast
 * radius of the refusal would exceed the blast radius of the thing that is
 * actually missing. "Fail loudly" is a rule about not hiding a problem,
 * not a licence to escalate one route's misconfiguration into an outage of
 * three.
 *
 * The honest alternative is emphatically NOT the empty-string default this
 * file already rejects. Returning `''` here would send an empty key header
 * to Google and surface its 400 as `not_found` — a misconfiguration
 * wearing the costume of "that video does not exist", which is the exact
 * class of lie the whole import pipeline is built to prevent. Returning
 * null instead makes the ABSENCE a value the caller has to answer for, and
 * fetchSourceText.ts answers it with `{ kind: 'source_fetch_failed',
 * reason: 'missing_credentials' }` — the same typed, honest shape
 * Instagram has always produced without its oEmbed token, and it says
 * precisely what is wrong. Blank and whitespace-only are treated as
 * absent for the same reason: a secret set to the empty string is not
 * configured, and the two must never be told apart by accident.
 *
 * The rule, then: THROW for a credential whose absence breaks everything;
 * return null for one whose absence breaks exactly one route, and make
 * that route say so out loud. Nothing here ever defaults quietly.
 *
 * (`INSTAGRAM_OEMBED_ACCESS_TOKEN` in index.ts predates this reader and
 * still uses a bare `Deno.env.get`. It is not an exception to the rule —
 * src/lib/oembed.ts performs the identical unset-or-blank check on the
 * token it is handed and returns `missing_credentials` itself, so the same
 * guarantee is already made one layer down. Rewriting that call site to
 * route through here would only move the check, and its `?? undefined`
 * would be pure noise against oembed.ts's optional-string config field.)
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

/**
 * A credential exactly one route needs, read so that its absence becomes a
 * value rather than an outage — see the file header for when this is the
 * right instrument and when it is the wrong one.
 *
 * Returns null for BOTH unset and blank/whitespace-only, deliberately
 * indistinguishable: a secret set to the empty string is not configured,
 * and a caller that could tell the two apart would only be tempted to
 * treat one of them as usable. The caller is responsible for turning this
 * null into a typed, user-visible failure — never for carrying on with an
 * empty key.
 */
export function readOptionalEnvVar(name: string): string | null {
  const value = Deno.env.get(name);
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  return value;
}
