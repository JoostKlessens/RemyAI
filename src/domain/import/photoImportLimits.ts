/**
 * WHAT A PHOTOGRAPHED RECIPE MAY BE — decided once, for both ends of the
 * wire. SRC-07's answer to the question pastedTextLimits.ts answers for
 * SRC-08, and deliberately built to the same shape, because it is the same
 * shape of problem: content the CALLER chooses, handed to a metered model on
 * this project's own account.
 *
 * Read pastedTextLimits.ts first. Everything it argues about WHY a cap
 * exists at all — an unbounded input is "not a crash and not a slow request,
 * it is an invoice somebody else gets to write" — and about why a shared
 * limit has to live in one module both runtimes reach applies here unchanged
 * and is not repeated. What follows is only what differs, and three things
 * do.
 *
 * ---
 *
 * 1. THE RETENTION DECISION, WHICH IS THE ONE A REVIEWER SHOULD READ FIRST.
 *
 * THE IMAGE IS NEVER STORED. Not in `recipes`, not in `meals`, not in
 * Supabase Storage, not in a log line, not in a navigation param, and not on
 * disk anywhere. It is read into memory by the picker, posted once, handed to
 * Gemini once, and dropped. The only copy that outlives the import is the one
 * that was already in the user's own camera roll before Remy was opened, and
 * that copy is theirs and was never ours.
 *
 * WHY, GIVEN THAT KEEPING IT WOULD BUY REAL THINGS. It would buy a thumbnail
 * for the library tile — a photograph of the actual page, which is a nicer
 * tile than the monogram fallback docs/DESIGN.md §2 specifies. It would buy a
 * "here is what Remy read" panel on the failure screen, which is exactly what
 * `no_recipe_in_caption` carries its caption for (IMP-09). It would buy
 * re-extraction without re-photographing. Those are not nothing.
 *
 * They are refused because of WHAT A PHOTOGRAPH OF A KITCHEN TABLE ACTUALLY
 * CONTAINS. A caption is a public post. A pasted text is a string the user
 * chose character by character. A photograph is whatever was in frame: the
 * rest of the page, the facing page, a hand, a child, a prescription on the
 * counter, a window with a street behind it. The user framed a recipe; they
 * did not consent to a filing cabinet. PD-005 makes a household's dietary
 * data Article 9 data and keeps it off surfaces it does not belong on, and an
 * image store filling up with photographs taken inside people's homes is a
 * far larger version of that same question — one with a retention schedule, a
 * deletion path, an erasure-request story and a breach story attached, none
 * of which this feature has or needs.
 *
 * THE CHEAPEST SECURE STORE IS THE ONE THAT DOES NOT EXIST. Storing nothing
 * is not caution for its own sake; it is the only version of this feature
 * whose privacy properties can be stated in one sentence and then VERIFIED BY
 * READING THE CALL GRAPH, rather than by auditing a bucket's lifecycle rules
 * and hoping they were applied.
 *
 * WHAT THE CODE ACTUALLY DOES, SO THE COMMENT IS CHECKABLE:
 *  - the edge function receives base64 in a request body, passes it to
 *    `buildPhotoExtractionRequest`, and holds no reference to it afterwards.
 *    Nothing under supabase/functions/parse-recipe/** writes it anywhere, and
 *    `respondWithImportResult` could not echo it even by accident, because
 *    `ImportResult` has no field it would fit in.
 *  - `no_recipe_in_photo` (importResult.ts) carries NO image and no
 *    transcript, which is the result shape making this policy
 *    unrepresentable rather than merely unpractised.
 *  - the paste screen keeps the base64 in component state ONLY, for as long
 *    as that screen lives, so "Opnieuw proberen" re-sends the same photograph
 *    instead of asking for it again. It never reaches a router param, so it
 *    never reaches the confirmation screen and never enters navigation
 *    history.
 *
 * THE ONE COST, SAID OUT LOUD: a photo import produces a meal with no
 * thumbnail, and its failure panel has nothing to show the user. Both are the
 * honest consequence of the paragraph above and neither is worked around.
 *
 * ---
 *
 * 2. THE CAP IS BYTES, AND UNLIKE THE TEXT CAP IT IS NOT WHAT BOUNDS THE
 *    BILL.
 *
 * pastedTextLimits.ts counts characters because tokens follow characters, so
 * that cap IS the cost cap. Image tokens do not follow bytes: Gemini charges
 * an image by its tiled RESOLUTION, so a 200 KB photo and an 8 MB photo of
 * the same page at the same pixel dimensions cost the same to read. Bytes
 * bound the TRANSPORT — the request body, base64's inflation, the isolate's
 * memory — which makes this the `MAX_RECIPE_PAGE_BYTES` kind of defence
 * (htmlJsonLd.ts) and not the token kind. Each cap in this directory still
 * counts the unit its own cost is billed in; this one just protects a
 * different bill, and saying so stops the next reader concluding the two caps
 * are inconsistent.
 *
 * What bounds the TOKEN cost instead is the capture itself: the screen asks
 * the OS picker for a compressed copy at a stated quality
 * (`IMPORT_PHOTO_CAPTURE_QUALITY` below). That is a decision about what is
 * sent, so it is stated here beside the cap rather than buried in a picker
 * call nothing can hold to an argument.
 *
 * 8 MiB, AND THE SHAPE OF THAT NUMBER MATTERS MORE THAN ITS DIGITS. A
 * 12-megapixel phone photograph re-encoded at the quality below runs roughly
 * 0.5–1.5 MB; an iPhone HEIC of a book page somewhat more; a scanning app's
 * export of a two-page spread more again. This sits five or more times above
 * the worst legitimate photograph we expect to meet — the same posture the
 * text cap takes, and for the same reason: generous enough that nobody
 * legitimate reaches it, finite enough that nobody hostile picks the number.
 * It also leaves Gemini's inline-data ceiling (20 MB for the whole request)
 * comfortable after base64's 4/3 inflation — 8 MiB becomes about 11.2 MB on
 * the wire, with the prompt and the tool schema still to fit.
 *
 * NOTHING IS RE-COMPRESSED TO FIT. That is pastedTextLimits.ts's posture
 * applied to pixels: an over-cap photograph is REFUSED WITH A SENTENCE, in
 * Dutch, under the button, before a request exists. Silently downscaling it
 * until it fitted would be the image version of truncating a paste — it would
 * change what the model reads without telling the person whose recipe it is —
 * and the first thing a further downscale destroys is exactly what this
 * feature turns on: small print, fractions, the difference between a 3 and
 * an 8.
 *
 * ---
 *
 * 3. THE FORMAT LIST IS NOT A PREFERENCE, IT IS GEMINI'S.
 *
 * `ACCEPTED_IMPORT_PHOTO_MIME_TYPES` is exactly the set the extraction model
 * accepts as `inlineData`. Sending anything else earns a 400 from Gemini,
 * which reaches the user as a blanket "Even niet gelukt" — a round trip paid
 * for in order to learn something both ends already knew. So the check runs on
 * the client (as a sentence) and again at the boundary (as a 400): the same
 * two enforcements, with the same division of labour, that the text cap has.
 *
 * ---
 *
 * PURE, TOTAL AND CLOCK-FREE, per src/domain's rule: no I/O, no network, no
 * `Date.now()`, and no input its signature admits can make it throw. Refusal
 * is a returned value, never an exception. In particular this module never
 * DECODES the base64 it is handed — it measures it — because allocating a
 * possibly-hostile 8 MB buffer in order to discover that it is too big is the
 * exact expense the cap exists to prevent.
 */

