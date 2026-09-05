/**
 * WHAT THE PASTE SCREEN SAYS WHILE A PHOTOGRAPH IS BEING CHOSEN (SRC-07).
 *
 * The same rule importPasteCopy.ts, importFailureCopy.ts and
 * recipeProvenanceCopy.ts each state for themselves: a Dutch sentence written
 * inline in a `.tsx` is a sentence no test can hold to its route, and route
 * modules under src/app/** cannot be imported by vitest at all. This codebase
 * has shipped unwired features that way before and its comments say so.
 *
 * ---
 *
 * THIS IS THE SECOND OF TWO FILES, AND THE SPLIT IS ALONG A REAL SEAM.
 *
 * Everything that BRANCHES ON THE MODE lives in src/components/
 * importPasteCopy.ts with its two siblings — the segment label, the subtitle,
 * the manual-entry escape hatch, the start-over label, the loading
 * checkpoints. That module's header argues at length for keeping those
 * together: the mode copy and the loading narration are two statements of one
 * fact made seconds apart, and split across files each could be correct alone
 * while the pair contradict each other. Adding a third mode does not weaken
 * that argument, so nothing was moved out of it.
 *
 * WHAT IS HERE IS WHAT BRANCHES ON A LIMIT OR A PERMISSION, and every one of
 * those decisions lives in this directory. `PHOTO_TOO_LARGE_MESSAGE` and
 * `PHOTO_UNSUPPORTED_TYPE_MESSAGE` are the user-facing half of exactly the two
 * refusals `readImportPhoto` produces (photoImportLimits.ts, one import away);
 * the permission sentences are about an OS dialog, not about a mode. Putting
 * them beside the numbers and the states they describe is the same adjacency
 * that keeps the paste cap and its Dutch sentence honest, and
 * src/domain/decisionNotificationCopy.ts is the standing precedent for a copy
 * module here.
 *
 * NO REACT NATIVE IMPORT APPEARS BELOW, on purpose, so this runs under
 * vitest's `node` environment and every sentence can be asserted.
 *
 * ---
 *
 * WHAT EVERY SENTENCE BELOW IS HELD TO.
 *
 * NO SENTENCE CLAIMS WORK REMY DID NOT DO. That is the paste screen's whole
 * copy discipline ("a spinner that resolves into nothing"), and it binds this
 * route hardest, because this is where the most tempting lies are available:
 * that Remy "scanned" the page, that it "recognised" the recipe, that it kept
 * the picture. It read one photograph, once, with a model, and then threw it
 * away.
 *
 * NO SENTENCE NAMES A CONTAINER OR A FORMAT IT DOES NOT HAVE TO — the rule
 * importPasteCopy.ts's header states, paid for twice already in
 * importFailureCopy.ts. A cookbook, an index card, a magazine and a screenshot
 * are the same thing here: a photograph with a recipe on it.
 *
 * NOTHING BELOW STATES A NUMBER. Not the byte cap, not the capture quality,
 * not a pixel count. `PASTED_TEXT_TOO_LONG_MESSAGE` argues that at length for
 * the text route — a stated shortfall invites somebody to shave at the wrong
 * end — and it is stronger here, because no user can act on megabytes. The
 * sentence asks for the thing that actually fixes it: take the photo again.
 */

/**
 * The two ways to produce a photograph, as two buttons rather than one button
 * and an action sheet.
 *
 * BOTH VISIBLE AT ONCE, WHICH IS THE SEGMENTED CONTROL'S OWN ARGUMENT ONE
 * LEVEL DOWN: the choice between "the book is open in front of me" and "I
 * photographed it last week" is one the user made before they reached this
 * screen, and a control showing both answers at equal weight lets them act on
 * it in one tap. A sheet would add a tap to every import to save one row.
 *
 * THE CAMERA IS FIRST because it is the case SRC-07 was requested for: the
 * cookbook open on the counter. The library is second and is not a fallback —
 * a screenshot somebody was sent is just as much this route's business.
 */
export const PHOTO_CAMERA_LABEL = 'Foto maken';
export const PHOTO_CAMERA_ACCESSIBILITY_LABEL = 'Foto maken van het recept met de camera';
export const PHOTO_LIBRARY_LABEL = 'Foto kiezen';
export const PHOTO_LIBRARY_ACCESSIBILITY_LABEL = 'Een foto van het recept kiezen uit je fotoʼs';

/** The same two actions once a photo is already held — said as a replacement rather than as a first choice. */
export const PHOTO_REPLACE_CAMERA_LABEL = 'Opnieuw fotograferen';
export const PHOTO_REPLACE_LIBRARY_LABEL = 'Andere foto kiezen';

