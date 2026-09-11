# Ontdek — het plan

Geschreven op 10 september 2026, op verzoek van de eigenaar. **Dit document
bouwt niets.** Het meet wat er vandaag staat, legt de beslissingen die alleen
de eigenaar kan nemen als vragen voor, en zet daarna pas een volgorde. Er is
in deze ronde geen productiecode, geen migratie en geen component gemaakt.

---

## ⚠ HERZIEN op 10 september 2026, 17:30 — drie vragen zijn beantwoord

Na het eerste schrijven kwamen er drie antwoorden van de eigenaar binnen. Ze
staan verbatim in §0. Twee ervan veranderen de **vorm** van het plan en niet
alleen een keuze erin, en één keert een geschreven weigering om:

| Was | Is nu |
|---|---|
| **O-5** — mede-eters opt-in of opt-out? | **Beantwoord: opt-in.** Zie O-5; O-5b en O-5c zijn erop aangescherpt. |
| **O-2** — welke bewijsvorm wint bij één gebeurtenis met twee kaarten? | **De vraag is geweigerd, niet beantwoord.** Allebei blijven, op twee oppervlakken: feed en explore. Zie §1.3 en O-2. |
| *(bestond nog niet)* | **Volgen komt er:** asymmetrisch, mét een goedkeuringsstap. Dat haalt graaf 2 uit `DESIGN-SOCIAL.md` §9 naar voren en zet een datamodel vóór de feed. Zie O-11 en DEEL IV. |

Wat er per paragraaf herschreven is, staat bij die paragraaf. Waar een eerdere
conclusie is teruggedraaid, staat dat er als zodanig bij; er is niets
weggepoetst.

---

De vijf poorten zijn zelf gedraaid, drie keer, en het verschil tussen die
metingen is zelf een feit dat hier hoort te staan:

- **Vóór het schrijven, 14:34:** typecheck 0, lint 0, `check:functions` 0,
  `check:seed` 0, **3494 tests over 148 bestanden** — exact de uitgangsmeting.
- **Na het schrijven, 14:59:** alle vijf opnieuw 0, maar **3577 tests over 152
  bestanden.**
- **Bij de herziening, 17:23:** alle vijf opnieuw exit 0, **3577 tests over 152
  bestanden** — gelijk aan de meting van 14:59.
- **Na de herziening, 17:55:** alle vijf nogmaals exit 0, **3577 tests over 152
  bestanden**. Deze herziening raakt alleen dit ene Markdown-bestand, dat door
  geen enkele poort gelezen wordt; de meting staat er omdat de huisregel eist
  dat de uitkomst uit de terminal wordt overgeschreven en niet uit een document.

⚠ **Het verschil tussen de eerste twee is niet van dit document.** Er werkte
gelijktijdig iets anders in dezelfde werkmap: ruim veertig gewijzigde
bronbestanden en vier testbestanden die tussen 14:45 en 14:53 zijn aangemaakt
(`tests/sharedRecipePresentation.test.ts`, drie onder `tests/thumbnail/`).
**Om 17:23 is dat tot stilstand gekomen:** de derde meting is gelijk aan de
tweede en `git status` toont dezelfde ongetrackte bestanden zonder nieuwe. Dit
document raakt nog steeds geen enkel bestand onder `src/`, `tests/` of
`supabase/` — het voegt precies één ongetrackt bestand toe, zichzelf.

**Twee van die gelijktijdige wijzigingen raken dit plan rechtstreeks en zijn
hieronder verwerkt:**

1. `src/app/friends/recipe/[recipeId].tsx` bestaat (**207 regels**) en is het
   scherm dat een canonieke `recipes`-rij opent — de bestemming die vier
   bestanden tot vandaag elk in een alinea "bestaat nog niet" noemden. Hij is
   ook werkelijk bedraad: `friends.tsx:522` geeft
   `onOpenCanonicalRecipe={(recipeId) => router.push(\`/friends/recipe/${recipeId}\`)}`.
   Zie §1.1 en §2.2.
2. **De thumbnail-verversing is geland** (`src/lib/thumbnailRefresh.ts` plus
   `src/domain/thumbnail/thumbnailRefreshPolicy.ts` en
   `…RefreshBudget.ts`). Voor dit plan telt er één gemeten zin uit die kop:
   *zeven* componenten renderen een thumbnail via `useThumbnailFallback`, en
   **vier daarvan lezen rijen die dit toestel niet bezit** —
   `FriendRecipeCard`, `FriendProofCard`, `KringRow` en `TrendingCard`. Dat
   zijn precies de vier kaartsoorten die Ontdek erft, en de verse URL wordt
   bewust **niet** teruggeschreven ("er is geen legale schrijfweg"). Een
   samengevoegd oppervlak erft dus vier kaarten waarvan de foto per sessie
   opnieuw opgehaald moet worden, met de budgetpoort die daar nu voor bestaat.

---

## 0. Wat de eigenaar vroeg, en waar dat botst

Eerste ronde, zijn woorden:

> "Bovendien zijn de tabs 'vrienden' en trending\vrienden hetzelfde, ik wil
> dat dit daarom onder trending komt te staan zodat je daar gewoon de feed van
> je vrienden krijgt te zien, ook moet dit hernoemt worden naar ontdek,
> bovenin kan je dan zoeken op vrienden of andere accounts en deze toevoegen,
> of zoeken op naam van een recept of keuken (bv frans, italiaans of aziatisch)
> maar ook op ingredienten. Neem hier een voorbeeld aan hoe tiktok en instagram
> dit hebben gedaan."

Op drie bezwaren:

> **4a:** "ik wil wel een feed, dat is waar we naartoe willen. Je kan eventueel
> dan ook vrienden koppelen met wie je iets hebt gegeten, die krijgen dan een
> melding dat ze met jou recept x hebben gegeten en kunnen het dan ook
> toevoegen aan hun recepten als ze willen. Ze kunnen ook weigeren genoemd te
> worden in het recept als ze het niet met jou hebben gegeten, dan wordt het
> automatisch niet toegevoegd aan hun receptenlijst."
>
> **4b:** "Het gaat om accounts binnen Remy, geen insta of tiktok."
>
> **4c:** "Ik wil dat dit ook een toevoeging wordt wanneer er een recept
> geparsed wordt door de LLM, dit kan altijd nog handmatig worden aangepast als
> dit niet goed gemarkeerd wordt."

**Tweede ronde, 10 september 2026.** Drie antwoorden, verbatim. Ze staan hier
compleet omdat de rest van dit document eraan opgehangen is:

> **Over mede-eters, op O-5:** "dit ben ik eens, je moet eerst toestemming
> geven voordat je naam erbij komt te staan."
>
> **Over de samenvoeging, op O-2:** "Verder denk ik over het samenvoegen van
> de tabs dat je het moet zien als instagram je feed met daarin je gevolgde
> accounts en je explore pagina met daarin allemaal nieuwe en trending dingen
> om te ontdekken."
>
> **Over volgen:** "Ik wil dat je een persoon kan volgen en een melding krijgt
> als iemand dat wil, dan kan je het accepteren en als je wil terugvolgen."

⚠ **Het tweede citaat is geen antwoord op de vraag die O-2 stelde — het lost
hem op door hem te weigeren.** O-2 vroeg *welke van twee kaartvormen overleeft*
bij een gebeurtenis die er twee produceert. Het antwoord is: **allebei, op
verschillende oppervlakken.** Zie §1.3.

⚠ **Het derde citaat keert een weigering om die dit plan in zijn eerste versie
nog expliciet handhaafde.** De eerste versie schreef: *"er komt geen
volgmodel"*, twee keer, als geruststelling. Dat is niet meer waar, en het is de
duurste van de drie beslissingen. Zie O-11.

Vijf verzoeken raken vijf vastgelegde weigeringen. Ze staan hier bij naam,
want ze worden verderop stuk voor stuk teruggedraaid of gehandhaafd, en geen
ervan wordt weggepoetst:

| Verzoek | Wat het raakt | Vindplaats |
|---|---|---|
| Een feed | *"Do not build a feed."* | `DESIGN-SOCIAL.md` §9, slotregel |
| Zoeken op accounts | *"Adding a name search would not be a feature; it would be an enumeration endpoint."* | `src/app/friends/add.tsx`, kop; §4.4; §7 |
| Een melding | *"No push notifications, including for the closed loop. Deferred, not refused."* | `DESIGN-SOCIAL.md` §8 |
| Mede-eters noemen | Toestemming vóór een naam zichtbaar is | `DESIGN-SOCIAL.md` §5, PD-022 |
| **Volgen** | *"**No follower model**, no public profiles, ~~no vrienden-van-vrienden~~, no contact-book upload."* — en §9's groeipad, dat volgen als een **latere** stap beschrijft | `DESIGN-SOCIAL.md` §8, vierde weigering; §9 graaf 2 |

⚠ **Die vierde weigering is al één keer eerder gedeeltelijk omgekeerd, en de
vorm van die omkering is het sjabloon voor deze.** Op 8 september is
`no vrienden-van-vrienden` doorgestreept met een `> **AMENDED 2026-09-08 …**`-
blok eronder dat noteert wat er werkelijk is opgegeven. Diezelfde bullet moet
nu een tweede keer worden geamendeerd, voor `no follower model`, in dezelfde
vorm en op dezelfde plek.

---

# DEEL I — WAT ER GEMETEN IS

Alles hieronder is gegrepd of gelezen op 10 september 2026 op `e3685d2`.
Waar iets níet gemeten kon worden staat dat er als **onbevestigd** bij.

## 1. De twee tabs: tonen ze werkelijk hetzelfde?

**Kort antwoord: gedeeltelijk, en het deel dat waar is, is sinds PD-023
structureel geworden in plaats van toevallig. De eigenaar heeft gelijk over de
naad, maar niet om de reden die hij vermoedt.**

### 1.1 Wat `(tabs)/friends.tsx` vandaag toont — 907 regels

⚠ **Dat getal was 882 om 14:20, 928 om 15:00 en is 907 om 17:23.** De
schommeling komt van de gelijktijdige ronde die hierboven genoemd staat. **De
eerste versie van deze paragraaf schreef 928; die is nagemeten en vervangen.**
Zij verandert één ding aan de inhoud van deze paragraaf: de proof-kaart is
sinds vandaag aanklikbaar. `src/app/friends/recipe/[recipeId].tsx` opent de
canonieke rij via `getCanonicalRecipe`, en zijn eigen kop noemt de klacht die
hem uitlokte — *"ik kan er niet op klikken"* en *"ik kan geen recepten van
vrienden toevoegen"*. Alles wat hieronder over de twee kaartsoorten staat,
blijft gelden; wat verandert is dat er nu een bestemming is.

Eén lijst met **twee kaartsoorten**, gekozen op het identificerende veld
(`isProofCard`, d.w.z. `'recipeId' in card`) en nooit op een tag:

| Kaartsoort | Bron | Bovenschrift | Opent |
|---|---|---|---|
| **Proof** (`FriendProofCard`) | view `shared_cooks` (0009) | `SANNE MAAKTE DIT` | de canonieke `recipes`-rij |
| **Send** (`FriendRecipeCard`) | tabel `recipe_shares` (0009) | `GEDEELD DOOR JORIS` | de meal van de afzender |

⚠⚠ **DE SEND-KAART RENDERT VANDAAG NIET OP ECHTE DATA, EN DE EERSTE VERSIE VAN
DIT DOCUMENT MISTE DAT.** Gemeten in `src/lib/gekooktSource.ts` (niet
gewijzigd door de gelijktijdige ronde, dus dit was al waar toen het plan werd
geschreven): *"Live SEND cards are one step behind them … `listMealsSentToMe`
now returns a friend's meal with its ingredients — that was the missing read —
but `FriendRecipeCardModel.creator` is a whole `Creator`, and a `Creator` is a
CONSENT record (PD-007, `creators.opted_in_at`). A friend's imported meal has
no `creators` row behind it; it has ATTRIBUTION … Until then the live list
shows proof, and the `__DEV__` scenarios carry both kinds."*

**Drie gevolgen die het hele plan raken:**

1. **De "feed"-helft die vandaag echt op een toestel staat, bestaat uitsluitend
   uit proof-kaarten.** Elke uitspraak in dit plan over "drie bronnen" (proof,
   send, kring) beschrijft wat er *gebouwd* is, niet wat er *rendert*.
2. **De tablabel telt wél live sends.** `useUnseenSendCount` leest
   `listSendsToMe` echt, en `countUnseenSends` telt de rijen — dus `Vrienden ·
   2` kan vandaag verschijnen boven een lijst waarin geen enkele send-kaart
   staat. De ongeziene band vuurt niet (`collectUnseenSendMealIds` produceert
   een echte set, maar *"no proof card can match it"*), de label wél. Dat is
   geen ontwerpkeuze maar een naad, en O-1b erft hem.
3. **Wat de send-kaart blokkeert is één typewijziging en geen migratie:** het
   send-model moet een attributie-vorm dragen in plaats van een `Creator`. Die
   wijziging raakt `CreatorAttribution` en het gedeelde receptscherm.
   **Aanbeveling: die wijziging hoort vóór fase 2**, want een samenvoeging die
   een kaartsoort meeneemt die nergens verschijnt, voegt een lege doos samen.

- **Volgorde:** `rankFeedItems` (`src/domain/feed/ranking.ts`) — kookbaarheid,
  nooit recentheid. Ongeziene sends worden vooraan gebandeerd, één keer per
  bezoek, bij het láden en niet bij het renderen (PD-020.1).
- **Voet:** `SuggestionSection` — maximaal drie vriendsuggesties uit
  `suggested_friends()` (0019) — plus de regel `Zoeken op gebruikersnaam`, die
  naar `/friends/add` gaat. Die regel is sinds 8 september **de enige duurzame
  deur** naar dat scherm; de kop van `friends.tsx` waarschuwt daar expliciet
  voor.
- **Geen getal van de vriend.** `shared_cooks` draagt exact twee kolommen
  (`profile_id`, `recipe_id`). Er is geen cijfer, geen tijdstempel en geen
  telling — 0009 noemt een derde kolom in zoveel woorden "a privacy decision
  and not a convenience".

### 1.2 Wat `(tabs)/ranglijst.tsx` vandaag toont — 934 regels

Eén vraag, **twee scopes**, achter een segmented control dat nooit wordt
onthouden en nooit fetcht (beide lijsten komen uit één lees in
`src/lib/trendingSource.ts`):

| Scope | Rangschikking | Vloer | Metaregel |
|---|---|---|---|
| `Iedereen` | `rankRecipes` over álle `recipe_ratings` | `LEADERBOARD_MIN_VOTES = 3`, plus shrinkage naar `LEADERBOARD_PRIOR_VOTES = 5` | "8,72 · 204 stemmen" |
| `Vrienden` | `rankKring` over `namable_recipe_votes` (0016), beperkt tot vrienden | `KRING_MIN_VOTES = 1`, géén shrinkage | "8,5 · Sanne en Joris" |

Sinds 8 september is dit een kaartfeed met foto's plus een filter
(`trendingFilter.ts`: `requiredDishTags` met AND, en een tijdcap). Maximaal
`LEADERBOARD_MAX_ROWS = 25` rijen, geen paginering, geen `onEndReached`.

### 1.3 De overlap, precies

De eigenaar zegt dat de twee hetzelfde tonen. **Wat gemeten is:**

1. **`recipe_ratings` heeft precies één schrijver in productie, en dat is een
   kookmoment.** `rateRecipe` wordt alleen aangeroepen door `castPublicVote`
   (`src/domain/social/publicVote.ts`), en die wordt alleen aangeroepen door
   `src/lib/pendingRating.ts`, dat aan `_layout.tsx` hangt via
   `PendingRatingSheet`. Er is geen los stemcontrol op enig scherm. Dus:
   **elke stem in de kring is een vriend die gekookt heeft** (PD-023).
2. Een vriend die een canoniek recept kookt, een cijfer geeft, en zijn
   kookdelen aan heeft staan, produceert dus **twee rijen tegelijk**: een
   `shared_cooks`-rij (proof-kaart op Vrienden) én een naambare stem
   (kring-rij op Trending/Vrienden). **Zelfde recept, twee tabs, twee kaarten,
   dezelfde gebeurtenis.**
3. De consent-poorten zijn ook al gelijkgetrokken: 0016's twee anti-joins
   zorgen dat een naam bij een stem wordt weggelaten zodra het huishouden dat
   gerecht als meal heeft én `deel deze niet` of de globale schakelaar uit
   staat. Wie geen proof-kaart oplevert, levert dus ook geen kring-rij op.

**Waar ze wél verschillen — en dit is wat een samenvoeging moet dragen:**

| | Vrienden | Trending/Vrienden |
|---|---|---|
| Directe sends (`recipe_shares`) | **ja**, met notitie en afzender | nooit |
| Cijfer van de vriend | nooit | altijd (`8,5`) |
| Vriend kookte maar gaf geen cijfer | proof-kaart | niets |
| Vriend stemde vanaf het bord zonder te koken | niets | kring-rij (0016 laat die naambaar) |
| Ordening | kookbaarheid (`rankFeedItems`) | score (`rankKring`) |
| Vorm | kaart, geen foto-eis | kaartfeed mét foto |

**Conclusie van de meting:** de eigenaar heeft gelijk dat de twee elkaar
dubbelen op precies het geval dat het vaakst zal voorkomen (een vriend kookt
en beoordeelt), en dat die dubbeling voor een lezer niet te verklaren is. Hij
heeft ongelijk dat ze *hetzelfde* zijn: de ene draagt een cijfer en de andere
een pannetje met een notitie erbij.

### 1.3b ⚠ HERZIEN — de meting blijft staan, de conclusie die eruit getrokken werd niet

**De eerste versie van deze paragraaf sloot af met:** *"Een samenvoeging is dus
geen samenvoegen van twee lijsten maar het kiezen van één bewijsvorm per
gebeurtenis."* **Die zin is teruggetrokken.** Hij leidde uit een gemeten
dubbeling een conclusie af die er niet uit volgt, en het antwoord van de
eigenaar maakt dat expliciet:

> "je moet het zien als instagram je feed met daarin je gevolgde accounts en je
> explore pagina met daarin allemaal nieuwe en trending dingen om te ontdekken."

**Wat er van de meting overeind blijft:** alle drie de punten hierboven. De
dubbeling is echt, de consent-poorten zijn echt gelijkgetrokken, en één
kookgebeurtenis produceert echt twee rijen.

**Wat er niet uit volgt:** dat er één weg moet. Twee rijen uit één gebeurtenis
zijn geen duplicaat wanneer ze **twee lezingen voor twee publieken** zijn:

| | **Feed** (de gesloten graaf) | **Explore** (de open graaf) |
|---|---|---|
| Wie het publiek is | mensen met wie je verbonden bent | iedereen, inclusief mensen die je nooit ontmoet |
| Wat er vandaag in Remy op hoort | proof-kaarten (`shared_cooks`) en sends (`recipe_shares`) | de globale ranglijst (`rankRecipes` over álle `recipe_ratings`), plus het zoeken |
| Wat de gebeurtenis daar betekent | *"Sanne maakte dit"* — een persoon | één anonieme stem in "8,72 · 204 stemmen" — een statistiek |
| `DESIGN-SOCIAL.md` §9 | graaf 1 | de kant op van graaf 2 |

