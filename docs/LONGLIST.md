# Longlist

De genummerde backlog. `OPEN-BESLISSINGEN.md` en de commit-messages van
september 2026 verwijzen naar de codes hieronder; dit is waar ze gedefinieerd
staan.

Ontstaan uit een vergelijking met **SlimMandje**, een Nederlandse app die
recepten uit TikTok, Instagram, YouTube, Facebook en Pinterest omzet in een
boodschappenmand bij Albert Heijn of Jumbo. De overlap met Remy is uitsluitend
de import; hun tweede helft (boodschappen, prijzen, supermarktkoppeling) is
grotendeels bewust niet overgenomen.

**Stand:** 7 september 2026, `feat/live-import-and-plan-phases`, t/m
`605c795` gepusht. ⚠ **Twee dagen werk staat ongecommit in de werkboom**, dus
voor alles wat op 6 en 7 september gebouwd is betekent `✅` hieronder
"gebouwd, getest en groen", nog niet "gepusht". Negen bestanden staan als
hernoeming in de git-index — dat is hoe `git mv` het registreert.

**Dit document is op 5 september herzien.** Alles wat af is staat nu onder
**Afgerond** onderaan in plaats van tussen het openstaande werk; het bovenste
deel gaat alleen nog over wat er nog te doen is.

**Toegevoegd op 6 september 2026: PRF-05, GAP-31 en GAP-32**, het werk dat
volgt uit PD-022 en PD-023 — de twee omkeringen die de eigenaar die dag vroeg.
Ze brengen twee nieuwe open vragen mee, I en J in `OPEN-BESLISSINGEN.md`; **I
is inmiddels beantwoord** (naam verbergen, getal behouden — migratie `0016`),
J is in de code met één regel beantwoord en staat nog niet schriftelijk vast.

**Toegevoegd op 7 september 2026: LIB-06 t/m LIB-08, PRF-06, OPS-10 t/m
OPS-12, GAP-33 en GAP-34.** De eerste vier komen uit de ontwerpronde van de
eigenaar, de drie OPS-regels uit één Expo Go-log, en de twee GAP-regels zijn
metingen die daarbij vandaan vielen — allebei een filter dat er is maar niet
filtert.

De database is bij: `0001` t/m **`0014`** draaien, nagemeten tegen de live
database met `npx supabase migration list`. ⚠ **`0015`, `0016` en `0017` staan
lokaal en niet remote**, en twee daarvan blokkeren het testen op een toestel.
De drie secrets staan er. De edge functie is gedeployed, dus de throttlepoort
en de dichting van het anon-key-gat zijn werkelijk actief. Vier checks groen:
typecheck 0, `check:functions` 0, lint 0, **3125 tests over 130 bestanden**.

| Status | Betekenis |
|---|---|
| ✅ | Gebouwd, getest, gepusht |
| 🟡 | Deels — domeinlaag af, geen scherm of geen aanroeper |
| ⬜ | Open, geen blokkade |
| 🔒 | Geblokkeerd — wacht op een beslissing, zie `OPEN-BESLISSINGEN.md` |
| ⛔ | Onderzocht en afgewezen — de blokkade is een feit, geen openstaande vraag |
| ⚖ | Onderzocht en bewust zo gelaten — een afweging, geen openstaand punt |

---

## Een ✅ betekent nu wat het zegt

**Sinds 2 september 2026 staat er niets meer tussen deze lijst en een
werkende deploy.** De drie acties die er stonden zijn alle drie gedaan, en
daarmee vervalt het voorbehoud dat hier jarenlang stond: `✅` betekende "de
code staat er", en betekent nu "dit draait". De drie, met hun herkomst,
omdat dit document één keer een onbevestigde zin als feit heeft
doorgegeven:

1. ~~Migraties~~ — **klaar, en dit blok beweerde jarenlang het
   tegendeel.** Op 2 september nagemeten tegen de live database: `0011` en
   `0012` bleken allang toegepast (de CHECK noemt `'youtube'`,
   `import_attempts` staat er compleet), en `0013` is diezelfde middag
   toegevoegd via de SQL-editor. Grootboek: `0001` t/m `0013`. **Vervalt
   daarmee: "zonder die tabel faalt élke import"** — die zin was
   overgeschreven en nooit geverifieerd. Een document nakijken vindt zoiets
   niet; alleen de database vragen vindt het.
2. ~~Secrets~~ — **alle drie aanwezig**, op 2 september door de eigenaar
   afgelezen van de secrets-pagina: `IMPORT_FINGERPRINT_SALT`,
   `YOUTUBE_API_KEY` én `GEMINI_API_KEY`. Die derde stond nooit in dit
   lijstje terwijl de hele modelroute erop draait (`env.ts:33`) — hij
   ontbrak omdát hij er al was en dus nooit gemist werd.
3. **Eén echte import door de flow, plus de throttle-test** — het enige
   losse eindje, en geen blokkade. 21 imports binnen tien minuten hoort de
   21e te weigeren met `import_throttled`. De
   resolutiekant is sinds deze sessie deels afgedekt door een ESLint-regel
   over `src/domain/import/**` (zie OPS-09), en er staat vandaag geen
   extensieloze value-import in de Deno-graaf — nagemeten: 0 van de 87
   relatieve specifiers. `deno check` blijft ongedraaid en dekt nog steeds
   wat die regel niet ziet.

---

## IMP — de importpijplijn

| # | Status | Wat |
|---|---|---|
| IMP-05 | 🔒 | **Geen codewijziging — één secret.** `callExtractionModel.ts:81` leest al `GEMINI_MODEL` via `readOptionalEnvVar` en valt alleen terug op de zwevende `'gemini-3.6-flash'` als die niet gezet is; het comment erboven zegt letterlijk "pin an exact dated snapshot via the GEMINI_MODEL secret before relying on this in production". De backlog liet dit lezen als openstaand werk; het is Project Settings → Edge Functions → Secrets, één regel. Wat de eigenaar moet kiezen is wélke snapshot, en dat is een echte keuze: het comment legt uit dat Flash-Lite bewust is gekozen op kosten, en dat eerlijk weigeren (`report_no_recipe`) het eerste is wat een kleiner model verliest. **Extra reden om dit nu te doen:** een verschoven alias faalt als `llm_request_failed`, precies dezelfde emmer als de facturatiestoring van 2 september — onzichtbaar in alles wat je kunt tellen |
| IMP-08 | — | Geschrapt: "opnieuw proberen" bestond al |

## SRC — importbronnen

| # | Status | Wat |
|---|---|---|
| SRC-04 | ⛔ | Instagram volledige extractie. **DEC-01 is beantwoord en het antwoord is nee** — Meta's gebruiksbeperking staat er onveranderd, alleen de tokeneis verviel op 15 juni 2026. Herzien vergt een licentie of een andere bron, niet een nieuwe lezing. Zie `OPEN-BESLISSINGEN.md` |
| SRC-06 | 🔒 | Facebook. Zelfde Meta-voorwaarden als Instagram, en weinig NL-kookcontent |
| SRC-07 | ⬜ | **Foto van een kookboek of screenshot — door de eigenaar gevraagd op 5 september 2026.** Juridisch het schoonste van alle bronnen: het is je eigen boek, er is geen platform wiens voorwaarden je leest, geen creator om te crediteren en geen oEmbed-endpoint dat nee zegt. Technisch is het ook de goedkoopste nieuwe route die er ligt: Gemini staat er al, is multimodaal, en `buildExtractionRequest` bouwt de aanvraag al — dit is een tweede soort *invoer* naar een pijplijn die verder onveranderd blijft, precies zoals SRC-08 dat was. **Wat het wél nieuw maakt:** camera-permissie, een afbeelding die naar de edge functie moet in plaats van tekst, en een keuze over of het beeld bewaard wordt (voorkeur: nee — lezen, verwerken, weggooien). `provenance` heeft een vierde waarde nodig naast `publisher_structured_data`, `model_from_caption` en `model_from_pasted_text`, want het bevestigingsscherm moet eerlijk kunnen zeggen dat een model dit van een foto heeft gelezen |
| SRC-09 | 🔒 | Audio-transcriptie of OCR van de video. DEC-02 is nu een besluit: telemetrie loopt, **eerstvolgende meetmoment begin oktober 2026**. Grep op `import_event outcome=no_recipe_in_caption`, per platform gesplitst. ⚠ **Het meetvenster heeft een gat:** de Gemini-facturering faalde vóór 2 september 2026 en is die dag hersteld. Dat blaast `no_recipe_in_caption` niet op — een geweigerde aanroep wordt `llm_request_failed` — maar het verkort wél de noemer, dus die periode hoort uit de oktober-meting. Zie DEC-02 in `OPEN-BESLISSINGEN.md` |

## ENT — hoe recepten binnenkomen

| # | Status | Wat |
|---|---|---|
| ENT-01 | 🔒 | **Share extension — door de eigenaar gevraagd op 5 september 2026, in zijn woorden: op de deelknop van Instagram of Facebook klikken en het met deze app delen.** Nog steeds het item met de meeste hefboom, en sinds 3 september half ontgrendeld: OPS-01 is rond, dus de SDK staat niet meer in de weg. **Wat blijft is een harde, niet-onderhandelbare blokkade: dit werkt niet in Expo Go.** Een share extension is native code — op iOS een aparte target in het app-bundel, op Android een `intent-filter` in het manifest — en Expo Go is één vaste app die alle projecten draait, dus die kan geen extensie registreren die van jouw project is. Zolang de telefoon via QR-code test, is dit letterlijk onbouwbaar. Het vraagt OPS-02: `eas.json`, `expo-dev-client`, een EAS-account, en voor iOS een betaald Apple Developer-account. Dat is de echte prijs van dit item, en hij is niet in code te betalen |
| ENT-02 | 🔒 | Achtergrond-import met notificatie. Volgt op ENT-01 |
| ENT-03 | ⛔ | **Geschrapt door de eigenaar op 2 september 2026.** Klembord-*detectie* vereist precies wat `paste.tsx:8-23` in hoofdletters verbiedt — het scherm inspecteert de geplakte string nooit om de modus te kiezen — en het kost een gemeterde modelaanroep om een link als `{text}` te versturen. De enige variant die daar niet mee botst (aanbieden wat op het klembord staat, bínnen de al gekozen modus) voegt vrijwel niets toe aan de plak-knop die al op `paste.tsx:530` staat. Twee wegen: een die een vastgelegde beslissing omkeert, en een die werk is zonder winst. Geen van beide is de moeite, dus dit item is dicht in plaats van eeuwig open |
| ENT-04 | ⬜ | Meerdere links tegelijk |
| ENT-06 | ⬜ | Deeplinks vanuit een gedeeld recept van een vriend |

