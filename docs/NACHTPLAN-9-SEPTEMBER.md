# Nachtplan — 9 op 10 september 2026

**Wegwerpdocument.** Zodra `HANDOVER.md` en `LONGLIST.md` de uitkomsten hebben
opgenomen mag dit bestand weg. Zelfde afspraak als `SESSIE-6-SEPTEMBER.md`.

Geschreven om 22:0x op 9 september, vlak voordat de eigenaar ging slapen. Zijn
opdracht: *"use fable 5 for a couple of critical parts … first research what is
best handled by a better model, then execute with fable 5 while i am asleep.
When we reach the time limit, I want you to restart when it refreshes our day
limits."*

## De uitgangsmeting, zelf gedraaid en niet overgeschreven

Om 22:00 op 9 september, op `feat/live-import-and-plan-phases`, werkboom schoon:

| Poort | Uitkomst |
|---|---|
| `npm run typecheck` | 0 |
| `npm test` | **139 bestanden, 3338 tests, exit 0** |

⚠ Die twee zijn gemeten. `lint`, `check:functions` en `check:seed` zijn bij het
opstellen van dit plan NIET opnieuw gedraaid — de agents draaien ze wel.

## Waarom deze drie naar het zwaardere model gingen

De maatstaf was één vraag: **zou een verkeerde keuze hier onzichtbaar zijn voor
de vijf poorten?** Alles wat een test kan betrappen hoeft het dure model niet.

1. **GAP-34 — dislikes doen niets.** `MealIngredient.name` wordt door geen
   enkel filter in de app gelezen. Dislikes worden vergeleken met
   `Meal.ingredientTags`, en dat is de EU-14 **allergenen**-unie. De voor de
   hand liggende zet — namen bij `ingredientTags` gooien — is in `types.ts` in
   hoofdletters verboden en sloopt de PD-006-poort stil. Veiligheidsgrenzend.
2. **GAP-33 — Kiezen narrowt zijn chips niet.** De AND-as narrowt **mét** de
   selectie, de OR-assen **zonder** hun eigen selectie. `recipeSearch.ts` legt
   uit dat andersom de rij sloopt in plaats van repareert. Twee verschillende
   staatsvormen (`DecisionFilters` vs `LibrarySearchState`). Geen test ziet een
   omgekeerde as.
3. **GAP-32 / GAP-55 — `Bewaren` op de gedeelde receptpagina.** Twee
   onafhankelijke analyses zetten dit op één. Er bestaat vandaag **geen enkel
   schrijfpad dat een `recipes`-rij naar `meals` kopieert**; dat is de blokkade,
   niet de knop. Spec staat in `DESIGN-SOCIAL.md` §3.3 en §4.3.

## Wat bewust NIET naar het zware model ging

Mechanisch en goed afgebakend, dus verspilling op een duur model:
`import/confirm.tsx` (963 regels) opsplitsen; `claim-handle.tsx` heeft geen
enkele uitgang (`grep -c "router\."` geeft nul — de enige doodlopende route in
de app); `dev-embed-probe.tsx:229` doet `router.replace('/')` waar `back()`
hoort; `app.json:25` draagt een hardgecodeerde `#ffffff` als Android-accent;
OPS-13 (`npm run db:seed` stuurt één prepared statement en `demo_social.sql` is
een `do $$ … $$;`-blok).

## Volgorde, en waarom hij niet volledig parallel is

De les van 8 september staat in `HANDOVER.md`: **"Disjuncte bestanden zijn geen
disjuncte layouts."** Twee pakketten waren elk apart groen en botsten alsnog.

- **GAP-33** en **GAP-32/55** draaien parallel: hun bestandsverzamelingen zijn
  echt disjunct (filterchips op Kiezen tegenover de vriendenkant).
- **GAP-34** draait **ná** GAP-33, want allebei kunnen ze `(tabs)/index.tsx`
  raken.

De agents committen zelf niet en stagen zelf niet. De hoofdsessie stageert per
pakket en commit apart, zodat elk pakket apart groen te meten is — dezelfde
discipline als 7 september, en goedkoper dan worktrees.

