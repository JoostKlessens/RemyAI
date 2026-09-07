import { describe, expect, test } from 'vitest';
import {
  COOK_SHARING_ASK_BODY,
  COOK_SHARING_ASK_CONFIRM_LABEL,
  COOK_SHARING_ASK_CONTROL_HINT,
  COOK_SHARING_ASK_DECLINE_LABEL,
  COOK_SHARING_CONSEQUENCE,
  COOK_SHARING_SECTION_TITLE,
  COOK_SHARING_THIS_COOK_LABEL,
  COOK_SHARING_TOGGLE_LABEL,
  COOK_SHARING_UNREADABLE,
  buildCookSharingAskTitle,
  buildCookSharingThisCookAccessibilityLabel,
  buildCookSharingToggleAccessibilityLabel,
  describeCookSharingState,
} from '@/components/cookSharingCopy';

/**
 * These assertions are the consent contract, not copy taste. Each one
 * cites the decision it holds the copy to, so that a later rewrite that
 * quietly drops a disclosure fails here rather than shipping.
 *
 * DESIGN-SOCIAL.md §5 and PD-015 require the consequence in full
 * sentences BEFORE the control; PD-019 requires the household's own
 * cook_events.rating to be named as staying home, with the socially
 * visible number identified as a separate public vote; PD-006's
 * liability boundary bans safety framing anywhere in this product's copy.
 *
 * WHAT THE OWNER REVERSED, AND WHAT SURVIVED IT. The default flipped:
 * "it should be standard that you share it with friends". The DISCLOSURE
 * did not — the consequence is still four paragraphs of full sentences
 * before any control, still names the dietary inference plainly, and
 * still refuses a tooltip. So the sweeps below keep every assertion about
 * WHAT is disclosed, and only the two that asserted the old default are
 * turned around. That is the shape of the change, restated as tests: a
 * sentence claiming this is off unless you turn it on is now FALSE, and a
 * false sentence in a consent disclosure is worse than a missing one.
 */

const allConsentProse = [...COOK_SHARING_CONSEQUENCE, ...COOK_SHARING_ASK_BODY].join(' ').toLowerCase();

function isFullSentence(paragraph: string): boolean {
  return paragraph.endsWith('.') && paragraph.charAt(0) === paragraph.charAt(0).toUpperCase() && paragraph.length >= 60;
}

/**
 * `noUncheckedIndexedAccess` makes every array index `string | undefined`,
 * and calling `.toLowerCase()` on that would fail as a crash rather than
 * as a readable "paragraph 2 no longer names the inference". So each
 * addressed paragraph is asserted present first.
 */
function paragraphAt(paragraphs: readonly string[], index: number): string {
  const paragraph = paragraphs[index];
  expect(paragraph, `expected consent paragraph ${index} to exist`).toBeTypeOf('string');
  return (paragraph ?? '').toLowerCase();
}

