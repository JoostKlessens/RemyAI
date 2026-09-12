# WS-3 — Dutch voice and copy

**Scope.** Every user-facing Dutch string in the product. No other workstream
proposes copy (§3.7). This document does not decide type treatment: whether an
eyebrow is set in uppercase mono is WS-1's call, whether the *word* in that slot
is `REDEN` is mine. Where a string reads badly because the screen is wrong, it
is reported rather than papered over.

**Method.** Read all fourteen copy and presentation modules and all fourteen
screens in the repo, then swept `src/components/**` and `src/app/**` for inline
literals and `tests/**` for every assertion that pins a string. Studied how Dutch
consumer products actually write, first hand, and then went looking specifically
for where trendy Dutch app copy has aged badly, because that failure mode is the
one the brief is exposed to.

**One deliberate discipline in this document.** Its prose contains no em dashes and no
sentence over about twenty words. Item 2 argues that both are the tells; a
report that used them would be arguing against itself.

---

## 0. The recommendation, stated plainly

Remy speaks like a **competent friend in your kitchen**: `je`, short declarative
sentences, verbs rather than nouns, and a dry understatement instead of a joke.

Every conventional source of warmth in this product has been refused somewhere,
and copy is the cheapest place left to buy *een vleugje lol*. The way to spend
it without clutter is **economy, not decoration**. `Waarom niet? Hoeft niet.` is
four words, is funny, is kind, and adds nothing to the screen. That is the whole
technique, and this app already contains two proofs that it works: `Schrijf er
iets bij (mag)` and `wacht`. Nobody has noticed that those are the best strings
in the product. They are the model.

The register has to survive three years, so **the humour is never in the
vocabulary and always in the timing.** Slang dates; sentence rhythm does not.
The evidence for this is in §1.6.

The single largest copy defect is not tone. It is that **six error titles are
missing their subject** (`Kon geen suggestie ophalen`, `Kon recepten niet
laden`, and four more). Adding one word, `Remy`, to each fixes them all and is
the cheapest legible improvement in this report.

---

## 1. The voice specification

### 1.1 Five attributes

Each is a rule that can be checked, with a real *do* and a real *don't* from
this repo.

---

**1. Kort. One idea, one sentence, fifteen words.**

Fifteen is the number the Dutch government's own plain-language toolkit uses
(`Gebruik maximaal 15 woorden per zin. Wissel zinslengte af.`), and it is the
single most effective filter against the machine register.

- **Doe:** `De ingrediënten stonden niet in het bijschrift. Ze staan wel in het
  filmpje.` (two facts, two sentences, twelve words)
- **Niet:** `Sommige makers vertellen het recept alleen hardop in de video en
  typen het niet uit. Remy leest alleen tekst, dus die vindt het recept dan
  niet.` (two twenty-word sentences with a `dus` doing the join)

---

**2. Concreet. Name the thing, never the category.**

Rule two of the three that override everything already says reasons are
concrete and never `Aanbevolen voor jou`. Extend that to all copy: no
`beschikbaar`, no `van toepassing`, no `mogelijkheden`.

- **Doe:** `Je bewaarde dit dinsdag` (names the day, names the act)
- **Niet:** `Geen alternatieven meer voor vanavond` becomes `De wissels zijn op`

---

**3. Kalm. Errors state what happened and what did not change.**

This app already has a family for this and does not know it:
`Er is niets verstuurd.` / `Er is niets veranderd.` / `We korten niets in.`
That family is the product's best writing. Every failure message should join it.

- **Doe:** `Niet gelukt. Er is niets verstuurd. Probeer het nog eens.`
- **Niet:** `Er ging iets onbekends mis bij het ophalen van de video.`

---

**4. Droog. The *lol*, and it costs nothing.**

Understatement, economy, and the occasional beat of self-awareness. Never a
joke that needs a set-up, never an interjection (`Oeps`, `Hoppa`), never an
emoji, never an exclamation mark beyond the one in §1.2.

- **Doe:** `Schrijf er iets bij (mag)`. One parenthesis carries the whole
  permission.
- **Doe:** `Meer manieren zijn er niet.` It closes a door and is charming about
  it.
- **Niet:** anything that reads as a brand being funny at you.

The budget is **five lol lines in the entire app**, on five different screens
(§1.4). More than that and the tone becomes a performance.

---

**5. Eerlijk. Never promise a screen you cannot fill.**

Already a load-bearing product position: `We laten de schakelaar liever weg dan
hem verkeerd te tonen.` is the best sentence in the repo and it is an
explanation of a refusal. Keep every one of these.

- **Doe:** `Nog geen cijfers van je vrienden` / `Geeft een vriend een recept een
  cijfer, dan staat het hier.`
- **Niet:** a hedge standing in for a fact. `Waarschijnlijk geen uitgeschreven
  recept` becomes `Dit las Remy niet als recept`.

### 1.2 The register decisions

| Question | Decision | Why |
| :-- | :-- | :-- |
| `je` or `u` | **`je`, always. `u` is banned.** | Coolblue, Picnic, Tikkie, Swapfiets and NS all use `je`. NS is a state-adjacent institution addressing over a million travellers a day and it writes `Waar gaat je vraag over?`. `u` in an evening cooking app reads as an insurance letter. |
| `je` or `jij` | **`je` by default; `jij` only for contrast.** | `jij` is the stressed form. `Jij kiest` is a claim; `je kiest` is a description. The repo already gets this right in `JOUW NAAM`, which is contrastive: yours, not theirs. |
| Contractions | **None.** No written elision. | Written elision is spoken-register cosplay and it is the first thing that dates. Short standard forms are welcome (`Even kijken`, `Nog niet`, `Hoeft niet`). |
| Exclamation marks | **Exactly one in the product, and it already exists: `Gemaakt!`** | It marks the one genuinely celebratory moment. A second devalues it. Tikkie uses them freely and it works for a payment nudge; it would not work for a product whose posture is calm. |
| Questions as headings | **Yes, where the screen genuinely asks.** | `Hoe was het?`, `Bevat dit gerecht een van deze?`, `Wat voor gerecht was dit?`, `Waarmee?` and `Bewaard. Wanneer?` all pass: something is asked and answered on the same screen. A question nobody answers (`Klaar om te beginnen?`) is banned. |
| Full stops | **Titles and labels take none. Body sentences take one.** | Currently violated by `Nog geen vrienden om naar te sturen.` and `Nog niet genoeg beoordelingen.`, which are titles wearing a full stop. |
| Reason fragments | **No full stop.** | `Je bewaarde dit dinsdag` has none; `Sanne heeft dit ook gemaakt.` has one. Same slot, same screen. Drop the stop from the friend-proof branch (§3.1). |
| Ellipsis | **`…` (U+2026), never three ASCII dots.** | The Taalunie treats it as one character. Three strings currently use ASCII dots and five use the real one. |
| Quotation marks | **One convention app-wide: curly singles for a quoted setting name, straight doubles for a person's own words.** | Three conventions are in use today. The friend note uses straight doubles, `COOK_PROOF_SCOPE_NOTE` uses curly singles, the screen-reader label uses straight doubles again. Pick and enforce. |
| Button verbs | **Imperative (`Stuur door`, `Plak je eerste link`), not infinitive (`Importeren`).** | The infinitive is the form Dutch copywriters name as reading like machine translation. It is exactly the register the owner objected to. Where a button is a nav destination rather than an action (`Instellingen`, `Terug`), a noun is correct. |
| Who is speaking | **`Remy` for what the software does to a recipe. `we` for what the product promises you. Never both on one screen.** | `Remy kon de video niet ophalen` puts the fallibility on the machine. `We laten de schakelaar liever weg` puts the promise on the people. The repo already does both and mixes them by accident. |

### 1.3 Sentence case versus the UPPERCASE MONO EYEBROWS

The words in that slot are mine. The treatment is WS-1's. Here is my ruling on
the words, and the evidence WS-1 needs for the treatment.

**Ruling: the eyebrow slot takes a label, never a sentence.**

A label is a noun or a short question of at most three words, naming what the
block beneath it *is*. These pass and stay:

`KIEZEN` · `REDEN` · `MINUTEN` · `PORTIES` · `VERZOEKEN` · `VRIENDEN` ·
`JOUW NAAM` · `GEBRUIKERSNAAM` · `WEERGAVENAAM` · `E-MAILADRES` · `WAARMEE?` ·
`HOEVEEL TIJD?` · `WISSEN` · `VERSTUURD`

These are **sentences in a label slot** and must move out of it regardless of
what WS-1 decides about case:

| Today | Where | Verdict |
| :-- | :-- | :-- |
| `SANNE MAAKTE DIT` | `FriendProofCard` eyebrow | The words are right; the slot is wrong. A whole sentence in caps is shouting, and it is the sentence a friend's dinner is announced with. Report to WS-1 and WS-2: this belongs in sentence case in a normal line. |
| `GEDEELD DOOR SANNE` | `FriendRecipeCard`, `friends/[feedItemId]` | Same. |
| `WAAR HEB JE ZIN IN?` | `DecisionFilterBar` | Five words beside two two-word siblings. **Change the words: `Zin in?`** It fits the slot, matches its neighbours, and is funnier. |
| `DIT LAS REMY` | `ImportFailureState` | Three words, borderline, and it earns its place: it is the evidence label above a quoted caption. Keep the words. |
| `NOG ÉÉN DING` | `claim-handle` | Three words. Good line. Keep the words. |

**Evidence for WS-1 on the treatment itself.** The Dutch government's plain
language toolkit lists `Gebruik geen woorden helemaal in HOOFDLETTERS` as a
readability rule, alongside its ban on ampersands. That is an accessibility
cost, not a style opinion, and it compounds at 200% Dynamic Type. Separately,
shouted monospace labels are a specific era's idiom, roughly 2018 to 2022 SaaS,
and the owner asked for trendy. **My recommendation to WS-1: keep the mono, drop
the caps, keep the tracking.** A tracked mono label in sentence case reads
current and reads at 200%.

**One mechanical rule that is mine and holds regardless of WS-1's answer: every
eyebrow string is authored in sentence case in the source, and any uppercasing
is done by `textTransform`.** Today this is done seven different ways. Three
constants are literally capitalised inside a tested copy module
(`OWN_HANDLE_EYEBROW`, `REQUESTS_SECTION_LABEL`, `FRIENDS_SECTION_LABEL`), which
means WS-1 cannot undo the caps without editing a test. Two components apply
`textTransform` on top of an already-capitalised literal. Literal caps also
break some screen readers, which spell capitalised strings letter by letter.

