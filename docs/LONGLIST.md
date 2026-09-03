# Longlist

De genummerde backlog. `OPEN-BESLISSINGEN.md` en de commit-messages van
september 2026 verwijzen naar de codes hieronder; dit is waar ze gedefinieerd
staan.

Ontstaan uit een vergelijking met **SlimMandje**, een Nederlandse app die
recepten uit TikTok, Instagram, YouTube, Facebook en Pinterest omzet in een
boodschappenmand bij Albert Heijn of Jumbo. De overlap met Remy is uitsluitend
de import; hun tweede helft (boodschappen, prijzen, supermarktkoppeling) is
grotendeels bewust niet overgenomen.

**Stand:** 3 september 2026, `feat/live-import-and-plan-phases`, t/m
`e222a58`, **gepusht en in sync met `origin`**. Werkboom schoon.

De database is bij: `0001` t/m `0013` draaien, nagemeten tegen de live
database in plaats van aangenomen. De drie secrets staan er. De edge functie
is gedeployed, dus de throttlepoort en de dichting van het anon-key-gat zijn
werkelijk actief. Vier checks groen: typecheck 0, `check:functions` 0, lint 0,
**2548 tests over 100 bestanden**.

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
| IMP-01 | ✅ | TikTok-shortlinks (`vm.`/`vt.`) worden nu server-side uitgeklapt, met begrensde hops, timeout per hop en validatie van de eindbestemming |
| IMP-02 | ✅ | Creator-attributie op `no_recipe_in_caption` — was een KNOWN GAP |
| IMP-03 | ✅ | `unsupported_url` noemt nu welke platforms wél werken |
| IMP-04 | ✅ | Instagram `missing_credentials` — opgelost via de tokenloze oEmbed-route |
| IMP-05 | 🔒 | **Geen codewijziging — één secret.** `callExtractionModel.ts:81` leest al `GEMINI_MODEL` via `readOptionalEnvVar` en valt alleen terug op de zwevende `'gemini-3.6-flash'` als die niet gezet is; het comment erboven zegt letterlijk "pin an exact dated snapshot via the GEMINI_MODEL secret before relying on this in production". De backlog liet dit lezen als openstaand werk; het is Project Settings → Edge Functions → Secrets, één regel. Wat de eigenaar moet kiezen is wélke snapshot, en dat is een echte keuze: het comment legt uit dat Flash-Lite bewust is gekozen op kosten, en dat eerlijk weigeren (`report_no_recipe`) het eerste is wat een kleiner model verliest. **Extra reden om dit nu te doen:** een verschoven alias faalt als `llm_request_failed`, precies dezelfde emmer als de facturatiestoring van 2 september — onzichtbaar in alles wat je kunt tellen |
| IMP-06 | ✅ | Rate limiting. Migratie `0012` is de duurzame teller, `supabaseImportBudgetStore.ts` leest hem, en de poort in `index.ts` handhaaft. Een beller zonder `sub` — de anon key — wordt geweigerd in plaats van gemeterd. **Draai `supabase db push` vóór deploy** |
| IMP-07 | ✅ | Import-telemetrie. Eén structurele regel per uitkomst, geen SDK, geen tabel, geen PII. Dit is de meetbron voor SRC-09 |
| IMP-08 | — | Geschrapt: "opnieuw proberen" bestond al |
| IMP-09 | ✅ | **De tekst die Remy las staat nu naast het lege formulier.** De handmatige route bestond al (`paste.tsx:487`, `manualEntryIsPrimary` per uitkomst, maker en URL reizen mee); wat ontbrak was dat hij leeg opende, zodat je terug naar TikTok moest om tekst over te lezen die al op het toestel stond. `sourceTextCopy.ts` (14 tests) beslist of en hoe hij verschijnt, `SourceTextPanel.tsx` tekent, en `ImportConfirmParams.sourceText` draagt hem over de router-hop — verplicht veld, want de overkant kan hem niet terughalen zonder de fetch én de modelaanroep te herhalen. Drie dingen die het paneel weigert: een display-only platform (PD-011, vandaag onbereikbaar maar de licentie en de control flow verouderen niet even snel), lege of pure whitespace-tekst, en stilzwijgend afkappen — boven 4.000 tekens zégt hij dat het het begin is. Geplakte tekst heet "Je eigen tekst", geen enkele string noemt een merknaam |
| IMP-10 | ✅ | Kostenplafond per huishouden. Zelfde poort als IMP-06; het dagvenster telt alleen modelaanroepen |