/**
 * What the screen shows once a photograph is in hand and before it is sent.
 *
 * IT IS A SENTENCE AND NOT A THUMBNAIL, which is the one place this route's
 * copy does a job a picture would normally do. Rendering the selected image is
 * the obvious design and it is refused for a reason worth writing down: it
 * makes the photograph a thing the app DISPLAYS, which invites the next
 * reasonable step — keep it, show it on the confirm screen, use it as the
 * meal's tile — and every one of those is the retention decision
 * (photoImportLimits.ts) being unpicked one screen at a time. The user knows
 * what they just photographed. Confirming that Remy has it, and that it is
 * about to be read once, is all this line owes them.
 *
 * "Klaar om te lezen" rather than "Foto toegevoegd": nothing has been added to
 * anything. It is held, briefly, to be read.
 */
export const PHOTO_SELECTED_MESSAGE = 'Foto klaar om te lezen. Je kunt hem hieronder vervangen.';

/**
 * Shown when the OS refuses the camera. This is not an error and must not read
 * as one: the user was asked and said no — possibly a year ago, possibly while
 * thinking about something else entirely.
 *
 * IT NAMES THE FIX AND DOES NOT NAG. One clause saying where the switch is,
 * and — crucially — one saying the other way still works, because the user's
 * actual goal is a recipe in their list and Remy has two other ways to get
 * one. Copy that treats a declined permission as a dead end teaches people
 * that saying no breaks the app, which is how an app ends up asking twice.
 *
 * NO DEEP LINK TO SETTINGS IS PROMISED. The sentence says where to look; it
 * does not claim a button will take them there, because this route does not
 * open the Settings app, and copy must not write cheques the screen has not
 * signed.
 */
export const PHOTO_CAMERA_PERMISSION_DENIED_MESSAGE =
  'Remy mag de camera niet gebruiken. Je kunt dat aanzetten in de instellingen van je telefoon — of kies hieronder een foto die je al hebt.';

/** The same shape for the photo library, and the same refusal to treat "no" as a fault. */
export const PHOTO_LIBRARY_PERMISSION_DENIED_MESSAGE =
  'Remy mag je fotoʼs niet openen. Je kunt dat aanzetten in de instellingen van je telefoon — of maak hieronder zelf een foto.';

/**
 * Shown when the picker yields nothing usable: the file could not be read, or
 * the OS handed back an asset without the two facts `readImportPhoto` needs.
 *
 * DELIBERATELY VAGUE ABOUT THE CAUSE, which is the opposite of this codebase's
 * usual posture and is right here for once. Every distinguishable cause behind
 * it — a corrupt file, an iCloud photo that never downloaded, a picker the OS
 * tore down mid-flight — has the same fix, and not one of them is a sentence a
 * user can act on. What they CAN act on is "try another one", so that is the
 * whole message.
 */
export const PHOTO_UNREADABLE_MESSAGE = 'Remy kon deze foto niet openen. Probeer een andere foto, of maak een nieuwe.';

/**
 * NAMES NO FORMATS. "JPEG, PNG, WEBP of HEIC" would be precise, would be
 * accurate today, and would be the third time this codebase learned that copy
 * enumerating a list has to be found and rewritten every time the list changes
 * (see `unsupported_url`'s note in importFailureCopy.ts, wrong twice). It
 * would also be useless: nobody looking at their camera roll knows which of
 * those a given picture is, and the fix is the same either way — pick a normal
 * photo. The DEVELOPER-facing message at the boundary does name them
 * (importRequest.ts), because whoever is writing a client is the one audience
 * that needs the exact list.
 *
 * NOT AN ERROR MESSAGE, on `PASTED_TEXT_TOO_LONG_MESSAGE`'s precedent. Nothing
 * has failed and nothing has been sent; the user is mid-choice. It reads as an
 * instruction, in the same plain voice as the subtitle.
 */
export const PHOTO_UNSUPPORTED_TYPE_MESSAGE =
  'Dit soort bestand kan Remy niet lezen. Kies een gewone foto, of maak er zelf een.';

/**
 * ASKS FOR A NEW PHOTOGRAPH RATHER THAN A SMALLER ONE, which is the whole
 * point of the sentence. "Maak een nieuwe foto" is something a person can do
 * standing where they are; "verklein deze foto" sends them to find an image
 * editor. Since nothing in this pipeline re-compresses a photo to fit
 * (photoImportLimits.ts), the honest instruction is the one that produces a
 * fresh, smaller capture through the same path that produced this one.
 *
 * A SEPARATE SENTENCE FROM THE ONE ABOVE, because the two refusals have two
 * fixes — the exact reason `ImportPhotoReadiness` keeps `'unsupported_type'`
 * and `'too_large'` apart instead of merging them into one "bad photo" state.
 * Merged copy would give the wrong instruction about half the time, and a
 * wrong instruction is worse than a vague one because the user follows it.
 */
export const PHOTO_TOO_LARGE_MESSAGE =
  'Deze foto is te groot om te versturen. Maak een nieuwe foto van het recept — dan is hij vanzelf kleiner.';
