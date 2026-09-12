# Ronde 8 september — Trending, en het vriendschapsverzoek

Vier meldingen van de eigenaar, op een iPhone 16 Pro via Expo Go, tegen de
**productiedatabase** met `supabase/seed/demo_social.sql` erin.

**Wat hij letterlijk zei:**

> "Ik kan het vriendschapsverzoek niet accepteren. Daarnaast, als ik op die
> pagina zit en op terug probeer te klikken werkt dit niet. Dit kan komen door
> mijn telefoon (iphone 16 pro) maar dat betekent dat dit pagina terug teken
> iets lager moet om te voorkomen dat je hier soms niet op kan klikken.
>
> Als ik naar de trending tab ga, kan ik niet op de recepten klikken die ik
> daar zie, ook hebben ze geen foto, een soort scroll feature zou ik hier
> liever willen dan een ranking. Ik wil dat je hier gewoon een zelfde soort
> ervaring krijgt als bij kiezen maar dan dat je naar beneden kan scrollen en
> er een nieuw recept komt. Bijvoorbeeld zoals instagram met foto's werkt.
>
> Ook hier wil ik dat je een filter kan aanzetten."

---

## Nulmeting van deze ronde

Gedraaid, niet overgenomen, op 8 september vóór er iets werd uitgezet:

```
npm run typecheck        exit 0
npm run lint             exit 0
npm run check:functions  exit 0
npm run check:seed       exit 0
npm test                 3273 tests / 136 bestanden
```

De **lokale stack draait**: `npm run db:start`, `npm run db:reset` (alle
negentien migraties tegen een lege database, exit 0), en de seed. In die
database staat een echt profiel `joost`
(`bed436ab-404c-4aaa-b0e3-290b6e5db03b`, e-mail `joost@example.com`,
wachtwoord `joost-local-1234`), aangemaakt via de admin-API zodat er een
`auth.users`-rij achter staat en RLS echt werkt.

⚠ **`npm run db:seed` WERKT NIET met de CLI die hier staat** (v2.116.0), en dat
is gemeten en niet aangenomen:

```
{"code":"LegacyDbQueryExecError",
 "message":"failed to execute query: error: cannot insert multiple commands
            into a prepared statement"}
```

`supabase db query` stuurt één prepared statement; `demo_social.sql` is een
`do $$ … $$;` **plus** de controlequery eronder, dus twee commando's. Wat wél
werkt en gebruikt is:

```
docker exec -i supabase_db_remy psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/seed/demo_social.sql
```

Uitkomst 6 / 1 / 8 / 6 / 18 / 1 — precies wat de controlequery belooft.
`docs/LOKAAL-DRAAIEN.md` moet dit weten; het staat hier zodat de volgende
uitvoerder er geen half uur aan kwijt is.

---

## De gedeelde grootheid van deze ronde, en wie hem heeft

Op 7 september is geleerd dat **disjuncte bestandslijsten geen disjuncte
layouts zijn**: twee pakketten waren apart groen en samen kapot omdat ze
allebei aan hetzelfde hoogtebudget rekenden. Deze ronde heeft één zulke
grootheid, en die is **vooraf door de orkestrator zelf geland** in plaats van
aan een pakket gegeven.

**`CanonicalRecipeSummary` moest breder.** Pakket 2 heeft `dish_tags` nodig om
op Trending te kunnen filteren; pakket 1 zit in hetzelfde bestand
(`supabaseSocialRepository.ts`) voor `actOnFriendship`. Dat is precies de
botsing waar de les van 7 september over gaat. Daarom is de verbreding vóór het
uitzetten gedaan, in vier bestanden, met de vijf poorten daarna groen:

| Bestand | Wat |
|---|---|
| `src/lib/repository/social/types.ts` | `dishTags: readonly string[]` en `estimatedMinutes: number \| null` op `CanonicalRecipeSummary` |
| `src/lib/repository/social/supabaseRowMapping.ts` | `dish_tags` / `estimated_minutes` op `RecipeRow`, doorgegeven in `toCanonicalRecipe` |
| `src/lib/repository/social/supabaseSocialRepository.ts` | de twee kolommen in `listCanonicalRecipes`' `.select()` |
| `tests/repository/supabaseSocialRepository.test.ts` | de ene literal die dit type bouwt |

