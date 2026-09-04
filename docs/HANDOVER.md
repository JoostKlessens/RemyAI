# Handover

Waar dit project op dit moment staat, geschreven voor een verse sessie die
niets van de voorgaande gesprekken gelezen heeft.

**Stand:** 4 september 2026, branch `feat/live-import-and-plan-phases`, t/m
`9fafefc`, gepusht en in sync met `origin`. Werkboom schoon op één untracked
`verify-gate.ps1` na, die niet van deze sessies is.

| Lees dit | Waarvoor |
|---|---|
| `LONGLIST.md` | De genummerde backlog. Elke code (IMP-, SRC-, ENT-, OPS-, GAP-…) is daar gedefinieerd, met status en reden. |
| `OPEN-BESLISSINGEN.md` | Wat er nog open staat en waarom. Open vragen A t/m H, plus de beantwoorde met hun bewijs. |
| `STYLING-PLAN.md` | Iconen, beeld en animatie: wat het onderzoek besloot, wat daarvan geland is, en wat niet. Nieuw op 4 september. |
| `PRODUCT-DECISIONS.md` | PD-001 t/m PD-020. Vastgelegd; niet heropenen zonder aanleiding. |
| `DESIGN.md`, `DESIGN-SOCIAL.md`, `ARCHITECTURE.md` | Staande documenten. Zie de waarschuwing onderaan over `DESIGN.md`. |

---

## Wat er draait

**De infrastructuur staat, en is nagemeten in plaats van aangenomen.**
Migraties `0001` t/m `0013` draaien tegen de live database. De drie secrets
staan er (`IMPORT_FINGERPRINT_SALT`, `YOUTUBE_API_KEY`, `GEMINI_API_KEY`).
De edge functie is gedeployed, dus de throttlepoort en de dichting van het
anon-key-gat zijn werkelijk actief.

**De app draait op een telefoon.** Sinds de SDK-upgrade van 51 naar 57
(OPS-01, zes stappen, zes commits) is dit de versie die Expo Go
ondersteunt:

```
npx expo start
```

Expo Go uit de App Store, QR scannen, telefoon en laptop op dezelfde wifi.
Bij netwerkisolatie: `npx expo start --tunnel`.

**Vier checks, allemaal groen:**

```
npm run typecheck        exit 0
npm run check:functions  exit 0
npm run lint             exit 0
npm test                 2572 tests / 102 bestanden
```

Draai ze alle vier na elke wijziging. `npm test` duurt ongeveer twintig
seconden.

---

## Inloggen — drie routes, één werkt

Dit heeft twee dagen gekost en de uitkomst is de moeite waard om precies op
te schrijven.

**1. Wachtwoord, alleen in ontwikkeling — dit is de route die werkt.**
Maak een gebruiker in Supabase onder Authentication → Users → Add user, met
**Auto Confirm User aan**. Op het inlogscherm staat onder het echte
formulier een blok `ALLEEN IN ONTWIKKELING`. Dat levert dezelfde sessie op
als een magic link — echt `sub`-claim, echte RLS, echte
`onAuthStateChange` — dus wat je test is de app en geen namaak ervan.
Dubbel afgeschermd: `{__DEV__ ? … : null}` bij de aanroeper én een weigering
in `signInWithDevPassword` zelf.

**2. Inloglink — gebouwd, nooit bevestigd.** De ontvangende helft ontbrak
(`readAuthRedirect`, `completeSignInFromUrl`, `Linking.useURL()` in
`_layout.tsx`) en is er nu. `exp://<lan-ip>:8081/--/**` moet in Supabase
onder Authentication → URL Configuration → Redirect URLs staan. ⚠ **Dat IP
en die poort zijn die van de laptop**: verandert je netwerk, of pakt Metro
poort 8082 omdat 8081 bezet is, dan matcht de allowlist niet meer en valt
Supabase stil terug op de Site URL — wat zich voordoet als een sprong naar
Safari. Precies dat is twee dagen lang de fout geweest.

