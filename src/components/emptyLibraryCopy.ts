/**
 * ENT-05. WHAT REMY SAYS WHEN THE LIBRARY IS STILL EMPTY — the first thing
 * a new household ever reads, on the two screens that can be reached with
 * nothing saved yet.
 *
 * THE DEFECT THIS MODULE EXISTS TO END, STATED PLAINLY. The library's empty
 * body read "Plak een link naar een TikTok- of Instagram-video om te
 * beginnen." That sentence names two platforms out of six accepted routes —
 * TikTok, Instagram, YouTube (SRC-02) and its Shorts (SRC-03), any ordinary
 * page carrying schema.org JSON-LD (SRC-01), Pinterest (SRC-05), and since
 * SRC-08 the recipe text itself with no link at all. Worse, it LED with the
 * weakest of the six: Instagram is display-only (PD-011,
 * src/domain/import/displayOnlyPolicy.ts), so the one example a new user
 * was handed first is the single route that structurally cannot produce a
 * finished recipe. The first sentence Remy says was an advertisement for
 * its own worst path.
 *
 * AND THIS WAS THE THIRD TIME, WHICH IS THE ACTUAL ARGUMENT. This codebase
 * has already written the rule against enumerating platforms, twice, in two
 * files:
 *
 *  - src/components/importFailureCopy.ts, on `unsupported_url`: "It read
 *    'alleen TikTok- en Instagram-' until YouTube joined the union, then
 *    'TikTok, Instagram en YouTube' until `'web'` did — and each time, the
 *    sentence spent the interval telling users Remy rejects links it
 *    accepts."
 *  - src/app/import/paste.tsx's header: "this screen's copy stopped listing
 *    platforms: a sentence enumerating what Remy accepts has been wrong
 *    twice already… and 'een video of een receptpagina' survives the union
 *    growing again."
 *
 * Both landed on the same answer, and this module simply applies it a third
 * time: DESCRIBE THE SHAPE OF WHAT IS ACCEPTED, NEVER THE BRANDS. "Een
 * video of een receptpagina" costs nothing when `ImportPlatform`
 * (src/domain/import/importVocabulary.ts) grows; a list costs a wrong
 * sentence for however long it takes someone to notice.
 *
 * A FOURTH INSTANCE TURNED UP WHILE FIXING THE THIRD, and it is the reason
 * both surfaces are in this one file rather than only the library. Kiezen's
 * `empty_rotation` state (src/components/NoCandidateState.tsx) had honest
 * VISIBLE copy — "Plak een link en Remy kan morgen iets voorstellen", which
 * names no brand — sitting directly above a button whose
 * `accessibilityLabel` read "Recept plakken, plak een link naar een TikTok-
 * of Instagram-video". So the enumeration had already escaped into the one
 * channel where it is least likely to be spotted and most likely to be the
 * ONLY thing a person hears: a screen-reader user meets the label, not the
 * sentence beside it. Fixing the visible copy on one screen and leaving a
 * spoken copy of the same lie on another would have been the same defect
 * with better manners.
 *
 * WHY ONE MODULE FOR TWO SURFACES. They are two renderings of a single
 * fact — this household has imported nothing yet — a tab apart, and this
 * repo has already shipped the failure that comes from letting one fact be
 * worded in two places: recipeProvenanceCopy.ts's header records a subtitle
 * and a note, a few pixels apart, naming different origins for the same
 * recipe. Two modules could each be internally correct and still contradict
 * each other; here a contradiction has to be typed twice in one file to
 * survive review, and one test iterates both surfaces against the same
 * rule. Splitting them was considered — the library state and the Kiezen
 * state have genuinely different voices — and rejected: different VOICES do
 * not need different FILES, they need different entries, which is exactly
 * what the Record below is.
 *
 * WHY THEY ARE STILL TWO DIFFERENT SENTENCES, THOUGH. The same reason
 * librarySearchCopy.ts gives for refusing to reuse the first-run wording:
 * "nothing to show" is not one state. Mijn recepten is a container the user
 * opened expecting a list, so its copy explains what fills it. Kiezen asked
 * a question ("wat eten we?") and has no answer, so its copy owes a promise
 * about WHEN there will be one — "dan kan Remy morgen iets voorstellen" —
 * which would be meaningless on the library screen. Sharing a module is not
 * sharing a sentence.
 *
 * WHY THE COPY LEFT THE `.tsx` FILES AT ALL. The rule every sibling
 * `*Copy.ts` in this directory states for itself, and it is not a filing
 * convention: vitest runs in a `node` environment with react-native stubbed
 * (vitest.config.ts) and collects only `tests` files ending in `.test.ts`,
 * so no test in this repo imports a `.tsx` and none can. A Dutch sentence
 * written inline in a screen is a sentence nothing can assert — which is
 * precisely how a two-platform list survived four route additions in a file
 * people read every week. The words are now somewhere a test can hold them
 * to the rule the two comments above spent two incidents learning.
 *
 * ---
 *
 * WHY THERE IS STILL EXACTLY ONE DOOR, AND NOT A SECOND BUTTON FOR PASTED
 * TEXT. SRC-08 exists for people who cannot paste a link — paste.tsx's
 * header says discoverability is the entire reason that route exists,
 * "since people who cannot paste a link currently just give up" — so a
 * first-run state that hides it would be hiding the route built for exactly
 * the people most likely to be stuck. That argument was taken seriously and
 * still loses, on three counts:
 *
 *  1. THE CHOICE IS ONE TAP AWAY AND ALREADY AT EQUAL WEIGHT. The import
 *     screen opens on a `SegmentedControl` offering Link and Tekst side by
 *     side — built that way, per its own header, because it "shows both
 *     answers at once at equal weight". Nobody who taps this button can
 *     miss the second route; they land on it.
 *  2. A SECOND BUTTON COULD NOT ACTUALLY DIFFER. The import screen reads no
 *     route params — it only pushes them onward to the confirmation step —
 *     so a "Plak tekst" button would navigate to the identical screen in
 *     the identical state. Two controls with one destination teach a user
 *     that the distinction they just made did not matter, which is worse
 *     than one control. Giving that screen a mode parameter to fix this is
 *     a redesign of another screen, not a fix to this one.
 *  3. THE DEFECT WAS NEVER A MISSING DOOR. It was a door labelled as if it
 *     led one place when it leads to a choice of two. So the label is what
 *     changes: "Plak je eerste link" becomes "Plak je eerste recept" —
 *     "recept" being the one word true of every route and excluding none —
 *     and the body names both shapes in a single clause. One door, honestly
 *     signposted, beats two doors onto the same room.
 *
 * WHAT THE BODY DELIBERATELY DOES NOT DO IS TEACH THE ROUTE.
 * importPasteCopy.ts's Tekst subtitle already says where such a text tends
 * to come from ("uit een appje, een mail, of overgetypt"), one tap later,
 * where the user is actually choosing. Repeating it here would make the
 * empty state a manual for a screen it is only pointing at, and every word
 * duplicated across two screens is a word that can go stale in one of them.
 */

