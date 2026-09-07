# Sessie 6 september 2026 — overzicht

Wat er deze sessie gevraagd, gebouwd, gevonden en besloten is. **Dit is een
sessiedocument, geen staand document.** `HANDOVER.md` is de plek waar de
stand van het project hoort; wie dit gelezen heeft en de handover heeft
bijgewerkt, mag dit bestand weggooien. Het staat hier alleen omdat de
eigenaar een deel van de tussenberichten gemist heeft.

**Stand:** branch `feat/live-import-and-plan-phases`, t/m `605c795`. Al het
werk hieronder staat in de werkboom en is **niet gecommit**.

---

## 0. De vraag

Vier dingen, in de woorden van de eigenaar:

1. De handover lezen en het openstaande werk daar en op de longlist afmaken.
2. *"a small checkbox that you can tap not to share you made a recipe … but
   it should be standard that you share it with friends."*
3. *"the rating should also be represented in the global ranking of a
   recipe."*
4. *"how we can use strava as an example to set up the social media part and
   grow into tiktok/instagram afterwards."*

En in een tweede ronde: of de reactie op een gedeeld recept niet beter *"add
the recipe to one that we want to make in the future"* kan zijn dan Strava's
kudos, gekoppeld aan een foto of de thumbnail — en of de video van
TikTok/Instagram/Facebook **in de app zelf** getoond kan worden, omdat mensen
wegsturen naar een ander platform ze weghaalt bij de waarde die Remy levert.

---

## 1. Wat er staat

Vijf agents, met strikt gescheiden bestandslijsten — de voorwaarde die de
agentronde van 5 september opleverde. Drie in een eigen worktree, twee in de
gedeelde boom. Alles is samengevoegd en nagemeten:

```
npm run typecheck        exit 0
npm run check:functions  exit 0
npm run lint             exit 0
npm test                 2852 tests / 117 bestanden
```

De telling sluit exact, en dat is de controle dat er in het samenvoegen niets
verdwenen of dubbel geteld is: 2698 (uitgangspunt) + 28 + 7 + 41 + 78 = 2852,
en 111 + 1 + 3 + 2 = 117.

| Agent | Wat | Waar het landde |
|---|---|---|
| Sociale defaults + openbare stem | het kookmoment: vinkje, default, `rateRecipe` bedraad | migraties `0015`, `0016`, `OutcomeCard`, `cook/[mealId]`, repositories |
| Save-intent + receptscherm | de laatste twee van de tien punten van 5 september | `src/app/recipe/[mealId].tsx` (nieuw), `import/confirm.tsx`, `recipes.tsx` |
| Beslissingen vastleggen | PD-022, PD-023, omkeringsbanners | `docs/` |
| Audit sociale laag | GAP-18: WS2/WS3/WS6 tegen de code gehouden | alleen bevindingen |
| Video-embed | kan de video in de app? | `src/domain/embed/**`, `SourceVideoPlayer`, dev-probe |

---

## 2. De twee beslissingen die de eigenaar nam

### 2.1 Delen wordt de standaard (PD-022, PRF-05)

`households.share_cooks_with_friends` stond sinds `0009:103` op
`not null default false`, en `DESIGN-SOCIAL.md` §5 verdedigde dat uit-staan
uitvoerig. De default draait om. De weigering verhuist van het zeldzame geval
naar het gewone: een klein vinkje bij het koken, standaard aangevinkt.

**Wat er níét gebeurt, en dat is het scherpste stuk.** Migratie `0015`
bevat **geen `update`-statement**. Een nieuw huishouden begint aan; een
bestaand huishouden dat de vraag nooit beantwoord heeft blijft uit tot het
gevraagd wordt, met het vakje voorgevinkt. De migratie verandert dus een
kolomdefault en **nul rijen**. Een default mag een eigenaar omkeren;
toestemming mag geen DDL-statement om middernacht leveren. Dat is de ene
regel uit het oude privacymodel die de omkering overleeft.

