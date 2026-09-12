# WS-6 — The social layer, and the refusals

**Workstream:** 6 of 6. **Owns** (per `UI-RESEARCH-PLAN.md` §3.7): what the
social surfaces *do* and what they may *contain*, every §8 rebuttal, and any
recommendation to amend a PD. **Does not own:** redlines (WS-2), Dutch strings
(WS-3), colours or type families (WS-1), icons and imagery (WS-4), motion and
haptics (WS-5). Where this report needs one of those it states a *requirement*
and names the owner.

**Locks second** (§4.1), before any redline can be drawn — a spent refusal
changes what a card contains.

---

## 0. The recommendation, stated plainly

**Spend one thing, and it turns out not to be a §8 refusal at all.**

Of the eleven §8 refusals plus the four posture items (recency ordering,
timestamps, "nieuw" badges, infinite scroll), **fourteen stand and one is worth
revisiting later** (push, which §8 itself already records as *deferred, not
refused*). Not one of the eleven should be spent now.

The one thing to build is the **outbound invite** — a message the sender
composes and sends through a channel Remy does not own, carrying their handle.
It is not on §8's list: §8 refuses a follower model, public profiles,
friends-of-friends and contact-book upload, and an invite link is none of those.
It was deferred for a build reason (`friends.tsx`'s own comment: *"there is no
invite flow behind it yet, and a primary action that does nothing is worse than
no action"*) that has half-expired — `/friends/add` now exists, but it only
works if the other person is already a Remy user with a handle, which at launch
nobody is. Full treatment in §5. It is still a decision for the owner because it
is the exact place a product acquires a growth loop by increments, and it needs a
written boundary.

**But that is the small half of the finding.** The large half:

> **The free moves have not been exhausted — not remotely. Two of them are not
> "warmth" items at all but load-bearing product gaps, and they make the current
> §8 debate unfair to §8.**

1. **The friend feed has no reaction.** `DESIGN-SOCIAL.md` §1 says *"the
   reaction is the save — there is deliberately no lighter one"*, and §3.3
   specifies a thumb-zone `Bewaren` on `/friends/[feedItemId]`. **It is not
   built.** Verified: no `Bewaren`, no `Bewaard`, no `SaveIntentSheet` anywhere
   under `src/app/friends/`. `SaveIntentSheet` is mounted in exactly two places,
   `import/confirm.tsx` and `(tabs)/recipes.tsx`. So the argument against likes
   is currently defending a position that has nothing standing on it, and the
   Vrienden tab has no route to the only metric PD-004 recognises.
2. **The send tier is write-only on live data.** Live send cards do not render
   (`_gekooktSource.ts`: `FriendRecipeCardModel.creator` needs a `Creator`
   consent record a friend's imported meal does not have), the note — the
   warmest atom in the entire product — therefore never appears outside
   `__DEV__` fixtures, and the closed-loop dress *"never fires live"* because it
   needs a sender-side list no repository method returns. You hand a friend a pan
   and the product never mentions it again.

**You cannot know whether Remy needs a like until Remy has a save.** That is the
report's single most important sentence and it is why the honest answer on likes
is *stands, and re-open the question only after §2's free moves ship*.

**The warmth mechanism, in one line:** Remy's warmth is *the named person, set
as a person*. Everything needed already exists in the data and is currently
thrown away or mis-set — most visibly, the friend's name renders in
`typeScale.label` (monospace, 12pt, `letterSpacing: 0.8`, uppercased,
`textMuted`), which makes the one thing on the card that is not a derived fact
the smallest, greyest, most machine-set text on it. §2 is the full list.

**Trending should not ship as a fourth tab in its current state** (§6). Its
authorising decision, PD-014, rests on a question it cannot answer with zero
votes.

---

## 1. Where warmth currently fails, surface by surface

Read as *experiences*, per the deliverable. Everything below was verified in the
repo, not inferred from the docs.

### 1.1 The scoreboard first

| Surface | Does a person appear as a person? |
| :-- | :-- |
| **Kiezen's `friend_proof` reason** | **Yes.** Full Dutch sentence, Archivo, naming someone you know, on the screen everybody opens daily. Live and wired (`src/lib/friendProof.ts` → `(tabs)/index.tsx`). |
| **Bevestigen's proof line** | Partly. One mono `caption` footnote under the creator credit. Live (`import/confirm.tsx:316`). Correctly quiet — a derived fact reading as burned-in metadata is the right call here. |
| **Vrienden — proof card** | **No.** A row. See §1.2. |
| **Vrienden — send card** | Would be the warmest card in the app, and **does not render on live data**. |
| **The send sheet** | **No.** A list of rows with a mono `Stuur` at the end. See §1.3. |
| **Shared recipe screen** | Partly — the note renders here in its left-rule dress. But the screen is fixtures-only and has no exit. |
| **`friends/add`** | **No.** A form. And the one warm event in it is silent. See §1.5. |
| **Trending / de kring** | **No.** Rows you cannot even tap (`KringRow` has no `onPress` by design). |

**The finding that should reorder how this is thought about:** *the social
layer's best surface is not a social surface.* The friend-proof reason on Kiezen
is the warmest thing in the product — and it is a sentence, in prose type, about
a named person, on a screen with nothing else competing. That is the whole
answer to §1.1's job three, already shipped, in one place, and nowhere else.

### 1.2 Vrienden — the feed

**The name is set as metadata.** Both card kinds build an eyebrow —
`Gedeeld door Sanne` (`FriendRecipeCard.tsx:188`) and `Sanne maakte dit`
(`FriendProofCard.tsx:167`) — and both render it as:

```
typeScale.label  →  { fontFamily: monoSemiBold, fontSize: 12, letterSpacing: 0.8 }
color            →  colors.textMuted
textTransform    →  uppercase
```

The dish gets `title3` in Archivo, `textPrimary`. So the card's hierarchy says:
*the dish matters; the person is a label on it*. On the tab whose entire product
argument is that **the persuasive thing is the name** (PD-015 and PD-017 both say
so in as many words, and PD-017 refuses an anonymous count precisely on that
ground), the name is the least legible, coldest, most shouted text on screen.

This is not a criticism of the treatment in the abstract — mono-uppercase-muted
is `DESIGN.md`'s *"timecode burned into the frame"*, and it is exactly right for
a derived fact. The friend's name is the one thing on that card that is **not** a
derived fact. It is a person. **This is the single largest warmth defect in the
social layer, it is a treatment problem rather than a mechanics problem — which
is precisely what §1.1's job three says warmth here has to be — and it costs no
refusal to fix.**

**There is no reaction.** Covered in §0. To restate the consequence rather than
the fact: a person opens a dish a friend cooked, reads it, and the only thing
they can do is leave. `DESIGN-SOCIAL.md` §3.3 specifies the fix down to the
button's fill state (`positiveMuted` fill, `positive` text, `Bewaard`). It is a
spec with no producer — a variant of the handover §7 bug class.

**The colour budget is zero by construction.** `DESIGN.md` §8 puts *no
`positive` anywhere* and *`accent` stays absent too* on this tab (plan §6.5),
`background` → `surface` is 1.10:1 (plan §0), and PD-020.2 permits exactly one
`positiveMuted` chip on the closed-loop card, which never fires live. So Vrienden
is, arithmetically, a screen with one text colour, one muted text colour and
nothing else — the surface whose entire job is warmth. **Requirement to WS-1:**
this tab is the hardest test of any proposed palette; a direction that reads warm
on Kiezen and grey here has not solved the problem.

**On live data a proof card is three lines.** `CanonicalRecipeSummary` is a list
projection with no cook time and no ingredients, and the grade comes from
`recipe_ratings`, which nobody writes (§6). So a real proof card today is:
uppercase mono name, dish title, `@handle · TikTok`. Two of the three lines are
mono. The fixture cards look considerably better than the product does.

**The empty state is send-framed on a proof-first model.** It reads *"Stuurt
iemand je een recept, dan staat het hier"*; §4.2 asks for *"Zodra vrienden koken
of je iets sturen, staat het hier"*. On the two-tier model the floor is proof, so
the copy currently describes the ornament and omits the floor. **Route to WS-3**
(string) and **WS-4** (empty-state anatomy) — five stacked text blocks and no
picture is the coldest possible first impression of the warmest intended surface.

**What is right, and should survive any redesign.** The list ends in a sentence
(*"Dat is alles wat er gedeeld is."*). Nothing carries a timestamp. The unseen
band is applied at load rather than at render, so opening the tab does not erase
the band you came to see (`friends.tsx`, `orderGekooktList` before
`markSendsSeen`). The two card kinds are mutually non-assignable types so one
cannot be rendered by the other's component. This is careful work and the
makeover should not disturb any of it.

### 1.3 The send sheet — the richest case, and it is a form

This is the one moment in the product where somebody deliberately thinks of
somebody else. What is on screen (`SendRecipeSheet.tsx`, `§4.1`):

- `title3` "Sturen"; the dish as a **muted `bodySmall` string**. The thing you
  are handing over has a thumbnail in the database (`meals.thumbnail_url`) and it
  is not shown. You are sending a dish you cannot see.
- The note input — Archivo `body`, the only non-mono input in the app. **This
  gesture is real and it is the best single decision in the social design.** Keep
  it.
- Friend rows: a `surfaceSunken` disc with a mono initial, the name in `body`,
  the handle in mono `caption`, a mono `Stuur`. `Profile.avatarUrl` exists in the
  schema and is dropped at the row model — the friend has a face in the data and
  a letter on screen.
- A mono `Klaar` at the foot.

**Every button in the app is monospace** (`typeScale.button` → `monoSemiBold`;
handover's second measured defect). Which means the warmest tap in the entire
product — handing a friend dinner — renders as a terminal command. **Requirement
to WS-1:** if only one token changes in the whole makeover, `typeScale.button` is
the one, and this sheet is the surface that proves it.

**What is right:** the commit. Accent stroke under the name, `scaleX` 0→1 from
the left, label swaps to `Verstuurd`, one selection haptic, sheet stays open so a
second friend costs one tap, no toast and no success screen. That is restrained,
physical and correct. Keep it exactly.

**What is missing after the commit:** nothing ever comes back. See §4.

### 1.4 The shared recipe screen (`/friends/[feedItemId]`)

Fixtures only — no repository, no fetch. Renders attribution above, the note in
its quoted left-rule dress, ingredients, steps, and the original-post link at
full width below the last step (PD-010.2, correctly the largest control). Then it
stops. No save, no send-on, no way back into the product. It is a reading room
with one exit, and the exit leads to TikTok.

### 1.5 `friends/add` — the most important small screen, and its warm moment is silent

The copy here is the plainest and most honest in the app (*"Je voegt iemand toe
met de gebruikersnaam die je van elkaar kent. Meer manieren zijn er niet."*), and
the refusals it holds — no name search, no contact upload, no suggestions — are
well argued and, per its own header, structurally necessary: `profiles_select`
grants every authenticated reader every row, so *"the only thing standing between
this app and a user directory is that the client offers exactly one way to ask"*.

Two experience failures:

- **Your own handle is stated in `title1` mono.** The one place the product says
  who *you* are, and it reads as a serial number. **Requirement to WS-1.**
- **Acceptance is silent, and then it asks a privacy question.** The single
  highest-emotion event in the whole social layer — a friendship coming into
  existence — currently produces a row moving from `VERZOEKEN` to `VRIENDEN`,
  and then `CookSharingAskSheet` goes up (correctly, per §5 and PD-015, and it is
  properly mounted — verified). So the first thing that happens after making a
  friend is a four-paragraph consent disclosure. The disclosure must stay; §5's
  reasoning about Article-9-adjacent inference is sound and the sheet is well
  built (no scrim dismissal, no pre-selection, one callback). **The *order*
  inside the moment is a free design choice and nothing in §5 fixes it.**
  Requirement: acknowledge the friendship first — one beat, one line, one haptic
  — then ask. **WS-5** owns the beat, **WS-3** the line.

### 1.6 Trending and de kring

`KringRow` is deliberately not pressable, and `FriendProofCard`'s
`onOpenProof` is wired to `() => undefined` — both because opening a canonical
recipe needs a screen that reads canonical recipes and no such screen exists.
Both files say so honestly. The consequence is that the two surfaces built on
canonical recipes are **read-only lists that cannot convert to anything**, which
is PD-014's own condition 4 (*"every row is a route to cooking"*) failing on both
scopes. And both are empty anyway (§6).

`FriendProofCard` still owns a press affordance, so a proof card *depresses* and
then does nothing. Its own header calls this "a real rough edge". It is: an
affordance that lies is worse than none, and this one is in the product today.

---

## 2. A warmth mechanism that costs no refusal

**The mechanism: the named person, set as a person, with the thing they handed
you made visible.** Everything below is available inside the current rules. None
of it spends a §8 item or amends a PD. Ordered by warmth-per-hour.

### F1 — Set the name like a name (treatment, free)

Move the friend out of `typeScale.label` / `textMuted` / uppercase and into the
card's own voice. The two eyebrows stay two separate strings built by two
separate functions (PD-016's requirement that a send never borrows the language
of proof is carried by the **verb** — *maakte dit* vs *Gedeeld door* — and by the
note's presence, never by the type treatment), so promoting both preserves the
distinction intact.

**Owner of the decision:** WS-1 (type family and role), WS-2 (the redline).
WS-6's requirement: *on any social card, the person is at least as loud as the
dish, and is never set in the same voice as a machine-derived fact.*

### F2 — Give the friend feed its reaction back (`Bewaren` on the shared recipe screen)

Already specified in `DESIGN-SOCIAL.md` §3.3 and §4.3, down to the fill state.
Not built. This is not an addition to the model; it is the model's own answer to
"what do I do about this?", and its absence is why §8's likes refusal currently
has nothing behind it.

**PD-004 impact: strictly positive and unusually clean.** This is the only path
that exists from the social tab to a save, and therefore to a cook. Today the
Vrienden tab cannot be measured by the metric the product measures everything by,
because it has no conversion event at all.

**Engineering cost (real, not a UI change):** a copy-meal write into the reader's
household starting at `allergenTagStatus: 'unknown'` (PD-010's fifth condition),
reusing `SaveIntentSheet` unchanged (`Deze week` / `Ooit`, PD-004a's two
options). The read side already exists — `listMealsSentToMe` returns a friend's
meal with its ingredients. This belongs with WS-6's model lock, not with the
visual refactor.

### F3 — Finish the send tier's live path

Three items, all specified, none a refusal:

1. **The send card's model needs an attribution-only shape.** `_gekooktSource.ts`
   states the blocker precisely: `FriendRecipeCardModel.creator` is a whole
   `Creator`, which is a *consent record* (PD-007, `creators.opted_in_at`), and a
   friend's imported meal has attribution but no consent row. Fabricating one
   from `recipes.author_name` would conflate the two — correctly refused. The
   honest fix is a separate attribution-only type reaching `CreatorAttribution`
   and the shared recipe screen. **Until this lands, the note never renders on
   real data, which means the warmest element in the product is unreachable.**
2. **The sender-side list** (`§3.5`'s *"Gedeeld met Sanne en Joris"*). Its shape
   is already specified in `src/lib/repository/social/types.ts`: *"it must return
   a shape without `seen` … it may name who was sent to, never whether they
   looked."* Build it to that shape. It is not a read receipt and must not
   become one.
3. **The closed-loop dress**, which depends on (2) and currently *"never fires
   live"*. This is the one moment the product pays a sender back for a generous
   act, and it is the whole emotional payload of PD-020.2.

### F4 — Show the dish you are sending

A thumbnail in the send sheet's header. Data exists. **WS-4** owns the fallback
anatomy (monogram, at what size). Free.

### F5 — Use the face that is already in the schema

`Profile.avatarUrl` is dropped by `SendRowModel` and by both card models. A
mutually accepted friend's avatar is not a public profile and is not on §8's
list. **Honest caveat, stated rather than glossed:** there is no avatar *upload*
path in the product, so in practice every avatar is null until one exists, and
the real deliverable here is a monogram with character rather than a letter on a
flat `surfaceSunken` disc. **Requirement to WS-4:** one monogram/avatar
component, used in all four places the logic is currently duplicated. Do not
sell this as the warmth fix; it is the fallback that is the fix.

### F6 — Let the note breathe

§1 calls the note *"a post-it on a pan lid"*. A post-it sits **on top of** the
pan. Today it is `bodySmall` / `textSecondary`, below the dish title and above
the ingredients. **Requirement to WS-1/WS-2:** on a send card the note is the
second-loudest element after the dish, at body size, and it keeps its
`borderStrong` left rule and its quotation marks (both correct — the rule is how
this product says *"these are not our words"*).

### F7 — Give proof cards and kring rows a destination

One canonical-recipe screen unblocks: `FriendProofCard`'s dead press,
`KringRow`'s missing press, both Trending scopes' condition-4 obligation under
PD-014, and the ability to save anything discovered socially. This is the second
half of F2 and should ship with it.

### F8 — Acknowledge the friendship before asking about privacy

§1.5. **WS-5** owns the beat and the haptic, **WS-3** the sentence.

### Where *een vleugje lol* lives in the social layer

Not in mechanics — the mechanics are all refused, and §6.8 of the plan is right
that their sum is a product with no sanctioned way to be delighted. In this
workstream's territory the answer is narrower and, I think, actually correct:

> **The fun in Remy's social layer is somebody else's fun. The product's job is
> not to be funny — it is to frame a human line well.**

The note is the only place in the entire product where a person wrote something,
and the product currently sets it in small grey type at the bottom of a card
nobody can see on live data. F3 + F6 are the whole *lol* strategy for this third
of the app, and they cost nothing.

Two small existing moments already do this and should be protected: the note
placeholder *"Schrijf er iets bij (mag)"* — the parenthesis is the permission —
and the over-length error, *"Dit briefje is 3 tekens te lang. We korten niets in.
Haal er zelf iets af."* That is a product with a personality, written once, in a
copy module, and nobody has noticed. **Route to WS-3** as the register to
extend.

---

## 3. The §8 re-examination, item by item

**Method:** anything not *stands* gets the full §1.4 treatment — original
argument quoted, why it no longer holds **or** why the benefit now outweighs it
(stated explicitly), cost in PD-004's terms, engineering cost where it is not a
UI change, handed to the owner as a decision.

### 3.1 The verdict table

| # | Refusal | Verdict |
| :-- | :-- | :-- |
| 1 | No likes, hearts, emoji reactions | **Stands** — and the alternative it names (the save) does not exist yet, so the question cannot be asked honestly until F2 ships. §3.2. |
| 2 | No chat, replies, threads | **Stands.** WhatsApp is the real competitor, it is warm with no product help, and ~69–84% of all sharing already happens there. §3.3. |
| 3 | No read receipts | **Stands** — and the plan's engineering estimate is wrong in a way the owner should know. §3.4. |
| 4 | No pretending a send is proof | **Stands.** Enforced by two types, two components, two destinations. Nothing to reopen. |
| 5 | No counts without names, no stranger counts | **Stands.** Supported by the social-proof literature; PD-018.4's "8,2 · 4 stemmen" past two names is the one exception and is already reasoned. |
| 6 | No padding the kring | **Stands.** Structurally enforced — `assembleKring` has no parameter that could pad. |
| 7 | No follower model, public profiles, vrienden-van-vrienden, contact-book upload | **Stands, all four** — but an **outbound invite is none of the four** and should be built. §5, full §1.4 treatment. |
| 8 | No trophy shelf, streaks, most-cooked leaderboard of friends | **Stands, firmly.** Same mechanism as PD-019, and the Strava literature documents the failure mode. §3.5. |
| 9 | No inline video, no autoplay | **Stands.** Legal (PD-007, `research/13-legal-tos.md`) and technical, not aesthetic. Not WS-6's to spend. |
| 10 | No fifth tab | **Stands.** Nothing needs one — and the *fourth* tab is the one under question (§6). |
| 11 | No push notifications | **Worth revisiting — later, not now.** §8 already records it as *deferred, not refused*. §3.6. |
| — | Recency ordering | **Stands.** This is an argument with PD-004 and it loses: nothing about cookability is time-dependent. |
| — | Timestamps on cards | **Stands.** `FriendCook` structurally has no timestamp to render; `sentAt` is carried as a tiebreak and never as copy. |
| — | "Nieuw" badges | **Stands.** PD-020.1 already narrowed this deliberately; the entrance motion and the unseen band do the job. |
| — | Infinite scroll | **Stands, and it is structurally impossible.** *"The feed cannot exceed what your friends actually cook."* Nothing to spend. |

**Score: fourteen stand, one revisit, zero spends.** The one thing this report
asks the owner to authorise (§5) is not on the list.

### 3.2 Likes — why it stands, and the condition under which to re-ask

**The original argument, verbatim (`DESIGN-SOCIAL.md` §8):**

> "**No likes, hearts, or emoji reactions.** A costless reaction is
> dwell-currency; the save is the reaction; emoji are banned as status
> indicators anyway. First thing a future request will ask for — the answer is
> written down now."

**Does it still hold?** Yes, and the evidence is better than the argument.

- **Removing the counter does not kill sharing.** Instagram's hidden-like-count
  experiments produced a limited behavioural response at the platform level;
  the measured effect was ~10% less like activity, redirected into commenting
  rather than lost. The counter was not load-bearing for supply. Meta's own
  stated theory — that hiding likes would *increase* posting — did not clearly
  materialise either. Neither direction supports "add likes or people stop
  sharing".
- **The strongest counter-case is Strava, and it is the wrong shape.** The
  empirical work is real: runners who receive kudos run more, and more often,
  and kudos-friends' behaviour converges over time. But the same literature
  documents the price — self-presentation, social pressure, self-surveillance,
  and the folk law *"if it isn't on Strava, it didn't happen"*. In Remy that
  distortion lands somewhere specific and expensive: on the grade. **PD-019's
  inflation mechanism does not require a grade to actually be visible — it
  requires the cook to *believe* it might be.** Adding a public, costless
  reaction to a card that also shows a number is exactly how that belief forms.
- **And the alternative does not exist.** §0 and §2/F2. Judging "no likes"
  against a screen with no save is judging it against nothing.

**Also — the reaction chain is already designed and it is broken in two places,
not missing.** The intended loop is: *send → save → cook → proof → closed-loop
dress on the sender's card*. Three of those five links work. Links 2 (save) and 5
(closed loop) do not. **The correct recommendation is finish the chain, not add
a like.**

**Verdict: stands.** Re-open only after F2 ships and there is a measurable
save-to-cook rate on the Vrienden tab. If that rate is healthy, a like adds
dwell without adding cooks and PD-004 rejects it. If it is near zero, the problem
is the card and the destination, and a like will not fix that either.

### 3.3 Chat and replies — stands

**The original argument, verbatim:**

> "**No chat, replies, or threads.** One note per send, outbound only. The
> moment Remy hosts a conversation it competes with WhatsApp, loses, and carries
> moderation obligations for the privilege."

**Still holds, and the Dutch case makes it stronger.** Households already share
recipes over WhatsApp, and that channel is warm with no product help at all —
which is the actual competitive fact here. Industry measurement of "dark social"
puts roughly 69–84% of all link sharing in private messaging rather than public
platforms. A product that adds a reply box is not adding warmth; it is adding a
worse version of a channel every one of its users already has open, and taking on
content moderation to do it. `SEND_NOTE_MAX_LENGTH = 140` and the single-line
input are the correct expression of this — *"a post-it on a pan lid, not the
opening of a chat"*.

**Verdict: stands.** Nothing to reconsider.

### 3.4 Read receipts — stands, and a correction to the plan's cost estimate

**The original argument, verbatim (`DESIGN-SOCIAL.md` §8):**

> "**No read receipts.** 'Gezien' creates the obligation to respond. The sender
> learns one thing, ever: that the dish got cooked — and only from a friend who
> shares her cooking at all."

And, as enforcement, `src/lib/repository/social/types.ts` on `markSendsSeen`:

> "TAKES NO SHARE ID, AND THAT ABSENCE IS THE FEATURE … a signature that could
> name a single send would hand that brick to the first screen wanting a subtler
> count, and the refusal in §8 would then depend on everyone remembering it.
> There is nowhere to put the id instead."

**Does it still hold? Yes, and the empirical support is direct.** The CHI 2022
study of unresponded-to read receipts documents the mechanism by name: the
feature lets conversational partners monitor and sanction each other's response
behaviour, producing a stronger perceived obligation to answer immediately. A
survey of WhatsApp users found more than two in five said the app would be a more
relaxed experience without them, and that users who felt bad about them would
rather not know. **In Remy the obligation is worse than in a messenger, because
the only available "response" is to save the dish and cook it.** A read receipt
would convert a gift into a chore — which is the exact thing PD-016's reversal
was protecting when it removed the cook gate: *"requiring evidence before
somebody may say that turns a generous impulse into an errand."*

**The correction, which the owner should have.** `UI-RESEARCH-PLAN.md` §1.4 and
`UI-MAKEOVER-HANDOVER.md` §4 both say overturning this is *"a repository
redesign, a migration and an RLS change"*. Reading migration 0009: it is a
repository change and **nothing else**.

```sql
create policy recipe_shares_select on recipe_shares
  for select using (
    sender_profile_id = auth.uid() or recipient_profile_id = auth.uid()
  );
```

`seen_at` is already a column, is already written by `markSendsSeen`, and is
already readable by the sender under RLS. `recipe_shares_update` already admits
both parties. **There is no migration to write and no policy to change.** The
refusal is enforced *entirely* in TypeScript — `RecipeShare` has no `seen` field,
`IncomingSend` is returned only to the recipient, and no method returns a sender
their own sent rows. `types.ts` says exactly this itself.

**Which way does that cut?** Toward keeping it, in two ways.

1. **It makes overturning cheap** — roughly a day — so the decision is a pure
   product decision with no engineering cost to hide behind. There is nothing to
   weigh on the cost side; there is only the CHI/WhatsApp evidence and PD-004.
2. **It makes the type-level discipline the only thing holding.** Which is a
   standing hazard worth naming: a future agent writing a raw
   `supabase.from('recipe_shares').select('*')` inside a screen would ship a read
   receipt without touching the repository, and nothing in the test suite would
   notice. This is not a privacy leak — the sender is a party to the row — but it
   is a product-discipline hazard of exactly the kind this codebase keeps
   discovering. **If the owner wants belt-and-braces, a column-level `revoke` on
   `seen_at` for the sender is the migration; that is the only place a schema
   change enters this topic at all, and it is a change to *strengthen* the
   refusal, not to spend it.**

**Cost in PD-004's terms, if it were spent:** a receipt is a dwell mechanism with
no cook attached. The sender returns to check; nothing gets cooked as a result.
Straightforwardly on the wrong side of the metric.

**Verdict: stands.** Recommendation to the owner: leave it, and consider the
column-level `revoke` as a cheap hardening item whenever the schema is next
touched for another reason.

### 3.5 Trophy shelves, streaks and leaderboards of people — stands, firmly

**The original argument, verbatim:**

> "**No trophy shelf, no streaks, no most-cooked leaderboard of friends.** Proof
> decorates recipes; it never accumulates into scores for people. The kring
> ranks recipes by friends' votes, never friends by anything. The moment cooking
> earns a persistent number, people cook for the number."

This is the same mechanism as PD-019's, applied to a different quantity, and the
Strava literature is the empirical case *for* it: performance data made social
reliably produces self-presentation and pressure alongside the motivation. Remy's
version of that failure is not a bad feeling — it is a corrupted engine input,
because a household cooking for a visible number will grade for one too.

**Verdict: stands.** This is the item I would defend hardest of the eleven.

### 3.6 Push — worth revisiting, and still not now

**The original argument, verbatim:**

> "**No push notifications, including for the closed loop.** Deferred, not
> refused — recorded in §6 territory so it takes a decision, not drift, to
> appear. The first push this product sends should be its best one, and that
> argument deserves its own day."

**The benefit case is real and the argument is knowable.** The best push this
product can send is *"Sanne heeft je iets gestuurd."* — a letter addressed to
you, which is precisely the boundary PD-020.1 already drew for the tab count
(*"a count of letters addressed to you … is mail"*, and ambient proof never feeds
it). A push that inherits that exact rule — **directed sends only, never ambient
proof, never a digest, never "je vrienden hebben deze week 4 keer gekookt"** —
does not contradict PD-004; it is the only notification whose payload is a
specific dish from a specific person.

**Why not now:** the precondition is that the thing being announced exists on
live data, and live send cards do not render (§2/F3). A push announcing a card
that renders as nothing is worse than silence. There is also a real engineering
cost — an Expo push token store, an APNs/FCM setup, a server-side trigger on
`recipe_shares` insert, and a per-household preference — none of which is a UI
change.

**Verdict: worth revisiting, in the same change that makes live sends real.**
Hand to the owner then, with the boundary above written into the PD before the
first token is stored, because the second push a product sends is always a
digest unless somebody wrote down that it may not be.

### 3.7 One item that is not on §8's list but is adjacent, and is worth a decision

**Move the one-time cook-proof ask from "first friendship accepted" to "first
cook completed while having at least one friend".**

Today `shouldAskCookSharing` is `acceptedFriendCount === 1 && !alreadyAsked`
(`addFriendCopy.ts:601`), so a household is asked whether to name its cooking to
friends at the moment it acquires its first friend — which may be before it has
cooked anything in the app at all. §5's justification is *"the one moment the
question is genuinely relevant"*; the genuinely relevant moment is arguably the
first cook you could actually share.

- **Why the benefit outweighs:** the question becomes concrete rather than
  hypothetical, the household has something to disclose, and it stops being the
  cold thing that happens immediately after the warm thing (§1.5).
- **Cost:** households that never complete a cook are never asked — which is
  correct, since they had nothing to share. And the ask is still asked **once**,
  so §5's "asked once, not campaigned" survives verbatim.
- **Engineering cost:** small — the guard moves from the accept path to the
  outcome path, and both facts it needs (accepted friend count, the durable
  `asked` flag) are already readable there.
- **It is a PD-015 amendment** (one sentence), so it is the owner's call.

**Recommendation: take it, but low priority** — it is a sequencing improvement,
not a warmth mechanism.

---

## 4. Verdict on the two-tier model

**The argument holds. The shipped product is currently its inverse, and that is
the thing to fix — not the model.**

### 4.1 Why §0's argument survives

> "a week in which nobody sends you anything is a week in which the social layer
> is empty, and an empty social layer cannot help you decide what to eat …
> A messenger needs correspondents; a food app needs food."

The comparable products bear this out:

- **Poparazzi** required another human to act for any content to exist at all —
  its whole premise was that you cannot post about yourself. It reached ~4M
  monthly actives out of ~6.2M lifetime installs and fell to roughly 2–3k
  monthly actives before shutting down in 2023. A social product whose supply
  requires a second person's initiative has no floor.
- **BeReal** solved supply by *manufacturing* it: one prompt, everyone at once.
  It worked — and it produced exactly one unit of supply per person per day and
  nothing else to do with it. DAU fell ~48% between October 2022 and February
  2023, and downloads ~60% year-over-year into 2024; the app sold to Voodoo. Note
  the other half of the number, because it is the useful half: engagement among
  remaining actives stayed high (~72% daily). **The constraint did not stop
  working as a retention mechanism; it stopped working as a growth mechanism,
  because a constraint that generates one artefact a day has a ceiling.** Remy's
  proof tier has the same shape and the same ceiling — and, unlike BeReal, it
  does not need the constraint to be interesting, because the artefact is a
  recipe you might cook.
- **Letterboxd** is the closest good analogue: supply derived from something
  people were doing anyway, friend-scoped, no algorithmic feed. 1.8M users in
  2020 to ~17M by end of 2024, without adding stories, reels or a ranked feed.
- **Marco Polo** is the counterexample that proves the split: it is warm,
  deliberately has no likes and no comparisons, and it is unambiguously a
  *messenger* — it never pretends to have a floor.
- **Cookpad's Cooksnap** is the closest thing in food to Remy's proof tier, and
  it is worth naming as the road not taken: a Cooksnap is a *human act* (a photo
  of your finished dish sent to the recipe's author) rather than a derived fact.
  It buys much richer proof — a picture, a comment, a delighted author — at the
  price of requiring somebody to do something. Remy's derived proof is the
  cheaper, more reliable trade for a product with no creator community to
  delight, and it is the right trade. **But it explains, precisely, why Remy's
  proof feels thinner than Cookpad's: Remy's proof has no photograph and no
  words in it, because nobody made one.**

### 4.2 Three things the model gets wrong as an *experience*

**(a) The floor is off by default, and is gated behind a consent the product
cannot skip.** Proof needs no *sender*, but it needs a *decision* — and a
decision is rarer than a message. Every household starts with the floor missing.
§5's privacy analysis is right and the switch must stay off by default; the
consequence is simply that the "floor" is a floor only after somebody says yes.
That is a genuine hole in §0's supply argument and it should be recorded rather
than argued away. §3.7's sequencing change is the cheapest available mitigation.

**(b) The floor is quieter than the ornament, by a wide margin.** `FriendCook` is
`(profile, recipeId)` — no time, no count, no rating, by deliberate design and
for good reasons. A live proof card is therefore a name, a dish and a creator
handle. A send card carries a person, a dish, a thumbnail *and* a line somebody
wrote. **The model names the warm one the ornament.** That is not a reason to
invert the model — supply still wins the architecture argument — but it *is* a
reason to reject the build ordering the word "ornament" implies.

**(c) The send tier is write-only on live data.** The closed loop — the one
mechanism that pays a sender back — *"never fires live"*, because deciding it
needs the sender-side list that deliberately does not exist yet. So the entire
emotional return path of the product's one human act is unbuilt.

### 4.3 The verdict

**Keep the model. Re-rank the build.** The send tier's live path (§2/F3) is worth
more warmth per engineering hour than anything else available in this
workstream's territory, and every piece of it is already specified —
including the sender-side list's exact shape (*"it may name who was sent to,
never whether they looked"*). The word "ornament" is right about architecture and
has been read as a priority. It is not one.

**No PD amendment is required for any of this.** It is a sequencing
recommendation, not a decision.

---

## 5. Verdict on the empty social layer

### 5.1 The state, stated exactly

A new household's social layer is four surfaces, of which:

- **Vrienden** is empty until a friend exists *and* that friend opts in to cook
  proof, or sends something.
- **Trending — Iedereen** is empty until the population casts enough
  `recipe_ratings` votes to clear `LEADERBOARD_MIN_VOTES`. Nobody casts any (§6).
- **Trending — Vrienden** is empty until a friend votes. Nobody votes.
- **Kiezen's `friend_proof` reason** — the best social surface in the product —
  is silent for the same reason.

And the only door out is `/friends/add`, which requires you to know somebody's
Remy handle. **At launch nobody has a Remy handle, because nobody is on Remy.**

The handover and the plan both quote the old comment about there being no invite
flow; note that half of it is now out of date — `/friends/add` exists and works,
and the Vrienden empty state offers it as a secondary. What does **not** exist is
the *outbound* half: any way to reach a person who is not already a user.

**Handle exchange is a good mechanism for a product that has users and a
non-mechanism for a product that does not.** That is the finding.

### 5.2 The recommendation, with the §1.4 treatment attached

**Build an outbound invite.** Presented with the full §1.4 treatment out of
caution, because it is adjacent to a refusal even though it is not one.

**1. The original argument, quoted.** `DESIGN-SOCIAL.md` §8:

> "**No follower model, no public profiles, no vrienden-van-vrienden, no
> contact-book upload.** The graph is built by handle exchange between people who
> already know each other; growth loops over Article-9-adjacent data are the kind
> this product does not want."

And `§4.4`, restated in `friends/add.tsx`'s own header:

> "The minimum viable friendship: you know someone's handle because they told
> you. No search-by-name, no contact-book upload, no suggestions."

**2. Why it no longer holds — or why the benefit outweighs.** *Neither,
strictly: the refusal does not cover the thing being proposed.* An outbound
invite is not a follower model, not a public profile, not
friends-of-friends, and not a contact-book upload. The named hazard is
**enumeration and disclosure of third parties** — a contact-book upload discloses
every person in the book, none of whom agreed to anything. An invite discloses
*the sender*, to *one recipient the sender chose*, through *a channel the sender
already uses*. Nobody else's data is read, uploaded or inferred. The structural
protection `friends/add.tsx` identifies — that `profiles_select` grants every
authenticated reader every row, so the client offering exactly one way to ask is
the only thing preventing a user directory — is completely untouched: an invite
does not add a way to *ask*, it adds a way to *tell*.

The deferral in `friends.tsx` was explicitly a build reason (*"there is no invite
flow behind it yet"*), and it has half-expired.

**3. Cost in PD-004's terms.** On-metric, and unusually cleanly. An invite raises
friend count → raises proof supply → raises the number of named-person reasons on
Kiezen → and PD-017's own argument says a named-person reason is a *cookability*
signal, not a social ornament: *"a dish somebody you know actually produced is
more likely to convert into a cook than one nobody you know has."* There is no
dwell-time story here at all; an invite is one outbound message and a person
either arrives or does not.

**4. Engineering cost.** Two versions:

- **Cheap (recommended for v1):** a share-sheet action composing one line —
  the sender's handle plus a store link — and nothing else. No schema, no deep
  link, no pending-invite table. Roughly half a day. The recipient installs,
  claims a handle, and types the one they were sent.
- **Full:** a deep link carrying the handle, claimed after signup, so the
  friend request is pre-addressed. Needs a link scheme, a pending-claim path
  through `claim-handle`, and a decision about what happens if the link is
  opened by an existing user. Not warranted before there is evidence the cheap
  version converts.

**5. Handed to the owner as a decision, with the boundary that makes it safe.**
An invite is exactly where a product acquires a growth loop by increments —
invite, then *"3 vrienden wachten op je"*, then a reminder, then contact upload.
Recommend the owner ratify it **with a written boundary in the PD**:

> One outbound message, composed by the sender, sent through a channel Remy does
> not own. No reminders, no invite count, no "X vrienden wachten", no
> reciprocity prompt, no address book, ever.

**One alternative, named and recommended against.** Hide the Vrienden tab until
the household has one friend. `DESIGN.md`'s tab rule is about *questions*, and
"wat hebben mensen die ik ken gemaakt" is arguably not a question you have when
you know nobody. It is cheap and it is reversible. **Recommend against:**
navigation that appears is a surprise, it makes the app's shape unstable in the
first week, and it treats the emptiness as something to hide rather than to fix.
Named because it is the honest cheap option and the owner should see it.

### 5.3 A free move alongside it

**One empty-state posture across all four empty social surfaces.** Right now
Vrienden, Trending-Iedereen, Trending-Vrienden and the send sheet each hand-roll
their own, in three different registers. The plan's §2.2 already flags six-plus
hand-rolled empty states as a top-five gap, and Remy ships *deliberately* empty.
**Requirement to WS-4** (anatomy) and **WS-3** (strings): the social empty states
are the most-seen screens in the product's first week and should read as one
voice saying one true thing.

---

## 6. Verdict on Trending, which cannot populate

### 6.1 Confirmed, in code

`recipe_ratings` has readers in `leaderboard.ts`, `kring.ts`, `ratings.ts`,
`proof.ts`, `friendProof.ts` and both Trending scopes. `rateRecipe` exists on
`RemySocialRepository` and is implemented in **both** backends
(`localSocialRepository.ts:357`, `supabaseSocialRepository.ts:268`). **No screen
calls it.** Grep across `src/app/**` and `src/components/**` returns nothing.

So the public-vote instrument is unwritten, and it is an input to **four**
surfaces, not one: Trending-Iedereen, Trending-Vrienden, the grade on every proof
card, and the *"…en gaf het een 8,5"* half of Kiezen's friend-proof reason.

### 6.2 Evaluating the standing proposal: ask on the second cook

**The proposal is right about the moment and needs one thing added.**

**What is right.** *Earned rather than solicited* is the correct instinct, it
reuses the repeat signal PD-008 already derives, and a household that cooked
something twice has demonstrated exactly the thing a public vote claims. Nothing
about it contradicts PD-019.

**What is missing, and it is the sharpest risk in the whole proposal:**

> **PD-019's inflation mechanism runs on the household's *belief* that a grade is
> visible, not on the grade actually being visible.**

*"A grade the proud cook knows her friends can see is a grade that gets
inflated."* If the public vote is asked immediately after the private grade, on
the same card, with a similar-looking control, a household cannot reasonably be
expected to hold the distinction — and from that moment `cook_events.rating` is
graded as though it were public, which corrupts the decision engine's input
exactly as PD-019 warns, **invisibly, and without any private grade ever
crossing a household boundary.** The split is protected by the schema; it is not
protected by the interface, and this is the change that would put it at risk.

**Three conditions follow, and they are not optional:**

1. **A separate moment, not a second row on `OutcomeCard`.** PD-003 protects the
   outcome flow (*"outcome is never proactively pushed"*) and PD-008a's rating
   parity is one gesture to rate, one tap to skip. Adding a second question there
   raises the cost of the one flow that feeds the engine.
2. **A visibly different control**, and the copy must name the audience out
   loud — because PD-019's own safety argument is that a public vote is *"cast in
   the knowledge that it is public"*. The number itself stays on the same
   1,0–10,0 scale (PD-008a, and `rateRecipe` validates against
   `src/domain/rating.ts`), so what differs is the instrument's *dress* and its
   *sentence*, not its arithmetic. **WS-5** owns the interaction; **WS-3** owns
   the sentence; WS-6's requirement is that the sentence says who sees it.
3. **The private grade must never pre-fill the public vote.** Pre-filling makes
   the two numbers identical by default and destroys the split silently — the
   worst possible failure mode, because it looks like a convenience.

**Where to put it — the recommendation.** On the **recipe**, not in the flow: a
quiet, dismissible row on the library tile's action sheet / recipe screen that
appears only once the household has cooked that dish twice. That keeps the
outcome flow at exactly its present cost, keeps the two instruments in two
different places on two different screens, and makes the vote genuinely optional
rather than a toll on the cook flow. **This is a decision for the owner** because
it sits adjacent to PD-003 and PD-008a even though it amends neither.

**One alternative, named and recommended against: ask on the send.** Sending a
dish you cooked is already a public assertion that it is good, so it looks like a
natural vote moment. Recommend against: PD-016 deliberately removed cook-awareness
from the send path (*"a send is 'ik moest aan jou denken', and requiring evidence
before somebody may say that turns a generous impulse into an errand"*), and a
vote prompt conditional on a cook event puts it straight back. The insert policy
in 0009 carries a comment saying there is deliberately no fourth clause; this
would be that clause arriving through the UI.

### 6.3 Should a permanently-empty fourth tab ship?

**No — not in its current state.** As a decision for the owner, with both costs:

**The case against shipping it empty:**

- PD-014 authorised the board on the claim that it answers a fourth question,
  *"wat is hier echt goed?"*. **A board with zero votes answers nothing**, so the
  decision's own justification is not yet true.
- PD-014's condition 4 is *"every row is a route to cooking"*. There are no rows,
  and even with rows, tapping one goes nowhere: `KringRow` is deliberately not
  pressable and no canonical-recipe screen exists (§2/F7).
- It is guaranteed to show an empty state to **100% of users, forever**, until
  the vote exists. That is worse than the Vrienden emptiness, which at least
  resolves when you make a friend.
- **The default scope is the one that stays empty longest.** The control defaults
  to `Iedereen` on every visit. `rankRecipes` applies `LEADERBOARD_MIN_VOTES` and
  Bayesian shrinkage because its voters are strangers; `rankKring` applies a floor
  of **one** vote and no shrinkage. So even after the vote ships, the friends
  scope populates first — possibly by months — and the tab's first impression is
  the slower list. **The global board is a post-scale surface shipped
  pre-scale.**

**The cost of holding it:** PD-014 is a taken decision, and un-shipping its
surface is a partial reversal that only the owner can make. Against that: holding
is unusually cheap and completely reversible. **Nothing is deleted** — the
screen, `_trendingSource.ts`, `rankRecipes`, `rankKring`, `KringRow`,
`leaderboardPresentation`, `kringPresentation` and the fixtures all stay exactly
as they are. Only the `Tabs.Screen` registration in `(tabs)/_layout.tsx` comes
out, and it goes back in one line. It also buys the tab bar back a slot, which
matters more than it sounds: four monospace words at 12pt is already the least
playful navigation available (plan §6.6), and one of them currently leads to a
blank page.

**Recommendation, as a decision:**

> **Either ship the public vote in the same release as the tab, or hold the tab
> until the vote exists.** Do not ship a fourth tab that is empty by
> construction. If the owner prefers to keep it visible, then at minimum **build
> the vote first** (§6.2) and **default the scope to `Vrienden` when the reader
> has at least one friend** — see below.

**On defaulting the scope.** PD-014.6 forbids *personalising the ordering* of the
global list, because a per-viewer ordering makes an unaccountable private reality
out of the one list whose meaning is that everyone sees the same thing. Choosing
**which of two separate lists opens first** is a default, not an ordering: the
global board stays byte-for-byte identical for every reader, produced by
`rankRecipes` from a read that never sees the household. PD-018 already makes
exactly this argument for why the scope switch is legitimate where the old
`Iedereen | Vrienden` toggle on the board was not. **Caveat to state to the
owner:** it does make the tab's *first impression* per-reader, and a purist could
read that as against the spirit of the decision even though it is clearly within
its letter. Presented as a small decision, not a §8 spend.

---

## 7. Requirements handed to other workstreams

Stated as requirements, per §3.7. WS-6 does not produce any of these artefacts.

| To | Requirement | From |
| :-- | :-- | :-- |
| **WS-1** | On any social card, the friend's name is at least as loud as the dish and is never set in the same voice as a machine-derived fact. Move it out of `typeScale.label`/`textMuted`/uppercase. | §1.2, F1 |
| **WS-1** | `typeScale.button` is monospace, so `Stuur` — handing a friend dinner — reads as a terminal command. This surface is the argument for changing that token. | §1.3 |
| **WS-1** | Vrienden is by construction a colourless screen (`no positive`, `no accent`, 1.10:1 surface step). Any proposed direction must be tested here first, not on Kiezen. | §1.2 |
| **WS-1** | Your own handle on `friends/add` renders `title1` mono and reads as a serial number. It is the one place the product states who *you* are. | §1.5 |
| **WS-2** | On a send card, the note is the second-loudest element after the dish, at body size, keeping its `borderStrong` left rule and quotation marks. | F6 |
| **WS-2** | The send sheet needs room for a dish thumbnail in its header. | F4 |
| **WS-3** | Vrienden's empty-state body is send-framed on a proof-first model. §4.2's line names both tiers. | §1.2 |
| **WS-3** | A sentence for the moment a friendship is accepted, before the consent sheet. | F8 |
| **WS-3** | The public-vote prompt must name its audience out loud ("dit cijfer zien anderen"). Non-negotiable — it is PD-019's safety condition. | §6.2 |
| **WS-3** | The register to extend: `"Schrijf er iets bij (mag)"` and `"We korten niets in. Haal er zelf iets af."` This is where the product already has a personality. | §2 |
| **WS-4** | One monogram/avatar component for all four duplicated sites, designed so the *null* case carries the warmth — there is no avatar upload path. | F5 |
| **WS-4** | One empty-state anatomy across all four empty social surfaces. Most-seen screens in the first week. | §5.3 |
| **WS-4** | A thumbnail-with-fallback for the send sheet at a new size. | F4 |
| **WS-5** | One beat acknowledging an accepted friendship, before `CookSharingAskSheet` rises. | F8 |
| **WS-5** | The public-vote control must be visibly a different instrument from `RatingScale`, on the same 1,0–10,0 scale. | §6.2 |
| **WS-5** | Do not disturb the send-commit motion (accent stroke, `Verstuurd`, one selection haptic, sheet stays open). It is correct. | §1.3 |

---

## 8. What is established and what is hypothesis

Per §5 of the plan: *no comp can tell you whether the social layer feels warm —
that needs two real households, a week, and someone actually sending someone else
a pan.*

**Established — verified in this repo, quotable as fact:**

- No `Bewaren` / `SaveIntentSheet` anywhere under `src/app/friends/`. The friend
  feed has no reaction and no conversion event.
- `rateRecipe` has two implementations and zero callers in `src/app/**` or
  `src/components/**`. All four `recipe_ratings`-fed surfaces are empty.
- Both card eyebrows render `typeScale.label` (mono 12pt, `letterSpacing: 0.8`,
  uppercased) in `textMuted`.
- Live send cards do not render; the note therefore never appears outside
  `__DEV__`. The closed-loop dress never fires live.
- `KringRow` has no `onPress`; `FriendProofCard`'s `onOpenProof` is
  `() => undefined` while the card still depresses.
- `recipe_shares_select` in 0009 already admits the sender to the whole row
  including `seen_at`. **Overturning read receipts needs no migration and no RLS
  change** — the plan's §1.4 and the handover's §4 both overstate this.
- `shouldAskCookSharing` fires on the first accepted friendship regardless of
  cook history.
- `Profile.avatarUrl` exists and is dropped by every social row model.
- `CookSharingAskSheet` **is** mounted now (`friends/add.tsx:502`) — the
  handover's §7 list is out of date on that item.

**Established from external evidence, cited in §9:** the Instagram
hidden-likes results; the read-receipt obligation findings; the Strava kudos /
self-surveillance tension; Poparazzi's and BeReal's numbers; Letterboxd's growth;
the dark-social share of link sharing.

**Hypothesis — plausible, argued, and not provable from here:**

- That promoting the name from label to voice makes the feed feel warm. This is
  the report's central bet and it needs a device in a hand.
- That the note, rendered properly and at size, carries the *vleugje lol*
  for this third of the app.
- That an outbound invite converts at a rate worth the (small) engineering.
- That asking for a public vote on the second cook produces votes at all.
  Nothing in this codebase or in the comparable products tells you what fraction
  of households will vote; Cookpad's Cooksnap is a human act with far more
  friction and it works, which is weak positive evidence and no more.
- That a household will hold the private/public grade distinction given a
  different control and honest copy. **This is the riskiest hypothesis in the
  report**, because if it is wrong the damage is invisible until Kiezen's
  suggestions quietly get worse.

**Cannot be settled by anyone here:** whether any of it feels warm. Two
households, one week, one pan.

---

## 9. Sources

- [Instagram hidden like counts — reported effects on engagement and posting](https://www.socialmediatoday.com/news/new-report-examines-the-impact-of-instagrams-hidden-likes-experiment-on-in/566887/)
- [Facebook's theory that hiding likes increases post volume (CNBC)](https://www.cnbc.com/2019/12/06/instagram-hiding-likes-could-increase-post-volume.html)
- [Hiding Instagram Likes: Effects on negative affect and loneliness (Personality and Individual Differences)](https://www.sciencedirect.com/science/article/pii/S0191886920307005)
- [Why Did You/I Read but Not Reply? IM Users' Unresponded-to Read-receipt Practices — CHI 2022](https://dl.acm.org/doi/10.1145/3491102.3517496)
- [Direct mobile messaging expectations and response obligation (Journal of Social Media in Society)](https://thejsms.org/index.php/JSMS/article/download/1077/721/6555)
- [Kudos make you run! How runners influence each other on Strava (Social Networks)](https://www.sciencedirect.com/science/article/pii/S0378873322000909)
- [Reflections from the 'Strava-sphere': Kudos, community, and (self)-surveillance](https://www.researchgate.net/publication/346678505_Reflections_from_the_'Strava-sphere'_Kudos_community_and_self-surveillance_on_a_social_network_for_athletes)
- [Ride, record, and share? Elite cyclists' sharing practices on Strava](https://www.tandfonline.com/doi/full/10.1080/16138171.2025.2532278)
- [Once-hot photo-sharing social app Poparazzi is shutting down (TechCrunch)](https://techcrunch.com/2023/05/01/once-hot-photo-sharing-social-app-poparazzi-is-shutting-down/)
- [After a fast start, social app Poparazzi sees slowdown (LA Business Journal)](https://labusinessjournal.com/technology/social-app-poparazzi-slowdown-after-fast-start/)
- [BeReal DAU nearly halved since peak (PetaPixel)](https://petapixel.com/2023/02/22/bereal-may-be-on-the-out-users-have-nearly-halved-since-peak/)
- [BeReal revenue and usage statistics (Business of Apps)](https://www.businessofapps.com/data/bereal-statistics/)
- [BeReal pushes back on decline reporting (TechCrunch)](https://techcrunch.com/2023/09/29/bereal-pushes-back-at-report-that-its-losing-steam-says-it-now-has-25m-daily-users)
- [Letterboxd year-end report and growth (Variety)](https://variety.com/vip/letterboxd-year-end-report-growth-1236277320/)
- [Letterboxd marketing strategy: building community without a feed](https://nogood.io/blog/letterboxd-marketing/)
- [Marco Polo — asynchronous video, no likes or comparisons (founder interview)](https://www.entreprenista.com/articles/vlada-bortnik-of-marco-polo-on-creating-an-asynchronous-video-platform-that-helps-people-stay-connected)
- [Cookpad — The benefit of Cooksnaps: giving recipe authors your feedback](https://blog.cookpad.com/uk/the-benefit-of-cooksnaps/)
- [Cookpad — Share Cooksnaps after cooking](https://cookpad.com/uk/cooksnap_intro)
- [Partiful — how invitations carry personality (Apartment Therapy review)](https://www.apartmenttherapy.com/partiful-review-37193743)
- [Dark social: 77.5% of shares happen on private channels (What's New in Publishing)](https://medium.com/whats-new-in-publishing/77-5-of-shares-are-on-dark-social-only-7-5-98112086f6d4)
- [Dark social — share of untracked private sharing](https://intentamplify.com/blog/dark-social/)
- [Top dark social channels for content and information sharing (Statista)](https://www.statista.com/statistics/1038860/top-dark-social-channels-for-content-and-information-sharing)
- [Social proof: known individuals amplify more than anonymous counts (Cialdini, "similar others")](https://news.wpcarey.asu.edu/20070103-gentle-science-persuasion-part-three-social-proof)
- [Dutch cooking and recipe-inspiration behaviour (Samsung NL research summary)](https://news.samsung.com/nl/nederlander-omarmt-technologie-in-de-keuken-voor-betere-kookprestaties)

**Repo evidence** (all read for this report):
`docs/DESIGN-SOCIAL.md`, `docs/PRODUCT-DECISIONS.md` (PD-004, PD-004a, PD-007,
PD-007a, PD-010, PD-014 – PD-020), `src/lib/repository/social/types.ts`,
`src/app/(tabs)/friends.tsx`, `src/app/friends/_gekooktSource.ts`,
`src/app/(tabs)/ranglijst.tsx`, `src/app/friends/[feedItemId].tsx`,
`src/app/friends/add.tsx`, `src/components/SendRecipeSheet.tsx`,
`src/components/sendRecipeSheetCopy.ts`, `src/components/FriendRecipeCard.tsx`,
`src/components/FriendProofCard.tsx`, `src/components/friendProofPresentation.ts`,
`src/components/KringRow.tsx`, `src/components/CookSharingSection.tsx`,
`src/components/CookSharingAskSheet.tsx`, `src/components/addFriendCopy.ts`,
`src/components/gekooktPresentation.ts`, `src/hooks/useUnseenSendCount.ts`,
`src/theme/tokens.ts`, `supabase/migrations/0009_cook_proof_and_sends.sql`.
