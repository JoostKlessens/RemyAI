/**
 * EVERYTHING THE PASTE SCREEN SAYS THAT DEPENDS ON WHAT YOU GAVE IT.
 *
 * SRC-08 gave that screen a second source. A user can hand Remy a LINK, or
 * they can hand it the RECIPE ITSELF — out of a message, a mail, a photo
 * they retyped. Two sources, and almost every sentence on that screen was
 * written when there was only one: it asks for a link, it promises to open
 * a page, and while it works it narrates finding a video and reading a
 * bijschrift. Every one of those is false about a paste, and none of them
 * would fail to compile.
 *
 * SO THE BRANCHING SENTENCES LEAVE THE `.tsx`. That is the same rule
 * importFailureCopy.ts, recipeProvenanceCopy.ts and importCreatorCopy.ts
 * each state for themselves, and it is not a filing convention: a Dutch
 * sentence written inline in a component is a sentence nothing can assert,
 * and the sentences here are CLAIMS ABOUT WHAT REMY DID. "Video gevonden"
 * shown to somebody who pasted an email is the same class of untruth as a
 * spinner that resolves into nothing — the screen narrating work it did not
 * do. No React Native import appears below, on purpose, so this runs under
 * vitest's `node` environment and tests/importPasteCopy.test.ts can hold
 * every one of those claims to its route.
 *
 * ---
 *
 * WHY THE MODE COPY AND THE LOADING NARRATION SHARE ONE FILE, when they
 * branch on two different things — the mode branches on what the user
 * CHOSE, the checkpoints on the platform the attempt RESOLVED TO. They are
 * two statements of one fact, made a few seconds apart on one screen: the
 * user picks "Tekst", and moments later the screen must not claim to have
 * gone and fetched something. Split across two modules, each could be
 * correct on its own and the pair still contradict each other — which is
 * precisely the failure recipeProvenanceCopy.ts's header records having
 * shipped once already (a subtitle and a note, a few pixels apart, naming
 * different origins for the same recipe). Here a contradiction has to be
 * written twice in the same file to survive review.
 *
 * ---
 *
 * THE MODE IS A CHOICE THE USER MAKES, NEVER A GUESS THIS APP MAKES, and
 * that constraint is what the segment labels are for rather than being a
 * matter of taste. `readImportRequest`
 * (supabase/functions/parse-recipe/importRequest.ts) refuses a body that
 * carries both `url` and `text` and refuses one that carries neither,
 * explicitly so that nothing downstream ever has to guess which the caller
 * meant. Sniffing the pasted string on this side — "does it start with
 * http" — would put that guess back, in the one place where being wrong is
 * silent AND billable: a URL posted as `{ text }` is a paid model call
 * asked to find a recipe in a web address, and a recipe posted as `{ url }`
 * is an unsupported-link error shown to somebody holding a perfectly good
 * recipe. Two labelled segments make the answer the user's, and make "both"
 * unrepresentable in the UI rather than merely unlikely.
 *
 * WHICH IS ALSO WHY NEITHER LABEL DESCRIBES A FORMAT. "Link" and "Tekst"
 * name what the user is holding, not what a parser expects; nothing here
 * says "URL", "plakken als platte tekst" or any other word that would make
 * a person wonder whether their thing qualifies. The subtitle under each
 * one then says what Remy will DO with it, because that — not the shape of
 * the input — is the difference the user is actually choosing between.
 *
 * NO SENTENCE BELOW NAMES A MEDIUM IT DOES NOT HAVE TO. That rule is
 * `unsupported_url`'s, paid for twice in importFailureCopy.ts: copy that
 * enumerates the platforms or containers it happens to cover today spends
 * every future widening being wrong. The link subtitle survives as it was
 * written ("een video of een receptpagina" — a shape of thing, not a list),
 * and the text copy names no container at all, because for a paste there is
 * none: the text IS the source, exactly as recipeProvenanceCopy.ts argues
 * for its own "je tekst".
 */

import { isDisplayOnlyPlatform } from '@/domain/import/displayOnlyPolicy';
import type { ImportPlatform } from '@/domain/import/types';

/**
 * WHAT THE USER SAID THEY ARE HANDING OVER — a choice, not a conclusion.
 *
 * Deliberately NOT `ImportPlatform`, which is a much later and much more
 * specific fact. A platform is what the pipeline worked out (or what the
 * function reported back); a mode is what the person in front of the screen
 * declared before anything was sent. Collapsing the two would mean this
 * screen's control had to offer four link segments, or that picking a
 * segment asserted a platform nobody has determined yet.
 */