**Wat het kost, en dat staat er onverbloemd in.** §5 noemde uit-staan de
*eerste* verzachting tegen de inferentie dat een lijst gerechten een dieet
verraadt — halal, vegan, een vermijding. Die is nu uitgegeven. Wat overblijft:
het publiek is alleen wederzijds geaccepteerde vrienden, het vinkje, de
schakelaar in instellingen, en consent-copy die de inferentie bij naam
noemt. Vastgelegd als de afweging van de eigenaar, niet als bezwaar.

De vier consent-paragrafen zelf blijven staan. PD-005 verandert niet, alleen
de stand van de knop.

### 2.2 Het cijfer wordt ook een openbare stem (PD-023, GAP-31)

**Ranglijst was leeg om een andere reden dan iedereen dacht.** `rateRecipe`
heeft twee implementaties, één interfaceregel en **nul aanroepers** — elke
aanroepplek in de repo staat in `tests/repository/`. De lege ranglijst werd
gelezen als gevolg van PD-019's scheiding tussen privé-cijfer en openbare
stem. Dat was het niet: er ontbrak een schrijver. `DESIGN.md` §10 zei het
zelfs letterlijk — *"a repository seam, `rateRecipe`, with no screen behind
it"* — en niemand trok de conclusie.

Eén gebaar schrijft nu twee rijen. Goedkoop, want de schalen zijn al gelijk:
`cook_events.rating` en `recipe_ratings.rating` zijn allebei `numeric(4,2)`
met dezelfde CHECK sinds `0008`, en `src/domain/rating.ts` bezit beide. De
openbare schrijfactie kan niet falen op de private: hij geeft
`'cast' | 'skipped' | 'failed'` terug in plaats van te gooien.

**De grens die blijft:** alleen een maaltijd met een `recipeId` kan stemmen;
een zelfgetypt gerecht rangschikt niets. En één stem per persoon per recept
(`0007:488`), dus twee keer hetzelfde koken *vervangt* je stem.

**Wat er betaald wordt:** PD-019's inflatie-argument. Een cijfer waarvan de
kok weet dat vrienden het zien loopt op, en de motor leest die drift. Dat is
niet weerlegd, het is geaccepteerd — en het instrument dat het zou aantonen
staat erbij genoteerd: de verdeling van `cook_events.rating` over tijd.

### 2.3 De keuze die de eigenaar tussendoor maakte

Het vinkje raakte een lek dat pas bij het bouwen zichtbaar werd.
`recipe_ratings` draagt `rater_profile_id`, `recipe_ratings_select` is
`using (auth.uid() is not null)` (`0007:516`), en `buildKringMetaLine`
(`kringPresentation.ts:110-126`) drukt stemmers bij naam af als
*"8,5 · Sanne en Joris"*. Zonder ingreep staat iemand die het vakje uitzet
dus nog steeds **met naam** naast zijn cijfer op de kringregel.

Gekozen: **naam verbergen, getal behouden.** Migratie `0016` maakt daar een
*view* van (`namable_recipe_votes`) en geen kolom. De reden is die van `0009`
voor `shared_cooks`, één tabel verderop: een trigger-onderhouden kolom vraagt
triggers op vijf bronnen, en wie er één mist blijft `true` zeggen voor een
huishouden dat gevraagd heeft verborgen te worden — onzichtbaar, want de
verschaalde rij ziet er volkomen gewoon uit. Een view kan niet driften, en
levert §3.5's *"het verleden inbegrepen"* gratis.

Uitgebreid naar de globale schakelaar, met één versmalling: de anti-join gaat
óók door `meals`, zodat een stem die iemand vanaf het bord uitbracht zonder
ooit gekookt te hebben zichtbaar blijft. Een schakelaar die over koken gaat
heeft niets te verbergen over een stem die geen kooksessie is.

---

## 3. Wat de audit vond