**Dezelfde stem van dezelfde vriend draagt op de twee oppervlakken werkelijk
andere informatie**, en dat is niet mijn formulering maar die van PD-018, die
het al had opgeschreven voordat de vraag gesteld werd: *"A stranger's 9,0 and a
friend's 9,0 are not the same information: one is a statistic, the other is
Sanne."*

**De naad zat dus niet tussen de twee tabs, maar dwars dóór één gebeurtenis
heen.** Vandaag staat de proof op Vrienden en het cijfer bij diezelfde
gebeurtenis op Trending. Wat de samenvoeging moet doen is de naad **verleggen**
— van "midden door een kookgebeurtenis" naar "tussen mensen die je kent en
iedereen" — en niet een van beide kaarten opheffen.

⚠ **Wat dat kost, en het is een echte post: `rankKring` verliest zijn
ordenende rol.** De `Vrienden`-scope van Trending is vandaag een lijst
*geordend op score*. Verhuist het vriendbewijs naar de feed, dan ordent
`rankFeedItems` op kookbaarheid en is het cijfer nog decoratie op een kaart. Het
gemiddelde en de stemmersnamen (`buildKringMetaLine`) overleven; de **volgorde**
niet. PD-018 punt 1 t/m 5 gaan over de rekenkunde en die blijft; punt "het
getal dat de lijst ordende" wordt op de feed onwaar en moet in de banner.

⚠ **En één geval valt tussen wal en schip: de vriend die stemde zonder te
koken.** 0016 laat die stem naambaar (het is een aparte anti-join dan de
proof-poort), dus vandaag levert hij een kring-rij en geen proof-kaart.
Verhuist de kring naar de feed als decoratie op proof-kaarten, dan heeft die
persoon geen kaart om op te zitten. Dat is de enige echte rest van de oude
O-2-vraag en hij staat daar met drie eerlijke antwoorden.

### 1.4 Wat vandaag structureel onvindbaar blijft, in beide tabs

`shared_cooks` eist `m.recipe_id is not null`, en `recipes` accepteert sinds
0011 alleen `platform in ('tiktok','instagram','youtube')`. `ImportPlatform`
kent er zes: `tiktok | instagram | youtube | web | text | photo`. Dus **elke
webimport, elk geplakt recept en elke foto-import heeft `recipe_id = null`,
levert nooit cookproof op, nooit een stem, en kan nooit in Ontdek
verschijnen.** `canonicalRecipe.ts` noemt dat zelf "a real product hole and it
stays open until a migration widens the CHECK" — behalve voor `'text'`, dat er
principieel buiten valt omdat er geen URL is om op te dedupliceren.

Dat is de belangrijkste toevoerbeperking van het hele plan en hij staat nergens
in de opdracht. Zie O-8.

### 1.5 Het bestandsprobleem: samenvoegen kan niet door samen te voegen

~~`friends.tsx` is 907 regels en `ranglijst.tsx` is 934. Het plafond is 800, en
er zitten er zeven overheen — **nagemeten om 17:23**, `wc -l` over `src/`:
`import/paste.tsx` 1252, `ranglijst.tsx` 934, `friends.tsx` 907, `types.ts`
894, `cook/[mealId].tsx` 852, `theme/tokens.ts` 830, `friends/add.tsx` 814.
(⚠ De eerste versie schreef hier 928 en 1862; dat waren de getallen van 15:00
en ze zijn vervangen door de nameting. Het aantal bestanden boven het plafond
is onveranderd zeven.)~~

⚠ **ACHTERHAALD — FASE 2 IS GEBOUWD, NAGEMETEN OP 11 SEPTEMBER 2026, `wc -l`
over `src/`: van ZEVEN naar VIER.** `import/paste.tsx` 1252, `domain/types.ts`
941 (was 894 — gegroeid, niet gekrompen), `cook/[mealId].tsx` 852,
`theme/tokens.ts` 830. **Drie bestanden zijn eraf:** `ranglijst.tsx` (934 →
742, het samengevoegde scherm) en `friends.tsx` (907 → 36, nu een
`<Redirect>`) door de ontleding die fase 2 uitvoerde; `friends/add.tsx` (814
→ 799) door werk dat buiten deze fase om plaatsvond en dat dit document niet
bijhoudt.

**Eén bestand van 1841 regels is geen optie.** De samenvoeging is dus per definitie een *ontleding*: presentatie en
beslissingen naar pure `.ts`-modules (het precedent is `gekooktPresentation.ts`
en `importCheckpointPresentation.ts`), en het routebestand terug naar iets dat
rendert. Dat is werk dat sowieso al moest gebeuren en dat hier meelift — maar
het is geen kleine post.

---

## 2. Zoeken over vier assen: wat bestaat er per as?

| As | Bestaat er machinerie? | Waar |
|---|---|---|
| Mensen | **Ja, en er staat een expliciete weigering op** | `profiles`, `findProfileByHandle`, `suggested_friends()` |
| Receptnaam | **Half** — een matcher, geen corpus | `matchesTitleQuery`, geen lees over `recipes` |
| Ingrediënt | **Ja, ongebruikt voor zoeken** | GAP-34's matcher, `recipe_ingredients` |
| Keuken | **Nee. Niets.** | — |

### 2.1 Mensen

**Wat er is:**
- `profiles` is wereldleesbaar voor elke ingelogde gebruiker:
  `create policy profiles_select on profiles for select using (auth.uid() is not null)`.
  0007 verdedigt dat expliciet: *"a handle nobody can look up cannot be
  befriended"*, en verwerpt een vrienden-only-policy als incoherent.
- `findProfileByHandle` doet `.eq('handle', handle)` na normalisatie, en de
  comment eronder zegt waarom: *"Never a `like` or an `ilike`: the handle
  column is unique on its exact value, and a pattern match here would turn an
  identity lookup into a search."*
- `friends/add.tsx` (814 regels) is de enige plek waar een vriendschap kan
  ontstaan. Zijn kop: *"the only thing standing between this app and a user
  directory is that the client offers exactly one way to ask, by exact handle.
  Adding a name search would not be a feature; it would be an enumeration
  endpoint. The sentences that would announce any of the three are swept by
  `tests/addFriendCopy.test.ts`."*
- `suggested_friends(max_rows integer default 12)` (0019) is het precedent voor
  hoe dit project een gevoelige lees wél doet: een `security definer` `sql`
  functie, `stable`, `set search_path = public`, met de grants expliciet
  ingetrokken voor `anon`, die een **telling** teruggeeft en nooit een naam uit
  andermans graaf. Op het scherm staan er maximaal drie rijen.

**Wat dit betekent:** technisch kost een naamzoek niets — de RLS staat het al
toe, elke client met een sessie kan vandaag `select * from profiles` doen. De
weigering is dus **volledig client-side**, en dat is precies waarom hij op
papier moet worden teruggedraaid in plaats van stilletjes overtreden.

⚠ **Onbevestigd:** ik heb niet gemeten of PostgREST op dit project een
rij-limiet afdwingt op `profiles` (`db-max-rows`). Zonder die limiet is de
tabel vandaag al in één request af te tappen. Dat is een feit over de huidige
stand, niet over dit voorstel, en het is de moeite waard om na te kijken los
van Ontdek.

### 2.2 Receptnaam

**De matcher bestaat, het corpus niet.**
- `matchesTitleQuery` (`src/domain/recipeSearch.ts:256`, toegepast op `:267`)
  is diakriet-tolerant via `normalizeTag` — "puree" vindt "Purée". Maar hij
  draait over `Meal`, dus over **de eigen bibliotheek van het huishouden**.
- Er is **geen enkele lees die de canonieke `recipes`-tabel opsomt.**
  `listCanonicalRecipes(recipeIds)` neemt ids; `getCanonicalRecipe(id)` neemt
  er één. Trending komt aan zijn recepten door eerst álle `recipe_ratings` te
  lezen (met een noodrem `BOARD_RATING_ROW_CEILING = 50_000` die gooit als het
  er meer zijn) en dán de ids op te halen. **Recepten zonder stem zijn vandaag
  langs geen enkel pad zichtbaar voor iemand die ze niet zelf heeft.**
- `recipes_select` (0006) geeft élke ingelogde lezer élke rij, dus er staat
  geen policy in de weg. Wat ontbreekt is de query.
- ✅ **Sinds 10 september 14:49 is er wél een bestemming.**
  `src/app/friends/recipe/[recipeId].tsx` rendert één canonieke rij met
  `getCanonicalRecipe`, inclusief `Bewaren` (`useSharedRecipeSave.ts`,
  `SharedRecipeArticle` / `SharedRecipeSaveZone` / `SharedRecipeNoticeState`
  over `sharedRecipePresentation.ts`). Dat neemt een echte post uit fase 3 weg:
  een zoekresultaat hoeft geen nieuw scherm, alleen een nieuwe **lijst**-lees.
  Wat er nog steeds niet is, is die lees — `getCanonicalRecipe` neemt één id.

### 2.3 Ingrediënt

**Alles is er, en GAP-34 heeft de zoekbalk bewust niet gebouwd.**
- GAP-34 (10 september, `5d06b7b`) heeft hele-woord-matching over
  ingrediëntnamen geland: `normalizeIngredientName`
  (`shopping/normalizeIngredient.ts`), `splitIntoWords` en
  `categorizeIngredient` (`ingredientCategories.ts`), samengebracht in
  `matchesDislikeTerm` / `hasDislikedIngredient`
  (`src/domain/dislikedIngredients.ts`). Regel: `boter` raakt `boterhamworst`
  niet, meervoud is een eigen woord, geen synoniementabel.
- De LONGLIST-regel zegt het zelf: *"Niet gedaan: de zoekbalk over
  ingrediënten (het tweede product uit deze rij) — een eigen regel waard, met
  `recipeSearch.ts:61-67` als grens."*
- `recipe_ingredients` (0006) is wereldleesbaar voor ingelogde lezers, dus het
  corpus voor een canonieke ingrediëntzoek bestaat wél — anders dan bij
  receptnaam is hier zowel de tabel als de matcher aanwezig.
- **De grens die `recipeSearch.ts:61-67` trekt en die niet mag sneuvelen:** een
  zoekbalk mag nooit een allergenenpoort worden. *"folding it in here would
  make a search box quietly hide a dish the household deliberately saved."*
  Een dislike sluit uit bij onbekend-houdt-het-gerecht; een allergeen sluit uit
  bij onbekend-sluit-uit. Die twee delen geen predicaat, en een zoekbalk deelt
  met geen van beide.

### 2.4 Keuken

**Nul.** Gemeten met één grep over `src/`, `supabase/`, `tests/` en `docs/`:

- Geen kolom, in geen enkele van de negentien migraties.
- Geen vocabulaire. `dishTags.ts` noemt "italiaans" bij naam als voorbeeld van
  een waarde die het model **moet verliezen**: *"a model that invents
  'italiaans' loses that tag rather than writing it to storage."*
- Geen extractie. `buildExtractionRequest.ts` biedt het model precies één
  gesloten `enum` aan: `DISH_TAG_ENUM`.
- **Er ligt wel gratis data die niemand leest.** `jsonLdRecipe.ts:54` laat
  `recipeCategory`/`recipeCuisine` expliciet liggen — *"that mapping isn't part
  of SRC-01's brief and doing it without a spec would mean inventing one"* — en
  `tests/import/jsonLdRecipe.test.ts:538` spijkert vast dat het onbelezen
  blijft. Voor webimports staat de keuken dus vaak al op de pagina. Maar
  webimports krijgen geen canonieke rij (§1.4), dus die data zou in `meals`
  moeten landen en niet in `recipes`.

De enige plek waar het woord vandaag valt is copy: `ranglijst.tsx:216`,
*"Wat over alle keukens heen het hoogst scoort."* — door WS3 aangemerkt als de
meest eigen zin in de app. Als er een keuken-as komt, wordt die zin
dubbelzinnig.

---

## 3. Keuken als veld: wat de LLM-kant vandaag doet

- **De parse-stap.** `supabase/functions/parse-recipe/` (12 bestanden, 4116
  regels), met het prompt-en-schema-werk in
  `src/domain/import/buildExtractionRequest.ts`. Twee wederzijds uitsluitende
  functies (`report_recipe` / `report_no_recipe`),
  `functionCallingConfig.mode: 'ANY'`, en één gesloten `enum` voor `dishTags`.
  Het model mag niets verzinnen wat niet in de enum staat, en
  `sanitizeDishTags` gooit weg wat er toch uitkomt.
- **Wat het model vandaag níet invult:** `dishCourse`. Dat is een kolom met
  `not null default 'hoofdgerecht'` (0017) die alleen door een mens wordt
  gezet, in `RecipeTaxonomyFields.tsx`. Er is dus al een taxonomie die
  *achteraf* wordt ingevuld en niet door de LLM.
- **Waar handmatig corrigeren gebeurt:** `src/app/recipe-edit/[mealId].tsx`
  (765 regels) + `src/components/RecipeTaxonomyFields.tsx`. Die component
  bestaat omdat de twee rijen `recipe-edit` acht regels over het plafond
  duwden. Ze bewerkt **`meals`**, nooit `recipes`.
- **Het schrijfpad naar `recipes` is éénmalig.** `canonicalRecipeStore.ts` doet
  `ON CONFLICT DO NOTHING`, nooit `DO UPDATE`. 0006 zegt het zelf: *"a second
  import of the same URL leaves the stored extraction exactly as the first one
  wrote it … the deliberate answer is a future explicit 're-extract' path"*.
  Dat pad bestaat niet.
- **Er is geen caption bewaard.** `recipes` heeft titel, ingrediënten, stappen,
  tijd, porties, attributie en `dish_tags`, en geen brontekst. Een backfill van
  een keukenveld kan dus **niet** uit opgeslagen data; hij zou ofwel elke
  bron-URL opnieuw moeten ophalen, ofwel het model op titel + ingrediënten
  laten raden — en dat laatste is precies de "estimate" die deze pijplijn
  overal verbiedt.

---

## 4. Mede-eters: wat er ligt en wat er ontbreekt

### 4.1 Het dichtstbijzijnde bestaande object

`recipe_shares` (0009) is een gerichte handeling met vrijwel de juiste vorm:

```
meal_id, sender_profile_id, recipient_profile_id,
note text check (char_length(note) <= 140),
created_at, seen_at, withdrawn_at,
unique (meal_id, recipient_profile_id),
check (sender_profile_id <> recipient_profile_id)
```

RLS: leesbaar voor precies de twee partijen. `seen_at` wordt gezet als de
ontvanger de tab opent — **niet per kaart**, want dat is "the first brick of a
read-receipt system" — en wordt **nooit aan de afzender getoond**.

**Maar een mede-eter is geen send.** Een send is *"ik denk dat jij dit leuk
vindt"*; een mede-eter-koppeling is *"jij was erbij"* — een **feitelijke
bewering over een ander**, die daarna aan een recept hangt dat anderen zien.
Dat is een andere klasse object en het hoort niet op deze tabel gestapeld te
worden.

### 4.2 Wat "toevoegen aan hun recepten" vandaag kost

Dat pad bestaat al en werkt: `buildMealCopy` (`src/domain/social/recipeCopy.ts`,
puur) + `saveRecipeCopy.ts` (de schil) + `getCanonicalRecipe` + `createMeal`.
GAP-32/55 heeft het op 10 september geland.

**Twee harde randvoorwaarden:**
1. Het kopieert alleen een **canonieke** `recipes`-rij. Een handmatig
   ingevoerd of van het web geïmporteerd diner heeft `recipe_id = null` en is
   niet kopieerbaar. Zie §1.4 en O-8.
2. De kopie start op `allergenTagStatus: 'unknown'` met `ingredientTags: []`,
   en Postgres dwingt dat af (`meals_recipe_copy_starts_unverified`, 0006).
   Dat blijft ongewijzigd — een mede-eter erft geen allergeenoordeel van de
   kok.

En één productgevolg dat de opdracht niet noemt: **PD-004a**. *"Everything
saved must eventually be suggested. No bookmark-only option."* Een recept dat
in je lijst belandt, komt in je Kiezen-rotatie. Automatisch toevoegen op grond
van instemming met een naam is dus automatisch iemands avondeten veranderen.
Zie O-6.

### 4.3 Meldingen: wat er is, en wat een melding echt kost

**Gemeten, niet aangenomen:**

- `expo-notifications@57.0.16` staat in `package.json` en als plugin in
  `app.json` (met icoon en kleur). Het wordt geïmporteerd door **precies één
  bestand**: `src/lib/decisionNotification.ts`, en daar via een `await import`
  *binnen* een functie, in een `try` — omdat de package bij evaluatie op
  Android in Expo Go **gooit** in plaats van waarschuwt, en de app daardoor
  niet startte.
- Wat het doet: één **lokale** dagelijkse notificatie op het toestel zelf, met
  een vaste identifier, cancel-dan-schedule. GAP-30's argument: de
  beslissingsinputs verlaten de telefoon niet, dus een server zou de allergenen
  van een huishouden moeten krijgen om te kunnen zeggen wat er te eten is.
- **Remote push bestaat nergens.** `push_tokens` heeft sinds 0001 een tabel,
  een index en drie policies, en **geen enkele schrijver** — gegrepd over
  `src/` en `tests/`: nul treffers buiten twee comments.
- **De melding die vandaag wél werkt is geen notificatie maar een label.**
  `useUnseenSendCount` leest `listSendsToMe` één keer per identiteit en zet
  `Vrienden · 2` in de tablabel. De kop van die hook is een expliciet verbod:
  *"IT DOES NOT POLL, AND IT MUST NOT … A realtime subscription on
  `recipe_shares` would be one line, and it would turn this into the thing
  PD-004 measures against. Do not add one."* Het getal zit ín de labelstring en
  is geen badge: geen kleur, geen stip, geen animatie.

**Wat een melding voor een mede-eter dus realistisch kost, in drie prijzen:**

| Vorm | Wat het kost | Wat het opent |
|---|---|---|
| **A. Telling in het tablabel** (`Ontdek · 1`) | Vrijwel niets: één lees erbij in een bestaande hook-vorm, één copy-functie. Geen migratie voor de melding zelf, geen permissie, geen server. | Niets. Blijft binnen §8. |
| **B. Lokale notificatie bij openen** | Klein, maar **oneerlijk**: `decisionNotification` plant op een klok, niet op een gebeurtenis. Een gebeurtenis-melding die pas afgaat als je de app opent, is geen melding. | Verwarring. Afgeraden. |
| **C. Echte push** | Een Edge Function die op een insert reageert, `push_tokens` schrijven (nul schrijvers vandaag), een permissievraag, Expo's push-service, en een development build — `expo-notifications`' remote helft is uit Expo Go verwijderd sinds SDK 53, en OPS-02 zegt dat er geen development-build-pijplijn is. | §8's uitgestelde beslissing, in zijn geheel: *"The first push this product sends should be its best one, and that argument deserves its own day."* |