## SRC — importbronnen

| # | Status | Wat |
|---|---|---|
| SRC-01 | ✅ | Webimport via schema.org/Recipe JSON-LD. Geen model nodig, geen hallucinatierisico, geen kosten. Maar: geen canonieke rij, dus geen dedup en geen kookbewijs — zie GAP-02 |
| SRC-02 | ✅ | YouTube via Data API v3 (`videos.list?part=snippet`) |
| SRC-03 | ✅ | YouTube Shorts genormaliseerd naar dezelfde canonieke vorm |
| SRC-04 | ⛔ | Instagram volledige extractie. **DEC-01 is beantwoord en het antwoord is nee** — Meta's gebruiksbeperking staat er onveranderd, alleen de tokeneis verviel op 15 juni 2026. Herzien vergt een licentie of een andere bron, niet een nieuwe lezing. Zie `OPEN-BESLISSINGEN.md` |
| SRC-05 | ✅ | Pinterest — rich pins dragen de structured data van de bronpagina, dus dit liftte mee met SRC-01 |
| SRC-06 | 🔒 | Facebook. Zelfde Meta-voorwaarden als Instagram, en weinig NL-kookcontent |
| SRC-07 | ⬜ | Foto van een kookboek of screenshot. Juridisch het schoonste: het is je eigen boek |
| SRC-08 | ✅ | Platte tekst plakken. Expliciete moduskeuze, nooit raden of iets "op een URL lijkt" |
| SRC-09 | 🔒 | Audio-transcriptie of OCR van de video. DEC-02 is nu een besluit: telemetrie loopt, **eerstvolgende meetmoment begin oktober 2026**. Grep op `import_event outcome=no_recipe_in_caption`, per platform gesplitst. ⚠ **Het meetvenster heeft een gat:** de Gemini-facturering faalde vóór 2 september 2026 en is die dag hersteld. Dat blaast `no_recipe_in_caption` niet op — een geweigerde aanroep wordt `llm_request_failed` — maar het verkort wél de noemer, dus die periode hoort uit de oktober-meting. Zie DEC-02 in `OPEN-BESLISSINGEN.md` |

## ENT — hoe recepten binnenkomen

| # | Status | Wat |
|---|---|---|
| ENT-01 | 🔒 | **Share extension.** Nog steeds het item met de meeste hefboom, en sinds 3 september half ontgrendeld: OPS-01 is rond, dus de SDK staat niet meer in de weg. Alleen OPS-02 blijft over — een share extension is native code en draait niet in Expo Go, dus dit vraagt een ontwikkelbuild |
| ENT-02 | 🔒 | Achtergrond-import met notificatie. Volgt op ENT-01 |
| ENT-03 | ⛔ | **Geschrapt door de eigenaar op 2 september 2026.** Klembord-*detectie* vereist precies wat `paste.tsx:8-23` in hoofdletters verbiedt — het scherm inspecteert de geplakte string nooit om de modus te kiezen — en het kost een gemeterde modelaanroep om een link als `{text}` te versturen. De enige variant die daar niet mee botst (aanbieden wat op het klembord staat, bínnen de al gekozen modus) voegt vrijwel niets toe aan de plak-knop die al op `paste.tsx:530` staat. Twee wegen: een die een vastgelegde beslissing omkeert, en een die werk is zonder winst. Geen van beide is de moeite, dus dit item is dicht in plaats van eeuwig open |
| ENT-04 | ⬜ | Meerdere links tegelijk |
| ENT-05 | ✅ | De lege eerste ervaring. `emptyLibraryCopy.ts` (246 regels, 15 tests) is nu de bron voor de lege bibliotheek én voor `NoCandidateState`; `recipes.tsx`, `LibrarySearchEmptyState.tsx` en `librarySearchCopy.ts` lezen eruit. Het defect was het opsommen van platforms — de **derde** keer, na `paste.tsx:53-58` en `importFailureCopy.ts:30` — en de ergste vindplaats was de onzichtbare: `NoCandidateState.tsx:67` droeg de verouderde zin in een `accessibilityLabel`, dus een schermlezer kreeg "TikTok- of Instagram-video" te horen terwijl de eerlijke zichtbare copy ernaast stond. Een `test.each` bewaakt nu dat geen enkele lege-staat-string een merknaam noemt |
| ENT-06 | ⬜ | Deeplinks vanuit een gedeeld recept van een vriend |