**Er wordt niets nieuws blootgesteld.** 0006 geeft SELECT op `recipes` aan elke
geauthenticeerde lezer — PD-014 leunt met zijn hele veiligheidsargument op dat
feit — dus dit verbreedt een projectie *binnen* een rij die de client al mocht
lezen.

Daarmee is `src/lib/repository/**` volledig van **pakket 1**, en pakket 2 komt
er niet meer. De twee bestandslijsten zijn nu echt disjunct.

---

## Taak A — Het vriendschapsverzoek accepteren doet niets

### Het probleem

Fatima's verzoek staat op `/friends/add`. `Accepteren` verandert niets.

### De bewezen oorzaak

**Gemeten, niet geredeneerd**, tegen de lokale stack met de demo-seed en een
echt ingelogde sessie (`POST /auth/v1/token?grant_type=password`), dus met een
echte `auth.uid()` en echte RLS.

De precieze aanroep die de app doet — supabase-js `.upsert(row, { onConflict:
'id' })`, oftewel `POST /rest/v1/friendships?on_conflict=id` met
`Prefer: resolution=merge-duplicates`:

```
{"code":"42501","message":"new row violates row-level security policy for table \"friendships\""}
HTTP 403
```

Dezelfde overgang als een gewone `UPDATE` (`PATCH
/rest/v1/friendships?id=eq.…`) geeft **HTTP 200**, en de rij staat daarna op
`accepted` met een `responded_at`. De trigger `guard_friendship_transition()`
laat het dus toe; die is niet de weigeraar.

Wélke policy weigert, is apart bewezen met twee identieke `insert … on conflict
(id) do update`-statements in psql onder `set local role authenticated` plus
een `request.jwt.claims`-`sub`, allebei in een transactie die is teruggedraaid:

* met de verscheepte `friendships_insert` → `ERROR: new row violates row-level
  security policy for table "friendships"`
* met diezelfde policy tijdelijk verbreed tot alleen `requester_id = auth.uid()
  or addressee_id = auth.uid()` → `INSERT 0 1`, rij op `accepted`

**De oorzaak in één zin:** Postgres toetst bij `INSERT … ON CONFLICT DO UPDATE`
óók de `WITH CHECK` van de **INSERT**-policy op de nieuwe rij, en
`friendships_insert` (0007) laat maar twee vormen toe — `status = 'pending' and
requester_id = auth.uid()`, of `status = 'blocked' and blocked_by =
auth.uid()`. Een accept schrijft `status = 'accepted'` met de ánder als
requester, dus beide takken zijn onwaar.

**Wat daardoor stuk is, en wat niet.** Elke overgang op een BESTAANDE rij
faalt: accepteren, weigeren, opnieuw vragen, en blokkeren van iemand met wie al
een rij bestaat. Een **nieuw** verzoek werkt wél — gemeten: `HTTP 201` — want
dat is een echte INSERT met `status = 'pending'` en jezelf als requester. Dat
verklaart precies wat de eigenaar ziet: je kunt wel iemand toevoegen en niet
antwoorden.

**Waarom hij waarschijnlijk geen foutmelding zag.** `answerRequest`'s `catch`
roept `announce(describeAddFriendOutcome('failed', …))` aan, en die tekst
rendert in de `ScrollView` **bóven** `SectionLabel(VERZOEKEN)`. Wie naar de
verzoekrij is gescrold, heeft de melding buiten beeld staan. Dit is een
gevolgtrekking uit de rendervolgorde en **niet gemeten op een toestel**; het
staat hier omdat het de reparatie raakt, niet omdat het vaststaat.

### De afbakening

De reparatie hoort in **de client**, niet in de policy. `friendships_insert`
zegt: een rij mag alleen ontstaan als een openstaand verzoek van mij, of als
een blokkade door mij. Dat is een veiligheidseigenschap (0007 legt hem
uitvoerig uit) en geen ongemak. Hem verbreden om een upsert te laten slagen is
de policy slopen om de client zijn zin te geven.

`actOnFriendship` weet al of er een rij is — `current` staat twee regels boven.
Splits daarop: `current === null` → `insert`, anders → `update … eq('id',
current.id)`. De `upsert` bestond om één codepad te hebben; het gevolg is dat
het pad dat het vaakst gebruikt wordt nooit heeft gewerkt.

⚠ Bij de `update`-tak: schrijf `requester_id` en `addressee_id` mee. Een
her-verzoek uit `declined` wisselt die twee om, en de trigger bewaakt het PAAR
en niet de twee kolommen apart — dus weglaten breekt die overgang stil.