**Aanbeveling van dit plan: A, en C als een eigen beslissing op een eigen dag.**
Een mede-eter-uitnodiging is per definitie iets dat kan wachten tot je de app
opent; het is geen brandalarm en het is geen bericht.

### 4.4 Wat er ontbreekt en niet met bestaande stukken te maken is

1. **Een object dat een claim over een derde draagt.** Niet `recipe_shares`.
2. **Een toestemmingstoestand met drie waarden** (gevraagd / bevestigd /
   geweigerd) — het product kent er vandaag geen enkele van deze vorm behalve
   `friendships.status`, dat een goede vorm heeft en een
   `guard_friendship_transition()`-trigger die illegale overgangen weigert. Dat
   is het precedent om te kopiëren.
3. **Een view die de naam pas prijsgeeft als de toestand `confirmed` is.**
   Precedent: `namable_recipe_votes` (0016) doet exact dit voor stemmen, met
   twee anti-joins.
4. **Een tijdsbegrip.** `shared_cooks` draagt bewust geen tijdstempel. "Wij aten
   dit samen" impliceert een gelegenheid. Zie O-7.

---

# DEEL II — DE OMKERING, SCHRIFTELIJK

Deze repo draait beslissingen schriftelijk terug en verwijdert het argument
nooit: PD-021, PD-022 en PD-023 dragen alle drie een banner in dezelfde vorm —
*What is reversed / What is bought / What is spent / What is not reversed* — en
`DESIGN-SOCIAL.md` §5 en §8 gebruiken doorstreepte tekst met een
`**(AMENDED, datum: …)**`-blok eronder.

Wat hieronder staat is de **conceptrekst** voor die banner. Hij is geschreven
om ongewijzigd in `PRODUCT-DECISIONS.md` geplakt te worden zodra de eigenaar de
open beslissingen in Deel III heeft beantwoord — de plekken waar dat nodig is,
zijn gemarkeerd.

---

## Concept PD-024 — Omgekeerd: Remy krijgt een feed én een explore, ze heten samen Ontdek, en de graaf wordt asymmetrisch

⚠ **HERZIEN op 10 september 17:30.** De eerste versie van deze banner heette
*"de twee sociale tabs worden één oppervlak"* en beloofde in twee alinea's dat
er *"geen volgmodel"* kwam. Beide zijn achterhaald door twee latere antwoorden
van de eigenaar. Wat hieronder staat is de vervangende tekst; de teruggetrokken
beweringen staan er als zodanig bij.

**Beslissing van de eigenaar, 10 september 2026, in zijn eigen woorden — drie
citaten, want het is één besluit in drie stappen:**

*"ik wil wel een feed, dat is waar we naartoe willen."* En: *"de tabs 'vrienden'
en trending\vrienden [zijn] hetzelfde … dit moet hernoemt worden naar ontdek."*
En, op de vraag wat dat samengevoegde ding dan is: *"je moet het zien als
instagram je feed met daarin je gevolgde accounts en je explore pagina met
daarin allemaal nieuwe en trending dingen om te ontdekken."* En: *"Ik wil dat je
een persoon kan volgen en een melding krijgt als iemand dat wil, dan kan je het
accepteren en als je wil terugvolgen."*

**Wat er omgekeerd wordt — nu drie zinnen in plaats van één.**

1. `DESIGN-SOCIAL.md` §9's slotregel: *"⚠ Do not build a feed. Strava's feed is
   its weakest surface. Remy has the recipe as a natural key, and that is
   precisely what feeds are a surrogate for."* Niet meer geldig.
2. §8's vierde weigering, voor de tweede keer geamendeerd: *"**No follower
   model**, no public profiles, ~~no vrienden-van-vrienden~~, no contact-book
   upload."* Het volgmodel gaat eruit; **publieke profielen en de
   contactenupload blijven staan, allebei**, en dat is niet vanzelfsprekend:
   een volgmodel maakt van "wie mag ik volgen" een vraag die om een
   profielpagina en een adresboek schreeuwt. Het antwoord op allebei blijft
   nee.
3. §9's groeipad zei dat graaf 2 een **latere** stap is en dat *springen* de
   fout is. Er wordt gesprongen, met opzet, op verzoek. Zie "de drie grafen".

Verder: `DESIGN.md` §Navigation's vier tabs worden er [**drie of vier — zie
O-1**]. §8's *"No fifth tab"*-regel wordt in geen van beide uitkomsten
overtreden: er komt er nooit een bij. Bij O-1's optie A gaat er een weg; bij
optie B blijven het er vier met de naad op een andere plek.

**Wat er gekocht wordt, en het is minder dan het lijkt — voor de samenvoeging.**
De twee oppervlakken die worden samengevoegd waren al meetbaar dubbel. Sinds
PD-023 heeft `recipe_ratings` precies één schrijver — `castPublicVote`,
aangeroepen vanuit `src/lib/pendingRating.ts` en nergens anders — dus élke stem
in de kring is een vriend die gekookt heeft. Een vriend die een canoniek recept
kookt en beoordeelt levert vandaag tegelijk een `shared_cooks`-rij (proof-kaart
op Vrienden) en een naambare stem (kring-rij op Trending/Vrienden) op. Dezelfde
gebeurtenis, twee tabs, twee kaarten, en geen enkele plek waar aan een lezer
wordt uitgelegd waarom.

⚠ **Maar de conclusie die de eerste versie hieraan verbond, is teruggetrokken.**
Die luidde: *"Het samenvoegen verwijdert dus een dubbeling die er is."* Dat is
maar de helft. De twee kaarten verdwijnen niet; ze verhuizen naar de twee
oppervlakken waar ze thuishoren (§1.3b). Wat er werkelijk verdwijnt is de
**naad dwars door één gebeurtenis heen**, en wat ervoor terugkomt is een naad
tussen **mensen die je kent** en **iedereen** — precies de scheiding die
PD-018 al maakte tussen `rankKring` en `rankRecipes`, nu op oppervlakteniveau
in plaats van op scopeniveau.