## BSK — boodschappen

| # | Status | Wat |
|---|---|---|
| BSK-04 | 🔒 | **Productmatching AH/Jumbo — de blokkade is niet meer "geen API", maar "welke helft".** Onderzoek van 5 september 2026: het **mandje vullen** is wél gelicentieerd, via Food Influencers United's *Any to Basket* (`api.tobasket.com`). AH en Jumbo hangen daar sinds oktober 2025 officieel aan (Emerce en Levensmiddelenkrant, beide 21-10-2025), inmiddels 56 receptensites. Je POST ingrediëntregels, je krijgt een link terug die een echt mandje vult, en hun documentatie noemt "a buy button inside your own app" als het gebruikelijkste geval. **Prijsdata is een andere vraag en staat nergens publiek beantwoord** — dat is het eerste wat FIU gevraagd moet worden, want het beslist of BSK-05 legaal kan bestaan |
| BSK-05 | 🔒 | **Prijzen tonen en vergelijken — door niemand gelicentieerd, ook niet door de concurrent die het doet.** SlimMandje toont letterlijk wat het hele mandje kost bij AH naast Jumbo. Hun eigen artikel 6 zegt er onomwonden bij: *"SlimMandje is onafhankelijk en heeft geen formele samenwerking met Albert Heijn, Jumbo of Plus."* Awin komt alleen voor bij de uitgaande link, en hun verwerkerslijst (WhatsApp, Supabase, Hetzner, Vercel, Stripe, Awin, Groq) bevat geen prijsleverancier. Door uitsluiting: **ze halen het zelf van publieke productpagina's.** Dat is precies wat Jumbo's artikel 9 lid 3 sub ii bij naam verbiedt, met databankrecht erbij — een wettelijk recht dat los van hun voorwaarden bestaat. Opvallend: SlimMandje disclaimt in artikel 8 wél de receptinterpretatie en **niets over prijzen**, terwijl een getoonde prijs een claim aan een consument is. De keuze is dus niet technisch maar bestuurlijk, en hij hangt aan het antwoord van FIU onder BSK-04 |
| BSK-06 | ⬜ | **Naar de winkelwagen van de supermarkt — niet langer geblokkeerd.** Dit is de helft die wél kan, via FIU (zie BSK-04). Volgorde: eerst een mail naar `info@foodinfluencersunited.com`, want hun documentatie zegt dat API-toegang in bèta op aanvraag gaat in plaats van via zelfbediening. Je kunt end-to-end bouwen en testen vóór je betaalt — links zijn meteen live, alleen gesmoord op één bezoeker per minuut |
| BSK-07 | ⬜ | "Dit heb ik al in huis" — voorraadkast |

## RCP — kwaliteit van het recept

| # | Status | Wat |
|---|---|---|
| RCP-02 | 🔒 | Voedingswaarden. Overnemen uit JSON-LD is feitelijk, schatten uit een caption is verzinnen — en het is gezondheidsdata onder PD-005. Open vraag E |
| RCP-04 | ⬜ | Eigen notities bij een recept |
| RCP-05 | ⬜ | Omgang met een verdwenen bronvideo |
| RCP-08 | ✅ | **Een generiek icoon per ingrediëntcategorie — door de eigenaar gevraagd op 7 september 2026: "in plaats van een icoon voor een appel hebben en een voor een banaan, dat dit een generiek fruit icoontje krijgt, idem voor groente, zuivel, kaas, etc".** Dit draait een staande weigering om, en de reden dat dat mag staat in de nieuwe module zelf. `dishTagIcons.ts` weigerde precies dit met drie argumenten: een open glyph-vocabulaire, een matcher tussen Nederlandse woorden en tekeningen, en "welk ingrediënt is het belangrijkste" — een vraag die niets in deze codebase kan beantwoorden. **Twee van de drie zijn eraf.** Een icoon per categorie is een gesloten twaalf in plaats van onbegrensd, en `mainIngredients.ts` beantwoordt de hoofdingrediënt-vraag allang elders. Wat blijft is de matcher, en die faalt eerlijk: een woord dat de tabel niet kent levert `null` en dus géén icoon, precies de kale regel die er altijd al stond. **Gebouwd:** `src/domain/ingredientCategories.ts` (twaalf categorieën, ~250 Nederlandse woorden plus zeventien meerwoord-ingangen, hele woorden en nooit substrings — `boter` zit in `boterhamworst`, de les die `mainIngredients.ts` al betaald had), `src/components/ingredientCategoryIcons.ts` (categorie → `IconName`, volle `Record` zodat de compiler een categorie zonder tekening afkeurt), en de ingrediëntenlijst op het receptscherm die ze tekent. Normaliseert via BSK-02's `normalizeIngredientName`, dus "ui, fijngesneden" komt binnen als "ui" zonder dat deze tabel bereidingswoorden hoeft te kennen. 15 nieuwe tests. **Twee categorieën waren niet te tekenen en zijn daarom zélf getekend (RCP-09):** `zuivel` en `peulvruchten`. Gemeten over alle vijftien glyphmaps die `@expo/vector-icons` meelevert — er is geen melk, yoghurt of boter in één ervan (de enige treffer op "butter" is `butterfly`), en geen boon of linze. Anders dan bij `timer` vóór GAP-19 ging beter zoeken dat niet oplossen. **Nog niet bedraad:** de 1–3 hoofdingrediënten op Kiezen (`DecisionCard`, nu één samengevoegde string) en de portie-sheet |
| RCP-09 | ✅ | **De twee glyphs die Remy zelf tekent — door de eigenaar gevraagd op 7 september 2026: "Kan je van zuivel en peulvruchten een icoon laten genereren?"** Elk ander icoon in de app is van iemand anders; deze twee bestaan omdat het alternatief niets was (zie RCP-08). **Een `.ttf` genereren is overwogen en afgewezen** — fontTools staat lokaal en WS4 §1 had die route al uitgetekend — op deze repo's eigen maatstaf: een `.ttf` is een binair blok dat niemand in een diff kan lezen of met de hand corrigeren, plus een generatiescript dat moet blijven werken en codepoints die stil kunnen verschuiven. Een SVG-pad is tekst in de bron. **De prijs is één nieuwe dependency**, `react-native-svg`, gepind op 15.15.4 omdat dat de versie in Expo SDK 57's `bundledNativeModules.json` is — en dáárin staan is wat hem in Expo Go laat werken zonder development build, de blokkade die ENT-01 nog steeds tegenhoudt. ⚠ Dat is uit het SDK-manifest gelezen, niet op een toestel gezien. **De seam kreeg er een derde familie bij** (`remy`) voor één unielid, één constructor en één tak in `Icon.tsx`; geen aanroepplek bewoog, voor de tweede keer in twee dagen. **Beide vormen zijn gerasterd en bekeken vóór ze bleven staan**, en dat was geen formaliteit: de eerste melkverpakking las als een pot en is opnieuw getekend, en een kale puntgevel las als een huis. Wat dat niet vaststelt: gerasterd met Pillow en niet met react-native-svg, en geen toestel heeft ze getekend — de geometrie is dus geverifieerd en de rendering niet. De erwten in de peul zijn zwak op 16 fysieke px en helder vanaf 24; het oppervlak rendert op 16 punten, wat 32 of 48 px is op een 2x/3x-scherm |

## PRF — huishouden en voorkeuren

| # | Status | Wat |
|---|---|---|
| PRF-01 | ⬜ | Dieetprofielen in één tik. Machinerie bestaat al; let op de grens tussen voorkeur en Artikel 9-data |
| PRF-03 | ⬜ | Instellingen zijn alleen bereikbaar via een tekstlink |
| PRF-04 | ⬜ | Tweede volwassene in hetzelfde huishouden (uitnodigingsstroom ontbreekt) |
| PRF-06 | ✅ | **Gerechttype — door de eigenaar gevraagd op 6 september 2026: "dat een recept bijvoorbeeld een voorgerecht, bijgerecht of toetje is, standaard is iets een hoofdgerecht".** Migratie `0017`, kolom met CHECK op vier waarden en `not null default 'hoofdgerecht'`. **Dit is de derde taxonomie op een maaltijd** en de scheiding is de moeite van het vastleggen waard: `dishTags` is waar een gerecht **van gemaakt** is (meerdere, EN-gefilterd, door het model bij import geschreven), `dishMoods` waar het **op lijkt** (meerdere, OF-gefilterd, door een mens na het koken geschreven), en `dishCourse` **waar het in de maaltijd zit** — precies één waarde, en de enige van de drie met een standaard. Cardinaliteit en die standaard zijn de structurele toets: zet `toetje` bij de tags en `['toetje','voorgerecht']` wordt uitdrukbaar, waarna het EN-filter een vraag aanbiedt die per definitie leeg is. Bewerkbaar op het receptscherm naast LIB-08, als twee aparte rijen — één gedeelde rij zou precies de combinatie uitdrukbaar maken die `0017` weigert. ⚠ `setMealDishCourse` was gebouwd én getest en is daarna **weggegooid**: met de course bewerkbaar op het bewerkscherm zou het een repository-naad met nul aanroepers zijn — exact het patroon van GAP-31 |
| PRF-05 | ✅ | **Delen wordt de standaard, en de weigering een vinkje bij het koken — door de eigenaar gevraagd op 6 september 2026, vastgelegd als PD-022.** `households.share_cooks_with_friends` staat sinds `0009:103` op `not null default false`; de default draait om, en de weigering verhuist van het zeldzame geval naar het gewone: een klein vinkje op het moment van koken, standaard aangevinkt, dat je aantikt om één gerecht voor jezelf te houden. `Deel deze niet` blijft er los naast staan — het vinkje gaat over déze kooksessie, de uitsluiting over de hele geschiedenis van dat gerecht. **Het scherpste stuk van dit item is wat er NIET gebeurt:** geen enkele migratie mag delen namens iemand aanzetten. Een nieuw huishouden begint aan; een bestaand huishouden dat de vraag nooit beantwoord heeft blijft uit tot het gevraagd wordt, met het vakje voorgevinkt. De migratie verandert dus een kolomdefault en nul rijen. **Wat mee moet in dezelfde wijziging, want het is nu onwaar:** `COOK_SHARING_CONSEQUENCE[2]` eindigt op *"Daarom staat dit uit tot je het zelf aanzet"*, en `CookSharingAskSheet.tsx`'s header eist dat de vraag gesteld wordt met de knop "visibly off and no pre-selection". Een voorgevinkt vakje naast een zin die zegt dat het uit staat is geen default-wijziging maar een onwaarheid. De vier consent-paragrafen zelf blijven staan — PD-005 verandert niet, alleen de stand van de knop. ⚠ **Open vraag J:** `shouldAskCookSharing` (`addFriendCopy.ts:601`) is `acceptedFriendCount === 1 && !alreadyAsked`, dus een bestaand huishouden met twee of meer vrienden kan contextueel nooit meer gevraagd worden | **Gebouwd op 6 september**, migratie `0015`: die verandert een kolomdefault en **nul rijen**. Het vinkje staat op `OutcomeCard`, aangevinkt als standaard, en rendert alleen als het huishouden ook echt deelt. `CookSharingAskSheet` vraagt het bestaande huishouden alsnog, met het vakje voorgevinkt en een eigen `Klaar` — het vakje legt niet meer zelf vast, want een misgetikt vakje op een vraag die één keer gesteld wordt is permanent. Open vraag J is met één regel beantwoord (`shouldAskCookSharing` van `=== 1` naar `>= 1`) en staat nog niet schriftelijk vast

