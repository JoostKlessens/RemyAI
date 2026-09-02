# Open beslissingen

Dit document is het complement van `PRODUCT-DECISIONS.md`. Dat legt vast wat
besloten **is**; dit legt vast wat nog open staat, waarom, en wat elke keuze
ontgrendelt.

Geschreven als overdracht: een verse sessie moet hieruit kunnen doorwerken
zonder de voorgaande gesprekken gelezen te hebben.

**Stand:** 2 september 2026, branch `feat/live-import-and-plan-phases`,
lokaal t/m `a285b5d` (nog niet gepusht). Typecheck exit 0,
`check:functions` exit 0, lint schoon, 2476 tests over 97 bestanden.

---

## Wat er in de sessie van 2 september beslist en gebouwd is

De vorige versie van dit document stelde acht vragen. Alle acht zijn
beantwoord. Vier commits:

| Commit | Wat |
|---|---|
| `5cca816` | UI-makeover geland, plus vier bugs die het onderzoek blootlegde |
| `89a436c` | Anon-key-gat gedicht (0012), YouTube krijgt een canonieke rij (0011) |
| `51764fd` | "Deze week" op de long-press-sheet; de lus in causale volgorde |
| `a285b5d` | Het bevestigingsscherm zegt wat overslaan kost (PRF-02) |

Wat daarmee van de baan is, met de reden erbij zodat niemand het opnieuw
opengooit:

- **§1, het anon-key-gat: bevestigd en gedicht.** Een POST van
  `{"text":"x"}` met alleen de anon key antwoordde **HTTP 400** op de live
  deployment — een 400 uit `readImportRequest`, dus de beller had de handler
  bereikt. Een niet-identificeerbare beller wordt nu geweigerd, niet
  gemeterd.
- **§2, migratie 0011: conservatief toegepast.** Alleen `'youtube'`. Web
  blijft eruit tot de staleness-vraag beantwoord is — zie A hieronder, die
  is er dus niet minder om.
- **§3, migratie 0012: toegepast en bedraad.**
- **§5, de makeover: gecommit.** Blokkeert niets meer.
- **§6, inplannen vanuit de bibliotheek: gebouwd.**
- **§7, PRF-02: opgelost, maar anders dan de backlog beschreef.** Zie
  hieronder — de premisse klopte niet meer.
- **§9, hygiëne: meegelift.** `recipes.tsx` staat op 763 regels,
  `LibraryHeader`'s deur zegt "Deze week", `/deze-week` en `/boodschappen`
  staan in de Stack.

---

## Wat er vóór een deploy moest gebeuren — gedaan

**Afgerond op 2 september 2026.** Alle drie de punten hieronder zijn dicht:
de migraties draaien (`0001` t/m `0013`, nagemeten tegen de database), de
drie secrets staan er, en de functie is gedeployed. Dat laatste is gemeld
door de eigenaar en niet machinaal geverifieerd — dezelfde herkomstregel als
bij de secrets, en hij staat er expres bij.

**Wat dat betekent.** De throttlepoort van IMP-06/IMP-10 en de dichting van
het anon-key-gat uit `89a436c` draaien nu werkelijk, in plaats van alleen
gecommit te zijn. Een `✅` in `LONGLIST.md` mag vanaf hier gelezen worden als
"dit werkt live" en niet langer als "de code bestaat".

De punten hieronder blijven staan als naslag. Ze beschrijven wat er moest
gebeuren en waarom, en die redenen gelden onverkort voor een volgende
omgeving of een volgend project.

Dit was de enige lijst met blokkerende acties. Alles erna is een keuze.

### 1. Nog één migratie: `0013`

**Op 2 september tegen de live database nagemeten, en het antwoord was niet
wat hier stond.** `0011` en `0012` zijn allebei toegepast:

- `recipes_platform_check` noemt `'tiktok'`, `'instagram'` én `'youtube'`;
- `public.import_attempts` staat er met alle zes kolommen, beide indexen plus
  de pkey, RLS aan en nul policies — precies wat `0012` beschrijft — en nul
  rijen;
- `supabase_migrations.schema_migrations` registreert `0001` t/m `0012`, dus
  ze zijn met de CLI gepusht, niet half met de hand aangebracht.

