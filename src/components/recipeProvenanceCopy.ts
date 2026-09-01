/**
 * RCP-06 — what an imported recipe's PROVENANCE says, in Dutch, for every
 * `RecipeProvenance` (src/domain/import/types.ts). Pure, no React Native
 * imports, so it runs directly under vitest's `node` environment: the same
 * rule every sibling `*Copy.ts` in this directory states for itself (see
 * importFailureCopy.ts, importCreatorCopy.ts). A Dutch sentence written
 * inside a `.tsx` is a sentence nothing can assert, and this one is a
 * claim about where a recipe came from.
 *
 * WHY THE CONFIRMATION SCREEN NEEDS THIS AT ALL. Two import routes arrive
 * at that screen by fundamentally different means and produce a
 * `ParsedRecipe` that looks identical once it is there. An ordinary recipe
 * page publishes a schema.org/Recipe object: the publisher typed the
 * ingredient list and the method into named keys, and Remy read those keys.
 * A TikTok or YouTube import has no such object — there is a caption
 * somebody wrote for a different purpose, and a model worked a recipe out
 * of the prose. Those are not the same kind of fact, and the person on that
 * screen is about to decide whether to cook from it. Telling them which one
 * they are looking at, before they commit, is the whole of RCP-06.
 *
 * THIS IS A FACT, NOT A SCORE, AND THE SHAPE OF THE COPY IS WHAT ENFORCES
 * THAT. No percentage, no stars, no "betrouwbaarheid: hoog", nothing a
 * reader can put in order. The moment provenance is rendered as a level,
 * every caption import reads as a damaged version of a web import — which
 * is false, and which would teach people to distrust the route that
 * produces most of their recipes.
 *
 * WHICH IS ALSO WHY BOTH VALUES RENDER, in the same place, at the same
 * weight, differing only in their words. Rendering the caption note alone
 * and staying silent on the structured one was the obvious cheaper option
 * and was rejected: present-versus-absent IS a two-point scale, and a
 * cruder one than a number, because the reader infers "a note means
 * something is wrong with this one" without ever being told what. Silence
 * is only legible to someone who has already seen the other case; a first
 * import has no baseline to read an absence against. Two lines that both
 * state something make "where did this come from" a question the screen
 * answers, rather than a warning it sometimes issues.
 *
 * The second half of that: neither note may be dressed differently. Same
 * container, same typography, same position — see RecipeProvenanceNote.tsx,
 * which is given no variant to switch on precisely so it cannot grow one.
 *
 * THE CAPTION NOTE IS NOT AN APOLOGY. Reading a caption is the normal path
 * for TikTok and YouTube and it works; it is not a fallback and nothing
 * broke. `display_only`'s copy in importFailureCopy.ts is the tone to match
 * — state the situation plainly, name what it means for the reader, never
 * sound broken. What it must be honest about is narrow and real: prose is
 * not a list, so a quantity or a step can be missing or read differently
 * than it was meant, and the original is worth a glance before cooking.
 *
 * THE STRUCTURED NOTE IS NOT A BOAST for the mirror-image reason. "Remy
 * las dit foutloos" would be selling, and it would make the other note the
 * confession it must never be. It states the mechanism and stops:
 * the publisher wrote these fields, so this is their list, not our reading
 * of one.
 *
 * ---
 *
 * THE SECOND EXPORT, AND WHY IT IS IN THIS FILE RATHER THAN A SIBLING.
 * `buildImportConfirmGuidance` owns the confirmation screen's subtitle and
 * its two field helper texts. Those look like screen chrome and are not:
 * "Overgenomen uit het bijschrift van de video" is a PROVENANCE CLAIM, and
 * it was a false one the moment the web route landed — every recipe-page
 * import told its reader it had been lifted from a video's caption, and
 * once the note above shipped, the screen said both things a few pixels
 * apart. A screen that contradicts itself about where a recipe came from is
 * worse than one that never mentioned it.
 *
 * Two modules could each state that fact correctly today and drift apart
 * by the next change; that drift is the whole bug, not a hypothetical. So
 * one module answers "where did this recipe come from" for this screen, in
 * every voice the screen uses, and a contradiction has to be written twice
 * in the same file to survive review.
 *
 * IT TAKES `mode` AS WELL AS `provenance`, because those are two different
 * questions and only one of them is provenance's. `mode: 'manual'` is a
 * recipe the user is typing — there is nothing to have come from anywhere.
 * `mode: 'parsed'` with a null provenance is a different state entirely: a
 * recipe DID come from somewhere and we do not know where, which is what
 * `readProvenance` (src/app/import/routeParams.ts) produces for a payload
 * from a build newer than this one. Collapsing the two would either have
 * an imported recipe claim the user typed it, or have a typed recipe claim
 * an origin. The union `'parsed' | 'manual'` is spelled out here rather
 * than imported from that route module, so a component-layer copy file
 * does not take a dependency on an app route.
 *
 * THE SUBTITLE STOPPED NAMING THE ORIGIN ALTOGETHER, AND THAT IS THE
 * ACTUAL FIX. The obvious repair was a third variant of "Automatisch
 * gelezen uit ‹source›", one per provenance. That would have put the same
 * claim two lines above the note that exists to make it — "Automatisch
 * gelezen uit het bijschrift" directly over "UIT HET BIJSCHRIFT GEHAALD" —
 * and left the screen with two places to keep in agreement forever, which
 * is exactly the arrangement that broke. So the origin is stated ONCE, by
 * the note, and the subtitle says the thing the note does not: that
 * nothing has been saved yet and the fields are yours to correct. It is
 * the same sentence for every provenance, deliberately.
 *
 * The HELPER TEXTS do branch, because what they ask of the reader honestly
 * differs. "Mogelijk niet compleet" is true of a list a model assembled out
 * of prose and is an insult to a publisher's own `recipeIngredient` array;
 * "controleer de volgorde" is worth saying about steps a model ordered and
 * close to meaningless about `recipeInstructions`, which arrive in order.
 *
 * NO HELPER TEXT NAMES A MEDIUM. The caption branch says "het bijschrift"
 * and not "het bijschrift van de video", following the precedent
 * importFailureCopy.ts's `unsupported_url` note sets at length: a sentence
 * naming the platforms or the medium it happens to cover today is a
 * sentence that spends every future union widening being wrong. The branch
 * is defined by the caption, not by what the caption is attached to.
 */