### Acceptatiecriterium

1. Tegen de lokale stack met de seed, ingelogd als `joost`: `Accepteren` op
   Fatima's rij zet `friendships` `5eed5eed-…-f003` op `accepted` met een
   `responded_at`, en de rij verhuist van `VERZOEKEN` naar `VRIENDEN`. Bewijs
   met een echte HTTP-aanroep; een unit-test alleen bewijst dit niet, want de
   fout zat in Postgres.
2. `Weigeren` zet dezelfde rij op `declined`.
3. Een nieuw verzoek naar een onbekende handle blijft werken. Het werkte al —
   het regressierisico zit in de nieuwe `insert`-tak.
4. `tests/repository/supabaseSocialRepository.test.ts` bewijst dat een accept
   op een bestaande rij **geen** insert-vorm meer stuurt: de nepclient ziet
   `update` en niet `upsert`. Dat is de test die deze bug gevangen zou hebben.

### Wat NIET tot deze taak hoort

* De policy of migratie 0007 aanpassen. Geen nieuwe migratie in deze ronde.
* `removeFriendship` — dat is een `DELETE` onder een andere policy, en niet
  gemeld.
* Ontvrienden, blokkeren of een verzoek intrekken bouwen; `add.tsx`' eigen
  header legt uit waarom die er niet zijn.

---

## Taak B — De terugknop op `/friends/add`

### Het probleem

De eigenaar kan `Terug` op dat scherm soms niet raken. Hij stelt zelf voor het
teken lager te zetten.

### Wat er is nagemeten — en wat daarmee AFVALT

Vier verklaringen die genoemd zijn of voor de hand liggen, zijn gemeten en
kloppen niet:

1. **"`SafeAreaView` mist `edges`."** Waar, en onschadelijk: zonder `edges` is
   de default *alle vier*, dus de top-inset wórdt toegepast. De schermen die
   `edges={['top','left','right']}` meegeven zijn `ranglijst.tsx` en
   `friends.tsx` — **tabschermen**, waar de bottom-edge weg moet omdat de
   tabbalk die al verrekent. `recipe/[mealId].tsx`, `import/paste.tsx`,
   `settings.tsx` en `cook/[mealId].tsx` geven net als `add.tsx` géén `edges`
   mee. `add.tsx` is dus niet de uitzondering maar de regel.
2. **"De hitbox is te klein."** `styles.back` heeft `minHeight` én `minWidth`
   op `spacing.touchTargetMin` = **44**. Dat is de norm.
3. **"Deze header wijkt af."** Nee — byte voor byte hetzelfde als drie andere
   schermen: `flexDirection: 'row'`, `paddingHorizontal: spacing.space3` (12),
   `paddingTop: spacing.space2` (8), met een knop van `minHeight`/`minWidth` 44
   en `justifyContent: 'center'`. Identiek in `recipe/[mealId].tsx:630`,
   `import/paste.tsx:1202` en `settings.tsx:471`. **De bewering in add.tsx'
   eigen header dat dit "to the pixel" gekopieerd is, is waar** — in deze
   codebase het vermelden waard, want dat is vandaag vaker niet zo geweest.
4. **"`router.back()` heeft geen bestemming."** Beide deuren naar dit scherm
   zijn `router.push(ADD_FRIEND_ROUTE)` — `(tabs)/friends.tsx:485` en `:526` —
   dus er staat een echte stapel onder.

Gevolg: **als de hitbox de oorzaak is, mankeren `recipe/[mealId]`,
`import/paste` en `settings` het net zo goed.** Dat is een falsifieerbare
voorspelling en het eerste wat op een toestel getest moet worden.

### Wat nog NIET is vastgesteld

De oorzaak. Wat als kandidaat overblijft, in volgorde van hoe hard het bewijs
is:

* **`SafeAreaProvider` staat zonder `initialMetrics`** (`_layout.tsx:120`).
  `react-native-safe-area-context` beveelt `initialMetrics={initialWindowMetrics}`
  aan juist omdat de insets anders pas ná een native meting binnenkomen: de
  eerste frames renderen met `{0,0,0,0}`. Op een `fullScreenModal` betekent dat
  dat de header een moment op y=8 staat in plaats van op y≈67 — dus in de zone
  van de Dynamic Island — en wie meteen na de push tikt, tikt mis. **Dat past
  op "soms".** Dit is een echt, aanwijsbaar gat in de code; of het DE oorzaak
  is, is niet vastgesteld en mag nergens als vaststaand worden opgeschreven.
