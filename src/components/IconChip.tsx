/**
 * `Chip`, with the icon compulsory rather than optional — the owner's
 * request for the library's "Waarmee?" row, in his words "een
 * pasta-icoontje, en dan het woord pasta ernaast".
 *
 * IT DRAWS NOTHING ANY MORE, AND THAT IS THE POINT OF ITS CURRENT SHAPE.
 * `Chip` took an `icon` prop on 7 September 2026 and now renders the glyph
 * inside its own pill; this component became a pass-through the same hour.
 * What survives is a NAME and a REQUIREMENT, which is the whole reason it
 * was not deleted: `ChipProps.icon` is optional, because five of the six
 * chip rows in the app have no vocabulary of drawings at all, while
 * `IconChipProps.icon` is REQUIRED and may be explicitly `null`. A row that
 * is meant to be illustrated therefore cannot silently lose its glyph in a
 * refactor — the compiler asks. Deleting this file would be a two-call-site
 * change and a real loss of that check; it is a decision for whoever wants
 * it, not a tidy-up.
 *
 * WHY THE GLYPH USED TO SIT BESIDE THE PILL, kept because the reasoning is
 * what produced today's shape and a reader who finds this component in
 * `git log` deserves the whole story rather than the conclusion. `Chip`
 * owns its box — border, fill, radius, padding, press scale, haptic, focus
 * ring — and took a `label: string` with no slot for a child. There were
 * exactly two ways to get a glyph inside that box: change `Chip`, or fork
 * it. Forking means a second pill whose colours, radii and press animation
 * must be held in step by hand, which is the drift this codebase's comments
 * warn about repeatedly; changing `Chip` was one small, correct edit that
 * belonged to whoever had a real glyph to position against. So until GAP-19
 * this file laid the icon in a `View` AHEAD of the pill, and — because no
 * dish glyph was available then — that row never actually rendered, so
 * nobody saw the compromise. The glyphs landed, the owner saw the row on a
 * device, and he asked for the obvious thing: "The icon is placed [outside],
 * and I want that inside of the box." `Chip`'s header now carries the
 * positioning, the size and the degrade path; this file only routes to it.
 *
 * THE DEGRADE PATH DID NOT MOVE OUT OF THE PRODUCT, ONLY OUT OF THIS FILE.
 * `Chip` asks `isIconAvailable` before it renders anything, so an `IconName`
 * that no installed font can draw still produces a bare pill — text-only,
 * never a gap around nothing and never a placeholder box. That contract is
 * asserted where it is now implemented; see `Chip` and `Icon`'s headers.
 *
 * THE CHIP STILL KEEPS THE WHOLE ACCESSIBILITY STORY, unchanged by the move:
 * the glyph is decorative (`Icon` marks every one of them as not an
 * accessibility element, see its header) and the `Chip` behind it carries
 * the role, the checked state and the spoken label. A screen-reader user
 * hears exactly what they heard before this component existed, which is the
 * correct outcome: an icon added beside a word adds nothing a screen reader
 * should read twice.
 */

import type { JSX } from 'react';
import { Chip, type ChipProps } from './Chip';
import type { IconName } from './iconFont';

export interface IconChipProps extends ChipProps {
  /**
   * `null` means "this chip has no icon at all" — a different statement
   * from "this chip's icon has no glyph yet", which is an `IconName` no
   * installed font can draw. Both render the same bare `Chip`; keeping them
   * apart is what let GAP-19 turn the second group into drawings without
   * touching the first, and it will do the same for the next glyph the
   * design asks for before a font has it.
   *
   * Required here where `Chip` makes it optional — see the header. This is
   * the one thing this component still adds.
   */
  readonly icon: IconName | null;
}

export function IconChip(props: IconChipProps): JSX.Element {
  // Spread rather than a destructure-and-rebuild: every prop this component
  // takes is a `Chip` prop, `icon` included, so listing them again here
  // would be a second copy of `ChipProps` to keep in step by hand.
  return <Chip {...props} />;
}