**Wat er gekocht wordt bij het volgen, en dat is véél meer dan het lijkt.** Een
volgmodel is niet één tabel erbij. `is_friend_of()` is de tweede
RLS-predikaat van dit product naast `is_household_member`, en er hangen vier
serverobjecten aan (`shared_cooks`, `recipe_shares_insert`,
`can_read_shared_meal`, plus `suggested_friends()`' uitsluitingen) en zes
clientaanroepen van `listFriendships`. Elk van die tien moet opnieuw beslissen
wat "vriend" gaat betekenen. Zie O-11 voor de meting en de aanbeveling.

**Wat er wordt uitgegeven, als kostenpost en niet weerlegd.** §9's argument
tegen een feed is niet weerlegd; het is overruled. Het argument luidde dat Remy
het recept als natuurlijke sleutel heeft en dat een feed daar een surrogaat voor
is. Dat blijft precies zo waar als het was. Wat er verandert is dat de eigenaar
het oppervlak wil dat de sleutel *toont*, en accepteert dat het daarmee op een
feed gaat lijken. Zie de drie grafen hieronder voor wat daarvan precies
sneuvelt.

**Wat er níet omgekeerd wordt** (en dit is de helft die het verschil maakt
tussen dit besluit en een generieke feed):

- **PD-004 staat.** Deze oppervlakken worden gemeten op save-to-cook, nooit op
  dwell time. Geen sessieduur, geen scrolldiepte, geen tijd-in-app als doel.
- **PD-014's zes voorwaarden staan**, en de zesde — *"no personalisation,
  ever"* — wordt door de feed/explore-splitsing **scherper in plaats van
  zwakker.** ⚠ De eerste versie schreef hier dat die voorwaarde *"degene is die
  een feed het snelst verliest"*; dat is met de Instagram-vorm niet meer waar,
  en de herziene formulering is:
  - **Explore blijft onpersoonlijk, letterlijk.** `rankRecipes` leest een
    lijst die het huishouden nooit ziet, en dat blijft byte-voor-byte het
    object dat PD-014 beschermt.
  - **De feed is per definitie persoonlijk** — hij bestaat uit de mensen die
    je volgt — en dat was hij vandaag ook al (`shared_cooks` self-gate op
    vriendschap). Wat verandert is dat die twee eigenschappen nu op twee
    **oppervlakken** zitten in plaats van achter één schakelaar op de tab van
    het beschermde object. PD-018 noemde dat laatste zelf al een risico: *"a
    shared constant is how one list quietly starts behaving like the other."*
  - **De grens die dus hard moet blijven:** niets uit de feed mag de ordening
    van explore raken, en explore mag nooit worden bijgevuld uit de feed. Dat
    is §8's "geen opvullen van de kring", omgedraaid, en het verdient een test.
- **Eindig, en zegt dat.** Geen paginering, geen `onEndReached`, geen
  pull-for-more. `LEADERBOARD_MAX_ROWS = 25` blijft staan tot open vraag K
  beantwoord is.
- **Nooit op recentheid geordend.** Geen tijdstempel op een kaart, geen
  "nieuw"-badge.
- **§8's weigeringen staan alle tien**, en waar dit voorstel eraan schuurt
  staat dat in Deel V bij naam.

**Afgewezen alternatief, vastgelegd.** *De twee tabs laten staan en de dubbeling
met copy uitleggen.* Verworpen omdat een uitleg over waarom hetzelfde diner op
twee plekken staat een uitleg is over de architectuur, niet over het eten. En
omdat het niet is wat de eigenaar vroeg.

---

## De drie grafen: wat sneuvelt, wat blijft

`DESIGN-SOCIAL.md` §9 beschrijft een groeipad — **gesloten graaf → open graaf,
nog steeds afgeleid → gecomponeerde inhoud** — en de kernstelling is dat
*springen* de fout is. Dit voorstel springt. Eerlijk uiteengelegd:

### Wat overeind blijft

1. **De inhoud blijft een bijproduct.** Niemand componeert iets voor Ontdek.
   Elke kaart komt uit een kookgebeurtenis (proof), een cijfer bij zo'n
   gebeurtenis (kring, en sinds PD-023 is dat dezelfde gebeurtenis) of een
   gerichte handeling (send). Dat is de hele Strava-analogie en die is
   ongeschonden. Het blijft **low effort**.
2. **Het recept blijft de natuurlijke sleutel.** Ontdek rangschikt recepten,
   geen mensen. ⚠ **De rest van deze regel is teruggetrokken.** Hij luidde:
   *"Er komt geen volgmodel, geen profielpagina, geen makersfeed."* Er komt wél
   een volgmodel (O-11). Wat blijft staan is de kern: **er wordt nooit een
   mens gerangschikt.** Geen volgerstelling, geen "populairste koks", geen
   profielpagina en geen makersfeed. Volgen is een **poort** die bepaalt wiens
   kookgebeurtenissen je ziet, en nooit een **score** op een persoon.
3. **De toevoer blijft begrensd door arithmetiek.** De vriendenhelft kan niet
   groter zijn dan wat je vrienden werkelijk koken. De globale helft is
   begrensd door de stemvloer en de rijencap.
4. **Wat §9 "het ontbrekende stuk" noemt, blijft ontbreken en wordt niet
   geleend.** *"je maakte dit 6 keer, je gaf het gemiddeld een 8,2"* op het
   receptscherm — Strava's segmentgeschiedenis — is nog steeds niet gebouwd, en
   dit voorstel bouwt het niet. Dat is de moeite waard om te noteren, want het
   is het goedkoopste stuk van de Strava-analogie en het wordt door een feed
   niet vervangen.

### Wat sneuvelt

1. ⚠ **HERZIEN — graaf 2 wordt niet overgeslagen maar naar voren gehaald, en
   dat is duurder dan overslaan.** De eerste versie schreef hier: *"§9's tweede
   stap is asymmetrisch volgen bovenop wederzijdse vriendschap, en dat is
   nadrukkelijk **niet** wat hier gebouwd wordt — er komt geen volgmodel."*
   **Dat is precies wat er nu wél gebouwd wordt**, op verzoek van de eigenaar,
   en §9 beschrijft het letterlijk als graaf 2: *"Asymmetric following on top
   of mutual friendship, creators first."*

   **Wat de sprong werkelijk kost, eerlijk uiteengelegd:**
   - **§9's these is dat de VOLGORDE het dure deel is** (*"order is the part
     that is expensive to get wrong"*). Die these wordt niet weerlegd; er wordt
     overheen gestapt. Dat is een besluit van de eigenaar en het is
     legitiem — maar het argument blijft staan en wordt hier niet weggepoetst.
   - **Wat de sprong verzácht, en dit is niet niets: de eigenaar vroeg om een
     goedkeuringsstap.** *"een melding krijgt als iemand dat wil, dan kan je
     het accepteren."* Een volgmodel mét toestemming is geen open graaf; het is
     een **gerichte graaf met een poort per persoon**. Dat is dichter bij
     graaf 1 dan bij graaf 2, en het is wat de hele consent-redenering van §5
     overeind houdt (zie O-11).
   - **Wat §9 als middel voor stap 2 noemde, wordt niet gebouwd:** *"lijsten
     waar je in kunt komen"* ("onder 20 minuten", "wat je in huis hebt"). Dat
     was de discovery-vorm die §9 aanraadde om de feed te vermijden. Hij komt
     niet in de plaats van de feed en hij komt er ook niet naast. **Dat is de
     goedkoopste weggelaten helft van het groeipad en hij hoort op de
     LONGLIST.**
   - **De mensenzoek is nog steeds een aparte sprong** (O-4). Volgen zegt wat
     je met iemand kunt doen zodra je hem gevonden hebt; zoeken zegt hoe je hem
     vindt. Ze worden hier expres niet aan elkaar geknoopt — fase 6 blijft
     achteraan.
2. **De keuken-as is een discovery-as en geen kookbaarheids-as.** Elke as die
   dit product tot nu toe kent — `dishTags`, `dishMoods`, `dishCourse`, tijd —
   beantwoordt "kan ik dit vanavond maken". "Frans" beantwoordt "waar heb ik zin
   in". Dat is een legitieme vraag en het is een *andere* vraag, en het is de
   eerste as die niet naar Kiezen terugvoert.
3. **De eerlijke metriek verandert niet, maar wordt moeilijker af te lezen.**
   §9: *"de eerlijke metriek is niet DAU maar de closed-loop rate"*. Die blijft
   de juiste metriek. Maar met een zoekbalk erbij komen er saves binnen die niet
   uit een send komen, en de noemer van die breuk wordt daarmee troebel.
   **Dat is meetbaar te houden**, en dat is de moeite waard vóórdat het
   oppervlak er is: leg vast dat een save herkomst draagt (send / proof / kring
   / zoek), zodat de closed-loop rate over sends apart afleesbaar blijft.
   Vandaag draagt een save die herkomst niet — gemeten: `saveIntent.ts` en het
   `saves`-pad kennen geen herkomstveld. Zie O-9.
4. **§9's derde graaf komt dichterbij zonder dat er iets voor gebouwd wordt.**
   Een mede-eter-koppeling is een sociale handeling *bovenop* een kook, niet
   eronder. Dat is de eerste keer dat er iets aan een recept hangt dat geen
   afgeleid feit is.

---

# DEEL III — DE OPEN BESLISSINGEN

Deze kan alleen de eigenaar nemen. Elke vraag heeft opties met een prijs. Er
staat bij welke keuze dit plan zou aanraden en waarom, maar de aanbeveling is
geen antwoord.

⚠ **HERZIEN — drie van de elf zijn dicht.** Ze staan hieronder op hun plek, met
✅ in de kop, het citaat en de datum erbij, en de redenering eronder ongewijzigd,
zodat niemand ze opnieuw opengooit:

| | Stand |
|---|---|
| **O-2** (welke bewijsvorm wint) | ✅ Beantwoord door de vraag te weigeren. Rest: O-2b en O-2c staan nog open. |
| **O-5** (mede-eters opt-in of opt-out) | ✅ Beantwoord: opt-in. O-5b en O-5c zijn erdoor gesloten. |
| **O-11** (komt er een volgmodel) | ✅ Beantwoord: ja, asymmetrisch, mét goedkeuring. Rest: O-11b's vorm is een aanbeveling en nog geen besluit. |

⚠ **TWEEDE HERZIENING, 10 september 2026, ~18:20 — vier van de acht resterende
zijn dicht, en fase 0 en fase 1 zijn daarmee ontgrendeld.** Ze staan hieronder op
hun plek met ✅ in de kop:

| | Stand |
|---|---|
| **O-1** (één tab of twee) | ✅ **A: één tab `Ontdek`, drie tabs totaal.** O-1b mee: de telling wordt één regel, niet een labelsuffix. |
| **O-3** (keuken gesloten of vrij) | ✅ **A: gesloten set, één waarde, `text null`.** Gebouwd in fase 4, niet nu. |
| **O-9** (herkomst op een save) | ✅ **Ja, en nu.** Gebouwd in fase 0. |
| **O-11b** (vorm van het volgmodel) | ✅ **R2: `follows` wordt DE graaf**, mét blokkeren als eigen object eerst. |

~~**Nog open, en geen ervan blokkeert fase 0 of fase 1:** O-2b, O-2c, O-4, O-6, O-7,
O-8, O-10. Fase 2 wacht op O-2b en O-2c; fase 3 op O-8 (en op open vraag A in
`OPEN-BESLISSINGEN.md`); fase 4 op O-10; fase 5 op O-6 en O-7; fase 6 op O-4.~~
⚠ **Achterhaald — zie de DERDE HERZIENING hieronder: O-2b en O-2c zijn dicht,
en fase 2 is inmiddels gebouwd en wachtte dus nergens meer op.**

⚠ **DERDE HERZIENING, 11 september 2026 — O-2b en O-2c zijn dicht, en fase 2
is gebouwd.** Ze staan hieronder op hun plek met ✅ in de kop:

| | Stand |
|---|---|
| **O-2b** (de vriend die stemde zonder te koken) | ✅ **A: hij verdwijnt van de feed en telt alleen mee in explore's globale gemiddelde.** Optie B — de derde kaartvorm — blijft genoteerd als `ONT-02` op de LONGLIST. |
| **O-2c** (wat blijft er over van de `Iedereen | Vrienden`-schakelaar) | ✅ **A: hij blijft, en schakelt voortaan tussen oppervlakken, met de woorden `Vrienden | Ontdekken`.** ⚠ De eigenaar koos expliciet dat `ranglijst.tsx:216` — *"Wat over alle keukens heen het hoogst scoort."* — letterlijk blijft staan op de explorekant. |

**Nog open, en geen ervan blokkeert fase 2:** O-4, O-6, O-7, O-8, O-10. Fase 3
wacht op O-8 (en op open vraag A in `OPEN-BESLISSINGEN.md`); fase 4 op O-10;
fase 5 op O-6 en O-7; fase 6 op O-4.

---

## O-1. ✅ BEANTWOORD op 10 september 2026 — één tab `Ontdek`, drie tabs totaal

**Antwoord van de eigenaar: optie A.** `Kiezen | Mijn recepten | Ontdek`. De vierde
tabpositie komt vrij en blijft vrij. De redenering hieronder blijft integraal staan,
de prijs inbegrepen: dit rekt `DESIGN.md` §Navigation's regel op, en de struikeldraad
naar B — post op de feedkant — is genoteerd in PD-024 en in DESIGN.md's banner.
**O-1b is meebeantwoord met de aanbeveling die er stond:** de telling gaat naar één
regel bovenaan Ontdek, via het bestaande `PendingRequestsLine`, en niet naar het
tablabel.

### De oorspronkelijke vraag, en de afweging die tot A leidde

⚠ **HERZIEN.** De eerste versie stelde alleen de tweede helft van deze vraag,
omdat hij ervan uitging dat de samenvoeging één lijst opleverde. Met feed én
explore is de eerste helft de echte vraag. ~~En de eigenaar heeft hem **niet**
beantwoord:~~ ⚠ achterhaald op 10 september 2026 — hij heeft hem alsnog
beantwoord, zie de kop van deze vraag. Wat waar blijft: hij zei "hernoemen naar
Ontdek" (één ding) en beschreef vervolgens twee oppervlakken. Bij Instagram zijn
het twee tabs, en dat is waarom de vraag gesteld moest worden.

Vandaag: `Kiezen | Recepten | Vrienden | Trending`.

`DESIGN.md` §Navigation legt de regel vast: *"a tab may exist for a distinct
question a household actually asks, never for a distinct kind of content"*, en
sluit af met *"a fifth tab still needs a fifth question, and there isn't one"*.

⚠ **Die regel snijdt hier beide kanten op, en dat moet gezegd worden voordat er
een aanbeveling komt.** *"Wat maakten de mensen die ik volg"* en *"wat is er
nieuw en goed buiten mijn kring"* kunnen heel goed **twee vragen** zijn. Ze
hebben een ander publiek, een andere ordening (`rankFeedItems` op kookbaarheid
tegenover `rankRecipes` op score) en een ander consentmodel. Wie zegt dat het
één tab is, moet uitleggen waarom het één vraag is — en niet andersom.

| Optie | Wat het kost | Wat het oplevert |
|---|---|---|
| **A. Eén tab `Ontdek`, twee oppervlakken achter de schakelaar die er al staat** (drie tabs totaal) | De tab beantwoordt twee vragen, wat de eigen regel oprekt. En O-1b's telling wijst naar een oppervlak waar je eerst naartoe moet schakelen. | De schakelaar bestáát al (`ranglijst.tsx:210-211`), wordt nooit onthouden, fetcht nooit, en is getest. Er komt geen navigatiebegrip bij. De vierde tabpositie komt vrij. Het is letterlijk wat de eigenaar vroeg: één ding dat Ontdek heet. |
| **B. Twee tabs, met de naad verlegd** (vier tabs, evenveel als nu): `Vrienden`/feed = proof + sends + het cijfer; `Ontdek` = de globale lijst + zoeken | Vier tabs blijven vier tabs, dus de eigenaar krijgt de vereenvoudiging niet die hij vroeg. En "Vrienden" is straks een verkeerde naam, want het zijn mensen die je volgt. | Het volgt Instagram letterlijk. Twee vragen, twee tabs, exact volgens de regel. En **het is niet de huidige situatie met andere woorden**: vandaag loopt de naad dwars door een kookgebeurtenis, hier loopt hij tussen twee publieken. |
| **C. Vier tabs, iets nieuws op plek vier** | Er is geen vierde vraag. Een tab vullen omdat er een gat valt, is exact de fout waar de regel tegen geschreven is. | Niets dat dit plan kan verdedigen. |
| **D. Eén tab, één doorlopende lijst zonder schakelaar** | Dit is de opgeheven variant uit de eerste versie van dit plan, en `DESIGN-SOCIAL.md` §2.2 verbiedt gestapelde secties met zoveel woorden. | Niets. Afgevoerd. |

**Aanbeveling: A, met een genoemde afslag naar B.** De redenen, in volgorde van
gewicht, en dit is mijn argument en niet dat van de eigenaar:

1. **De schakelaar is geen nieuw begrip maar een bestaand, verdedigd begrip.**
   PD-018 heeft al vastgelegd waarom twee scopes op één tab mogen staan: ze
   *"selects between two SEPARATE lists rather than re-ordering one"*. Dat
   argument is één-op-één overdraagbaar en wordt door de feed/explore-lezing
   alleen maar sterker, want de twee lijsten worden verder uit elkaar
   getrokken in plaats van dichter naar elkaar toe.
2. **De verdediging voor "één vraag" is te geven en ze is niet gekunsteld:**
   beide oppervlakken beantwoorden *"wat is er buiten mijn eigen keuken?"*, en
   de schakelaar kiest de **bewijsbasis** — mensen die ik ken of iedereen. Dat
   is precies de vorm die vandaag op Trending staat en die de eigenaar zonder
   klacht gebruikt.
3. **Het is omkeerbaar zonder datawijziging.** De twee oppervlakken lezen
   verschillende bronnen, dus B is later een routewijziging en geen migratie.
4. **A maakt de vierde tabpositie vrij** en daarmee blijft de rest van deze
   vraag beantwoordbaar zoals hieronder.

⚠ **De prijs, expliciet: dit rekt `DESIGN.md` §Navigation's regel op.** Eén tab
die twee vragen beantwoordt, is niet wat daar staat. **Noteer daarom de
struikeldraad die het naar B laat kantelen:** zodra de feedkant iets krijgt dat
**geantwoord** moet worden — een volgverzoek (O-11), een
mede-eter-uitnodiging (O-5) — draagt die kant post, en post op een oppervlak
waar je naartoe moet schakelen is post die je mist. **Dat is het moment waarop
het twee vragen zijn en dus twee tabs.** Gezien O-11 en fase 5 is die dag niet
ver weg; wie A kiest, kiest hem in de wetenschap dat B de volgende halte is.

**De tabbalk wordt bij A breder**, en dat is arithmetiek uit `_layout.tsx`'s
eigen gemeten advance widths: die rekent met een slot van `width / 4 - 2 × 5`;
bij drie tabs is dat `width / 3 - 2 × 5`, dus 121,0pt op een 393pt-toestel in
plaats van 88,25pt. `Mijn recepten` (83,85pt) past dan wél, en `Trending
recipes` (103,85pt) ook. Beide verkortingen die `_layout.tsx` documenteert
kunnen terug — als de eigenaar dat wil.

### O-1b. ✅ BEANTWOORD op 10 september 2026 — naar één regel bovenaan Ontdek

**Antwoord: aanbeveling 3, de regel die al bestaat.** `PendingRequestsLine` +
`formatPendingRequests` uit `FriendSuggestionRows.tsx` gaat drie soorten post tellen
(sends, volgverzoeken, mede-eter-uitnodigingen) in één zin met één bestemming. Het
tablabel draagt geen telling meer. Wat het níet mag worden staat hieronder en
verandert niet: geen drie regels onder elkaar, en geen badge met een kleur.

### De vraag, en waarom 3 het werd

De telling is PD-020.1 en is bewust een deel van de **labelstring**, geen badge.

⚠ **Twee metingen die de eerste versie van deze paragraaf niet had, en die de
aanbeveling omdraaien:**

- **De telling is vandaag al los komen te staan van de lijst.**
  `useUnseenSendCount` leest live `listSendsToMe`, maar de live lijst rendert
  geen send-kaarten (§1.1). `Vrienden · 2` boven nul send-kaarten is dus geen
  hypothetisch risico maar de huidige stand.
- **Er komen twee nieuwe soorten post bij, niet één.** Een volgverzoek (O-11,
  "een melding krijgt als iemand dat wil") en een mede-eter-uitnodiging (O-5).
  Samen met de sends zijn dat drie soorten, en ze zijn niet inwisselbaar: één
  ervan vraagt om een **antwoord over een andere persoon**.

Drie eerlijke antwoorden:

1. **`Ontdek · 2`.** Goedkoopst, en de betekenis blijft "er ligt post". Prijs:
   het woord "Ontdek" draagt nu twee dingen — ontdekken en post — en die zijn
   niet hetzelfde. Bij O-1's optie A komt daar bovenop dat de post op het
   oppervlak ligt waar je nog naartoe moet schakelen.
2. **Geen telling meer op de tab; de ongeziene band in de lijst blijft.** Prijs:
   een send die je nooit opmerkt. De hele PD-020.1-redenering was dat post
   waarop je wacht mag worden aangekondigd. En de band vuurt vandaag niet.
3. **Een aparte regel bovenaan Ontdek**, zoals `PendingRequestsLine` vandaag
   voor vriendschapsverzoeken doet. Prijs: één regel meer boven de feed, en
   `friends.tsx` heeft zijn koptekst juist met opzet leeggehaald.

⚠ **Aanbeveling omgedraaid naar 3.** De eerste versie raadde 1 aan *"tenzij O-5
landt"*. O-5 is geland én O-11 erbij, dus de voorwaarde is vervuld. En 3 is
goedkoper dan het lijkt, want **het bestaat al**: `PendingRequestsLine` +
`formatPendingRequests(count)` in `FriendSuggestionRows.tsx`, aangeroepen op
`friends.tsx:485`, met de regel die er in de kop bij staat — *"draws only when a
friendship request is actually waiting, and it is the only accent-coloured
thing on the screen"*. Een volgverzoek is letterlijk hetzelfde soort ding als
een vriendschapsverzoek; hergebruik die regel in plaats van er een tweede naast
te zetten.

Wat 3 dan moet dragen, in één regel en niet in drie: *"3 dingen wachten op je"*
met één bestemming. **Wat het níet mag worden:** drie regels onder elkaar, of
een badge met een kleur. Dat is de grens die PD-020.1 al trok.

---

## O-2. ✅ BEANTWOORD op 10 september 2026 — door de vraag te weigeren

**De vraag luidde:** een vriend kookt shakshuka, geeft een 8,5, deelt zijn
koken. Dat produceert vandaag een proof-kaart (*"Sanne maakte dit"*, geen
cijfer) én een kring-rij (*"8,5 · Sanne"*). Welke van de twee wint?

**Antwoord van de eigenaar, 10 september 2026, letterlijk:**

> "Verder denk ik over het samenvoegen van de tabs dat je het moet zien als
> instagram je feed met daarin je gevolgde accounts en je explore pagina met
> daarin allemaal nieuwe en trending dingen om te ontdekken."

⚠ **Dat is geen keuze uit A t/m D — het is de vaststelling dat de vraag verkeerd
gesteld was.** Er hoeft niets te winnen. De twee kaarten horen bij **twee
publieken**: de proof-kaart bij mensen met wie je verbonden bent (feed), het
cijfer bij de statistiek die iedereen ziet (explore). §1.3b werkt dat uit; de
vier opties hieronder blijven staan omdat drie ervan alsnog nodig zijn voor de
**rest** die de weigering overlaat.

**Wat de weigering NIET oplost, en wat dus wél beslist moet worden.** Op de
feedkant staat na de verhuizing nog steeds één gebeurtenis met twee mogelijke
kaartvormen: de proof-kaart en het naambare cijfer van diezelfde vriend. De
oude opties gelden daar onverkort:

| Optie | Prijs | Winst |
|---|---|---|
| **A. Eén kaart, die beide draagt.** *"Sanne maakte dit · 8,5"* | De proof-kaart draagt vandaag met opzet géén cijfer, en de reden staat in 0009: `shared_cooks` heeft twee kolommen omdat een derde een privacybeslissing is. Een cijfer erbij hoeft die view niet te wijzigen (het cijfer komt uit `namable_recipe_votes`, een andere bron), maar het maakt van "zij kookte dit" "zij vond er dit van", en dat is meer over Sanne dan het product tot nu toe zei. | Eén gebeurtenis, één kaart op de feed. |
| **B. Proof wint; het cijfer verschijnt niet op de feed.** | De feed verliest het enige harde getal dat hij kon dragen. | De proof-kaart blijft exact wat hij is. |
| **C. Alleen het cijfer.** | Wie kookt zonder cijfer te geven, verdwijnt uit beeld — en dat is de meerderheid zolang `PendingRatingSheet` twaalf uur later vraagt en overgeslagen mag worden. | Niets dat die prijs waard is. Afgevoerd. |
| **D. Twee secties onder elkaar op één oppervlak.** | `DESIGN-SOCIAL.md` §2.2 verbiedt dit met zoveel woorden, en `trendingSource.ts` herhaalt het: twee gestapelde secties lezen als één scroll met een kopje erin, en nodigen uit tot bijvullen. | Niets. Afgevoerd. ⚠ Let op dat **feed en explore géén twee secties zijn** — ze staan achter een schakelaar of op twee tabs, nooit onder elkaar. |

**Aanbeveling: A**, met één beperking: het cijfer verschijnt alleen als de
`namable_recipe_votes`-poort de naam toch al vrijgeeft, zodat er geen tweede
consentregel bijkomt. Dit blijft de keuze van de eigenaar — het gaat over wat
een vriend over zichzelf publiceert.

### O-2b. ✅ BEANTWOORD op 11 september 2026 — A: hij verdwijnt van de feed

**Antwoord van de eigenaar: optie A.** De vriend die stemde zonder te koken
verdwijnt van de feed en telt alleen mee in explore's globale gemiddelde. De
aanbeveling hieronder werd letterlijk het antwoord. **Optie B — een derde
kaartvorm ("Sanne gaf dit een 8,5", zonder kook) — blijft genoteerd als
`ONT-02` op de LONGLIST**, voor het moment dat er wél een meting is van hoe
vaak dit voorkomt.

De enige echte rest van de oude vraag. 0016 laat zo'n stem naambaar (de
proof-poort en de stem-poort zijn twee verschillende anti-joins), dus vandaag
levert die persoon een kring-rij en géén proof-kaart. Onder aanbeveling A is er
geen kaart om zijn cijfer op te zetten.

| Optie | Prijs |
|---|---|
| **A. Hij verdwijnt van de feed en telt alleen mee in explore's globale gemiddelde.** | Een naambare stem wordt anoniem. 0016 is er expres voor gebouwd om die stem naambaar te máken; dat werk staat dan deels leeg. |
| **B. Een derde kaartvorm: "Sanne gaf dit een 8,5", zonder kook.** | Een derde kaartsoort op een oppervlak dat er al twee heeft, en `friends.tsx`' kop eist dat kaartsoorten **siblings** zijn en geen `kind`-prop. Het kán, maar het is een echte post. |
| **C. Hij verhuist mee naar explore, met naam.** | Dan draagt explore een naam, en explore is het oppervlak dat per definitie niemands naam draagt (PD-014). Afgevoerd. |

**Aanbeveling: A voor fase 2, B als eigen regel op de LONGLIST.** Reden: hoe
vaak dit voorkomt is onbekend (er is geen productiemeting, zie DEEL VI), en een
derde kaartsoort bouwen voor een geval waarvan de frequentie niet gemeten is,
is precies de volgorde die dit project elders weigert.

### O-2c. ✅ BEANTWOORD op 11 september 2026 — A, met de woorden `Vrienden | Ontdekken`

**Antwoord van de eigenaar: optie A.** De schakelaar blijft, en schakelt
voortaan tussen oppervlakken, met de woorden `Vrienden | Ontdekken`. ⚠ **De
gekozen woorden wijken af van de aanbeveling hieronder** (`Volgend |
Ontdekken`) — dat was een suggestie, geen antwoord. ⚠ **En de eigenaar koos
expliciet dat `ranglijst.tsx:216`'s zin — *"Wat over alle keukens heen het
hoogst scoort."* — letterlijk blijft staan op de explorekant**, waar de
aanbeveling hieronder nog openliet of die zin zou moeten meeveranderen.

**De vraag die de eigenaar niet gesteld heeft en die iemand moet beantwoorden
vóór fase 2.** `ranglijst.tsx:210-211` heeft vandaag
`{ value: 'iedereen' } | { value: 'vrienden' }`, nooit onthouden, nooit een
tweede fetch (beide lijsten komen uit één lees in `trendingSource.ts`).

Als de vriendenkant naar de feed verhuist, zijn er drie eerlijke uitkomsten:

| Optie | Wat er gebeurt | Prijs |
|---|---|---|
| **A. De schakelaar blijft, maar schakelt voortaan tussen OPPERVLAKKEN in plaats van tussen scopes.** `Vrienden` wordt de feed (proof + sends + cijfer), `Iedereen` wordt explore (globale lijst + zoeken). | Precies O-1's optie A. Eén tab, twee oppervlakken, de bestaande control. | De twee kanten zijn nu ongelijksoortig: de ene is een feed, de andere een ranglijst met een zoekbalk. Een segmented control belooft twee varianten van hetzelfde. Dat moet de copy dragen — en dan is `Iedereen | Vrienden` de verkeerde woordkeus. |
| **B. De schakelaar verdwijnt; twee tabs.** | O-1's optie B. | Vier tabs blijven vier tabs. |
| **C. De schakelaar blijft zoals hij is, op explore, met de kring erin.** | Niets verhuist; de feed krijgt alleen de proof-kaarten en de sends. | ⚠ **Dit brengt de dubbeling terug die de hele opdracht wilde wegnemen**: het cijfer van dezelfde kookgebeurtenis staat dan alsnog op het andere oppervlak. Afgevoerd, tenzij de eigenaar de dubbeling bij nader inzien acceptabel vindt. |

**Aanbeveling: A, met nieuwe woorden op de segmenten.** `Iedereen | Vrienden`
beschrijft twee scopes; wat er straks staat zijn twee oppervlakken. Iets als
`Volgend | Ontdekken` zegt wat er werkelijk gebeurt, en sluit aan op O-11's
volgmodel. ⚠ **Dat is copy en dus een eigen beslissing**, en `ranglijst.tsx:216`
(*"Wat over alle keukens heen het hoogst scoort"* — door WS3 de meest eigen zin
van de app genoemd) hangt aan de `Iedereen`-kant en moet meeveranderen of
bewust blijven staan.

---

## O-3. ✅ BEANTWOORD op 10 september 2026 — gesloten set, één waarde per recept

**Antwoord van de eigenaar: optie A.** `src/domain/dishCuisines.ts` met de gesloten
set, een `enum` in het Gemini-schema, een sanitizer aan de ontvangstkant, en
`text null` op de kolom — géén `onbekend`-waarde. Het voorstel van twintig hieronder
is daarmee het startvocabulaire. **Dit wordt in fase 4 gebouwd, niet nu**, en de
backfill-beperking uit fase 4 (geen brontekst bewaard, `ON CONFLICT DO NOTHING`) is
onderdeel van het antwoord: elk bestaand recept houdt een lege keuken.

### De vraag, en de afweging die tot A leidde

De opdracht waarschuwt terecht: *een vrije-tekstveld van een LLM wordt een
rommelbak*. Dit plan bevestigt dat met een meting: `dishTags` is een gesloten
`enum` in het Gemini-schema **plus** `sanitizeDishTags` aan de ontvangstkant, en
`buildExtractionRequest.ts` legt uit dat de enige veldwaarde die vrije tekst mág
zijn — `section` — daarom drie keer in proza verdedigd moet worden, omdat er
geen schema-constraint bestaat die verzinsels tegenhoudt.