## LIB — de bibliotheek

| # | Status | Wat |
|---|---|---|
| LIB-02 | 🔒 | Collecties. Botst met PD-004a — mappen zijn hoe je een kerkhof bouwt. Open vraag F |
| LIB-05 | ⬜ | Thumbnails hangen aan een externe CDN |
| LIB-06 | ✅ | **De bibliotheek opnieuw ingedeeld — door de eigenaar gevraagd op 6 september 2026, in zijn woorden: "de filters zijn te groot", "3 recepten breed" en "de pagina is nu te rommelig".** "Te groot" bleek een meting en geen mening: op 393×852 met zes dish tags — de gewone stand na een recept of vijftien — nam de balk plus header **452 van de 714 beschikbare punten**, wat neerkomt op **0,83 zichtbare tegelrij**. Met zeventien tags en zes moods was het 813pt en begon het raster **onder het scherm**. En hij kromp niet: Yoga zet `flexShrink` standaard op 0, dus het raster werd eruit geduwd in plaats van samengedrukt. **WS2 had de oplossing al geschreven en niemand had hem toegepast** — "chip rows never wrap, one row each, fixed 47pt, horizontally scrolling". Nu: header 136 → 68pt, zoekbalk met de klok ernaast, twee zijwaarts scrollende rijen, raster van 3 breed op 4:5. Chrome **262pt**, **3,03 tegelrijen**, en het slechtste geval is wég in plaats van kleiner — de balk is nu even hoog bij elke bibliotheekgrootte. ⚠ WS2 §5.2 wees drie kolommen destijds op meting áf (een titel van vijf regels bedekt 85% van de foto); de eigenaar vroeg er expliciet om, en het antwoord is een titel op twee regels. Dat is het eerste om op een toestel te bekijken |
| LIB-07 | ✅ | **De twee filterdefecten die de audit van 6 september opmat.** (1) **Chips herberekenden zich nooit tegen je selectie.** `requiredDishTags` is een EN-filter, maar de chiprij werd gevuld uit de *volledige* vijver — dus na één keuze stonden alle zestien overige chips er nog, en elke chip die niet met de eerste samen voorkomt gaf een leeg raster, zonder dat iets op het scherm zei dat de tweede keuze zou versmallen. Nu narrowt de EN-as mét zijn eigen selectie erin en narrowen de OF-assen zonder, en alle drie voegen de selectie terug toe zodat de chip die een leeg raster ongedaan maakt nooit verdwijnt. (2) **Het planningsfilter bestond niet en kostte vrijwel niets:** `scheduling.state` (deze week / ooit / al gekookt / geen planning) werd al berekend en stáát al als badge op elke tegel — het is de enige as waarvan de data voor 100% gevuld is. De reden dat het ontbrak was een grens en geen beslissing: `filterLibraryRows` is generiek over `{ meal: Meal }` en kan `scheduling` niet zien. ⚠ **Kiezen heeft helft (1) nog niet** — zie GAP-33 |
| LIB-08 | ✅ | **`dishTags` zijn aanpasbaar — door de eigenaar gevraagd op 6 september 2026: "Kan je de tags niet aanpassen handmatig?"** `UpdateMealRecipeInput` had geen `dishTags`-veld, en `repository/types.ts:137` zei dat ook met zoveel woorden ("no screen edits them today"). De enige schrijver was het model bij import; handmatige invoer schreef `[]`. **Gevolg: een recept dat het model verkeerd tagde, of dat je zelf typte, was permanent onvindbaar via `Waarmee?` en niemand kon dat repareren.** Het meest gebruikte filter in de app was dus stuk voor een deel van elke bibliotheek, en geen werk aan de filterbalk repareert dat — alleen een schrijver. Nu een chiprij op het bewerkscherm, samen met het gerechttype (PRF-06), als twee rijen met één keer opslaan. ⚠ Eén gedragswijziging: een opgeslagen tag buiten de vaste lijst verdwijnt zodra het recept via de editor wordt opgeslagen. Hij was toch al onfilterbaar en werd nooit getoond |

## OPS — platform en onderhoud

| # | Status | Wat |
|---|---|---|
| OPS-02 | 🔒 | **Geen development build-pijplijn — maar niet langer de blokkade voor testen.** Sinds OPS-01 draait de app op SDK 57, de versie die Expo Go ondersteunt, dus hij is nu zonder build en zonder betaald Apple-account op een iPhone te zetten. Wat een ontwikkelbuild nog steeds nodig heeft is ENT-01: een share extension is een native module en die draait per definitie niet in Expo Go. Daarvoor is `eas.json`, `expo-dev-client`, een EAS-account en voor iOS een betaald Apple Developer-account nodig; geen daarvan bestaat in deze repo |
| OPS-03 | 🔒 | Engelse vertaling. Geen i18n-laag; copy zit hardcoded in tientallen `*Copy.ts`-modules. Open vraag H |
| OPS-04 | ⬜ | Fixtures naast de echte paden |
| OPS-10 | ✅ | **Negen niet-route-modules stonden in de routemap, en de oorzaak was een aanname die in vier headers als gecontroleerd feit stond.** Expo Go logde bij elke start negen keer *"Route … is missing the required default export"* — fixtures, twee dataloaders, een param-parser en de dev-scenario's. `_devScenarios.tsx` beweerde in zijn eigen header dat het `_`-voorvoegsel "load-bearing" is tegen expo-router; **onwaar**, `expo-router/_ctx.js` sluit in SDK 57 alleen `+api` en `+html` uit, en alleen `_layout` is bijzonder. Drie andere headers argumenteerden uit diezelfde fout. Verhuisd naar `src/fixtures/` (de vijf fixtures, bij elkaar omdat *het pad het waarschuwingslabel is* — `grep -rn "@/fixtures" src/` beantwoordt nu in één commando wat er nog op nepdata draait), `src/lib/` (de twee dataloaders), `src/components/ImportDevScenarioRow.tsx` en `src/navigation/importRouteParams.ts`. 18 importspecificaties herschreven, nul stringverwijzingen. ⚠ **Bijvangst die groter is dan de opruiming:** `src/app/friends/[feedItemId].tsx` rendert fixtures **zonder `__DEV__`-poort en zonder vlag** — op elke build, niet alleen in dev. Zie GAP-32 |
| OPS-11 | ✅ | **De require cycle tussen `urlParsing.ts` en `resolveShortLinkTarget.ts`.** Expo Go waarschuwde er bij elke start voor. Hij was **expres** aangelegd — `urlParsing.ts:72` noemde hem letterlijk "a deliberate import cycle" — en nagemeten ook echt **inert**: elke top-level binding in beide bestanden is een letterlijke waarde, en de twee namen die de grens overstaken worden alleen binnen functies gelezen, dus Metro's "can result in uninitialized values" is hier nooit uitgekomen. Toch opgelost, om twee redenen die in de nieuwe comments staan: een WARN bij elke start is hoe een log zijn lezer aanleert waarschuwingen over te slaan, en die onschadelijkheid is een eigenschap van wáár de aanroepen vandaag staan — verplaats er één naar module-niveau en het klopt stilletjes niet meer. `isBlockedRedirectHost` staat nu byte-identiek in `privateNetworkHosts.ts`, waar beide bestanden één kant op naar wijzen. De functienaam bleef, want `supabase/functions/parse-recipe/fetchSourceText.ts:166` importeert hem bij naam en die map wordt door geen typechecker gecompileerd — een hernoeming duikt pas bij deploy op |
| OPS-12 | ✅ | **`expo-notifications` op moduleniveau geïmporteerd, en dat was geen waarschuwing maar vermoedelijk een startfout op Android.** `warnOfExpoGoPushUsage` **gooit** op Android in plaats van te waarschuwen, en met de import op moduleniveau gebeurde dat tijdens de evaluatie van `_layout.tsx` — dus de app kwam er daar waarschijnlijk niet doorheen, over een push-functie die dit product bewust niet heeft (GAP-30, de 16:00-melding is lokaal). De import staat nu binnen de bestaande `try`, waar het `{ kind: 'unavailable' }` wordt dat de aanroeper al afhandelde. Eerlijk uitgesplitst: de twee waarschuwingen zijn **weg** bij elke start die niets inplant (`armDecisionNotification` keert vroeg terug als `!canUseApp`) en **uitgesteld, niet weg** bij een start die wél inplant; de tweede is onvermijdelijk zolang de functie in Expo Go bestaat, en dat staat als comment vast. Dat bestand had **nul tests**, précies om die statische import — `expo-notifications` trekt `expo-modules-core` binnen, dat in de node-testrun niet parseert. Nu 17. ⚠ Alleen uit broncode plus de log afgeleid; Android is niet op een toestel bevestigd |
| OPS-07 | ⬜ | Werken zonder verbinding |
| OPS-09 | 🟡 | Deno's resolutieregel is nu **half** afgedekt, en dat is een echte stap. `lint/eslint.flat.config.mjs` draagt een `@typescript-eslint/no-restricted-imports`-regel over `src/domain/import/**` die een relatieve **value**-import zonder `.ts` afkeurt. `allowTypeImports: true` is het dragende stuk: de 14 extensieloze imports in die map zijn allemaal `import type`, die Deno wist vóór resolutie, dus die mogen niet afgekeurd worden. Empirisch nagemeten: 0 fouten op `src/domain/import`, en de regel vuurt wél op een echte overtreding (`src/lib/auth.ts:29`). Nul nieuwe dependencies — `typescript-eslint` zat er al. **Wat nog open is:** `supabase/functions/**` staat nog steeds in ESLint's `ignores`, dus die 13 bestanden zijn onbewaakt (ze zijn vandaag allemaal correct), en een aanwezige-maar-verkeerde extensie (`./x.js` voor een `x.ts`) vangt alleen `deno check`. `deno check` is nog nooit gedraaid; Deno is niet geïnstalleerd |