/**
 * The two screens a household with nothing imported can be looking at.
 *
 * Deliberately NOT keyed on `NoCandidateReason` or on anything from
 * src/domain: this union is about WHICH SURFACE IS SPEAKING, which is a
 * presentation fact, and `empty_rotation` is only one of four reasons
 * NoCandidateState renders — the other three describe a library that is not
 * empty at all and have nothing to do with this module.
 */
export type EmptyLibrarySurface = 'library' | 'rotation';

export interface EmptyLibraryCopy {
  readonly title: string;
  readonly body: string;
  /**
   * The one action either surface offers: go to the import screen. Both
   * surfaces send the user to the same place, and both labels avoid naming
   * a route — see the file header on why there is no second button and why
   * the word "link" left this label.
   */
  readonly actionLabel: string;
  /**
   * The same action for a screen reader. Present as a separate field rather
   * than left to default to `actionLabel`, because this is the exact field
   * that carried the platform list on Kiezen while the visible copy beside
   * it was already clean: an accessibility label nobody types out is an
   * accessibility label nobody re-reads. Making it a required member of
   * this interface means a future surface cannot forget it, and the test
   * over this Record checks it by the same rule as every visible string.
   */
  readonly actionAccessibilityLabel: string;
}

/**
 * A `Record` over the whole union rather than a `switch` with a default,
 * for the reason importPasteCopy.ts's `MODE_COPY` gives: a third surface
 * must be a compile error here, not a screen silently borrowing another
 * screen's words for a state nobody wrote copy for.
 */