| Optie | Prijs | Winst |
|---|---|---|
| **A. Gesloten set, één waarde per recept** (zoals `dishCourse`, 0017) | Iets wat tussen twee keukens valt krijgt de verkeerde of geen. Een lijst met landen is nooit af en nooit neutraal. | Het model kan niet verzinnen. Filterchips zijn eindig en tekenbaar. De hele 0017-redenering is herbruikbaar, inclusief de test die eist dat het vocabulaire geen enkele waarde deelt met `DISH_TAGS`, `DISH_MOODS` en de EU-14. |
| **B. Gesloten set, meerdere waarden** (zoals `dishTags`, 0004) | `['frans','italiaans']` wordt een representeerbare rij. Filters op `dishTags` zijn AND (`exclusions.ts`), dus twee keukens kiezen levert per definitie leeg op — exact de fout die 0017 een eigen kolom gaf om te vermijden. | Fusiongerechten kloppen. |
| **C. Vrije tekst uit de LLM** | Rommelbak: "Italiaans", "italiaans", "Italiaanse keuken", "Noord-Italiaans", "Mediterraan/Italiaans". Filteren wordt onmogelijk; er komt een normalisatietabel die niemand onderhoudt. En het breekt met de enige anti-hallucinatievorm die dit project heeft die werkt. | Niets dat de prijs waard is. |
| **D. Vrije tekst uit JSON-LD, gesloten set uit de LLM** | Twee vocabulaires voor één veld. | De `recipeCuisine` van webpagina's is gratis en vaak juist. |

**Aanbeveling: A**, met deze redenen expliciet:

1. Het precedent is er, getest, en het argument in 0017 is woord voor woord
   herbruikbaar: een keuken is **één feit dat gecorrigeerd kan worden**, geen
   beschrijving die accumuleert. Dat is exact de cardinaliteitsredenering
   waarmee `dish_course` een eigen kolom kreeg in plaats van een plekje in
   `dish_tags`.
2. De set moet **klein** zijn en in het Nederlands, met dezelfde
   normalizeTag-schone vorm die `DISH_TAGS` heeft. Een voorstel om over te
   beslissen (dit is een concept, geen besluit — zie O-3b): `italiaans`,
   `frans`, `spaans`, `grieks`, `mediterraan`, `nederlands`, `duits`,
   `marokkaans`, `turks`, `midden-oosters`, `indiaas`, `chinees`, `japans`,
   `thais`, `vietnamees`, `indonesisch`, `mexicaans`, `amerikaans`,
   `caribisch`, `afrikaans`. Twintig.
3. **Er komt geen `onbekend`-waarde.** Dat is de fout die 0017 expliciet afwees
   (*"It invents a third state the product does not have"*). Een recept zonder
   keuken heeft een **lege** keuken, en dat betekent precies: het model zag geen
   basis. Dat is hetzelfde wat een lege `dishTags` betekent.
   ⚠ Let op: dit is een verschil met `dishCourse`, die `not null default
   'hoofdgerecht'` is omdat "niemand heeft dit geclassificeerd" daar écht
   "hoofdgerecht" betekende. Voor keuken bestaat zo'n eerlijke default niet.
   Dus: **`text null`**, waar `dish_course` `not null default` koos, en de reden
   voor het verschil hoort in de migratie te staan.

### O-3b. Welke lijst? En hoe wordt hij later uitgebreid?

Een keukenlijst is een lijst van culturen en is nooit neutraal. Drie dingen om
over te beslissen:
- **Hoe grof?** "Aziatisch" (de eigenaar noemt het zelf) is een continent;
  "Thais" is een keuken. Beide in één lijst maakt overlap.
  Aanbeveling: één niveau, het keuken-niveau, en géén continenten — behalve
  waar een continentwoord in Nederland de gangbare naam ís (`mediterraan`,
  `midden-oosters`).
- **Uitbreiden kost een migratie?** Nee — het vocabulaire leeft in
  `src/domain/dishCuisines.ts` (net als `dishTags.ts`) en de kolom is vrije
  `text` met een sanitizer ervoor. Een waarde toevoegen is één regel plus het
  model dat hem op de volgende import aangeboden krijgt. Dat is exact hoe
  `dishTags.ts` het beschrijft.
- **Wat gebeurt er met een opgeslagen waarde die uit het vocabulaire wordt
  gehaald?** Aanbeveling: hij blijft staan en verdwijnt uit de filters, net
  zoals `collectAvailableDishTags` alleen aanbiedt wat er echt is.

---

## O-4. Wordt zoeken-op-mensen een zoek of een opzoek?

De weigering in `friends/add.tsx` is scherp: een naamzoek ís een
enumeratie-endpoint. En de RLS staat vandaag al toe wat de weigering
tegenhoudt, dus de weigering is een client-afspraak.

| Optie | Prijs | Winst |
|---|---|---|
| **A. Handle-only, exact** (vandaag) | Niet wat de eigenaar vroeg. Je moet iemands handle al kennen. | Nul enumeratie. |
| **B. Prefix-zoek op handle, via een `security definer` functie met een cap en een minimumlengte** | Wie drie letters intikt krijgt een venster op de gebruikerslijst. Met genoeg pogingen is de tabel af te lopen. Beperkt door de cap, niet verhinderd. | De eigenaar krijgt zoeken. De vorm is bekend (0019), de grants zijn bekend, en het is testbaar. |
| **C. Prefix-zoek op handle én weergavenaam** | Weergavenamen zijn echte namen. Zoeken op "Sanne" levert een lijst mensen die Sanne heten en die daar nooit ja op gezegd hebben. Dit is de stap waar `profiles_select`'s verdediging (*"What is exposed is exactly what a person chose as their public name"*) omslaat van waar naar half-waar: iemand kiest een publieke naam om **gevonden te worden door wie hem kent**, niet om in een naamlijst te staan. | Wat mensen verwachten. |
| **D. B, plus een zichtbaarheidsschakelaar per profiel** (`profiles.discoverable`) | Een migratie, een instelling erbij, en een default die de eigenaar moet kiezen. | De weigering wordt een keuze van de gebruiker in plaats van een productafspraak, wat eerlijker is dan beide uitersten. |

**Aanbeveling: B, met vier randen die bij de bouw hard moeten zijn:**
1. **Minimaal 3 tekens** vóór er iets teruggegeven wordt (de handle-CHECK eist
   er sowieso 3).
2. **Cap van 10 rijen**, zoals 0019 er 12 heeft en er 3 toont.
3. **Prefix, geen infix.** `ilike 'joos%'` en nooit `'%oos%'`; een infix over
   een unieke kolom is een tabelscan én een veel bruikbaarder enumeratie.
4. **Alleen handle, niet `display_name`** — tenzij de eigenaar bewust C kiest,
   en dan hoort dat als een eigen zin in de banner.

En de banner moet noteren wat er verloren gaat: `tests/addFriendCopy.test.ts`
veegt vandaag de copy op zinnen die een naamzoek aankondigen. Die test moet
worden **omgeschreven, niet verwijderd** — hij bewaakt straks de grens tussen
handle-prefix en naamzoek in plaats van de grens tussen exact en niet-exact.

---

## O-5. ✅ BEANTWOORD op 10 september 2026 — genoemd worden als mede-eter is OPT-IN

**Dit was de zwaarste vraag in het document en het antwoord bepaalde of dit een
feature is of een lek.**

**Antwoord: opt-in.** De eigenaar, letterlijk:

> "dit ben ik eens, je moet eerst toestemming geven voordat je naam erbij komt
> te staan."

**Wat dat vastlegt, in de taal van de implementatie:** een naam van een derde is
voor **niemand** zichtbaar behalve de twee betrokkenen totdat de toestand
`confirmed` is. Er is geen venster waarin de naam al staat en weggehaald kan
worden. De handeling die de eigenaar in de eerste ronde *"weigeren"* noemde,
heet vanaf hier **bevestigen**, en niets doen is een geldige, stille weigering.

**Er is geen codewijziging** — er is nog niets gebouwd. Dit staat hier omdat een
vraag die gesteld én beantwoord is, anders over een maand opnieuw gesteld wordt.

**De redenering hieronder blijft integraal staan**, ook al is de vraag dicht:
zij is het argument dat het antwoord draagt, en de opties B en C staan er zodat
niemand ze opnieuw hoeft uit te zoeken.

**Hoe de vraag ontstond.** De eigenaar formuleerde het in de eerste ronde als
opt-out: *"Ze kunnen ook weigeren genoemd te worden."* Weigeren veronderstelt
dat je er al staat.

**Wat de repo hierover al heeft vastgelegd:**
- §5: *"What turning the switch on exposes, exactly: the link between your
  display name and a canonical recipe id."* Dat is precies wat een
  mede-eter-koppeling ook doet — maar over **iemand anders**.
- §5's eerlijke risico: *"a list of named cooks is a dietary pattern."*
  Article-9-nabije inferentie uit niet-Article-9-feiten. Dat risico geldt voor
  een mede-eter net zo hard, en de mede-eter heeft er niet voor gekozen.
- **PD-022 keerde de default om, en dekt dit geval niet.** De omkering geldt
  voor wat een huishouden over **zichzelf** publiceert. De zin die PD-022
  overeind laat is: *"nothing is shared by a migration, ever."* Er is geen zin
  in PD-022 die iemand toestemming geeft over een ander te publiceren.

| Optie | Wat een derde ziet vóór het antwoord | Prijs |
|---|---|---|
| **A. Opt-in.** De naam is voor niemand zichtbaar behalve de twee betrokkenen tot `confirmed`. | Niets. De kaart zegt "Sanne maakte dit", zonder mede-eters. | Wat de eigenaar vroeg heet dan geen "weigeren" maar "bevestigen". De meeste koppelingen zullen nooit bevestigd worden, want mensen antwoorden niet. Het gevoel dat de eigenaar zoekt — *"jullie hebben dit samen gegeten"* — wordt zeldzaam. |
| **B. Opt-out met een venster.** De naam is zichtbaar zodra de kok tagt; de mede-eter kan hem weghalen. | De naam, meteen, voor alle vrienden van de kok. | Een naam die zichtbaar is vóór toestemming is een lek. Het is niet terug te draaien: wat gelezen is, is gelezen. §5 noemt precies dit: *"Already rendered screens on friends' devices cannot be recalled from human memory."* |
| **C. Opt-in voor de naam, opt-out voor het bestaan.** De kaart zegt *"met 1 ander"*; de naam pas na bevestiging. | Een getal, geen naam. | §8 verbiedt *"counts without names"* met zoveel woorden — *"A number with no person attached is engagement dressing"* — maar dat argument gaat over strangertellingen als sociaal bewijs, niet over het bestaan van een openstaande vraag. Het is een echte spanning en hij moet in de banner. |

**Dit plan raadde A aan, zonder aarzeling, en de eigenaar heeft A gekozen.** De
redenen, in volgorde van gewicht, en ze blijven staan als de motivering van het
besluit:

1. **De asymmetrie van de kosten.** Een gemiste bevestiging kost een leuk
   momentje. Een naam die verschijnt bij een gerecht waar iemand niet bij was,
   of bij een gerecht waar hij wél bij was maar dat hij niet met zijn hele
   vriendenkring wil delen (een dieet, een observantieweek — §5's eigen
   voorbeelden), kost iets dat niet terug te nemen is.
2. **Deze repo heeft dit al één keer beslist, in de andere richting, en heeft de
   rekening opgeschreven.** PD-022 haalde één van vijf mitigaties weg en §5
   noteert dat expliciet als *"Five mitigations became four, and the one removed
   was carrying the most weight."* Dat was een besluit over eigen data.
   Datzelfde nog een keer doen over andermans data is niet dezelfde stap.
3. **Het is technisch niet duurder.** `namable_recipe_votes` (0016) doet precies
   dit — een naam pas prijsgeven als een poort dat toestaat — en de view is er
   al als model.
4. **De eigenaar krijgt zijn feature.** *"Weigeren"* wordt *"bevestigen"*, en de
   zin die hij zelf schreef blijft waar: *"dan wordt het automatisch niet
   toegevoegd aan hun receptenlijst."*

⚠ **Optie B is hiermee gesloten.** Wat hij gekost zou hebben, staat hier zodat
niemand hem opnieuw voorstelt: het zou de eerste keer zijn dat dit product iets
over een derde publiceert vóór die derde antwoordde, en de eerste keer dat een
weigering iets moet *terughalen* in plaats van *niet laten ontstaan*.

### O-5b. ✅ GESLOTEN door het opt-in-antwoord — wat ziet de kok in de tussentijd?

**Dit was een halve vraag en is er nu geen meer.** Met opt-in is de tussentijd
per definitie een toestand waarin **niets** over de mede-eter zichtbaar is, en
daarmee ligt het antwoord vast in plaats van dat het gekozen moet worden:

- **De kok ziet dat hij het gevraagd heeft, en niets meer.** Geen "gezien", geen
  "wacht al 3 dagen", geen herinnering-knop. §8: *"No read receipts. 'Gezien'
  creates the obligation to respond."* En `recipe_shares.seen_at` wordt vandaag
  met opzet nooit aan de afzender getoond — dat precedent geldt hier
  één-op-één.
- **Een openstaande vraag verloopt niet en meldt niets.** Stilte is een geldig
  antwoord en moet stil blijven. Er is dus geen timer, geen verval, geen tweede
  melding.
- ⚠ **De enige rest die nog een besluit is, en hij is klein:** ziet de kok
  *hoeveel* mensen hij gevraagd heeft, of alleen dát hij gevraagd heeft? Een
  telling van openstaande vragen op zijn eigen kaart is een telling over
  anderen. **Aanbeveling: alleen op zijn eigen scherm, nooit op een kaart die
  een derde ziet** — dat is dezelfde grens die 0009 trok door `shared_cooks`
  twee kolommen te geven.

### O-5c. ✅ GESLOTEN door het opt-in-antwoord — mag een geweigerde koppeling nog eens gevraagd worden?

**Antwoord: nee, en met opt-in is dat geen keuze meer maar een gevolg.** Onder
opt-out was dit een echte vraag, want daar bestaat "opnieuw vragen" als
herstelpad na een weigering. Onder opt-in is een weigering — inclusief een
stilzwijgende — de toestand waarin de naam nooit heeft bestaan, en opnieuw
vragen is dan **campagne voeren over iemands naam**, wat `DESIGN-SOCIAL.md` §5
bij naam verbiedt.

**De vorm:** `guard_friendship_transition()` (0007) is het precedent. Illegale
overgangen worden door een trigger geweigerd en een `declined` paar wordt niet
opnieuw gesuggereerd. Een geweigerde koppeling is definitief per (meal,
persoon), de rij blijft staan zodat de weigering auditeerbaar is, en er is geen
pad terug — precies zoals `recipe_shares` een teruggetrokken send bewaart in
plaats van hem te verwijderen.

⚠ **Eén verschil met `friendships` dat de bouwer moet weten:** dáár is een
re-request wél legaal (`responded_at` gaat terug op null, requester en
addressee wisselen). Die transitie mag hier **niet** gekopieerd worden. Wie de
trigger overschrijft, moet die ene overgang bewust weglaten en de reden
erbij zetten.

---

## O-6. Betekent "ja" ook "in mijn receptenlijst"?

De eigenaar zei twee dingen die elkaar niet helemaal dekken:

> "kunnen het dan ook toevoegen aan hun recepten **als ze willen**"
> "als ze weigeren … dan wordt het **automatisch niet** toegevoegd"

De eerste zin maakt toevoegen een tweede handeling. De tweede zin suggereert dat
bevestigen en toevoegen één handeling zijn.

