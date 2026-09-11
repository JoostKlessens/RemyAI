# Remy — Social Design: bewijs eerst, het pannetje erbovenop

This document extends `docs/DESIGN.md` with the social experience of
sharing food. It is written against the same binding set: PD-004, PD-007,
PD-007a, PD-008a, PD-010, PD-014, and the three rules that override
everything. Where it proposes revising a recorded decision it says so in
§6, with the argument attached — nothing here silently deviates. Tokens
named below are real exports from `src/theme/tokens.ts`; screens keep
their existing filenames.

## 0. The direction

**Social proof is a property of a recipe; sending one is a message on
top of it.** The foundation of Remy's social layer is not an inbox — it
is one derived fact, *Sanne kookte dit · 8,5*, attached to a recipe
wherever that recipe already appears. Nobody has to do anything for that
fact to exist: it falls out of cook events that already happen, gated by
one household-level opt-in. Because it is derived, it can annotate the
surfaces that already supply recipes — the Kiezen reason, the Bevestigen
import, the Vrienden tab — instead of waiting for a friend to be chatty.
On top of that floor sits the one social act that does need a human:
**het pannetje** — a directed send of a dish you actually cooked, to one
named friend, with a line in your own words. The proof layer keeps the
surface alive in a quiet week; the send is the high-intent moment the
proof layer can never manufacture. What we take from TikTok and
Instagram is the hand feel — one-tap directed sending, motion that
answers the finger — and what we refuse is their economy: no likes, no
read receipts, no recency bait, no audience. A later change can be
checked against one sentence: **social proof may only ever be derived
from cooking that actually happened, and may only ever land where a
recipe already is.**

**Why the DM-only model was wrong, recorded so it is not rebuilt.** An
earlier draft of this document made the directed send the foundation and
every social act require a human. That model has no supply: a week in
which nobody sends you anything is a week in which the social layer is
empty, and an empty social layer cannot help you decide what to eat —
which is the only job any Remy surface has. A messenger needs
correspondents; a food app needs food. Proof needs neither sender nor
occasion, so proof is the floor and the send is the ornament, not the
other way round.

## 1. The economy: one derived fact, one human act

| Layer | Needs | What it is underneath |
| :-- | :-- | :-- |
| **Bewijs** ("Sanne kookte dit · 8,5") | one global opt-in, then nothing | cook events on canonical recipes, named to friends |
| **Sturen** (het pannetje) | a human, per act | a directed send of a cooked meal, with an optional note |
| **Bewaren** (the reaction) | one tap | the existing save → `SaveIntentSheet`, PD-004a's two options |

