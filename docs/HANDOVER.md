# Handover

Waar dit project op dit moment staat, geschreven voor een verse sessie die
niets van de voorgaande gesprekken gelezen heeft.

**Stand:** 3 september 2026, branch `feat/live-import-and-plan-phases`, t/m
`2db0b05`, gepusht en in sync met `origin`. Werkboom schoon op één untracked
`verify-gate.ps1` na, die niet van deze sessie is.

| Lees dit | Waarvoor |
|---|---|
| `LONGLIST.md` | De genummerde backlog. Elke code (IMP-, SRC-, ENT-, OPS-, GAP-…) is daar gedefinieerd, met status en reden. |
| `OPEN-BESLISSINGEN.md` | Wat er nog open staat en waarom. Open vragen A t/m H, plus de beantwoorde met hun bewijs. |
| `PRODUCT-DECISIONS.md` | PD-001 t/m PD-020. Vastgelegd; niet heropenen zonder aanleiding. |
| `DESIGN.md`, `DESIGN-SOCIAL.md`, `ARCHITECTURE.md` | Staande documenten. Zie de waarschuwing onderaan over `DESIGN.md`. |

---

## Wat er draait, en wat niet

**De infrastructuur staat.** Migraties `0001` t/m `0013` draaien — nagemeten
tegen de live database, niet aangenomen. De drie secrets staan er
(`IMPORT_FINGERPRINT_SALT`, `YOUTUBE_API_KEY`, `GEMINI_API_KEY`), afgelezen
van het dashboard. De edge functie is gedeployed, dus de throttlepoort en de
dichting van het anon-key-gat zijn werkelijk actief.

**Vier checks, allemaal groen:**

```
npm run typecheck        exit 0
npm run check:functions  exit 0
npm run lint             exit 0
npm test                 2561 tests / 101 bestanden
```

Draai ze alle vier na elke wijziging. `npm test` duurt ongeveer twintig
seconden.

---

## Waar de vorige sessie middenin zat

**Inloggen op een echte telefoon is nog niet bevestigd.** Dat is het enige
losse draadje, en het staat er zo voor:

1. **Gebouwd en gepusht** (`2db0b05`, GAP-12): de app kan een inloglink nu
   ontvangen. `readAuthRedirect` leest de tokens uit het URL-fragment,
   `completeSignInFromUrl` zet de sessie, en `Linking.useURL()` in
   `_layout.tsx` vangt zowel een koude start als een draaiende app. Dertien
   tests.
2. **Gedaan door de eigenaar:** `exp://192.168.178.129:8081/--/**` staat nu
   in Supabase onder Authentication → URL Configuration → Redirect URLs,
   naast het al bestaande `remy://**`.
3. **Nog niet geverifieerd:** of de link daadwerkelijk landt. De eigenaar
   liep tegen de verzendlimiet aan voordat hij het kon proberen.

**Die verzendlimiet is geen bug.** Supabase's ingebouwde mailer is een
testfaciliteit: een handvol berichten per uur, en hij weigert élk adres dat
niet in het projectteam zit. Om eromheen te komen zonder te wachten laat je
de admin-API de link genereren zonder hem te versturen — in een eigen
terminal, zodat de service-role key niet in een transcript belandt:

```powershell
$key = Read-Host "service role key"
$body = @{ type='magiclink'; email='<adres>'; redirect_to='exp://192.168.178.129:8081/--/' } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "https://obzoieijpkmauyexyozo.supabase.co/auth/v1/admin/generate_link" `
  -Headers @{ apikey=$key; Authorization="Bearer $key" } `
  -ContentType 'application/json' -Body $body | Select-Object -ExpandProperty action_link
```

Open die link op de telefoon. Safari flitst even — dat is het mechanisme en
niet de fout: de mail moet een `https`-link zijn om aanklikbaar te zijn,
Supabase valideert hem en redirect door naar `exp://…`, waarna iOS dat aan
Expo Go geeft.

**Als het dan nog niet lukt:** `completeSignInFromUrl` slikt zijn uitkomst
bewust in, dus de volgende stap is één tijdelijke logregel die zegt welke van
`session` / `error` / `unsupported_flow` / `none` binnenkomt. Dat scheelt
gokken tussen "de allowlist matcht niet" en "de app leest iets anders dan een
sessie".

---

## De app op een toestel krijgen

