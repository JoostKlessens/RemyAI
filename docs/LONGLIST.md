# Longlist

De genummerde backlog. `OPEN-BESLISSINGEN.md` en de commit-messages van
september 2026 verwijzen naar de codes hieronder; dit is waar ze gedefinieerd
staan.

Ontstaan uit een vergelijking met **SlimMandje**, een Nederlandse app die
recepten uit TikTok, Instagram, YouTube, Facebook en Pinterest omzet in een
boodschappenmand bij Albert Heijn of Jumbo. De overlap met Remy is uitsluitend
de import; hun tweede helft (boodschappen, prijzen, supermarktkoppeling) is
grotendeels bewust niet overgenomen.

**Stand:** 5 september 2026, `feat/live-import-and-plan-phases`, t/m
`73cfd47` gepusht. **GAP-25 t/m GAP-29 staan in de werkboom en zijn nog niet
gecommit**, dus voor die vijf regels betekent `✅` hieronder "gebouwd en
getest", nog niet "gepusht".

**Dit document is op 5 september herzien.** Alles wat af is staat nu onder
**Afgerond** onderaan in plaats van tussen het openstaande werk; het bovenste
deel gaat alleen nog over wat er nog te doen is.

De database is bij: `0001` t/m `0013` draaien, nagemeten tegen de live
database in plaats van aangenomen. De drie secrets staan er. De edge functie
is gedeployed, dus de throttlepoort en de dichting van het anon-key-gat zijn
werkelijk actief. Vier checks groen: typecheck 0, `check:functions` 0, lint 0,
**2605 tests over 105 bestanden**.

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

## PRF — huishouden en voorkeuren

| # | Status | Wat |
|---|---|---|
| PRF-01 | ⬜ | Dieetprofielen in één tik. Machinerie bestaat al; let op de grens tussen voorkeur en Artikel 9-data |
| PRF-03 | ⬜ | Instellingen zijn alleen bereikbaar via een tekstlink |
| PRF-04 | ⬜ | Tweede volwassene in hetzelfde huishouden (uitnodigingsstroom ontbreekt) |

## LIB — de bibliotheek

| # | Status | Wat |
|---|---|---|
| LIB-02 | 🔒 | Collecties. Botst met PD-004a — mappen zijn hoe je een kerkhof bouwt. Open vraag F |
| LIB-05 | ⬜ | Thumbnails hangen aan een externe CDN |

## OPS — platform en onderhoud