### 1.4 Where the *lol* lives, exactly

Five lines. One per screen. Each is marked **[L]** in the string table, and each
has a neutral alternative so the owner can decline any of them individually
without unpicking the rest.

1. Kiezen, declined state: `Remy houdt vanavond verder zijn mond.`
2. Kiezen, decline-reason prompt: `Waarom niet? Hoeft niet.`
3. Mijn recepten, cook-proof re-share: `Dit gerecht doet weer mee.`
4. Import, unknown error: `Remy weet zelf ook niet wat hier misging.`
5. Sturen, note placeholder: `Schrijf er iets bij (mag)`, already shipped. Do
   not touch it.

That is a *vleugje*. Any sixth line is one too many.

### 1.5 What Dutch consumer products actually do

First-hand reading, August 2026.

| Product | What it does | What Remy takes |
| :-- | :-- | :-- |
| **Picnic** | `je` throughout, punchy fragments, self-aware asides (`daar zijn we stiekem best trots op`), the idiom `Zonder gedoe`. Three-pillar repetition (`Altijd lage prijzen / Altijd gratis bezorgd / Altijd supervers`). | The **self-aware aside**. Cheapest warmth in Dutch, and it never dates. |
| **Coolblue** | The national benchmark, `alles voor een glimlach`. Wordplay on every surface, including the boxes. | The **permission to be light in a functional moment**, not the wordplay. Coolblue's rate of jokes is only sustainable with a copy team. A solo product that tries it produces one good joke and forty bad ones. |
| **Tikkie** | `je`, frequent exclamation marks, emoji in headings, `gedoe`, `Wat als alles een Tikkie makkelijker was?` | Nothing directly. Tikkie's register is right for a payment nudge and wrong for a calm evening decision. Useful as the boundary. |
| **Swapfiets** | `je`, restrained exclamation marks, imperative headings (`Begin je rit`), parallel construction (`Jij fietst, wij regelen de rest`). | The **parallel two-clause sentence**. `Jij kookt, Remy kiest` is the same shape and is available if a tagline is ever wanted. |
| **NS** | `je` even as an institution. Short task-oriented headings (`Waar gaat je vraag over?`). Service messages that state fact then consequence (`Het is druk bij Klantenservice. Hou rekening met langere wachttijden dan normaal.`). | The **fact-then-consequence error pattern**, from the most-read Dutch service copy there is. |
| **Albert Heijn** | Tone summarised in three words: *gewoon, eerlijk, Hollands*. | `Gewoon` and `eerlijk` are two thirds of what this app needs. |
| **bunq** | A Dutch bank whose own Dutch landing path serves **English**. | A warning, not a model. English-first is what every competitor in `research/12-prior-art.md` already does. |
| **Gebruiker Centraal / Toolkit Taal** | Max 15 words per sentence. Active voice. No all-caps words. No ampersands. Avoid the *Jip-en-Janneke effect* of over-simplifying. The Drechtsteden triad: *vriendelijk, volwassen en vertrouwenwekkend*. | The **numbers**, and *volwassen*. Remy talks to an adult who is tired, not to a child. |