De SDK-upgrade van 3 september (OPS-01, zes stappen, zes commits) bracht dit
project van SDK 51 naar 57. Dat is de versie die Expo Go ondersteunt, dus:

```
npx expo start
```

Expo Go uit de App Store, QR scannen, telefoon en laptop op dezelfde wifi.
Bij netwerkisolatie: `npx expo start --tunnel`.

⚠ **Het IP in de redirect-URL is dat van de laptop.** Verandert het netwerk,
dan verandert `Linking.createURL('/')` mee en moet de allowlist in Supabase
opnieuw. Een ontwikkelbuild met het vaste `remy://`-schema (OPS-02) maakt dat
blijvend, en is toch nodig voor ENT-01.

---

## Wat een verse sessie moet weten voordat hij iets aanraakt

**Deze codebase neemt zijn eigen argumenten serieus.** Comments zijn lang,
leggen uit *waarom*, en noemen het afgewezen alternatief erbij. Code en
comments zijn Engels; documenten in `docs/` zijn Nederlands. Schrijf in
dezelfde stijl, anders valt het uit de toon.

**Verifieer wat een document beweert voordat je erop bouwt.** Deze sessie
vond drie backlogregels die de code allang voorbij was (PRF-02, ENT-03,
IMP-09) en één bewering die simpelweg onwaar was: `OPEN-BESLISSINGEN.md` zei
dat geen enkele migratie gedraaid was, terwijl `0011` en `0012` al live
stonden. Die zin was van versie op versie overgeschreven en nooit tegen de
database gecontroleerd; één query loste het op. Een document nakijken vindt
zoiets niet — alleen de bron vragen vindt het.

**Er is een Fact-Forcing Gate actief.** Vóór het aanmaken van een bestand of
een destructief commando eist die eerst de feiten: wie roept dit aan, welke
Glob bewijst dat het niet al bestaat, welke data raakt het, en de instructie
van de gebruiker letterlijk geciteerd.

---

## Wat er nu open ligt

`LONGLIST.md` heeft het volledige beeld met redenen. In het kort: **geen
enkele beslissing van de eigenaar staat nog in de weg** — dat was sinds
augustus niet zo. De eerstvolgende dingen:

1. **De app op een toestel doorlopen.** Eén echte import door de flow, plus
   de throttle-test (21 binnen tien minuten; de 21e hoort `import_throttled`
   te krijgen). Dubbel waardevol: het test de deploy én het renderpad van de
   nieuwe architectuur, die sinds SDK 55 verplicht aanstaat en die geen
   enkele test raakt.
2. **Custom SMTP.** Blokkeert nu al twee dingen: de code-route bij inloggen
   (templates zijn niet te bewerken zonder) en het aantal pogingen. En hij
   weigert elk adres buiten het projectteam, dus geen testgebruiker kan ooit
   inloggen. Ongeveer twintig minuten in een dashboard, en nodig vóór de
   eerste echte gebruiker.
3. **IMP-05** — één secret, geen code: `GEMINI_MODEL` op een gedateerde
   snapshot pinnen.
4. **GAP-02 / open vraag A** — mag een webpagina een canonieke receptrij
   hebben? Het duurst betaalde openstaande punt.

---

## Eén schuld die nergens anders opgeschreven staat

`docs/ui-research/` (11 MB, zes workstream-rapporten plus 45 renders) is het
onderzoek waar de UI-makeover uit voortkwam. `ASSEMBLY.md` daarin zegt dat
het onderzoek dingen vond die **feitelijk onjuist zijn in de staande
documenten**.

`DESIGN-SOCIAL.md` is bij het landen van de makeover bijgewerkt.
`DESIGN.md` (27 augustus), `PRODUCT-DECISIONS.md` (27 augustus) en
`ARCHITECTURE.md` (23 augustus) zijn dat **niet** — alle drie dateren van
vóór het onderzoek. Wat het onderzoek over die drie vond is dus nooit
teruggevouwen en leeft alleen in `ui-research/`.

Dat is de reden dat die map niet is opgeruimd toen de drie
makeover-procesdocumenten dat wel werden. Weggooien zou bovendien niets
opleveren: de blobs zitten al permanent in de git-geschiedenis, dus
verwijderen uit de werkboom wint geen byte terug.

**Wie op `DESIGN.md` gaat bouwen, leze eerst wat `ui-research/ASSEMBLY.md`
over de staande documenten zegt.**