* **Het woord in plaats van een teken.** De eigenaar noemt het "pagina terug
  teken"; er staat het woord `Terug` in `typeScale.button`/`textSecondary`.
  Mogelijk zoekt hij een pijl en tikt hij naast het woord.
* **Iets toestelspecifieks** dat geen agent kan zien.

### De afbakening

1. Zet `initialMetrics={initialWindowMetrics}` op de `SafeAreaProvider`. Dat is
   los van deze melding causaal verdedigbaar, en het is één import plus één
   prop.
2. Vergroot het raakvlak van de terugknop met `hitSlop`, en doe dat op **alle
   vier** de schermen die deze header delen — de header is aantoonbaar
   dezelfde, en één scherm repareren maakt de andere drie stil verschillend.
3. Beweeg de rij alleen naar beneden als je kunt zeggen waarom. Zo niet: laat
   hem staan, schrijf op dat het voorstel van de eigenaar een pleister op een
   niet-gevonden oorzaak zou zijn, en zet het als toestelvraag klaar.

### Acceptatiecriterium

* `initialWindowMetrics` staat op de provider en de vijf poorten zijn groen.
* Elk van de vier schermen met deze header heeft hetzelfde vergrote raakvlak:
  `grep -rn "hitSlop" src/app/` toont ze alle vier.
* De maatvoering blijft ≥ 44pt; niets wordt kleiner.
* Er staat nergens in code of document dat de oorzaak gevonden is, tenzij hij
  gevonden is.

### Wat NIET tot deze taak hoort

* Een gedeelde `BackRow`-component maken. Dat is een refactor over acht
  schermen en drie copy-modules; add.tsx' eigen header noemt die
  inconsistentie al en zegt terecht dat hij een eigen beslissing is.
* De navigatievorm (`fullScreenModal`) veranderen.

---

## Taak C — Trending: aanklikbaar en met foto

### Het probleem

Twee dingen die de eigenaar in één zin noemt en die niets met elkaar te maken
hebben.

### Wat er is nagemeten

**(1) Niet aanklikbaar — dat is een vastgelegd besluit, geen bug.**
`KringRow.tsx`' header: *"THE ROW IS NOT PRESSABLE, deliberately. Opening a
canonical recipe from here needs a screen that reads canonical recipes, and no
such screen exists: `/friends/[feedItemId]` resolves a feed item and would
answer a recipe id with 'Dit recept staat er niet meer', which is a lie about a
recipe that exists. … there is no `onPress` prop to pass — the absence is the
contract rather than a gap a caller could fill in."* `BoardRow` in
`ranglijst.tsx` zegt hetzelfde in eigen woorden en noemt PD-014's vierde
voorwaarde erbij.

**De reden is dus niet "vergeten" maar "de bestemming bestaat niet".** Dat is
de echte taak.

**(2) Geen foto — twee onafhankelijke oorzaken, allebei gemeten.**

* **Schermkant, en die is nieuw.** `BoardRowModel` DRAAGT `thumbnailUrl`
  (`leaderboardPresentation.ts:87`), `toBoardRecipe` vult hem
  (`trendingSource.ts:118`), en `BoardRow` in `ranglijst.tsx:344-364` **tekent
  helemaal geen `<Image>`**. Onafhankelijk bevestigd door
  `useThumbnailFallback.ts`' eigen header, die de vier `<Image>`-plekken van de
  app opsomt — `RecipeTile`, `FriendRecipeCard`, `FriendProofCard`, `KringRow`
  — en `BoardRow` niet noemt. De `Iedereen`-scope, die de standaard is, heeft
  dus nooit een foto kunnen tonen. `KringRow` (de `Vrienden`-scope) tekent er
  wél een.
* **Datakant.** `supabase/seed/demo_social.sql:248` noemt `thumbnail_url` niet,
  dus alle acht demo-recepten hebben `null`. Gemeten in de lokale database.

