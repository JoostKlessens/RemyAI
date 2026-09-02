/**
 * THE ONE QUESTION THE IMPORT SCREEN ASKS, AND THE ONE FIELD THAT ANSWERS
 * IT: which kind of source are you handing over, and here it is.
 *
 * Extracted out of src/app/import/paste.tsx when SRC-08 gave that screen a
 * second source. The immediate reason was that file's hard 800-line
 * ceiling, but the split fell along a real seam and the seam is worth
 * naming: everything below is A QUESTION AND ITS ANSWER, holding no state
 * and knowing nothing about requests, loading, failures or navigation. The
 * screen owns all of that and is the only thing that can.
 *
 * WHY THE MODE IS A PROP AND NOT A `useState` IN HERE. The mode decides
 * which BODY the screen posts (`{ url }` or `{ text }`, never both — see
 * supabase/functions/parse-recipe/importRequest.ts), so it is the screen's
 * fact about a request, not this component's fact about a control. A mode
 * owned here would be a second copy of it, and two copies disagreeing for
 * one render is precisely how a request gets built out of the field the
 * user is no longer looking at.
 *
 * EXACTLY ONE INPUT IS RENDERED — never two with one disabled, never one
 * that quietly changes meaning. The wire contract is "exactly one of url or
 * text", and a screen showing one box is the visible form of that; two
 * boxes would invite somebody to fill both and then need a rule for which
 * one wins, which is the rule the edge function deliberately refuses to
 * have.
 *
 * NOT ONE `TextInput` WITH BRANCHING PROPS, EITHER. The two differ in six
 * places — keyboard, capitalisation, autocorrect, return key, height, and
 * whether return submits at all — and each of those is a decision worth
 * reading on its own line. A single element carrying six ternaries is the
 * same component with its argument hidden.
 *
 * EVERY SENTENCE HERE COMES FROM importPasteCopy.ts. The only Dutch written
 * in this file is "Plak uit klembord", which does not branch; the copy that
 * differs per mode lives where a test can hold it to its route, and a
 * component that started writing its own would be the exact drift that
 * module exists to prevent.
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import {
  IMPORT_SOURCE_MODES,
  IMPORT_SOURCE_MODE_SWITCH_ACCESSIBILITY_LABEL,
  PASTED_TEXT_TOO_LONG_MESSAGE,
  buildImportSourceModeCopy,
  type ImportSourceMode,
  type ImportSourceModeCopy,
} from './importPasteCopy';
import { SegmentedControl, type SegmentedControlOption } from './SegmentedControl';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

/**
 * The mode switch's two segments, built from the copy module's own list so
 * a third mode cannot appear in one place and not the other. Module level
 * rather than per render: the options depend on nothing, and rebuilding the
 * array on every keystroke would hand `SegmentedControl` a new object each
 * time.
 */
const SOURCE_MODE_OPTIONS: readonly SegmentedControlOption<ImportSourceMode>[] = IMPORT_SOURCE_MODES.map((mode) => ({
  value: mode,
  label: buildImportSourceModeCopy(mode).segmentLabel,
}));

/**
 * The pasted-recipe field's height, in points, as a named pair rather than
 * two numbers in a stylesheet. Deliberately not on the spacing scale: this
 * is a reading area sized to its content — roughly six lines to start,
 * about a dozen at full stretch — which is the same local-constant
 * precedent TimerDisplay.tsx sets for its circle.
 */
const PASTED_TEXT_INPUT_MIN_HEIGHT = 140;
const PASTED_TEXT_INPUT_MAX_HEIGHT = 280;

const CLIPBOARD_ICON_SIZE = 16;

export interface ImportSourceFieldProps {
  readonly mode: ImportSourceMode;
  readonly onModeChange: (mode: ImportSourceMode) => void;
  readonly url: string;
  readonly onUrlChange: (url: string) => void;
  readonly pastedText: string;
  readonly onPastedTextChange: (text: string) => void;
  /**
   * Whether the paste is past the cap the import pipeline will read. The
   * SCREEN decides this (`readPastedText`, src/app/import/pastedTextLimit.ts)
   * and this component renders the sentence, so the limit lives in exactly
   * one place and a component-layer file takes no dependency on an app
   * route's module.
   */
  readonly isPastedTextTooLong: boolean;
  /**
   * An import is in flight: the field goes read-only, and the mode switch is
   * not rendered at all. Hiding rather than disabling follows the precedent
   * the paste screen's own secondary action sets — with an answer on its
   * way the question is settled, and a control that would silently refuse
   * the tap is worse than one that is not there.
   */
  readonly isBusy: boolean;
  /** The link keyboard's "go". Never wired to the text field: return is a NEWLINE in a recipe. */
  readonly onSubmitLink: () => void;
  readonly onPasteFromClipboard: () => void;
}

