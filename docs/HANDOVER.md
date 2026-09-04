# Handover

Waar dit project op dit moment staat, geschreven voor een verse sessie die
niets van de voorgaande gesprekken gelezen heeft.

**Stand:** 4 september 2026, branch `feat/live-import-and-plan-phases`, t/m
`6158bc3` gepusht. **De werkboom is niet meer schoon:** de eerste drie punten
van het stylingplan zijn gebouwd en getest maar nog niet gecommit — zie
"Wat er in de middag van 4 september bij kwam" hieronder. Daarnaast staat er
nog steeds een untracked `verify-gate.ps1` die niet van deze sessies is.

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
npm test                 2598 tests / 104 bestanden
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

## Wat er in de middag van 4 september bij kwam

**De eerste drie punten van het stylingplan zijn uitgevoerd, plus twee die
meelagen.** Nog niet gecommit; vier checks groen. Vijf van de zes gaan over
dingen die het onderzoek al had besloten en die nooit gebouwd waren.

**GAP-20 — de haptics, met een loket.** WS5 §3.2 heeft een tabel van vijftien
gebeurtenissen; er waren er drie gebouwd. Nu alle, plus vijf die de audit
niet noemde. Wat de moeite van het onthouden waard is, is de vorm: alles
loopt door `src/lib/haptics.ts`, met namen die het GEWICHT VAN HET GEVOLG
noemen (`hapticRealCommit`) in plaats van de API (`impactAsync(Medium)`).
Reden: een aanroepplek moet dan beantwoorden of dit een echte toezegging is,
niet of Medium lekker voelt — en dat is precies hoe een woordenschat van vier
er een van acht wordt die niemand meer uit elkaar hoort. `Heavy`, `Soft`,
`Rigid` en `Warning` zijn expres niet blootgesteld.

De `.catch` bij elke aanroep is niet defensief maar dragend: de
webimplementatie van `expo-haptics` is een lége default export, dus élke
aanroep is daar een afgewezen promise, en deze app exporteert naar web. Die
regel stond in drie kopieën en staat nu één keer.

**GAP-21 — het einde van kookmodus.** De succes-haptic op `Gemaakt!`, de
`positive` haarlijn eronder, en de haptic bij het cijfer. De haarlijn heeft
bewust dezelfde hoogte en marge als `FriendProofCard`'s closed-loop streep:
het is het vierde lid van een familie die er al was — blauw als je kiest,
blauw als je iemand kiest, groen als wat je stuurde gekookt werd, en nu groen
als je het zelf kookte.

**GAP-22 — de timerbalk, en de bug die niemand had opgeschreven.** De balk
zelf was voorspeld. Wat de audit niet had gezien: de succes-haptic en
`Timer klaar` zaten ín `TimerDisplay`, dat niet gemonteerd is voor een stap
waar je vandaan gebladerd bent. **Een timer die afliep terwijl je vooruitlas
zei tegen niemand iets** — niet alleen onzichtbaar, ook stil, ook voor een
schermlezer. De balk zegt het nu, mét het stapnummer. Welke timer hij toont
is puur en getest (`src/domain/cookTimerBar.ts`, 13 tests).

**GAP-23 — de flikkerbug.** Een derde fase `pending` waarin het verzoek weg
is maar er niets verandert op het scherm; de narratie verschijnt pas na
`motion.durationNormal`. **Uitgestelde start, geen minimale toondrempel** —
een drempel zou dit scherm een wachttijd laten verzinnen, en dat is dezelfde
leugen als een spinner die in niets oplost, alleen andersom verteld.

**GAP-24 en GAP-18.** De voortgangslijn vult zich in plaats van te springen
(`scaleX` op de native driver, niet `width` — dat is een layout-eigenschap en
had elk frame door de JS-thread geduwd, op het ene scherm waar die thread ook
een aftelling hertekent). En `typeScale.button` is van monospace af, het
enige token dat het onderzoek bij naam vroeg, van twee kanten onafhankelijk.

**Twee dingen om te onthouden voor de volgende uitvoerder:**

- **Een haptic hoort nooit binnen een `setState`-updater.** React mag die
  meer dan één keer draaien — in StrictMode doet hij dat expres — en dan
  trilt één tik twee keer. Op de boodschappenlijst wordt daarom de
  module-cache gelezen vóór de `setState`, niet de `current` erbinnen.
- **De laadfase van import heeft er een toestand bij.** Wie de
  checkpoint-animaties uit WS5 §5.3 bouwt (punt 10 van het stylingplan),
  hangt ze aan `loading` en niet aan "een verzoek is weg" — anders is de
  flikkering terug.

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

**Bewerk bestaande bestanden BINAIR, niet als tekst.** De regeleindes in
deze repo zijn niet uniform, en Python's tekstmodus normaliseert ze
stilletjes: lezen met `encoding='utf-8'` maakt van een CRLF een kale
newline en schrijft die zo terug, waarmee een wijziging van twee regels als
een herschrijving van het hele bestand in de diff belandt. Dat is op 4
september precies een keer gebeurd, in `(tabs)/friends.tsx` en
`(tabs)/index.tsx`, en het kostte meer tijd om terug te draaien dan om te
voorkomen. Lees en schrijf met `'rb'` / `'wb'` zodra je een bestaand
bestand aanpast.

En de reden dat juist die twee gevoelig zijn: ze dragen sinds de
`DEV_SCENARIO_ROWS_VISIBLE`-wijziging **kapotte regeleindes** — een dubbele
CR op de `tokens'`-import en een kale newline op de `devFlags`-import erna.
Dat is onschadelijk (elke parser leest er overheen) maar het maakt elke
normalisatie zichtbaar als een herschrijving van 693 regels. Wie ze ooit
opruimt, doe het in een eigen commit die verder niets aanraakt.

---

## Wat er nu open ligt

Geen enkele beslissing van de eigenaar blokkeert nog werk. Op volgorde:

1. **De app op een toestel doorlopen.** Eén echte import door de flow, plus
   de throttle-test (21 binnen tien minuten; de 21e hoort `import_throttled`
   te krijgen). Dubbel waardevol: het test de deploy én het renderpad van de
   nieuwe architectuur, die sinds SDK 55 verplicht aanstaat en die geen
   enkele test raakt.
   **Dit is nu punt één met stip**, want de vijf wijzigingen van de middag
   zijn precies het soort dat geen enkele test kan zien: een trilling, een
   groene haarlijn, een balk die verschijnt, een blok dat niet meer
   flikkert. Vier checks groen betekent hier alleen dat niets kapot is.
   Wat er te *voelen* valt, valt alleen op een toestel te controleren.
2. ~~**De goedkope haptics** (GAP-20)~~, ~~**de twee echte defecten**
   (GAP-22, GAP-23)~~ — gedaan, zie hierboven. Nog niet gecommit.
3. **Het icoonfont** (GAP-19). Ongeveer een dag, geen nieuwe dependency, en
   het deblokkeert twintig voorstellen tegelijk. **Dit is nu het grootste
   openstaande stuk van het stylingplan**: alles wat er nog in staat en om
   een glyph vraagt — het vinkje in de import-checkpoints, de `cooking-pot`
   op de lege bibliotheek, de 21 markeringen, `×`/`+`/`▶`/`❚❚` — wacht
   hierop en op niets anders.
4. **Eigen SMTP**, waarna de zes-cijfer-route werkt en er testgebruikers
   kunnen bestaan.
5. **IMP-05** — één secret, geen code: `GEMINI_MODEL` op een gedateerde
   snapshot pinnen.
6. **GAP-02 / open vraag A** — mag een webpagina een canonieke receptrij
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