describe('COOK_SHARING_CONSEQUENCE: the consequence stated before the control', () => {
  test('is prose in full sentences, not a label (DESIGN-SOCIAL.md §5: never a bare toggle)', () => {
    expect(COOK_SHARING_CONSEQUENCE.length).toBeGreaterThanOrEqual(4);
    for (const paragraph of COOK_SHARING_CONSEQUENCE) {
      expect(isFullSentence(paragraph)).toBe(true);
    }
  });

  test('names the audience as mutually accepted friends, never a wider pool', () => {
    expect(allConsentProse).toContain('geaccepteerd');
    expect(allConsentProse).not.toContain('iedereen ziet');
  });

  test('states that no timestamp and no count travel with a proof (PD-015)', () => {
    const exposure = paragraphAt(COOK_SHARING_CONSEQUENCE, 0);
    expect(exposure).toContain('datum');
    expect(exposure).toContain('aantal');
  });

  test('names what is NOT exposed, allergens first (PD-005 stays the Article 9 boundary)', () => {
    expect(allConsentProse).toContain('allergenen');
    expect(allConsentProse).toContain('planning');
    expect(allConsentProse).toContain('recepten');
  });

  test('states PD-019: the household grade stays home, a visible number is a separate public vote', () => {
    const notExposed = paragraphAt(COOK_SHARING_CONSEQUENCE, 1);
    expect(notExposed).toContain('cijfer');
    expect(notExposed).toContain('huishouden');
    expect(notExposed).toContain('openbare stem');
  });

  /**
   * The paragraph above used to end "Die brengt iemand apart uit op dat
   * recept" — the public vote is a separate, deliberate act. That stopped
   * being true the moment `handleRate` started casting one from the same
   * gesture that grades a cook, and a consent disclosure that describes a
   * write as optional when it is automatic is the worst kind of stale
   * comment: the reader relies on it to decide.
   */
  test('does not describe the public vote as a separate act — one gesture now casts it', () => {
    expect(allConsentProse).not.toContain('apart uit');
  });

  test('says the grade also becomes an anonymous public vote, and that it carries no name', () => {
    const notExposed = paragraphAt(COOK_SHARING_CONSEQUENCE, 1);
    expect(notExposed).toContain('gemiddelde');
    expect(notExposed).toContain('naam');
  });

  test('names the dietary inference plainly rather than burying it (DESIGN-SOCIAL.md §5)', () => {
    const risk = paragraphAt(COOK_SHARING_CONSEQUENCE, 2);
    expect(risk).toContain('aflezen');
    expect(/halal|vegetarisch|glutenvrij/.test(risk)).toBe(true);
  });

  test('no paragraph claims this is off unless you turn it on — the default is now on (0015)', () => {
    expect(allConsentProse).not.toContain('staat dit uit');
    expect(allConsentProse).not.toContain('staat nu uit');
    expect(allConsentProse).not.toContain('tot je het zelf aanzet');
  });

  test('still answers the inference with a mitigation, now the ask and the per-dish exclusion', () => {
    const risk = paragraphAt(COOK_SHARING_CONSEQUENCE, 2);
    expect(risk).toContain('per gerecht');
  });

  test('states that revoking is possible and retroactive (proof is assembled per read)', () => {
    const leaving = paragraphAt(COOK_SHARING_CONSEQUENCE, 3);
    expect(leaving).toContain('uitzetten');
    expect(leaving).toContain('verdwijnt');
  });

  test('never claims safety and never defers the consequence to a disclosure', () => {
    expect(allConsentProse).not.toContain('veilig voor');
    expect(allConsentProse).not.toContain('meer info');
    expect(allConsentProse).not.toContain('lees meer');
  });
});

describe('the control itself', () => {
  test('carries the switch wording DESIGN-SOCIAL.md §5 names', () => {
    expect(COOK_SHARING_TOGGLE_LABEL).toBe('Deel wat ik kook met vrienden.');
  });

  test('describes off as an actual state, so an unchecked control is never ambiguous', () => {
    expect(describeCookSharingState(false)).toBe('Staat uit. Vrienden zien niets van wat je kookt.');
    expect(describeCookSharingState(true)).toBe('Staat aan. Vrienden zien je naam bij recepten die je hebt gemaakt.');
  });

  test('the accessibility label carries the same consequence a sighted reader gets above it', () => {
    expect(buildCookSharingToggleAccessibilityLabel(false).toLowerCase()).toContain('vrienden');
    expect(buildCookSharingToggleAccessibilityLabel(false)).toContain(COOK_SHARING_TOGGLE_LABEL);
    expect(buildCookSharingToggleAccessibilityLabel(true)).toContain(describeCookSharingState(true));
  });

  test('has a section title that says what the section is about', () => {
    expect(COOK_SHARING_SECTION_TITLE.toLowerCase()).toContain('vrienden');
  });
});

describe('COOK_SHARING_UNREADABLE: the getter throwing must never render as "uit"', () => {
  test('says the setting could not be read, rather than showing a state', () => {
    expect(COOK_SHARING_UNREADABLE.toLowerCase()).toContain('niet lezen');
    expect(COOK_SHARING_UNREADABLE.toLowerCase()).not.toContain('staat uit');
  });
});