De vorige versie van deze paragraaf beweerde dat geen van de drie gedraaid
was. Die zin is nooit tegen de database gecontroleerd: hij is van versie op
versie overgeschreven en bij de laatste herschrijving alleen preciezer
gemaakt — twee werd drie — wat een onjuiste bewering scherper formuleerde in
plaats van hem te betrappen. Een document nakijken kan dat niet vinden;
alleen de database vragen kan dat.

**Daarmee vervalt de zwaarste claim die hier stond.** "Faalt élke import"
gold uitsluitend zolang `import_attempts` ontbrak, en die tabel bestaat. Er
is vandaag geen deploy-blokkade op de importpijplijn.

**En `0013` is er inmiddels ook.** Dezelfde middag toegepast via de
SQL-editor van het dashboard — de CLI staat niet op deze machine en
`supabase/config.toml` ontbreekt, dus `supabase db push` kan hier niet
draaien. `pg_cron` is geïnstalleerd, de retentie-job staat, en het grootboek
leest `0001` t/m `0013`.

**Er staat op dit moment geen enkele migratie meer open.** Wat vóór een
werkende deploy nog moet gebeuren staat hieronder in 2 en 3, en dat gaat over
secrets en over de functie zelf — niet meer over de database.

```
supabase db push
```

### 2. De secrets — gezet

**Alle drie staan er.** De eigenaar heeft op 2 september 2026 de
secrets-pagina van het project bekeken en `IMPORT_FINGERPRINT_SALT`,
`YOUTUBE_API_KEY` én `GEMINI_API_KEY` alle drie in de lijst zien staan.
Herkomst: afgelezen van het dashboard, niet machinaal geverifieerd — secrets
zijn niet leesbaar zonder CLI of dashboard. Dat onderscheid staat er expres
bij, want dit document heeft één keer eerder een onbevestigde zin als feit
doorgegeven; zie punt 1.

**HET ZIJN ER DRIE, EN DE KOP HIERBOVEN ZEI JARENLANG TWEE.** `env.ts:33`
noemt de functie zonder `GEMINI_API_KEY` "useless" — dat is waar
`callExtractionModel.ts` op draait, en dus de hele modelroute. Hij ontbrak in
dit lijstje precies omdát hij er al was: een secret dat nooit gemist werd,
werd nooit opgeschreven, en een checklist die je niet ziet falen is een
checklist die je niet controleert. `INSTAGRAM_OEMBED_ACCESS_TOKEN` bestaat
ook nog, maar is legacy en doet niets: Instagram is display-only onder
PD-011.

Voor als er ooit een nieuw project opgezet wordt:

```
supabase secrets set IMPORT_FINGERPRINT_SALT=<32+ willekeurige bytes, hex>
supabase secrets set YOUTUBE_API_KEY=<...>
supabase secrets set GEMINI_API_KEY=<...>
```

De functie **weigert te starten** zonder het zout. Dat is opzet: zonder zout
zijn de eerlijke opties een rauw IP opslaan (persoonsgegeven, in een tabel
wiens hele ontwerpargument is dat hij er geen bevat) of ongezouten hashen,
wat hetzelfde is met een extra stap. Het zout roteren reset alleen anonieme
buckets; ingelogde bellers hangen aan hun auth-subject.

Zonder `YOUTUBE_API_KEY` faalt YouTube-import eerlijk met
`missing_credentials` — maar hij faalt.

### 3. `deno check` en één echte URL

`npm run check:functions` bestaat nu en geeft exit 0 — een strikte
`tsc`-pass over `supabase/functions/**`, dat tot vandaag buiten `tsc`,
ESLint én vitest viel. Dat **draait** de functies niet; het stopt wel dat een
hernoeming in `src/domain` stilzwijgend de deploy breekt, want vijf modules
daar importeren die boom.

Wat het niet kan: Deno's resolutieregel, waar deze map echt op sneuvelt —
elke relatieve specifier heeft zijn expliciete `.ts` nodig, en een
ontbrekende is een deploy-time fout die geen enkele TypeScript-configuratie
ziet, omdat `allowImportingTsExtensions` de extensie hier optioneel maakt in
plaats van verplicht.

```
deno check supabase/functions/parse-recipe/index.ts
```

