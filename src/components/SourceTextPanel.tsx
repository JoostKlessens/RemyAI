/**
 * IMP-09. Draws what `describeSourceText` decided; decides nothing itself.
 * The rule about when this may appear at all — including the PD-011 guard —
 * lives in sourceTextCopy.ts, where a test can reach it.
 *
 * WHY IT STARTS COLLAPSED. The text is a reference, not the content of the
 * screen. Somebody arrives here to TYPE a recipe, and a wall of source text
 * above the first field would push the thing they came to do below the
 * fold — on the one screen in this app most likely to be read one-handed in
 * a kitchen. Open on demand, and it stays open once opened, because the
 * whole point is reading it while filling the fields underneath.
 *
 * WHY THE TEXT IS `selectable`. Copying a line out of it beats retyping it,
 * and refusing that would leave the panel a picture of the answer. It is
 * deliberately NOT a "fill the fields for me" button: the whole text is
 * never what anyone wants in a title field, and a button that pre-filled
 * one would be the pre-filling this flow already refuses — see
 * allergenTaggingCopy.ts on why a pre-filled list gets rubber-stamped.
 *
 * WHY IT HAS ITS OWN SCROLL. A 4.000-character description inside a screen
 * that already scrolls would make the page interminable and the fields
 * unreachable. `nestedScrollEnabled` is what makes the inner one work on
 * Android; without it the outer ScrollView swallows the gesture and the
 * panel becomes a fixed window onto the first few lines.
 */

import { useState, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { describeSourceText } from '@/components/sourceTextCopy';
import type { ImportPlatform } from '@/domain/import/types';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

interface SourceTextPanelProps {
  readonly sourceText: string | null;
  readonly platform: ImportPlatform | null;
}

/** Tall enough to read a paragraph in, short enough that the first field stays reachable. */
const EXPANDED_MAX_HEIGHT = 220;

export function SourceTextPanel(props: SourceTextPanelProps): JSX.Element | null {
  const { sourceText, platform } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [isExpanded, setIsExpanded] = useState(false);
  const copy = describeSourceText({ sourceText, platform });

  // Null means render nothing — not an empty panel. See the copy module.
  if (copy === null) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSunken }]}>
      <Text style={[typeScale.label, styles.heading, { color: colors.textMuted }]}>{copy.heading}</Text>
      <Text style={[typeScale.bodySmall, styles.hint, { color: colors.textSecondary }]}>{copy.hint}</Text>

      <Pressable
        onPress={() => setIsExpanded((wasExpanded) => !wasExpanded)}
        accessibilityRole="button"
        // `expanded` rather than a label that bakes the state into words:
        // the platform announces expanded/collapsed in the user's own
        // language, and a hand-written Dutch equivalent would be a second
        // translation of something the OS already says.
        accessibilityState={{ expanded: isExpanded }}
        style={styles.toggle}
      >
        <Text style={[typeScale.bodySmall, { color: colors.accent }]}>
          {isExpanded ? copy.hideLabel : copy.showLabel}
        </Text>
      </Pressable>

      {isExpanded ? (
        <View style={styles.textBlock}>
          <ScrollView style={styles.textScroll} nestedScrollEnabled>
            <Text selectable style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
              {copy.text}
            </Text>
          </ScrollView>
          {/* Only ever rendered when the copy module says the text was
              capped, and it owns the sentence — a panel showing part of
              something while its heading promises the whole would be the
              quiet kind of wrong this codebase spends its comments on. */}
          {copy.truncationNotice !== null ? (
            <Text style={[typeScale.caption, styles.truncation, { color: colors.textMuted }]}>
              {copy.truncationNotice}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.radiusMd,
    padding: spacing.space4,
    // Owns the gap beneath it, like RecipeProvenanceNote above it: this
    // component renders nothing at all for most imports, and a wrapping
    // View carrying the margin would still occupy space on every screen
    // where the panel is absent.
    marginBottom: spacing.space5,
  },
  heading: {
    // Uppercased in style, never in the string — an ALL-CAPS value would
    // reach the accessibility label, where some screen readers spell it
    // out letter by letter.
    textTransform: 'uppercase',
    marginBottom: spacing.space2,
  },
  hint: {
    marginBottom: spacing.space3,
  },
  toggle: {
    // A tap target rather than a line of text: padding here, not margin,
    // so the touchable area matches what the eye reads as the control.
    paddingVertical: spacing.space2,
  },
  textBlock: {
    marginTop: spacing.space3,
  },
  textScroll: {
    maxHeight: EXPANDED_MAX_HEIGHT,
  },
  truncation: {
    marginTop: spacing.space2,
  },
});