describe('the one-time contextual ask', () => {
  test('names the friendship that made the question relevant', () => {
    expect(buildCookSharingAskTitle('Meike')).toBe('Je bent nu bevriend met Meike.');
  });

  test('states the exposure and the non-exposure before any control, in full sentences', () => {
    expect(COOK_SHARING_ASK_BODY.length).toBeGreaterThanOrEqual(3);
    for (const paragraph of COOK_SHARING_ASK_BODY) {
      expect(isFullSentence(paragraph)).toBe(true);
    }
    const body = COOK_SHARING_ASK_BODY.join(' ').toLowerCase();
    expect(body).toContain('allergenen');
    expect(body).toContain('cijfer');
  });

  test('says the control is pre-checked and how to undo it, rather than claiming it is off', () => {
    const body = COOK_SHARING_ASK_BODY.join(' ').toLowerCase();
    expect(body).toContain('staat nu aan');
    expect(body).toContain('vinkje');
    expect(body).not.toContain('staat nu uit');
  });

  test('is asked once, not campaigned: points at Instellingen and promises no repeat', () => {
    const body = COOK_SHARING_ASK_BODY.join(' ').toLowerCase();
    expect(body).toContain('instellingen');
    expect(body).toContain('niet meer');
  });

  test('offers a decline that reads as a decision, not a postponement', () => {
    expect(COOK_SHARING_ASK_DECLINE_LABEL).toBe('Niet delen');
  });

  test('the hint tells you how to say no, because tapping the row no longer means yes', () => {
    expect(COOK_SHARING_ASK_CONTROL_HINT.toLowerCase()).toContain('vinkje');
    expect(COOK_SHARING_ASK_CONTROL_HINT.toLowerCase()).not.toContain('aan te zetten');
  });

  test('a pre-checked box needs a commit, so the sheet has one and it is the app’s existing word', () => {
    expect(COOK_SHARING_ASK_CONFIRM_LABEL).toBe('Klaar');
  });
});

/**
 * The per-cook checkbox on `OutcomeCard` — the owner's "small checkbox
 * that you can tap not to share you made a recipe".
 *
 * It lives in this module rather than inline on the card for the reason
 * the module header gives: this text IS the consent, and a fourth surface
 * writing its own words for the same disclosure is one edit away from
 * disagreeing with the other three about what a household agreed to.
 */
describe('the per-cook checkbox', () => {
  test('is one short sentence, phrased as what sharing DOES, not as a setting name', () => {
    expect(COOK_SHARING_THIS_COOK_LABEL.endsWith('.')).toBe(true);
    expect(COOK_SHARING_THIS_COOK_LABEL.toLowerCase()).toContain('vrienden');
    // One sentence. Two would not fit beside a checkbox on this card, and
    // the card's own header treats its height as a hard constraint.
    expect(COOK_SHARING_THIS_COOK_LABEL.split('.').filter((part) => part.trim().length > 0)).toHaveLength(1);
  });

  test('checked means shared: the box is never phrased as "deel dit niet"', () => {
    // A checkbox whose checked state means "withhold" reads backwards
    // against every other consent row in this product, where checked is
    // consent given.
    expect(COOK_SHARING_THIS_COOK_LABEL.toLowerCase()).not.toContain('niet');
  });

  test('the spoken label states the consequence of the state it is in, both ways', () => {
    const shared = buildCookSharingThisCookAccessibilityLabel(true);
    const withheld = buildCookSharingThisCookAccessibilityLabel(false);
    expect(shared).toContain(COOK_SHARING_THIS_COOK_LABEL);
    expect(withheld).toContain(COOK_SHARING_THIS_COOK_LABEL);
    expect(shared).not.toBe(withheld);
    expect(withheld.toLowerCase()).toContain('huishouden');
  });

  test('never claims safety and never names a grade — this row governs proof, not the vote (PD-015)', () => {
    const both = `${buildCookSharingThisCookAccessibilityLabel(true)} ${buildCookSharingThisCookAccessibilityLabel(false)} ${COOK_SHARING_THIS_COOK_LABEL}`.toLowerCase();
    expect(both).not.toContain('veilig');
    expect(both).not.toContain('cijfer');
  });
});