⚠ **En de datakant is niet eerlijk te repareren; dat is een bevinding en geen
tijdgebrek.** `useThumbnailFallback`' header: deze URL's zijn pre-signed en
kortlevend, en `research/13-legal-tos.md` legt vast dat oEmbed lézen mag en
downloaden niet. Een seed kan dus geen duurzame thumbnail dragen: elke
verzonnen URL geeft 403 → monogram, en een gekopieerde afbeelding mag niet.
`DecisionCard`' header pint de regel: *"the monogram, never a broken image and
never a stock placeholder."* **De seed blijft daarom `null`, met de reden
erbij.** De enige manier waarop de eigenaar echte foto's op Trending ziet is
één echt recept importeren.

### Acceptatiecriterium

* Een Trending-kaart met een `thumbnailUrl` tekent die foto, door
  `useThumbnailFallback` heen, met dezelfde monogram-terugval als
  `DecisionCard` en `KringRow` — dezelfde uitdrukking, niet een vijfde spelling
  ervan.
* Op de demo-seed rendert elke kaart het monogram, want alle acht recepten
  hebben `thumbnail_url = null`. **Dat is het goede gedrag en geen gefaalde
  test.** Een criterium dat hier een foto eist, keurt een gezonde functie af.
* Een tik op een kaart opent iets dat over dít recept gaat, of er is geen tik.
  Een `onPress` naar `/friends/[feedItemId]` is uitgesloten: die route
  beantwoordt een recipe-id met "Dit recept staat er niet meer".

C gaat verder samen met D in één pakket; de afbakening staat daar.

---

## Taak D — Trending wordt een scrollfeed

### Wat de eigenaar vroeg

"Zelfde soort ervaring als bij kiezen, maar naar beneden scrollen en er komt
een nieuw recept — zoals instagram met foto's", plus een filter.

### (!) Dit botst met vastgelegde besluiten, en die krijgen een amendement

Zes plekken argumenteren tégen wat hij nu vraagt. Ze zijn geen van alle dom, en
ze worden **geamendeerd met het argument erbij** — niet stilzwijgend
overschreven. Dat is hoe de vriendensuggesties eerder vandaag zijn afgehandeld
en het is de huisstijl van `PRODUCT-DECISIONS.md`.

* **PD-014, voorwaarde 2:** *"The board is finite and says so out loud … a
  bounded top N, no pagination, no infinite scroll, no pull-for-more."*
* **PD-014, voorwaarde 3:** *"Ordered by score, never by recency."*
* **PD-014, voorwaarde 6:** *"No personalisation, ever."*
* **PD-004:** deze app meet op save-to-cook en nooit op dwell time.
* **`DESIGN-SOCIAL.md` §2.4, "Why this is not the 'Ontdekken' surface":** het
  structurele argument is *"the feed cannot exceed what your friends actually
  cook"* — en let op: **dat argument gaat over de Vrienden-tab, niet over
  Trending.** Trendings `Iedereen`-scope is per definitie een lijst van
  vreemden. De helft van de verdediging die op "geen vreemden" leunt geldt hier
  niet en heeft nooit gegolden; wat wél geldt is "niet algoritmisch".
* **`DESIGN.md`** weigert *"an 'Ontdekken' surface of algorithmic strangers"*.

### De voorgestelde scheidslijn — vorm geeft mee, toevoer en ordening niet

**Wat verandert: de VORM.** Van een rijenlijst met rangnummers naar een
verticale kaartenfeed met grote foto's, één recept per kaart, waar je naar
beneden scrolt voor het volgende. Dat is precies wat hij vroeg, en het is een
presentatiekeuze.

**Wat NIET verandert, en dat moet expliciet opgeschreven worden:**

1. **De toevoer blijft eindig en zegt dat.** Dezelfde `LEADERBOARD_MAX_ROWS`
   (25) en dezelfde `buildLeaderboard`. Onderaan staat nog steeds
   `BOARD_END_COPY`. Geen paginering, geen "meer laden", geen pull-for-more.
   Een feed die zichzelf aanvult is een andere beslissing dan een feed die
   zichzelf toont.
2. **De ordening blijft de score.** Nooit recency, nooit een `nieuw`-badge,
   nooit een timestamp in een viewmodel. `trendingSource.ts`' header zegt het
   al en dat blijft waar.
3. **Geen personalisatie.** `rankRecipes` ziet het huishouden niet en dat
   blijft zo. Het filter dat de eigenaar vraagt is een **door de lezer zelf
   gezette** versmalling en geen model dat voor hem kiest — dat onderscheid is
   het hele verschil met PD-014.6 en hoort letterlijk in het amendement.