| # | Status | Wat |
|---|---|---|
| OPS-02 | 🔒 | **Geen development build-pijplijn — maar niet langer de blokkade voor testen.** Sinds OPS-01 draait de app op SDK 57, de versie die Expo Go ondersteunt, dus hij is nu zonder build en zonder betaald Apple-account op een iPhone te zetten. Wat een ontwikkelbuild nog steeds nodig heeft is ENT-01: een share extension is een native module en die draait per definitie niet in Expo Go. Daarvoor is `eas.json`, `expo-dev-client`, een EAS-account en voor iOS een betaald Apple Developer-account nodig; geen daarvan bestaat in deze repo |
| OPS-03 | 🔒 | Engelse vertaling. Geen i18n-laag; copy zit hardcoded in tientallen `*Copy.ts`-modules. Open vraag H |
| OPS-04 | ⬜ | Fixtures naast de echte paden |
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
| GAP-30 | ⬜ | **De 16:00-push bestaat niet, en dat is de functie waar de app naar vernoemd is.** Gevonden op 5 september 2026 tijdens de SlimMandje-vergelijking, buiten die vergelijking om. Alle onderdelen liggen klaar en géén ervan is verbonden: de tabel `push_tokens` staat sinds `0001_init.sql:727` met een index erbij, `expo-notifications` staat in `package.json`, en `ARCHITECTURE.md` beschrijft onder "How the 16:00 push works" de hele werking. Maar `supabase/functions/daily-decision/` bevat alleen een `.gitkeep` van 22 augustus, en `expo-notifications` wordt in **nul** bestanden onder `src/` geïmporteerd — nagemeten, niet aangenomen. **Het gevolg is dat de kernlus geen startknop heeft:** het hele product is "om 16:00 beslist Remy wat je eet en zegt het je", en er is geen enkele weg waarlangs dat bericht een telefoon bereikt. Je moet de app zelf openen en zelf naar Kiezen gaan. Dit is precies het patroon dat GAP-22 en `friendProof.ts` al twee keer eerder vastlegden — een volledig gespecificeerde functie waarvan de bedrading nooit gelegd is, en waar geen test iets van merkt omdat er niets te testen valt |
| GAP-02 | 🟡 | **`recipes.platform` CHECK.** `0011` verbreedde naar `'youtube'`; `'web'` bleef er bewust uit tot de staleness-vraag beantwoord is. Open vraag A. ⚠ Wie `'web'` toevoegt moet `STORED_ROW_PROVENANCE` in `src/domain/import/canonicalRecipe.ts` in dezelfde wijziging meenemen — die rapporteert élke opgeslagen rij als `'model_from_caption'`, en een webrij is `'publisher_structured_data'` |
| GAP-08 | ⚖ | `CreateMealInput.dishTags` **blijft optioneel — beslist door de eigenaar op 2 september 2026, tegen de analyse in, en dat is de reden om het hier vast te leggen in plaats van de regel te schrappen.** Wat het onderzoek vond: het comment dat het veld verdedigt is géén post-hoc rationalisatie — `git blame` legt veld én verdediging in één commit (`9503caf`, 25 augustus) — maar zijn premisse ("elke aanroeper is een scherm dat misschien nog geen categorieën heeft") is empirisch onwaar: negen van de negen constructieplekken noemen het veld al. De blast radius is nagemeten en **nul**: `readonly dishTags:` plus `tsc --noEmit` geeft exit 0, dus de backlog's "ripplet door naar `tests/repository/`" was onjuist. **Waarom het tóch blijft:** het tweelingveld `recipeId?` rust in hetzelfde bestand op hetzelfde argument, en één van de twee verplicht maken breekt de symmetrie die dat bestand verdedigt — terwijl `recipeId` niet mee kán, want dat wordt op drie plekken wel echt weggelaten. Wie dit heropent behandelt béíde velden in één wijziging. ⚠ Het bijvangst-signaal op `mirror/rows.ts:211` (`dish_tags` zonder `??`-fallback terwijl drie buren er wel één hebben) is nagekeken en **geen bevinding**: die drie buren zijn optioneel op `Meal`, `dishTags` is verplicht (`types.ts:290`), dus een fallback zou dode code zijn |
| GAP-09 | ⚖ | **De read-then-write race in de throttle.** Twee gelijktijdige verzoeken van dezelfde beller kunnen allebei onder het plafond lezen. Dichten kost een extra round trip op élke import om een handvol modelaanroepen terug te winnen; het oordeel is dat het lek acceptabel is en de kosten niet. Een licht overschreden plafond is bekend gedrag, geen bug. Open vraag C |
| GAP-11 | 🟡 | **De onjuiste tellingen zijn weg, de onvolledige niet.** Gerepareerd: `index.ts` noemde "nine sibling modules" en somde er negen op terwijl het er elf zijn — de twee ontbrekende waren `importBudget.ts` en `supabaseImportBudgetStore.ts`, dezelfde IMP-06/IMP-10-wijziging die GAP-10 veroorzaakte; `importResult.ts` zei vijf modules importeren `types.ts`, het zijn er acht; `types.ts` beweerde dat een gebroken specifier "door niets" wordt gevangen, wat sinds `check:functions` onwaar is; en `index.ts:191` zei dat geen typechecker deze map ziet, wat diezelfde dag ophield te kloppen. **Wat blijft staan:** een zestal comments zegt dat `supabase/functions/**` buiten `tsc --noEmit`, ESLint en vitest valt. Dat is niet ónwaar — de root-tsconfig sluit de map echt uit, en de ESLint- en vitest-helften kloppen onverkort — maar het is onvolledig sinds `check:functions`, en hun architectuurargument (leg logica in `src/domain`) rust nog steeds op de twee helften die wél gelden. Losse comment-edits, geen haast |
| GAP-12 | 🟡 | **Inloggen per link werkte op een telefoon niet, en de ontbrekende helft was het ontvangen.** `requestMagicLink` stuurde altijd al een link met `emailRedirectTo`, en `supabase.ts:52-59` legt uit dat `detectSessionInUrl` web-only is omdat de link op native als deeplink binnenkomt en expliciet ingewisseld moet worden — maar niets wisselde hem in. De mail opende de app en de app negeerde hem; op een iPhone zie je dan een sprong door Safari en kom je niet langs het inlogscherm. Gebouwd: `readAuthRedirect` (`src/domain/social/authRedirect.ts`, 13 tests) leest de fragmenttokens, `completeSignInFromUrl` zet de sessie, en `Linking.useURL()` in `_layout.tsx` vangt zowel een koude start als een draaiende app — twee verschillende API's, en alleen de eerste vangen werkt in elke test en faalt voor elke echte eerste login. **🟡 omdat er nog een dashboardactie bij hoort:** de redirect-URL moet in Supabase onder Authentication → URL Configuration → Redirect URLs staan, en onder Expo Go bevat die je LAN-IP, dus hij verandert met je netwerk. Een ontwikkelbuild met het vaste `remy://`-schema maakt dat blijvend |
| GAP-13 | ⬜ | **Het UI-onderzoek vond fouten in de staande documenten, en die zijn nooit teruggevouwen.** `ui-research/ASSEMBLY.md` zegt expliciet dat het "what the research found to be factually wrong in the standing documents" vastlegt. `DESIGN-SOCIAL.md` is bij het landen van de makeover (`5cca816`) bijgewerkt; `DESIGN.md` (27 aug), `PRODUCT-DECISIONS.md` (27 aug) en `ARCHITECTURE.md` (23 aug) niet — alle drie van vóór het onderzoek. Die correcties leven dus alleen in `ui-research/`, terwijl `DESIGN.md` uit tientallen bronbestanden wordt aangehaald als gezag. Gevonden op 3 september bij het opruimen van `docs/`, en de reden dat die map blijft staan terwijl de drie procesdocumenten eromheen verwijderd zijn |
| GAP-14 | 🟡 | **Inloggen met een getypte code, in plaats van een link.** `auth.ts` betoogde jarenlang dat een code "the better fit for a phone app" is en dat hij "not available to us" was: de code staat alleen in de mail als de template `{{ .Token }}` bevat, en Supabase zet template-bewerking achter custom SMTP. Dat argument stond nog steeds; alleen de premisse veranderde. Gebouwd: `readSignInCode` (`src/domain/social/signInCode.ts`, 11 tests) beoordeelt de invoer vóór er een verzoek aan opgaat, `verifySignInCode` wisselt hem in via `verifyOtp` met `type: 'email'` — níét `'magiclink'`, want dat verwacht de hash uit een aangeklikte URL en laat elke juiste code als ongeldig terugkomen — en `sign-in.tsx` heeft een tweede formulier met `textContentType="oneTimeCode"`, zodat iOS de code boven het toetsenbord aanbiedt en de reis naar de mail-app helemaal wegvalt. **Verlopen en onjuist zijn aparte uitkomsten**, omdat het ene je terugstuurt naar de mail en het andere naar een nieuwe aanvraag. 🟡 tot custom SMTP staat: zonder dat blijft de template onbewerkbaar en komt er geen code in de mail |
| GAP-18 | 🟡 | **Eén van de drie resterende WS1-onderdelen is nu wél toegepast.** `ASSEMBLY.md:218-220` noemt de volledige prijs: "26 colour values per scheme, five `fontFamily` entries, one `typeScale.button` family, three `radii` values, two `@expo-google-fonts` packages added and one removed. No new component." De kleuren waren al gedaan; **`typeScale.button` is nu van monospace af** naar `fontFamily.sansMedium` met `letterSpacing` op 0 — het enige token dat het onderzoek bij naam vroeg, twee keer en van twee kanten: WS1 noemt het "the single-token change with the highest ratio of effect to risk in the repo" (`Ja · Iets anders · Niet koken` leest in mono als een shellprompt), en WS6 kwam er onafhankelijk op uit via `Stuur`, de warmste tik in het product, gerenderd als een terminalcommando. Geen nieuw font: `Archivo_600SemiBold` werd al geladen. **Wat blijft staan:** de vijf `fontFamily`-entries (de families zelf staan nog op Archivo + IBM Plex Mono), de drie `radii`-waarden (nog 0/4/8/16/999), en WS2 t/m WS6 op layout, copy en de sociale laag. De iconen-, beeld- en motionhelft daarvan is wél nagelopen — zie `STYLING-PLAN.md` en GAP-19 t/m GAP-23 |
| GAP-19 | ⬜ | **Er is geen icoonfont, en dat blokkeert ongeveer twintig voorstellen tegelijk.** WS4 §1 koos een gegenereerde Phosphor-subset via `createIconSet` — MIT, ~8-14 KB, géén nieuwe dependency, "no native rebuild, no call-site change beyond the import", geschat op ongeveer een dag. Bestaat niet in de repo. `@expo/vector-icons` heeft vier aanroepplekken in de hele app, allemaal `Feather`, en in vijf van de zeven secties nul. Gevolg: **0 van de 21 empty-state markeringen** uit WS4 §5.3-5.5 is geleverd, en zeven plekken gebruiken letterlijke tekens (`×`, `+`, `▶`, `❚❚`) waar een glyph hoort. Zie `STYLING-PLAN.md` |

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