| Optie | Prijs |
|---|---|
| **A. Twee handelingen.** Bevestigen zet je naam erbij. Daarna staat er een `Bewaren`-knop, precies dezelfde als op `/friends/[feedItemId]`. | Eén tik meer. |
| **B. Eén handeling.** Bevestigen kopieert het recept meteen. | **PD-004a:** *"Everything saved must eventually be suggested."* Een bevestiging dat je ergens hebt gegeten verandert dan wat Kiezen je morgen voorstelt. Dat is een gevolg dat niemand op dat moment overziet. |
| **C. Eén handeling met een uit te vinken vakje.** | Het OutcomeCard-precedent bestaat (PD-022's kookvinkje), dus de vorm is bekend. Prijs: een tweede vraag op een moment dat er al één gesteld wordt. |

**Aanbeveling: A.** Twee handelingen, en de tweede is de knop die al bestaat.
Reden: `saveRecipeCopy.ts` is al gebouwd, getest en bereikbaar, en PD-004a maakt
een save een uitspraak over je eigen avondeten. De zin van de eigenaar blijft
waar — weigeren voegt niets toe — alleen voegt bevestigen óók niets toe zonder
de tweede tik.

---

## O-7. Draagt een mede-eter-koppeling een tijd?

`shared_cooks` draagt er bewust geen: *"a timestamp turns proof into a feed with
recency"*. Maar "wij aten dit samen" impliceert een gelegenheid.

| Optie | Prijs |
|---|---|
| **A. Geen tijd, net als proof.** De koppeling hangt aan een meal, niet aan een avond. | Twee keer hetzelfde gerecht met dezelfde persoon is één koppeling (de `unique`-constraint van `recipe_shares` heeft dezelfde vorm). Dat klopt meestal en soms niet. |
| **B. Aan de kookgebeurtenis in plaats van aan de meal.** `cook_events` heeft wél een datum en wordt gespiegeld. | Elke keer dat je hetzelfde met dezelfde persoon eet, is een nieuwe vraag. Dat is vaker vragen, en vaker vragen is campagne voeren — §5 verbiedt dat bij naam. |
| **C. A, met een datum die alleen de twee betrokkenen zien.** | Een derde kolom op een consent-object; verdedigbaar want hij kruist geen grens. |

**Aanbeveling: A.** En als de koppeling ooit tijd nodig heeft, is dat C en nooit
B.

---

## O-8. Wat gebeurt er met recepten die geen canonieke rij hebben?

Dit is de stilste maar breedste beperking in het hele plan (§1.4).

Vandaag heeft alleen een TikTok-, Instagram- of YouTube-import een
`recipes`-rij. Web, geplakte tekst en foto niet. Gevolg:
- Ze verschijnen nooit in Ontdek — geen proof, geen stem, geen zoekresultaat.
- Ze kunnen niet gekopieerd worden door een mede-eter (`buildMealCopy` eist
  `recipeId`).
- SRC-07 (foto-import) is op verzoek van de eigenaar gebouwd en levert dus
  recepten op die structureel onzichtbaar zijn voor de hele sociale laag.

| Optie | Prijs | Winst |
|---|---|---|
| **A. Niets doen.** Ontdek dekt drie van zes importroutes. | Een gebruiker die zijn kookboek fotografeert, snapt niet waarom "zijn" recepten er niet zijn. | Nul. |
| **B. De CHECK verbreden naar `'web'`** (open vraag A staat al open en gaat hier precies over) | Een migratie. Web-URL's dedupliceren op `normalized_url`, wat kan. | Vier van zes routes. |
| **C. Een canonieke rij zonder URL toestaan** voor foto en tekst | `normalized_url` is `unique` en is de dedup-sleutel; `canonicalRecipe.ts` betoogt dat `'text'` structureel buiten de tabel valt. Dit vraagt een tweede sleutelbegrip (inhoudshash?) en dat is een eigen ontwerp. | Zes van zes, en een hele nieuwe klasse dedup-fouten. |

**Aanbeveling: B behandelen als een blokkade voor fase 3 en niet als een
optionele verbetering** — open vraag A in `OPEN-BESLISSINGEN.md` stelt hem al en
hij is nog onbeantwoord. C is een eigen ronde.

---

## O-9. ✅ BEANTWOORD op 10 september 2026 — ja, en nu

**Antwoord van de eigenaar: ja, meteen, met vier sociale waarden.** Gebouwd in fase 0
als `src/domain/saveOrigin.ts`. De vocabulaire werd bij de bouw **zes** in plaats van
vier: `send`, `proof`, `kring` en `zoek` zijn de vier die deze vraag noemde, en
`import` plus `bibliotheek` zijn de twee die de bestaande schrijvers nodig hadden —
zonder die twee zou de kolom van dag één een gat hebben op de plekken waar vandaag al
geschreven wordt. Rijen van vóór dit veld dragen `null`, en dat betekent precies "van
vóór de vraag" — de baseline, niet een gok.

### De vraag

Vandaag niet — gemeten: geen herkomstveld op het savepad. §9's eerlijke metriek
(closed-loop rate) wordt door Ontdek verdund omdat er saves gaan binnenkomen die
niet uit een send komen.

**Aanbeveling: ja, en nu, vóór het oppervlak er is.** De baseline bestaat alleen
tot het moment dat dit landt — precies de tijdsgevoeligheid die PD-023 voor
zichzelf noteerde. Vier waarden zijn genoeg: `send`, `proof`, `kring`, `zoek`.
Prijs: een kolom of een veld op een bestaand pad. Dit is de goedkoopste regel in
het hele plan en de enige die duurder wordt door te wachten.

---

## O-10. Waar wordt de keuken bewerkt, en waar wordt hij gezocht?

Een asymmetrie die makkelijk over het hoofd wordt gezien:

- **Gezocht** wordt er in `recipes` — de canonieke, gedeelde rij.
- **Bewerkt** wordt er in `meals` — de eigen kopie. `recipe-edit/[mealId].tsx`
  raakt uitsluitend `meals`; `RemySocialRepository` wordt daar niet eens
  geïmporteerd, en de kop zegt waarom: *"a correction is a private act on a
  household's own row."*

Dus: een gebruiker die een verkeerd gemarkeerde keuken corrigeert, corrigeert
**zijn eigen kopie** en niet wat een ander in Ontdek vindt.

| Optie | Prijs |
|---|---|
| **A. Twee kolommen, twee betekenissen.** `recipes.dish_cuisine` = wat het model zei; `meals.dish_cuisine` = wat dit huishouden zegt. Zoeken leest de eerste, filteren in Mijn recepten de tweede. | Ze kunnen uiteenlopen en dat is dan correct in plaats van fout. Prijs: uitleggen dat een correctie de zoekresultaten niet verandert. |
| **B. Een correctie schrijft ook naar `recipes`.** | Dit doorbreekt het write-once-karakter van `recipes` en geeft één huishouden schrijfrechten op een gedeeld object. `recipes_select` geeft iedereen leesrecht; er is geen updatepolicy en die zou hier verzonnen moeten worden. Eén verkeerde correctie raakt iedereen. |
| **C. Alleen `recipes`, geen kolom op `meals`.** | Dan kan een huishouden een verkeerde keuken nooit corrigeren, wat exact de fout is die `RecipeTaxonomyFields.tsx` in zijn kop beschrijft als *"the most-used filter in the app was wrong about part of every library, and no amount of work on the filter control repairs that; only a writer does."* |

**Aanbeveling: A.** Het is dezelfde vorm die het product al heeft voor
allergenen (canoniek draagt niets, het huishouden tagt zijn eigen kopie), en dat
is geen toeval: het is de scheiding tussen "wat de bron zei" en "wat wij weten".

---

## O-11. ✅ BEANTWOORD op 10 september 2026 — er komt asymmetrisch volgen, mét een goedkeuringsstap

**Antwoord van de eigenaar, letterlijk:**

> "Ik wil dat je een persoon kan volgen en een melding krijgt als iemand dat
> wil, dan kan je het accepteren en als je wil terugvolgen."

**Wat dat vastlegt.** Vier stappen, en de derde is de belangrijkste:
volgverzoek → melding bij de gevolgde → **acceptatie** → optioneel terugvolgen.
Dat is de vorm van een **privé**-Instagram-account, niet van een openbaar
account. Volgen is hier geen eenzijdige handeling maar een **gevraagde en
verleende toestemming**.

⚠ **Dit is de duurste van de drie beslissingen van vandaag, en de eerste versie
van dit plan beloofde twee keer expliciet het tegendeel** (*"er komt geen
volgmodel"*). Die zinnen zijn ingetrokken; zie DEEL II.

### O-11a. Wat er vandaag ligt — gemeten, niet aangenomen

Er bestáát een verzoek-en-accepteer-mechanisme, en het is grondig doordacht.
`friendships` (0007:220-262):

```
requester_id, addressee_id,
status text not null default 'pending'
  check (status in ('pending','accepted','declined','blocked')),
blocked_by, created_at, responded_at,
check (requester_id <> addressee_id),
check ((status = 'blocked') = (blocked_by is not null)),
check (blocked_by is null or blocked_by in (requester_id, addressee_id)),
profile_low  generated always as (least(requester_id, addressee_id)) stored,
profile_high generated always as (greatest(requester_id, addressee_id)) stored,
unique (profile_low, profile_high)
```

Plus: `guard_friendship_transition()` die illegale overgangen weigert, drie
policies (`friendships_select/insert/update`) en een delete-policy die alleen de
blokkerende partij een block laat opheffen. De UI staat er ook al:
`friends/add.tsx` (814 regels), `partitionFriendships`, `PendingRequestsLine` +
`formatPendingRequests` op `friends.tsx:485`.

**Wat er aan mutuele vriendschap hangt — de volledige lijst, gegrepd:**

| # | Wat | Waar |
|---|---|---|
| 1 | `is_friend_of(target)` — het tweede RLS-predikaat van dit product, naast `is_household_member` | `0007:426-443` |
| 2 | `shared_cooks` — de proof-kaarten; de poort staat in de **view body**, niet in een policy | `0009:155` |
| 3 | `recipe_shares_insert` — je mag alleen sturen naar een vriend | `0009:229` |
| 4 | `can_read_shared_meal` — `visibility = 'friends'`-meals, waar `/friends/[feedItemId]` en `listMealsSentToMe` op rusten | `0007:614` |
| 5 | `suggested_friends()` — telt gemeenschappelijke vrienden en sluit iedereen uit met wie je al een rij deelt, in welke status dan ook | `0019:90,105,116` |
| 6-11 | Zes clientaanroepen van `listFriendships`, alle via `collectAcceptedFriendIds` of `partitionFriendships` | `friends/add.tsx:225`, `friendSuggestionSource.ts:70`, `gekooktSource.ts:214`, `sendRecipe.ts:166`, `trendingSource.ts:231`, `useLibrarySendSheet.ts:75` |

⚠ **Eén nuance die makkelijk fout gaat:** `namable_recipe_votes` (0016) is
**niet** vriend-gepoort. De view filtert alleen op consent; de vriendversmalling
is *"the caller's job and happens in the query that reads friendships"*. Wie
denkt dat het wijzigen van `is_friend_of` de kring automatisch meeneemt, heeft
het mis.

### O-11b. ✅ BEANTWOORD op 10 september 2026 — R2: `follows` wordt DE graaf

**Antwoord van de eigenaar: R2.** `is_friend_of()` wordt herschreven naar
"wederzijdse geaccepteerde follow"; zijn drie serveraanroepers blijven ongewijzigd;
`suggested_friends()` gaat met de hand mee; de kringversmalling verhuist in de client.
`friendships` wordt niet gedropt. **Inclusief de harde voorwaarde uit prijs 2:**
blokkeren krijgt eerst een eigen object.

### De drie vormen, en waarom R2

**Drie vormen, en de meting sluit er één meteen uit.**

| Vorm | Wat het is | Oordeel |
|---|---|---|
| **R3. `friendships` uitbreiden met een richting- of soortkolom** | Eén tabel, één vocabulaire | ❌ **Kan niet.** De tabel is gebouwd rond `unique (profile_low, profile_high)` — **één rij per ongeordend paar**, met twee generated columns en de index waar `is_friend_of` op draait. Terugvolgen is een tweede gerichte rij voor hetzelfde paar. R3 vraagt dus om het laten vallen van precies de constraint waar de kop van de tabel zegt dat hij *"built around"* is. Dat is geen hergebruik maar een herschrijving met de oude naam erop. |
| **R1. Een eigen tabel `follows` naast `friendships`** | `(follower_id, followee_id, status, responded_at)`, `unique (follower_id, followee_id)`, plus een `i_follow(target)`-predikaat | ⚠ Kan, en is het kleinste eerste bouwsel. **Prijs: twee grafen naast elkaar.** Elke lees moet kiezen welke graaf hij gebruikt, en de gebruiker krijgt **twee soorten verzoek** op één scherm — een vriendschapsverzoek en een volgverzoek — die hij niet uit elkaar kan houden, want hij heeft er maar één gevraagd. |
| **R2. `follows` wordt DE graaf; vriendschap wordt een AFGELEID begrip** | `is_friend_of(x)` = *er is een geaccepteerde follow x→mij **én** mij→x* | ✅ **Aanbevolen.** Zie hieronder. |

**Aanbeveling: R2.** Vier redenen, en de derde is de meting die hem goedkoop
maakt waar hij duur leek:

1. **Deze repo weigert tweede implementaties van hetzelfde.** Een volgverzoek en
   een vriendschapsverzoek zijn hetzelfde object: een gevraagde toestemming
   tussen twee mensen, met `pending` / `accepted` / `declined`. Twee inboxen
   voor één begrip is exact wat `kring.ts` naast `leaderboard.ts` bewust
   vermeed — *"a shared constant is how one list quietly starts behaving like
   the other"* — maar dan in de verkeerde richting.
2. **Wat de eigenaar beschrijft ís het huidige model, met de symmetrie eruit.**
   Vriendschap in Remy is vandaag al "we volgen elkaar allebei, en dat is in één
   handeling geregeld". De vraag is niet of er een nieuwe relatie bijkomt; de
   vraag is of de bestaande relatie in twee richtingen uiteen mag vallen.
3. **`is_friend_of` is ÉÉN functie met precies drie serveraanroepers** —
   `shared_cooks` (`0009:155`), `recipe_shares_insert` (`0009:229`) en
   `can_read_shared_meal` (`0007:614`), gegrepd over alle negentien migraties.
   Wordt zijn body herschreven naar "wederzijdse geaccepteerde follow", dan
   blijven die drie **letterlijk ongewijzigd** werken. Dat is de reden dat R2
   haalbaar is: de abstractie die dit nodig heeft, ligt er al.
   ⚠ **`suggested_friends()` is de uitzondering:** die leest `friendships`
   rechtstreeks (`0019:90,105,116`) en niet via `is_friend_of`, dus die moet met
   de hand mee. Dat is het vierde serverobject.
4. **De feed leest een NIEUW predikaat en niet dat oude.** `i_follow(target)`
   is wat `shared_cooks` straks nodig heeft om asymmetrisch te worden. Door dat
   naast `is_friend_of` te zetten in plaats van eroverheen, blijft elk bestaand
   object beslissen wat het wil — en dat is de enige manier om tien
   beslissingen niet in één migratie samen te persen.

**De prijs van R2, volledig en niet weggeredeneerd:**

1. **Een migratie over live rijen.** Elke `accepted` friendship wordt twee
   `accepted` follows. Dat is data die er is. ⚠ **De eigenaar draait migraties,
   geen agent** — en dit is er een die niet terug te draaien is zonder de oude
   tabel te bewaren. Aanbeveling: `friendships` blijft staan tot de nieuwe graaf
   in productie bewezen is; niets wordt gedropt in dezelfde migratie.
2. ⚠ **BLOKKEREN HEEFT GEEN EQUIVALENT IN EEN FOLLOW-RIJ, EN DIT IS DE HARDE
   VOORWAARDE.** `blocked_by` bestaat omdat een block anders onafdwingbaar is:
   *"either party may delete their own friendship row, so the blocked person
   would simply remove the block and ask again."* Een `follows`-rij is gericht
   en van de volger; die kan een block niet dragen. **Blokkeren moet dus een
   eigen object worden vóórdat R2 kan landen**, niet erna. Dit is geen detail
   maar een blokkade.
3. **`is_friend_of` wordt twee indexprobes in plaats van één.** De unique index
   op het paar is vandaag de snelle weg. Op deze schaal is dat niets, maar het
   is een echte verandering en het hoort in de migratie te staan.
4. **Elk van de tien plekken uit O-11a moet opnieuw beslissen wat "vriend"
   betekent.** Drie mogelijke betekenissen: *ik volg hen*, *zij volgen mij*,
   *wederzijds*. Hieronder de zes waar de keuze werkelijk iets verandert, als
   startpunt en niet als besluit; de overige vier (`friends/add.tsx`,
   `friendSuggestionSource`, en de twee die alleen doorgeven) volgen wat hun
   bron doet:

   | Object | Wordt | Waarom |
   |---|---|---|
   | `shared_cooks` (proof) | **ik volg hen** | Dat ís de feed. Asymmetrie hoort hier of nergens. |
   | `recipe_shares_insert` (sturen) | **wederzijds** | Een send is een bericht aan één persoon. Eenrichtingsverkeer maakt er ongevraagde post van, en §8's "no chat"-muur wordt dan dun. |
   | `can_read_shared_meal` | **wederzijds** | Volgt de send; de ontvanger moet de meal kunnen lezen. |
   | de kring (`namable_recipe_votes`-versmalling, client) | **ik volg hen** | Volgt de feed. |
   | `suggested_friends()` | **wordt suggested follows** | De uitsluitingsregel ("iedereen met wie je al een rij deelt") moet gericht worden, anders verdwijnt iemand uit je suggesties zodra híj jou volgt. |
   | `sendRecipe` / `useLibrarySendSheet` (het publiek van een send) | **wederzijds** | Volgt `recipe_shares_insert`. |

5. **Elk woord "vriend" in de copy wordt dubbelzinnig.**
   `tests/addFriendCopy.test.ts` veegt vandaag de copy op zinnen die te veel
   beloven; die test wordt opnieuw herschreven (hij stond al op de nominatie
   voor O-4). En de tab heet dan geen `Vrienden` meer — zie O-1.

### O-11c. ⚠ De consentvraag, en waarom de goedkeuringsstap hem oplost

**Dit is het scherpste punt van het hele besluit en het mag niet impliciet
blijven.**

`DESIGN-SOCIAL.md` §5 legt vast wat de opt-in-schakelaar blootlegt: *"the link
between your display name and a canonical recipe id"* — en hij is aangezet onder
de betekenis **"aan wederzijds geaccepteerde vrienden"**. Als een volger die
geen vriend is diezelfde kookgeschiedenis kan zien, is die toestemming
**verbreed door een migratie**. PD-022's enige overlevende absolute zin is:
*"nothing is shared by a migration, ever."*

**De redding zit in de vraag die de eigenaar zelf stelde.** Hij vroeg níet om
openbaar volgen. Hij vroeg om: *"een melding krijgt als iemand dat wil, dan kan
je het accepteren."* **Die acceptatie is een verse toestemming per persoon**, en
dat is een **sterkere** poort dan de globale schakelaar van §5 — die geldt voor
iedereen tegelijk, deze voor één mens. Een geaccepteerde volger heeft dus een
toestemming die het product vandaag niet eens kán geven.

**Wat daaruit volgt als harde bouwregels:**

1. **Geen enkele bestaande vriendschap wordt door de migratie een asymmetrische
   relatie die méér blootlegt dan vandaag.** Twee geaccepteerde follows uit één
   vriendschap leggen precies evenveel bloot als de vriendschap deed.
2. **Een openbaar volgmodel — zonder acceptatie — is hiermee expliciet
   geweigerd**, ook als het later goedkoper lijkt. Zonder de acceptatiestap
   valt de hele redenering weg en is §5's toestemming wél verbreed.
3. **De globale schakelaar van §5 blijft de bovenliggende poort.** Staat hij
   uit, dan ziet ook een geaccepteerde volger niets. Toestemming stapelt; ze
   vervangt elkaar niet.

### O-11d. De melding — samen met die van de mede-eter, want het is hetzelfde probleem

Twee nieuwe soorten post arriveren in hetzelfde kwartaal: een **volgverzoek**
(O-11) en een **mede-eter-uitnodiging** (O-5). Beide vragen om een antwoord.
Beide lopen op dezelfde muur: **remote push bestaat niet.** `push_tokens` heeft
sinds 0001 een tabel, een index en drie policies en **nul schrijvers**;
`expo-notifications` wordt door precies één bestand geïmporteerd
(`decisionNotification.ts`) en alleen voor een lokale dagelijkse melding.

§4.3's drie prijzen (A telling-in-label, B lokale melding, C echte push) gelden
onverkort. **Aanbeveling: A voor allebei, in één regel.**

Concreet, en het is goedkoper dan het klinkt omdat het bestaat:
`PendingRequestsLine` tekent vandaag alleen als er een vriendschapsverzoek
wacht, in de accentkleur, als enige ding boven de lijst. **Een volgverzoek is
letterlijk hetzelfde soort ding.** Eén regel, één telling over drie soorten post,
één bestemming.

⚠ **Wat dat níet oplost, en het moet gezegd:** de eigenaar zei *"een melding
krijgt"*. Een regel die pas verschijnt als je de app opent, is geen melding in
de betekenis die de meeste mensen aan dat woord geven. **Dit is de eerste keer
dat de afwezigheid van push een gevraagde functie werkelijk beperkt** — bij de
mede-eter kon je nog volhouden dat het kan wachten; bij een volgverzoek zit er
iemand te wachten op een antwoord. §8's uitgestelde beslissing (*"The first push
this product sends should be its best one, and that argument deserves its own
day"*) heeft daarmee een concrete aanleiding gekregen, en OPS-02 (geen
development-build-pijplijn) is de eerste blokkade op dat pad.

---

# DEEL IV — GEFASEERDE VOLGORDE

> ## ⚠ STATUS, 10–11 september 2026: FASE 0 EN FASE 1 ZIJN GEBOUWD
>
> Dit document zei van zichzelf *"Dit document bouwt niets"*. Dat is vanaf nu
> onwaar voor de eerste twee fasen, en de rest van DEEL IV beschrijft dus voor
> fase 0 en 1 wat er GEBEURD is in plaats van wat er moet gebeuren.
>
> **Fase 0.** PD-024 staat in `PRODUCT-DECISIONS.md`. `DESIGN-SOCIAL.md` §9's
> slotzin is doorgestreept met een amendementsblok eronder; §8's vierde
> weigering is voor de TWEEDE keer geamendeerd, met alleen `No follower model`
> doorgestreept en publieke profielen plus contactenupload expliciet overeind.
> `DESIGN.md` §Navigation draagt de banner over drie tabs. O-9 is gebouwd:
> `src/domain/saveOrigin.ts`, `Save.origin`, een VERPLICHTE
> `CreateSaveInput.origin`, vier schrijfplekken bedraad, en migratie
> `0020_save_origin.sql`.
>
> **Fase 1.** Migratie `0021_directed_graph.sql` is GESCHREVEN en NIET
> GEDRAAID — dat blijft van de eigenaar. Daarin: `blocks` als eigen object,
> `follows` gericht met goedkeuringsstap, `i_follow()`, `is_friend_of()`
> herschreven naar wederzijdse follow, de datamigratie over alle VIER
> statussen, en `suggested_friends()` met de hand mee. Aan de clientkant:
> `src/domain/social/follow.ts` met zijn tests, de repository-seam
> (`followGraph.ts` plus beide backends), en de aanroepers die volgens O-11b's
> tabel elk hun eigen lezing kregen.
>
> ⚠ **ÉÉN ONTWERPKEUZE WIJKT AF VAN WAT HIERONDER STAAT, en bewust.**
> Blokkeren is een INTREKBAAR record geworden (`blocked_at` / `lifted_at`,
> nooit verwijderd) in plaats van een trigger die follow-rijen opruimt.
> Dezelfde garantie — deblokkeren herstelt nooit een toestemming van vóór het
> block, want de predikaten weigeren elke acceptatie die ouder is dan het
> meest recente block — maar volledig additief, met auditspoor, en zonder een
> `security definer`-trigger die rijen weghaalt die de aanroeper niet bezit.
> Dat laatste was het gevaarlijkste object in de eerste opzet.
> `recipe_shares.withdrawn_at` is het precedent: de rij blijft staan zodat de
> intrekking auditeerbaar is.


De volgorde is gekozen zodat elke fase op zichzelf zinvol is en niets in een
latere fase moet worden teruggedraaid. Er staan **geen tijdschattingen** in: dit
project heeft er slechte ervaringen mee (LONGLIST GAP-34: *"de begroting in de
oude regel was voor de verkeerde route"*).

**Elke fase begint met een omkering op papier en niet met code.**

⚠ **HERZIEN — er is een fase bijgekomen en de rest is opgeschoven.** Het
volgbesluit (O-11) zet een datamodel en een RLS-verandering vóór de feed, want
een feed van "gevolgde accounts" kan niet bestaan voordat volgen bestaat. De
oude nummers staan erbij zodat verwijzingen elders terug te vinden zijn:

| Nieuw | Was | Onderwerp |
|---|---|---|
| Fase 0 | Fase 0 | De papieren omkering |
| **Fase 1** | **— (nieuw)** | **De graaf wordt gericht: volgen** |
| Fase 2 | Fase 1 | De samenvoeging tot feed + explore |
| Fase 3 | Fase 2 | Zoeken op ingrediënt en receptnaam |
| Fase 4 | Fase 3 | Keuken |
| Fase 5 | Fase 4 | Mede-eters |
| Fase 6 | Fase 5 | Zoeken op mensen |

---

## Fase 0 — De papieren omkering en de goedkope meting

**Wat er gebeurt.** PD-024 wordt in `PRODUCT-DECISIONS.md` gezet in de vorm van
DEEL II, met de antwoorden erin verwerkt: **O-2 en O-5 zijn beantwoord** (die
hoeven niet meer gevraagd te worden), **O-11 is beantwoord** in richting maar
niet in vorm, en **O-1, O-3, O-4 en O-6 t/m O-10 staan nog open**.

Drie documenten krijgen een doorstreping met een `**(AMENDED, …)**`-blok
eronder, in de vorm die `DESIGN-SOCIAL.md` §5 en §8 al gebruiken:

1. **§9's slotzin** (*"Do not build a feed"*).
2. **§8's vierde weigering** — `No follower model`, voor de **tweede** keer
   geamendeerd; de amendering van 8 september (`vrienden-van-vrienden`) staat
   er al in exact de goede vorm en is het sjabloon. ⚠ *Publieke profielen* en
   *contact-book upload* in diezelfde bullet blijven staan; schrijf dat er
   expliciet bij, anders leest de doorhaling als een streep door de hele regel.
3. **`DESIGN.md` §Navigation** krijgt een banner over de tabtelling.

O-9 (herkomst op een save) wordt gebouwd — dat is één veld en het is de enige
post die duurder wordt door te wachten.

**Wat het ontgrendelt.** Alles daarna. Zonder de banner is elke volgende fase
een stille afwijking van een bindend besluit, en dat is precies wat deze repo
niet doet.

**Risico.** Geen technisch risico. Het risico is dat het wordt overgeslagen
omdat het geen scherm oplevert.

---

## Fase 1 — De graaf wordt gericht: volgen (NIEUW, en hij staat vooraan omdat de feed erop rust)

**Wat er gebeurt.** O-11's antwoord, in deze volgorde, en de volgorde is de
fase:

1. **Blokkeren krijgt eerst een eigen huis.** Dit staat vooraan omdat het een
   blokkade is en niet een detail: `friendships.blocked_by` bestaat omdat een
   block anders onafdwingbaar is, en een gerichte follow-rij kan hem niet
   dragen (O-11b, prijs 2). Zonder dit kan de rest van deze fase niet landen.
2. **De tabel `follows`:** `(follower_id, followee_id, status pending/accepted/
   declined, created_at, responded_at)`, `unique (follower_id, followee_id)`,
   `check (follower_id <> followee_id)`, plus een trigger in de vorm van
   `guard_friendship_transition()` die illegale overgangen weigert. ⚠ **Neem de
   re-request-overgang van `friendships` NIET over** zonder er bewust ja tegen
   te zeggen: daar mag een `declined` paar opnieuw vragen, en of dat hier mag is
   een aparte keuze (vergelijk O-5c, waar het antwoord nee is).
3. **`i_follow(target)`** — een nieuw `security definer` `stable`
   `sql`-predikaat naast `is_friend_of`, met dezelfde vorm en dezelfde
   `set search_path = public`.
4. **`is_friend_of` wordt herschreven** naar "wederzijdse geaccepteerde follow".
   ⚠ Zijn vier serveraanroepers blijven daarbij **ongewijzigd** — dat is de hele
   reden dat R2 te doen is. Wie ze toch aanraakt in dezelfde migratie, verliest
   de mogelijkheid om te zien of de herschrijving zelf goed was.
5. **De datamigratie:** elke `accepted` friendship wordt twee `accepted`
   follows. `friendships` wordt **niet gedropt** in dezelfde migratie.
6. **De zes clientaanroepen** krijgen elk hun eigen beslissing volgens O-11b's
   tabel. `collectAcceptedFriendIds` (puur, in `src/domain/social/friendship.ts`)
   is de plek waar dat testbaar is — het is een pure module en dat is precies de
   vorm die deze repo eist.
7. **De UI:** volgverzoek versturen, en `PendingRequestsLine` gaat ook
   volgverzoeken tellen (O-11d).

**Wat het ontgrendelt.** De feed van fase 2, en niets anders. Als alleen deze
fase landt, heeft het product een gerichte graaf en verder exact dezelfde
schermen.

**Risico — vier, en ze zijn alle vier echt.**

1. **De migratie raakt live data en is van de eigenaar.** Zie de huisregels: een
   agent draait `supabase db push` niet.
2. **`is_friend_of` is het tweede RLS-predikaat van het hele product.** Een fout
   in zijn body is geen bug maar een lek, over vier objecten tegelijk. Deze
   herschrijving verdient de zwaarste test van het hele plan, en die test hoort
   te bewijzen dat een **eenzijdige** follow géén van de vier objecten opent.
3. **De consentgrens van O-11c.** Geen bestaande vriendschap mag na de migratie
   méér blootleggen dan ervoor.
4. **Twee grafen tegelijk in het hoofd van de lezer.** Zolang `friendships`
   blijft staan naast `follows`, is er een periode waarin twee tabellen hetzelfde
   lijken te zeggen. Schrijf in de migratie welke de waarheid is.

**Wat deze fase níet doet.** Geen openbaar volgen (O-11c, regel 2). Geen
volgerstellingen, geen profielpagina, geen "populairste koks" — volgen is een
poort en nooit een score.

---

## Fase 2 — De samenvoeging tot feed + explore, zonder één nieuwe functie

✅ **GEBOUWD op 11 september 2026.** Vijf poorten groen — typecheck 0, lint 0,
`check:functions` 0, `check:seed` 0, **3788 tests over 159 bestanden** (was
3742 over 157, dus **+46 tests over +2 testbestanden**).

**Wat er werkelijk gebouwd is, tegenover wat hieronder gepland stond — en het
belangrijkste verschil eerst, want dit is de post die het plan zelf niet zag
aankomen:**

- **De voorwaarde die "vóór deze fase moest liggen" was GEEN "één
  typewijziging".** Verderop in deze sectie stond dat de send-kaart niet op
  live data rendeerde en dat dit "één typewijziging (attributie in plaats van
  `Creator`)" zou kosten. Wat er werkelijk ontbrak was een hele FUNCTIE die
  nooit bestaan had: `buildSentMealCardModels`. `friendFeedPresentation.ts`'s
  eigen kop BEWEERDE dat die functie al bestond — op twee plekken in
  hetzelfde bestand, allebei "`buildSentMealCardModels` at the foot of this
  file" — terwijl `grep -n "buildSentMealCardModels"` vóór deze fase nul
  definities teruggaf. **Twee koppen waren het eens over een functie die
  nergens stond.** Nu gebouwd: `SentMealFeedSource` + `buildSentMealCardModels`
  in `friendFeedPresentation.ts` (488 → 629 regels), en beide koppen zijn
  rechtgezet.
- **Gepland en gebouwd zoals beschreven:** de twee sociale tabs zijn één tab
  geworden. Routesegment blijft `ranglijst`; alleen het label is `Ontdek`.
  `(tabs)/friends.tsx` is nu een `<Redirect href="/ranglijst" />` van 36
  regels (was 907) en krijgt `href: null` in `_layout.tsx`, zodat `/friends`
  bereikbaar blijft maar niet in de balk staat. `ranglijst.tsx` is 742 regels
  (was 934) en is het samengevoegde scherm: twee oppervlakken achter een
  pager, schakelaar `Vrienden | Ontdekken` (O-2c). De feedkant kreeg
  proof-kaarten (uit `shared_cooks`, nu gepoort op `i_follow` — migratie
  `0022`), de sends en het cijfer volgens O-2's aanbeveling A. De explorekant
  bleef byte-voor-byte de globale lijst. De tabtelling ging naar O-1b's ene
  regel via `formatWaitingPost` in `ontdekCopy.ts`, die delegeert naar de
  bestaande `formatPendingRequests`.
- **DE KRING IS GEEN LIJST MEER.** `trendingSource.ts` ging van 350 naar 221
  regels: `readFriendVotes`, `toKringRecipe` en `friendRows` zijn eruit.
  `loadLiveTrending()` neemt nu GEEN ARGUMENTEN meer (was
  `profileId: ProfileId | null`) — de handhaving van PD-014.6 "no
  personalisation, ever": explore weet niet wie er leest. ⚠ `rankKring`,
  `assembleKring`, `KringRowModel` en `kringPresentation.ts`'s lijst-copy
  hebben hierdoor geen productie-aanroeper meer. Ze zijn niet verwijderd, hun
  tests draaien nog, en de reden staat op `docs/LONGLIST.md` ONT-07.
- **De consent-gepoorte lees `listNamableRecipeVotes` (migratie 0016) is
  verhuisd** van `trendingSource.ts` naar `gekooktSource.ts` (353 → 465
  regels), waar hij nu het cijfer op een proof-kaart voedt.
- **Nieuwe bestanden:** `src/components/ontdekPresentation.ts` (317),
  `src/components/ontdekCopy.ts` (166), `src/components/OntdekBodies.tsx`
  (414), `tests/ontdekBoundary.test.ts` (230, 16 tests — de grens die PD-024
  als test opeiste: geen rij van `rankRecipes` mag op de feed landen),
  `tests/ontdekPresentation.test.ts` (222, 20 tests),
  `supabase/migrations/0022_feed_follows_the_follow.sql` (183, GESCHREVEN EN
  NIET GEDRAAID).
- **Nieuwe gedeelde regel `findCollidingIngredientTags`** in
  `src/domain/feed/ranking.ts` (geëxporteerd), waar `findCollidingTags` nu
  naar delegeert — één botsingsregel, twee ingangen.
- **Het bestandsplafond ging van zeven naar vier** — zie §1.5 voor de
  nameting; `ranglijst.tsx` en `friends.tsx` zijn eraf.
- **Wat deze fase nog steeds niet doet, precies zoals gepland:** geen
  zoekbalk, geen keuken, geen mede-eters, geen volgwerk.

⚠ **HERZIEN.** De eerste versie beschreef deze fase als *"de drie bronnen
(proof, send, kring) worden één lijst"*. Dat is niet meer wat er gebouwd wordt.
Er worden **twee oppervlakken** gebouwd, en de moeilijkheid verschuift van
"welke kaart wint" naar "waar loopt de naad".

**Wat er gebeurt.**

1. **`friends.tsx` en `ranglijst.tsx` worden ontleed:** alle beslissingen naar
   pure `.ts`-modules (`ontdekPresentation.ts` en wat er verder uitvalt), en de
   routebestanden terug naar iets dat rendert. **De routenaam blijft
   `ranglijst`**; `_layout.tsx` legt uit waarom een routesegment hernoemen
   deeplinks en historie breekt. Het label wordt `Ontdek`.
2. **De feedkant** krijgt proof-kaarten (uit `shared_cooks`, nu gepoort op
   `i_follow`), de sends, en het cijfer volgens O-2's aanbeveling A.
3. **De explorekant** blijft byte-voor-byte de globale lijst die PD-014
   beschermt, plus later de zoekbalk uit fase 3.
4. **De schakelaar** volgens O-2c: hij blijft, maar schakelt tussen
   oppervlakken en krijgt nieuwe woorden. Bij O-1's optie B verdwijnt hij en
   worden het twee tabs.
5. **De tabtelling** gaat naar O-1b's herziene antwoord (een regel, niet een
   labelsuffix).