/**
 * The largest photograph either side of the wire will accept, in DECODED
 * bytes. See the file header for why bytes, why this many, and why nothing is
 * re-compressed to squeeze under it.
 */
export const MAX_IMPORT_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * What the picker is asked for, on a 0–1 scale, at the moment of capture.
 *
 * IT LIVES HERE RATHER THAN AT THE PICKER CALL because it is a statement
 * about what is SENT — the same class of decision as the cap beside it — and
 * because a quality set inline in a component is a quality no test can reach
 * and no comment is attached to.
 *
 * 0.7 AND NOT 1.0. A recipe photograph is read for its glyphs, and JPEG at
 * 0.7 preserves glyph edges on a page shot at arm's length while roughly
 * halving the bytes against 0.9. Sending 1.0 would spend several megabytes on
 * grain without yielding one more legible character.
 *
 * 0.7 AND NOT 0.4, WHICH IS THE MORE IMPORTANT HALF OF THE CHOICE.
 * Compression artefacts eat thin strokes first, and thin strokes are
 * fractions, decimal points, and the crossbar that separates a 7 from a 1.
 * The failure this feature must not have is a confidently wrong quantity, so
 * the quality floor sits where the NUMBERS survive rather than where the file
 * is smallest.
 *
 * THIS IS THE ONE REDUCTION EVER APPLIED TO A USER'S IMAGE, IT IS APPLIED
 * ONCE, AT CAPTURE, AND IT IS NEVER APPLIED AGAIN AS A RETRY. Nothing
 * anywhere re-encodes a photograph that came back over the cap — see the file
 * header.
 */