Een agent heeft WS2, WS3 en WS6 tegen de code gehouden — de helft van GAP-18
die nooit nagelopen was. Methode: elke bewering gegrepd, dan het bestand
geopend en de code gelezen; waar ABSENT staat, staat de grep erbij die niets
teruggaf.

**Wat goed blijkt te zijn**, en dat verdient vermelding in een project waar
audits vooral missers opleveren:

- **De kring klopt, clausule voor clausule.** Ondergrens van 1 stem (niet de
  drempel van het bord), geen Bayesiaanse krimp, plat gemiddelde, één
  decimaal met komma en behouden nul, stemmers genoemd tot twee en daarna
  geteld, gelijkspel op stemmen en dan alfabetisch, nooit opgevuld. Zes apart
  gespecificeerde regels, zes apart correcte implementaties.
- **De drie absolute verboden uit `DESIGN.md` §8 houden alle drie stand.**
  `positive` komt op precies drie plekken voor, alle drie binnen de
  closed-loop-conditie. Nul tijdstempelformattering in de hele sociale laag.
  En leesbevestigingen zijn *structureel* geblokkeerd: `seen_at` valt weg in
  de rijprojectie, dus een scherm kan er niet per ongeluk één versturen.

**Wat ontbreekt**, op volgorde van wat een gebruiker merkt:

1. **De Vrienden-tab is op echte data grotendeels inert** (nu GAP-32).
   Bewijskaarten krijgen geen `onPress` (`friends.tsx:445-459`),
   `/friends/[feedItemId]` draait op fixtures — dat zegt het bestand zelf in
   hoofdletters op `:49` — en `Bewaren` bestaat er niet. **Dat laatste is
   precies het idee van de eigenaar over de kudos-vervanger**, en het is in
   `DESIGN-SOCIAL.md` §3.3 en §4.3 volledig gespecificeerd. Het gevolg: een
   gedeeld recept kun je bekijken noch bewaren.
2. **Live send-kaarten renderen niet** — de live route bouwt alleen
   bewijskaarten, dus het notitieregeltje verschijnt buiten `__DEV__` nooit.
3. **De closed loop vuurt live niet**, geblokkeerd op één ontbrekende
   repository-lezing die drie gespecificeerde gedragingen tegelijk nodig
   hebben.

**Documenten die de code tegenspraken** (naast de elf die de handover al
telde). De belangrijkste vier:

- `DESIGN-SOCIAL.md` §3.5 zei dat `Stop delen` de rijen *verwijdert*. `0009`
  bewaart ze met `withdrawn_at`, expres. **De code was beter dan het
  document.**
- §7 zei dat `(tabs)/ranglijst.tsx` *"untouched"* was. De kring woont daar
  inmiddels.
- Vijf plekken beweerden dat de kring-copy ongewijzigd overgezet was. `b9b0f59`
  herschreef twee strings — terecht, want WS3 §7 haalde het woord *kring* uit
  alles wat een gebruiker leest. **Ook hier had de code gelijk.**
- `DESIGN.md:889` beweerde dat er nergens een openbare-stem-knop hoort te
  bestaan.

---

## 4. Strava, en de weg naar TikTok/Instagram

### Waarom Strava het juiste model is

Niet vanwege de feed. Twee dingen:

**De inhoud is een bijproduct van iets wat je toch al deed.** Je rent omdat je
rent; de activiteit legt zichzelf vast; posten is de default, geen
compositie-handeling. `DESIGN-SOCIAL.md` §0 zegt dit al zonder Strava te
noemen. Het vinkje van de eigenaar is het laatste stuk daarvan: het verschuift
de vraag van *"post ik dit?"* naar *"houd ik dit achter?"*.

**Het segment.** Strava's echte uitvinding was niet "deel je run" maar *"dit
stuk weg is een gedeeld object, en iedereen die er ooit liep staat op één
lijst"*. Je kiest geen segment; je rent, en je wordt gerangschikt.