export function ImportSourceField(props: ImportSourceFieldProps): JSX.Element {
  const { mode, onModeChange, isPastedTextTooLong, isBusy, onPasteFromClipboard } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const copy = buildImportSourceModeCopy(mode);

  return (
    <View>
      {isBusy ? null : (
        <View style={styles.modeSwitch}>
          <SegmentedControl
            options={SOURCE_MODE_OPTIONS}
            value={mode}
            onChange={onModeChange}
            accessibilityLabel={IMPORT_SOURCE_MODE_SWITCH_ACCESSIBILITY_LABEL}
          />
        </View>
      )}

      <Text style={[typeScale.bodySmall, styles.subtitle, { color: colors.textMuted }]}>{copy.subtitle}</Text>

      {mode === 'text' ? (
        <PastedTextInput
          value={props.pastedText}
          onChangeText={props.onPastedTextChange}
          copy={copy}
          isBusy={isBusy}
        />
      ) : (
        <LinkInput
          value={props.url}
          onChangeText={props.onUrlChange}
          onSubmit={props.onSubmitLink}
          copy={copy}
          isBusy={isBusy}
        />
      )}

      {/*
        THE CAP, MET AS COPY RATHER THAN AS A STATUS CODE. It appears while
        the user is still holding the text, and the screen refuses its
        submit button for as long as it shows — so an over-long paste is
        never sent, and the 400 the edge function would answer with is
        unreachable from this screen. `polite` rather than `assertive`
        because nothing has failed: the user is mid-paste, and this is an
        instruction, not an error.
      */}
      {mode === 'text' && isPastedTextTooLong ? (
        <Text
          style={[typeScale.bodySmall, styles.inputNotice, { color: colors.textSecondary }]}
          accessibilityLiveRegion="polite"
        >
          {PASTED_TEXT_TOO_LONG_MESSAGE}
        </Text>
      ) : null}

      <Pressable
        onPress={onPasteFromClipboard}
        accessibilityRole="button"
        accessibilityLabel={copy.clipboardAccessibilityLabel}
        style={styles.pasteRow}
      >
        <Feather name="clipboard" size={CLIPBOARD_ICON_SIZE} color={colors.textSecondary} />
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Plak uit klembord</Text>
      </Pressable>
    </View>
  );
}

interface LinkInputProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly onSubmit: () => void;
  readonly copy: ImportSourceModeCopy;
  readonly isBusy: boolean;
}

/** One line, a URL keyboard, and a return key that submits — a link is a single token and typing one is a chore worth shortening. */
function LinkInput(props: LinkInputProps): JSX.Element {
  const { value, onChangeText, onSubmit, copy, isBusy } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={copy.placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType="url"
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="go"
      editable={!isBusy}
      style={[
        typeScale.body,
        styles.input,
        { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityLabel={copy.inputAccessibilityLabel}
    />
  );
}

interface PastedTextInputProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly copy: ImportSourceModeCopy;
  readonly isBusy: boolean;
}

/**
 * The same bordered box as the link field, given room to be read in.
 *
 * NO `onSubmitEditing` AND NO `returnKeyType`, which is the one prop
 * difference that costs data rather than polish: return is a NEWLINE in a
 * recipe, and a keyboard that submitted on it would cut a paste off at its
 * first line break — silently, since a one-line paste is a perfectly valid
 * request. Submitting is the footer button's job on this route.
 *
 * `autoCorrect` is left on, unlike the link field. This is prose, often
 * typed by hand off a photo, where autocorrect helps; on a URL it only ever
 * damages one.
 */
function PastedTextInput(props: PastedTextInputProps): JSX.Element {
  const { value, onChangeText, copy, isBusy } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={copy.placeholder}
      placeholderTextColor={colors.textMuted}
      multiline
      textAlignVertical="top"
      autoCapitalize="sentences"
      editable={!isBusy}
      style={[
        typeScale.body,
        styles.input,
        styles.pastedTextInput,
        { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityLabel={copy.inputAccessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  modeSwitch: {
    marginTop: spacing.space4,
  },
  subtitle: {
    marginTop: spacing.space4,
    marginBottom: spacing.space5,
  },
  input: {
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
  /**
   * Tall enough that a pasted recipe reads as a recipe rather than as one
   * line scrolling past, and capped so the field never pushes the loading
   * checkpoints and the failure panel off the screen. This is one input on
   * a short screen, not a document editor.
   */
  pastedTextInput: {
    minHeight: PASTED_TEXT_INPUT_MIN_HEIGHT,
    maxHeight: PASTED_TEXT_INPUT_MAX_HEIGHT,
    paddingVertical: spacing.space3,
  },
  inputNotice: {
    marginTop: spacing.space2,
  },
  pasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
    minHeight: spacing.touchTargetMin,
    marginTop: spacing.space2,
  },
});
