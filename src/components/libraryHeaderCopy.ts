/**
 * Every Dutch word `LibraryHeader` says, and the reason there are now three
 * controls' worth of them instead of seven inline string literals.
 *
 * ===========================================================================
 * WHY THE HEADER SHRANK, AND WHAT THAT REVERSES
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "De mijn recepten pagina is nu te
 * rommelig, verzin hier een logischere layout voor en hoe je dit zou willen
 * doen met duidelijke, overzichtelijke icoontjes."
 *
 * The header band measured 136pt: 16pt of padding, a 44pt title line, an 8pt
 * gap, a 52pt secondary button, 16pt of padding. With the filter bar beneath
 * it, an ordinary library's grid began below the fold on a 852pt phone. The
 * layout the owner approved gives the header 68pt — one line, the screen's
 * name on the left and its controls on the right as glyphs.
 *
 * WHAT THAT REVERSES. `LibraryHeader`'s own header argued the previous
 * arrangement at length and it was right about the defect it fixed: two
 * unlike controls stacked in a right-aligned column "is exactly what a menu
 * looks like", which is what the owner had complained about. That fix stands
 * — there is still no stack. What changes is that the screen's own action is
 * no longer a 200pt-wide word; it is a glyph on the title line beside the two
 * doors, distinguished from them by weight rather than by position.
 *
 * "ONE RULE, EVERY TAB" IS UNBROKEN. The title line names the screen and
 * carries exactly one control of the screen's own — `Recept toevoegen`, drawn
 * as an accented plus. `Deze week` and `Instellingen` remain doors OUT of
 * this screen rather than things you do to it, which is the distinction that
 * file has always drawn, and they are drawn quieter for it.
 *
 * ===========================================================================
 * WHY THE WORDS SURVIVE THE ICONS
 * ===========================================================================
 *
 * An icon-only control that cannot draw its icon is a blank 44pt hole. Every
 * one of the three therefore asks `isIconAvailable` first — the contract
 * iconFont.ts states and `IconChip` already follows — and falls back to the
 * text it replaced. `plus`, `calendar` and `settings` all resolve against the
 * installed Feather today, so all three render as glyphs; the fallback is
 * what makes that safe to ship before GAP-19 rather than a hedge.
 *
 * THE SPOKEN LABEL IS NOT THE VISIBLE ONE, and never was. A glyph says
 * nothing out loud, so `accessibilityLabel` carries the whole sentence — what
 * the control opens and why — exactly as it did when the control was a
 * button. Those are the strings that were inline in the `.tsx` and that no
 * test could reach, which is the same defect ENT-05 fixed in the empty state
 * and emptyLibraryCopy.ts records: a sentence written into a route module is
 * a sentence nothing can assert.
 */

/** The screen's name. `title2`, and the only prose on the band. */
export const LIBRARY_HEADER_TITLE = 'Mijn recepten';

export interface LibraryHeaderControlCopy {
  /** Drawn only when the glyph is unavailable — see the header. */
  readonly fallbackLabel: string;
  /** Always spoken. A glyph says nothing, so this carries the whole sentence. */
  readonly accessibilityLabel: string;
}

/**
 * The screen's one action: the route that both pasting a link and typing a
 * recipe's text go through.
 *
 * The word is "Recept toevoegen" and not "Link plakken", which
 * `LibraryHeader` already corrected once and for a reason worth keeping in
 * front of whoever shortens it next: since SRC-08 that screen also accepts a
 * recipe as TEXT, with no link in it at all, so naming the mechanism names
 * the wrong one. The spoken label names both doors because it is the only
 * thing a screen-reader user hears about where this leads.
 */
export const LIBRARY_HEADER_ADD_RECIPE: LibraryHeaderControlCopy = {
  fallbackLabel: 'Recept toevoegen',
  accessibilityLabel: 'Recept toevoegen, via een link of de tekst van een recept',
};

/**
 * The weekly door. It points at `/deze-week` and not `/boodschappen` —
 * LibraryHeader's own comment carries why (the plan comes before the list
 * derived from it), and the spoken label still names both so nobody has to
 * guess which of the two they are about to land on.
 */
export const LIBRARY_HEADER_WEEK_PLAN: LibraryHeaderControlCopy = {
  fallbackLabel: 'Deze week',
  accessibilityLabel: 'Deze week, wat je gepland hebt en de boodschappen daarvoor',
};

/** The household door — the only route to dislikes and allergens (PD-006), and reached roughly never after setup. */
export const LIBRARY_HEADER_SETTINGS: LibraryHeaderControlCopy = {
  fallbackLabel: 'Instellingen',
  accessibilityLabel: 'Instellingen, huishoud-voorkeuren aanpassen',
};