import type { RecipeProvenance } from '@/domain/import/types';

export interface RecipeProvenanceNoteCopy {
  /** One short line naming where the recipe came from. Never a verdict on it. */
  readonly title: string;
  /** What that means for the person about to cook it — the mechanism, and what (if anything) it asks of them. */
  readonly body: string;
  /**
   * Title and body as one announcement. A screen reader that met these as
   * two orphaned fragments would hear a heading with no sentence attached,
   * which is where a reader invents a severity for it.
   */
  readonly accessibilityLabel: string;
}

/**
 * A `Record` keyed by the whole union rather than a `switch` with a
 * default, for the reason importCreatorCopy.ts's `PLATFORM_LABELS` gives:
 * a third provenance must be a compile error here, not a note that quietly
 * says nothing on a screen. A default branch would hand an unknown
 * provenance one of these two sentences, and both would be a claim about
 * an import route nobody had written copy for yet.
 */
const NOTES: Readonly<Record<RecipeProvenance, Omit<RecipeProvenanceNoteCopy, 'accessibilityLabel'>>> = {
  /**
   * The publisher's own machine-readable recipe object. "Woord voor woord"
   * is the literal truth of reading JSON-LD's `recipeIngredient` and
   * `recipeInstructions` — no model is in the loop, so there is nothing
   * between what the maker wrote and what is on this screen. Deliberately
   * says nothing about accuracy: a publisher can mistype their own
   * ingredient list, and this note is about WHOSE list it is.
   */
  publisher_structured_data: {
    title: 'Overgenomen van de site zelf',
    body: 'Deze pagina schrijft het recept uit in een vorm die Remy direct kan lezen. De ingrediënten en de stappen komen er woord voor woord vandaan.',
  },
  /**
   * The caption route. Opens by naming what a caption IS — prose, not a
   * list — so that what follows reads as a property of the source rather
   * than as a shortcoming of the app. "Dat gaat meestal goed" is load-
   * bearing and stays: without it the sentence after it becomes a warning
   * about a broken feature instead of a reason to glance at two numbers.
   * The ask is deliberately small and doable on this very screen ("loop het
   * hieronder na"), with the original as the tiebreaker rather than as
   * homework.
   */
  model_from_caption: {
    title: 'Uit het bijschrift gehaald',
    body:
      'Makers schrijven hun recept in het bijschrift, zelden als nette lijst. Remy heeft daar de ingrediënten en de stappen uit gehaald. ' +
      'Dat gaat meestal goed, maar een hoeveelheid of een stap kan ontbreken of anders gelezen zijn — loop het hieronder na, en kijk bij twijfel nog even bij het origineel.',
  },
};

/**
 * The single entry point. `null` in, `null` out, and that is not a
 * defensive default: a recipe somebody typed themselves — manual entry, or
 * the fallback after any import that produced no recipe — HAS no
 * provenance, and a note claiming one would be this module inventing the
 * exact fact it exists to report. The confirmation screen renders nothing
 * at all in that case, which is the honest shape: the user knows where a
 * recipe they typed came from.
 */
export function buildRecipeProvenanceNote(provenance: RecipeProvenance | null): RecipeProvenanceNoteCopy | null {
  if (provenance === null) {
    return null;
  }
  const note = NOTES[provenance];
  return {
    title: note.title,
    body: note.body,
    accessibilityLabel: `${note.title}. ${note.body}`,
  };
}