## Als de limiet geraakt wordt

Er staan cron-taken klaar in de sessie die het werk hervatten. ⚠ Ze zijn
**sessiegebonden**: ze staan niet op schijf en zijn weg zodra de CLI afsluit.
Dit bestand is daarom de echte overdracht — een verse sessie leest dít en niet
het geheugen van de vorige.

## Een vondst die GAP-45 van antwoord verandert

Gemeten tijdens het opstellen van dit plan, read-only, op 9 september 's avonds.

**GAP-34 heeft een matcher over ingrediëntnamen nodig. Die bestaat al, staat
onder test, en heeft nul productie-aanroepers** — in precies de modules die
GAP-45 aan de eigenaar voorlegt om weg te gooien:

- `src/domain/ingredientCategories.ts` — `categorizeIngredient(name)`, met
  `CATEGORY_BY_WORD` en `CATEGORY_BY_PHRASE`. Hele woorden, nooit substrings.
- `src/domain/mainIngredients.ts` — `NameableIngredient`, een structurele
  `{ name }`-vorm, plus `selectMainIngredients`. Beide dragen in hun eigen kop
  het argument waaróm ze niet verwijderd zijn.

⚠ **Wie GAP-45 uitvoert vóór GAP-34, gooit weg wat GAP-34 nodig heeft.** De
kop van `mainIngredients.ts` voorspelt dit zelf: *"deleting a heuristic in
order to re-derive it later — badly, from de same absent data — is how a
codebase forgets what it already decided."* Dat is geen argument om ze te
bewaren omdat ze mooi zijn; het is een gemeten aanroeper die op komst is.

**En de tweede helft van GAP-34 is een echte architectuurvraag**, en dat is de
reden dat hij op het zware model staat: `DecisionRequest.candidateMeals` is
`readonly Meal[]`, en `Meal` draagt **geen** ingrediënten — alleen
`ingredientTags`, de allergenen-unie. De namen zitten op `MealIngredient`, een
aparte rij. Er moet dus een keuze gemaakt worden over hóe die namen de
beslisstroom in komen, en die keuze raakt de repository.

## Een "bug" die geen bug is — `claim-handle.tsx`

`HANDOVER.md` noemt onder *Schulden die nergens anders staan*:

> ⚠ **Het dertiende scherm is `claim-handle.tsx`, en dat heeft helemaal geen
> uitgang.** Nagemeten met `grep -c "router\."`: **nul** treffers in het hele
> bestand — geen `router.back()`, geen `router.replace()`, geen `Annuleren`.
> Zijn enige control is `Klaar`, die opslaat. Dit stond in geen enkel
> overzicht, en het is de enige echte doodlopende route in de app.

**De meting klopt. De gevolgtrekking niet, en dat is voor de vijfde keer in
dit document dezelfde vorm.** Nul `router.`-treffers is hier geen ontbrekende
uitgang maar een ontwerp dat op drie plaatsen is vastgelegd:

- `src/app/_layout.tsx:244` — `<Stack.Screen name="claim-handle"
  options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />`.
  **`gestureEnabled: false` is opzet die je niet per ongeluk typt**: de
  terugveeg is expliciet uitgezet.
- `src/app/_layout.tsx:288` — `router.replace('/claim-handle')`. De root
  layout stuurt je hierheen zodra `resolveSessionState` `needs_profile` geeft;
  het scherm navigeert niet zelf omdat de layout dat doet.
- `src/lib/sessionRevalidation.ts:10` — zegt het met zoveel woorden: *"the
  claim-handle screen deliberately does not navigate (the root layout is …)"*.

En de reden staat in de kop van het scherm zelf: `profiles` is de rij waar
elke sociale RLS-policy in `0007_social.sql` tegenaan joint, dus zónder die
rij geeft de halve app stil niets terug. Een terugknop hier is een uitgang
naar een kapotte staat.

