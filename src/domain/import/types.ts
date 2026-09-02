/**
 * Recipe Import domain types.
 *
 * The Feed (PD-007) is being removed; this is its replacement: a user
 * pastes a URL — a TikTok or Instagram Reel, a YouTube video, or an
 * ordinary recipe page — or pastes the recipe text itself, and we try to
 * turn it into a structured recipe.
 * See docs/PRODUCT-DECISIONS.md, especially PD-004 (a
 * saved/imported meal is measured on cook conversion, never dwell time —
 * still true here, we're just skipping the browsing step entirely) and
 * PD-006 (allergen tags are tri-state; see toMealDraft.ts for how that
 * guarantee is enforced for an AI-derived meal).
 *
 * ---
 *
 * The hard constraint every type in this family is designed around:
 *
 * FOR A VIDEO, ALL WE EVER GET IS TEXT SOMEONE TYPED. oEmbed
 * (src/lib/oembed.ts) returns a caption/title and an author name; the
 * YouTube Data API returns a title and a description. Nothing else — no
 * audio transcript, no on-screen text (OCR), no video file. Downloading
 * the video to extract audio or on-screen text would be a fundamentally
 * different, much larger legal exposure (redistributing a third party's
 * video content, not just reading metadata already offered via a
 * documented endpoint) and is deliberately OUT OF SCOPE here.
 *
 * research/12-prior-art.md identifies caption-only parsing
 * as the single most complained-about failure across this entire product
 * category (ReciMe, Flavorish, Pestle all fail the same way when a
 * creator speaks the recipe instead of typing it) — we inherit that
 * limitation, and this file's whole job is to make sure the failure is
 * always an honest, typed outcome rather than an empty or invented
 * recipe. See `ImportResult`'s `no_recipe_in_caption` variant
 * (importResult.ts) and the extraction prompt in
 * `buildExtractionRequest.ts`.
 *
 * THE PASTED-TEXT ROUTE (`'text'`) SIDESTEPS THAT CONSTRAINT FROM THE
 * OTHER END, and it is the newest thing in this file. It does not read
 * more of somebody's video; it reads exactly what the user handed over —
 * a recipe out of a WhatsApp message, an email, a cookbook copied out by
 * hand, a screenshot retyped. No oEmbed hop, no page GET, no URL at all.
 * That makes it the only route where the legal question above does not
 * arise: nothing of a third party's is fetched, and nothing is shown back
 * to anyone but the person who supplied it. It is also the only route
 * with NO CREATOR TO CREDIT — deliberately, and named as such rather than
 * left to fall out of whichever branch happened to skip attribution. See
 * `NO_CREATOR_TO_CREDIT` in buildAttribution.ts.
 *
 * THE `'web'` ROUTE IS THE ONE THAT ESCAPES THAT CONSTRAINT, and it is
 * worth being precise about why rather than treating it as "one more
 * platform". An ordinary recipe page publishes a schema.org/Recipe object
 * as JSON-LD because Google's rich results require it — a machine-readable
 * ingredient list and method, written by the publisher, keyed by name. No
 * model is asked to read prose and no model can invent a quantity, because
 * no model is involved. Its honest failure is therefore a different one:
 * `no_recipe_on_page`, "the page said nothing structured", rather than
 * `no_recipe_in_caption`, "the text we were given did not contain a
 * recipe".
 *
 * THAT DIFFERENCE IS NOW SOMETHING THE USER CAN SEE, not just something
 * this header explains to whoever reads it. `RecipeProvenance`
 * (importVocabulary.ts) is the same distinction made into a field on the
 * result: a recipe the publisher wrote down for machines, or a recipe a
 * model read out of prose written for people. It is deliberately one bit
 * and not a confidence number — see its own doc comment for why turning it
 * into a score would undo the honesty it exists to provide.
 * ---
 *
 * THIS FILE IS NOW AN INDEX, AND THE SPLIT IT INDEXES WAS NOT COSMETIC.
 *
 * Everything above stays here because it is the argument the whole family is
 * built on, and a reader who opens `types.ts` asking "what is this domain"
 * should meet it before meeting a single field. What moved out is the code:
 *
 *  - importVocabulary.ts — `ImportPlatform`, `RecipeProvenance`,
 *    `SourceFetchFailureReason`. The closed enumerations: which route the
 *    text came in by, what kind of reading produced the recipe, why the text
 *    never arrived. Words rather than shapes, and each one costs a copy
 *    layer, a telemetry vocabulary and sometimes a database column to widen.
 *  - parsedRecipe.ts — `ParsedIngredient`, `ParsedRecipe`. The dish itself:
 *    the only shapes here that would be equally true if the same recipe had
 *    arrived by some other route.
 *  - importAttribution.ts — `ImportAttribution`. A claim about a third
 *    party, which is what makes it neither content nor outcome, and the one
 *    shape in this family with somebody else's interest attached to it.
 *  - importResult.ts — `ImportResult`. The ten-variant answer, and two
 *    thirds of the length: the rule that every variant but one carries a
 *    `platform`, the rule that a field a producer knows for free is
 *    required, and the argument about where provenance may and may not
 *    live, are all made there.
 *
 * WHY SPLIT A FILE OF TYPES AT ALL, when types cost nothing at run time and
 * the compiler was perfectly happy. Because this file crossed the 800-line
 * ceiling this codebase holds itself to, and the honest way past a ceiling
 * is to find the seams the file already argues for — not to shorten the
 * arguments. Nothing here was summarised. Each doc comment travelled
 * unchanged with the type it documents; the only edits were cross-references
 * that used to say "above" or "below" and now have to name a file.
 *
 * WHY THIS FILE REMAINS THE ENTRY POINT rather than every caller being
 * repointed at the new modules. Forty-odd modules import from here: fourteen
 * siblings in this very folder, a screenful of screens, components and
 * tests, and a growing handful of Deno edge-function modules under
 * supabase/functions/parse-recipe/. That last group is what decided it. Deno
 * code is excluded from `tsc --noEmit`, from ESLint and from vitest, so a
 * specifier broken there is caught by nothing at all until a deploy fails.
 * So `types.ts` re-exports every name it exported before, spelled
 * identically, and not one importer had to change. That is the property that
 * made this refactor reviewable, and it is the property to preserve if the
 * family is ever split again: new code may import from the specific module
 * where that reads better, and nothing is ever obliged to.
 *
 * THE RE-EXPORTS ARE `export type`, AND THAT SPELLING IS DELIBERATE. A plain
 * `export { ... } from './x.ts'` would compile identically here and emit a
 * real runtime re-export for modules that have nothing to export at run
 * time — a value edge in the graph, resolved literally by Deno, standing for
 * files made entirely of erased types. `export type` guarantees the edge
 * stays erased; the `.ts` extension guarantees it would still resolve if it
 * ever stopped being.
 */

export type { ImportPlatform, RecipeProvenance, SourceFetchFailureReason } from './importVocabulary.ts';
export type { ParsedIngredient, ParsedRecipe } from './parsedRecipe.ts';
export type { ImportAttribution } from './importAttribution.ts';
export type { ImportResult } from './importResult.ts';