**Sinds 2 september (avond) is hier een goedkopere half-afdekking voor, en
het is een echte stap — maar het vervangt `deno check` niet.**
`lint/eslint.flat.config.mjs` draagt nu een
`@typescript-eslint/no-restricted-imports`-regel over `src/domain/import/**`
die een relatieve **value**-import zonder `.ts` afkeurt. `allowTypeImports:
true` is het dragende stuk: de veertien extensieloze imports in die map zijn
allemaal `import type`, en die wist TypeScript vóór Deno's loader iets
resolveert — een regel die ze alsnog afkeurt vraagt veertien zinloze edits en
leert mensen hem uit te zetten. Empirisch nagemeten: 0 fouten op
`src/domain/import`, en de regel vuurt wél op een echte overtreding
(`src/lib/auth.ts:29`). Nul nieuwe dependencies; `typescript-eslint` zat er
al.

De graaf is bovendien vandaag schoon: van de 87 relatieve specifiers die de
functie bereikt is er **geen enkele** een extensieloze value-import, dus de
deploy-brekende situatie is nu afwezig, niet alleen ongezien.

Wat de regel **niet** dekt, en waarvoor `deno check` op de lijst blijft:
`supabase/functions/**` staat nog steeds in ESLint's `ignores` (die dertien
bestanden zijn vandaag correct, maar onbewaakt), en een aanwezige-maar-
verkeerde extensie (`./x.js` die een `x.ts` bedoelt) ziet alleen Deno. Zodra
er een echte `npm:`- of `jsr:`-specifier in de functie komt houdt `tsc` op
een zinnige proxy te zijn en is Deno installeren de juiste zet.

Plus één echte `vm.tiktok.com`-URL door de importflow, en één throttle-test:
21 imports binnen tien minuten hoort de 21e te weigeren met
`import_throttled`.

---

## Wat er nog open staat

### A. Mag een webpagina een canonieke receptrij hebben?

**De vraag die 0011 bewust liet liggen.** Een videocaption ligt vast. Een
webpagina niet — uitgevers corrigeren hoeveelheden, passen oventemperaturen
aan, herschrijven stappen. Een rij die in maart gecachet wordt en in november
aan een nieuw huishouden geserveerd wordt, geeft ze een versie die de
uitgever allang heeft rechtgezet, zonder enig signaal.

**Wat het kost dat dit open staat, en het is niet notioneel:** een populair
blogrecept is één canonieke URL die veel huishoudens delen, dus dit is juist
de route die het meest baat zou hebben bij de cache — en hij is uitgesloten.
Geen deduplicatie, en geen kookbewijs: `shared_cooks` joint op de canonieke
rij, dus een webgeïmporteerd gerecht dat iemand écht gekookt heeft blijft
onzichtbaar voor de sociale laag.

Drie verdedigbare antwoorden:

1. Nooit opnieuw ophalen (goedkoopst, minst waar over tijd)
2. Opnieuw ophalen na N dagen
3. Opnieuw ophalen en vergelijken; rij behouden maar als verouderd markeren

**⚠ En het is geen kwestie van één woord toevoegen.**
`STORED_ROW_PROVENANCE` in `src/domain/import/canonicalRecipe.ts` rapporteert
elke opgeslagen rij als `'model_from_caption'`. Dat is een deductie uit welke
platforms opgeslagen kúnnen worden, en hij overleefde 0011 alleen omdat
YouTube óók een captionroute is. Een webrij komt uit JSON-LD en is
`'publisher_structured_data'`. `'web'` toevoegen zonder die constante mee te
veranderen vertelt een gebruiker dat het recept van de uitgever door software
geïnterpreteerd is.

### B. De opschoning van `import_attempts` is niet ingepland

**Beantwoord én toegepast op 2 september (avond).** De vraag was wáár de job
hoort; het antwoord is: in een eigen migratie, in de database. Die migratie
is gedraaid — zie het slot van deze paragraaf.

`0013_import_attempts_retention.sql` doet `create extension if not exists
pg_cron` en plant `remy-import-attempts-retention` elk uur op :17, met exact
de `delete` die hieronder staat. De twee huizen die `0012` voorstelde vielen
allebei af om dezelfde reden: de 16:00-job is een ontwerp in
`ARCHITECTURE.md`, geen migratie — hij bestaat niet. Wachten op een job die
nog gebouwd moet worden was precies de faalmodus die dit punt openhield. In
de database plannen heeft bovendien een eigenschap die de functieroute mist:
retentie blijft werken of die functie er ooit komt of niet, en een deploy van
ongerelateerde functiecode kan hem niet breken.