export const IMPORT_PHOTO_CAPTURE_QUALITY = 0.7;

/**
 * The image formats the extraction model reads as inline data, and therefore
 * the only ones worth sending.
 *
 * ENUMERATED RATHER THAN APPROXIMATED WITH `startsWith('image/')`, which is
 * the tempting one-liner and is wrong: `image/gif`, `image/bmp`, `image/tiff`
 * and `image/svg+xml` all match that prefix and all produce a paid-for 400.
 *
 * HEIC AND HEIF ARE NOT OPTIONAL MEMBERS. They are what an iPhone camera roll
 * actually holds by default, so a list without them would refuse the single
 * most common photograph this feature will ever be handed.
 */
export const ACCEPTED_IMPORT_PHOTO_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * The four states a selected photograph can be in.
 *
 * `'empty'`, `'unsupported_type'` and `'too_large'` are three refusals rather
 * than one, for the reason `PastedTextReadiness` gives for splitting two: the
 * callers do genuinely different things with them. An empty selection is the
 * screen's resting state and deserves no sentence at all.
 *
 * THE OTHER TWO ARE SPLIT BECAUSE THE ADVICE DIFFERS, WHICH IS THE ONLY
 * REASON WORTH SPLITTING FOR. "This is not a kind of image Remy can read" is
 * answered by choosing a different file; "this photo is too big" is answered
 * by taking a new one. A single merged "something is wrong with this photo"
 * would give the wrong instruction about half the time, and the wrong
 * instruction is worse than a vague one because the user follows it.
 */
export type ImportPhotoReadiness = 'empty' | 'unsupported_type' | 'too_large' | 'ready';

export interface ImportPhotoSubmission {
  readonly readiness: ImportPhotoReadiness;
  /**
   * The decoded size of the base64 payload, in bytes — the number that was
   * measured, exposed so no caller has to recompute it and reach a different
   * answer. Zero in the `'empty'` state.
   *
   * Present in every state, including the refusals, on the same reasoning
   * `PastedTextSubmission.text` is: there is nothing to hide about a
   * photograph that is too large, and a caller narrowing on `readiness` is
   * clearer than one narrowing on a nullable number.
   */
  readonly byteLength: number;
}

/**
 * What a caller hands over: the two facts about an image that decide whether
 * it may be sent.
 *
 * THE BASE64 ITSELF RATHER THAN A FILE SIZE THE PICKER REPORTED, and that is
 * `readPastedText`'s "measure the string you will send" rule restated for a
 * payload that inflates. `ImagePickerAsset.fileSize` describes a file on
 * disk; what leaves the device is the base64 of a re-encoded copy, and the
 * two are not the same number. Measuring the string that is actually sent is
 * what lets the client and the edge function reach the same verdict about the
 * same photograph — which is the entire reason this module, like
 * pastedTextLimits.ts, exists at all rather than being a shared constant.
 */
export interface ImportPhotoInput {
  /** As reported by the picker, or by the request body at the boundary. Compared case-insensitively; anything outside the list above is refused. */
  readonly mimeType: string | null;
  /** Standard base64, with no `data:` prefix. The exact string that goes on the wire. */
  readonly base64: string;
}