## BIZ — verdienmodel

| # | Status | Wat |
|---|---|---|
| BIZ-01 | 🔒 | Geen verdienmodel, kosten lopen per import op |
| BIZ-02 | ⬜ | SlimMandje's prijs is hun zwakste plek volgens hun eigen reviews |
| BIZ-03 | 🔒 | Waar ligt de betaalgrens? Niet op imports, niet op de sociale laag. Open vraag D |
| BIZ-04 | ⬜ | Makers als kanaal in plaats van als risico (PD-007 bouwt de opt-in al) |

---

## GAP — gevonden tijdens het bouwen

Niet uit de SlimMandje-vergelijking. Deze stonden lang zonder code, waardoor
een commit er niet naar kon verwijzen; sinds 2 september hebben ze er één.

| # | Status | Wat |
|---|---|---|
| GAP-32 | ⬜ | **De Vrienden-tab is op echte data grotendeels inert, en dat is nergens opgeschreven.** Nagemeten op 6 september 2026. Drie dingen, oplopend in ernst. (1) **Bewijskaarten zijn niet aantikbaar:** `renderFeedCard` (`src/app/(tabs)/friends.tsx:445-459`) geeft `onPress` alleen aan `FriendRecipeCard`; `FriendProofCard` krijgt er geen, dus de helft van de lijst die PD-015 "de vloer" noemt opent niets. (2) **`/friends/[feedItemId]` draait op fixtures**, en dat zegt het bestand zelf in hoofdletters in zijn eigen header ("FIXTURES ONLY — no fetch, no repository, no Supabase", `:49`) — dit is dus géén onwaarheid in een document maar onaf werk dat nergens een code had. (3) **`Bewaren` bestaat niet:** `grep -n "SaveIntentSheet\|Bewaren" src/app/friends/[feedItemId].tsx` geeft nul treffers, terwijl `DESIGN-SOCIAL.md` §3.3 die ééne tik "the reaction — there is deliberately no lighter one" noemt en §4.3 hem specificeert. Het gevolg samen: een gedeeld recept kun je bekijken noch bewaren, dus de enige handeling die de ontvanger heeft ontbreekt. Zelfde patroon als GAP-30 en GAP-31 — gespecificeerd, half bedraad, onzichtbaar voor elke test |
| GAP-31 | ✅ | **Ranglijst heeft nooit een schrijver gehad, en dát is waarom hij leeg is — niet het beleid dat iedereen aanwees.** Nagemeten op 6 september 2026 met één grep over de hele boom: `rateRecipe` heeft twee implementaties (`localSocialRepository.ts:357`, `supabaseSocialRepository.ts:268`), één interfaceregel (`social/types.ts:398`) en **nul aanroepers** — elke aanroepplek in de repo staat in `tests/repository/`. Niets onder `src/app/**`, `src/components/**` of `src/domain/**` roept hem aan. De lege ranglijst werd gelezen als een gevolg van PD-019's scheiding tussen privé-cijfer en openbare stem; het was er geen. `DESIGN.md` §10 zei het al letterlijk — "a repository seam, `rateRecipe`, with no screen behind it" — en niemand trok de conclusie. Dit is precies het patroon dat GAP-30 en `friendProof.ts` al twee keer vastlegden: een volledig gespecificeerde functie waarvan de bedrading nooit gelegd is, onzichtbaar voor elke test omdat er niets te testen valt. **Het werk (PD-023):** het cijfer dat je je eigen kooksessie geeft wordt ook als openbare stem op het canonieke recept uitgebracht. Goedkoop, want de schalen zijn al identiek — `cook_events.rating` en `recipe_ratings.rating` zijn allebei `numeric(4,2)` met dezelfde CHECK sinds `0008`, en `src/domain/rating.ts` bezit beide. **De grens die blijft:** alleen een maaltijd met een `recipeId` kan stemmen; een zelfgetypt gerecht rangschikt niets. En één stem per persoon per recept (`0007:488`), dus twee keer hetzelfde koken vervángt je stem in plaats van er een toe te voegen. ⚠ **Open vraag I:** `recipe_ratings` draagt `rater_profile_id` en `recipe_ratings_select` is `using (auth.uid() is not null)` (`0007:516`), en `buildKringMetaLine` noemt stemmers bij naam — dus het vinkje uit PRF-05 onderdrukt je naam op Gekookt en niet op de kringregel | **Gebouwd op 6 september.** Eén gebaar schrijft nu twee rijen; de schalen bleken al gelijk (`numeric(4,2)`, dezelfde CHECK sinds `0008`), dus er wordt niets omgerekend. De openbare schrijfactie kan de private niet laten falen — hij geeft `'cast' | 'skipped' | 'failed'` terug in plaats van te gooien. **Open vraag I is beantwoord** (naam verbergen, getal behouden): migratie `0016` maakt de view `namable_recipe_votes`, géén kolom, om de reden die `0009` voor `shared_cooks` geeft — een trigger-onderhouden vlag vraagt triggers op vijf bronnen, en wie er één mist blijft `true` zeggen voor een huishouden dat gevraagd heeft verborgen te worden, onzichtbaar. De globale schakelaar poort ook, maar versmald via `meals`, zodat een stem die iemand vanaf het bord uitbracht zonder ooit gekookt te hebben zichtbaar blijft
| GAP-33 | ⬜ | **Kiezen narrowt zijn chips nog niet mee, de bibliotheek nu wel — de filterbug is dus half weg.** LIB-07 repareerde het in `src/domain/recipeSearch.ts` en exporteert `collectSelectableDishTags/Moods/Courses`; `src/app/(tabs)/index.tsx:273` houdt nog een eigen privé-kopie van `collectAvailableDishTags`. Kies op Kiezen twee chips die niet samen voorkomen en je krijgt nog steeds een leeg resultaat, met niets op het scherm dat zegt waarom. **Het is geen overname van één functie:** de bibliotheek werkt met `LibrarySearchState`, Kiezen met `DecisionFilters` (dat geen course-as heeft), en Kiezen berekent zijn chips bij het *laden* in plaats van per render — meenarrowen vraagt dus dat die berekening naar de render verhuist, waar de actieve filters bekend zijn. **Wat Kiezen wél al heeft:** `selectOfferableMeals` (`src/domain/offerablePool.ts`), dat de standaardpoorten van `decide()` — restricties, tijdbudget, niet-geverifieerde allergenen — draait vóórdat de chips verzameld worden. Dat repareerde de andere helft: de balk beloofde in hoofdletters dat hij "never offers a filter guaranteed to return nothing" en dat was onwaar |
| GAP-34 | ⬜ | **Dislikes doen letterlijk niets, en de oorzaak is groter dan het filter.** Je typt `paddenstoelen` — het voorbeeld dat de app zelf in de placeholder voorstelt — het wordt opgeslagen, en het sluit **nooit** een gerecht uit. Dislikes worden vergeleken met `Meal.ingredientTags` (`exclusions.ts:123`), en dat veld wordt uit precies één bron gevuld: de EU-14 allergenen-chipkeuze bij import (`confirm.tsx:226`, `AllergenTaggingSection.tsx:111`). `paddenstoelen` staat daar niet in, en geen enkele vrije tekst ooit. **De kern eronder, nagemeten met één grep: `MealIngredient.name` — de echte ingrediëntnamen — wordt door geen enkel filter in de hele app gelezen**, alleen voor weergave (boodschappen, koken, receptscherm, bewerken). Er is dus geen ingrediëntfilter; er is een allergenenfilter dat eruitziet als één. Twee producten vallen uit één wijziging: de zoekbalk gaat ook over ingrediënten (nu alleen titels, `recipeSearch.ts:166`), en een dislike kan eindelijk iets uitsluiten. ⚠ Die twee mogen géén predicaat delen — `recipeSearch.ts:41-47` legt uit waarom je eigen bibliotheek doorbladeren niet de plek voor een veiligheidspoort is |
| GAP-30 | ⬜ | **De 16:00-push bestaat niet, en dat is de functie waar de app naar vernoemd is.** Gevonden op 5 september 2026 tijdens de SlimMandje-vergelijking, buiten die vergelijking om. Alle onderdelen liggen klaar en géén ervan is verbonden: de tabel `push_tokens` staat sinds `0001_init.sql:727` met een index erbij, `expo-notifications` staat in `package.json`, en `ARCHITECTURE.md` beschrijft onder "How the 16:00 push works" de hele werking. Maar `supabase/functions/daily-decision/` bevat alleen een `.gitkeep` van 22 augustus, en `expo-notifications` wordt in **nul** bestanden onder `src/` geïmporteerd — nagemeten, niet aangenomen. **Het gevolg is dat de kernlus geen startknop heeft:** het hele product is "om 16:00 beslist Remy wat je eet en zegt het je", en er is geen enkele weg waarlangs dat bericht een telefoon bereikt. Je moet de app zelf openen en zelf naar Kiezen gaan. Dit is precies het patroon dat GAP-22 en `friendProof.ts` al twee keer eerder vastlegden — een volledig gespecificeerde functie waarvan de bedrading nooit gelegd is, en waar geen test iets van merkt omdat er niets te testen valt |
| GAP-02 | 🟡 | **`recipes.platform` CHECK.** `0011` verbreedde naar `'youtube'`; `'web'` bleef er bewust uit tot de staleness-vraag beantwoord is. Open vraag A. ⚠ Wie `'web'` toevoegt moet `STORED_ROW_PROVENANCE` in `src/domain/import/canonicalRecipe.ts` in dezelfde wijziging meenemen — die rapporteert élke opgeslagen rij als `'model_from_caption'`, en een webrij is `'publisher_structured_data'` |
| GAP-08 | ⚖ | `CreateMealInput.dishTags` **blijft optioneel — beslist door de eigenaar op 2 september 2026, tegen de analyse in, en dat is de reden om het hier vast te leggen in plaats van de regel te schrappen.** Wat het onderzoek vond: het comment dat het veld verdedigt is géén post-hoc rationalisatie — `git blame` legt veld én verdediging in één commit (`9503caf`, 25 augustus) — maar zijn premisse ("elke aanroeper is een scherm dat misschien nog geen categorieën heeft") is empirisch onwaar: negen van de negen constructieplekken noemen het veld al. De blast radius is nagemeten en **nul**: `readonly dishTags:` plus `tsc --noEmit` geeft exit 0, dus de backlog's "ripplet door naar `tests/repository/`" was onjuist. **Waarom het tóch blijft:** het tweelingveld `recipeId?` rust in hetzelfde bestand op hetzelfde argument, en één van de twee verplicht maken breekt de symmetrie die dat bestand verdedigt — terwijl `recipeId` niet mee kán, want dat wordt op drie plekken wel echt weggelaten. Wie dit heropent behandelt béíde velden in één wijziging. ⚠ Het bijvangst-signaal op `mirror/rows.ts:211` (`dish_tags` zonder `??`-fallback terwijl drie buren er wel één hebben) is nagekeken en **geen bevinding**: die drie buren zijn optioneel op `Meal`, `dishTags` is verplicht (`types.ts:290`), dus een fallback zou dode code zijn |
| GAP-09 | ⚖ | **De read-then-write race in de throttle.** Twee gelijktijdige verzoeken van dezelfde beller kunnen allebei onder het plafond lezen. Dichten kost een extra round trip op élke import om een handvol modelaanroepen terug te winnen; het oordeel is dat het lek acceptabel is en de kosten niet. Een licht overschreden plafond is bekend gedrag, geen bug. Open vraag C |
| GAP-11 | 🟡 | **De onjuiste tellingen zijn weg, de onvolledige niet.** Gerepareerd: `index.ts` noemde "nine sibling modules" en somde er negen op terwijl het er elf zijn — de twee ontbrekende waren `importBudget.ts` en `supabaseImportBudgetStore.ts`, dezelfde IMP-06/IMP-10-wijziging die GAP-10 veroorzaakte; `importResult.ts` zei vijf modules importeren `types.ts`, het zijn er acht; `types.ts` beweerde dat een gebroken specifier "door niets" wordt gevangen, wat sinds `check:functions` onwaar is; en `index.ts:191` zei dat geen typechecker deze map ziet, wat diezelfde dag ophield te kloppen. **Wat blijft staan:** een zestal comments zegt dat `supabase/functions/**` buiten `tsc --noEmit`, ESLint en vitest valt. Dat is niet ónwaar — de root-tsconfig sluit de map echt uit, en de ESLint- en vitest-helften kloppen onverkort — maar het is onvolledig sinds `check:functions`, en hun architectuurargument (leg logica in `src/domain`) rust nog steeds op de twee helften die wél gelden. Losse comment-edits, geen haast |
| GAP-12 | 🟡 | **Inloggen per link werkte op een telefoon niet, en de ontbrekende helft was het ontvangen.** `requestMagicLink` stuurde altijd al een link met `emailRedirectTo`, en `supabase.ts:52-59` legt uit dat `detectSessionInUrl` web-only is omdat de link op native als deeplink binnenkomt en expliciet ingewisseld moet worden — maar niets wisselde hem in. De mail opende de app en de app negeerde hem; op een iPhone zie je dan een sprong door Safari en kom je niet langs het inlogscherm. Gebouwd: `readAuthRedirect` (`src/domain/social/authRedirect.ts`, 13 tests) leest de fragmenttokens, `completeSignInFromUrl` zet de sessie, en `Linking.useURL()` in `_layout.tsx` vangt zowel een koude start als een draaiende app — twee verschillende API's, en alleen de eerste vangen werkt in elke test en faalt voor elke echte eerste login. **🟡 omdat er nog een dashboardactie bij hoort:** de redirect-URL moet in Supabase onder Authentication → URL Configuration → Redirect URLs staan, en onder Expo Go bevat die je LAN-IP, dus hij verandert met je netwerk. Een ontwikkelbuild met het vaste `remy://`-schema maakt dat blijvend |
| GAP-13 | ⬜ | **Het UI-onderzoek vond fouten in de staande documenten, en die zijn nooit teruggevouwen.** `ui-research/ASSEMBLY.md` zegt expliciet dat het "what the research found to be factually wrong in the standing documents" vastlegt. `DESIGN-SOCIAL.md` is bij het landen van de makeover (`5cca816`) bijgewerkt; `DESIGN.md` (27 aug), `PRODUCT-DECISIONS.md` (27 aug) en `ARCHITECTURE.md` (23 aug) niet — alle drie van vóór het onderzoek. Die correcties leven dus alleen in `ui-research/`, terwijl `DESIGN.md` uit tientallen bronbestanden wordt aangehaald als gezag. Gevonden op 3 september bij het opruimen van `docs/`, en de reden dat die map blijft staan terwijl de drie procesdocumenten eromheen verwijderd zijn |
| GAP-14 | 🟡 | **Inloggen met een getypte code, in plaats van een link.** `auth.ts` betoogde jarenlang dat een code "the better fit for a phone app" is en dat hij "not available to us" was: de code staat alleen in de mail als de template `{{ .Token }}` bevat, en Supabase zet template-bewerking achter custom SMTP. Dat argument stond nog steeds; alleen de premisse veranderde. Gebouwd: `readSignInCode` (`src/domain/social/signInCode.ts`, 11 tests) beoordeelt de invoer vóór er een verzoek aan opgaat, `verifySignInCode` wisselt hem in via `verifyOtp` met `type: 'email'` — níét `'magiclink'`, want dat verwacht de hash uit een aangeklikte URL en laat elke juiste code als ongeldig terugkomen — en `sign-in.tsx` heeft een tweede formulier met `textContentType="oneTimeCode"`, zodat iOS de code boven het toetsenbord aanbiedt en de reis naar de mail-app helemaal wegvalt. **Verlopen en onjuist zijn aparte uitkomsten**, omdat het ene je terugstuurt naar de mail en het andere naar een nieuwe aanvraag. 🟡 tot custom SMTP staat: zonder dat blijft de template onbewerkbaar en komt er geen code in de mail |
| GAP-18 | 🟡 | **Eén van de drie resterende WS1-onderdelen is nu wél toegepast.** `ASSEMBLY.md:218-220` noemt de volledige prijs: "26 colour values per scheme, five `fontFamily` entries, one `typeScale.button` family, three `radii` values, two `@expo-google-fonts` packages added and one removed. No new component." De kleuren waren al gedaan; **`typeScale.button` is nu van monospace af** naar `fontFamily.sansMedium` met `letterSpacing` op 0 — het enige token dat het onderzoek bij naam vroeg, twee keer en van twee kanten: WS1 noemt het "the single-token change with the highest ratio of effect to risk in the repo" (`Ja · Iets anders · Niet koken` leest in mono als een shellprompt), en WS6 kwam er onafhankelijk op uit via `Stuur`, de warmste tik in het product, gerenderd als een terminalcommando. Geen nieuw font: `Archivo_600SemiBold` werd al geladen. **Wat blijft staan:** de vijf `fontFamily`-entries (de families zelf staan nog op Archivo + IBM Plex Mono), de drie `radii`-waarden (nog 0/4/8/16/999), en WS2 t/m WS6 op layout, copy en de sociale laag. De iconen-, beeld- en motionhelft daarvan is wél nagelopen — zie `STYLING-PLAN.md` en GAP-19 t/m GAP-23 |
| GAP-19 | ✅ | **Er is nu een icoonfont, en het stond er al — gebouwd op 7 september 2026.** WS4 §1 koos een gegenereerde Phosphor-subset op grond van één juiste waarneming: Feather heeft nul keukenglyphs, nagemeten en waar. Maar Feather is één van de **vijftien** families die `@expo/vector-icons` al meelevert, en de andere veertien waren nooit gecontroleerd. MaterialCommunityIcons heeft er **7448** en tekent alle zeventien `DISH_TAGS` — zonder nieuwe dependency, zonder `.ttf`-generatie en zonder buildstap. **De conclusie van WS4 was juist voor de premisse die onderzocht was; de premisse was te smal**: één bron uitputtend nagekeken, veertien buren overgeslagen. **Wat er gebouwd is:** `iconFont.ts` geeft geen kale glyphnaam meer terug maar `{ family, name }`, zodat `Icon.tsx` elke naam in de `name`-prop van zijn eigen familie legt en de compiler hem tegen de echte glyphmap houdt — een `Record<IconFamily, Component>` was het afgewezen alternatief, want dan compileert `pot-mix` als Feather-glyph en tekent als leeg vierkantje. `isIconAvailable` ging van 15 van de 33 naar **33 van de 33**; geen enkele aanroepplek is aangeraakt, wat de belofte was die de seam deed. `timer` kreeg eindelijk een eigen glyph (`timer-sand`, niet de klok — het argument "een polshorloge is geen kookwekker" overleeft de wijziging). **De prijs, gemeten:** MaterialCommunityIcons kost **1277 KB `.ttf` plus 212 KB glyphmap-JSON** tegen Feathers 54,3 KB en 6,0 KB — achttien glyphs van de 7448, dus 0,24% van de glyphs voor 100% van het gewicht. De goedkopere weg (`createIconSet` met een eigen glyphmap tegen dezelfde `.ttf`) is bewust niet genomen: die kost de compilercontrole en spijkert codepoints vast. ⚠ **Drie van de zeventien mappings zijn een gok en geen meting** — het font heeft geen aardappel, geen salade en niets veganistisch, dus `aardappel → food-variant`, `salade → leaf` en het kruisende dieetpaar (`vegetarisch → sprout`, `veganistisch → leaf-circle`) horen door een mens beoordeeld te worden; ze staan met die waarschuwing in `iconFont.ts` zelf. **Wat hierdoor niet meer geblokkeerd is en nog wel openstaat:** de **21 empty-state markeringen** uit WS4 §5.3-5.5, nog steeds nul geleverd. En de zeventien chips zijn nooit op een toestel gezien. Zie `HANDOVER.md` punt 6 voor de volledige verantwoording |

