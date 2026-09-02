# Open beslissingen

Dit document is het complement van `PRODUCT-DECISIONS.md`. Dat legt vast wat
besloten **is**; dit legt vast wat nog open staat, waarom, en wat elke keuze
ontgrendelt.

Geschreven als overdracht: een verse sessie moet hieruit kunnen doorwerken
zonder de voorgaande gesprekken gelezen te hebben.

**Stand:** 2 september 2026, branch `feat/live-import-and-plan-phases`,
gepusht t/m `a0de65c`. Typecheck exit 0, lint schoon, 2436 tests over 96
bestanden.

---

## Wat er sinds `b9b0f59` gebouwd is

Twaalf commits, zodat je weet welke code de vragen hieronder raken.

| Commit | Wat |
|---|---|
| `7af4432` | Boodschappenlijst — domeinlaag én scherm |
| `eb4de15` | Porties schalen (`scaleRecipe.ts`) |
| `95ae37e` | schema.org/JSON-LD receptparser |
| `a41be74` | Mijn recepten: zoeken, filteren, sorteren, archiveren |
| `9208711` | YouTube-URL's, TikTok-shortlinks, creator-attributie |
| `a8a6401` | Ingang naar de boodschappenlijst |
| `a64d38b` | Webimport en YouTube end-to-end, met creditvermelding |
| `a078c56` | Herkomst op geëxtraheerde recepten + import-telemetrie |
| `599d49a` | Hoeveelheden overleven het bevestigingsscherm + e2e-test |
| `70b8b96` | Geplakte tekst, weekplanning, opgeslagen recept corrigeren |
| `97eed20` | Gearchiveerde gerechten kopen geen boodschappen meer |
| `a0de65c` | Twee migratievoorstellen (niet toegepast) |

Importroutes die nu werken: TikTok (incl. `vm.`/`vt.`-sharelinks), Instagram
(display-only, PD-011), YouTube, het open web via JSON-LD, Pinterest (als
gewone webpagina), en geplakte tekst.

---

## 1. Het anon-key-gat — draai dit eerst

**Status:** niet geverifieerd. Dertig seconden werk.

`parse-recipe/index.ts` beweerde in zijn header dat JWT-verificatie "het
enige is dat een anonieme, niet-geauthenticeerde beller tegenhoudt" van het
opdrijven van de modelrekening. Die bewering is onjuist en is in het bestand
gecorrigeerd. `verify_jwt` controleert alléén dat een token met het
project-secret is ondertekend — en de anon key ís zo'n token. Die zit per
ontwerp in de app-bundle, is leesbaar voor iedereen die de app downloadt, en
draagt geen `sub`.

De tekstroute maakt dat gat goedkoop te misbruiken: geen geldige URL, geen
oEmbed-ronde, geen echte video. Een lus die `{"text": "..."}` post is een lus
die een betaald model aanroept op jouw rekening.

```powershell
$url = $env:EXPO_PUBLIC_SUPABASE_URL
$key = $env:EXPO_PUBLIC_SUPABASE_ANON_KEY
try {
  $r = Invoke-WebRequest -Method POST -Uri "$url/functions/v1/parse-recipe" `
    -Headers @{ Authorization = "Bearer $key"; 'Content-Type' = 'application/json' } `
    -Body '{"text":"x"}'
  "HTTP $($r.StatusCode)"
} catch {
  "HTTP $($_.Exception.Response.StatusCode.value__)"
}
```

**200 of 400** = de beller bereikte de functie; het gat bestaat.
**401 of 403** = afgeschermd.

**Wat de uitkomst verandert:** bij 200/400 springt beslissing 3 van "deze
week" naar "vandaag".

---

## 2. Migratie `0011` — mag web/YouTube een canonieke receptrij hebben?

**Bestand:** `supabase/migrations/0011_canonical_recipes_platform_widening.sql`
(geschreven, **niet toegepast**)