4. **Elke kaart draagt zijn maker** (PD-007) en zijn bewijs: het cijfer en het
   aantal stemmen. Zonder dat getal is het geen verdict meer maar een
   plaatjesstroom, en dan is er niets over van PD-014's rechtvaardiging.
5. **Elke kaart is een route naar koken**, PD-014's vierde voorwaarde.

**Wat verdwijnt en dus geïnventariseerd moet worden:** het rangnummer, en
daarmee het lezen van "wat staat er nummer 1". Ook de compacte scanbaarheid van
25 regels — een kaartenfeed toont er één tegelijk. Beide zijn echte functies die
verdwijnen; schrijf ze op in het amendement in plaats van ze weg te laten.

### (!) Wat expliciet AAN DE EIGENAAR wordt teruggelegd

**Hoe diep mag de feed?** Op de demo-seed haalt bijna niets de vloer:
`LEADERBOARD_MIN_VOTES = 3`, en van de acht recepten hebben er drie genoeg
stemmen (Romige pasta 4, Kip uit de oven 3, Rode linzensoep 3). De
`Iedereen`-feed is dus **drie kaarten lang**. Instagram-achtig scrollen door
drie kaarten is niet de ervaring die hij beschrijft, en de knop om daar iets
aan te doen — de stemvloer verlagen — verandert de rekenkunde van de ranglijst
en daarmee hoe waar hij is. **Dat is een beslissing van de eigenaar en wordt in
deze ronde niet genomen.** De vorm wordt gebouwd; de vloer blijft 3.

Ter vergelijking, gemeten via PostgREST met een echte sessie: de
`Vrienden`-scope heeft 8 naambare stemmen van Sanne en Bram over **6
verschillende recepten**, want `rankKring` kent geen vloer.

### Het filter

**Welke assen eerlijk zijn.** Een canoniek `recipes`-record draagt `dish_tags`
(0006, geschreven door het extractiemodel bij import) en `estimated_minutes`.
Het draagt **geen** `dish_moods` en **geen** `dish_course`: 0010 en 0017 hebben
die alleen aan `meals` toegevoegd, en 0017 legt uitvoerig uit waarom een
`recipes.course` bewust is afgewezen. Een mood- of gangfilter op Trending zou
dus over een kolom gaan die niet bestaat. Twee assen dus: **gerechttags en
tijd**.

**Hergebruiken, niet een derde implementatie.** GAP-33 waarschuwt hiervoor.
`collectAvailableDishTags` (`src/domain/recipeSearch.ts:330`) leest alleen
`meal.dishTags` en is met één generieke signatuur — `<T extends { readonly
dishTags: readonly string[] }>` — geschikt voor beide werelden, zonder dat een
bestaande aanroeper verandert. Doe dat in plaats van een kopie.

⚠ **Maar `collectSelectableDishTags` is NIET zomaar herbruikbaar**, en dat is
nagemeten: die is generiek over `{ readonly meal: Meal }` en werkt met
`LibrarySearchState`. Trending heeft geen `Meal` en geen `LibrarySearchState`.
Het narrowing-PRINCIPE van LIB-07 moet wél over: de aangeboden chips
herberekenen zich tegen de huidige selectie, en een geselecteerde chip wordt
altijd terug aangeboden zodat een leeg resultaat ongedaan te maken is.

**Eén ontwerpvraag die de uitvoerder zelf beantwoordt en opschrijft:** filteren
ná de top-25-snede geeft een feed die tot nul kan krimpen (kies "curry" en er
blijft niets over van drie kaarten). Filteren vóór de snede vraagt dat je álle
gerangschikte recepten ophaalt in plaats van 25. Kies er één, meet wat hij
kost, en schrijf de reden op.

### De bestemming van een tik

Dit is de blokkade uit taak C en de duurste helft van dit pakket. `KringRow`'
header heeft gelijk: er is geen scherm dat een canoniek recept toont. Drie
routes, en de keuze is aan de uitvoerder mét de reden erbij:

* **A. Geen tik.** Eerlijk, maar de eigenaar vroeg er letterlijk om.
* **B. Naar het bronbericht.** `recipes.normalized_url` staat er; een externe
  link is één regel en `externalLinking.ts` bestaat al. Dit is géén route naar
  koken (PD-014.4) — het is een route de app uit.
* **C. Een echt canoniek receptscherm**, waarvan de handeling "bewaren" is: er
  is een importpad dat van een `recipes`-rij een `meals`-kopie maakt. Dat is de
  enige route die PD-004 en PD-014.4 allebei eert, en ook de duurste.