6. `/friends/add`, `/friends/[feedItemId]` en `/friends/recipe/[recipeId]`
   blijven als stackroutes bestaan.

⚠ **Voorwaarde die vóór deze fase moet liggen en niet erin:** de send-kaart
rendert vandaag niet op live data (§1.1). Zolang dat zo is, voegt deze fase een
kaartsoort samen die op een toestel niet bestaat. Het is één typewijziging
(attributie in plaats van `Creator`) en hij hoort ervóór.

**Wat het ontgrendelt.** Het gevraagde oppervlak, en de bestandsschuld van twee
van de zeven bestanden boven het plafond.

**Risico — en dit is de grootste van het hele plan.** Dit is een herschikking van
twee schermen die samen 1841 regels zwaar becommentarieerd zijn, waarvan elk
argument is opgeschreven omdat iemand het eerder fout deed. De manier om dit
fout te doen is een `kind`-prop op één kaartcomponent: `friends.tsx` zegt in zijn
kop dat proof- en send-kaarten *"siblings, never one component with a `kind`
prop"* zijn, en dat de twee modellen met opzet niet aan elkaar toewijsbaar zijn
(`mealId?: never`). Die typegarantie moet de samenvoeging overleven.

**Wat deze fase níet doet.** Geen zoekbalk. Geen keuken. Geen mede-eters. Geen
volgwerk — dat is in fase 1 al gebeurd en deze fase consumeert het alleen. Als
alleen deze fase landt, is het product beter dan het was.

---

## Fase 3 — Zoeken, over de twee assen die al een corpus hebben

**Wat er gebeurt.** Eén zoekbalk bovenaan Ontdek, over **ingrediënt** en
**receptnaam** — de twee assen waarvan de tabellen (`recipe_ingredients`,
`recipes`) al wereldleesbaar zijn voor ingelogde lezers. De matcher voor
ingrediënten bestaat (GAP-34); wat nieuw is, is één serverlees over `recipes` +
`recipe_ingredients` met een cap, en de vraag of dat PostgREST of een
`security definer` functie wordt.

**Wat het ontgrendelt.** Twee van de vier assen die de eigenaar noemde, en de
tweede helft van GAP-34's belofte, die in de LONGLIST als openstaand staat.

**Risico.** (a) `recipeSearch.ts:61-67`'s grens: deze zoek mag geen allergeen- of
dislike-poort worden, en de bestaande predicaten mogen niet worden hergebruikt
om die grens te "besparen". (b) Een zoek over `recipes` is een nieuwe leesvorm;
de bestaande board-lees heeft daar een noodrem voor
(`BOARD_RATING_ROW_CEILING`) en deze heeft er ook een nodig. (c) De uitkomst is
een lijst recepten die niemand heeft beoordeeld — dus zonder cijfer, zonder
proof. Wat een zoekresultaatkaart toont, is niet af.

---

## Fase 4 — Keuken

**Wat er gebeurt.** In deze volgorde, en de volgorde is de fase:

1. `src/domain/dishCuisines.ts` met de gesloten set (O-3), een sanitizer, en de
   invariant-test dat het vocabulaire geen enkele waarde deelt met `DISH_TAGS`,
   `DISH_MOODS`, `DISH_COURSES` en de EU-14 — de test die
   `tests/dishCourses.test.ts` al voor zijn eigen as heeft.
2. Migratie: `recipes.dish_cuisine text` en `meals.dish_cuisine text`, beide
   nullable, met het waarom van het verschil met `dish_course`'s
   `not null default` in de migratie zelf (O-3, punt 3).
