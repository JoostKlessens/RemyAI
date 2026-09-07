/**
 * The renderer for the 45 coloured drawings — one `Svg`, N elements, no font.
 *
 * IT DELIBERATELY DOES NOT TAKE A `color`, AND THAT IS THE ONE CONTRACT THIS
 * FILE BREAKS. Every other glyph this app has ever drawn took its colour from
 * the call site (`Icon`'s `color` prop, "always a `getColors(scheme)` value").
 * A drawing that IS a carrot cannot: tinting it `textMuted` would produce a
 * grey carrot, which is not a muted icon but a different, worse drawing.
 *
 * WHAT THAT COSTS, NAMED RATHER THAN GLOSSED. `Chip.tsx` passed
 * `selected ? accentOnMuted : textPrimary`, so a selected chip's glyph used to
 * shift with the pill. It no longer does. That is survivable precisely because
 * `Chip`'s own header already argues the selected state IS the fill plus the
 * border — the glyph tint was reinforcement, never the signal. Anywhere the
 * tint IS the signal, the answer is a font glyph through `Icon`, not a
 * coloured drawing.
 *
 * THE SCHEME COMES FROM THE HOOK AND NOT FROM A PROP, for the same reason
 * `Chip` reads `useColorScheme()` itself: a caller that has to pass the scheme
 * is a caller that can forget, and a forgotten scheme here means an outline
 * the same colour as the page. palette.ts holds the two tables and the rule
 * that generates the second from the first.
 *
 * HIDDEN FROM ACCESSIBILITY, like every other glyph in this app: WS4 is
 * explicit that a decorative drawing beside a word adds nothing a screen
 * reader should hear, and the word beside it is already the label.
 */
import type { JSX } from 'react';
import { useColorScheme } from 'react-native';
import Svg, { Circle, Ellipse, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { ICON_ARTWORK, type IconArtworkElement } from './drawings';
import { iconPalette, type IconPaletteKey } from './palette';

/** Matches remyGlyphs.ts and both retired fonts, so `size` keeps meaning what it meant. */
const VIEW_BOX = '0 0 24 24';

/**
 * All 185 strokes in the source set `round` for both, and nothing sets
 * anything else — so they live here once instead of 185 times in drawings.ts.
 */
const CAP = 'round' as const;

export function hasIconArtwork(name: string): boolean {
  return ICON_ARTWORK[name] !== undefined;
}

interface IconArtworkProps {
  readonly name: string;
  readonly size: number;
}

export function IconArtwork(props: IconArtworkProps): JSX.Element | null {
  const { name, size } = props;
  const scheme = useColorScheme();
  const elements = ICON_ARTWORK[name];
  if (elements === undefined) {
    return null;
  }
  const palette = iconPalette(scheme === 'dark' ? 'dark' : 'light');
  const paint = (key: IconPaletteKey | undefined): string | undefined =>
    key === undefined ? undefined : palette[key];

  return (
    <Svg
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {elements.map((element, index) => renderElement(element, index, paint))}
    </Svg>
  );
}

/**
 * Keyed by index, which is normally the thing to avoid — and is correct here
 * for the reason the rule exists: this list is a CONSTANT. It never reorders,
 * never filters and never grows at runtime, so an index is a stable identity
 * rather than a guess at one.
 */
function renderElement(
  element: IconArtworkElement,
  index: number,
  paint: (key: IconPaletteKey | undefined) => string | undefined,
): JSX.Element {
  const common = {
    fill: paint(element.fill) ?? 'none',
    stroke: paint(element.stroke),
    strokeWidth: element.sw,
    strokeLinecap: CAP,
    strokeLinejoin: CAP,
    transform:
      element.rot === undefined
        ? undefined
        : `rotate(${element.rot[0]} ${element.rot[1]} ${element.rot[2]})`,
  };
  // ⚠ `key` IS PASSED EXPLICITLY AND IS NEVER PART OF `common`. React reads
  // `key` off the element before props exist, so spreading an object that
  // carries one both works and warns — "A props object containing a 'key'
  // prop is being spread into JSX", which is what the owner saw at the bottom
  // of his screen on 8 September 2026. It has to sit outside the spread, and
  // for the same reason it must come AFTER it in source order: a later
  // `{...common}` would put the key back into the props object it was just
  // taken out of.
  switch (element.k) {
    case 'path':
      return <Path {...common} key={index} d={element.d} />;
    case 'polyline':
      return <Polyline {...common} key={index} points={element.p} />;
    case 'polygon':
      return <Polygon {...common} key={index} points={element.p} />;
    case 'circle':
      return <Circle {...common} key={index} cx={element.cx} cy={element.cy} r={element.r} />;
    case 'ellipse':
      return (
        <Ellipse
          {...common}
          key={index}
          cx={element.cx}
          cy={element.cy}
          rx={element.rx}
          ry={element.ry}
        />
      );
    case 'rect':
      return (
        <Rect
          {...common}
          key={index}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rx={element.rx}
        />
      );
  }
}