Bouw C alleen als hij in dit pakket past zonder de rest te verdringen; kies
anders B **met de kosten opgeschreven**, en zet C als eigen regel klaar voor de
longlist. Kies nooit een tik naar `/friends/[feedItemId]`.

### Acceptatiecriterium

1. De `Iedereen`-scope tekent op de demo-seed **drie** kaarten, in
   scorevolgorde, met onderaan `BOARD_END_COPY`. Drie is het juiste getal — het
   is precies het aantal recepten dat `LEADERBOARD_MIN_VOTES = 3` haalt.
2. Elke kaart draagt: de titel van het gerecht, het cijfer met het aantal
   stemmen, de maker, en de foto óf het monogram. Geen datum, geen "nieuw",
   geen badge.
3. Het filter narrowt zijn eigen chips mee, en een geselecteerde chip verdwijnt
   nooit uit de rij.
4. Geen enkele nieuwe module ordent op recency en geen viewmodel op deze route
   draagt een timestamp.
5. `PRODUCT-DECISIONS.md` draagt een amendement bij PD-014 met datum, het
   citaat van de eigenaar, wat is opgegeven en welke weigeringen blijven staan.
   `DESIGN-SOCIAL.md` §2.4 en de betreffende passage in `DESIGN.md` krijgen een
   banner die ernaar wijst.
6. Nieuwe pure logica heeft tests. Schermbestanden onder `src/app/` zijn niet
   importeerbaar door vitest, dus copy en beslisregels horen in een module
   ernaast — `src/components/addFriendCopy.ts` is het patroon.

### Wat NIET tot deze taak hoort

* `LEADERBOARD_MIN_VOTES` of `LEADERBOARD_MAX_ROWS` veranderen. Zie de
  eigenaarsvraag hierboven.
* De Vrienden-tab, `friends.tsx`, of de vriendenfeed.
* Een nieuwe migratie. De twee kolommen die dit pakket nodig heeft staan al in
  `recipes` sinds 0006, en de projectie is al verbreed.
* De seed van foto's voorzien. Zie taak C — dat kan niet eerlijk.

---

## De verdeling in pakketten

Twee pakketten, parallel, met bestandslijsten die na de verbreding hierboven
**echt** disjunct zijn.

### Pakket 1 — Vriend toevoegen (taken A en B)

A en B zijn samengevoegd omdat ze **hetzelfde scherm** zijn: allebei raken ze
`src/app/friends/add.tsx`, en de eigenaar noemt ze in één adem ("op die
pagina"). Ze los uitzetten zou twee agents in één bestand zetten — precies de
fout die deze ronde wil vermijden.

Bestanden: `src/lib/repository/social/supabaseSocialRepository.ts`,
`tests/repository/supabaseSocialRepository.test.ts`,
`src/app/friends/add.tsx`, `src/app/_layout.tsx`,
`src/app/recipe/[mealId].tsx`, `src/app/import/paste.tsx`,
`src/app/settings.tsx`.

### Pakket 2 — Trending (taken C en D)

C en D zijn samengevoegd omdat C **opgaat in** D: als de rijenlijst een
kaartenfeed wordt, is "de rij krijgt een foto en een onPress" geen aparte
wijziging meer maar dezelfde. Ze parallel uitzetten zou twee agents op
`ranglijst.tsx`, `KringRow.tsx` én dezelfde scrollpositie zetten.

Bestanden: `src/app/(tabs)/ranglijst.tsx`, `src/components/KringRow.tsx`,
`src/components/leaderboardPresentation.ts`,
`src/components/kringPresentation.ts`, `src/lib/trendingSource.ts`,
`src/domain/recipeSearch.ts`, `src/fixtures/boardFixtures.ts`, nieuwe modules
onder `src/components/` plus hun tests, en `docs/PRODUCT-DECISIONS.md`,
`docs/DESIGN-SOCIAL.md`, `docs/DESIGN.md`.

**Verboden voor pakket 2:** alles onder `src/lib/repository/` en
`tests/repository/`. Dat is van pakket 1.

### Wat de orkestrator zelf doet

Dit bestand, `docs/LONGLIST.md`, `docs/HANDOVER.md` en `docs/TOESTELTEST.md`.
Geen van beide pakketten schrijft daarin.