export type ImportSourceMode = 'link' | 'text';

/**
 * Listed rather than derived, so the screen's control and this module's
 * test both iterate the same two members and a third mode cannot be added
 * to one without the other noticing. Order is the order they are rendered
 * in: link first, because it is the route almost every import takes and
 * the one the screen was built around.
 */
export const IMPORT_SOURCE_MODES: readonly ImportSourceMode[] = ['link', 'text'];

export interface ImportSourceModeCopy {
  /** One word on the mode switch. Names what the user is holding, never a format — see the file header. */
  readonly segmentLabel: string;
  /** The sentence under the screen title: what Remy will do with this kind of source. */
  readonly subtitle: string;
  /** What the empty field shows. For the link route the shape of a URL; for text an instruction, because an empty multi-line box says nothing on its own. */
  readonly placeholder: string;
  /** The input's accessibility label — a screen reader gets the same "which source is this" answer the placeholder gives everyone else. */
  readonly inputAccessibilityLabel: string;
  /**
   * The clipboard shortcut's accessibility label. The VISIBLE label stays
   * "Plak uit klembord" in both modes, because sitting directly under the
   * field it is already unambiguous; a screen reader meets this row without
   * that context and needs to be told which field it fills.
   */
  readonly clipboardAccessibilityLabel: string;
  /**
   * The always-available escape hatch at the foot of the screen: type the
   * recipe in by hand instead.
   *
   * IT HAD TO BRANCH, and this is the clearest small example of why this
   * module exists. The link route's label opens "Ik heb geen link…", which
   * is a true and useful thing to say to somebody staring at a URL field
   * and a lie to somebody who has just pasted a recipe out of a mail — they
   * have no link either, and it is not their problem. The two labels
   * therefore name the same action from the reader's own situation.
   */
  readonly manualEntryLabel: string;
  /** The same action for a screen reader, said plainly and without the "ik" the visible label uses. */
  readonly manualEntryAccessibilityLabel: string;
}

/**
 * A `Record` over the whole union rather than a `switch` with a default,
 * for the reason `PLATFORM_LABELS` gives in importCreatorCopy.ts: a third
 * mode must be a compile error here, not a screen that silently shows the
 * link route's words for a source nobody wrote copy for.
 */
const MODE_COPY: Readonly<Record<ImportSourceMode, ImportSourceModeCopy>> = {
  /**
   * The route as it always was. Its subtitle is carried over from the
   * screen WORD FOR WORD rather than rewritten, and that is deliberate:
   * it is the sentence that stopped listing platforms after the union
   * grew twice, and re-drafting it here would be the third chance to put
   * a list back.
   */
  link: {
    segmentLabel: 'Link',
    subtitle: 'Plak een link naar een video of een receptpagina. Remy probeert er een recept van te maken.',
    placeholder: 'https://…',
    inputAccessibilityLabel: 'Link naar een video of receptpagina',
    clipboardAccessibilityLabel: 'Plak link uit klembord',
    manualEntryLabel: 'Ik heb geen link, recept zelf invoeren',
    manualEntryAccessibilityLabel: 'Recept handmatig invoeren zonder link',
  },
  /**
   * The pasted-recipe route. The subtitle names WHERE such a text tends to
   * come from — een appje, een mail, overgetypt — because the whole
   * difficulty of this mode is that people do not know it exists: nobody
   * goes looking for a "paste your recipe" field, they look for somewhere
   * to put a link and give up. Three ordinary places is enough to make a
   * reader recognise their own situation, and they are examples of where
   * the TEXT was, never containers Remy will go and open. Remy opens
   * nothing here.
   *
   * "Remy haalt de ingrediënten en de stappen eruit" is the same promise
   * `model_from_pasted_text` makes on the confirmation screen
   * (recipeProvenanceCopy.ts), in the same words, one screen earlier. It
   * is the whole of what happens and it deliberately claims no more: no
   * "begrijpt", no "herkent elk recept", nothing the next screen would
   * then have to walk back.
   *
   * The placeholder says "het hele recept" for one concrete reason: a user
   * who pastes only the ingredient list gets a recipe with no method and
   * no way to know why. Asking for everything up front is cheaper than
   * explaining the omission afterwards.
   */
  text: {
    segmentLabel: 'Tekst',
    subtitle:
      'Plak het recept zelf — uit een appje, een mail, of overgetypt. Remy haalt de ingrediënten en de stappen eruit.',
    placeholder: 'Plak hier het hele recept…',
    inputAccessibilityLabel: 'Het recept als tekst',
    clipboardAccessibilityLabel: 'Plak tekst uit klembord',
    // "Liever" rather than "geen": on this route nothing is missing and
    // nothing has gone wrong, the user is simply choosing to type instead
    // of paste. Phrasing it as a lack would turn a preference into a
    // failure, which is the same mistake `display_only`'s copy exists to
    // avoid one screen further on.
    manualEntryLabel: 'Ik typ het recept liever zelf',
    manualEntryAccessibilityLabel: 'Recept handmatig invoeren',
  },
};