## BSK — boodschappen

| # | Status | Wat |
|---|---|---|
| BSK-01 | ✅ | Boodschappenlijst uit de weekplanning |
| BSK-02 | ✅ | Ingrediënten normaliseren en optellen. `ShoppingListItem` heeft bewust géén `total`-veld, zodat gram en stuks niet opgeteld kúnnen worden |
| BSK-03 | ✅ | Afvinken in de winkel |
| BSK-04 | 🔒 | Productmatching AH/Jumbo. Geen publieke API; zie DEC-03 / open vraag G |
| BSK-05 | 🔒 | Prijzen tonen en vergelijken |
| BSK-06 | 🔒 | Naar de winkelwagen van de supermarkt |
| BSK-07 | ⬜ | "Dit heb ik al in huis" — voorraadkast |

## RCP — kwaliteit van het recept

| # | Status | Wat |
|---|---|---|
| RCP-01 | ✅ | Porties schalen, **UI geland**. `PortionScalingSheet.tsx` + `portionScalingCopy.ts` (43 tests), aangeroepen vanuit `cook/[mealId].tsx`. Een sheet, geen `CookPhase`: dat zou "Stap 3 / 7" laten liegen. Doelaantal komt uit `listMembers().length` — dezelfde bron die `settings.tsx` als "Aantal eters" toont, dus niemand hoeft een getal te hertypen. Een `unparsed` hoeveelheid krijgt de brontekst plus een `NIET OMGEREKEND`-stempel, nooit een vermenigvuldiging; `cannot_scale` heeft vier eigen schermen (recept zonder porties → Aanpassen; huishouden van nul → Instellingen; kapotte porties; verschil te groot), geen stille terugval op een ongeschaalde lijst. `MealIngredient[]` gaat rechtstreeks door als `RawIngredientLine` — `shopping/types.ts:36` zegt letterlijk dat dat kan, dus geen tweede adapter |
| RCP-02 | 🔒 | Voedingswaarden. Overnemen uit JSON-LD is feitelijk, schatten uit een caption is verzinnen — en het is gezondheidsdata onder PD-005. Open vraag E |
| RCP-03 | ✅ | Opgeslagen recept corrigeren |
| RCP-04 | ⬜ | Eigen notities bij een recept |
| RCP-05 | ⬜ | Omgang met een verdwenen bronvideo |
| RCP-06 | ✅ | Herkomst tonen: publisher-data versus een model dat proza las. Als feit gebracht, niet als score |
| RCP-07 | ✅ | Hoeveelheden. Een onaangeraakte regel houdt nu zijn `quantity`/`unit`; een bewerkte regel blijft eerlijk `null` |

## PRF — huishouden en voorkeuren

| # | Status | Wat |
|---|---|---|
| PRF-01 | ⬜ | Dieetprofielen in één tik. Machinerie bestaat al; let op de grens tussen voorkeur en Artikel 9-data |
| PRF-02 | ✅ | Filters bij het importeren. De backlog beschreef dit verkeerd: taggen bestond al. Het echte gat — overslaan liet je onwetend buiten de allergiepoort vallen — is copy, en die staat er. Geen AI-suggesties: dat ontwerp is en blijft geschrapt, om de reden in `allergenTaggingCopy.ts` |
| PRF-03 | ⬜ | Instellingen zijn alleen bereikbaar via een tekstlink |
| PRF-04 | ⬜ | Tweede volwassene in hetzelfde huishouden (uitnodigingsstroom ontbreekt) |

## LIB — de bibliotheek

