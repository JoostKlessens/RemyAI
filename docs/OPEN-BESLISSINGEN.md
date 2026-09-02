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

## Wat er vóór een deploy moet gebeuren

Dit is de enige lijst met blokkerende acties. Alles erna is een keuze.

### 1. Twee migraties draaien

`0011` en `0012` staan in `supabase/migrations/` en zijn **nog niet tegen
de database gedraaid**. De code die erop rekent is wél gecommit, dus tot je
dit doet:

- schrijft een YouTube-import nog steeds `recipeId: null` (geen schade,
  `canStoreCanonicalRecipe` staat al open maar de CHECK weigert de rij);
- **faalt élke import**, omdat de poort `import_attempts` leest en die tabel
  niet bestaat — en de poort faalt bewust dicht.

Het tweede punt is de reden dat dit bovenaan staat.

```
supabase db push
```

### 2. Twee secrets zetten

```
supabase secrets set IMPORT_FINGERPRINT_SALT=<32+ willekeurige bytes, hex>
supabase secrets set YOUTUBE_API_KEY=<...>
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

Retentie is 48 uur, de `delete` staat in `0012`, maar deze repo heeft geen
pg_cron-migratie en die introduceren als bijvangst van een throttle-tabel was
de verkeerde plek. **Tot iemand dit inplant groeit de tabel onbegrensd.**

Plan hem naast de bestaande 16:00-beslissingsjob, of draai hem vanuit die
functie:

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

Van de vijf items uit de vorige versie zijn er drie meegelift. Twee resten:

1. Twee verouderde `'text'`-doccomments in `importResult.ts`, plus een dode
   `'text'`-guard in `resolveImport` waarvan de echte fix het versmallen van
   `NormalizedUrlResult.platform` naar `Exclude<ImportPlatform, 'text'>` is.
2. `CreateMealInput.dishTags` naar verplicht (uitgesteld sinds wave 4;
   ripplet door naar `tests/repository/`).

---

## Aanbevolen volgorde

1. **`supabase db push`** — zonder de tabellen faalt élke import, want de
   poort faalt bewust dicht.
2. **De twee secrets.** De functie start niet zonder het zout.
3. **`deno check` en één echte import**, plus de throttle-test.
4. **De opschoning inplannen** (B hierboven) voordat de tabel maanden
   ongelimiteerd groeit.
5. Dan pas de productvragen: A, D, E, F, G, H — en OPS-01/02 wanneer ENT-01
   aan de beurt is.