Sources: [Picnic](https://picnic.app/nl/) ·
[Coolblue klantenservice](https://www.coolblue.nl/klantenservice) ·
[Tikkie](https://www.tikkie.me/) · [Swapfiets](https://www.swapfiets.nl/) ·
[NS klantenservice](https://www.ns.nl/klantenservice) ·
[Toolkit Taal, Gebruiker Centraal](https://toolkittaal.gebruikercentraal.nl/richtlijnen/als-je-gaat-schrijven/) ·
[Gebruiker Centraal on UX writing](https://www.gebruikercentraal.nl/de-kunst-van-ux-writing-en-microcopy/) ·
[Marketingcollega, 20 Dutch tone-of-voice styles with sample sentences](https://www.marketingcollega.nl/branding/tone-of-voice-voorbeelden-20-stijlen-met-voorbeeldteksten/) ·
[Frankwatching on imperative versus infinitive button text](https://www.frankwatching.com/archive/2013/09/23/buttonteksten-gebiedende-wijs-of-hele-werkwoord/) ·
[Onze Taal, kort of lang streepje](https://onzetaal.nl/taalloket/streepje-kort-of-lang)

### 1.6 Where trendy Dutch app copy has aged badly

This is the evidence that decides the register, because the owner asked for
*trendy* and trendy is exactly the thing with a half-life.

**The finding: Dutch trend vocabulary has a shelf life measured in months, and
the failure is not neutral. It is actively embarrassing.**

- Marketingfacts documents the pattern with named casualties: `heerli de peerli`
  (Utrecht student slang), `skitta`, and `no cap`, all already dead in marketing
  use. The cited consumer reaction to a Kruidvat campaign is the whole argument
  in one line: **"This is really cringe. On fleek is so 2014."** The article's
  conclusion is `it is often simply better to stay true to yourself`.
- KNAW-published research (*Slay of cringe filmpjes: Jongerentaal in
  marketingfilmpjes*, September 2024) finds that what goes viral today can be
  outdated next week, and that young audiences read out-of-date slang as
  inauthenticity rather than as a dated joke.
- Youngworks and Coopr report the same failure from the other side: young
  readers mostly want to be addressed as equals, not imitated.

**What this means for Remy, concretely.** *Trendy* in a Dutch cooking app in
2026 does not mean slang. It means:

1. **Short.** Trend-current Dutch copy is shorter than 2018 Dutch copy. That is
   the actual change, and it does not reverse.
2. **`je`, never `u`.** This one has already moved and will not move back.
3. **Naturalised English nouns are fine; English sentences are not.** `Trending`,
   `link`, `app`, `high-protein` read as ordinary Dutch. `Trending recipes` does
   not, and neither would `Let's cook`.
4. **Dry, not enthusiastic.** The enthusiastic register (`Yes! Gelukt! Op naar
   de volgende!`) is the one that reads as 2019.
5. **No emoji in interface copy.** Already banned by `DESIGN.md` as status
   indicators. The trend evidence independently supports it, and this repo has a
   test asserting the tab label contains no exclamation mark or bullet glyph.

The register recommended here fails safely. If it dates, it dates toward *a bit
plain*, which is recoverable in an afternoon. Slang dates toward *cringe*, which
is not.

Sources: [Marketingfacts, *Cringe of cool? Hoe om te gaan met jongerentaal in marketing*](https://www.marketingfacts.nl/berichten/cringe-of-cool-hoe-om-te-gaan-met-jongerentaal-in-marketing/) ·
[KNAW, *Slay of cringe filmpjes*](https://pure.knaw.nl/portal/en/publications/slay-of-cringe-filmpjes-jongerentaal-in-marketingfilmpjes) ·
[Youngworks](https://youngworks.nl/blog/volwassenen-die-jongerentaal-gebruiken/) ·
[Coopr](https://www.coopr.nl/blog/jongerentaal-geschreven-door-een-vijftigjarige-dat-was-zo-cringe)

---

## 2. The machine-written-prose detector, in Dutch

The owner's diagnosis was `em-dashes, stacked subordinate clauses`. It is
accurate and it is only the visible half. Below is the full set, each with a
count from this repo and a mechanical replacement. **This list is runnable as a
review checklist and most of it is runnable as a lint.**

---

### Tell 1. The em-dash aside (8 occurrences)

Two separate faults, and both matter.

**Fault A, the habit.** The material after the dash is almost always a whole
sentence that got glued to the previous one. It is the English essay move.

**Fault B, the glyph.** Dutch does not use the em dash (U+2014). The Dutch
*gedachtestreepje* is the **halflang streepje** (U+2013) with a space on each
side. Every one of these eight uses the em dash. This is precisely the class of
error `src/domain/dutchText.ts` names in its own header: the serial comma as
"the single most common way English-language tooling makes Dutch copy read as
translated". The em dash is the second most common.

**Replacement: a full stop. Almost never a dash of any length.**

| File | Line | String |
| :-- | --: | :-- |
| `src/app/(tabs)/friends.tsx` | 484 | `Stuurt iemand je een recept, dan staat het hier — met het originele filmpje erbij.` |
| `src/app/friends/[feedItemId].tsx` | 245 | `Allergietags komen van wie dit deelde — niet van jullie eigen controle.` |
| `src/app/import/confirm.tsx` | 433 | `Overgenomen uit het bijschrift van de video — mogelijk niet compleet. …` |
| `src/app/import/confirm.tsx` | 435 | `Overgenomen uit het bijschrift — controleer de volgorde.` |
| `src/app/import/confirm.tsx` | 454 | `Vul dit recept zelf aan — Remy kon dit niet automatisch lezen.` |
| `src/app/import/confirm.tsx` | 455 | `Automatisch gelezen uit het bijschrift — controleer of alles klopt voordat je opslaat.` |
| `src/app/settings.tsx` | 440 | `Aantal eters — {members.length}` |
| `src/components/AllergenTaggingSection.tsx` | 70 | `… tag wat van toepassing is. Optioneel — sla over als je het niet zeker weet, …` |

Lint rule: **no U+2014 in any user-facing string, ever.** English code comments
are unaffected.

---

### Tell 2. Stacked subordinate clauses

The Dutch failure is worse than the English one, because the finite verb moves
to the end of a subordinate clause. A reader holds the whole clause in memory
before learning what happened.

- **Now:** `Je hebt een account nodig, zodat je bibliotheek blijft bestaan als
  je telefoon dat niet doet.` (`zodat` plus `als`, verb at the end, 15 words)
- **Fix:** `Met een account blijven je recepten bestaan, ook als je telefoon dat
  niet doet.`

Rule: **one finite verb cluster per sentence.** Count the words; over fifteen,
split. Then reread: if the split produced two sentences saying the same thing,
delete one.

---

### Tell 3. The tricolon

Three parallel items where the third carries the rhetoric. The single most
recognisable signature of generated prose.

- `Sluit uit wat je hebt getagd.` is fine.
- `Ze zien ook niet wie hier mee-eet, welke recepten je bewaard hebt, wat je
  planning is, of wat je niet hebt gekookt.` is **not** a tricolon and must stay.
  It is a consent disclosure, and enumeration is the honest form there.

Rule: **a list of three or more is allowed when it is an inventory and banned
when it is a rhythm.** Test: can you remove the third item without losing a
fact? If yes, it was rhythm.

---

### Tell 4. The construction `niet X, maar Y`

The antithesis. Occurrence in live copy: `Dat is een afspraak, geen storing.`
on the display-only import.

That one **earns it**, and it shows the rule. The negated half names the thing
the reader actually believed, and the sentence is six words. Keep it.

Rule: **allowed once per screen, never twice, and only when the negated half is
a real misconception the reader has right now.** Otherwise it is a writer
enjoying a shape.

---

### Tell 5. The hedge

`mogelijk`, `meestal`, `waarschijnlijk`, `wellicht`, `in principe`, `op dit
moment nog`, `kan`, `probeert`.

A hedge is honest when Remy genuinely does not know. It is machine politeness
when the fact is available.

| Now | Verdict |
| :-- | :-- |
| `De video is mogelijk verwijderd of op privé gezet.` | The `of` already carries the uncertainty. Drop `mogelijk`. |
| `Instagram-links kan Remy op dit moment nog niet ophalen.` | Double hedge. Drop `op dit moment nog`. |
| `Waarschijnlijk geen uitgeschreven recept` | A hedge used **as a title**, doing a fact's job. Replace with the fact. |
| `mogelijk niet compleet` | Honest. Keep. |
| `Remy probeert er een recept van te maken.` | Honest and warm. Keep. |

---

### Tell 6. Nominalisation

Turning a verb into a noun and then needing a colourless verb to carry it.
Dutch degrades faster under this than English.

- `Het verwerken van deze video lukte nu niet.` becomes `Dit lukte nu niet.`
- `Delen aanzetten lukte niet.` becomes `Aanzetten lukte niet.`
- `Delen wordt opgehaald…` becomes `Even kijken…`
- `De vriendenlijst kon niet geladen worden.` becomes `Remy kon je vrienden niet
  ophalen.`

Rule: **if a sentence's main verb is `zijn`, `worden`, `hebben`,
`plaatsvinden` or `lukken` and the real action sits in a noun beside it, rewrite
around the real verb.**

---

### Tell 7. The subjectless failure title

Six occurrences, and the largest single legibility defect in the copy layer.

`Kon geen suggestie ophalen` · `Kon recepten niet laden` · `Kon instellingen
niet laden` · `Kon dit recept niet laden` · `Kon het originele filmpje niet
openen` · `Kon het profiel van X niet openen`

This is compiler-log grammar. Dutch tolerates a dropped subject far less than
English does, and a screen that says `Kon … niet …` sounds like it is talking to
a developer.

**Fix: add the subject. One word, six places.** `Remy kon geen voorstel ophalen`.

---

### Tell 8. The serial comma

Already solved for generated lists by `joinDutchList` in
`src/domain/dutchText.ts`, whose header is correct and is this project's
standard. Extend the rule to hand-written lists in JSX: **no comma before `en`.**
Currently clean; keep it that way.

---

### Tell 9. Mixed ellipsis characters

`Even kijken` with three ASCII dots appears three times:
`src/app/(tabs)/friends.tsx:130`, `src/app/(tabs)/ranglijst.tsx:134`,
`src/components/addFriendCopy.ts:200`. Five other strings use the real
character.

**Fix: U+2026 everywhere.**

---

### Tell 10. Mixed quotation conventions

Three in one app. The friend note renders with straight ASCII doubles;
`COOK_PROOF_SCOPE_NOTE` uses curly singles; the screen-reader label uses
straight doubles again.

**Fix:** straight doubles for a person's own words (the friend's note, the
quoted caption), curly singles for the name of a setting being referred to.
Nothing else gets quoted.

---

### Tell 11. Politeness padding

`alsnog`, `verder`, `gewoon`, `simpelweg`, `natuurlijk`, `uiteraard`, and `even`
when it is not doing temporal work. Also `Probeer het opnieuw` appended to a
message where no retry control exists.

Rule: **delete the word and reread. If nothing was lost, it was padding.**

---

### Tell 12. The bare `Er ging iets mis`

Named in this repo's own comments as the thing to avoid, and mostly avoided.
One survivor: `Er ging iets onbekends mis bij het ophalen van de video.`

Rule: **an error names either what failed or what did not change. Preferably
both.**

---

### The detector as a checklist

Run over any proposed string:

1. Does it contain an em dash? Reject.
2. Over fifteen words? Split.
3. Two subordinate clauses? Split.
4. A list of three where the third adds no fact? Cut to two.
5. `niet X, maar Y` already used on this screen? Rewrite.
6. A hedge over a fact Remy has? Delete the hedge.
7. Main verb `zijn` / `worden` / `lukken` with the action in a noun? Rewrite.
8. A failure sentence with no subject? Add `Remy` or `we`.
9. Three ASCII dots instead of the ellipsis character? Fix.
10. Any word from the banned list in §4? Reject.
11. Read it aloud in a kitchen at 16:00 to a tired person. Friend, or form?

---

## 3. The rewritten string table

Old to new, one line of reasoning each. Test column:

- **pinned** means a test asserts the exact string. **The test must be updated.**
- **guarded** means a test asserts a substring or a negative constraint. The new
  string has been checked against it and passes. No test change needed.
- Blank means no test touches it.

Strings not listed are **deliberately unchanged**. The most important of those
are listed in §3.10, and §3.11 is the complete list of test edits.

### 3.1 Kiezen and the decision

| Where | Old | New | Reason | Test |
| :-- | :-- | :-- | :-- | :-- |
| `(tabs)/index.tsx` | `Onbekend gerecht` | `Naamloos gerecht` | `Onbekend` is a database word. A dish without a title is nameless, not unknown. | |
| `(tabs)/index.tsx` | `Kon geen suggestie ophalen` | `Remy kon geen voorstel ophalen` | Tell 7. `voorstel` is also the app's own word for the thing. | |
| `(tabs)/index.tsx` | `Controleer je verbinding en probeer het opnieuw.` | `Kijk je verbinding na en probeer het nog eens.` | `Controleer` is officialese; `nog eens` is what a person says. | |
| `(tabs)/index.tsx` | `Er komt vanavond geen nieuwe suggestie meer.` | **[L]** `Remy houdt vanavond verder zijn mond.` <br>*(neutral: `Vanavond geen voorstel meer.`)* | A seven-word wind-up becomes the one warm line on the screen a person reaches after saying no. An app that shuts up when told is the joke, and it costs no pixels. | |
| `DeclineReasonRow` | `Wil je delen waarom? Helemaal niet verplicht.` | **[L]** `Waarom niet? Hoeft niet.` <br>*(neutral: `Waarom niet? Alleen als je zin hebt.`)* | Four words do both jobs: it asks, and it releases you. PD-002 says the reason is optional and ignorable; this is that decision said out loud. | |
| `VanavondActionRow` | `Nog {n} keer beschikbaar vandaag` | `Nog {n} keer vandaag` | `beschikbaar` is a systems word. Accessibility hint only. | |
| `VanavondActionRow` | `Geen wissels meer beschikbaar vandaag` | `De wissels zijn op voor vandaag` | Same. | |
| `NoCandidateState` | `Niks voor de hand liggends vanavond` | `Vanavond valt alles af` | `voor de hand liggends` is a strained partitive no Dutch speaker produces. | |
| `NoCandidateState` | `Je instellingen sluiten alle gerechten in je recepten uit voor vanavond.` | `Je instellingen sluiten elk gerecht in je recepten uit.` | `voor vanavond` is already established by the title. | |
| `NoCandidateState` | `Niets binnen deze filters` | `Niets binnen je filters` | `je`, not `deze`. They are the reader's filters. | |
| `NoCandidateState` | `Je filters voor vanavond zijn te streng. Wis ze en Remy kijkt weer in al je recepten.` | `Wis ze, dan kijkt Remy weer in al je recepten.` | `te streng` judges the reader, and sentence one only restated the title. | |
| `NoCandidateState` | `Geen alternatieven meer voor vanavond` | `De wissels zijn op` | `alternatieven` is the engine's word; `wissel` is the app's own and already appears in its accessibility copy. | |
| `NoCandidateState` | `Je hebt de wissels voor vandaag gebruikt.` | `Morgen mag je weer wisselen.` | Says what happens next instead of what you spent. Verified against `computeAlternativesRemaining`: no count is named, because the count is two and hardcoding it in copy is fragile. | |
| `reason.ts` | `Sanne heeft dit ook gemaakt.` | `Sanne heeft dit ook gemaakt` | Every other reason is a fragment with no full stop. Same slot, same screen, one punctuation rule. | **pinned** |
| `reason.ts` | `Sanne heeft dit ook gemaakt en gaf het een 10,0.` | same without the full stop | Same. Grade format untouched: comma, trailing zero (PD-008a). | **pinned** |
| `reason.ts` | `Iemand die je kent heeft dit ook gemaakt.` | same without the full stop | Same. | **pinned** |
| `DecisionFilterBar` | `WAAR HEB JE ZIN IN?` | `Zin in?` | Five words beside two two-word siblings. Shorter, matches the row, funnier. §1.3. | |
| `DecisionFilterBar` | `HOEVEEL TIJD?` / `WAARMEE?` / `WISSEN` | `Hoeveel tijd?` / `Waarmee?` / `Wissen` | Source in sentence case; `textTransform` decides the shouting. §1.3. | |

### 3.2 Cook mode and the outcome

| Where | Old | New | Reason | Test |
| :-- | :-- | :-- | :-- | :-- |
| `cook/[mealId].tsx` | `Laden…` | `Even kijken…` | One loading word app-wide. §3.8. | |
| `cook/[mealId].tsx` | `Kon dit recept niet laden` | `Remy kon dit recept niet ophalen` | Tell 7. | |
| `cook/[mealId].tsx` | `Geen bereidingsstappen beschikbaar` | `Geen stappen bij dit recept` | `beschikbaar` is a systems word; `bereidingsstappen` is a compound nobody says aloud. | |
| `cook/[mealId].tsx` | `Voor dit gerecht zijn nog geen bereidingsstappen genoteerd.` | `Er staan nog geen stappen bij dit gerecht.` | Active, shorter, same fact. | |
| `cook/[mealId].tsx` | `Geen stap gevonden` | `Deze stap is er niet` | Unreachable branch; keep it short and human anyway. | |
| `TimerDisplay` | `Timer, {x} resterend` | `Timer, nog {x}` | `resterend` is a form word. | |
| `RecipeTile` | `Open kookmodus voor dit gerecht` | `Begin met koken` | `kookmodus` is an internal name that reaches real users through the screen-reader label, which makes it user-facing copy. | |
| `libraryTileActionCopy` | `Open kookmodus voor dit gerecht. Houd ingedrukt voor meer opties.` | `Begin met koken. Houd ingedrukt voor meer opties.` | Same. | **pinned** |

### 3.3 Mijn recepten

| Where | Old | New | Reason | Test |
| :-- | :-- | :-- | :-- | :-- |
| `(tabs)/recipes.tsx` | `Kon recepten niet laden` | `Remy kon je recepten niet ophalen` | Tell 7. `je` makes them yours. | |
| `(tabs)/recipes.tsx` | `Opnieuw proberen` | `Opnieuw` | One retry label app-wide. The accessibility label carries the detail. | |
| `(tabs)/recipes.tsx` | `Recepten laden` (a11y) | `Even kijken…` | §3.8. | |
| `(tabs)/recipes.tsx` | empty state | see §6.1 | | |
| `recipeScheduling.ts` | `Nog geen planning` | `Nog niet ingepland` | `planning` is a project-management noun; the verb is what the reader thinks in. | |
| `recipeScheduling.ts` | `Al gekookt` | **unchanged** | This is the participle used as a fact about a dish, which is correct Dutch. The banned use is `Gekookt` as the *name of a place*. §4.1 explains the difference. | |

### 3.4 Vrienden

| Where | Old | New | Reason | Test |
| :-- | :-- | :-- | :-- | :-- |
| `(tabs)/friends.tsx` | `Wat vrienden echt gekookt hebben.` | `Wat vrienden maakten, en wat ze je stuurden.` | **This subtitle is now factually wrong.** The list mixes proof cards and send cards; `echt gekookt` describes only half of it. The new line names both tiers without letting a send borrow proof's language (§8). | |
| `(tabs)/friends.tsx` | `Even kijken` with ASCII dots | `Even kijken…` | Tell 9. | |
| `(tabs)/friends.tsx` | `De vriendenlijst kon niet geladen worden.` | `Remy kon je vrienden niet ophalen.` | Tells 6 and 7. | |
| `(tabs)/friends.tsx` | `Dat is alles wat er gedeeld is.` | `Dat is alles.` | `gedeeld` is false of a list that also contains proof. Three words, and it joins the family with `Dat is de hele lijst.` and `Dat is alles van je vrienden.` See §7. | |
| `(tabs)/friends.tsx` | empty state | see §6.6 | | |
| `friends/[feedItemId].tsx` | `Allergietags komen van wie dit deelde — niet van jullie eigen controle.` | `Allergietags komen van wie dit deelde, niet van jullie eigen controle.` | Tell 1. A comma is the correct Dutch join here. | |
| `friends/[feedItemId].tsx` | `Kon het originele filmpje niet openen` | `Remy kon het filmpje niet openen` | Tell 7. `originele` is carried by the link label directly above. | |
| `CreatorAttribution` | `Kon het profiel van {handle} niet openen` | `Remy kon het profiel van {handle} niet openen` | Tell 7. | |

### 3.5 Trending

| Where | Old | New | Reason | Test |
| :-- | :-- | :-- | :-- | :-- |
| `(tabs)/ranglijst.tsx` | `Trending recipes` (screen header) | `Trending` | The only two-word English phrase in the product. The tab word is the owner's and stays; the second English noun is doing work the reader does not need. Argued, not quietly changed: §5. | |
| `(tabs)/ranglijst.tsx` | `Wat de mensen die je kent het hoogst beoordelen.` | `Wat je vrienden het hoogst beoordelen.` | A four-word relative clause replaced by the word the app already uses for those people. | |
| `(tabs)/ranglijst.tsx` | `Wat over alle keukens heen het hoogst scoort.` | **unchanged** | The most ownable phrase in the app. | |
| `(tabs)/ranglijst.tsx` | `De lijst kon niet geladen worden.` | `Remy kon de lijst niet ophalen.` | Tells 6 and 7. | |
| `(tabs)/ranglijst.tsx` | `De lijst van je vrienden kon niet geladen worden.` | `Remy kon de lijst van je vrienden niet ophalen.` | Same. | |
| `(tabs)/ranglijst.tsx` | `Even kijken` with ASCII dots | `Even kijken…` | Tell 9. | |
| `(tabs)/ranglijst.tsx` | empty state | see §6.8 | | |

### 3.6 Import

| Where | Old | New | Reason | Test |
| :-- | :-- | :-- | :-- | :-- |
| `import/paste.tsx` | `Recept importeren` (title) | `Link plakken` | `importeren` is a systems verb. Four entry points lead to this screen and every one of them says *plakken* (`+ Link plakken`, `Plak je eerste link`, `Recept plakken`). | |
| `import/paste.tsx` | `Importeren` (primary button) | `Recept ophalen` | Names the outcome, and removes the last infinitive-as-button in the flow. | |
| `import/paste.tsx` | `Recept importeren` (a11y) | `Recept ophalen` | Match. | |
| `import/paste.tsx` | `Ik heb geen link, recept zelf invoeren` | `Ik typ het zelf` | Nine words to four; the comma splice goes. The accessibility label keeps the long form. | |
| `import/paste.tsx` | the three checkpoints | **unchanged** | `Video gevonden`, `Bijschrift gelezen`, `Recept samengesteld…`, and `Post gevonden`, `Maker erbij gezocht…`. Best loading copy in the app. | |
| `import/confirm.tsx` | `Vul dit recept zelf aan — Remy kon dit niet automatisch lezen.` | `Remy kon dit niet lezen. Vul het zelf aan.` | Tell 1. Cause first, then the ask. `automatisch` is redundant next to `Remy kon`. | |
| `import/confirm.tsx` | `Automatisch gelezen uit het bijschrift — controleer of alles klopt voordat je opslaat.` | `Dit komt uit het bijschrift. Kijk het even na.` | Tells 1 and 2. Fifteen words to nine. | |
| `import/confirm.tsx` | `Overgenomen uit het bijschrift van de video — mogelijk niet compleet. Controleer en vul aan waar nodig.` | `Dit komt uit het bijschrift en is misschien niet compleet. Vul aan wat mist.` | Tell 1. The hedge stays because it is honest. | |
| `import/confirm.tsx` | `Overgenomen uit het bijschrift — controleer de volgorde.` | `Dit komt uit het bijschrift. Klopt de volgorde?` | Tell 1. A question makes the check an action. | |
| `import/confirm.tsx` | `Volgende stap` (step placeholder) | `Wat doe je hierna?` | The old placeholder collides word for word with cook mode's `Volgende stap` accessibility label, which is a different thing entirely. | |
| `import/confirm.tsx` | `Vul een titel, minstens één ingrediënt en één stap in` | `Een titel, één ingrediënt en één stap: dat is het minimum.` | The old one splits `Vul … in` across eleven words, the Dutch reader's worst case. | |
| `import/confirm.tsx` | `Opslaan is mislukt. Probeer het opnieuw.` | `Opslaan lukte niet. Er is niets bewaard. Probeer het nog eens.` | Joins the `er is niets …` family, which is why this app's failures feel safe. | |
| `import/confirm.tsx` | `Opslaan is mislukt: {error.message}` | `Opslaan lukte niet. Er is niets bewaard.` | A raw error string in the UI is a machine talking. Log the detail, do not print it. **Reported to WS-2** as a screen decision as much as a copy one. | |
| `importFailureCopy` | `Kon de video niet ophalen` | `Remy kon de video niet ophalen` | Tell 7. | guarded |
| `importFailureCopy` | `Remy herkent alleen TikTok- en Instagram-links. Controleer de link hierboven, of voer het recept zelf in.` | `Remy kent alleen TikTok en Instagram. Kijk de link na, of typ het recept zelf.` | `herkent` and `voer … in` are both form words. Nineteen words to thirteen. | guarded |
| `importFailureCopy` | `Sommige makers vertellen het recept alleen hardop in de video en typen het niet uit. Remy leest alleen tekst, dus die vindt het recept dan niet. Typ het recept zelf over. Dan staat het net zo goed in je lijst.` | `Sommige makers vertellen het recept alleen hardop. Remy leest alleen tekst. Typ het zelf over, dan staat het net zo goed in je lijst.` | Tell 2. Forty-two words to twenty-four, no fact lost. | guarded |
| `importFailureCopy` | `{platform}-post gevonden, recept typ je zelf` | `Bij {platform} typ je het recept zelf` | A comma splice as a title. The new one names the platform (test requires it) and carries no failure word (test forbids `mislukt`, `fout`, `ging mis`, `niet gelukt`, `probeer het opnieuw`). | **guarded** |
| `importFailureCopy` | `Van {platform} mag Remy de post en de maker laten zien. Het bijschrift mag Remy niet overnemen. Dat is een afspraak, geen storing. Bij een tweede poging gebeurt hetzelfde. De maker en het beeld blijven bewaard. Typ het recept er zelf bij, dan staat het compleet in je lijst.` | `Van {platform} mag Remy de post en de maker laten zien, het bijschrift niet. Dat is een afspraak, geen storing. De maker en het beeld blijven bewaard. Typ het recept erbij, dan staat het compleet in je lijst.` | Six sentences to four. `Bij een tweede poging gebeurt hetzelfde` is implied by `afspraak, geen storing`. Keeps the one earned `niet X, maar Y` (Tell 4). | **guarded** |
| `importFailureCopy` | `Het verwerken van deze video lukte nu niet. Dit is meestal tijdelijk. Probeer het opnieuw.` | `Meestal is dit tijdelijk. Probeer het zo nog eens.` | Tell 6. The title already says `Even niet gelukt`, so sentence one restated it. | guarded |
| `importFailureCopy` | `Waarschijnlijk geen uitgeschreven recept` | `Dit las Remy niet als recept` | Tell 5: a hedge doing a fact's job. The new title also rhymes with the evidence block below it, labelled `DIT LAS REMY`. | guarded |
| `importFailureCopy` | `Remy kreeg een antwoord terug dat niet als recept te lezen was. Dat gebeurt meestal als de tekst geen volledig recept bevat. Typ het recept zelf over als je het weet.` | `Meestal staat het recept niet volledig in de tekst. Typ het zelf over als je het weet.` | Sentence one restated the new title. | guarded |
| `importFailureCopy` | `De video is mogelijk verwijderd of op privé gezet.` | `De video is verwijderd of op privé gezet.` | Tell 5. `of` already carries the doubt. | guarded |
| `importFailureCopy` | `Even te veel verzoeken bij het platform. Probeer het over een minuutje opnieuw.` | `Het platform krijgt even te veel vragen. Probeer het over een minuutje.` | `verzoeken` is a systems noun and collides with the friend-request meaning elsewhere. `een minuutje` stays: warm, and the right register. | guarded |
| `importFailureCopy` | `Instagram-links kan Remy op dit moment nog niet ophalen.` | `Instagram-links kan Remy nog niet ophalen.` | Tell 5, double hedge. | guarded |
| `importFailureCopy` | `De verbinding met het platform lukte niet.` | `Er was geen verbinding met het platform.` | *Een verbinding lukt niet* is not Dutch; a connection comes about or is absent. | guarded |
| `importFailureCopy` | `Er ging iets onbekends mis bij het ophalen van de video.` | **[L]** `Remy weet zelf ook niet wat hier misging.` <br>*(neutral: `Er ging iets mis bij het ophalen van de video.`)* | Tell 12. The one error with genuinely no explanation, so admitting it is both the most honest and the funniest option available. | guarded |

### 3.7 Social, sharing and consent

| Where | Old | New | Reason | Test |
| :-- | :-- | :-- | :-- | :-- |
| `addFriendCopy` | `ADD_FRIEND_TITLE = 'Vrienden'` | `Vriend toevoegen` | The screen is titled identically to the tab it is not. | |
| `addFriendCopy` | `OWN_HANDLE_EYEBROW = 'JOUW NAAM'` | `Jouw naam` | Literal caps inside a tested module make the case decision un-undoable by WS-1. §1.3. | guarded |
| `addFriendCopy` | `REQUESTS_SECTION_LABEL = 'VERZOEKEN'` | `Verzoeken` | Same. | guarded |
| `addFriendCopy` | `FRIENDS_SECTION_LABEL = 'VRIENDEN'` | `Vrienden` | Same. | guarded |
| `addFriendCopy` | `Je eigen gebruikersnaam is nog niet opgehaald.` | `Remy heeft je eigen gebruikersnaam nog niet.` | Tells 6 and 7. | guarded |
| `addFriendCopy` | `Even kijken` with ASCII dots | `Even kijken…` | Tell 9. | guarded |
| `addFriendCopy` | `Je vrienden en verzoeken konden niet geladen worden.` | `Remy kon je vrienden en verzoeken niet ophalen.` | Tells 6 and 7. | guarded |
| `addFriendCopy` | `Delen aanzetten lukte niet. Je kunt het in Instellingen alsnog doen.` | `Aanzetten lukte niet. In Instellingen kan het alsnog.` | Tell 6. Keeps `lukte niet`, which `addFriendCopy.test.ts:451` asserts. | **guarded** |
| `addFriendCopy` | `Je hebt nog geen vrienden toegevoegd.` | `Nog geen vrienden.` | The section label directly above already says `Vrienden`. | guarded |
| `addFriendCopy` | `Gebruik {min} tot {max} tekens: kleine letters, cijfers en _.` | `Gebruik {min} tot {max} tekens. Kleine letters, cijfers en een liggend streepje.` | A bare underscore glyph in prose is unreadable aloud and at 200%. The accessibility hint on the same field already says `liggend streepje`; now they match. The test asserts the message contains `3` and `30`, which it still does. | **guarded** |
| `addFriendCopy` | `{handle} heeft jou al een verzoek gestuurd. Je kunt het hieronder accepteren.` | `{handle} stuurde jou al een verzoek. Accepteer het hieronder.` | Perfect tense to simple past, modal removed. Sixteen words to ten. | guarded |
| `sendRecipeSheetCopy` | `Vrienden worden opgehaald…` | `Even kijken…` | §3.8. | |
| `sendRecipeSheetCopy` | `De vriendenlijst kon niet geladen worden.` | `Remy kon je vrienden niet ophalen.` | Tells 6 and 7. | |
| `sendRecipeSheetCopy` | `SEND_NO_FRIENDS_TITLE = 'Nog geen vrienden om naar te sturen.'` | `Nog niemand om naar te sturen` | A title with a full stop and a trailing purpose clause. §1.2. | **pinned** |
| `sendRecipeSheetCopy` | `Voeg eerst iemand toe met de gebruikersnaam die je van elkaar kent. Daarna staat diegene hier. Dan kun je dit gerecht sturen.` | `Voeg eerst iemand toe met de gebruikersnaam die je van elkaar kent. Daarna staat diegene hier.` | Sentence three restates the sheet the reader is already in. Still contains `gebruikersnaam` (asserted) and still avoids `kan nog niet` and `zodra dat kan`. | **guarded** |
| `sendRecipeSheetCopy` | `Opnieuw proberen` | `Opnieuw` | One retry label. | |
| `libraryTileActionCopy` | `COOK_PROOF_EXCLUDED_LABEL = 'Uitgezonderd van delen · Weer delen'` | `Niet gedeeld · Weer delen` | `uitgezonderd van delen` is the most bureaucratic phrase in the product: a passive participle of a legal verb, in a sheet somebody opened to make one thing private. | **pinned** |
| `libraryTileActionCopy` | `Dit gerecht is uitgezonderd van delen.` | `Dit gerecht wordt niet gedeeld.` | Same reason. Checked against the `not.toContain('wordt gedeeld')` constraint, which applies only to the *shared* announcement. | **pinned** (by reference at `:286`) |
| `libraryTileActionCopy` | `De uitzondering is opgeheven.` | **[L]** `Dit gerecht doet weer mee.` <br>*(neutral: `Dit gerecht wordt weer gedeeld.`, which would **fail** the existing `not.toContain('wordt gedeeld')` test. That is itself an argument for the warm one.)* | Six words of pure officialese, spoken aloud to a screen-reader user, about a lasagne. | **pinned** (by reference at `:287`) |
| `libraryTileActionCopy` | `Delen wordt opgehaald…` | `Even kijken…` | Tell 6 and §3.8. | |
| `libraryTileActionCopy` | `Delen kan nu niet · Opnieuw proberen` | `Delen kan nu niet · Opnieuw` | One retry label. | |
| `libraryTileActionCopy` | `We konden niet ophalen of dit gerecht is uitgezonderd. Er is niets veranderd.` | `Remy kon niet ophalen of dit gerecht gedeeld wordt. Er is niets veranderd.` | Removes `uitgezonderd`; keeps the `er is niets veranderd` family. | |
| `libraryTileActionCopy` | `COOK_PROOF_SCOPE_NOTE` and both explainers | **unchanged** | Curly quotes are correct here under §1.2. Tests assert `Vrienden`, `al geweest zijn`, `Deel wat ik kook met vrienden`, `verandert dit niet` and `nog steeds`; all survive. | guarded |
| `cookSharingCopy` | `Zet je dit aan, dan zien vrienden bij een recept staan dat iemand uit dit huishouden het heeft gemaakt.` | `Zet je dit aan, dan zien vrienden bij een recept dat iemand hier het gemaakt heeft.` | `zien … staan dat` is a triple verb cluster. Nineteen words to fifteen. | guarded |
| `cookSharingCopy` | `Vrienden zien je allergenen en dislikes niet.` | `Vrienden zien je allergenen niet, en ook niet wat je niet lust.` | `dislikes` is an English noun sitting in a Dutch consent disclosure. §4. | **guarded** (the paragraph's `openbare stem` assertion is untouched) |
| `cookSharingCopy` | everything else in the four consent paragraphs | **unchanged** | This is a consent screen. Brevity is not the goal there, completeness is, and the sentence-length rule yields to the disclosure. `Één keer koken ziet er hetzelfde uit als tien keer.` is the best sentence in the module. | guarded |
| `AllergenTaggingSection` | `Bekijk de ingrediënten hierboven en tag wat van toepassing is. Optioneel — sla over als je het niet zeker weet, dan blijft dit gerecht als niet-gecontroleerd gemarkeerd.` | `Kijk de ingrediënten hierboven na en tik aan wat erin zit. Weet je het niet zeker? Sla over. Dit gerecht blijft dan ongecontroleerd.` | Four tells in one string: an em dash, `van toepassing`, `tag`, `gemarkeerd`. A question replaces the bare word `Optioneel`. | |
| `allergenTaggingCopy` | `Gecontroleerd. Geen van de 14 allergenen getagd.` | `Gecontroleerd. Geen van de 14 allergenen aangetikt.` | `getagd` is an English verb with a Dutch ending. §4. | **pinned** |
| `allergenTaggingCopy` | `Bevat dit gerecht een van deze?` and `Gecontroleerd. Sluit uit: …` | **unchanged** | PD-006 is a liability boundary, not a taste. Exclusion framing, never `veilig voor`. Do not touch these two under any circumstances. | guarded |
| `MemberPreferencesSection` | `Dislikes` (section heading) | `Niet lekker` | §4. Plain, Dutch, unambiguous, and warmer than the English noun. | |
| `MemberPreferencesSection` | `Sluit uit wat je hebt getagd.` | `Wat je hier zet, laat Remy weg.` | `getagd` again, plus a passive. | |
| `MemberPreferencesSection` | `Voeg hierboven iemand toe om dislikes en allergenen in te stellen.` | `Voeg hierboven iemand toe. Dan kun je per persoon instellen wat eruit moet.` | `dislikes`, plus a split `om … in te stellen` across nine words. | |

### 3.8 One loading word

Seven different loading strings today: `Even kijken` with ASCII dots in three
files, `Laden…`, `Recepten laden`, `Vrienden worden opgehaald…`, and
`Delen wordt opgehaald…`.

**Standardise on `Even kijken…`.** Short, Dutch, warm, implies a person rather
than a process, and three of the seven already use it. The import checkpoints
are exempt: they narrate rather than wait, and they are the best loading copy in
the app.

### 3.9 Sign-in, account and settings

| Where | Old | New | Reason | Test |
| :-- | :-- | :-- | :-- | :-- |
| `sign-in.tsx` | `Je hebt een account nodig, zodat je bibliotheek blijft bestaan als je telefoon dat niet doet.` | `Met een account blijven je recepten bestaan, ook als je telefoon dat niet doet.` | **This string still contains `bibliotheek`, a word the owner removed by instruction** (`src/app/sign-in.tsx:69`). It survived the rename because it is prose rather than a label. Tell 2 also applies. The joke about the telephone is good and is kept intact. | |
| `sign-in.tsx` | `Versturen lukte niet. Controleer je verbinding en probeer het opnieuw.` | `Versturen lukte niet. Kijk je verbinding na en probeer het nog eens.` | `Controleer` is officialese. | |
| `sign-in.tsx` | `VERSTUURD` eyebrow | `Verstuurd` in source | §1.3. | |
| `sign-in.tsx` | `Eén gerecht, elke avond` · `Kijk in je mail` · `Geen wachtwoord. Je krijgt een link die je één keer gebruikt.` · `Niets gekregen? Kijk in je spam, of gebruik een ander adres.` | **unchanged** | The best-written screen in the product. Leave it alone. | |
| `claim-handle.tsx` | `NOG ÉÉN DING` | `Nog één ding` in source | §1.3. Words unchanged; the line is good. | |
| `claim-handle.tsx` | `Opslaan lukte niet. Controleer je verbinding en probeer het opnieuw.` | `Opslaan lukte niet. Kijk je verbinding na en probeer het nog eens.` | Match sign-in. | |
| `claim-handle.tsx` | `Account compleet.` (announcement) | `Klaar. Je bent binnen.` | `compleet` is a form word. `Je bent binnen` calls back to sign-in's own `Tik erop en je bent binnen.`, which makes the two screens sound like one product. | |
| `settings.tsx` | `Aantal eters — {n}` | `Wie eet er mee?` | Tell 1, plus `Aantal` is a spreadsheet noun in a screen about people. The rows below are the count. **If the numeral must stay** (it drives portions), use `Wie eet er mee? ({n})`. My recommendation is to drop it, because the list is short and visible. | |
| `settings.tsx` | `Kon instellingen niet laden` | `Remy kon je instellingen niet ophalen` | Tell 7. | |
| `settings.tsx` | `Opnieuw proberen` | `Opnieuw` | One retry label. | |
| `settings.tsx` | `Tijd op een doordeweekse avond` | **unchanged** | Concrete, Dutch, no jargon. | |

### 3.10 Deliberately unchanged, and why

These are the strings a copy pass will be tempted to touch. Do not.

| String | Why it stays |
| :-- | :-- |
| `Ja` · `Iets anders` · `Ik kies zelf` · `Niet koken` | The four best labels in the product. `Ja` is the whole thesis in two letters. **Report to WS-1:** `Ja` renders in monospace via `typeScale.button`, so it reads as a terminal command. That is a type defect, not a copy one. |
| `Niet koken` and `Niet gekookt vanavond. Genoteerd.` | PD-002. First-class answer, never a cancel. `Genoteerd.` acknowledges without praising. **Never** replace with `Overgeslagen` (the DB status is `skipped`, and that word must not leak) or `Geannuleerd`. |
| `Bevat dit gerecht een van deze?` · `Gecontroleerd. Sluit uit: noten.` | PD-006, a liability boundary. Exclusion framing only. |
| `8,70`, `7,5`, `1 stem`, `2 stemmen` | PD-008a. Comma, trailing zero kept. Never a point. |
| `Hoe was het?` · `Nooit meer` · `Graag weer` · `Klaar` | The rating scale. `Nooit meer` and `Graag weer` are perfect: two words each, no numbers, no legend. |
| `Gemaakt!` | The one exclamation mark. |
| `Wat voor gerecht was dit?` | Concrete question, answered on the same card. |
| `Schrijf er iets bij (mag)` | Do not touch this string. |
| `wacht` | The outgoing-request status. One lowercase word standing for a whole state. §7. |
| `Stuur door` · `Sturen` · `Verstuurd` · `Versturen…` | Imperative, consistent, short. |
| `Meer manieren zijn er niet.` | Closes a door charmingly. |
| `We laten de schakelaar liever weg dan hem verkeerd te tonen.` | Explains a refusal. The best sentence in the repo. |
| `Één keer koken ziet er hetzelfde uit als tien keer.` | Explains a design decision in ten words. |
| `De ingrediënten stonden niet in het bijschrift. Ze staan wel in het filmpje.` | Two facts, twelve words, zero apology. |
| `Deze maker vertelt de stappen alleen hardop. Bekijk het filmpje hieronder.` | Same. |
| `Jullie sluiten dit uit in Remy.` | PD-007a. A fact about the household, never a verdict about the reader. |
| `Dit briefje is N tekens te lang. We korten niets in. Haal er zelf iets af.` | The refusal-with-a-reason pattern again. |
| `Bewaard. Wanneer?` · `kan vanavond verschijnen` · `komt vanzelf een keer voorbij` | The save sheet. The lowercase-fragment explainers are unusual and they work. |
| `Video gevonden` · `Bijschrift gelezen` · `Recept samengesteld…` · `Post gevonden` · `Maker erbij gezocht…` | The import narration. |
| `Nog geen cijfers van je vrienden` · `Geeft een vriend een recept een cijfer, dan staat het hier.` | Elegant Dutch inversion. §6.9. |
| `Dat is de hele lijst.` · `Dat is alles van je vrienden.` | Two thirds of the end-note family. §7. |
| `Wat over alle keukens heen het hoogst scoort.` | Ownable. |
| `Dat ben je zelf.` | Four words for an error message. |
| `Sanne maakte dit` · `Sanne en Joris maakten dit` · `Sanne maakte jouw recept` · `Iemand die je kent maakte dit` | Correct words in the wrong slot. §1.3 sends the *slot* to WS-1 and WS-2. The words stay. |
| `Kiezen` · `Mijn recepten` · `Vrienden` · `Trending` | §5. |

### 3.11 Every test that needs updating

Nine assertions across five files. Each is listed with the new expected value.
Everything else in `tests/` passes unchanged.

| File | Line | Assertion today | After |
| :-- | --: | :-- | :-- |
| `tests/reason.test.ts` | 100 | `toBe('Sanne heeft dit ook gemaakt.')` | drop the full stop |
| `tests/reason.test.ts` | 130 | `toBe('Sanne, Joris en 2 anderen hebben dit ook gemaakt.')` | drop the full stop |
| `tests/reason.test.ts` | 141 | `toBe('Iemand die je kent heeft dit ook gemaakt.')` | drop the full stop |
| `tests/decide.test.ts` | 560 | `toBe('Sanne heeft dit ook gemaakt.')` | drop the full stop |
| `tests/decide.test.ts` | 583 | `toBe('Joris heeft dit ook gemaakt.')` | drop the full stop |
| `tests/allergenTaggingCopy.test.ts` | 13 | `toBe('Gecontroleerd. Geen van de 14 allergenen getagd.')` | `'Gecontroleerd. Geen van de 14 allergenen aangetikt.'` |
| `tests/sendRecipeSheetCopy.test.ts` | 436 | `toBe('Nog geen vrienden om naar te sturen.')` | `'Nog niemand om naar te sturen'` |
| `tests/libraryTileActionCopy.test.ts` | 270-271 | `toContain('Uitgezonderd van delen')`, `toContain('Weer delen')` | `toContain('Niet gedeeld')`, `toContain('Weer delen')` |
| `tests/libraryTileActionCopy.test.ts` | 305 | `toContain('kookmodus')` | `toContain('koken')` |

**Tests that must keep passing unchanged, and which every rewrite above was
checked against:**

- `libraryTileActionCopy.test.ts:247`. `COOK_PROOF_SHARED_ANNOUNCEMENT` must not
  contain `wordt gedeeld`. `Dit gerecht doet weer mee.` passes.
- `libraryTileActionCopy.test.ts:231`. No sentence in the module may contain
  `privé`, `prive`, `geheim`, `niemand`, `anoniem`. `Niet gedeeld` passes. A
  tempting alternative like `Alleen voor jou` would fail on intent even where it
  passes on letter; do not use it.
- `libraryTileActionCopy.test.ts:335, :343`. `LIBRARY_TILE_SEND_EXPLAINER` must
  not contain `gekookt`, `eerst`, `alleen als`, `gezien`, `gelezen`, `geopend`.
  That string is unchanged.
- `importFailureCopy.test.ts:126`. The display-only copy may not contain
  `mislukt`, `fout`, `ging mis`, `niet gelukt`, `probeer het opnieuw`. Both
  rewrites checked.
- `importFailureCopy.test.ts:91`, `allergenTaggingCopy.test.ts:7` and
  `friendFeedPresentation.test.ts:237`. No copy may contain `veilig`.
- `addFriendCopy.test.ts:292-293`. No outcome text may contain `blok` or
  `geweigerd`. Those strings are unchanged.
- `cookSharingCopy.test.ts:55, :74, :90-92`. Paragraph two must contain
  `openbare stem`; no consent prose may contain `iedereen ziet`, `veilig voor`,
  `meer info`, `lees meer`. The one edited sentence carries none of those.
- `gekooktPresentation.test.ts:216, :223`. The tab label may not contain a middot
  in speech and may not match `nieuw` or an exclamation mark. Untouched.
- `friendProofCard.test.ts:131`. The proof eyebrow may not contain `gedeeld`.
  Untouched.

---

## 4. The banned-words list

### 4.1 What `kring`, `bibliotheek` and `gekookt` had in common

All three were **nouns Remy invented or borrowed to name a place, where the
reader already had an ordinary way of saying it.**

- **`Kring`** is a coined social noun. Nobody in a Dutch kitchen says *mijn
  kring*. It needed a sentence of explanation the first time and every time.
- **`Bibliotheek`** is an institutional noun borrowed for *my saved recipes*. A
  bibliotheek is a building with a desk in it.
- **`Gekookt`** is a past participle nominalised into a place name. *Gekookt* is
  something you did, not somewhere you go.

The generalisation, which is the actual deliverable:

> **Remy never names a surface with a word it had to teach.**
>
> A name is one of exactly three things: **what you do there**, as a verb
> (`Kiezen`); **what is in it**, as a plain plural with a possessive if it is
> yours (`Mijn recepten`); or **who is in it** (`Vrienden`). If a name needs a
> sentence of explanation the first time somebody reads it, it is the wrong
> name.

The owner's own three replacements all obey this without having been told to.
That is the strongest evidence that this is the rule and not a rationalisation.

**Two corollaries the rename did not reach:**

1. **The rule applies inside the app, not just on tabs.** `uitgezonderd van
   delen`, `kookmodus`, `dislikes` and `getagd` are all words the product had to
   teach, sitting in ordinary sentences.
2. **A participle used as a fact is fine. A participle used as a place is not.**
   `Al gekookt` on a library tile is correct Dutch about a dish. `Gekookt` as a
   tab was a place named after a verb tense. Keep the first, and understand why
   it is not a violation.

### 4.2 The list

**A. Product-coined or borrowed nouns**

| Banned | Why | Use |
| :-- | :-- | :-- |
| `bibliotheek` | Owner removed it. **Still live at `src/app/sign-in.tsx:69`.** | `je recepten` |
| `kring` | Coined social noun. Clean in user copy today; still a module name, which is fine (English code). | `je vrienden` |
| `Gekookt` as a heading or place name | Participle as a place. | `Vrienden`, or say what happened |
| `kookmodus` | Internal name reaching users through screen-reader labels. | `koken` |
| `ranglijst` | Already replaced by the owner. Do not reintroduce. | `Trending` |

**B. Administrative register**

| Banned | Why | Use |
| :-- | :-- | :-- |
| `uitgezonderd`, `uitzondering`, `opheffen` | Legal-clerk vocabulary in a sheet about a lasagne. | `niet gedeeld`, `doet weer mee` |
| `van toepassing` | Form word. | say the thing |
| `beschikbaar` | Systems word. | delete, or name the thing |
| `gemarkeerd` | Systems word. | `blijft ongecontroleerd` |
| `controleren` as an instruction | Officialese. PD-006's own `Bevat dit gerecht een van deze?` is exempt. | `kijk … na` |
| `dient te`, `gelieve`, `conform`, `betreffende` | Not present today. Keep it that way. | |
| `Aantal X` as a heading | Spreadsheet noun. | a question, or the plural noun |
| `planning` | Project-management noun. | `ingepland` |

**C. English words wearing Dutch endings**

| Banned | Why | Use |
| :-- | :-- | :-- |
| `getagd`, `taggen`, `tagt` | English verb, Dutch conjugation. The most dating construction there is. | `aangetikt`, `aantikken` |
| `dislikes` | English plural noun in Dutch prose. | `wat je niet lust`; heading `Niet lekker` |
| `deleten`, `saven`, `sharen`, `liken`, `scrollen`, `swipen` | Same class. | `verwijderen`, `bewaren`, `delen` |

**Not banned, and this distinction is the whole rule:** naturalised English
*nouns* that a Dutch person uses in Dutch without noticing. `link`, `app`,
`video`, `post`, `TikTok`, `Instagram`, `high-protein`, `soul food`, and
`Trending` as the tab name. Importing an English *noun* is normal Dutch;
importing an English *sentence* or an English *verb inflection* is not.

**D. Trend vocabulary, banned on the half-life argument (§1.6)**

`slay`, `vibe`, `cringe`, `lit`, `fire`, `bestie`, `no cap`, `sheesh`, `bruh`,
`goals`, `iconic`, `heerli`, `skitta`.

Also banned, as the enthusiastic register that already reads as 2019:
`Oeps`, `Oepsie`, `Hoppa`, `Boem`, `Yes!`, `Lekker bezig!`, `Op naar de
volgende!`, `Even snel`, `In een handomdraai`, `Snel & makkelijk`.

**E. Words a recorded decision forbids**

| Banned | Decision |
| :-- | :-- |
| `veilig`, `veilig voor`, `Is dit veilig?`, `geen allergenen` | PD-006. Exclusion framing only, always. Tested in four places. |
| `gezien`, `gelezen`, `geopend` about a send | `DESIGN-SOCIAL.md` §8, and enforced in the repository interface. |
| `nieuw`, an exclamation mark, or a bullet on a tab or card | §8, and tested. |
| `Overgeslagen`, `Geannuleerd` for `Niet koken` | PD-002. The DB status is `skipped`; that word must never surface. |
| `Aanbevolen voor jou`, `Speciaal voor jou`, `Op basis van jouw smaak` | Rule two: reasons are concrete. |
| `populair`, `hot`, `viral` as a claim about a recipe | PD-004. Engagement framing. (`Trending` as the tab name is exempt; §5.) |
| `Meer info`, `Lees meer` | Already tested against in the consent copy. Extend app-wide: say it here or do not say it. |

**F. Register**

`u`, `uw`, `Uw` are banned outright. `alsnog`, `verder`, `gewoon`, `simpelweg`,
`natuurlijk`, `uiteraard` are banned as filler; delete and reread.
`optioneel` as a standalone word is replaced by `hoeft niet` or `(mag)`.

---

## 5. The four tab labels

`Kiezen` · `Mijn recepten` · `Vrienden` · `Trending`

### The verdict: keep all four, unchanged.

As a set they are four different grammatical kinds. `Kiezen` is a verb,
`Mijn recepten` a possessive noun phrase, `Vrienden` a bare plural, `Trending`
an English participial adjective. In the abstract a tab bar wants one kind, and
a copywriter's reflex is to regularise them. **That reflex is wrong here**, for
one reason: each tab is named by the thing that is most true of it, and the set
passes the only test that matters. A Dutch person reading four words at caption
size knows what is behind each one.

**`Kiezen` is the best label in the set, and the one most at risk from a tidying
instinct.** It names the daily job as a verb. Every alternative is worse:
`Vanavond` names a time and not an act, `Start` is an English app-shell word,
`Home` is not Dutch, and `Vandaag` collides with the library's `Deze week`
badge. Do not touch it.

**`Mijn recepten` is the only tab that says `mijn`, and that is what makes the
library feel owned.** This product's ambition is *de evolutie van het kookboek*,
and a kookboek is somebody's. Shortening it to `Recepten` for symmetry would
remove the one possessive in the navigation, which would be a real loss for the
sake of a grid. Do not shorten it.

**`Vrienden` is correct, and structurally constrained.** It carries the unseen
count (`Vrienden · 3`), so it has to be one short word or the label wraps.

**`Trending` is the one I would argue about, and I lose the argument.**

The cost is real. It is English in a Dutch-first product whose competitive
position, per `research/12-prior-art.md`, is precisely that every rival treats
Dutch as a footnote. Naming a tab in English undercuts that at the most visible
point in the app.

I still recommend keeping it, on three grounds:

1. **It is the owner's own replacement for `Ranglijst`**, chosen after he asked
   what `Ranglijst` was supposed to mean. `(tabs)/_layout.tsx` records that it
   is a choice, not an oversight, and that it is "not to be tidied back".
2. **`trending` is naturalised Dutch.** It is used unremarkably in Dutch news
   and everyday speech. Under §4's own rule it is a borrowed *noun*, not an
   English sentence, and borrowed nouns are how Dutch has always worked.
3. **Every Dutch alternative is worse.** `Ranglijst` is opaque and already
   rejected. `Top` is ambiguous. `Populair` is an engagement word that PD-004
   makes actively wrong. `Best beoordeeld` is two words that wrap and read cold.
   There is no Dutch word that does what `Trending` does in this slot.

### What I do argue

**The screen header `Trending recipes` should become `Trending`.**

It is the only two-word English phrase in the entire product, and the one place
where English is doing work Dutch could do or that nothing needs to do. Its own
file comment says both are the owner's words, and that the tab is the shorter of
the two only because it shares a caption line with three other words. Fair. But
the header sits directly above a Dutch subtitle (`Wat over alle keukens heen het
hoogst scoort.`), and `Trending recipes` over a Dutch sentence is exactly the
shape that makes a product read as translated.

Using only his word, and not a second English noun beside it, is not tidying his
word back. **His call.**

### One reported collision

`Vrienden` is the tab label, the `friends/add` screen title, and a section
heading inside that screen. Three things with one name. The screen title is
fixed in §3.7 (`Vriend toevoegen`); the section heading can stay, because there
it genuinely labels a list of friends.

---

## 6. The empty states, as a set

**The diagnosis.** There are thirteen empty or absent states in this product and
they were written one at a time. Eight of thirteen open with `Nog geen …` or
`Geen …`, three carry a redundant third line, one is a title wearing a full
stop, and one says the same thing three times in three registers. They read as
apologies not because of the word `nog`, which is the correct Dutch word for
*not yet*, but because several of them **explain themselves instead of naming
the mechanism.**

**The set-level rule.** Every empty state is exactly this shape:

1. **Title: what is true right now.** A fact. No full stop, no `helaas`, no
   `sorry`, no exclamation mark.
2. **Body: one sentence naming what will put something here.** The *mechanism*,
   not an excuse and not a reassurance.
3. **Footnote, only where there is a real promise or boundary to state.**
4. **Action, only where a real action exists on this screen.**

**And the rule that keeps the set from sounding sorry:** the title states the
state, the body states the mechanism, and neither ever comments on how the
reader should feel about it. `Nog niets beoordeeld` is a fact. `Er is hier nog
niets te zien!` is a product apologising for itself.

**The set carries none of the five lol lines.** An empty state is the wrong
place for a joke: it is where a person is most likely to be confused, and
warmth there has to come from clarity.

### 6.1 Mijn recepten, first run

- `Nog geen recepten`
- `Plak een link uit TikTok of Instagram. Remy maakt er een recept van.`
- Action: `Plak je eerste link`

*Change:* the old body (`Plak een link naar een TikTok- of Instagram-video om te
beginnen.`) ended on `om te beginnen`, which is filler, and never said what
happens after the paste.

### 6.2 Kiezen, empty rotation

- `Nog niets om uit te kiezen`
- `Plak een link en Remy kan morgen iets voorstellen.`
- Action: `Recept plakken`

*Unchanged.* This one already had the shape.

### 6.3 Kiezen, everything excluded

- `Vanavond valt alles af`
- `Je instellingen sluiten elk gerecht in je recepten uit.`
- Actions: `Kies zelf` · `Niet koken`

*Change:* `Niks voor de hand liggends vanavond` is a strained partitive, and the
body repeated `voor vanavond` from the title.

### 6.4 Kiezen, filtered out

- `Niets binnen je filters`
- `Wis ze, dan kijkt Remy weer in al je recepten.`
- Actions: `Filters wissen` · `Kies zelf` · `Niet koken`

*Change:* `deze filters` becomes `je filters`; the sentence that judged the
reader (`te streng`) goes; the body now names only the mechanism.

### 6.5 Kiezen, swaps exhausted

- `De wissels zijn op`
- `Morgen mag je weer wisselen.`
- Actions: `Ik kies zelf` · `Niet koken`

*Change:* `alternatieven` is the engine's word. The body now says what happens
next rather than what you spent. No count is named, deliberately.

### 6.6 Vrienden, empty

- `Nog niets van vrienden`
- `Maakt of stuurt iemand iets, dan staat het hier. Met het filmpje erbij.`
- Footnote: `Andersom blijft alles van jou privé. Delen doe je zelf, per recept.`
- Actions: `Vriend toevoegen` · `Naar mijn recepten`

*Changes:* the title said `Nog niets gedeeld`, which is only half true now that
proof cards land here. The body carried an em dash and promised only sends. The
footnote is unchanged and is one of the best lines in the product, because it
states PD-010.3 in the one place it actually reassures somebody.

### 6.7 Sturen, no friends yet

- `Nog niemand om naar te sturen`
- `Voeg eerst iemand toe met de gebruikersnaam die je van elkaar kent.`
- Action: `Vriend toevoegen`

*Changes:* the title loses its full stop and its trailing purpose clause; the
body loses a third sentence that restated the sheet the reader is already in.
**`SEND_NO_FRIENDS_TITLE` is pinned; see §3.11.**

### 6.8 Trending / Iedereen, the permanent one

This is not a first-run state. `recipe_ratings` has four readers and zero
writers, so **this is the only state this list can be in today, and it stays
that way until something in the product casts a public vote.**

Today it says the same thing three times:

> `Nog niets beoordeeld` / `Nog niet genoeg beoordelingen.` / `Een recept komt
> hier pas op zodra genoeg mensen het beoordeeld hebben.`

Replace with two lines, one fact and one mechanism:

- `Nog niets beoordeeld`
- `Zodra genoeg mensen een recept een cijfer geven, staat het hier.`

**And a finding that copy cannot fix, reported rather than papered over.** The
body names a mechanism that does not exist. Nothing in this app lets a person
cast a public vote, so `zodra genoeg mensen … een cijfer geven` describes an
action no reader can take and no reader has ever been offered. **No wording
fixes that.** Any honest version either names a place to vote, and there is
none, or admits the list is empty by construction, which is a product statement
rather than a copy one. This belongs to the open decision in handover §8 about
where a public vote is cast. **Routed to the owner via the assembly, not settled
here.**

`BOARD_EMPTY_COPY` is asserted verbatim at
`tests/leaderboardPresentation.test.ts:241`. If the two-line version above is
adopted, that constant becomes the *body* line and its assertion changes. It is
**not** in §3.11's list because it depends on the owner's answer to the
paragraph above. Make the copy change and the test change together, once that is
settled.

### 6.9 Trending / Vrienden

- `Nog geen cijfers van je vrienden`
- `Geeft een vriend een recept een cijfer, dan staat het hier.`

*Unchanged.* Both pinned by `tests/kringPresentation.test.ts:209-210`, and both
good. The inversion `Geeft een vriend …, dan …` is elegant, idiomatic Dutch that
no English-language tool would produce. It is the model the rest of the set
should aim at.

### 6.10 The four small ones

| Where | Copy | Change |
| :-- | :-- | :-- |
| Verzoeken, empty | `Er staan geen verzoeken open.` | none |
| Vriendenlijst on the add screen, empty | `Nog geen vrienden.` | was `Je hebt nog geen vrienden toegevoegd.`; the section label above already says `Vrienden` |
| Cook mode, no steps | `Geen stappen bij dit recept` / `Er staan nog geen stappen bij dit gerecht.` | `beschikbaar` and `bereidingsstappen` go; the body becomes active |
| Recipe detail, no ingredients or no steps | `De ingrediënten stonden niet in het bijschrift. Ze staan wel in het filmpje.` / `Deze maker vertelt de stappen alleen hardop. Bekijk het filmpje hieronder.` | none |

That last pair is the set's high-water mark: it turns an absence into a piece of
useful information about the world. Every empty state in this product should
aspire to that, and most can get closer than they are.

---

## 7. The vocabulary of absence

### The verdict

It is working, it is the most distinctive thing about how this app writes, and
it should be extended rather than reduced.

The vocabulary in question is the set of strings standing where a control would
be in a normal app:

- `Dat is alles wat er gedeeld is.` where `Load more` would be
- `Dat is de hele lijst.` and `Dat is alles van je vrienden.` at the two
  Trending scopes
- `wacht` where a status pill would be
- `Er staan geen verzoeken open.` where a zero would be
- `1 stem` / `2 stemmen` where an anonymous count would be
- no timestamp on any card, no `nieuw` badge, no count without names
- `Nog niet genoeg beoordelingen.` where a fabricated ranking would be

### Why it works

**1. It is the only vocabulary in this product that is not borrowed.** Every
competitor in `research/12-prior-art.md` writes `Load more`, `You're all caught
up!`, `No results found`. `Dat is alles.` ends a list the way a Dutch person
ends a conversation. That is a competitive position expressed in three words,
which is the cheapest competitive position anybody has ever bought.

**2. It converts every refusal into a statement.** A list that says it has ended
is not missing a button; it is finished. That is copy carrying the product
position directly, which is what this workstream is for. PD-004 measures
save-to-cook and explicitly not dwell time; a list that visibly stops is the
sentence-level form of that decision.

**3. Three of these strings are pinned by tests.** That is unusual and it is
correct. A refusal that lives only in prose gets eroded. A refusal with an
assertion behind it does not.

**4. `wacht` is the best absence word in the app and nobody has noticed it.**
One lowercase word, no icon, no colour, no spinner, standing for "this person
has not answered yet". It is genuinely ownable and it should become a device:
**a lowercase one-word state label, set in mono, wherever the app has to say
what has not happened.** That is a copy pattern WS-1 can build a type treatment
for.

### Three fixes, none of which spends a refusal

**Fix 1. Unify the end-note family.** Three variations on one sentence is
correct; three variations that do not agree is drift. The Vrienden one must
change anyway, because `gedeeld` is now false of a list containing proof cards.
`Dat is alles.` / `Dat is de hele lijst.` / `Dat is alles van je vrienden.` read
as one voice.

**Fix 2. The Trending empty state says one thing once.** §6.8.

**Fix 3. The unseen band has no word.** `orderGekooktList` puts unseen sends in
a band at the top of the feed and gives them a staggered entrance. To a reader
who does not watch the animation, or who has reduced motion on, that band is
**invisible**: an ordering with no label. The copy that would name it without
breaking anything is a section heading of three words, no count, no date, no
`nieuw`:

> `Voor jou gestuurd`

This spends **no** §8 refusal. §8 bans `nieuw` badges, counts without names, and
recency ordering. This is a label on a group that already exists, ordered by
directedness rather than by time, naming people-directed content rather than
counting it. **But it changes what a social surface contains, which is WS-6's
call under §3.7. Routed to WS-6 with the copy attached and no decision taken
here.**

### On spending a refusal for copy reasons

**I recommend spending none.** The honest answer is that the refusals are not
what is hurting the copy.

The one candidate worth examining is **timestamps**. The copy argument would be
that a card with no date has to say *something*, and this product's answer has
been to say nothing. Having read every card, I do not think the gap is felt. The
only place the absence of time genuinely costs a reader is the friend feed, and
the unseen band already answers the question a reader actually has, which is not
*when* but *is there anything I have not seen*. §1.4's bar requires quoting the
argument being overturned and saying why it no longer holds. §8's argument is
that "a board that moves because something is new is a feed wearing a ranking's
clothes", and PD-004 is what makes that load-bearing. Neither has weakened. A
timestamp would plausibly raise dwell time and not save-to-cook, which PD-004
names as a stated cost.

Fix 3 above is the cheaper answer, and it is a word rather than a refusal.

**A report that recommends spending nothing, and shows its work, is a successful
report.** This is that.

---

## 8. Things reported rather than fixed

Copy problems whose cause is not copy. Each is routed.

| Finding | Owner |
| :-- | :-- |
| `Ja` and every other button renders in monospace via `typeScale.button`, so an answer reads as a terminal command. | **WS-1** |
| Five sentences sit in an uppercase eyebrow slot (`SANNE MAAKTE DIT`, `GEDEELD DOOR SANNE`, and three more). The words are right; the slot shouts them. Plus the all-caps readability evidence in §1.3. | **WS-1** |
| Three eyebrow strings are literally capitalised inside a tested copy module, so the case decision cannot be reversed without editing a test. Fixed in §3.7 by moving the caps to `textTransform`. | **WS-1** (mine to hand over) |
| `import/confirm.tsx` prints a raw `error.message` into the UI. A machine talking. | **WS-2** |
| `settings.tsx` shows household size as `Aantal eters — {n}` because the count drives portioning. If the numeral must be visible, that is an information decision, not a copy one. | **WS-2**, if §3.9's recommendation to drop it is rejected |
| The Vrienden subtitle described only half the list, because the list became two-tier after the copy was written. Fixed in §3.4, but it will drift again unless the subtitle is owned by whatever decides the list's contents. | **WS-6** |
| The unseen band has an ordering and an entrance but no label, so it is invisible with reduced motion on. Copy proposed in §7, decision not taken. | **WS-6** |
| Trending's empty state names a mechanism the product does not implement, because nothing writes a public vote. No wording fixes this. | **the owner** (handover §8) |

---

## 9. Execution notes

- **Order of work.** The fourteen copy and presentation modules first, because
  they are pure, exported and already tested, and all nine test updates in
  §3.11 live there. Then the inline literals across the fourteen screens. Then a
  final grep for the em dash (must return zero user-facing hits), for three
  ASCII dots (zero), and for each word in §4.2.
- **Every string in §3 is directly implementable.** The Where column names the
  module or the screen. No string in this document proposes a control that does
  not already exist.
- **Nothing here requires a new component**, so handover §7's
  consumer-with-no-producer bug class does not apply. The one proposal that
  would add a rendered element, the unseen-band label, is routed to WS-6 and is
  not recommended for implementation from here.
- **Gates.** A copy pass touches only string constants and JSX text, so
  `npm run typecheck`, `npm run lint` and `npx expo export --platform web`
  should be unaffected. `npm test` needs the nine updates in §3.11 and no
  others. Verify by running the suite once, at the end.
