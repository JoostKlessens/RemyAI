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
already exists for exactly this and already feeds Ranglijst. Private
grade feeds your engine; public vote feeds the world; the proof shows
the public one or none. This two-instrument split is what makes showing
a number safe at all, and it is restated as a condition in §6.5.

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
or twenty, the list ends with its own end line ("Dat is de hele
kring."), and it is **never padded** — no global rows blended in to make
it look fuller, which would quietly rebuild the Ontdekken surface out of
spare parts, and no skeleton implying more is coming. Empty state:
`title3` "Nog geen cijfers uit je kring", `bodySmall`/`textMuted` "Geeft
een vriend een recept een cijfer, dan staat het hier." — never a zero,
never a placeholder row.

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
  which deletes the send rows.
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
  (ambient): eyebrow `SANNE MAAKTE DIT`, dish, key ingredients, meta
  "30 min · 8,5" (her public `recipe_ratings` vote; absent if she never
  voted), creator line (attribution is not optional — these are
  extractions of somebody's post, PD-007). It opens the **canonical
  recipe**: the publicly readable `recipes` row, not her household's
  copy — her edits, notes and scheduling stay hers. A *send card* adds
  the sender's note (Archivo `bodySmall`, `textSecondary`,
  `borderStrong` left rule, in quotes) and opens the **sender's actual
  meal** — they chose to hand you their version; that difference between
  the two card kinds is the privacy model made visible.
- **Kring** renders §2.2: rank in `numeral` mono (tabular figures, as on
  the board), thumbnail with monogram fallback, dish in `title3`, meta
  in `numeral` mono naming the voters, creator in `caption` mono. Rows
  are the same proof-sheet strip as §8 and §9, so the three list
  surfaces read as siblings. PD-007a chips apply as everywhere.
- **Header:** gains secondary `+ Vriend toevoegen` top-right — the
  mirror of Bibliotheek's `+ Link plakken`, so the two list tabs share a
  grammar.
- **Unseen band** for sends (§3.2); the closed-loop dress (§3.4). No
  "NIEUW" divider — the entrance motion is the only announcement.
- **Empty state (Gekookt):** copy becomes "Zodra vrienden koken of je
  iets sturen, staat het hier — met het originele filmpje erbij."; the
  privacy footnote updates to name the model: "Jouw kookbeurten zijn
  alleen zichtbaar als je dat zelf aanzet, en sturen doe je altijd per
  recept." Secondary actions: `Vriend toevoegen` and `Naar je
  bibliotheek`. Kring's empty state is §2.2's.

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

Kring mode:
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
│        Dat is de hele kring.       │ caption, centered
└───────────────────────────────────┘
```

### 4.3 Shared recipe screen — revised (`/friends/[feedItemId]`)

As shipped, plus the thumb-zone `Bewaren` primary (§3.3), with the
original-post link staying directly under the last step, never pushed
below the fold by the save (PD-010.2). The note, when the send carried
one, renders under the eyebrow with the card's left-rule treatment. A
proof card or kring row routes here too when it opens a canonical
recipe, with the same anatomy minus note and minus sender eyebrow.

### 4.4 Vriend toevoegen — the handle exchange (new, deliberately small)

The minimum viable friendship: you know someone's handle because they
told you. No search-by-name, no contact-book upload, no suggestions.
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

## 5. The opt-in, and what it actually exposes

**One switch per household: "Deel wat ik kook met vrienden." Off by
default.** It lives in household settings (`settings.tsx`), as its own
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
non-Article-9 facts. That is why the switch is off by default, why the
consent copy names the inference plainly ("vrienden zien welke gerechten
je maakt"), why the per-meal exclusion exists, and why the audience is
only ever mutually accepted friends — never strangers, never public, no
`public` member in `MealVisibility`.

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
PD-010's "sharing is an act, never a default" survives in both tiers:
you act once globally for proof, or per recipe for a send — and nothing
is shared by a migration, ever.

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
   canonical recipes (§7), which are already world-readable. Off by
   default; no `public` member appears; all five PD-010 mitigations
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
   a `recipe_ratings` vote; `cook_events.rating` never crosses a
   household boundary.** This is what makes showing a grade safe
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
- **`src/app/(tabs)/ranglijst.tsx`** — **untouched.** Stated so the
  absence is legible: the board is the protected object and nothing in
  this design reads or changes it.
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
- **No follower model, no public profiles, no vrienden-van-vrienden, no
  contact-book upload.** The graph is built by handle exchange between
  people who already know each other; growth loops over Article-9-
  adjacent data are the kind this product does not want.
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
