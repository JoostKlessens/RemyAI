/**
 * The six digits Supabase mails when the template carries `{{ .Token }}`,
 * read out of a text field and judged before a single request is spent.
 *
 * WHY THIS EXISTS AT ALL, GIVEN auth.ts ARGUED FOR THE LINK. It argued for
 * the link because a code "is not available to us": the code only appears in
 * the email if the template contains `{{ .Token }}`, and Supabase gates
 * template editing behind custom SMTP. That was true, and it stayed true —
 * as of 3 June 2026 a free-tier project on the default provider cannot edit
 * those templates at all. What changed is the premise, not the reasoning:
 * with custom SMTP configured the gate is gone, and that same header already
 * said a typed code is "the better fit for a phone app: no round trip out to
 * a mail client, no deep-link handling, identical behaviour on web and
 * native".
 *
 * IT ALSO REMOVES A CLASS OF FAILURE THAT COST A DAY. A link has to land
 * somewhere, and under Expo Go that somewhere embeds the dev server's host
 * AND PORT — so a second Metro instance taking 8082 instead of 8081 is
 * enough to make sign-in fail with no visible cause, because Supabase
 * silently drops a redirect that is not on its allowlist. A code has no
 * destination, and therefore no allowlist, no port and no network topology
 * to get wrong.
 *
 * WHY A READINESS VERDICT RATHER THAN A BOOLEAN. A verification spends a
 * request, and more to the point "you have typed four digits" and "you have
 * typed six letters" want different words on screen — a boolean forces the
 * caller to re-derive which case it is from the string it just handed over.
 * Same shape, and the same argument, as `readPastedText` in
 * src/domain/import/pastedTextLimits.ts.
 */

/** Supabase's email OTP is six digits. Named because two places compare against it. */
export const SIGN_IN_CODE_LENGTH = 6;

export type SignInCodeReadiness =
  /** Nothing typed yet. The initial state, and not an error to show anybody. */
  | 'empty'
  /** Fewer than six digits. Still being typed — never worth an error message. */
  | 'incomplete'
  /** More than six digits. Almost always a double paste. */
  | 'too_long'
  /** Something that is not digits. A pasted link, or the wrong field. */
  | 'not_numeric'
  /** Exactly six digits. The only state that may be submitted. */
  | 'ready';

export interface SignInCodeSubmission {
  /** The code with separators removed — what to send, never what was typed. */
  readonly code: string;
  readonly readiness: SignInCodeReadiness;
}

/**
 * WHITESPACE AND DASHES ARE STRIPPED, EVERYTHING ELSE IS NOT, and that
 * asymmetry is the point. A code copied out of a mail client arrives as
 * `123 456` or `123-456` often enough that refusing it would be refusing a
 * correct code for a reason nobody can see. But stripping every non-digit
 * would silently accept `abc123456xyz`, turning "you pasted the wrong thing"
 * into a rejection from Supabase that the user cannot act on. Tolerate the
 * formatting people actually produce; refuse the rest visibly.
 */
export function readSignInCode(raw: string): SignInCodeSubmission {
  const code = raw.replace(/[\s-]/g, '');

  if (code.length === 0) {
    return { code, readiness: 'empty' };
  }
  if (!/^\d+$/.test(code)) {
    return { code, readiness: 'not_numeric' };
  }
  if (code.length < SIGN_IN_CODE_LENGTH) {
    return { code, readiness: 'incomplete' };
  }
  if (code.length > SIGN_IN_CODE_LENGTH) {
    return { code, readiness: 'too_long' };
  }
  return { code, readiness: 'ready' };
}