const EMPTY_LIBRARY_COPY: Readonly<Record<EmptyLibrarySurface, EmptyLibraryCopy>> = {
  /**
   * Mijn recepten with nothing in it, which that screen's own header calls
   * "the honest first-run state": a fresh install seeds a bare household
   * and nothing else (src/lib/repository/seedData.ts), so this is not an
   * edge case, it is every new user's first screen.
   *
   * THE TITLE IS UNCHANGED AND SHOULD BE. "Nog geen recepten" states the
   * fact, says nothing false, and "nog" already carries that this is a
   * beginning rather than a failure. The defect was never the title.
   *
   * THE BODY NOW NAMES SHAPES AND ROUTES, NOT BRANDS. "Een video of een
   * receptpagina" is lifted deliberately, word for word, from the link
   * subtitle in importPasteCopy.ts — the sentence that survived the union
   * growing twice — because the user reads that exact phrase again one tap
   * later, and two screens describing one thing in two ways is the drift
   * this module's header warns about. "Of het recept als tekst" is the
   * clause SRC-08 earned and the old sentence never had.
   *
   * IT SAYS "PROBEERT", NOT "MAAKT". The same word importPasteCopy.ts
   * chose, for the same reason: a good share of imports end in an honest
   * failure state (importFailureCopy.ts is a whole module of them), and a
   * first-run promise that Remy WILL turn any link into a recipe is a
   * promise this pipeline cannot keep. "Never invent what the source did
   * not state" is this codebase's rule about data; not overclaiming what
   * the app will do is the same rule pointed at ourselves.
   */
  library: {
    title: 'Nog geen recepten',
    body: 'Plak een link naar een video of een receptpagina, of het recept als tekst. Remy probeert er een recept van te maken.',
    // "Recept" rather than "link": it is the one noun true of all six
    // routes, and it names what the user gets rather than what they have to
    // hold. "Je eerste" stays — it is the only word here that knows this is
    // a beginning.
    actionLabel: 'Plak je eerste recept',
    actionAccessibilityLabel: 'Plak je eerste recept, een link of de tekst van een recept',
  },
  /**
   * Kiezen with an empty rotation (NoCandidateState via `decide()`'s
   * `empty_rotation`, which src/domain/decide.ts documents as "nothing in
   * the library at all"). Kiezen's own header calls this "the genuinely
   * common first-run case now".
   *
   * THE TITLE AND THE PROMISE ARE CARRIED OVER INTACT. "Nog niets om uit te
   * kiezen" and "morgen iets voorstellen" were already right, already name
   * no platform, and are the half of this screen that says something the
   * library screen cannot: Kiezen was asked a question and owes an answer
   * about when there will be one. Rewriting words that were correct would
   * have been the change taking more than it fixed.
   *
   * WHAT MOVED IS "PLAK EEN LINK" -> "PLAK JE EERSTE RECEPT". Not the
   * platform defect — this sentence never had one — but the same defect one
   * layer up: it named the link route as though it were the only route,
   * which stopped being true at SRC-08. The promise after the comma is
   * untouched.
   *
   * AND THE ACCESSIBILITY LABEL IS THE REAL FIX HERE. It read "Recept
   * plakken, plak een link naar een TikTok- of Instagram-video" — the
   * fourth instance of the enumeration, in the channel where it was the
   * only thing a user would hear. Its replacement now ends in the same
   * clause the library's does, because a screen reader meeting either
   * button is being offered the identical action.
   */
  rotation: {
    title: 'Nog niets om uit te kiezen',
    body: 'Plak je eerste recept, dan kan Remy morgen iets voorstellen.',
    // Unchanged, and checked rather than assumed: "Recept plakken" already
    // named the action without naming a route, which is why the visible
    // button on this screen was never part of the defect.
    actionLabel: 'Recept plakken',
    actionAccessibilityLabel: 'Recept plakken, een link of de tekst van een recept',
  },
};

/** The single entry point for every word either empty-library surface says. */
export function describeEmptyLibrary(surface: EmptyLibrarySurface): EmptyLibraryCopy {
  return EMPTY_LIBRARY_COPY[surface];
}

/**
 * Listed rather than derived from `Object.keys`, so the test that enforces
 * the no-brands rule iterates a value the type system checks: a surface
 * added to the Record and forgotten here is a compile error, where an
 * `Object.keys` walk would have silently left the new surface untested —
 * which is precisely how an unasserted sentence gets to be wrong for four
 * route additions in a row.
 */
export const EMPTY_LIBRARY_SURFACES: readonly EmptyLibrarySurface[] = ['library', 'rotation'];
