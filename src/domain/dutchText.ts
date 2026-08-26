/**
 * Dutch grammar the app has to get right in more than one place.
 *
 * WHY THIS FILE EXISTS. `joinDutchList` lived as a module-private in
 * src/components/friendFeedPresentation.ts, which was correct while the
 * friend feed was the only surface listing things in Dutch. It no longer
 * is: src/domain/reason.ts now names friends on Kiezen ("Sanne en Joris
 * hebben dit ook gemaakt"), and the domain must not import from
 * components. The choice was this file or a second copy of a grammar
 * rule, and a second copy is how "Sanne, Joris en Kees" and "Sanne, Joris
 * and Kees" end up on two screens of the same app.
 *
 * The feed's own tests still exercise it — friendFeedPresentation.ts
 * re-exports it — so the move changed no behaviour and no assertion.
 *
 * Pure, no I/O.
 */

/**
 * "noten", "noten en melk", "noten, melk en gluten".
 *
 * No Oxford comma before "en": Dutch does not take one, and the serial
 * comma is the single most common way English-language tooling makes
 * Dutch copy read as translated. An empty list is an empty string rather
 * than a placeholder, so a caller with nothing to say renders nothing at
 * all instead of a stray separator.
 *
 * Written by hand rather than with `Intl.ListFormat`: its locale data is
 * not guaranteed present in a React Native JS runtime, and a silent
 * English fallback would produce exactly the "noten, melk and gluten"
 * this function exists to prevent — on some devices and not others,
 * which is the worst way to find out.
 */
export function joinDutchList(items: readonly string[]): string {
  if (items.length === 0) {
    return '';
  }
  if (items.length === 1) {
    return items[0] ?? '';
  }
  const head = items.slice(0, -1).join(', ');
  return `${head} en ${items[items.length - 1] ?? ''}`;
}