/** The single entry point for everything the screen says about the mode the user picked. */
export function buildImportSourceModeCopy(mode: ImportSourceMode): ImportSourceModeCopy {
  return MODE_COPY[mode];
}

export interface ImportStartOverCopy {
  readonly label: string;
  readonly accessibilityLabel: string;
}

/**
 * The "start over" action on a failed attempt, which until now said
 * "Andere link proberen" no matter what had been attempted.
 *
 * THAT SENTENCE WAS FALSE ON EXACTLY THE ROUTE THIS FEATURE ADDED. After a
 * pasted-text import there is no link, so the screen offered to try another
 * one of something the user never had. The button's BEHAVIOUR was already
 * right — it clears the field and starts again — so this is a copy defect
 * rather than a missing action, and it is the same failure the checkpoint
 * narration had: link-shaped words surviving into a route with no link in
 * it.
 *
 * Keyed on the mode of the ATTEMPT THAT FAILED rather than on whatever the
 * switch happens to show now. Those differ the moment somebody fails a
 * link, flips to Tekst and looks back at the panel still on screen; naming
 * the mode they are about to use would describe a future they have not
 * chosen yet, when the button's whole job is to discard the past one.
 */
const START_OVER_COPY: Readonly<Record<ImportSourceMode, ImportStartOverCopy>> = {
  link: { label: 'Andere link proberen', accessibilityLabel: 'Een andere link proberen' },
  // Not "Andere tekst proberen": the user is not looking for a different
  // recipe, they are replacing a paste that did not work. "Opnieuw plakken"
  // names the gesture they actually have to repeat.
  text: { label: 'Opnieuw plakken', accessibilityLabel: 'Een andere tekst plakken' },
};

export function buildImportStartOverCopy(mode: ImportSourceMode): ImportStartOverCopy {
  return START_OVER_COPY[mode];
}

/**
 * The mode switch's own accessibility label — what the control as a whole
 * is asking, since its two segments only make sense together.
 *
 * Phrased as the QUESTION, matching the precedent Ranglijst's scope switch
 * sets ("Wiens beoordelingen je ziet"). A label like "Bron" would name a
 * category and leave a screen-reader user to infer the question from the
 * options, which is exactly the inference this screen refuses to make
 * anywhere else.
 */
export const IMPORT_SOURCE_MODE_SWITCH_ACCESSIBILITY_LABEL = 'Wat je plakt: een link of het recept als tekst';

/**
 * Shown under the text field the moment a paste is longer than the import
 * pipeline will read (`MAX_PASTED_RECIPE_TEXT_CHARS`,
 * src/app/import/pastedTextLimit.ts), with the submit button refused until
 * it is not.
 *
 * IT STATES NO NUMBER, AND THAT IS A DECISION RATHER THAN AN OMISSION. A
 * shortfall ("er kunnen nog 1.240 tekens af") is more precise and worse
 * advice: it invites someone to shave characters off the end, when the only
 * realistic way to be this far over the cap is to have pasted something
 * that is not a recipe — a whole page, a whole mail thread, a whole chat.
 * The fix is to paste less of the wrong thing, so that is what the sentence
 * asks for. It also keeps this module free of the limit's value, which
 * lives in exactly one place on this side of the wire.
 *
 * IT NAMES NO CONTAINER, per the file header: not "de pagina", not "de
 * mail". "Alles wat eromheen staat" is true of every one of them.
 *
 * IT IS NOT AN ERROR MESSAGE. Nothing has failed and nothing has been sent
 * — the user is mid-paste. So it reads as an instruction, in the same
 * plain voice as the placeholder above it, and never as a rejection.
 */
export const PASTED_TEXT_TOO_LONG_MESSAGE =
  'Dit is te veel tekst in één keer. Plak alleen het recept zelf, zonder alles wat eromheen staat.';