3. `buildExtractionRequest.ts`: een tweede `enum`-veld naast `dishTags`, in beide
   systeemprompts genoemd met dezelfde zin ("kies alleen uit de lijst, verzin
   nooit, laat leeg als de bron geen basis geeft"), en in `required` afwezig.
   Plus `parseExtractionResponse` en `validateParsed`.
4. `RecipeTaxonomyFields.tsx` krijgt een **derde rij**. ⚠ Die component bestaat
   omdat twee rijen `recipe-edit` acht regels over het plafond duwden; een derde
   rij past er wel in, maar `recipe-edit` (765) heeft nog 35 regels speling.
   Meten vóór schrijven.
5. Filterchips op Ontdek: de keuken-as naast `trendingFilter.ts`'s
   `requiredDishTags`. **OR binnen de as, niet AND** — één recept heeft één
   keuken, dus AND is per constructie leeg (exact 0017's argument).

**Wat het ontgrendelt.** De derde as van de vier, en de eerste as die "waar heb
ik zin in" beantwoordt in plaats van "kan ik dit vanavond maken".

**Risico.** (a) **Bestaande recepten krijgen niets.** Er is geen caption bewaard
en `ON CONFLICT DO NOTHING` betekent dat een herimport niets overschrijft. Elk
recept van vóór deze fase heeft een lege keuken en blijft die houden tot iemand
hem met de hand zet. Een filterchip die de helft van de bibliotheek onzichtbaar
maakt, is een defect dat als feature leest. De eerlijke antwoorden zijn: (i)
accepteren en de chips alleen tonen voor keukens die echt voorkomen
(`collectAvailable…`-precedent), (ii) een expliciet "reëxtraheer"-pad bouwen dat
0006 al als het juiste antwoord noemt, of (iii) een eenmalige LLM-pass over titel
+ ingrediënten — die laatste is **raden**, en dat is wat deze pijplijn overal
verbiedt. **Aanbeveling: (i), met (ii) als eigen regel op de LONGLIST.**
(b) `ranglijst.tsx:216`'s *"Wat over alle keukens heen het hoogst scoort"* wordt
dubbelzinnig zodra "keuken" een filter is. WS3 noemde die zin de meest eigen van
de app; hij moet bewust worden herzien of bewust blijven staan.

---

## Fase 5 — Mede-eters

**Wat er gebeurt.** ⚠ **O-5 is beantwoord — opt-in — dus die voorwaarde is
vervuld.** Deze fase wacht nog op **O-6** (betekent "ja" ook "in mijn
receptenlijst") en **O-7** (draagt de koppeling een tijd). En hij wacht op
fase 1: het antwoordscherm en de melding delen hun vorm met het volgverzoek,
en twee keer hetzelfde bouwen is precies wat deze repo weigert.

1. Een eigen tabel — werknaam `meal_companions` — met de vorm die `friendships`
   al bewijst: een statuskolom (`pending` / `confirmed` / `declined`), een
   trigger die illegale overgangen weigert, een
   `unique (meal_id, companion_profile_id)`, en géén pad terug uit `declined`.
2. Een view die de naam pas prijsgeeft bij `confirmed` — de vorm van
   `namable_recipe_votes` (0016), met de policy-herhaling die een plain view
   nodig heeft omdat hij de policy van de onderliggende tabel niet opnieuw
   binnentreedt.
3. De melding: **dezelfde regel als het volgverzoek** (O-11d) — één
   `PendingRequestsLine` over drie soorten post, via dezelfde hook-vorm als
   `useUnseenSendCount`: één lees per identiteit, geen polling, geen realtime.
   ⚠ Niet een eigen teller ernaast; dat is de tweede implementatie van
   hetzelfde.
4. Het antwoordscherm: bevestigen / weigeren, en na bevestigen de bestaande
   `Bewaren`-knop (O-6, optie A).

**Wat het ontgrendelt.** Het stuk waar de eigenaar het meest enthousiast over is,
en het eerste sociale feit in dit product dat niet afgeleid is.

**Risico — vier, en ze zijn alle vier echt.**
1. **Toestemming.** O-5 is beantwoord met opt-in, dus het risico is niet meer
   *welke kant het opgaat* maar of de implementatie de opt-in werkelijk
   afdwingt. De naam mag op geen enkel pad — view, fixture, `__DEV__`-scenario
   of foutmelding — zichtbaar zijn vóór `confirmed`. Fout hier is niet terug
   te draaien: *"Already rendered screens on friends' devices cannot be
   recalled from human memory."*
2. **Toevoer.** Een handmatig ingevoerd of van het web geïmporteerd diner heeft
   geen canonieke rij, dus de mede-eter kan het niet toevoegen (§1.4, O-8). Het
   meest waarschijnlijke gedeelde diner is precies dat.
3. **§8's "no trophy shelf".** Een mede-eter-graaf is de directe grondstof voor
   *"met wie eet jij het vaakst"*. Dat moet in de banner als weigering staan,
   niet als iets waar later over nagedacht wordt.
4. **§8's "no chat".** Een weigering is een antwoord, en een antwoord nodigt uit
   tot een tweede. De weigering moet een **toestand op een rij** zijn en nooit
   een bericht. Geen reden, geen tekstveld, geen notificatie terug naar de kok
   die zegt dat er geweigerd is — een geweigerde koppeling verdwijnt gewoon.

**Wat deze fase níet doet.** Geen push (§8, en de prijs staat in §4.3 en
O-11d). ⚠ **Geen "met 1 ander"-teller vóór bevestiging, punt** — die stond er
als voorbehoud voor O-5's optie C, en met het opt-in-antwoord is die optie
gesloten. Vóór bevestiging is er geen naam en geen getal.

---

## Fase 6 — Zoeken op mensen

**Bewust als laatste**, en dat is een aanbeveling waar tegenin gegaan mag worden.
De reden: het is de as die het minste met eten te maken heeft, hij draait de
scherpste geschreven weigering in de repo om, en hij is de enige die niets
kapotmaakt als hij er nooit komt — `friends/add.tsx` werkt vandaag,
`suggested_friends()` levert drie rijen aan de voet van de feed, en samen dekken
die het gebruikelijke geval.

**Wat er gebeurt.** O-4's antwoord, als een `security definer` functie met de
vorm van 0019: cap, minimumlengte, prefix-only, grants ingetrokken voor `anon`.
`tests/addFriendCopy.test.ts` wordt herschreven in plaats van verwijderd.

**Risico.** De enumeratie. Hij wordt kleiner gemaakt, niet weggenomen, en dat
hoort er als geaccepteerde kost te staan — precies zoals 0019 dat doet voor de
gemeenschappelijke-vriendentelling: *"A real cost, taken rather than argued
away."*

---

# DEEL V — WAT GEWEIGERD BLIJFT, EN WAAR DIT VOORSTEL ERTEGENAAN SCHUURT

`DESIGN-SOCIAL.md` §8 telt de weigeringen. Per stuk: schuurt dit voorstel?

| Weigering | Schuurt het? |
|---|---|
| **Geen likes, hearts, emoji-reacties** | **Nee.** Het bewaren blijft de enige reactie. ⚠ Let op één ding: §9 noemt een openstaand gat — de afzender hoort vandaag niets als een vriend bewaart, alleen als hij kookt. Een feed maakt de verleiding groter om dat te dichten met een teller. Dat blijft geweigerd. |
| **Geen chat, replies, threads** | **Ja, licht — bij de mede-eters.** Een weigering is een antwoord. Fase 5's risico 4 is de mitigatie: een toestand, nooit een bericht, nooit een reden. |
| **Geen leesbevestigingen** | **Ja, licht.** De mede-eter-koppeling heeft een `pending`-toestand die de kok kan zien. Dat is niet hetzelfde als "gezien" — hij ziet dat er niet geantwoord is, niet dat er gelezen is — maar het is dichterbij dan iets in dit product ooit is gekomen. O-5b is de grens. |
| **Een send doet nooit alsof hij bewijs is** | **Ja, potentieel — en dit is de scherpste.** O-2's optie A zet proof en cijfer op één kaart. Als die kaart één gedeelde component wordt met een `kind`-prop, is dit verbod binnen één refactor weg. De typegarantie (`mealId?: never`) is de enige echte bewaker en moet de samenvoeging halen. ⚠ De feed/explore-splitsing helpt hier: de send blijft aan de feedkant en het globale gemiddelde aan de explorekant, dus ze delen geen lijst meer. |
| **Geen tellingen zonder namen, geen strangertellingen** | **Nee, niet meer.** Dit schuurde alleen bij O-5's optie C ("met 1 ander"), en O-5 is beantwoord met opt-in. Vóór bevestiging is er geen naam **en geen getal**. ⚠ De nieuwe verleiding zit elders: een volgerstelling. Die blijft geweigerd — volgen is een poort, nooit een score (O-11). |
| **Geen opvullen van de kring** | **Ja, structureel, en het blijft de grootste stille dreiging.** Een dunne feed naast een volle explore op hetzelfde oppervlak maakt "vul de feed aan met een paar globale rijen" een refactor van drie regels. ⚠ Met een volgmodel erbij wordt het erger, niet beter: "suggesties in je feed" is precies hoe Instagram dit oploste. **Het verdient een test die vastnagelt dat geen enkele rij uit `rankRecipes` op de feedkant kan belanden.** |
| **Geen volgmodel, geen publieke profielen, geen contactenupload** | ⚠ **HERZIEN — het volgmodel is OMGEKEERD op verzoek van de eigenaar (O-11); de andere twee blijven absoluut.** Wat er staat is asymmetrisch volgen **met een goedkeuringsstap per persoon**, en die stap is precies wat de rest van de bullet overeind houdt: een geaccepteerde volger heeft toestemming gekregen, een publiek profiel vraagt niemand iets. Openbaar volgen blijft dus geweigerd, publieke profielen blijven geweigerd, en de contactenupload blijft absoluut — die laatste wordt door zowel een zoekbalk als een volgmodel uitgelokt, en het antwoord blijft nee. |
| **Geen trofeeënkast, geen streaks, geen leaderboard van vrienden** | **Ja, bij de mede-eters.** Fase 5, risico 3. |
| **Geen inline video, geen autoplay** | **Nee.** PD-007's lijn beweegt niet. Een feed met foto's is al gebouwd (PD-014a) en blijft foto's. |
| **Geen vijfde tab** | **Nee.** Bij O-1's optie A gaat er een tab weg; bij optie B blijven het er vier. In geen van beide komt er een bij. |
| **Geen push** | **Ja, en harder dan in de eerste versie.** Er zijn nu twee gevraagde meldingen — de mede-eter-uitnodiging en het volgverzoek (*"een melding krijgt als iemand dat wil"*) — en bij de tweede zit er iemand te wachten op een antwoord. Het antwoord van dit plan blijft: één regel bovenaan Ontdek, geen push. ⚠ Maar dit is de eerste keer dat de afwezigheid van push een gevraagde functie werkelijk beperkt, en OPS-02 (geen development-build-pijplijn) is de eerste blokkade op dat pad. Zie O-11d. |

---

# DEEL VI — WAT IK NIET KON METEN

Eerlijk opgeschreven in plaats van geschat.

1. **Of PostgREST op dit project een `db-max-rows` heeft.** Zonder die limiet is
   `profiles` vandaag al in één request af te tappen, en dan is de weigering in
   `friends/add.tsx` alleen een client-afspraak zonder serverkant. Dit is een
   feit over de huidige stand, niet over dit voorstel.
2. **Hoeveel recepten en profielen er werkelijk zijn.** Alle metingen over
   toevoer in de repo komen van de demo-seed (open vraag K meet acht recepten,
   waarvan er drie de stemvloer halen). Ik heb geen productiedatabase gelezen.
   Elke uitspraak over hoe leeg of vol Ontdek zal zijn, is dus onbevestigd.
3. **Of de bestaande `recipes`-rijen bruikbaar genoeg zijn voor een
   keuken-backfill.** Ik heb geen rij bekeken; ik heb alleen vastgesteld dat er
   geen caption bewaard is en dat het schrijfpad `ON CONFLICT DO NOTHING` is.
4. **Wat een gebruiker verwacht bij "keuken".** Of `aziatisch` of `thais` het
   juiste niveau is, is een productoordeel zonder gebruiksdata — precies zoals
   §4.5 zegt over de vloer van drie stemmen: *"Drie is een oordeel en geen
   meting."*
5. **Of de tabbalk bij drie tabs echt beter oogt.** De breedteberekening in O-1
   is arithmetiek uit `_layout.tsx`'s eigen gemeten advance widths. Op een
   toestel is het nooit gezien. Dit project heeft die exacte fout eerder gemaakt
   (de zeventien chips uit GAP-19, nooit op een toestel bekeken).
6. **Wat `assembleFriendFeed`'s consent-poort precies doet bij een gemengde
   lijst.** Ik heb de kop van `friendFeedPresentation.ts` gelezen en de ordening
   geverifieerd, maar de poort zelf niet regel voor regel. Wie fase 2 uitvoert,
   leest die eerst.

**Toegevoegd bij de herziening van 17:30:**

7. **Hoeveel `friendships`-rijen er in productie staan, en in welke statussen.**
   De migratie van fase 1 zet elke `accepted` rij om in twee `follows`-rijen. Ik
   heb geen productiedatabase gelezen; ik heb alleen de tabeldefinitie en de
   trigger gelezen. Hoe zwaar die migratie is, is dus **onbevestigd**.
8. **Of de send-kaart werkelijk één typewijziging weg is.** §1.1's conclusie
   komt uit de kop van `gekooktSource.ts`, die zegt dat
   `FriendRecipeCardModel.creator` een hele `Creator` is en dat een
   attributie-vorm de fix is. Ik heb die kop gelezen en niet het type zelf, en
   ook niet wat `CreatorAttribution` en het gedeelde receptscherm eraan
   ophangen. **De richting is gemeten, de omvang niet.**
9. **Of `blocked` werkelijk het enige begrip is dat niet in een `follows`-rij
   past.** Ik heb `friendships`' vier CHECKs, de trigger en de vier policies
   gelezen en daar één onoverdraagbaar begrip in gevonden. Dat is een lezing van
   één migratie, geen bewijs dat er geen tweede is. Wie fase 1 uitvoert, leest
   `0007_social.sql` in zijn geheel voordat hij de nieuwe tabel schrijft.
10. **Wat een gebruiker verwacht bij "volgen" versus "vrienden".** De eigenaar
    beschrijft een privé-Instagram-vorm. Of gebruikers een geaccepteerd
    volgverzoek als "vriend" zullen lezen — en dus of de copy twee woorden nodig
    heeft of één — is een productoordeel zonder gebruiksdata.

---

**Beantwoord tijdens de bouw van fase 0 en 1, 10–11 september 2026:**

- **8 is beantwoord: de send-kaart was inderdaad één typewijziging weg, en de
  omvang is nu gemeten.** `FriendRecipeCardModel.creator: Creator` is
  `attribution: RecipeAttribution | null` geworden, met het type in een eigen
  module (`src/components/recipeAttribution.ts`) omdat
  `sharedRecipePresentation.ts` al uit `friendFeedPresentation.ts` importeert
  en de omgekeerde import een cykel zou sluiten. Het raakte zeven bestanden:
  die twee, `FriendRecipeCard.tsx`, `CreatorAttribution.tsx`,
  `friendCardVocabulary.ts`, `SharedRecipeArticle.tsx` en `gekooktSource.ts`,
  plus vier testbestanden. ⚠ **En het legde een duplicaat bloot dat de
  eerste versie niet zag:** `sharedRecipePresentation.ts` droeg zijn eigen
  `SharedRecipeAttribution` mét een eigen kopie van de lege-naam-regel. Die
  twee zijn nu één type en één regel.
- **9 is beantwoord: `blocked` was inderdaad het enige onoverdraagbare
  begrip**, na een volledige lezing van `0007_social.sql`. Wat er WEL bij
  bleek te horen en in de eerste versie niet genoemd werd: `friendships`'
  `responded_at` draagt bij een geblokkeerd paar het moment van het BLOCK, en
  de datamigratie moet dat overnemen — anders krijgt elk gemigreerd block de
  aanmaakdatum van de vriendschap, en dan overleeft een acceptatie van ná die
  datum een block die er in werkelijkheid later overheen kwam.
- **⚠ EEN GEVOLG DAT DE EERSTE VERSIE NIET NOEMDE, en dat de migratie
  breder maakt dan hier beschreven stond: alle VIER de statussen moeten mee,
  niet alleen `accepted`.** Een openstaand verzoek dat niet meeverhuist
  verdwijnt zonder dat iemand het merkt, en — ernstiger — **elk block in
  productie zou verdampen** op het moment dat de client naar de nieuwe graaf
  overgaat, waarna de geblokkeerde persoon gewoon weer binnenloopt. Dat is
  precies de onafdwingbaarheid waar `blocked_by` voor was uitgevonden.
- **7 staat nog open.** Hoeveel `friendships`-rijen er in productie staan en
  in welke statussen is nog steeds ongemeten; ik heb geen productiedatabase
  gelezen. Hoe zwaar de datamigratie is, blijft dus onbevestigd.

## Bronnen van elke meting in dit document

| Bewering | Waar nagemeten |
|---|---|
| Regelaantallen | `wc -l` op 10 september 2026, om 15:00 opnieuw (zie de waarschuwing bovenaan) |
| Vijf poorten, 3494/148 en 3577/152 | zelf gedraaid: `typecheck`, `lint`, `check:functions`, `check:seed`, `test` — twee keer, om 14:34 en om 14:59 |
| De gelijktijdige ronde | `git status --short`, plus `ls -lt` over `tests/` |
| Eén schrijver van `recipe_ratings` | grep op `castPublicVote`, `rateRecipe`, `PublicVoteSink` |
| `push_tokens` heeft nul schrijvers | grep op `push_tokens`/`pushToken` over `src/` en `tests/` |
| `recipes` accepteert drie platforms | `0011_canonical_recipes_platform_widening.sql:120-124` |
| `profiles_select` geeft iedereen alles | `0007_social.sql:179-180` |
| `ilike` expliciet geweigerd | `supabaseSocialRepository.ts:176-184` |
| Geen keuken, nergens | grep op `cuisine`/`keuken` over `src/`, `supabase/`, `tests/`, `docs/` |
| `recipeCuisine` bewust ongelezen | `jsonLdRecipe.ts:54-60`, `tests/import/jsonLdRecipe.test.ts:538` |
| Boardconstanten | `leaderboard.ts:53,65`, `leaderboardPresentation.ts:89`, `kring.ts` |
| `expo-notifications` één importeur | grep, plus `decisionNotification.ts`'s eigen kop |
| `shared_cooks` heeft twee kolommen | `0009_cook_proof_and_sends.sql:132-158` |
| `namable_recipe_votes`' twee anti-joins | `0016_namable_recipe_votes.sql:127-175` |
| `suggested_friends()`'s vorm | `0019_friend_suggestions.sql:68-80` |
| **Herzieningsmetingen van 10 september, 17:23** | |
| Vijf poorten, 3577/152, exit 0 | zelf gedraaid: `typecheck`, `lint`, `check:functions`, `check:seed`, `test` |
| `friends.tsx` 907 en niet 928; zeven bestanden boven 800 | `wc -l` over `src/`, 17:23 |
| `/friends/recipe/[recipeId]` bestaat (207 regels) en is bedraad | `wc -l`; `friends.tsx:522` |
| De send-kaart rendert niet op live data | `src/lib/gekooktSource.ts:61-76`, plus `:240-261` |
| De tablabel telt wél live sends | `useUnseenSendCount.ts:31-36,110` |
| Vier van de zeven thumbnail-componenten lezen vreemde rijen | `src/lib/thumbnailRefresh.ts`, kop punt 2 |
| `friendships` is één rij per ongeordend paar | `0007_social.sql:220-262`, `unique (profile_low, profile_high)` |
| `is_friend_of` heeft vier serveraanroepers | grep over `supabase/migrations/*.sql`: `0007:614`, `0009:155`, `0009:229` |
| `listFriendships` heeft zes clientaanroepers | grep over `src/` |
| De kring is client-side vriend-versmald, niet view-gepoort | `0016_namable_recipe_votes.sql:95-96` |
| `PendingRequestsLine` bestaat en tekent alleen bij wachtende post | `FriendSuggestionRows.tsx:42-67`, `friends.tsx:103-108,485` |
| §8's vierde weigering is al één keer geamendeerd | `DESIGN-SOCIAL.md:1061-1075` |