Onafhankelijk nagekeken in een database-review. Wat standhield: de
RLS-redenering (de job draait als `postgres`, die de tabel bezit en dus
RLS-exempt is — een policy toevoegen zou de toegang verbreden om iets te
kopen dat de job al heeft), idempotentie op jobnaam sinds pg_cron 1.4, en het
bewust **niet** indexeren van `attempted_at`: een derde index wordt op élke
insert geschreven, en die insert staat op het importpad vóór een betaalde
modelaanroep. Wat de review blootlegde, en wat daarna toegevoegd is:
`cron.schedule` parst zijn command nóóit, dus een job die op een
niet-bestaande tabel mikt wordt vrolijk ingepland en faalt daarna elk uur in
`cron.job_run_details`, waar niets in deze repo kijkt — dezelfde
groene-push-over-een-kapotte-staat die dit document afwijst, één laag lager
en uit het zicht. `select 'public.import_attempts'::regclass;` staat er nu
vóór en faalt hardop als `0012` niet gedraaid is.

**TOEGEPAST OP 2 SEPTEMBER.** `pg_cron` is geïnstalleerd en
`remy-import-attempts-retention` staat ingepland, via de SQL-editor van het
dashboard in plaats van `supabase db push` — de CLI staat niet op deze
machine. Het grootboek registreert nu `0001` t/m `0013`, en omdat de
grootboek-insert ná de `commit` staat, is die regel zelf het bewijs dat de
transactie erdoor is: `create extension` en `cron.schedule` zijn allebei
geslaagd. De tabel groeit niet meer onbegrensd. Dit punt is dicht.

De `delete` zelf, ongewijzigd sinds `0012` hem uitschreef:

```sql
delete from public.import_attempts
where attempted_at < now() - interval '48 hours';
```

### C. De read-then-write race in de throttle

De poort leest het venster, beslist, en schrijft dan de poging. Twee
gelijktijdige verzoeken van dezelfde beller kunnen allebei onder het plafond
lezen, dus de effectieve limiet is het plafond plus wat er in de lucht hangt.
Dichten kost een extra round trip op élke import om een handvol
modelaanroepen terug te winnen.

Het oordeel is dat het lek acceptabel is en de kosten niet: dit verdedigt
tegen een lus, en een lus die zijn eigen gelijktijdigheid overschiet wordt
nog steeds gestopt. **Hier opgeschreven zodat een licht overschreden plafond
herkend wordt als bekend, niet als bug.**

### D. Waar ligt de betaalgrens? (BIZ-03)

Niet op imports — dat wurgt de invoer waar de app op draait, en SlimMandje's
eigen reviews laten zien wat dat kost. Niet op de sociale laag, want die is
het product. Onbeantwoord.

### E. Voedingswaarden overnemen of schatten? (RCP-02)

JSON-LD levert ze feitelijk; uit een caption zou het verzinnen zijn, en het
is gezondheidsdata onder PD-005. Onbeantwoord.

### F. Hoe groepeer je zonder een kerkhof te bouwen? (LIB-02)

PD-004a verbiedt bewaren-zonder-voorstellen; mappen zijn de standaardvorm van
precies dat. Onbeantwoord.

### G. De supermarkt in? (DEC-03)

Geen publieke product-API bij AH of Jumbo; scrapen is doorlopend onderhoud.
De tussenweg (BSK-01, lijst zonder prijzen) is al gebouwd. Onbeantwoord.

### H. Engelse vertaling waard? (OPS-03)

Copy zit hardcoded Nederlands in tientallen `*Copy.ts`-modules; er is geen
i18n-laag. Onbeantwoord.

---

## Beantwoord op 2 september, met bewijs

Deze stonden lang open. Ze zijn nu dicht; hier staat waarom, zodat niemand ze
opnieuw hoeft uit te zoeken.

### DEC-01 — Instagram volledige extractie blijft dicht

**Antwoord: nee.** De gebruiksbeperking staat er nog, letterlijk:

> "Using metadata and page, post, or video content (or their derivations)
> from the endpoint for any purpose other than providing a front-end view of
> the page, post, or video is strictly prohibited."

Meta's documentatie voegt toe dat consumeren, manipuleren, extraheren of
persisteren van die data — inclusief het afleiden van analyses — expliciet
verboden is.

**Wat er op 15 juni 2026 wél veranderde:** Meta draaide de tokeneis uit 2020
terug. Vier endpoints (Threads, Instagram, Facebook Post, Facebook Video)
zijn nu zonder token bereikbaar — geen app-registratie, geen App Review, geen
developeraccount. **Dat is uitsluitend het authenticatiemechanisme.** De
voorwaarden over wat je met de teruggegeven data mag doen zijn ongewijzigd.

Dus: de toegangsdrempel is weg, de gebruiksbeperking niet. Precies de zorg
die de vorige versie van dit document uitsprak, en hij blijkt terecht.
**PD-011 staat, SRC-04 blijft dicht, `displayOnlyPolicy.ts` blijft `false`
teruggeven.** Herzien vergt een licentie of een andere bron, niet een nieuwe
lezing van dezelfde zin.

Bronnen: [Meta oEmbed-documentatie](https://developers.facebook.com/docs/instagram-platform/oembed/),
[WP Mayor over de tokenwijziging](https://wpmayor.com/meta-tokenless-oembed-wordpress/)

### DEC-02 — wacht op data, en dat is nu een besluit

Transcriptie/OCR (SRC-09) blijft buiten scope op auteursrechtelijke gronden.
**Afgesproken: de import-telemetrie uit `a078c56` een maand laten lopen**, en
daarna pas beslissen. `no_recipe_in_caption` is per platform gesplitst, dus
de vraag die telt — is dit een paar procent of de helft, en verschilt TikTok
van YouTube — is straks af te lezen zonder iets te bouwen.

**Eerstvolgende moment om te kijken: begin oktober 2026.** Grep op
`import_event outcome=no_recipe_in_caption` in de functielogs; de teller
staat naast `outcome=parsed` op dezelfde route.

**⚠ HET MEETVENSTER HEEFT EEN GAT, EN DAT MOET JE IN OKTOBER WETEN.** De
Gemini-facturering heeft ergens vóór 2 september 2026 gefaald; de eigenaar
heeft het die dag opgelost. Wat dat met de cijfers doet, en wat níét:

- **Het telt níét mee in de teller die telt.** Een geweigerde modelaanroep
  wordt `llm_request_failed`, niet `no_recipe_in_caption`
  (`callExtractionModel.ts:35-43` → `finishImport.ts:222`). De breuk waar
  SRC-09 op draait wordt dus niet opgeblazen door een betaalprobleem.
- **Maar de noemer is korter.** Elke import in die periode die `parsed` of
  `no_recipe_in_caption` had moeten worden, stierf als `llm_request_failed`.
  Het venster is dus niet representatief, en de periode hoort uit de
  oktober-meting geknipt of apart gerapporteerd te worden.
- **Hoe je de grens terugvindt:** `outcome=llm_request_failed` in de
  functielogs, en dan de `console.error` uit `callExtractionModel.ts` ernaast
  — dáár staat de HTTP-status. In de gestructureerde regel staat hij niet.

**En dat laatste is het punt dat blijft staan.** Een geweigerde betaling, een
uitgeputte quota, een verkeerd model-id en een TLS-timeout zijn één outcome.
Dat is bewust en verdedigd — het product kan niets met het verschil — maar
het betekent dat een facturatiestoring in álles wat je kunt tellen niet te
onderscheiden is van een netwerkhikje, en alleen zichtbaar is voor wie de
logregels ernaast leest. Het is bovendien exact de emmer waarin IMP-05's
zwevende `gemini-3.6-flash`-alias zou vallen als die ooit verschuift.

### PRF-02 — de backlog beschreef het verkeerd

De backlog zei dat geïmporteerde gerechten met lege `ingredientTags` en
status `'unknown'` worden aangemaakt en dat de uitsluitingen daarom nooit
iets matchen. **De eerste helft klopte niet meer:**
`AllergenTaggingSection` staat al op het bevestigingsscherm, en bevestigen —
ook met nul tags — is precies wat `verified` verdient.

Het echte gat was smaller: wie de stap overslaat houdt `'unknown'`, en
`exclusions.ts` sluit alleen `'verified'` uit. Dat scherm zei daar niets
over. Nu wel — en alleen tegen huishoudens die daadwerkelijk een
allergiebeperking hebben, want PD-006 punt 2 verbiedt wrijving voor de rest.

**⚠ Wat hier bewust NIET gebeurd is: tags afleiden uit ingrediënttekst.** Dat
ontwerp is in dit project gebouwd en geschrapt.
`src/components/allergenTaggingCopy.ts` draagt de reden: de gevaarlijke fout
is niet dat het model een tag toevoegt maar dat het er één **mist**, waarna
een net voorgevulde lijst wordt afgestempeld, het gerecht `verified` wordt en
`exclusions.ts` dat volledig vertrouwt. Precies de fout die PD-006 voorkomt,
door een vriendelijkere deur. Wie dit heroverweegt moet PD-006 en die header
in dezelfde wijziging bijwerken — niet stilletjes.

---

## OPS-01/02 — het Expo-upgradeplan

**Gevraagd: een plan, geen blinde bump.** Hier is het.

### Waar we staan

| | Nu | Laatste (sept 2026) |
|---|---|---|
| Expo SDK | 51 | 57 |
| React Native | 0.74.5 | 0.86 |
| React | 18.2.0 | 19.2 |
| expo-router | 3.5.24 | — |

Zes SDK-majors achter. SDK 51 is van mei 2024.

### Wat het ontgrendelt

ENT-01, de share extension — volgens de longlist het item met de meeste
hefboom op de hele lijst. Delen-vanuit-TikTok is de natuurlijke invoer voor
deze app, en die vraagt een native module die op SDK 51 niet te doen is.

### De aanpak

**Expo's eigen advies is één SDK tegelijk**, letterlijk: *"We recommend
upgrading SDK versions incrementally, one at a time. Doing so will help you
pinpoint breakages and issues that arise during the upgrade process."* Zes
majors in één sprong is precies wat die zin afraadt.

Dus zes stappen, elk met dezelfde vier checks erachteraan — `npm run
typecheck`, `npm run lint`, `npm test`, `npm run check:functions` — en elk in
een eigen commit, zodat een breuk te bisecten is.

```
npx expo install expo@^52.0.0 --fix
npx expo-doctor
# checks, commit, en pas dan de volgende
```

### Waar het pijn gaat doen

Twee dingen zijn groot genoeg om apart genoemd te worden, en beide vallen
binnen deze zes stappen:

1. **De New Architecture wordt ergens in deze reeks de standaard.** Dat is
   geen configuratievlag maar een ander renderpad; alles wat native aanraakt
   moet opnieuw gecontroleerd worden. Deze app is grotendeels puur RN, wat
   helpt — maar `expo-haptics`, `react-native-safe-area-context` en de
   `Animated`-code in `TimerDisplay`/`DecisionCard` zijn de plekken om te
   kijken.
2. **React 18 → 19.** Raakt `useEffect`-timing en de `Animated`-patronen die
   deze app veel gebruikt.

**Lees per stap de changelog van díe SDK**, niet deze tabel: de precieze
breekpunten verschuiven, en een lijst in een document van vandaag is een
lijst die volgend kwartaal verkeerd is.

### Wat eerst moet

`npx expo-doctor` op de huidige stand, vóór stap één — dat vertelt of er nu
al iets scheef staat dat de eerste upgrade zou maskeren.

Bron: [Expo — Upgrade Expo SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)

---

## Kleine hygiëne — wat er nog ligt

Van de vijf items uit de vorige versie zijn er drie meegelift. De twee die
restten zijn op 2 september (avond) opgepakt — de eerste is af, de tweede
uitgezocht maar niet uitgevoerd.

1. **Gedaan (GAP-07), en de omschrijving hierboven klopte niet.**
   `NormalizedUrlResult.platform` is versmald naar
   `Exclude<ImportPlatform, 'text'>`, de versmalling loopt door via
   `validateShortLinkTarget` en `resolveEffectiveUrl`, en de dode guard in
   `resolveImport` is weg. Maar: alle zes `'text'`-vermeldingen in
   `importResult.ts` bleken **accuraat**, en het verwijderen van de guard
   repareerde juist de claim op `:78-85`. De écht verouderde comments
   noemden het woord `'text'` niet — dáárom kon een grep erop ze per
   definitie niet vinden, en dat is de les die het onthouden waard is. Ze
   zijn alsnog gerepareerd: `parse_failed` beweerde dat alleen `'tiktok'` en
   `'youtube'` een model aanroepen, terwijl de plaktekstroute dat sinds
   SRC-08 óók doet; en `index.ts` telde "the three returns above" waar er nu
   twee platformtakken staan — nu bij naam genoemd, want een telling vergaat
   stil en een platformnaam niet.

2. **Uitgezocht én beslist (GAP-08) — het veld blijft optioneel.**
   `CreateMealInput.dishTags` naar verplicht. De backlog had gelijk, maar
   niet om de reden die er stond. Het comment dat het veld optioneel
   verdedigt is géén post-hoc rationalisatie: `git blame` legt veld én
   verdediging in dezelfde commit (`9503caf`, 25 augustus). Het is een echte
   ontwerpbeslissing die sindsdien door **drie incidenten** weerlegd is en
   nooit is bijgewerkt — precies omgekeerd aan PRF-02, waar de backlog
   verouderd bleek. De premisse ("elke aanroeper is een scherm dat misschien
   nog geen categorieën te bieden heeft") is empirisch onwaar: negen van de
   negen constructieplekken noemen het veld al, en élke literal die het ooit
   oversloeg was een bug — alle drie opgeschreven, in `confirm.tsx:201-208`
   en `parsedRecipe.ts:65-95`, waarvan de laatste letterlijk zegt dat alleen
   het type dit kan vangen. En "ripplet door naar `tests/repository/`" is
   onjuist: de blast radius is **nul aanroepplekken** — één `?` weghalen, en
   het verouderde comment herschrijven, wat bij het werk hoort en niet erna.
   Zijn tweelingveld `recipeId?` ligt anders: dat wordt op drie plekken wél
   echt weggelaten, en is dus een apart en groter item.

   **HET OORDEEL, 2 september: optioneel blijven — tegen de analyse in, en
   dat is precies waarom het hier staat en niet weggestreept is.** De reden
   is die tweeling. Beide velden rusten in hetzelfde bestand op hetzelfde
   argument, en er één verplicht maken breekt de symmetrie die dat bestand
   verdedigt — terwijl `recipeId` niet mee kán, omdat het op drie plekken
   echt wordt weggelaten. Wie dit heropent behandelt béíde velden in één
   wijziging, of laat ze allebei staan. De blast radius is los daarvan
   nagemeten en nul: `readonly dishTags:` plus `tsc --noEmit` gaf exit 0,
   dus de kosten van het besluit zijn bekend en het is geen uitstel bij
   gebrek aan informatie.

---

## Aanbevolen volgorde

1. ~~Migraties draaien~~ — **klaar.** `0001` t/m `0013` staan live,
   nagemeten tegen de database. De volgende stap is punt 2.
2. ~~De secrets~~ — **klaar** volgens de eigenaar. Zie punt 2 hierboven, en
   let op dat het er drie zijn: `GEMINI_API_KEY` hoorde er altijd al bij.
3. **`deno check` en één echte import**, plus de throttle-test.
4. ~~De opschoning inplannen~~ — **geschreven** (B hierboven, migratie
   `0013`). Hij zit in stap 1: dezelfde push, of de tabel groeit alsnog
   onbegrensd.
5. ~~GAP-08~~ — **beslist: de `?` blijft.** Zie punt 2 hierboven voor de
   afweging; er staat niets meer open.
6. **ENT-03** — de backlog vraagt om klembord-*detectie*, en dat botst
   frontaal met `paste.tsx`'s vastgelegde "het scherm inspecteert de invoer
   nooit om de modus te kiezen". Kiezen: de zwakke-maar-verenigbare variant
   (aanbieden binnen de al gekozen modus), of schrappen. Niet stilzwijgend
   bouwen — die header voert een kostenargument, geen smaakargument.
7. Dan pas de productvragen: A, D, E, F, G, H — en OPS-01/02 wanneer ENT-01
   aan de beurt is.