---

## Afgerond

Alles wat gebouwd, getest en gepusht is. **Hierheen verplaatst op 5 september
2026, niet verwijderd**, om één reden: andere documenten, commit-messages en
codecommentaar verwijzen naar deze codes bij naam — "zie GAP-10", "dezelfde
poort als IMP-06". Een code die nergens meer op uitkomt maakt die verwijzingen
stuk, en de argumentatie bij een afgerond punt is juist wat je nodig hebt als je
later wil weten waaróm iets werkt zoals het werkt.

Het bovenste deel van dit document gaat vanaf nu alleen over wat er nog te doen
is. Dat was het verzoek; dit is de vorm die het inwilligt zonder de geschiedenis
weg te gooien.

### IMP — de importpijplijn

| # | Status | Wat |
|---|---|---|
| IMP-01 | ✅ | TikTok-shortlinks (`vm.`/`vt.`) worden nu server-side uitgeklapt, met begrensde hops, timeout per hop en validatie van de eindbestemming |
| IMP-02 | ✅ | Creator-attributie op `no_recipe_in_caption` — was een KNOWN GAP |
| IMP-03 | ✅ | `unsupported_url` noemt nu welke platforms wél werken |
| IMP-04 | ✅ | Instagram `missing_credentials` — opgelost via de tokenloze oEmbed-route |
| IMP-06 | ✅ | Rate limiting. Migratie `0012` is de duurzame teller, `supabaseImportBudgetStore.ts` leest hem, en de poort in `index.ts` handhaaft. Een beller zonder `sub` — de anon key — wordt geweigerd in plaats van gemeterd. **Draai `supabase db push` vóór deploy** |
| IMP-07 | ✅ | Import-telemetrie. Eén structurele regel per uitkomst, geen SDK, geen tabel, geen PII. Dit is de meetbron voor SRC-09 |
| IMP-09 | ✅ | **De tekst die Remy las staat nu naast het lege formulier.** De handmatige route bestond al (`paste.tsx:487`, `manualEntryIsPrimary` per uitkomst, maker en URL reizen mee); wat ontbrak was dat hij leeg opende, zodat je terug naar TikTok moest om tekst over te lezen die al op het toestel stond. `sourceTextCopy.ts` (14 tests) beslist of en hoe hij verschijnt, `SourceTextPanel.tsx` tekent, en `ImportConfirmParams.sourceText` draagt hem over de router-hop — verplicht veld, want de overkant kan hem niet terughalen zonder de fetch én de modelaanroep te herhalen. Drie dingen die het paneel weigert: een display-only platform (PD-011, vandaag onbereikbaar maar de licentie en de control flow verouderen niet even snel), lege of pure whitespace-tekst, en stilzwijgend afkappen — boven 4.000 tekens zégt hij dat het het begin is. Geplakte tekst heet "Je eigen tekst", geen enkele string noemt een merknaam |
| IMP-10 | ✅ | Kostenplafond per huishouden. Zelfde poort als IMP-06; het dagvenster telt alleen modelaanroepen |