**3. Zes cijfers — gebouwd, wacht op een mailserver.** `readSignInCode` +
`verifySignInCode` staan er met elf tests. De code komt alleen in de mail
als de template `{{ .Token }}` bevat, en Supabase laat die template pas
bewerken zodra er custom SMTP staat. **De eigenaar wil Resend niet.** Elke
SMTP-server waar je zelf inloggegevens van hebt voldoet — Supabase kijkt
naar *of* er custom SMTP is, niet van wie.

**Wat de ingebouwde mailer van Supabase niet kan**, en dat is drie keer een
blokkade geweest: een handvol berichten per uur, geen bewerkbare templates,
en hij weigert élk adres dat niet in het projectteam zit. Zonder eigen SMTP
kan dus geen enkele testgebruiker ooit inloggen.

---

## Wat er op 4 september gebeurde, en waarom het telt

De eigenaar keek voor het eerst naar de app en vond hem lelijk. Twee
oorzaken, allebei bevestigd:

**Het palet van het onderzoek was nooit toegepast.** De makeover van
`5cca816` landde 72 bestanden, maar `git show 5cca816 -- src/theme/tokens.ts`
geeft nul kleurwijzigingen. Nagemeten: **26 van 26 tokens verschilden**, in
beide schema's. WS1 §4.1/§4.2 bevatte een kant-en-klaar
`satisfies ColorTokens`-blok dat simpelweg nooit geplakt is. Nu wel, 52 van
52 gecontroleerd. Het is ook meetbaar beter: de oude grond stapte
`background → surface` op 1.10:1, een hiërarchie die het oog niet ziet; de
nieuwe op 1.24:1.

**De `__DEV__`-fixture-rijen stonden altijd aan.** `__DEV__` is in Expo Go
altijd waar, dus vier scenario-kiezers renderden bovenaan élk scherm, boven
het product. Nu achter `DEV_SCENARIO_ROWS_VISIBLE` in `src/lib/devFlags.ts`,
standaard uit. De ontwikkelaars-inlog is daar expres níét in meegegaan: dat
is de enige deur naar binnen, en die achter dezelfde vlag zetten is de deur
op slot doen met de sleutel erin.

**Daarna zijn zeven parallelle audits gedraaid**, één per menusectie, met de
opdracht eerst te lezen wat WS2 t/m WS6 al besloten hadden. Uitkomst in
`STYLING-PLAN.md`; de vijf grootste staan als GAP-19 t/m GAP-23 in de
longlist. Kern: nul van eenentwintig empty-state markeringen geleverd,
twaalf vastgelegde haptics ongebouwd, en zeven componenten die het onderzoek
specificeert bestaan geen van alle.

---

## De les die deze twee dagen opleverde

**Vertrouw geen document zonder het tegen de bron te houden.** De teller
staat inmiddels op:

- `OPEN-BESLISSINGEN.md` zei dat geen enkele migratie gedraaid was; `0011`
  en `0012` stonden al maanden live. Eén query loste het op.
- WS1's palet: 26 van 26 tokens ongebruikt.
- WS4's markeringen: 0 van 21 geleverd.
- Drie backlogregels (PRF-02, ENT-03, IMP-09) beschreven werk dat de code
  allang voorbij was.
- WS6 beweert dat de eigen handle op `friends/add` in monospace staat. Niet
  waar, en al niet waar vóórdat WS6 geschreven werd.

Een document nakijken vindt dit niet. Alleen de bron vragen vindt het: de
database, de code, `git show`. Doe dat vóórdat je op een bewering bouwt, en
schrijf op wat je nameet — dat is waarom de bevindingen hierboven een
regelnummer of een commit-hash bij zich dragen.

---

## Conventies

**Deze codebase neemt zijn eigen argumenten serieus.** Comments zijn lang,
leggen uit *waarom*, en noemen het afgewezen alternatief erbij. Code en
comments zijn Engels; documenten in `docs/` zijn Nederlands.