/**
 * How many bytes a base64 string decodes to, WITHOUT DECODING IT.
 *
 * Four base64 characters encode three bytes, and each `=` of padding stands
 * for one byte that is not there. So the answer is `floor(len / 4) * 3` minus
 * the padding, exactly, for any well-formed input.
 *
 * WHY NOT `atob(...).length` OR A `Buffer`. Both ALLOCATE the decoded image
 * in order to measure it — an 11 MB string becoming an 8 MB buffer inside an
 * edge isolate, which is precisely the memory this cap defends. `Buffer` also
 * exists in neither Deno nor React Native, and this module has to give the
 * same answer in both. Arithmetic on a length is total, allocation-free, and
 * available everywhere.
 *
 * WHITESPACE IS NOT STRIPPED, and the consequence is stated rather than
 * hidden: a base64 string carrying line breaks (some encoders wrap at 76
 * characters) measures slightly LARGER than it decodes to, so such a payload
 * meets the cap slightly early. That is the safe direction — it cannot admit
 * an over-cap image — and both ends measure the identical string, so neither
 * can hold a different opinion about the same photograph. That agreement is
 * the property that matters here, not the last few hundred bytes.
 */
export function decodedBase64ByteLength(base64: string): number {
  const length = base64.length;
  if (length === 0) {
    return 0;
  }
  let padding = 0;
  if (base64.endsWith('==')) {
    padding = 2;
  } else if (base64.endsWith('=')) {
    padding = 1;
  }
  return Math.max(0, Math.floor(length / 4) * 3 - padding);
}

/**
 * Classify a selected photograph: the whole of the shared agreement, in one
 * function both runtimes call.
 *
 * THE ORDER OF THE CHECKS IS THE ORDER OF THE ANSWERS' USEFULNESS. Empty
 * first, because there is nothing yet to say anything about. Then the TYPE,
 * before the size — a 30 MB video picked by mistake should be told it is not
 * an image Remy reads, not that it is too big, because the second sentence
 * invites the user to go and shoot a shorter video.
 *
 * THE BOUNDARY IS INCLUSIVE, exactly as `readPastedText`'s is: a photograph
 * of precisely `MAX_IMPORT_PHOTO_BYTES` is ready. Stated here rather than
 * left to each caller's `>` versus `>=`, which is the one-character
 * disagreement two separate implementations are always free to have.
 */
export function readImportPhoto(input: ImportPhotoInput): ImportPhotoSubmission {
  const byteLength = decodedBase64ByteLength(input.base64);
  if (byteLength === 0) {
    return { readiness: 'empty', byteLength: 0 };
  }
  if (!isAcceptedImportPhotoMimeType(input.mimeType)) {
    return { readiness: 'unsupported_type', byteLength };
  }
  if (byteLength > MAX_IMPORT_PHOTO_BYTES) {
    return { readiness: 'too_large', byteLength };
  }
  return { readiness: 'ready', byteLength };
}

/**
 * Exported separately from `readImportPhoto` because the picker answers with
 * a MIME type long before there is a base64 string to measure, and a screen
 * that has to synthesise an empty payload in order to ask "would you accept
 * this kind of file" is a screen inventing a request.
 *
 * THE COMPARISON IS LOWERCASED AND PARAMETER-FREE. Content types are
 * case-insensitive by RFC and the two platforms' pickers do not agree on
 * case; a `;charset=` or `;codecs=` suffix is legal and meaningless here.
 * Normalising both away is not leniency, it is reading the header correctly —
 * the strict alternative refuses a perfectly good `IMAGE/JPEG` for a reason
 * no user could ever discover.
 *
 * `null` IS NOT ACCEPTED. The picker's `mimeType` is optional and can be
 * absent, and a caller might read that as "probably a JPEG", because it
 * usually is. It must not: guessing a content type is guessing what the model
 * will be handed, and Gemini refuses the whole request on a mismatch anyway,
 * so the guess buys a paid round trip and a misleading failure. An unknown
 * type is an unsupported one, and the copy for that refusal
 * (photoImportCopy.ts) is deliberately written to be true of both.
 */
export function isAcceptedImportPhotoMimeType(mimeType: string | null): boolean {
  if (mimeType === null) {
    return false;
  }
  const normalized = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  return ACCEPTED_IMPORT_PHOTO_MIME_TYPES.includes(normalized);
}