### SRC — importbronnen

| # | Status | Wat |
|---|---|---|
| SRC-01 | ✅ | Webimport via schema.org/Recipe JSON-LD. Geen model nodig, geen hallucinatierisico, geen kosten. Maar: geen canonieke rij, dus geen dedup en geen kookbewijs — zie GAP-02 |
| SRC-02 | ✅ | YouTube via Data API v3 (`videos.list?part=snippet`) |
| SRC-03 | ✅ | YouTube Shorts genormaliseerd naar dezelfde canonieke vorm |
| SRC-05 | ✅ | Pinterest — rich pins dragen de structured data van de bronpagina, dus dit liftte mee met SRC-01 |
| SRC-08 | ✅ | Platte tekst plakken. Expliciete moduskeuze, nooit raden of iets "op een URL lijkt" |

### ENT — hoe recepten binnenkomen

| # | Status | Wat |
|---|---|---|
| ENT-05 | ✅ | De lege eerste ervaring. `emptyLibraryCopy.ts` (246 regels, 15 tests) is nu de bron voor de lege bibliotheek én voor `NoCandidateState`; `recipes.tsx`, `LibrarySearchEmptyState.tsx` en `librarySearchCopy.ts` lezen eruit. Het defect was het opsommen van platforms — de **derde** keer, na `paste.tsx:53-58` en `importFailureCopy.ts:30` — en de ergste vindplaats was de onzichtbare: `NoCandidateState.tsx:67` droeg de verouderde zin in een `accessibilityLabel`, dus een schermlezer kreeg "TikTok- of Instagram-video" te horen terwijl de eerlijke zichtbare copy ernaast stond. Een `test.each` bewaakt nu dat geen enkele lege-staat-string een merknaam noemt |

### BSK — boodschappen

| # | Status | Wat |
|---|---|---|
| BSK-01 | ✅ | Boodschappenlijst uit de weekplanning |
| BSK-02 | ✅ | Ingrediënten normaliseren en optellen. `ShoppingListItem` heeft bewust géén `total`-veld, zodat gram en stuks niet opgeteld kúnnen worden |
| BSK-03 | ✅ | Afvinken in de winkel |

### RCP — kwaliteit van het recept

| # | Status | Wat |
|---|---|---|
| RCP-01 | ✅ | Porties schalen, **UI geland**. `PortionScalingSheet.tsx` + `portionScalingCopy.ts` (43 tests), aangeroepen vanuit `cook/[mealId].tsx`. Een sheet, geen `CookPhase`: dat zou "Stap 3 / 7" laten liegen. Doelaantal komt uit `listMembers().length` — dezelfde bron die `settings.tsx` als "Aantal eters" toont, dus niemand hoeft een getal te hertypen. Een `unparsed` hoeveelheid krijgt de brontekst plus een `NIET OMGEREKEND`-stempel, nooit een vermenigvuldiging; `cannot_scale` heeft vier eigen schermen (recept zonder porties → Aanpassen; huishouden van nul → Instellingen; kapotte porties; verschil te groot), geen stille terugval op een ongeschaalde lijst. `MealIngredient[]` gaat rechtstreeks door als `RawIngredientLine` — `shopping/types.ts:36` zegt letterlijk dat dat kan, dus geen tweede adapter |
| RCP-03 | ✅ | Opgeslagen recept corrigeren |
| RCP-06 | ✅ | Herkomst tonen: publisher-data versus een model dat proza las. Als feit gebracht, niet als score |
| RCP-07 | ✅ | Hoeveelheden. Een onaangeraakte regel houdt nu zijn `quantity`/`unit`; een bewerkte regel blijft eerlijk `null` |

### PRF — huishouden en voorkeuren

| # | Status | Wat |
|---|---|---|
| PRF-02 | ✅ | Filters bij het importeren. De backlog beschreef dit verkeerd: taggen bestond al. Het echte gat — overslaan liet je onwetend buiten de allergiepoort vallen — is copy, en die staat er. Geen AI-suggesties: dat ontwerp is en blijft geschrapt, om de reden in `allergenTaggingCopy.ts` |

### LIB — de bibliotheek

| # | Status | Wat |
|---|---|---|
| LIB-01 | ✅ | Zoeken in eigen recepten |
| LIB-03 | ✅ | Filteren op tijd, dieet en stemming (kolommen bestonden al sinds 0004 en 0010) |
| LIB-04 | ✅ | Sorteren en verwijderen. Archiveren, geen hard delete — `on delete restrict` maakt dat laatste onmogelijk zodra er kookgeschiedenis is |
| LIB-06 | ✅ | Weekplanning (`/deze-week`), leest dezelfde bron als de boodschappenlijst |

### OPS — platform en onderhoud

| # | Status | Wat |
|---|---|---|
| OPS-01 | ✅ | **Zes majors in zes stappen, 3 september.** SDK 51 → 57, RN 0.74.5 → 0.86.3, React 18.2 → 19.2.3, TypeScript 5.3 → 6.0.3, expo-router 3.5 → 57.0.18. Elke stap een eigen commit met dezelfde vier checks: `expo-doctor` 21/21, typecheck 0, `check:functions` 0, lint 0, 2548 tests over 100 bestanden. Wat de stapsgewijze aanpak opleverde, en in één sprong onvindbaar was geweest: 52 brak `Array.from(searchParams.keys())`, 53 liet de globale `JSX`-namespace vallen over 61 bestanden, 55 hernoemde het onbekende kleurschema van `null` naar `'unspecified'`, 56 keurde `baseUrl` af — en dat laatste maskeerde elf fouten, want een configfout laat `tsc` afbreken vóór het typechecken |
| OPS-05 | ✅ | End-to-end test over plakken → parsen → bevestigen → opslaan |
| OPS-06 | ✅ | **De UI-makeover is gecommit** (`5cca816`), samen met vier bugs die het onderzoek blootlegde. Blokkeert niets meer — RCP-01 is daarmee vrij |
| OPS-08 | ✅ | **De opschoning draait.** `0013_import_attempts_retention.sql` installeert `pg_cron` en plant `remy-import-attempts-retention` elk uur op :17 met de `delete` die `0012` al uitschreef — op 2 september toegepast via de SQL-editor van het dashboard, want de CLI staat niet op deze machine. Onafhankelijk nagekeken in een database-review: de RLS-redenering klopt (de job draait als `postgres`, die de tabel bezit en dus RLS-exempt is), `cron.schedule` is idempotent op jobnaam sinds pg_cron 1.4, en `attempted_at` is bewust níét geïndexeerd omdat een derde index op élke insert wordt geschreven, op het importpad vóór een betaalde modelaanroep. Wat die review blootlegde en wat nu vóór de schedule staat: `select 'public.import_attempts'::regclass;` — `cron.schedule` parst zijn command nooit, dus een job op een ontbrekende tabel zou groen inplannen en daarna elk uur falen in `cron.job_run_details`, waar niets in deze repo kijkt |

### GAP — gevonden tijdens het bouwen