**Er is een Fact-Forcing Gate actief.** Vóór het aanmaken van een bestand of
een destructief commando eist die eerst de feiten: wie roept dit aan, welke
Glob bewijst dat het niet al bestaat, welke data raakt het, en de instructie
van de gebruiker letterlijk geciteerd. Bij een bounce: feiten presenteren en
exact hetzelfde commando opnieuw geven.

**Heredocs met veel inhoud falen in deze shell.** Grote `python - <<'PY'`
blokken breken op "unexpected EOF"; schrijf het script dan naar de
scratchpad en voer het uit. Let ook op CRLF: `^…$` met `re.M` matcht niet
door de `\r` heen, gebruik `\r?$`.

---

## Wat er nu open ligt

Geen enkele beslissing van de eigenaar blokkeert nog werk. Op volgorde:

1. **De app op een toestel doorlopen.** Eén echte import door de flow, plus
   de throttle-test (21 binnen tien minuten; de 21e hoort `import_throttled`
   te krijgen). Dubbel waardevol: het test de deploy én het renderpad van de
   nieuwe architectuur, die sinds SDK 55 verplicht aanstaat en die geen
   enkele test raakt.
2. **De goedkope haptics** (GAP-20). Twaalf regels code tegen een dependency
   die er al staat; WS5 noemt er één "the highest-value single change in
   this report per line of code".
3. **De twee echte defecten uit de styling-audit:** het importlaadblok
   flikkert bij een cachetreffer (GAP-23), en de vaste timerbalk in
   kookmodus is nooit gebouwd (GAP-22) — de state-helft van die reparatie is
   wél geland, de zichtbare helft niet.
4. **Het icoonfont** (GAP-19). Ongeveer een dag, geen nieuwe dependency, en
   het deblokkeert twintig voorstellen tegelijk.
5. **Eigen SMTP**, waarna de zes-cijfer-route werkt en er testgebruikers
   kunnen bestaan.
6. **IMP-05** — één secret, geen code: `GEMINI_MODEL` op een gedateerde
   snapshot pinnen.
7. **GAP-02 / open vraag A** — mag een webpagina een canonieke receptrij
   hebben? Het duurst betaalde openstaande punt.

**Beslist en niet heropenen zonder aanleiding:** GAP-08 (`dishTags` blijft
optioneel, om de symmetrie met `recipeId`), ENT-03 (klembord-detectie
geschrapt, botst met `paste.tsx`'s "nooit de invoer inspecteren").

**Ligt bij de eigenaar:** de mascotte. Zes van de zeven audits raden hem af
op vastgelegde gronden — WS4 verbiedt gezichten in illustratie, WS5 verbiedt
attract loops. Eén audit ontwierp hem voor de importwachttijd, de enige plek
waar geen van beide regels reikt. `STYLING-PLAN.md` heeft beide kanten, plus
de naamkwestie rond `remyapp.io` die WS1 opwerpt.

---

## Twee schulden die nergens anders staan

**`DESIGN.md` is ouder dan het onderzoek dat hem tegenspreekt** (GAP-13).
`ui-research/ASSEMBLY.md` zegt te noteren wat het onderzoek "factually
wrong" vond in de staande documenten. `DESIGN-SOCIAL.md` is bij de makeover
bijgewerkt; `DESIGN.md` (27 aug), `PRODUCT-DECISIONS.md` (27 aug) en
`ARCHITECTURE.md` (23 aug) niet. Die correcties leven alleen in
`ui-research/`, terwijl `DESIGN.md` uit tientallen bronbestanden als gezag
wordt aangehaald. **Wie erop gaat bouwen, leze eerst wat `ASSEMBLY.md` over
de staande documenten zegt.**

**WS2, WS3 en het grootste deel van WS6 zijn nooit tegen de code gehouden**
(GAP-18). De styling-audit raakte ze alleen waar ze iconen, beeld en motion
kruisten. Gegeven dat 26 van 26 kleuren en 0 van 21 markeringen gemist
bleken, is de kans klein dat layout, copy en de sociale laag wél volledig
geland zijn. Dat is dezelfde controle als deze week: lezen wat besloten is,
en het tegen de code houden.