**Remy's segment is het recept.** En de hele apparatuur staat er al:
`recipes`, `recipe_ratings`, Ranglijst, de kring. Wat ontbrak was een
schrijver — precies wat deze sessie bouwde. De twee dingen die de eigenaar
vroeg zijn dus niet twee features, maar de aanbodkant en de rangschikkingskant
van hetzelfde mechanisme.

**Wat er nog mist om het recept een echt segment te maken:** je eigen
geschiedenis erop. Strava toont *"je liep dit 14 keer, je PR is 4:32"*. Remy
zou *"je maakte dit 6 keer, je gaf het gemiddeld een 8,2"* moeten tonen op het
receptscherm — dat nu bestaat.

**Waar Remy tegen Strava in moet blijven gaan: kudos.** Kudos werkt bij Strava
omdat een 10k objectief duur is. Een like op iemands avondeten is aan beide
kanten goedkoop. §1 weigert het al, en het idee van de eigenaar — *bewaren
voor later* — is de eerlijke reactie, want die kost de ontvanger echt iets.

**Het gat dat blijft:** vandaag hoort de verzender niets als een vriend
bewaart, alleen als hij kóókt (§3.4). Strava's kudos reist terug. De eerlijke
versie: *"Sanne wil dit maken"* bereikt de verzender één keer, als post. Zonder
getal — §3.4's eigen zin blijft staan: *"the moment a send earns a persistent
number, people start cooking for the number."*

### De drie grafen

Strava is **weinig moeite, veel vertrouwen, kleine graaf**. TikTok is **veel
moeite, weinig vertrouwen, geen graaf**. Het zijn tegenpolen; de fout is
springen.

1. **De gesloten graaf** (waar Remy nu is). Alleen wederzijdse vrienden,
   afgeleide inhoud. De eerlijke maatstaf is niet DAU maar de
   **closed-loop-graad**: welk deel van de verstuurde recepten aan de andere
   kant gekookt wordt.
2. **De open graaf, nog steeds afgeleid.** Asymmetrisch *volgen* bovenop
   wederzijdse vriendschap, eerst voor makers (BIZ-04 bouwt daar al aan). De
   eenheid blijft het recept. Wat opengaat zijn **lijsten waar je in kunt
   komen**: "onder 20 minuten", "wat je in huis hebt", de kring. Ontdekking
   zonder feed, gerangschikt op een natuurlijke sleutel in plaats van op een
   algoritme dat gokt.
3. **Gecomponeerde inhoud.** Pas hier telt de foto. En hier heeft Remy een
   voordeel dat niemand anders heeft: **de app staat al bij het fornuis.**
   Kookmodus weet welke stap je doet, dat de timer liep, dat hij afging. Een
   foto genomen ín kookmodus op het "Gemaakt!"-moment hangt aan een echte
   kooksessie op een canoniek recept. Dat is een **geverifieerde** foodfoto —
   wat Instagram structureel niet kan bieden, want dat weet niet of je het
   gekookt hebt of een restaurantbord fotografeerde. Het is de rol die GPS bij
   Strava speelt.

En sinds SRC-07 loopt de pijplijn beide kanten op: een foto wordt een recept,
een recept levert een foto, dezelfde Gemini-aanroep omgekeerd.

**Bouw geen feed.** Strava's feed is zijn zwakste oppervlak. Remy heeft het
recept als natuurlijke sleutel, en dat is precies waar feeds een surrogaat
voor zijn.

---

## 5. Kan de video in de app?

**Ja — en embedden is duidelijker toegestaan dan wat de app vandaag al doet.**

`research/13-legal-tos.md` §1.4 citeert Meta's eigen oEmbed-documentatie:

> "Using metadata and page, post, or video content (or their derivations)
> from the endpoint for any purpose other than **providing a front-end view**
> of the page, post, or video is strictly prohibited."