/**
 * The confirmation screen is either showing a recipe that arrived from
 * somewhere, or an empty form the user is filling in. Spelled out here
 * rather than imported from src/app/import/routeParams.ts (where it is
 * `ImportConfirmParams['mode']`) so a component-layer copy module does not
 * depend on an app route; the two are structurally identical, so passing
 * one where the other is expected already type-checks.
 */
export type ImportConfirmMode = 'parsed' | 'manual';

export interface ImportConfirmGuidanceCopy {
  /** Under the screen title. Says what this screen is for — never where the recipe came from, which the note says once. */
  readonly subtitle: string;
  /** Under the "Ingrediënten" heading. */
  readonly ingredientsHelperText: string;
  /** Under the "Bereiding" heading. */
  readonly stepsHelperText: string;
}

/** The two helper texts, per provenance. A `Record` over the whole union, for the same reason `NOTES` above is one: a third provenance must not silently inherit either of these. */
const HELPER_TEXTS: Readonly<
  Record<RecipeProvenance, Pick<ImportConfirmGuidanceCopy, 'ingredientsHelperText' | 'stepsHelperText'>>
> = {
  /**
   * No "controleer" and no "mogelijk niet compleet": this is the
   * publisher's own list, and asking someone to verify it against itself
   * is busywork dressed as diligence. The invitation is to make it theirs
   * — halve it, drop the anchovies — which is the real reason these fields
   * are editable on a web import at all.
   */
  publisher_structured_data: {
    ingredientsHelperText: 'Overgenomen zoals ze op de pagina stonden. Pas aan wat je anders wilt.',
    stepsHelperText: 'Overgenomen van de pagina, in de volgorde die daar stond.',
  },
  /**
   * The wording the screen has always used for this route, minus "van de
   * video" — see the file header on why no branch here names a medium.
   * Both asks are real: prose genuinely omits amounts, and a model
   * genuinely has to decide what order the steps were in.
   */
  model_from_caption: {
    ingredientsHelperText: 'Overgenomen uit het bijschrift — mogelijk niet compleet. Controleer en vul aan waar nodig.',
    stepsHelperText: 'Overgenomen uit het bijschrift — controleer de volgorde.',
  },
};

/**
 * `mode: 'parsed'` with no provenance: a recipe came from somewhere and
 * this build cannot say where (a payload from a newer one — see
 * `readProvenance` in src/app/import/routeParams.ts). It is the caption
 * branch's asks with the source removed, which is the honest shape:
 * "check it" survives not knowing where it came from, and naming a source
 * we are not sure of would be inventing the one fact we are missing.
 */
const HELPER_TEXTS_UNKNOWN_SOURCE: Pick<
  ImportConfirmGuidanceCopy,
  'ingredientsHelperText' | 'stepsHelperText'
> = {
  ingredientsHelperText: 'Automatisch overgenomen — mogelijk niet compleet. Controleer en vul aan waar nodig.',
  stepsHelperText: 'Automatisch overgenomen — controleer de volgorde.',
};

/**
 * Identical for every provenance, on purpose — see the file header. It
 * carries the one thing the note above it cannot: that this screen has
 * written nothing yet, so editing here is free.
 */
const SUBTITLE_IMPORTED = 'Pas aan wat er niet klopt. Er wordt nog niets opgeslagen.';

/** Manual entry keeps the sentence it always had: it is the only one of these that explains why the fields are empty. */
const GUIDANCE_MANUAL: ImportConfirmGuidanceCopy = {
  subtitle: 'Vul dit recept zelf aan — Remy kon dit niet automatisch lezen.',
  ingredientsHelperText: 'Typ de ingrediënten die je nodig hebt.',
  stepsHelperText: 'Typ de bereidingsstappen.',
};

/**
 * The confirmation screen's own guidance copy, which is provenance copy
 * wearing different clothes — see the file header for why it lives beside
 * the note rather than in a module of its own.
 *
 * `provenance` is read ONLY in the imported branch. A manual entry's
 * provenance is null by construction (src/app/import/paste.tsx states it
 * at every route into manual entry), and ignoring it here rather than
 * asserting it means a payload that somehow carried both cannot make a
 * typed recipe claim a source.
 */
export function buildImportConfirmGuidance(
  mode: ImportConfirmMode,
  provenance: RecipeProvenance | null,
): ImportConfirmGuidanceCopy {
  if (mode === 'manual') {
    return GUIDANCE_MANUAL;
  }
  const helpers = provenance === null ? HELPER_TEXTS_UNKNOWN_SOURCE : HELPER_TEXTS[provenance];
  return {
    subtitle: SUBTITLE_IMPORTED,
    ingredientsHelperText: helpers.ingredientsHelperText,
    stepsHelperText: helpers.stepsHelperText,
  };
}