| # | Status | Wat |
|---|---|---|
| LIB-01 | ✅ | Zoeken in eigen recepten |
| LIB-02 | 🔒 | Collecties. Botst met PD-004a — mappen zijn hoe je een kerkhof bouwt. Open vraag F |
| LIB-03 | ✅ | Filteren op tijd, dieet en stemming (kolommen bestonden al sinds 0004 en 0010) |
| LIB-04 | ✅ | Sorteren en verwijderen. Archiveren, geen hard delete — `on delete restrict` maakt dat laatste onmogelijk zodra er kookgeschiedenis is |
| LIB-05 | ⬜ | Thumbnails hangen aan een externe CDN |
| LIB-06 | ✅ | Weekplanning (`/deze-week`), leest dezelfde bron als de boodschappenlijst |

## OPS — platform en onderhoud

| # | Status | Wat |
|---|---|---|
| OPS-01 | ✅ | **Zes majors in zes stappen, 3 september.** SDK 51 → 57, RN 0.74.5 → 0.86.3, React 18.2 → 19.2.3, TypeScript 5.3 → 6.0.3, expo-router 3.5 → 57.0.18. Elke stap een eigen commit met dezelfde vier checks: `expo-doctor` 21/21, typecheck 0, `check:functions` 0, lint 0, 2548 tests over 100 bestanden. Wat de stapsgewijze aanpak opleverde, en in één sprong onvindbaar was geweest: 52 brak `Array.from(searchParams.keys())`, 53 liet de globale `JSX`-namespace vallen over 61 bestanden, 55 hernoemde het onbekende kleurschema van `null` naar `'unspecified'`, 56 keurde `baseUrl` af — en dat laatste maskeerde elf fouten, want een configfout laat `tsc` afbreken vóór het typechecken |
| OPS-02 | 🔒 | **Geen development build-pijplijn — maar niet langer de blokkade voor testen.** Sinds OPS-01 draait de app op SDK 57, de versie die Expo Go ondersteunt, dus hij is nu zonder build en zonder betaald Apple-account op een iPhone te zetten. Wat een ontwikkelbuild nog steeds nodig heeft is ENT-01: een share extension is een native module en die draait per definitie niet in Expo Go. Daarvoor is `eas.json`, `expo-dev-client`, een EAS-account en voor iOS een betaald Apple Developer-account nodig; geen daarvan bestaat in deze repo |
| OPS-03 | 🔒 | Engelse vertaling. Geen i18n-laag; copy zit hardcoded in tientallen `*Copy.ts`-modules. Open vraag H |
| OPS-04 | ⬜ | Fixtures naast de echte paden |
| OPS-05 | ✅ | End-to-end test over plakken → parsen → bevestigen → opslaan |
| OPS-06 | ✅ | **De UI-makeover is gecommit** (`5cca816`), samen met vier bugs die het onderzoek blootlegde. Blokkeert niets meer — RCP-01 is daarmee vrij |
| OPS-07 | ⬜ | Werken zonder verbinding |
| OPS-08 | ✅ | **De opschoning draait.** `0013_import_attempts_retention.sql` installeert `pg_cron` en plant `remy-import-attempts-retention` elk uur op :17 met de `delete` die `0012` al uitschreef — op 2 september toegepast via de SQL-editor van het dashboard, want de CLI staat niet op deze machine. Onafhankelijk nagekeken in een database-review: de RLS-redenering klopt (de job draait als `postgres`, die de tabel bezit en dus RLS-exempt is), `cron.schedule` is idempotent op jobnaam sinds pg_cron 1.4, en `attempted_at` is bewust níét geïndexeerd omdat een derde index op élke insert wordt geschreven, op het importpad vóór een betaalde modelaanroep. Wat die review blootlegde en wat nu vóór de schedule staat: `select 'public.import_attempts'::regclass;` — `cron.schedule` parst zijn command nooit, dus een job op een ontbrekende tabel zou groen inplannen en daarna elk uur falen in `cron.job_run_details`, waar niets in deze repo kijkt |
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
| GAP-01 | ✅ | **Het anon-key-gat.** Bevestigd — een POST met alleen de publieke anon key bereikte de handler (HTTP 400 uit `readImportRequest`, dus geen afwijzing aan de poort) — en gedicht in `89a436c`. Een niet-identificeerbare beller wordt nu geweigerd in plaats van gemeterd |
| GAP-02 | 🟡 | **`recipes.platform` CHECK.** `0011` verbreedde naar `'youtube'`; `'web'` bleef er bewust uit tot de staleness-vraag beantwoord is. Open vraag A. ⚠ Wie `'web'` toevoegt moet `STORED_ROW_PROVENANCE` in `src/domain/import/canonicalRecipe.ts` in dezelfde wijziging meenemen — die rapporteert élke opgeslagen rij als `'model_from_caption'`, en een webrij is `'publisher_structured_data'` |
| GAP-03 | ✅ | **Inplannen vanuit de bibliotheek.** `createSave` was alleen bereikbaar vanaf het bevestigingsscherm; `51764fd` gaf het een tweede deur op de long-press-sheet |
| GAP-04 | ✅ | `src/app/(tabs)/recipes.tsx` stond op 816 regels, nu 764 — onder de 800-grens |
| GAP-05 | ✅ | `LibraryHeader`'s deur zegt "Deze week" in plaats van "Boodschappen" |
| GAP-06 | ✅ | `<Stack.Screen>` voor `/deze-week` en `/boodschappen` staan in `src/app/_layout.tsx` |
| GAP-07 | ✅ | **De dode `'text'`-guard is weg** en dat was de kern: `NormalizedUrlResult.platform` is versmald naar `Exclude<ImportPlatform, 'text'>` (`urlParsing.ts`), de versmalling loopt door via `validateShortLinkTarget` en `resolveEffectiveUrl`, en de guard in `resolveImport` is verwijderd. ⚠ **De oorspronkelijke omschrijving klopte niet**, en de manier waarop is de les: alle zes `'text'`-vermeldingen in `importResult.ts` bleken accuraat, en het verwijderen van de guard repareerde juist de claim op `:78-85`. De écht verouderde comments noemden het woord `'text'` niet — daarom kon een grep erop ze per definitie niet vinden. Beide alsnog gerepareerd: `importResult.ts`' `parse_failed` beweerde dat alleen `'tiktok'` en `'youtube'` een model aanroepen, terwijl de plaktekstroute dat sinds SRC-08 óók doet; en `index.ts` telde "the three returns above" waar er na de verwijdering twee platformtakken staan — nu bij naam genoemd in plaats van geteld, want een telling vergaat stil en een platformnaam niet |
| GAP-08 | ⚖ | `CreateMealInput.dishTags` **blijft optioneel — beslist door de eigenaar op 2 september 2026, tegen de analyse in, en dat is de reden om het hier vast te leggen in plaats van de regel te schrappen.** Wat het onderzoek vond: het comment dat het veld verdedigt is géén post-hoc rationalisatie — `git blame` legt veld én verdediging in één commit (`9503caf`, 25 augustus) — maar zijn premisse ("elke aanroeper is een scherm dat misschien nog geen categorieën heeft") is empirisch onwaar: negen van de negen constructieplekken noemen het veld al. De blast radius is nagemeten en **nul**: `readonly dishTags:` plus `tsc --noEmit` geeft exit 0, dus de backlog's "ripplet door naar `tests/repository/`" was onjuist. **Waarom het tóch blijft:** het tweelingveld `recipeId?` rust in hetzelfde bestand op hetzelfde argument, en één van de twee verplicht maken breekt de symmetrie die dat bestand verdedigt — terwijl `recipeId` niet mee kán, want dat wordt op drie plekken wel echt weggelaten. Wie dit heropent behandelt béíde velden in één wijziging. ⚠ Het bijvangst-signaal op `mirror/rows.ts:211` (`dish_tags` zonder `??`-fallback terwijl drie buren er wel één hebben) is nagekeken en **geen bevinding**: die drie buren zijn optioneel op `Meal`, `dishTags` is verplicht (`types.ts:290`), dus een fallback zou dode code zijn |
| GAP-09 | ⚖ | **De read-then-write race in de throttle.** Twee gelijktijdige verzoeken van dezelfde beller kunnen allebei onder het plafond lezen. Dichten kost een extra round trip op élke import om een handvol modelaanroepen terug te winnen; het oordeel is dat het lek acceptabel is en de kosten niet. Een licht overschreden plafond is bekend gedrag, geen bug. Open vraag C |
| GAP-10 | ✅ | **De kernregel van `ImportResult` klopt weer.** De union heeft tien varianten, waarvan er twee géén `platform` dragen — `unsupported_url` en `import_throttled` — terwijl zes comments nog één uitzondering beweerden en drie andere allang waren bijgewerkt. Nagemeten vóór het repareren: de twee zijn structureel dezelfde afwezigheid, want de budgetpoort draait op `index.ts:784`, vóór de `{url}`/`{text}`-splitsing en dus vóór `normalizeRecipeUrl` op `:582`. Een geweigerde beller heeft net zo min een route vastgesteld als een geweigerde string. `import_throttled` heeft nu de alinea die de regel op `:119-124` van elke nieuwe variant eist en die hij nooit had gekregen, inclusief waarom een `'text'`-default erger zou zijn dan het gat: SRC-09's cijfers worden van precies deze tellingen gelezen |
| GAP-11 | 🟡 | **De onjuiste tellingen zijn weg, de onvolledige niet.** Gerepareerd: `index.ts` noemde "nine sibling modules" en somde er negen op terwijl het er elf zijn — de twee ontbrekende waren `importBudget.ts` en `supabaseImportBudgetStore.ts`, dezelfde IMP-06/IMP-10-wijziging die GAP-10 veroorzaakte; `importResult.ts` zei vijf modules importeren `types.ts`, het zijn er acht; `types.ts` beweerde dat een gebroken specifier "door niets" wordt gevangen, wat sinds `check:functions` onwaar is; en `index.ts:191` zei dat geen typechecker deze map ziet, wat diezelfde dag ophield te kloppen. **Wat blijft staan:** een zestal comments zegt dat `supabase/functions/**` buiten `tsc --noEmit`, ESLint en vitest valt. Dat is niet ónwaar — de root-tsconfig sluit de map echt uit, en de ESLint- en vitest-helften kloppen onverkort — maar het is onvolledig sinds `check:functions`, en hun architectuurargument (leg logica in `src/domain`) rust nog steeds op de twee helften die wél gelden. Losse comment-edits, geen haast |
| GAP-12 | 🟡 | **Inloggen per link werkte op een telefoon niet, en de ontbrekende helft was het ontvangen.** `requestMagicLink` stuurde altijd al een link met `emailRedirectTo`, en `supabase.ts:52-59` legt uit dat `detectSessionInUrl` web-only is omdat de link op native als deeplink binnenkomt en expliciet ingewisseld moet worden — maar niets wisselde hem in. De mail opende de app en de app negeerde hem; op een iPhone zie je dan een sprong door Safari en kom je niet langs het inlogscherm. Gebouwd: `readAuthRedirect` (`src/domain/social/authRedirect.ts`, 13 tests) leest de fragmenttokens, `completeSignInFromUrl` zet de sessie, en `Linking.useURL()` in `_layout.tsx` vangt zowel een koude start als een draaiende app — twee verschillende API's, en alleen de eerste vangen werkt in elke test en faalt voor elke echte eerste login. **🟡 omdat er nog een dashboardactie bij hoort:** de redirect-URL moet in Supabase onder Authentication → URL Configuration → Redirect URLs staan, en onder Expo Go bevat die je LAN-IP, dus hij verandert met je netwerk. Een ontwikkelbuild met het vaste `remy://`-schema maakt dat blijvend |
| GAP-13 | ⬜ | **Het UI-onderzoek vond fouten in de staande documenten, en die zijn nooit teruggevouwen.** `ui-research/ASSEMBLY.md` zegt expliciet dat het "what the research found to be factually wrong in the standing documents" vastlegt. `DESIGN-SOCIAL.md` is bij het landen van de makeover (`5cca816`) bijgewerkt; `DESIGN.md` (27 aug), `PRODUCT-DECISIONS.md` (27 aug) en `ARCHITECTURE.md` (23 aug) niet — alle drie van vóór het onderzoek. Die correcties leven dus alleen in `ui-research/`, terwijl `DESIGN.md` uit tientallen bronbestanden wordt aangehaald als gezag. Gevonden op 3 september bij het opruimen van `docs/`, en de reden dat die map blijft staan terwijl de drie procesdocumenten eromheen verwijderd zijn |
| GAP-14 | 🟡 | **Inloggen met een getypte code, in plaats van een link.** `auth.ts` betoogde jarenlang dat een code "the better fit for a phone app" is en dat hij "not available to us" was: de code staat alleen in de mail als de template `{{ .Token }}` bevat, en Supabase zet template-bewerking achter custom SMTP. Dat argument stond nog steeds; alleen de premisse veranderde. Gebouwd: `readSignInCode` (`src/domain/social/signInCode.ts`, 11 tests) beoordeelt de invoer vóór er een verzoek aan opgaat, `verifySignInCode` wisselt hem in via `verifyOtp` met `type: 'email'` — níét `'magiclink'`, want dat verwacht de hash uit een aangeklikte URL en laat elke juiste code als ongeldig terugkomen — en `sign-in.tsx` heeft een tweede formulier met `textContentType="oneTimeCode"`, zodat iOS de code boven het toetsenbord aanbiedt en de reis naar de mail-app helemaal wegvalt. **Verlopen en onjuist zijn aparte uitkomsten**, omdat het ene je terugstuurt naar de mail en het andere naar een nieuwe aanvraag. 🟡 tot custom SMTP staat: zonder dat blijft de template onbewerkbaar en komt er geen code in de mail |
| GAP-15 | ✅ | **Een ontwikkelaars-inlog met wachtwoord, zodat een toestel niet op een mailserver wacht.** Elke e-mailroute naar een sessie hangt aan iets buiten deze repo: de ingebouwde sender van Supabase geeft een handvol berichten per uur en weigert adressen buiten het projectteam, en de code van GAP-14 vraagt een template die pas bewerkbaar wordt met custom SMTP. `signInWithDevPassword` omzeilt dat met `signInWithPassword` tegen een gebruiker die je zelf in het dashboard aanmaakt (Authentication → Users, met Auto Confirm User aan). **Een sessie is een sessie:** echt `sub`-claim, echte RLS, echte `onAuthStateChange`, dus wat je op het toestel test is de app en niet een namaak ervan — de reden dat dit boven `signInAnonymously` gaat, dat óók zou werken en elk pad dat een e-mailadres veronderstelt ongetest zou laten. **Dubbel afgeschermd:** `{__DEV__ ? … : null}` bij de aanroeper zoals de scenario-rijen elders, én een weigering in de functie zelf, want maar één van die twee overleeft een refactor van de ander. Een tweede voordeur in een app die bewust wachtwoordloos is (PD-012) is geen vergissing die zich aankondigt |

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
| DEC-01 — Instagram, beantwoord met nee | SRC-04, SRC-06 |
| DEC-02 — meten in oktober, dan pas beslissen | SRC-09, meetbron IMP-07 |
| OPS-01/02 — het Expo-upgradeplan | OPS-01, OPS-02, ontgrendelt ENT-01 |

---

## Wat er nog open ligt

Bijgewerkt na de sessies van 2 en 3 september. Geland sinds de vorige versie:
RCP-01, ENT-05, IMP-09, GAP-07, GAP-10, OPS-08 (gedraaid) en de ESLint-helft
van OPS-09. Geschrapt: ENT-03. Beslist: GAP-08 blijft optioneel.

**Er staat geen enkele beslissing van de eigenaar meer in de weg.** Dat was
sinds augustus niet zo.

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

- **Productmatching en prijzen.** Hun halve product, en een doorlopende
  onderhoudslast zonder officiële API. BSK-01 lost het grootste deel op zonder
  die last.
- **Video-transcriptie.** Zij beloven "de bereiding uit de video"; dat
  suggereert audio of OCR. Bij ons bewust buiten scope op auteursrechtelijke
  gronden, op twee plekken in de code vastgelegd.
- **Collecties.** Zie LIB-02 — botst met PD-004a.
- **Import-gebaseerde paywall.** Hun eigen App Store-reviews laten zien wat
  dat kost, en het wurgt precies de invoer waar de app op draait.