Vandaag krijgt elke web- of YouTube-import `recipeId: null`. Dat kost twee
dingen:

- **Geen deduplicatie.** De route die er het meest baat bij zou hebben is
  uitgesloten: een populair blogrecept is één canonieke URL die veel
  huishoudens delen, waar een TikTok meestal één keer gevonden wordt.
- **Geen kookbewijs.** `shared_cooks` (0009) joint op de canonieke rij, dus
  een gerecht dat iemand écht gekookt heeft is onzichtbaar voor de sociale
  laag, puur vanwege de herkomst.

### De vraag die er echt in zit

Een videocaption ligt vast. Een webpagina niet — uitgevers corrigeren
hoeveelheden, passen oventemperaturen aan, herschrijven stappen. Een rij die
in maart gecachet wordt en in november aan een nieuw huishouden geserveerd
wordt, geeft ze een versie die de uitgever allang heeft rechtgezet, zonder
enig signaal.

Drie verdedigbare antwoorden, geen ervan gekozen in de migratie:

1. Nooit opnieuw ophalen (goedkoopst, minst waar over tijd)
2. Opnieuw ophalen na N dagen
3. Opnieuw ophalen en vergelijken; rij behouden maar als verouderd markeren

### Keuze

| Optie | Gevolg |
|---|---|
| **Volledig toepassen** (`youtube` + `web`) | Beide routes krijgen dedup en kookbewijs; de staleness-vraag blijft open |
| **Conservatief** (`web` weglaten) | Alleen YouTube. Beschrijvingen liggen net zo vast als captions, dus géén staleness-risico, en je wint kookbewijs voor die route. Een redelijk punt om te stoppen, geen halve maatregel |
| **Niet toepassen** | Status quo; beide routes blijven buiten de sociale laag |

**Let op:** `0011` toepassen vereist dat `canStoreCanonicalRecipe` in
`src/domain/import/canonicalRecipe.ts` in dezelfde wijziging meegroeit. Doe
je dat niet, dan gaat de app schrijfacties fáléń die hij nu netjes overslaat.

**`'text'` staat er bewust niet in.** Deze tabel dedupliceert op
`normalized_url` en geplakte tekst heeft er geen. Toevoegen zou een
synthetische sleutel vereisen (een hash van de tekst), en dat is een andere
feature met eigen faalgedrag — hoort apart beargumenteerd te worden.

---

## 3. Migratie `0012` — komt er een rate-limit-tabel?

**Bestand:** `supabase/migrations/0012_import_rate_limit.sql`
(geschreven, **niet toegepast**)

`decideImportBudget` (`src/domain/import/importBudgetPolicy.ts`) is gebouwd,
getest en bewust aan niets gekoppeld. Er is namelijk geen duurzame teller:
geen tabel telt imports, `recipes` heeft geen importer-kolom en geen rij voor
mislukkingen, en `meals` wordt pas na menselijke bevestiging geschreven — dus
telt alleen imports die iemand leuk vond. Een misbruiker bevestigt niets.

Een throttle op een teller die vergeet, is een throttle in naam.

### Wat er in het voorstel zit

- Eén rij per import-**poging** die iets kost. Cache-hits, Instagram
  (display-only) en JSON-LD-webimports kosten nul en worden op nul
  geregistreerd — een nulrij is nog steeds bewijs van verkeer.
- Geen URL, caption, tekst, titel of receptinhoud. Er is geen kolom waar dat
  in zou kunnen. Structurele garantie, geen belofte.
- Beller is een gezouten fingerprint, geen IP. Het zout staat in de omgeving
  van de functie, nooit in de tabel.
- **RLS aan met nul policies.** Een client die dit kan lézen weet precies hoe
  dicht hij bij het plafond zit, en dat maakt een plafond makkelijk om
  tegenaan te gaan zitten.

### Twee dingen om te weten vóór toepassen