**The proof fact, precisely.** When a household has opted in (§5), each
of its cook events on a meal linked to a canonical recipe yields one
shareable fact: *this friend's household cooked this recipe.* The name
shown is the profile the viewer actually knows. The grade beside it —
"8,5" — is **never** `cook_events.rating`: that is the household's
private engine input, and a socially visible grade is a grade that gets
inflated, which corrupts the very signal the decision engine runs on
(PD-008's own logic). The grade on a proof is the friend's **public
vote** on the canonical recipe — `recipe_ratings`, the instrument that
already exists for exactly this and already feeds Ranglijst.
~~Private grade feeds your engine; public vote feeds the world;~~ the
proof shows the public one or none. This two-instrument split is what
makes showing a number safe at all, and it is restated as a condition
in §6.5.
**(AMENDED, 2026-09-06: the two instruments are still two rows in two
tables, and a proof still reads `recipe_ratings` and never
`cook_events.rating` — but they now hold the same figure. The grade
given on the outcome card is also cast as a public vote on the
canonical recipe, so the private grade no longer stays private. The
inflation argument in this paragraph is not refuted; it is accepted as
a cost, with the distribution of `cook_events.rating` over time named
as the instrument that would show it coming true. Recorded in PD-023,
which also carries the reason the board had no rows: `rateRecipe` had
zero callers.)**

**You can send anything in your library — a send is not proof, and does
not pretend to be.** An earlier draft of this document required a cook
event before a meal could be sent, arguing that it made the feed's
promise structurally true and capped spam as product rather than
infrastructure. The owner overruled it, and the argument does not
survive contact with the two-tier model this document is built on.

**Why the gate was wrong.** Proof is the thing that has to be earned,
and proof is `shared_cooks` — derived from real cook events, gated on a
real opt-in, and completely unaffected by who may send what. The send
tier was being asked to carry an authenticity guarantee the proof tier
already provides, and it paid for that with the feature's whole point: a
send is *"ik moest aan jou denken"*, and requiring evidence before
somebody may say that turns a generous impulse into an errand. The spam
case was also thinner than it read — a send reaches only a mutually
accepted friend, so the blast radius is your own friend list, and the
remedy is the one every social graph already has.

**What it costs, recorded rather than glossed.** Somebody can now send a
friend something they merely found, so a send is a suggestion and not
evidence. Two consequences follow, and both are handled elsewhere: the
card must never dress an unmade dish as a made one (§4.2 — a send
carries its sender and their note, never a cook proof it does not have),
and if volume ever becomes a real problem the honest instrument is a
rate limit, not a rule that claims to be about authenticity while
actually being about frequency. See §6.2.

**The note.** A send may carry one optional line in the sender's own
words — "moet je proberen, echt 20 min". It renders in the
margin-scribble treatment (§4.2): Archivo, not mono, because it is a
human voice, with a `borderStrong` left rule — the same evidence-block
gesture DESIGN.md §7 uses for "DIT LAS REMY". No replies, no threads. A
note is a post-it on a pan lid, not the opening of a chat.

**The reaction is the save — there is deliberately no lighter one.** A
heart without a save is the high-browsing, low-cooking signal PD-004
exists to starve. The receiver's honest moves are: save it (one tap),
or not. Anything else a human wants to say belongs in the messaging app
every Dutch household already runs.

**The echo is no longer a mechanism — it is a costume.** The earlier
draft built a dedicated "Sanne heeft jouw recept gemaakt" pipeline
because the sender was otherwise starved of signal. Under the proof
layer that pipeline is redundant: when an opted-in friend cooks a recipe
you sent, her cook event surfaces as ordinary ambient proof — the same
supply as everything else — and the only special thing left is
*presentation*: that one card dresses as the closed loop (eyebrow `SANNE
MAAKTE JOUW RECEPT`, the green stroke, §4.2). A friend who has **not**
opted in reports nothing, to anyone — including the person who sent the
dish. That is an accepted cost, not an oversight: one switch governs all
naming of your cooking, and a second consent path ("sending implies
echo-consent") is exactly how privacy models rot — two doors to the same
exposure, each defended by half an argument.

## 2. Where proof lands: the surfaces that already supply recipes

### 2.1 Kiezen — the social reason (the big one)

Rule 2 of the three that override everything: every suggestion carries a
stated reason. A friend's cook is the strongest concrete reason this
product can state — it lands where intent is highest, on the one surface
that is measured by acceptance. Two changes:

- **`reason.ts` gains a `friend_proof` reason kind**, ranked above the
  novelty reason ("Je at dit al 3 weken niet") when both apply — a named
  person beats a calendar fact. Copy, exactly: *"Sanne heeft dit ook
  gemaakt en gaf het een 8,5."* — grade from her public vote; without a
  vote, *"Sanne heeft dit ook gemaakt."* Two friends: *"Sanne en Joris
  hebben dit ook gemaakt."* Never a count without a name ("2 vrienden
  maakten dit") — the persuasive thing *is* the name, and an anonymous
  count is a stranger-aggregate wearing a friendly tone. Reasons stay
  `body`/`textSecondary` under the mono `REDEN` label, unchanged.
- **`scoring.ts` gains a modest named weight** (`FRIEND_PROOF_BOOST`,
  beside `HOUSEHOLD_FAVOURITE_BOOST`) for a rotation meal whose
  canonical recipe a friend cooked. This is personalisation and it is
  legitimate here: Kiezen is per-household *by definition* — it already
  reads your restrictions, your history, your time budget. PD-014.6's
  ban binds the board, where a per-viewer ordering would create an
  unaccountable private reality; a household's own dinner suggestion is
  the opposite of that surface. The boost is a cookability signal in
  PD-004's own currency: a dish someone you know actually produced is
  more likely to convert to a cook than one nobody you know has.

```
┌───────────────────────────────────┐
│             KIEZEN                 │ label · mono, textMuted
│      Traybake kip & citroen        │ display · Archivo Bold
│  REDEN                             │ label · mono
│  Sanne heeft dit ook gemaakt en    │ body · Archivo, textSecondary
│  gaf het een 8,5.                  │
│      25 min  ·  voor 4             │ numeral · mono
└───────────────────────────────────┘  (action row unchanged)
```

### 2.2 De kring — the circle's verdict, and why Ranglijst is untouched

**Ranglijst does not change. At all.** It answers "wat is hier echt
goed?" — the population's verdict — and stays purely global, identical
for every reader, exactly as PD-014.6 requires. An earlier draft of this
document put an `Iedereen | Vrienden` toggle on the board; that was
wrong in a way worth recording: it **mutated the protected object**,
re-ordering the one list whose whole meaning is that every reader sees
the same thing, and then needed an accountability argument to excuse it.
No argument is needed when the protected object is simply left alone.

**The circle's verdict is a different list answering a different
question:** *"wat vindt mijn kring goed?"* — and it is the more useful
question, because the reason social proof works at all is that you have
grounds to trust these particular people's taste. A stranger's 9,0 and
a friend's 9,0 are not the same information: one is a statistic, the
other is Sanne. The list ranks canonical recipes by `recipe_ratings`
votes cast by accepted friends, and it lives **on Vrienden** (§2.4,
§4.2) — that tab's question is already "wat hebben mensen die ik ken
gemaakt", and a ranked aggregate is the same question answered in
aggregate rather than event by event. It is not a fifth tab, and it is
not a second list on the Ranglijst screen, where it would compete with
the board and keep inviting someone to merge the two back into the
toggle this draft just removed.

**Its arithmetic is deliberately not the board's.** The board's devices
exist to tame anonymous strangers; none of them survives contact with
five named people:

- **Floor of 1 vote, not `LEADERBOARD_MIN_VOTES`.** The global floor
  keeps anonymous noise off the board; a friend's single vote is not
  anonymous noise — you know exactly whose opinion it is, which is the
  entire evidentiary point of the list. With four friends, almost
  nothing would ever clear the global floor.
- **No Bayesian shrinkage.** Shrinking toward a population mean is a
  device for thin evidence from unknown voters. With named voters the
  honest number is what they actually said: a plain average, rounded to
  **one** decimal ("8,5", comma, trailing zero kept) — two decimals on
  a handful of known votes is false precision wearing the board's
  clothes.
- **Voters are named while they fit:** "8,5 · Sanne en Joris", falling
  back to "8,2 · 4 stemmen" beyond two. Ties: more votes first, then
  alphabetical by dish — evidence breaks ties here exactly as it does on
  the board.

**The thin list is the honest list, and it will be thin for a long
time.** Most households will have a handful of friends and fewer votes;
a kring of two rows is the expected state for months, not a failure
state to paper over. So it is designed as a small dinner table, not an
embarrassed leaderboard: rows render identically whether there are two
or twenty, the list ends with its own end line (~~"Dat is de hele
kring."~~), and it is **never padded** — no global rows blended in to make
it look fuller, which would quietly rebuild the Ontdekken surface out of
spare parts, and no skeleton implying more is coming. Empty state:
`title3` ~~"Nog geen cijfers uit je kring"~~, `bodySmall`/`textMuted`
"Geeft een vriend een recept een cijfer, dan staat het hier." — never a
zero, never a placeholder row.

**(CORRECTED, 2026-09-06: two of those three strings are not what
shipped, and §2.4's banner already contains the reason — "the word
'kring' was retired from user-facing copy at the same time" — without
anybody carrying it into this paragraph. `b9b0f59` set
`KRING_END_COPY = 'Dat is alles van je vrienden.'`
(`src/components/kringPresentation.ts:52`) and
`KRING_EMPTY_TITLE = 'Nog geen cijfers van je vrienden'` (`:55`).
`KRING_EMPTY_BODY` (`:56`) is unchanged and is the string quoted above.
The code is right and this paragraph was wrong: a screen may not end on
a word the product stopped speaking. §4.2's wireframe carries the same
stale line and is corrected there. Also corrected in PD-018 and
DESIGN.md §8.)**

### 2.3 Bevestigen — proof at the moment of import

When a pasted link resolves to a canonical recipe that opted-in friends
have cooked, one quiet line renders directly under the
`CreatorAttribution` row: `caption` mono, `textMuted` — *"Sanne en
Joris hebben dit ook gemaakt."* A derived fact reads as burned-in
metadata, so it is mono, not prose. Nothing else on the screen moves;
this is a footnote that answers "is this any good?" at the exact moment
someone is deciding whether the import is worth confirming. No proof, no
line — never "nog niemand die je kent", which would read as a verdict.

### 2.4 Vrienden — the tab becomes literally its own subtitle

The shipped subtitle is already *"Wat vrienden echt gekookt hebben."* —
what friends **cooked**, not what they sent. The DM-only draft
contradicted live copy; this model makes the copy exactly true.

> **SUPERSEDED, 2026-08-27.** This section described two friend-scoped
> views behind a `SegmentedControl` on Vrienden, `Gekookt` and `Kring`.
> **That control no longer exists.** The owner ruled: *"I want the top
> ranking recipes from my friends on the ranking tab, not in that 'kring'
> list."* Vrienden is now one list, and the friends' ranking moved to
> Trending as an `Iedereen | Vrienden` scope. The argument below for why a
> mode switch was *safe here* is therefore moot; the argument for why it
> was wrong on a protected global object still stands, and is why the
> scope switch now on Trending is a different thing. The word "kring" was
> retired from user-facing copy at the same time.

The tab holds the ranked feed: ambient proof cards (friends' cook events)
with directed sends rendered in the same list as the higher-intent subset
they are. Ordering stays `rankFeedItems` cookability; the list stays
finite and says so. The unseen-send count (§3.2) belongs to it.

A mode switch was removed from Ranglijst and is safe here, and the
difference is worth stating: on Ranglijst the toggle re-ordered a
protected, identical-for-everyone object; on Vrienden both modes are
friend-scoped answers to the tab's own question, neither claims to be
the same for every reader, and neither is the board.

> ⚠ **BANNER, 8 September 2026 — half of the paragraph below is routinely
> quoted about the wrong surface, and PD-014a says so.** Trending's
> `Iedereen` scope became a vertical card feed on that date, at the owner's
> instruction, and this paragraph is the nearest thing in the repo to a
> defence of a scrolling list of recipes. **It does not transfer, and half of
> it never could.** The argument below earns its distinction on two words —
> not *strangers*, and not *algorithmic*. The strangers half is about **this
> tab**, whose supply is your friends' kitchens; Trending's global scope is
> **by definition a list of strangers** and always was, so
> "the feed cannot exceed what your friends actually cook" has never covered
> it. What does cover it, and what PD-014a leans on, is the other half:
> nothing there is selected by a model, the supply is bounded by
> `LEADERBOARD_MAX_ROWS` rather than by editorial restraint, and the order is
> identical for every reader. Read PD-014a before citing this paragraph about
> anything other than Vrienden.
>
> §2.2's rule against padding is untouched by all of it: the two Trending
> scopes still share a fetch and nothing else, and a thin friends ranking
> stays visibly thin.

**Why this is not the "Ontdekken" surface, argued rather than assumed.**
DESIGN.md refused "an *Ontdekken* surface of algorithmic strangers", and
this tab is a scrollable list of recipes, so the distinction has to be
earned on both words. *Strangers:* every row originates with a mutually
accepted friend — a graph built by handle exchange between people who
know each other, with no suggestions, no follower model, no
friends-of-friends. *Algorithmic:* nothing here is selected by a model
optimising anything; the supply is the complete set of friends' cooks,
sends and votes, ordered deterministically. And the structural stop
against browse-forever drift is physical, not editorial: **the feed
cannot exceed what your friends actually cook.** Ten befriended
households produce a handful of dinners a week; no engagement lever
exists that could inflate that number, because the only way to create
content is to cook dinner. A feed supply-bounded by real kitchens cannot
become infinite scroll no matter how it is styled. PD-004 still measures
the tab on save-to-cook, and every card still routes to a recipe that
can be saved and scheduled.

## 3. The interactions, concretely

### 3.1 Sending

Two entry points, both earned in PD-003's sense:

1. **The moment after rating your own cook.** `OutcomeCard`'s follow-up
   phase, after a grade commits, gains one tertiary `Stuur door` beside
   the existing exit — only when ≥1 accepted friend exists. It rides the
   existing `durationNormal` hold before dismissal; tapping it opens the
   Sturen sheet while the card finishes closing underneath. Rating
   parity is untouched: one gesture to rate, one tap to skip, and the
   send affordance gates nothing.
2. **A long-press on any tile in Bibliotheek** opens a small action
   sheet: `Sturen`, plus the sharing rows of §3.5. Any tile, cooked or
   not — the moment after your own cook (1, above) is the *best* time to
   send, not the only permitted one, and a library you cannot send from
   is a library with a locked drawer in it.

**Motion of the send commit:** tapping `Stuur` on a friend row draws a
hairline `accent` stroke under the friend's name — `scaleX` 0→1,
transform-origin left, `durationFast`, `easingDecelerate` — while the
action label swaps to `Verstuurd` (mono, `textMuted`). Kiezen's
grease-pencil underline, reused deliberately: the blue stroke is the
app's one mark for a choice being made, and choosing a person is a
choice. One light selection haptic on commit. Reduced motion: stroke
appears complete instantly, label swaps without animation, haptic stays
— a haptic is feedback, not motion.

### 3.2 Receiving a send

- **The tab label carries a mono count while unseen *sends* exist:**
  `Vrienden · 2`, in the same `typeScale.caption` line the tab already
  uses — a burned-in frame counter, not a red badge. **Ambient proof
  never counts toward it.** A count fed by other people's ordinary
  dinners would be "check back often" by another name; a count of
  letters addressed to you, bounded by how often friends actually cook
  and bother to send, is mail. It clears when the tab is opened — no
  per-card read tracking, because per-card tracking is the first brick
  of a read-receipt system. No dot, no color, no animation.
- **Unseen sends group at the top of the Gekookt list**, ordered by
  cookability within the group, then the list continues in ranked
  order. Unseen is a binary reader state, not a freshness gradient: it
  clears permanently on viewing, so there is no loop to run. Still no
  timestamps, still no "nieuw" badge, anywhere.

**Entrance motion:** unseen cards fade and rise on first render —
`opacity` 0→1, `translateY` 8→0, `durationNormal`, `easingDecelerate` —
staggered 40ms per card, capped at four. Kiezen's reveal at a humbler
duration. Reduced motion: everything lands instantly, no stagger.

### 3.3 Reacting: the save

On the shared recipe screen (`/friends/[feedItemId]`): primary
`Bewaren`, full width, inside `spacing.thumbZoneMinHeight`. It opens the
existing `SaveIntentSheet` unchanged — `Deze week` / `Ooit`, no third
option — and the copied meal starts at `allergenTagStatus: 'unknown'`,
exactly as PD-010 requires. After the sheet resolves the button
re-renders as `positiveMuted` fill with `positive` text, `Bewaard`. The
card keeps its ranked place in the feed; hiding saved cards would turn
the list into a to-do queue, an anxiety this product does not sell.

### 3.4 The closed loop

When an opted-in friend's cook event matches a recipe you sent them,
that proof card dresses as the closed loop: eyebrow `SANNE MAAKTE JOUW
RECEPT`, a `positiveMuted` chip with `positive` caption text reading
exactly `gemaakt`, and — after the entrance settles — a hairline
`positive` stroke drawing under the dish name, `scaleX` 0→1,
`durationFast`, `easingDecelerate`. The completion mirror of Kiezen's
accent stroke: a blue underline when you choose, a green underline when
what you sent got cooked. One success haptic, at most once per tab open.
Reduced motion: stroke and chip appear instantly, haptic stays. The
dressed card is read once — on the next visit it reverts to an ordinary
proof card in ranked order. No trophy shelf, no "door 3 vrienden
gemaakt" counters anywhere: the moment a send earns a persistent number,
people start cooking for the number.

### 3.5 Withholding and withdrawing

Three grains, each in the place its scope suggests:

- **Per dish, before the fact:** the long-press sheet on your own tile
  carries `Deel deze niet` — a per-meal exclusion on top of the global
  opt-in (§5). A household that shares in general must be able to
  withhold one dish — a medical diet, a religious observance week —
  without choosing between total silence and total disclosure. Excluded,
  the row reads `Uitgezonderd van delen · Weer delen`. The exclusion
  silences all cook proof for that meal, past included, and survives
  the global switch being toggled off and on.
- **Per send, after the fact:** the same sheet states active sends
  plainly — `Gedeeld met Sanne en Joris` — and offers `Stop delen`,
  ~~which deletes the send rows.~~ **(CORRECTED, 2026-09-06: it does not
  delete them, and the shipped behaviour is the better one. `0009` gives
  `recipe_shares` a `withdrawn_at` column and says why in its own
  comment: "The row is kept rather than deleted so a re-send is a new
  decision with its own history, and so withdrawal stays auditable."
  `withdrawSend` writes that timestamp rather than removing the row
  (`src/lib/repository/social/localSocialRepository.ts:484`), and every
  read filters on `withdrawnAt === null`. What the recipient sees is
  identical either way — the send stops appearing at their next read —
  so nothing in this section's promise changes. Note the deliberate
  asymmetry with a withdrawn public vote, which IS a real delete
  (`recipe_ratings_delete`, `0007:532`): there, 'never rated' and
  'rated then withdrawn' must be indistinguishable; here, the sender is
  the only reader of their own send history and an audit trail costs
  nobody anything.)**
- **Globally:** the §5 switch turned off stops all ambient proof.

All three are honoured at next assembly, fail-closed, like the PD-007
creator opt-out they mirror. Proof is assembled per read and nothing is
stored on the receiving side, so each of these removes already-shown
proof from every friend surface at their next open. A receiver's
already-saved copy is theirs — withdrawal un-publishes; it does not
reach into someone else's kitchen and take a pan back.

## 4. Screen specs

### 4.1 Sturen — the send sheet (new)

`surfaceRaised`, `radiusLg` top corners, drag handle, `springDefault`
drag — the same physical sheet as `SaveIntentSheet`. `title3` "Sturen",
dish in `bodySmall`/`textMuted`. One optional note input: single-line,
Archivo `body` (the one input in the app not set in mono, because a note
is a human voice), placeholder "Schrijf er iets bij (mag)",
`borderStrong` outline, `radiusSm`. Friend rows ≥ `touchTargetMin`:
monogram disc (`radiusFull`, `surfaceSunken`, mono initial), name in
`body`, handle in `caption` mono, and a mono `Stuur` action at the row's
end. Tap = sent (§3.1's motion); the row stays put so a second friend
can be tapped; no aggregate send button, because per-row commit is what
makes one-person sending cost one tap. Friends ordered most-sent-to
first, ties alphabetical — a send sheet is the sender's own tool, and
ordering it by their own habit is autocomplete, not an algorithmic feed.
Empty state: "Nog geen vrienden om naar te sturen." + secondary
`Vriend toevoegen` → §4.4.

```
┌───────────────────────────────────┐
│              ▂▂▂▂                 │ drag handle
│  Sturen                            │ title3
│  Traybake kip & citroen            │ bodySmall, textMuted
│ ┌─────────────────────────────────┐│
│ │ Schrijf er iets bij (mag)       ││ body (Archivo), borderStrong
│ └─────────────────────────────────┘│
│  (S)  Sanne              Stuur     │ body + caption · mono action
│       @sanne            ‾‾‾‾‾‾     │ ← accent stroke after commit
│  (J)  Joris           Verstuurd    │ committed: mono, textMuted
│              Klaar                  │ tertiary
└───────────────────────────────────┘
```

### 4.2 Vrienden — revised (DESIGN.md §8, amended)

Everything §8 establishes stands unless named here: the finite list,
`rankFeedItems`, the PD-007a chip, the color discipline, the withdrawn
state, the end line "Dat is alles wat er gedeeld is." Changes:

- ~~**A `SegmentedControl` under the header:** `Gekookt` | `Kring`~~
  **SUPERSEDED, 2026-08-27 — see the note in §2.4.** There is no mode
  switch on Vrienden. It is one list with one subtitle, *"Wat vrienden
  echt gekookt hebben."*, and the friends' ranking lives on Trending
  behind an `Iedereen | Vrienden` scope. Everything below about the two
  card kinds still applies to that single list.
- **The list holds two card kinds.** A *proof card*
  (ambient): eyebrow `SANNE MAAKTE DIT`, dish, key ingredients, ~~meta
  "30 min · 8,5"~~ meta "8,5" (her public `recipe_ratings` vote; absent
  if she never voted), creator line (attribution is not optional — these
  are extractions of somebody's post, PD-007). It opens the **canonical
  recipe**: the publicly readable `recipes` row, not her household's
  copy — her edits, notes and scheduling stay hers. A *send card* adds
  the sender's note (Archivo `bodySmall`, `textSecondary`,
  `borderStrong` left rule, in quotes) and opens the **sender's actual
  meal** — they chose to hand you their version; that difference between
  the two card kinds is the privacy model made visible.

  > **AMENDED, 2026-09-11 — THE SHAPE CHANGED, THE MEANING DID NOT.** The
  > owner, looking at the merged Ontdek tab: *"De vrienden pagina op
  > ontdek is nu geen feed meer zoals die bij ontdekken is, dat is wel de
  > bedoeling."* He was right — measured, not felt: these two cards drew
  > an 80pt thumbnail (`spacing.space20`) at 9:16 — about 142pt tall — on
  > the LEFT of a text column, `title3`, card itself about 150-190pt
  > tall; explore's card beside it drew a centred column, `title2`, a
  > 200pt photo at 9:16 (356pt tall), about 496pt tall in total — one
  > screenful against four rows to a screen, on the same tab. Both now
  > compose `FeedCardFace.tsx`: eyebrow, `title2` name, a cook-time row
  > with its own clock — moved OUT of the meta line, where it used to be
  > the first half of "30 min · 8,5" — the 200pt photo, then whatever
  > this card kind adds under it, the meta line, the creator line. What
  > is left in the meta line is the grade alone, and the asymmetry
  > between "8,5" (proof) and "8,0/10" (send) is meaning rather than
  > form and stays exactly as written above. The eyebrow, the note and
  > the two destinations this bullet names did not move at all — see the
  > diagram below for the shape itself.
- **Kring** renders §2.2: rank in `numeral` mono (tabular figures, as on
  the board), thumbnail with monogram fallback, dish in `title3`, meta
  in `numeral` mono naming the voters, creator in `caption` mono. Rows
  are the same proof-sheet strip as §8 and §9, so the three list
  surfaces read as siblings. PD-007a chips apply as everywhere.
- **Header:** gains secondary `+ Vriend toevoegen` top-right — the
  mirror of Bibliotheek's `+ Link plakken`, so the two list tabs share a
  grammar.

  > **SUPERSEDED, 2026-09-08 — THE HEADER HAS NO CONTROL AND NO
  > SUBTITLE.** The owner, on the shipped screen: *"op de vrienden tab
  > bovenaan vriend toevoegen, die mag weg en de zin daaronder ook … ik
  > wil dat je de look van deze pagina clean maakt en intuitief."*
  >
  > Both are gone. What stood there was three storeys — a title, a
  > right-aligned secondary, and a line of explanatory grey under both —
  > over a list of cards that already explain themselves. Each storey was
  > specified separately and satisfied its own rule; nothing ever asked
  > what the three looked like stacked.
  >
  > **The subtitle needed no replacement, and this document is why.**
  > §8-as-amended resolved the over-claim structurally rather than
  > editorially: a proof card says `SANNE MAAKTE DIT` and a send card
  > says `GEDEELD DOOR JORIS`. The cards were already saying what the
  > subtitle said, once each, where the reader is looking. WS3 had
  > independently flagged the line as factually wrong for a mixed list
  > and proposed a rewrite; deleting it answers that finding better.
  >
  > **(!) The header is now the only thing that can carry a personal
  > address, and it carries one only when there is one:** a single line,
  > `bodySmall` in `accent` over a hairline, reading "2
  > vriendschapsverzoeken wachten op je", tapping through to §4.4. Null
  > otherwise — which is almost every visit. It is a sentence and not a
  > badge on purpose: a number in a circle says something is unread and
  > cannot be answered.
  >
  > **The door to §4.4 moved and did not disappear**, which is the thing
  > to check before touching this screen. It is `Zoeken op
  > gebruikersnaam` at the foot of §4.5's block, and that line renders
  > even when there are no suggestions — otherwise somebody with two
  > friends and a full feed would have no way to add a third.
- **Unseen band** for sends (§3.2); the closed-loop dress (§3.4). No
  "NIEUW" divider — the entrance motion is the only announcement.
- **Empty state (Gekookt):** copy becomes "Zodra vrienden koken of je
  iets sturen, staat het hier — met het originele filmpje erbij."; the
  privacy footnote updates to name the model: "Jouw kookbeurten zijn
  alleen zichtbaar als je dat zelf aanzet, en sturen doe je altijd per
  recept." ~~Secondary actions: `Vriend toevoegen` and `Naar je
  bibliotheek`.~~ Kring's empty state is §2.2's.

  > **AMENDED 2026-09-08.** The two stacked secondaries are gone with the
  > header button, in the same pass and for the same reason — two
  > identically-weighted buttons made a person choose between "add a
  > friend" and "look at my own recipes" before anything had happened.
  > `Naar je bibliotheek` is simply dropped: a tab bar with Mijn recepten
  > on it sits a few points below that text. The empty state is now a
  > title, one line, and §4.5's block — which names actual people with an
  > actual reason, and is strictly more useful than a button labelled
  > with a category. The decorative hairline between the two sentences
  > went too; it separated a sentence from its own footnote.

```
┌───────────────────────────────────┐
│ Vrienden        [+ Vriend toevoegen]│ title2 · secondary
│ [ Gekookt │ Kring ]                │ SegmentedControl · mono
│ Wat vrienden echt gekookt hebben.  │ bodySmall, textMuted
│ ┌─────────────────────────────────┐│
│ │┌────┐ GEDEELD DOOR JORIS        ││ label · mono   (send card)
│ ││9:16│ Romige pasta pesto        ││ title3
│ ││    │ ┃ "echt 20 min, beloofd"  ││ bodySmall, left rule ← note
│ │└────┘ 20 min  ·  8,5/10         ││ numeral · mono (public vote)
│ │       @kokenmetkees · TikTok    ││ caption · mono
│ └─────────────────────────────────┘│
│ ┌─────────────────────────────────┐│
│ │┌────┐ SANNE MAAKTE DIT          ││ label · mono   (proof card)
│ ││ T  │ Traybake kip & citroen    ││ title3, monogram fallback
│ │└────┘ 25 min  ·  8,5            ││ numeral · mono
│ │       @kokenmetkees · TikTok    ││ caption · mono
│ └─────────────────────────────────┘│
│    Dat is alles wat er gedeeld is. │ caption, centered
└───────────────────────────────────┘
```

> **AMENDED, 2026-09-11 — THE DIAGRAM ABOVE IS THE OLD COMPACT ROW, KEPT
> RATHER THAN ERASED, AND IT NO LONGER MATCHES THE SHIPPED CARD.** The
> owner, looking at the merged Ontdek tab: *"De vrienden pagina op ontdek
> is nu geen feed meer zoals die bij ontdekken is, dat is wel de
> bedoeling."* He was right, and the header above was already wrong on
> two further counts before this change, both already recorded — and
> never carried into this drawing — by this section's own 2026-08-27 and
> 2026-09-08 notes: there has been no `Gekookt`/`Kring` switch and no
> subtitle since 8 September. What replaced them is the pager's own
> switch, `Vrienden | Ontdekken` — two plain words, no box, the active
> one in `button` weight — because a `SegmentedControl` was judged the
> wrong instrument for choosing a page you are already a swipe away from.
> The tab holding both is now called **Ontdek**.
>
> **What changed in the cards, measured rather than felt:** an 80pt
> thumbnail (`spacing.space20`) at 9:16 — about 142pt tall — on the LEFT
> of a text column, `title3`, card about 150-190pt tall, four fitting a
> screen; against explore's own card, drawn right beside it in the same
> merged tab, a centred column with `title2`, a 200pt photo at 9:16
> (356pt tall), about 496pt tall in total — one screenful. `FeedCardFace`
> now composes all three cards on Ontdek, this list's two and explore's,
> so what follows is the one true shape.
>
> **What did NOT change:** the eyebrow (`SANNE MAAKTE DIT` against
> `GEDEELD DOOR JORIS`), the note (a send card has one, a proof card
> never does — PD-016, and now the clearest visual difference between
> the two rather than one difference among several), and the two
> destinations named in the prose above. Only the cook time moved, out of
> the meta line — where it used to be the first half of "20 min ·
> 8,5/10" — into its own row with a clock, matching explore; the meta
> line keeps the grade alone, and the asymmetry between "8,5" (proof) and
> "8,0/10" (send) is meaning rather than form and is untouched.

```
┌───────────────────────────────────┐
│ Vrienden    Ontdekken              │ surface switch · two words, no box
│                                     │ (active = button weight, muted = body)
│ ┌─────────────────────────────────┐│
│ │    GEDEELD DOOR JORIS           ││ label · mono   (send card)
│ │    Romige pasta pesto           ││ title2, centered
│ │        ◷ 20 min                 ││ clock glyph + numeral · mono
│ │      ┌───────────────┐          ││
│ │      │               │          ││
│ │      │      9:16     │          ││ 200pt photo, centered
│ │      │               │          ││
│ │      └───────────────┘          ││
│ │      ┃ "echt 20 min, beloofd"   ││ bodySmall, left rule ← note (send only)
│ │             8,5/10              ││ numeral · mono (public vote, no time)
│ │      @kokenmetkees · TikTok     ││ caption · mono
│ └─────────────────────────────────┘│
│ ┌─────────────────────────────────┐│
│ │    SANNE MAAKTE DIT             ││ label · mono   (proof card)
│ │    Traybake kip & citroen       ││ title2, centered
│ │        ◷ 25 min                 ││ clock glyph + numeral · mono
│ │      ┌───────────────┐          ││
│ │      │               │          ││
│ │      │       T       │          ││ monogram fallback
│ │      │               │          ││
│ │      └───────────────┘          ││
│ │                                 ││ ← no note: proof never has one (PD-016)
│ │              8,5                ││ numeral · mono
│ │      @kokenmetkees · TikTok     ││ caption · mono
│ └─────────────────────────────────┘│
│    Dat is alles wat er gedeeld is. │ caption, centered
└───────────────────────────────────┘
```

Kring mode:
```
┌───────────────────────────────────┐
│ [ Gekookt │ Kring ]                │
│ Wat je kring het beste vindt.      │ bodySmall, textMuted
│ ┌─────────────────────────────────┐│
│ │ 1 ┌────┐ Traybake kip & citroen ││ numeral · title3
│ │   │9:16│ 8,5 · Sanne en Joris   ││ numeral · mono, voters named
│ │   └────┘ @kokenmetkees · TikTok ││ caption · mono
│ └─────────────────────────────────┘│
│ ┌─────────────────────────────────┐│
│ │ 2 ┌────┐ Romige pasta pesto     ││
│ │   │ P  │ 8,0 · Joris            ││ one vote is a row, floor is 1
│ │   └────┘ @lekkerNL · TikTok     ││
│ └─────────────────────────────────┘│
│   Dat is alles van je vrienden.    │ caption, centered
└───────────────────────────────────┘
```

### 4.3 Shared recipe screen — revised (`/friends/[feedItemId]`)

As shipped, plus the thumb-zone `Bewaren` primary (§3.3), with the
original-post link staying directly under the last step, never pushed
below the fold by the save (PD-010.2). The note, when the send carried
one, renders under the eyebrow with the card's left-rule treatment. A
proof card or kring row routes here too when it opens a canonical
recipe, with the same anatomy minus note and minus sender eyebrow.

> **AMENDED 10 September 2026 — THE ANATOMY IS ONE, THE SCREENS ARE TWO.**
> "Routes here too" is now literally false and was always ambiguous, so it
> is settled rather than left to be discovered: a proof card opens
> **`/friends/recipe/[recipeId]`**, a second route beside this one.
>
> **Why not one screen.** The two read different rows under different
> permissions — this one a friend's private `meals` row through
> `has_active_send_to_me()`, the new one the world-readable `recipes` row
> 0006 grants to every authenticated reader. §4.2's own rule is that the
> difference between the two card kinds "is the privacy model made
> visible"; a single screen branching on a route param would make that a
> runtime decision in one file, which is exactly what the Vrienden tab
> refused when it declined to pass one handler taking a union. The
> alternative considered and rejected was a `?kind=proof` query parameter
> on this route: it costs one file fewer and puts a permission boundary
> behind a string a deep link can type.
>
> **What IS shared is this section, in full.** Both routes render one
> `SharedRecipeArticle` over one view model (`sharedRecipePresentation.ts`)
> and one `SharedRecipeSaveZone` outside the scroll, so PD-010.2's promise
> that the original-post link stays under the last step is kept by
> structure on both. "Minus note and minus sender eyebrow" survives as two
> null fields on that model rather than as a mode.
>
> **What a canonical recipe additionally cannot say**, and the copy differs
> for it: it carries no allergen tag of any kind (PD-006 — `recipes` has
> none), so the standing caveat there reads "Dit recept is door niemand op
> allergenen gecontroleerd. Dat doen jullie zelf bij het bewaren." rather
> than this screen's "Allergietags komen van wie dit deelde". And it shows
> no grade: the number on a proof card is the average of the friends named
> on THAT card, and a recipe screen holding only a recipe id does not know
> who they were — a second, differently-scoped average one tap away would
> be worse than saying less.
>
> The **kring row** half of the original sentence is unchanged and now has
> its destination too: it holds a canonical recipe id, so it routes to the
> same new screen. Wiring it is not done and is not this change.

### 4.4 Vriend toevoegen — the handle exchange (new, deliberately small)

The minimum viable friendship: you know someone's handle because they
told you. No search-by-name, no contact-book upload, ~~no suggestions~~.

> **AMENDED 2026-09-08.** "No suggestions" was reversed by the owner —
> see §4.5 and the amendment on the standing-refusals list in §7. Two
> halves of this sentence stand: there is still no search-by-name (you
> type an exact handle, `findProfileByHandle` never does a `like`) and
> still no contact-book upload. **This screen itself is unchanged**; the
> suggestion block lives on the Vrienden tab, not here.
Full-screen over the tabs. Your own handle stated large (`title1` mono)
with "Zo vinden vrienden jou."; a mono handle input (`borderStrong`,
`radiusSm`) + primary `Verstuur verzoek`; pending requests as plain rows
— incoming with `Accepteren` (secondary) / `Weigeren` (tertiary),
outgoing as a mono `wacht` state. No red badges; an open request is a
fact, not an alarm. Blocking (already in `friendship.ts`) surfaces as a
quiet tertiary behind a confirm.

```
┌───────────────────────────────────┐
│ Terug                              │
│ Vrienden                           │ title2
│ JOUW NAAM                          │ label · mono
│ @joost                             │ title1 · mono
│ Zo vinden vrienden jou.            │ bodySmall, textMuted
│ ┌─────────────────────────────────┐│
│ │ @handle van een vriend          ││ mono input, borderStrong
│ └─────────────────────────────────┘│
│ │        Verstuur verzoek         ││ primary
│ VERZOEKEN                          │ label · mono
│  Meike (@meike)  [Accepteren] Weiger│
│  → @pieter                  wacht  │ numeral · mono
└───────────────────────────────────┘
```

### 4.5 Misschien ken je — friend suggestions (new, 2026-09-08)

Requested by the owner in one sentence — *"misschien wat suggesties voor
vrienden op basis van wie jouw vrienden zijn en met wie zij zijn
verbonden of wie er veel recepten plaatst op de app"* — and it reverses
two recorded refusals, which are amended in §4.4 and §7 rather than
quietly dropped.

**Where it sits: at the FOOT of Vrienden, never at the top.** It is what
to do when the feed runs out, so it renders after the end line "Dat is
alles wat er gedeeld is." — `ListFooterComponent`, and inside the empty
state in the same position. People to add, placed above the dinners your
friends cooked, would turn this tab into a growth surface, which is the
reading PD-004 spends its whole argument refusing.

**Three rows, hard cap.** Not a scroll, not a carousel, not a "toon
meer". Three is a footnote; twelve is a funnel.

**Each row: name over handle, one reason, one control.** `PartyName`
from §4.4's row grammar, so a list of people looks the same on both
screens. The reason is `caption` mono in `textMuted`, the control is a
`secondary` `Toevoegen` — matching `Accepteren`'s weight for
`IncomingRow`'s reason: this screen is not trying to talk anybody into
acquiring friends. Once tapped, the button is REPLACED by the words
`Verzoek verstuurd` rather than disabled — a disabled control says "you
may not", the words say what happened, which is the swap `OutgoingRow`
already makes with its mono `wacht`.

**Two reasons, and mutual friends always win.**

| reason | sentence | source |
|---|---|---|
| shared friends | "2 gemeenschappelijke vrienden" | `suggested_friends().mutual_friends` |
| activity | "Beoordeelde 7 recepten" | `suggested_friends().public_votes`, **minimaal 3** |

**(!) De activiteitspool heeft een ondergrens van drie stemmen, en die is er
door een fout in de eerste versie.** Zonder ondergrens kwalificeert één stem
een volslagen vreemde, en dan staat er *"Beoordeelde 1 recept"* naast een
echte naam: een ware zin en een waardeloze reden. Eén stem is niet "actief op
Remy", het is iemand die de app één keer opende.

Dat was bij review op 8 september 2026 niet alleen een ontwerpzwakte maar ook
een **onjuist testorakel**: de demo-seed en drie documenten zeiden dat Tessa —
drie stappen ver, één stem — niet mocht verschijnen, "en staat ze er wel, dan
reikt de query een stap te ver". Ze verscheen, mét `mutual_friends = 0`, wat
betekent dat de tweede hop juist perfect werkte. Alleen de cap van drie op het
scherm hield haar uit beeld. Een test die een gezonde functie afkeurt kost meer
dan geen test.

De grens zit op de KWALIFICATIE en niet op de telling: `vote_counts` blijft
compleet, zodat de `public_votes` die de rij toont voor iedereen waar blijft.
Drie is een oordeel en geen meting — er is nog geen gebruiksdata om op te
kalibreren — en bewust aan de voorzichtige kant: haalt niemand hem, dan is de
activiteitspool leeg, en een leeg blok is beter dan een slechte suggestie.

A candidate can carry both numbers; a row that said both would say
nothing. The mutual-friends line wins every tie — including one mutual
against two hundred votes — because that is the order migration 0019
sorts by, and a list sorted by one number and captioned with another
reads as shuffled. A candidate with neither is dropped rather than shown
under a blank line.

**(!) The activity line counts VOTES, and says so, because the number
the owner asked for does not exist.** "Wie plaatst er veel recepten" has
no column behind it: `recipes` (0006) is canonical and keyed on a URL,
and the household copy that knows who imported it is `meals`, which
`meals_select` correctly refuses to every other household. The only
public trace a person leaves is the ratings they cast. So the sentence
is *"Beoordeelde 7 recepten"* and never *"plaatste 7 recepten"* — the
latter would be a fabricated number printed beside a real name.
`tests/friendSuggestions.test.ts` sweeps for that wording.

**What is excluded, by the database and not by the client.** Yourself,
and every profile you already hold a `friendships` row with in ANY
status — friend, pending either way, declined, blocked. Four reasons
that happen to agree: suggesting a friend is noise, suggesting an open
request is a duplicate write the trigger refuses, suggesting a declined
pair re-asks an answered question, and suggesting someone who blocked
you is the one outcome this must never produce. Because the exclusion is
complete, the tap needs no `planFriendRequest` classification — unlike
§4.4, where a person may type any handle at all.

**Privacy: a count, never a name.** See the amendment in §7. The second
hop is readable only inside `suggested_friends()`, a `security definer`
function; what it returns is how many of your friends know somebody, and
never which. A client cannot compute this at all — `friendships_select`
would hand it an empty result and it would conclude nobody is connected.

```
┌───────────────────────────────────┐
│ Vrienden                           │ title2
│ 1 vriendschapsverzoek wacht op je  │ bodySmall · accent  (only if >0)
│ ───────────────────────────────────│ hairline
│ … de feed …                        │
│ Dat is alles wat er gedeeld is.    │ caption, centred
│                                    │
│ MISSCHIEN KEN JE                   │ label · mono
│  Noor (demo)          [Toevoegen]  │ body / secondary
│  @demo_noor                        │ caption · mono
│  2 gemeenschappelijke vrienden     │ caption, textMuted
│  Youssef (demo)       [Toevoegen]  │
│  @demo_youssef                     │
│  1 gemeenschappelijke vriend       │
│  Daan (demo)          [Toevoegen]  │
│  @demo_daan                        │
│  Beoordeelde 6 recepten            │
│ Zoeken op gebruikersnaam           │ bodySmall, textSecondary → §4.4
└───────────────────────────────────┘
```

## 5. The opt-in, and what it actually exposes

**One switch per household: "Deel wat ik kook met vrienden."** ~~Off by
default.~~ **(AMENDED, 2026-09-06: the default is reversed — sharing
what you cook with accepted friends is the standard state, and the
refusal moves to a checkbox at the moment of cooking, checked by
default, that you tap to keep one dish to yourself. A household that
comes into existence after this ships starts on; a household that
already exists and never answered stays off until it is asked, with
the box pre-checked, because no migration may start sharing on
somebody's behalf. Everything else in this section stands, including
the unbundled ask, the one-time contextual moment, and the refusal to
campaign. Recorded in PD-022.)** It lives in household settings
(`settings.tsx`), as its own
section with the consequence stated in full sentences before the
control — unbundled, PD-005-style, never inside a wall of terms. It is
also offered once, contextually, when the household's first friendship
is accepted: the one moment the question is genuinely relevant, asked
with the switch visibly off and no pre-selection. Declining there is
final until the person goes to settings themselves — the question is
asked once, not campaigned.

**The per-meal exclusion is part of the same consent model, not a
footnote to it.** `Deel deze niet` (§3.5) exists because a global switch
alone forces an all-or-nothing disclosure: a household happy to share
its cooking in general may have one dish that says too much — a medical
diet, a religious observance week. The exclusion is per-meal, silences
all cook proof for that meal (past included, at next assembly), survives
global toggling, and is not a share tier: an excluded meal can still be
*sent*, because a send is its own explicit act aimed at one person. One
boundary stated plainly: the exclusion governs cook proof, not public
votes — a `recipe_ratings` vote you cast is world-readable by design
and is withdrawn by deleting the vote, a different instrument.

**What turning the switch on exposes, exactly:** the link between your
display name and a canonical recipe id — *that* you cooked it. Nothing
else is new: the recipe's content, creator and public votes were already
world-readable (`recipes`, `recipe_ratings`, per PD-014's own
argument). **What is never exposed, opt-in or not:** restrictions and
allergens (`member_restrictions` stays the only Article 9 table and no
social path reads it); household members; your private
`cook_events.rating`; your library; your schedule; anything you did
*not* cook. No timestamps travel — a proof is "Sanne maakte dit", never
"gisteren".

**The honest risk, stated rather than buried:** a list of named cooks
is a dietary pattern. Friends who see every dish you make can infer
halal, vegan, or an avoidance — Article-9-adjacent inference from
non-Article-9 facts. ~~That is why the switch is off by default, why the
consent copy names the inference plainly ("vrienden zien welke gerechten
je maakt"), why the per-meal exclusion exists, and why the audience is
only ever mutually accepted friends — never strangers, never public, no
`public` member in `MealVisibility`.~~

**(AMENDED, 2026-09-06: the risk in the paragraph above does not go
away with the reversed default — it gets larger, and this document says
so rather than letting a later reader find it. Off-by-default was the
first mitigation named here for exactly this inference, and it is
spent. Four remain, and they are the whole of what remains: the
audience is only ever mutually accepted friends — never public, never
strangers, no `public` member in `MealVisibility`, and `shared_cooks`
ends its own `where` clause on `public.is_friend_of(...)`; the per-cook
checkbox; the global switch in settings, revocable and retroactive; and
consent copy that names the inference out loud. Five mitigations became
four, and the one removed was carrying the most weight. That is the
owner's decision, taken with the cost in view, and it is recorded here
as a trade rather than as an objection to it. Recorded in PD-022.)**

**Leaving:** turning the switch off stops all proof immediately —
assembly-time gating plus RLS on a dedicated projection (§7) that
carries only (profile, recipe id) and never the rating column. Already
rendered screens on friends' devices cannot be recalled from human
memory, but nothing is stored on the other side: proof is assembled per
read, so opting out removes your entire cook history from every friend
surface, past included, on their next open. Directed sends are separate
and per-act: `Stop delen` per meal (§3.5) withdraws those.

**Rejected alternatives, recorded:** *counts-without-names* ("2
vrienden maakten dit") — the persuasive thing is the name; an anonymous
count is a stranger-aggregate in a friendly tone, unverifiable by the
reader and the first step toward global engagement numbers.
*Per-meal opt-in for proof* — today's visibility model; it is the DM
supply problem again, because per-meal acts happen at message frequency,
not cooking frequency (per-meal *exclusion* over a global opt-in keeps
the supply and moves the per-meal act to the rare case that needs it).
*Global-strangers aggregate* ("1.204 mensen maakten dit") — the board
already carries the population's verdict in vote form; per-recipe
stranger counts on decision surfaces are pure engagement dressing.
~~PD-010's "sharing is an act, never a default" survives in both tiers:
you act once globally for proof, or per recipe for a send — and nothing
is shared by a migration, ever.~~
**(AMENDED, 2026-09-06: half of that sentence is spent and half is
load-bearing. Proof is now a default for a household created after
PD-022, so it is no longer true that sharing is never a default — the
act that PD-010.3 required has become the refusal instead. What
survives whole, and is the reason the clause is amended rather than
deleted, is the second half: nothing is shared by a migration, ever.
Existing households keep the `false` they never chose until they are
asked. Recorded in PD-022.)**

## 6. Decisions this needs

1. **PD-010 (major amendment): sharing becomes two-tier — a
   household-level cook-proof opt-in with a per-meal exclusion, plus
   directed sends — replacing per-meal visibility as the user-facing
   model.** PD-010.3 currently reads "`meals.visibility` governs,
   defaulting to `private`. Sharing is an act, never a default."
   Proposed: the *act* is the global opt-in (one deliberate, revocable
   consent to name your cooks to friends), narrowed per dish by `Deel
   deze niet`, or a per-recipe send; ~~`meals.visibility` remains as the
   fail-closed gate for send-shared meals~~ **(CORRECTED, 2026-08-27:
   this is not what shipped. Migration 0009 reads a send through its own
   predicate `has_active_send_to_me`, added as an additional permissive
   policy on `meals`, `meal_ingredients` and `meal_steps`. A send never
   sets `visibility = 'friends'`. The shipped shape is strictly narrower
   and is binding — `'friends'` would expose the dish to the whole friend
   list in order to hand it to one person. Recorded in PD-015.)**, and the
   proof layer never
   reads a meal at all — it reads a projection of cook events onto
   canonical recipes (§7), which are already world-readable. ~~Off by
   default;~~ **(REVERSED, 2026-09-06: the standard state is on, with a
   per-cook checkbox as the refusal; existing households stay off until
   asked and no migration flips a row. Recorded in PD-022.)** no
   `public` member appears; all five PD-010 mitigations
   (attribution, original-post link, no re-hosting, creator opt-out,
   `unknown` allergen status on copies) carry over unchanged. The
   privacy analysis, the exclusion and the rejected alternatives are §5,
   and belong in the PD verbatim.
2. **Decision taken and then reversed: a send does NOT require a cook
   event.** Recorded rather than deleted, because it is the kind of rule
   a later version will propose again. The draft rule was "you can only
   send what you have cooked", justified as making the feed's promise
   structurally true and as anti-spam by product rule. It was wrong
   because it asked the send tier to carry an authenticity guarantee
   `shared_cooks` already provides, and charged the feature its whole
   point to do it — see §1. Anything in your library may be sent. The
   accepted costs are that a send is a suggestion rather than evidence,
   which the card must never disguise (§4.2), and that volume, if it
   ever matters, is a rate-limit problem.
3. **PD-002/reason hierarchy (extension): the social reason on Kiezen,
   and a friend-proof scoring boost.** `friend_proof` outranks the
   novelty reason; `FRIEND_PROOF_BOOST` is a named constant beside the
   engine's existing weights. Argued in §2.1, including why per-household
   personalisation here does not touch PD-014.6's ban, which binds the
   board.
4. **New decision: the kring list — a friend-scoped ranked list on
   Vrienden, with its own arithmetic.** PD-014 is *not* amended: the
   board stays global, identical, untouched, and condition 6 is never
   spent. What needs deciding is the new list itself (§2.2): floor of 1,
   no shrinkage, plain one-decimal average, voters named, never padded —
   and its placement as a second mode of Vrienden under DESIGN.md's
   tab-question rule, on the argument that "wat vindt mijn kring goed"
   is the aggregate form of the question Vrienden already owns, not a
   new question needing a fifth tab.
5. **PD-008 (restated as a condition): every socially visible number is
   a `recipe_ratings` vote; ~~`cook_events.rating` never crosses a
   household boundary.~~** **(REVERSED, 2026-09-06: it crosses. The
   grade a household gives its own cook is now also cast as a public
   vote on the canonical recipe and counts toward the global board —
   the owner's instruction, taken because Ranglijst had no writer at
   all: `rateRecipe` has two implementations and zero callers outside
   the tests. The first clause still holds — a number on a social
   surface is still read from `recipe_ratings` — but it is no longer a
   different number from the private one. The inflation argument below
   is accepted as a cost rather than refuted, and the instrument that
   would show it coming true is the distribution of
   `cook_events.rating` over time. One clause of this condition is NOT
   reversed and now binds a control that exists: a surface that asks
   for a number must say out loud that the number travels. Recorded in
   PD-023, which also carries the open boundary — `recipe_ratings`
   rows carry `rater_profile_id` and are readable by every signed-in
   user, and de kring names its voters, so the per-cook checkbox
   suppresses a name on Gekookt and not on the kring row.)** This is
   what makes showing a grade safe
   anywhere: the private grade stays honest because it stays private,
   and the public vote is cast knowing it is public. Any future surface
   that wants a number must take it from the public instrument or show
   none.
6. **DESIGN.md §8 (amendment): the unseen band and the tab count, for
   directed sends only.** The bans on timestamps, "nieuw" badges and
   recency ordering stand. Unseen/seen is a reader state that clears
   permanently on viewing the tab; ambient proof never feeds the count
   (§3.2) — that boundary is what keeps the count mail, not bait.
7. **DESIGN.md §8 (amendment): `positive` may appear on the closed-loop
   card, and only there.** The section's "no positive anywhere" guarded
   against dressing a friend's *opinion* as completion, and that stands
   — but a cook event is a completion, the exact event the color is
   reserved for; it happened at their stove, and the loop it closes is
   yours. One chip, `positiveMuted` fill, `positive` caption text, the
   word `gemaakt`; the green stroke of §3.4; nothing else on the surface
   in green.

## 7. What changes on existing screens and in the model, precisely

- **`src/domain/reason.ts` / `src/domain/scoring.ts`** — `friend_proof`
  reason kind and `FRIEND_PROOF_BOOST` (§2.1); the reason templates in
  §2.1's copy, verbatim.
- **`src/app/(tabs)/index.tsx`** — renders the social reason through the
  existing reason block; no layout change.
- **`src/app/(tabs)/ranglijst.tsx`** — ~~**untouched.** Stated so the
  absence is legible: the board is the protected object and nothing in
  this design reads or changes it.~~ **(CORRECTED, 2026-09-06: it is
  touched, and this bullet is the last place that still says otherwise.
  The owner moved de kring here — *'I want the top ranking recipes from
  my friends on the ranking tab, not in that kring list'* — so the file
  now imports `KringRow` (`ranglijst.tsx:95`) and a `SegmentedControl`
  (`:108`) and renders two scopes. DESIGN.md §8 and §9 and PD-018 were
  all amended when that happened; §7 alone was not. **What the sentence
  was protecting is still true and is the part to keep:** the global
  list is not re-ordered, not personalised and not backfilled — the two
  scopes are two separate lists from two separate assemblers, `Iedereen`
  byte-for-byte the board PD-014 protects. The file changed; the
  protected object did not.)**
- **`src/app/import/confirm.tsx`** — the one-line proof under
  `CreatorAttribution` (§2.3).
- **`src/app/(tabs)/friends.tsx`** — the `Gekookt`/`Kring`
  `SegmentedControl`; proof cards + send cards in one ranked list;
  unseen band; closed-loop dress; header `+ Vriend toevoegen`; revised
  empty states; loading and error states arrive with the repository
  swap, as the file's own header already requires. The kring's ranking
  is a new pure function in `src/domain/social/` (beside
  `leaderboard.ts`, deliberately not inside it — two lists, two
  arithmetics, one file each).
- **`src/components/FriendRecipeCard.tsx`** — note block; a sibling
  `FriendProofCard` for the ambient variant (fewer facts, different
  destination — the same argument that split this card from
  `RecipeTile`).
- **`src/app/friends/[feedItemId].tsx`** — `Bewaren` + `SaveIntentSheet`,
  note rendering, `Bewaard` completion state; canonical-recipe routing
  for proof cards and kring rows.
- **`src/components/OutcomeCard.tsx`** — the `Stuur door` tertiary
  (§3.1), only when ≥1 accepted friend exists.
- **`src/app/(tabs)/recipes.tsx` / `RecipeTile`** — long-press sheet:
  `Sturen` (cooked meals only), `Deel deze niet` / `Weer delen`, and
  `Stop delen` with the `Gedeeld met …` status line. No new badge on
  tiles.
- **`src/app/(tabs)/_layout.tsx`** — the `Vrienden · 2` label and its
  spoken `tabBarAccessibilityLabel`.
- **`src/app/settings.tsx`** — the opt-in section (§5), plus the
  first-friendship consent moment.
- **Data model:** a `recipe_shares` table (meal, sender profile,
  recipient profile, note, created/seen/withdrawn; RLS: the two parties
  only) with the meal-read predicate extended to "an active send
  addressed to me exists" alongside the existing gates; a `shared_cooks`
  projection carrying exactly (profile, canonical recipe id) — written
  only while the household's opt-in is on and the meal is not excluded,
  deleted when either changes, and never carrying the rating column, so
  no RLS mistake can ever leak a private grade through it; a per-meal
  exclusion flag beside `meals.visibility`; `visibility.ts` grows the
  matching in-memory mirrors, defence-in-depth as before. Kiezen's
  engine reads `shared_cooks` for friends only; the kring reads
  `recipe_ratings` filtered to friends; Bibliotheek and the decision
  gates are otherwise untouched.

## 8. What we deliberately did not build

- **No likes, hearts, or emoji reactions.** A costless reaction is
  dwell-currency; the save is the reaction; emoji are banned as status
  indicators anyway. First thing a future request will ask for — the
  answer is written down now.
- **No chat, replies, or threads.** One note per send, outbound only.
  The moment Remy hosts a conversation it competes with WhatsApp,
  loses, and carries moderation obligations for the privilege.
- **No read receipts.** "Gezien" creates the obligation to respond. The
  sender learns one thing, ever: that the dish got cooked — and only
  from a friend who shares her cooking at all.
- **No pretending a send is proof.** Anything in your library may be
  sent (§6.2), so a send card shows its sender and their note and never
  borrows the language of cook proof. The two tiers stay visibly
  different things: proof says a kitchen made this, a send says a person
  thought of you.
- **No counts without names, no stranger counts.** §5's rejected
  alternatives. A number with no person attached is engagement dressing.
- **No padding the kring.** A thin friends list is never blended with
  global rows to look fuller — that would rebuild the refused Ontdekken
  surface out of spare parts. Thin is the honest state (§2.2).

  > **AMENDED 2026-09-11 — this refusal, inverted, now has a test.**
  > PD-024's hard boundary — "nothing from the feed may touch explore's
  > ordering, and explore may never backfill the feed" — is
  > `tests/ontdekBoundary.test.ts` (16 tests) since fase 2 landed. **Leaning
  > on `isProofCard` alone would not have caught the mistake this refusal
  > warns about**, and that is why `isFeedCard` exists as a second guard:
  > `isProofCard` is `'recipeId' in card`, and a `BoardRowModel` — an
  > explore row — carries a `recipeId` too, because a board row IS a
  > canonical recipe, same as a proof card is. A board row spliced into the
  > feed would therefore narrow as proof, render with `FriendProofCard`, and
  > put a stranger's anonymous average exactly where a friend's name
  > belongs, looking entirely ordinary while doing it. The test asserts that
  > mis-narrowing directly rather than only asserting that correct data
  > works.
- **~~No follower model~~, no public profiles, ~~no vrienden-van-vrienden~~,
  no contact-book upload.** The graph is built by handle exchange between
  people who already know each other; growth loops over Article-9-
  adjacent data are the kind this product does not want.

  > **AMENDED 2026-09-08 — vrienden-van-vrienden is now BUILT, at the
  > owner's explicit request, and the rest of this bullet stands.** He
  > asked for "suggesties voor vrienden op basis van wie jouw vrienden
  > zijn en met wie zij zijn verbonden of wie er veel recepten plaatst op
  > de app". That is the second hop, named. See §4.5.
  >
  > **What was actually given up, stated plainly rather than softened.**
  > This document argued the second hop away twice — here, and in §2.2's
  > "why this is not the Ontdekken surface", which lists "no
  > friends-of-friends" as one of three things keeping Vrienden from
  > being a discovery feed. That argument was about the FEED's supply,
  > and it survives intact: no card in the feed comes from anyone but a
  > mutually accepted friend, and the supply is still bounded by what
  > real kitchens actually cook. What changed is who may be OFFERED as a
  > friend — at most three people, at the foot of the screen, below the
  > end of the feed.
  >
  > **The three refusals that did not move, and are enforced rather than
  > promised.** (1) Contact-book upload: still nothing, anywhere.
  > (2) Follower model and public profiles: a suggestion offers a
  > friendship request the other person must accept, and there is no
  > profile to visit. (3) **The graph is still not enumerable.**
  > `suggested_friends()` (migration 0019) returns HOW MANY of your
  > friends know a candidate and never WHICH — naming them would be a
  > fact about your friend's graph disclosed to a third party, which is
  > exactly what 0007's `friendships_select` refuses.
  > `tests/friendSuggestions.test.ts` sweeps every sentence the block can
  > render for that leak.
  >
  > **The cost that was accepted.** A mutual-friend COUNT still leaks
  > edges to a patient reader: befriend one person at a time, re-read the
  > counts, and differences are inferable. That costs one deliberate
  > friendship per bit, and it is why the rows are capped and the read is
  > a function rather than a filterable relation. A real cost, taken
  > rather than argued away.
  >
  > **AMENDED 2026-09-10 — THE FOLLOWER MODEL IS NOW REVERSED TOO, at the
  > owner's explicit request. This is the SECOND amendment to this one
  > bullet, and the other two refusals in it still stand.** He asked for
  > "dat je een persoon kan volgen en een melding krijgt als iemand dat
  > wil, dan kan je het accepteren en als je wil terugvolgen". Recorded in
  > PD-024; built as `follows` in fase 1 of `ONTDEK-PLAN.md`.
  >
  > **Read the strikethrough narrowly.** It crosses out FOUR WORDS. Public
  > profiles and the contact-book upload are untouched and stay absolute,
  > and saying so is not a formality: a follow model is exactly the feature
  > that makes both of them sound reasonable next. There is still no
  > profile to visit, and there is still nothing, anywhere, that reads a
  > phone's address book.
  >
  > **What is given up, stated plainly rather than softened.** §9's growth
  > path put asymmetric following in graph 2 and argued that the ORDER is
  > the expensive part to get wrong. That argument is not refuted here; it
  > is overruled, on request, with the cost in view. The graph stops being
  > symmetric: `follows` is directed, two rows per pair, and `friendships`
  > stops being the truth about who knows whom.
  >
  > **What keeps §5's consent intact, and it is the whole reason this
  > amendment is survivable.** What was asked for is not PUBLIC following.
  > Every follow is a REQUEST the other person accepts, so an accepted
  > follower holds a permission granted person by person — a stronger gate
  > than §5's one global switch, which grants to everybody at once. §5 was
  > switched on meaning "to mutually accepted friends"; if an unaccepted
  > follower could read that same cooking history, that consent would have
  > been widened by a migration, and PD-022's surviving absolute is
  > "nothing is shared by a migration, ever". So: **following without an
  > acceptance step is refused here explicitly**, and the global switch of
  > §5 stays the outer gate — switched off, an accepted follower sees
  > nothing. Consent stacks; it never substitutes.
  >
  > **What the migration may not do.** No existing friendship may expose
  > more after it than before it. One accepted friendship becomes two
  > accepted follows, which expose exactly what the friendship exposed —
  > not one row more.
  >
  > **The refusal that follows straight on, so it is not re-argued later.**
  > A follow is a GATE on whose cooking you see, never a SCORE on a person.
  > No follower counts, no "populairste koks", no profile page, no creator
  > feed. That is the "no trophy shelf" bullet below, applied to the graph
  > this amendment opens.
- **No trophy shelf, no streaks, no most-cooked leaderboard of
  friends.** Proof decorates recipes; it never accumulates into scores
  for people. The kring ranks recipes by friends' votes, never friends
  by anything. The moment cooking earns a persistent number, people
  cook for the number.
- **No inline video, no autoplay.** PD-007's line does not move.
- **No fifth tab.** The kring is a mode of the question Vrienden
  already owns, and an inbox was the obvious home for sends — both fail
  DESIGN.md's test as tabs: a distinct kind of content, not a distinct
  question. The unseen band is the inbox.
- **No push notifications, including for the closed loop.** Deferred,
  not refused — recorded in §6 territory so it takes a decision, not
  drift, to appear. The first push this product sends should be its
  best one, and that argument deserves its own day.

---

## 9. The growth path: three graphs, and why jumping is the mistake

**Absorbed on 10 September 2026 from `SESSIE-6-SEPTEMBER.md` §4, which was a
disposable session document and has been deleted.** The owner asked on
6 September *"how we can use strava as an example to set up the social media
part and grow into tiktok/instagram afterwards."* This is the answer, kept
because it is the only written argument for the ORDER of the social layer —
and order is the part that is expensive to get wrong.

### Why Strava is the right model, and it is not the feed

**Content is a by-product of something you did anyway.** You run because you
run; the activity records itself; posting is the default, not an act of
composition. §0 above already says this without naming Strava. The cook
checkbox (PD-022) is the last piece of it: it moves the question from *"do I
post this?"* to *"do I hold this back?"*

**The segment.** Strava's real invention was not "share your run" but *"this
stretch of road is a shared object, and everyone who ever ran it is on one
list."* You do not pick a segment; you run, and you are ranked.

**Remy's segment is the recipe**, and the apparatus already exists:
`recipes`, `recipe_ratings`, Ranglijst, de kring. What was missing was a
writer — built on 6 September. Supply and ranking are two halves of one
mechanism, not two features.

**What is still missing to make a recipe a real segment:** your own history on
it. Strava shows *"you ran this 14 times, your PR is 4:32."* Remy should show
*"je maakte dit 6 keer, je gaf het gemiddeld een 8,2"* on the recipe screen.

**Where Remy must go against Strava: kudos.** Kudos works there because a 10k
is objectively expensive. A like on someone's dinner is cheap on both sides.
§1 already refuses it, and the owner's own idea — *bewaren voor later* — is
the honest reaction, because it costs the receiver something real. ⚠ **The
gap that remains:** today the sender hears nothing when a friend saves, only
when they cook (§3.4). The honest version is *"Sanne wil dit maken"* reaching
the sender once, as a post, without a number — §3.4's own sentence stands:
*"the moment a send earns a persistent number, people start cooking for the
number."*

### The three graphs

Strava is **low effort, high trust, small graph**. TikTok is **high effort,
low trust, no graph**. They are opposites, and the mistake is jumping.

1. **The closed graph** (where Remy is). Mutual friends only, derived
   content. The honest metric is not DAU but the **closed-loop rate**: what
   share of sent recipes get cooked on the other side.
2. **The open graph, still derived.** Asymmetric *following* on top of mutual
   friendship, creators first (BIZ-04 is already building toward it). The unit
   stays the recipe. What opens up is **lists you can get into**: "onder 20
   minuten", "wat je in huis hebt", de kring. Discovery without a feed, ranked
   on a natural key instead of an algorithm that guesses.
3. **Composed content.** Only here does the photo count — and here Remy has an
   advantage nobody else has: **the app is already at the stove.** Kookmodus
   knows which step you are on, that the timer ran, that it went off. A photo
   taken *in* kookmodus at the "Gemaakt!" moment hangs on a real cook session
   against a canonical recipe. That is a **verified** food photo, which
   Instagram structurally cannot offer, because it does not know whether you
   cooked it or photographed a restaurant plate. It is the role GPS plays for
   Strava.

Since SRC-07 the pipeline runs both ways: a photo becomes a recipe, a recipe
yields a photo, the same Gemini call reversed.

~~⚠ **Do not build a feed.** Strava's feed is its weakest surface. Remy has the
recipe as a natural key, and that is precisely what feeds are a surrogate for.~~

> **AMENDED 2026-09-10 — A FEED IS BEING BUILT, at the owner's explicit
> request. Recorded in PD-024.** He said it in one sentence: *"ik wil wel een
> feed, dat is waar we naartoe willen."* The two surfaces are called Ontdek
> together — a feed of the accounts you follow, and an explore holding the
> global board and, later, search.
>
> **UPDATED 2026-09-11 — it is built.** Fase 2 of `ONTDEK-PLAN.md` landed:
> `Kiezen | Mijn recepten | Ontdek`, three tabs, `ranglijst.tsx` as the
> merged screen behind a pager. See `PRODUCT-DECISIONS.md` PD-024a for what
> shipped against what this section and PD-024 priced.
>
> **The argument above is not refuted. It is overruled, and it stays here
> because it is still true.** Remy does have the recipe as a natural key, and
> a feed is still a surrogate for exactly that. What changed is that the owner
> wants the surface that SHOWS the key, and accepts that it will look like a
> feed. That is a decision, not a discovery, and it is priced in PD-024 under
> "what is spent" rather than argued away.
>
> **The same goes for this section's own thesis, that the ORDER of the three
> graphs is the expensive part.** Graph 2 is not being skipped; it is being
> pulled FORWARD, ahead of the feed that rests on it, because a feed of
> "accounts you follow" cannot exist before following does. That is a jump,
> and this section's warning about jumping is not withdrawn.
>
> **What softens the jump, and it is not nothing: every follow is accepted
> before it grants anything.** Asymmetric following WITH a per-person approval
> step is not the open graph — it is a directed graph with a gate per human
> being, which sits closer to graph 1 than to graph 2, and it is what keeps
> §5's consent argument standing. §8's amended bullet carries that reasoning
> in full.
>
> **What this section recommended INSTEAD of a feed is not built and is not
> replaced:** *"lijsten waar je in kunt komen"* — "onder 20 minuten", "wat je
> in huis hebt". It does not arrive instead of the feed and it does not arrive
> beside it. It is the cheapest omitted half of the growth path and it belongs
> on the LONGLIST.
>
> **What still holds, unchanged, and is the reason this is not a generic
> feed.** Content is still a by-product: every card comes from a cooking
> event, a grade on one, or a directed send. Nobody composes anything for
> Ontdek. The recipe is still the ranked unit — **a person is never ranked**.
> And the honest metric is still the closed-loop rate rather than DAU, which
> is why a save now carries an ORIGIN (PD-024): Ontdek is about to deliver
> saves that did not come from a send, and without an origin the denominator
> goes cloudy and cannot be cleared up afterwards.