Een front-end view tonen is de bij naam toegestane toepassing. De caption
eruit halen en er met een model een gestructureerd recept van maken is het
"extracting/persisting" dat de zin verbiedt. De gevraagde functie staat dus
aan de toegestane kant van precies dezelfde zin waar de bestaande pijplijn
aan de verboden kant staat.

**Niet overdrijven.** De clausule gaat over de metadata van het
oEmbed-*endpoint*. De `/embed/`-**URL** is iets anders, en die documenteert
Meta helemaal niet. Het is bewijs van bedoeling, geen vergunning.

| | Werkt | Voorwaarden | Fundament |
|---|---|---|---|
| **YouTube** | `youtube.com/embed/{id}?playsinline=1` | gedocumenteerde playerparameters | schoonste |
| **TikTok** | `tiktok.com/player/v1/{id}` | gepubliceerd *om* te embedden, geen front-end-only-clausule | goed — en deze vorm heeft geen extern script nodig |
| **Instagram** | `instagram.com/{p\|reel}/{code}/embed/` | de toegestane toepassing, op een ongedocumenteerd endpoint | werkbaar, kan zonder aankondiging wijzigen |
| **Facebook** | `plugins/video.php` | geen clausule om te citeren; de gedocumenteerde iframe-vorm heet *deprecated* | zwakste |

**Geen ontwikkelbuild nodig:** `react-native-webview` zit in Expo Go
(`expo/bundledNativeModules.json:116`, `inExpoGo: true`). Dit valt dus niet
achter ENT-01's blokkade.

**Eén vondst die breder geldt dan deze functie.** `originWhitelist` op een
WebView is **geen sandbox maar een router**. Een URL die de whitelist niet
haalt gaat naar `Linking.openURL()` — het besturingssysteem — *voordat* je
navigatiebeleid geraadpleegd wordt. De schijnbaar veilige instelling (versmal
hem tot de embed-origin) haalt dus elke `tiktok://`- en `instagram://`-deeplink
in de speler **buiten** je bereik en opent hem in díé app, wat precies is wat
de eigenaar niet wil. De component zet daarom bewust `originWhitelist={['*']}`
en blokkeert in het geteste beleid. Dat staat in de header zodat niemand het
"repareert".

**De meting staat klaar en is niet gedaan.** `exp://<lan-ip>:8081/--/dev-embed-probe`.
TikTok en YouTube zijn voorgevuld uit de documentatie van de platforms zelf;
**Instagram en Facebook moet de eigenaar zelf plakken**, want Meta publiceert
geen voorbeeldpost. Waar op te letten: *"Document geladen"* vuurt óók voor een
foutpagina, dus tik op play; blijft hij inline of neemt hij het scherm over;
en tik op de makersnaam ín het kader — die hoort naar Safari te gaan, niet de
TikTok-app te openen.

---

## 6. Correcties op wat ik onderweg beweerde

Vier keer, en drie ervan kwamen van agents die mijn bewering natrokken:

- **"De friend-proof-reden kan nooit vuren"** — te sterk gesteld.
  `FRIEND_PROOF_BOOST` leest `shared_cooks`, niet stemmen, dus de boost werkt;
  en `reason.ts:105-124` heeft een legitieme variant zonder cijfer. Wat
  onbereikbaar was, is PD-017's kopregel *mét* getal. Dat is in één opzicht
  erger: het scherm rendert een correcte zin, dus geen test ziet de dode tak.
- **"WS-6: 0 van 8 toegepast"** — niet verifieerbaar zoals gesteld. De tabel
  van acht zijn *weigeringen die blijven staan*, geen aanbevelingen; de echte
  aanbevelingstabel heeft zestien rijen, waarvan er minstens één toegepast is.
- **"YouTube's voorwaarden eisen de officiële speler"** — die zin bestaat
  niet. Wat er wél staat zijn drie verbodsbepalingen in de Developer Policies
  die de officiële speler **bij uitsluiting** de enige gesanctioneerde route
  maken. Zwakker, en dat is de ware versie.