- **De opschoning is niet ingepland.** Retentie is 48 uur, maar deze repo
  heeft geen pg_cron-migratie, en die introduceren als bijvangst van een
  throttle-tabel is de verkeerde plek. Tot iemand dit inplant groeit de
  tabel onbegrensd. De delete staat in het bestand.
- **Er zit een read-then-write race in.** Twee gelijktijdige verzoeken van
  dezelfde beller kunnen allebei onder het plafond lezen. Dichten kost een
  extra round trip op élke import om een handvol modelaanroepen terug te
  winnen. De afweging staat opgeschreven zodat een licht overschreden
  plafond herkend wordt als bekend, niet als bug.

---

## 4. Ontbrekende secret en ongeteste code

**`YOUTUBE_API_KEY`.** Zonder deze secret faalt YouTube-import eerlijk met
`missing_credentials` — maar hij faalt.

```
supabase secrets set YOUTUBE_API_KEY=...
```

**Niets onder `supabase/functions/` is ooit uitgevoerd.** Die map valt buiten
`tsc`, buiten ESLint én buiten vitest. Imports zijn met de hand
gecontroleerd (alle value-imports hebben hun `.ts`-extensie, anders faalt de
deploy) en een losse strikte pass geeft exit 0. Maar de byte-cap, de
timeouts, de redirect-lus en de telemetrieregel zijn gelezen en beredeneerd,
nooit gedraaid.

Wat het echt test: `deno check`, plus één echte `vm.tiktok.com`-URL door de
importflow.

---

## 5. De UI-makeover blokkeert nu werk

Twaalf gewijzigde bestanden plus untracked docs staan al de hele sessie
ongecommit. Ze zijn met opzet nooit aangeraakt — elke commit hierboven
gebruikte expliciete paden, nooit `git add -A`.

Maar het is inmiddels meer dan een troebele diff: **RCP-01's porties-UI kan
alleen in `src/app/cook/[mealId].tsx` landen**, en dat is een
makeover-bestand. De domeinlaag (`scaleRecipe.ts`) is af en getest en heeft
geen scherm.

Ook `src/app/(tabs)/index.tsx` staat op 808 regels, over de eigen 800-grens,
en is om dezelfde reden geblokkeerd.

---

## 6. Waar hoort "plan dit gerecht in"?

**Productkeuze, geverifieerd probleem.**

`createSave` is bereikbaar vanaf precies één plek in de app: het
bevestigingsscherm van de import. Een recept kan dus **alleen ingepland
worden op het moment dat het binnenkomt**.

Wat dat nu al kost:

- Iets uit de week halen is een eenrichtingsdeur.
- De lege staat van het weekscherm zegt "Bewaar een recept met 'Deze week'
  in Mijn recepten" — een pad dat niet bestaat.
- De bevestigingscopy is daar bewust bot over in plaats van een terugweg te
  beloven.

`removeSaves` bestaat inmiddels wel (`97eed20`). Wat ontbreekt is de actie
aan de bibliotheekkant. De database is er klaar voor — `0001` verleent zowel
`saves_update` als `saves_delete` — dus dit is geen migratie, alleen een
plaatsingsvraag: long-press-sheet, tegel-actie, of het receptdetail.

---

## 7. PRF-02 — allergeenfilters bij het importeren

**Ziet eruit als bedrading, is het niet.**

Een geïmporteerd gerecht wordt aangemaakt met `ingredientTags: []` en
`allergenTagStatus` op `'unknown'`. `exclusions.ts` matcht op
`ingredientTags` en kijkt alleen naar `'verified'` gerechten. De
uitsluitingen bij het importeren draaien zou dus élke keer niets matchen.

Het écht maken betekent tags afleiden uit ingrediënttekst — en PD-006 staat
dat alleen toe als **suggestie die een mens bevestigt**, nooit als
verificatie. De vraag is dus hoeveel wrijving je op het bevestigingsscherm
accepteert, en dat is een productkeuze.

---

## 8. De lang openstaande blokkades