/**
 * THE LOADING NARRATION, ONE LIST PER PIPELINE SHAPE — moved here from the
 * screen when the pasted-text route made a fourth list necessary.
 *
 * THE LAST ENTRY OF EVERY LIST IS THE STEP ACTUALLY IN FLIGHT and is never
 * filled by a timer. The screen fills the leading rows on a short fixed
 * timer purely to narrate progress, and completes the final one only when
 * the real result arrives — which is why each list's last label carries the
 * ellipsis and none of the others do. A list whose last row could be lit by
 * a timer would be a screen claiming to have finished work that is still
 * running.
 *
 * WHICH IS ALSO WHY THE LISTS DIFFER IN LENGTH RATHER THAN IN WORDING. The
 * three-step list narrates a genuinely three-step pipeline (resolve the
 * post, read its caption, ask the model); the others have two steps because
 * their pipelines have two. Padding a shorter route out to three rows for
 * visual symmetry would mean inventing a step, which is the one thing this
 * screen's whole loading design exists to avoid.
 */
const CHECKPOINT_LABELS_EXTRACTION: readonly string[] = [
  'Video gevonden',
  'Bijschrift gelezen',
  'Recept samengesteld…',
];

/**
 * A display-only import (PD-011) resolves a post and stops there on
 * purpose: Remy may show the post and credit its maker, and may not read
 * the bijschrift, so the model is never asked. The standard list would
 * light "Bijschrift gelezen" on a timer for a caption we deliberately never
 * read.
 */
const CHECKPOINT_LABELS_DISPLAY_ONLY: readonly string[] = ['Post gevonden', 'Maker erbij gezocht…'];

/**
 * A web import has no video and no bijschrift: the recipe comes out of the
 * page's own structured data, with no model in the loop at all. Reusing the
 * extraction list because it happens to be the default would narrate three
 * steps we do not perform.
 */
const CHECKPOINT_LABELS_WEB: readonly string[] = ['Pagina opgehaald', 'Recept van de pagina gelezen…'];

/**
 * THE PASTED-TEXT LIST, AND WHY IT IS THE SHORTEST OF THE FOUR. Every other
 * route begins by going and getting something — a post, a page, a video's
 * metadata — and every one of those steps can fail on its own. This route
 * fetches nothing. There is no post, no page, no video and no maker; there
 * is a string the user already handed over, and one model call over it.
 * Two steps is not a trimmed-down version of the real narration, it is the
 * whole pipeline.
 *
 * "JE TEKST GELEZEN" IS THE ONLY TIMED CHECKPOINT IN THIS FILE THAT IS
 * ALREADY TRUE WHEN IT LIGHTS. The other lists' first rows narrate a fetch
 * that is genuinely still in progress behind them; here the text was in
 * hand before the screen ever started animating. The row exists so the
 * second one has something to be second to — a lone in-flight row reads as
 * a spinner, which is what docs/DESIGN.md §3 replaced with checkpoints in
 * the first place.
 *
 * "RECEPT ERUIT GEHAALD…" rather than the extraction list's "Recept
 * samengesteld…", in the words `model_from_pasted_text` uses on the very
 * next screen ("Uit je tekst gehaald", recipeProvenanceCopy.ts). "Eruit"
 * points back at the user's own text, which is both the honest description
 * of what the model is doing and the thing that distinguishes this route:
 * nothing was assembled out of sources, something was pulled out of what
 * they gave.
 */
const CHECKPOINT_LABELS_TEXT: readonly string[] = ['Je tekst gelezen', 'Recept eruit gehaald…'];

/**
 * Which narration is honest for a given platform. A function rather than a
 * `Record<ImportPlatform, …>` because the question is not really
 * per-platform: display-only is a POLICY (`isDisplayOnlyPlatform`, PD-011)
 * that any platform could in principle fall under, and it has to be asked
 * first — a Record keyed on platform would encode today's answer to that
 * policy as a fact about Instagram.
 *
 * `null` is the platform of an import that has not started, and it gets the
 * extraction list because that is the screen's resting default; no
 * checkpoint is ever rendered in that state.
 */
export function buildImportCheckpointLabels(platform: ImportPlatform | null): readonly string[] {
  if (platform === null) {
    return CHECKPOINT_LABELS_EXTRACTION;
  }
  if (isDisplayOnlyPlatform(platform)) {
    return CHECKPOINT_LABELS_DISPLAY_ONLY;
  }
  if (platform === 'web') {
    return CHECKPOINT_LABELS_WEB;
  }
  return platform === 'text' ? CHECKPOINT_LABELS_TEXT : CHECKPOINT_LABELS_EXTRACTION;
}