- **`cook_sharing_asked_at` als kolom** — ik gaf een agent de opdracht daarop
  te vertakken op grond van een *comment* in `local/household.ts`. De kolom
  bestaat niet; die comment beschrijft hem correct als alleen-lokaal. Precies
  de fout waar dit project voor waarschuwt, door mij gemaakt in een opdracht
  die ertegen waarschuwde.

---

## 7. Wat er nu open ligt

**Voor de eigenaar, niet in code te betalen:**

1. **`npx supabase db push`** — `0014`, `0015` en `0016` staan alle drie
   gecommit-en-niet-toegepast.
2. **De app op een toestel doorlopen.** Drie dingen specifiek: de import
   (een vers geïmporteerd recept komt **niet meer** op *deze week* of de
   boodschappenlijst — de grootste gedragswijziging hier), een tik op een
   bibliotheektegel die nu het receptscherm opent in plaats van kookmodus, en
   de embed-probe.
3. **Open vraag J** — `shouldAskCookSharing` is verbreed naar `>= 1`, zodat
   een bestaand huishouden bij de volgende geaccepteerde vriendschap alsnog
   gevraagd wordt. Eén regel om terug te draaien.

**Hygiëne die nu opvalt:**

- **`.gitignore` kent geen `.claude/`-regel**, en daar staan de
  agent-worktrees. `git add -A` zou drie kopieën van de repo committen.
- **`research/` is volledig untracked** — vier bestanden, waaronder de
  ToS-analyse waar de embed-beslissing op rust, in geen enkele commit op geen
  enkele branch.
- **`src/app/import/confirm.tsx` was al 892 regels** vóór iemand hem aanraakte
  (92 over het plafond) en is nu 963. Eruit halen wat eruit moet —
  `buildEditedRecipe`, `buildMealInput`, `persistImportedMeal` naar
  `src/domain/import/**` — is een schone vervolgklus.

**Keuzes die de eigenaar met één regel kan omkeren:**

| Wat | Terugdraaien kost |
|---|---|
| Een tik op een tegel opent het receptscherm i.p.v. kookmodus | twee props in `recipes.tsx` |
| `SaveIntentSheet.tsx` blijft bestaan maar wordt nergens gemonteerd | negen comments in zes bestanden repareren |
| `Verwijderen` en `Deel deze niet` staan niet op het receptscherm | — |
| De globale schakelaar onderdrukt óók naamgeving op de kringregel | één clausule uit `0016` |

**Het volgende dat ik zou bouwen:** `Bewaren` op `/friends/[feedItemId]`, met
dat scherm van fixtures af. Dat is het idee van de eigenaar over de
kudos-vervanger, het is al volledig gespecificeerd, het is door twee
onafhankelijke analyses als nummer één aangewezen, en het is de enige
handeling die de ontvanger van een gedeeld recept heeft.

---

## 8. Over de agentronde zelf

Twee dingen voor de volgende keer, allebei gemeten:

- **Alle drie de worktrees kwamen op `e73d73f` binnen**, honderd commits
  achter, zonder `docs/` en zonder `node_modules`. Alle drie de agents
  merkten het, bewezen de ancestor-relatie, spoelden zichzelf vooruit en
  hermaten het uitgangspunt vóór ze iets aanraakten. Er is niets verloren
  gegaan, maar drie van de drie is geen toeval.
- **Een agent in een worktree kan niet in de hoofdboom werken.** De harness
  pint hem vast op zijn eigen map. Toen ik er één terugstuurde met "werk nu in
  main" kon dat niet; hij loste het op door te bewijzen dat zijn worktree
  byte-identiek was aan main, mijn versie van `0016` naar binnen te kopiëren
  zodat zijn patch die niet zou overschrijven, en een schone patch tegen
  dezelfde basis af te leveren. Dat werkte, maar "ga in main werken" is geen
  opdracht die een geïsoleerde agent kan opvolgen.