Ongewijzigd sinds de eerste analyse, hier zodat een verse sessie ze niet
opnieuw ontdekt.

| Item | Vraag | Ontgrendelt |
|---|---|---|
| **DEC-01** | Staat "any other use of metadata or content" nog in Meta's oEmbed-voorwaarden? Meta draaide 15 juni 2026 de tokeneis terug — dat haalt de toegangsdrempel weg, niet automatisch de gebruiksbeperking | Instagram volledige extractie (SRC-04) — waarschijnlijk het grootste importvolume, en technisch één functie die `false` teruggeeft |
| **DEC-02** | Video-audio transcriberen of OCR? Nu bewust buiten scope op auteursrechtelijke gronden, op twee plekken in de code | SRC-09. **Wacht op data:** de telemetrie uit `a078c56` een maand laten lopen vertelt of `no_recipe_in_caption` een paar procent of de helft is. Bij een paar procent is de vraag gratis beantwoord |
| **DEC-03** | De supermarkt in? Geen publieke product-API bij AH of Jumbo; scrapen is doorlopend onderhoud | BSK-04/05/06. De tussenweg (BSK-01, lijst zonder prijzen) is al gebouwd |
| **RCP-02** | Voedingswaarden overnemen of schatten? JSON-LD levert ze feitelijk; uit een caption zou het verzinnen zijn, en het is gezondheidsdata onder PD-005 | Voedingswaarden per portie |
| **LIB-02** | Hoe groepeer je zonder een kerkhof te bouwen? PD-004a verbiedt bewaren-zonder-voorstellen; mappen zijn de standaardvorm van precies dat | Collecties |
| **BIZ-03** | Waar ligt de betaalgrens? Niet op imports (dat wurgt de invoer waar de app op draait, en SlimMandje's eigen reviews laten zien wat dat kost). Niet op de sociale laag, want die is het product | Verdienmodel |
| **OPS-01/02** | Wanneer de Expo SDK-upgrade? SDK 51 / RN 0.74 zijn van medio 2024 | ENT-01, de share extension — nog steeds het item met de meeste hefboom op de hele lijst |
| **OPS-03** | Engelse vertaling waard? Copy zit hardcoded Nederlands in tientallen `*Copy.ts`-modules; er is geen i18n-laag | Engelstalig publiek |

---

## 9. Kleine hygiëne — geen beslissing nodig

Ongeveer een uur samen. Kan meeliften met wat er hierna ook gebeurt; hier een
eigen wave voor optuigen is de kosten niet waard.

1. `src/app/(tabs)/recipes.tsx` staat op 816 regels, over de 800-grens.
   Extractie, zelfde patroon als `LibraryHeader`.
2. `LibraryHeader`'s deur zegt "Boodschappen" en zou "Deze week" moeten
   zeggen, zodat de lus in causale volgorde leest.
3. `<Stack.Screen>`-declaraties voor `/deze-week` en `/boodschappen` in
   `_layout.tsx`.
4. Twee verouderde `'text'`-doccomments in `importResult.ts`, plus een dode
   `'text'`-guard in `resolveImport` waarvan de echte fix het versmallen van
   `NormalizedUrlResult.platform` is.
5. `CreateMealInput.dishTags` naar verplicht (uitgesteld sinds wave 4;
   ripplet door naar `tests/repository/`).

---

## Aanbevolen volgorde

1. **De curl uit §1.** Dertig seconden, en het bepaalt de urgentie van §3.
2. **§5, de makeover committen.** Het blokkeert nu actief ander werk, en hoe
   langer het meeloopt hoe lastiger de diff los te lezen wordt van wat er
   daarna bovenop kwam.
3. **§2 en §3, de twee migraties.** Lees de bestanden; de afweging staat
   erin. Bij een 200 uit §1 gaat §3 voor.
4. **§4, secret en live test**, voordat hier iets naar productie gaat.
5. Dan pas de productvragen: §6, §7, en de DEC-lijst in §8.