⚠ **Wie GAP-43 oppakt moet dit scherm dus overslaan, en niet meetellen in
"twaalf van de dertien hebben een uitgang".** De noemer klopt; de conclusie
dat de dertiende een gat is, niet. Er is niets te repareren — er is een regel
te schrappen uit de schuldenlijst.

## Wat er af is

**Gemeten, niet afgeleid.** Elk pakket apart gestaged en apart gecommit; de
agents committen zelf niet.

| Commit | Wat |
|---|---|
| `cd4d09d` | **GAP-33 — Kiezen narrowt zijn chips mee.** 13 tests erbij, 3338 → 3351. AND-as narrowt mét zijn selectie, OR-as zonder, allebei unioneren de selectie terug. Narrowt met `filterByDecisionFilters` (`decide()`'s eigen pass), niet met `filterLibraryMeals` |
| `feffdfe` | De sluitknop van `dev-embed-probe.tsx` is `canGoBack() ? back() : replace('/')` geworden |
| `3632188` | `TrendingFilterBar`'s derde reden is onwaar geworden door GAP-33; doorgestreept, reden 1 en 2 dragen het oordeel nog |

⚠ **Twee dingen die HANDOVER.md voorschreef zijn AFGEWEZEN, allebei omdat de
voorgeschreven reparatie het defect zou hebben ingevoerd dat ze wilde
oplossen.** Zie de twee secties hierboven: `claim-handle.tsx` heeft geen
uitgang nódig, en `dev-embed-probe.tsx` had geen kale `back()` moeten krijgen.
Dat is dezelfde vorm die dit project deze week vier keer bij de migratiestand
had — een correcte meting aan een verkeerde vraag gehangen.

⚠ **`src/app/(tabs)/index.tsx` stond op HEAD al op 816 regels, over het
plafond van 800, en staat na GAP-33 op 825.** Niet door deze wijziging
veroorzaakt — hij was er al overheen — maar het is de tweede plek na
`import/confirm.tsx` (963) die opgesplitst moet worden. Hoort als eigen regel
in `LONGLIST.md`.

### De limiet is één keer geraakt, en dat kostte een lege ronde

**10 september, 00:40 (Europe/Amsterdam):** de eerste GAP-34-agent is
afgebroken op een sessielimiet vóórdat hij ook maar één bestand had gelezen.
Hij liet **niets** in de boom achter — `git status --short` gaf nul regels, en
dat is nagemeten en niet aangenomen.

Om **01:13** is de eerste geplande wake-up gevuurd, zijn de vijf poorten
opnieuw gemeten (typecheck 0, lint 0, `check:functions` 0, `check:seed` 0,
**3405 tests over 142 bestanden** — gelijk aan de stand van vóór de limiet) en
is GAP-34 opnieuw uitgezet, met in de opdracht de instructie om zich te
begroten: liever één volledige groene plak dan breed rondkijken.

⚠ **Wat dit leert over de opzet, en niet alleen over deze nacht:** de
wake-ups deden precies waarvoor ze stonden, maar ze zijn sessiegebonden. Was
de CLI zelf gestopt in plaats van alleen de agent, dan had niets ze
herstart. **Dit bestand is daarom de echte overdracht** — het staat sinds
`eca0cf1` in git en overleeft de sessie wél.

### Nog onderweg

- **GAP-32/55** (`Bewaren` + het `recipes` → `meals`-schrijfpad) draait nog op
  een Fable-agent. Zijn RED-fase is zichtbaar in de boom: `recipeCopy`,
  `saveRecipeCopy`, `sharedRecipeSaveCopy` en de twee social-repository-tests
  falen omdat hun modules nog niet bestaan. **Dat is TDD die werkt, geen
  kapotte boom** — maar het betekent wel dat een volledige `npm test` op dit
  moment rood is en dat alleen daar.
- **GAP-34** is bewust NIET gestart zolang GAP-32/55 loopt: allebei raken ze
  vermoedelijk `src/domain/types.ts`, en dat is precies de gedeelde grootheid
  waar 8 september op stukliep.