| # | Status | Wat |
|---|---|---|
| GAP-01 | ✅ | **Het anon-key-gat.** Bevestigd — een POST met alleen de publieke anon key bereikte de handler (HTTP 400 uit `readImportRequest`, dus geen afwijzing aan de poort) — en gedicht in `89a436c`. Een niet-identificeerbare beller wordt nu geweigerd in plaats van gemeterd |
| GAP-03 | ✅ | **Inplannen vanuit de bibliotheek.** `createSave` was alleen bereikbaar vanaf het bevestigingsscherm; `51764fd` gaf het een tweede deur op de long-press-sheet |
| GAP-04 | ✅ | `src/app/(tabs)/recipes.tsx` stond op 816 regels, nu 764 — onder de 800-grens |
| GAP-05 | ✅ | `LibraryHeader`'s deur zegt "Deze week" in plaats van "Boodschappen" |
| GAP-06 | ✅ | `<Stack.Screen>` voor `/deze-week` en `/boodschappen` staan in `src/app/_layout.tsx` |
| GAP-07 | ✅ | **De dode `'text'`-guard is weg** en dat was de kern: `NormalizedUrlResult.platform` is versmald naar `Exclude<ImportPlatform, 'text'>` (`urlParsing.ts`), de versmalling loopt door via `validateShortLinkTarget` en `resolveEffectiveUrl`, en de guard in `resolveImport` is verwijderd. ⚠ **De oorspronkelijke omschrijving klopte niet**, en de manier waarop is de les: alle zes `'text'`-vermeldingen in `importResult.ts` bleken accuraat, en het verwijderen van de guard repareerde juist de claim op `:78-85`. De écht verouderde comments noemden het woord `'text'` niet — daarom kon een grep erop ze per definitie niet vinden. Beide alsnog gerepareerd: `importResult.ts`' `parse_failed` beweerde dat alleen `'tiktok'` en `'youtube'` een model aanroepen, terwijl de plaktekstroute dat sinds SRC-08 óók doet; en `index.ts` telde "the three returns above" waar er na de verwijdering twee platformtakken staan — nu bij naam genoemd in plaats van geteld, want een telling vergaat stil en een platformnaam niet |
| GAP-10 | ✅ | **De kernregel van `ImportResult` klopt weer.** De union heeft tien varianten, waarvan er twee géén `platform` dragen — `unsupported_url` en `import_throttled` — terwijl zes comments nog één uitzondering beweerden en drie andere allang waren bijgewerkt. Nagemeten vóór het repareren: de twee zijn structureel dezelfde afwezigheid, want de budgetpoort draait op `index.ts:784`, vóór de `{url}`/`{text}`-splitsing en dus vóór `normalizeRecipeUrl` op `:582`. Een geweigerde beller heeft net zo min een route vastgesteld als een geweigerde string. `import_throttled` heeft nu de alinea die de regel op `:119-124` van elke nieuwe variant eist en die hij nooit had gekregen, inclusief waarom een `'text'`-default erger zou zijn dan het gat: SRC-09's cijfers worden van precies deze tellingen gelezen |
| GAP-15 | ✅ | **Een ontwikkelaars-inlog met wachtwoord, zodat een toestel niet op een mailserver wacht.** Elke e-mailroute naar een sessie hangt aan iets buiten deze repo: de ingebouwde sender van Supabase geeft een handvol berichten per uur en weigert adressen buiten het projectteam, en de code van GAP-14 vraagt een template die pas bewerkbaar wordt met custom SMTP. `signInWithDevPassword` omzeilt dat met `signInWithPassword` tegen een gebruiker die je zelf in het dashboard aanmaakt (Authentication → Users, met Auto Confirm User aan). **Een sessie is een sessie:** echt `sub`-claim, echte RLS, echte `onAuthStateChange`, dus wat je op het toestel test is de app en niet een namaak ervan — de reden dat dit boven `signInAnonymously` gaat, dat óók zou werken en elk pad dat een e-mailadres veronderstelt ongetest zou laten. **Dubbel afgeschermd:** `{__DEV__ ? … : null}` bij de aanroeper zoals de scenario-rijen elders, én een weigering in de functie zelf, want maar één van die twee overleeft een refactor van de ander. Een tweede voordeur in een app die bewust wachtwoordloos is (PD-012) is geen vergissing die zich aankondigt |
| GAP-16 | ✅ | **Het onderzoek koos een palet en dat palet is nooit toegepast.** De makeover van `5cca816` landde 72 bestanden aan componenten en vier echte bugfixes, maar `git show 5cca816 -- src/theme/tokens.ts` toont nul kleurwijzigingen. Nagemeten: **26 van 26 tokens verschilden**, in beide schema's. Twee dagen lang draaide elk scherm op het palet dat het onderzoek had vervángen. WS1 §4.1/§4.2 bevat een kant-en-klaar `satisfies ColorTokens`-blok; dat is nu geplakt, waarde voor waarde geverifieerd (52/52). **Het weersprak geen eerdere beslissing:** het oude blok verdedigde zich als "deliberately NOT the cream + serif + terracotta AI-cliché", en `ASSEMBLY.md:214` maakt precies dat onderscheid — de eigenaar "ruled that he rejected the cliché, not warmth". Het is bovendien meetbaar beter: de oude grond stapte `background → surface` op 1.10:1, een hiërarchie die het oog niet ziet; de nieuwe op 1.24:1, met 36 contrast-assertierijen in WS1 §711 |
| GAP-17 | ✅ | **De `__DEV__`-scenariorijen stonden altijd aan en zagen eruit als het product.** `__DEV__` is in Expo Go altijd waar, dus de fixture-kiezers op Kiezen, Vrienden, Ranglijst en het plakscherm renderden bovenaan élk scherm, boven de app. Ze staan nu achter `DEV_SCENARIO_ROWS_VISIBLE` in `src/lib/devFlags.ts`, standaard uit. `DevPasswordSignIn` is expres níét meegegaan: dat is de enige deur naar binnen zolang mail niet werkt, en die achter dezelfde vlag zetten is de deur op slot doen met de sleutel erin |
| GAP-20 | ✅ | **De haptics zijn bedraad, en het loket staat nu op één plek.** `src/lib/haptics.ts` draagt de hele woordenschat van WS5 §3.2 — vier stijlen, benoemd naar het GEWICHT VAN HET GEVOLG (`hapticValueMoved`, `hapticSmallCommit`, `hapticRealCommit`, `hapticCompleted`, `hapticFailed`) en niet naar de API, precies zodat een aanroepplek moet beantwoorden of dit een echte toezegging is in plaats van of Medium lekker voelt. `Heavy`, `Soft`, `Rigid` en `Warning` zijn bewust niet blootgesteld. De drie bestaande aanroepplekken droegen elk hun eigen kopie van de `.catch`-ritus; die regel is dragend (de webimplementatie van `expo-haptics` is een lege default export, dus élke aanroep is daar een afgewezen promise) en staat nu één keer. **Geleverd:** het cijfer in `RatingScale` — tik per héle cijfer, nooit per `RATING_STEP`, dat zou negentig trillingen in één sleep zijn — plus de commit bij loslaten én op het toegankelijkheidspad; `Ja` op Kiezen (uitdrukkelijk níét op `Niet koken` of `Iets anders`, docs/DESIGN.md §10); stap vooruit en terug in kookmodus; afvinken op de boodschappenlijst; chipselectie; `SegmentedControl`; allergenen bevestigen; de bewaarintentie; timer starten; ingrediëntenblad openen; de timerbalk terugtikken; en beide import-uitkomsten. **Alleen bij selecteren, nooit bij deselecteren** — een toggle die beide kanten laat trillen leert de hand dat de tril niets betekent |
| GAP-21 | ✅ | **Het einde van kookmodus is niet meer stil.** Alle drie de dingen uit WS5 §4.5 staan er: `notificationAsync(Success)` op het moment dat `Gemaakt!` landt, een `positive` haarlijn die onder het woord doortrekt met `scaleX` 0→1 en `transformOrigin: 'left'` NA de wash (niet ermee — twee leesbare gebeurtenissen, geen één vage), en `impactAsync(Medium)` bij het vastleggen van het cijfer, dat in `RatingScale` zelf zit zodat beide hosts van de kaart hem erven. De haarlijn is bewust dezelfde hoogte en dezelfde marge als `FriendProofCard`'s closed-loop streep: het is het vierde lid van een familie die het product al had — blauw als je kiest, blauw als je iemand kiest, groen als wat je stuurde gekookt werd, en nu groen als je het zelf kookte. **De `Klaar`-knop op de laatste stap trilt expres niet**: dat is dezelfde gebruikersactie, en WS5 §3.1 regel 3 begroot er één |
| GAP-22 | ✅ | **De vaste timerbalk staat, en de halve reparatie is af.** `src/domain/cookTimerBar.ts` beantwoordt puur WELKE timer de balk toont (13 tests): alleen een `running` timer op een ándere stap dan de huidige — gepauzeerd is een klok die de kok zelf stilzette en komt niet terug, `idle` is een duur op een stap die niemand startte. Een afgelopen timer gaat vóór een lopende, daarbinnen wint de vroegste deadline, gelijkspel breekt op stapvolgorde. `src/components/CookTimerBar.tsx` rendert hem tussen het stapblok en de navigatierij op vaste hoogte, MM:SS in mono naast `stap N`, `accentMuted`/`accentOnMuted` lopend en `positiveMuted`/`positive` afgelopen — beide paren staan al in `tests/contrast.test.ts`. **De echte winst is niet zichtbaar maar hoorbaar:** de succes-haptic en `Timer klaar` zaten in `TimerDisplay`, dat niet gemonteerd is voor een stap waar je vandaan gebladerd bent — een timer die afliep terwijl je vooruitlas zei tegen niemand iets. De balk zegt het nu, mét het stapnummer erbij. Aantikken brengt je terug; hij kan verder niets, want twee timer-UI's die dezelfde state claimen is precies hoe je een kok een klok afneemt |
| GAP-23 | ✅ | **Het importlaadblok flikkert niet meer.** Er is een derde fase, `pending`: het verzoek is weg en een tweede indiening wordt geweigerd, maar er verandert niets op het scherm. Pas na `LOADING_REVEAL_DELAY_MS` (= `motion.durationNormal`, dezelfde grootheid, geen tweede constante die kan wegdrijven) verschijnt de narratie. Een cachetreffer keert daarvóór terug, `settleAttempt` wist de onthullingstimer, en het scherm gaat rechtstreeks van formulier naar bevestiging — er wordt niets getoond in plaats van iets kort. **Uitgestelde start, geen minimale toondrempel**, en dat is niet dezelfde keuze: een drempel zou dit scherm een wachttijd laten verzinnen die er niet was, wat dezelfde leugen is als een spinner die in niets oplost, alleen andersom verteld. De checkpoints tellen vanaf het VERZOEK en niet vanaf de onthulling, anders claimt elke rij een kwart seconde werk die niet gedaan is. De vertraging loopt bewust niet door `resolveDuration`: onder reduce-motion zou dat de flikkering terugzetten, en juist bij de mensen die er het slechtst tegen kunnen |
| GAP-24 | ✅ | **De voortgangslijn in kookmodus vult zich in plaats van te springen.** `ProgressRule` zette `width: '43%'` en klapte op het frame van de stapwissel naar de volgende waarde; een balk die teleporteert leest als een opnieuw getekend scherm, niet als voortgang binnen één. Nu `scaleX` met `transformOrigin: 'left'` op de native driver — `width` is een layout-eigenschap en had elk frame van de vulling door de JS-thread geduwd, op het ene scherm waar diezelfde thread ook een aftelling per seconde hertekent. Dezelfde techniek die `DecisionCard`, `SendRecipeSheet` en `FriendProofCard` al voor deze streep gebruiken. **Geen entree-animatie**: de waarde wordt geseed op zijn eerste stand, want een balk die bij aankomst van nul naar stap 3 loopt beweert een reis die de kok niet gemaakt heeft. Onder reduce-motion klapt hij nog steeds — de informatie is identiek, alleen de reis is weg |
| GAP-25 | ✅ | **De tabbalk tekende vier ⏷-driehoekjes, en het commentaar erboven zei dat er geen iconen waren.** Nagemeten in `node_modules`: expo-router 57 levert react-navigation's bottom-tabs mee, en `BottomTabBar.js` geeft `icon: options.tabBarIcon ?? (() => <MissingIcon/>)` door. Die `??` garandeert dat de prop nóóit undefined is, en `MissingIcon` rendert het letterlijke teken `⏷` op 25pt. Niet instellen is dus niet hetzelfde als niet hebben. Opgelost met `tabBarIconStyle: { display: 'none' }`. **En het haalt het staande bezwaar tegen echte iconen weg:** WS4 stelde dat een icoon verticale ruimte kost, maar de balk is een vaste 49pt plus inset en het 31×28-icoonvak wordt onvoorwaardelijk getekend. Die ruimte wordt nu aan een placeholder besteed — een echt icoon kost nul |
| GAP-26 | ✅ | **Het tabblad-label stond al die tijd afgekapt.** `typeScale.caption` is IBM Plex Mono op 12pt, elke glyph 600/1000 em, dus "Mijn recepten" is 13 × 0,6 × 12 = 93,6pt tegen een vak van `breedte / 4 − 2 × 5` = 88,25pt bij 393pt en 83,75pt bij 375pt. Het label is `numberOfLines: 1`, dus het wrapt niet en krimpt niet — het kapt af. Nu **Recepten** op de tab; het scherm en de schermlezer houden "Mijn recepten". Zelfde precedent stond al vier regels lager in hetzelfde bestand bij Trending. ⚠ **Nog open:** `Vrienden · 2` is 86,4pt en past niet onder 390pt, dus PD-020.1's teller verdwijnt daar met ellips |
| GAP-27 | ✅ | **De rating-slider sprong naar links als je hem in het midden vastpakte.** `locationX` wordt gemeten tegen het element dat je aanraakt, en er liggen er drie onder dat gebaar: de duim van 28pt, de gevulde balk en het gevoelige gebied. Raak je de duim — die middenin staat tot je iets kiest, dus veruit het waarschijnlijkst — dan is `locationX` 0–28, gedeeld door een balk van ~317. Dat is 0,04. Nu `gestureState.x0` in vensterco̱ördinaten, min één gemeten linkerrand via `measureInWindow`: drie stelsels vervangen door één |
| GAP-28 | ✅ | **Loslaten legde al een cijfer vast.** `onPanResponderRelease` riep `onSelect` aan, wat schreef én de kaart sloot — één misgreep op een strook van 44pt was een definitief cijfer en een verdwenen kaart. Erger op het toegankelijkheidspad: een `adjustable` control veeg je herhaaldelijk, dus het eerste getal waar je langs veegde werd vastgelegd. De vinger verschuift nu alleen een concept; `Klaar` legt vast. PD-008's regel blijft heel — dezelfde knop slaat een concept op als er één is en sluit zonder iets als er geen is, dus het is nog steeds één tik hoe je ook antwoordt, alleen is die tik nu een besluit in plaats van een bijwerking |
| GAP-29 | ✅ | **Hetzelfde recept twee keer importeren zette het twee keer in de bibliotheek — en dat was een onwaarheid in de documentatie, geen vergeten controle.** `confirm.tsx:42` beweert al maanden dat `sourceUrl` de dedup-sleutel is, en gebruikt die zin zelfs om uit te leggen waarom `recipeId` nooit opnieuw afgeleid mag worden. `createMeal` plakte de rij onvoorwaardelijk achteraan. Nu een getest domeinmodule (`duplicateImport.ts`, 7 tests). De val die expres dicht zit: **een lege `sourceUrl` is nooit een duplicaat van een andere lege** — handmatige invoer en geplakte tekst hebben er geen, dus null-op-null matchen zou het tweede zelfgetypte gerecht weigeren als kopie van het eerste. Een duplicaat is bovendien geen fout: neutrale regel met de titel en een knop naar je bibliotheek, niet de rode `danger`-regel |

---

## Waar de open vragen uit `OPEN-BESLISSINGEN.md` landen

Dat document stelt de vraag; dit document draagt de code. De vertaling:

| Open vraag | Longlist |
|---|---|
| A — mag een webpagina een canonieke receptrij hebben? | GAP-02, raakt SRC-01 |
| B — opschoning van `import_attempts` | OPS-08 |
| C — de read-then-write race | GAP-09 |
| D — waar ligt de betaalgrens? | BIZ-03, BIZ-01 |
| E — voedingswaarden overnemen of schatten? | RCP-02 |
| F — groeperen zonder een kerkhof te bouwen | LIB-02 |
| G — de supermarkt in? | BSK-04, BSK-05, BSK-06 |
| H — Engelse vertaling waard? | OPS-03 |
| I — onderdrukt het kookvinkje ook de openbare stem? | GAP-31, raakt PRF-05 |
| J — hoe vraag je het aan een huishouden dat al vrienden heeft? | PRF-05 |
| DEC-01 — Instagram, beantwoord met nee | SRC-04, SRC-06 |
| DEC-02 — meten in oktober, dan pas beslissen | SRC-09, meetbron IMP-07 |
| OPS-01/02 — het Expo-upgradeplan | OPS-01, OPS-02, ontgrendelt ENT-01 |

---

## Wat er nog open ligt

Bijgewerkt na de sessies van 2 en 3 september. Geland sinds de vorige versie:
RCP-01, ENT-05, IMP-09, GAP-07, GAP-10, OPS-08 (gedraaid) en de ESLint-helft
van OPS-09. Geschrapt: ENT-03. Beslist: GAP-08 blijft optioneel.

~~**Er staat geen enkele beslissing van de eigenaar meer in de weg.** Dat was
sinds augustus niet zo.~~ **(HERZIEN, 6 september 2026: er staan er weer twee,
en allebei zijn ze door PD-022 en PD-023 zelf opgeworpen — open vragen I en J.
Geen van beide blokkeert het bouwen; I blokkeert wél de copy naast het vinkje,
want tot hij beantwoord is mag die tekst niet beloven dat een gerecht privé
blijft.)**

### ~~De grootste~~ — gedaan op 3 september

**OPS-01 is rond.** SDK 51 → 57 in zes stappen, elk met een eigen commit en
dezelfde vier checks erachteraan. De aanleiding was de vraag hoe je deze app
op een iPhone zet; het antwoord was dat Expo Go alleen de nieuwste SDK
ondersteunt en deze app zes majors achterliep. Dat is weg.

**Wat er nu wél kan:** de app op een iPhone draaien via Expo Go uit de App
Store, zonder ontwikkelbuild en zonder betaald Apple-account.

**Wat OPS-02 nog steeds blokkeert:** ENT-01. Een share extension is native
code en draait per definitie niet in Expo Go, hoe actueel de SDK ook is.

**Wat geen enkele check kon zeggen.** De nieuwe architectuur draait sinds
stap vier — niet als keuze, maar omdat SDK 55 `newArchEnabled` uit het schema
haalde. De typelaag en 2548 tests merken daar niets van, en dat is precies de
helft die het niet kan merken: `Animated` in `TimerDisplay` en
`DecisionCard`, `expo-haptics` en safe-area zitten nu op een ander
renderpad. Dat blijkt op een toestel of nergens.

### Daarna, op volgorde van hefboom

1. **De app op een toestel zetten en er doorheen lopen.** `npx expo start`,
   Expo Go, en dan één echte import door de flow plus de throttle-test (21
   binnen tien minuten, de 21e hoort `import_throttled` te krijgen). Dubbel
   zo waardevol als gisteren: het test de deploy én het renderpad van de
   nieuwe architectuur, en dat laatste heeft geen enkele andere dekking.
2. **IMP-05** — één secret, geen code. `GEMINI_MODEL` op een gedateerde
   snapshot pinnen. Extra reden sinds 2 september: een verschoven alias
   faalt als `llm_request_failed`, dezelfde emmer als de facturatiestoring,
   en die is in niets wat je kunt tellen te onderscheiden.
3. **GAP-02 / open vraag A** — mag een webpagina een canonieke receptrij
   hebben? Het duurst betaalde openstaande punt: een populair blogrecept is
   één URL die veel huishoudens delen, en juist die route is uitgesloten van
   de cache én van kookbewijs.
4. **PRF-03, RCP-04, LIB-05, ENT-04, ENT-06, SRC-07** — kleiner, allemaal
   vrij, geen van alle geblokkeerd.
5. **GAP-11's rest en OPS-09's tweede helft** — comment-onderhoud en
   `supabase/functions/**` uit ESLint's `ignores`. Pas urgent zodra er een
   echte `npm:`/`jsr:`-specifier in de functie komt.

### Wacht op iets buiten de code

**SRC-09** meet begin oktober (en dat venster heeft een gat, zie DEC-02).
**BSK-04/05/06**, **RCP-02**, **LIB-02**, **OPS-03**, **BIZ-01/03** wachten
op de open vragen D t/m H. **SRC-06** en **SRC-04** wachten op Meta, wat
neerkomt op: niet.

---

## Wat bewust niet overgenomen is van SlimMandje

Voor de volledigheid, zodat dit niet elke keer opnieuw wordt voorgesteld.

- **~~Productmatching en prijzen.~~ Teruggedraaid door de eigenaar op
  5 september 2026.** De oorspronkelijke reden was onderhoudslast: "hun halve
  product, en een doorlopende onderhoudslast zonder officiële API". Die reden
  was niet fout, maar wel onvolledig, en het onderzoek van 5 september splitst
  het punt in tweeën die niet dezelfde blokkade delen:
  - **Het mandje vullen kán wél gelicentieerd**, via FIU's *Any to Basket*,
    waar AH en Jumbo sinds oktober 2025 officieel aan hangen. Dat is BSK-06 en
    die staat nu open in plaats van dicht. De oude regel hierboven was op dit
    punt gewoon achterhaald.
  - **Prijzen vergelijken is door niemand gelicentieerd**, ook niet door
    SlimMandje zelf — hun artikel 6 zegt dat ze geen samenwerking met AH, Jumbo
    of Plus hebben, en hun verwerkerslijst bevat geen prijsleverancier. Wat de
    onderhoudslast-redenering miste is de juridische: Jumbo verbiedt scrapen bij
    naam en roept databankrecht in, een wettelijk recht dat los van hun
    voorwaarden bestaat. Zie BSK-05.
- **Video-transcriptie.** Zij beloven "de bereiding uit de video"; dat
  suggereert audio of OCR. Bij ons bewust buiten scope op auteursrechtelijke
  gronden, op twee plekken in de code vastgelegd.
- **Collecties.** Zie LIB-02 — botst met PD-004a.
- **Import-gebaseerde paywall.** Hun eigen App Store-reviews laten zien wat
  dat kost, en het wurgt precies de invoer waar de app op draait.
