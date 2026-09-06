# Handover

Waar dit project op dit moment staat, geschreven voor een verse sessie die
niets van de voorgaande gesprekken gelezen heeft.

**Stand:** 6 september 2026, branch `feat/live-import-and-plan-phases`, t/m
`268d0a6`, gepusht en in sync met `origin`. Werkboom schoon op één untracked
`verify-gate.ps1` na, die niet van deze sessies is.

Vijftien commits sinds `6158bc3`, allemaal van 4 en 5 september. De twee
secties hieronder over die dagen zijn de kern van dit document: ze staan er
niet als logboek maar omdat elke bevinding erin een *patroon* is dat zich
herhaalt.

| Lees dit | Waarvoor |
|---|---|
| `LONGLIST.md` | De genummerde backlog. Elke code (IMP-, SRC-, ENT-, OPS-, GAP-…) is daar gedefinieerd, met status en reden. **Sinds 5 september gaat het bovenste deel alleen over openstaand werk**; alles wat af is staat onderaan onder *Afgerond*, verplaatst en niet verwijderd, omdat commit-messages en codecommentaar naar die codes bij naam verwijzen. |
| `OPEN-BESLISSINGEN.md` | Wat er nog open staat en waarom. Open vragen A t/m H, plus de beantwoorde met hun bewijs. |
| `STYLING-PLAN.md` | Iconen, beeld en animatie: wat het onderzoek besloot, wat daarvan geland is, en wat niet. Nieuw op 4 september. |
| `PRODUCT-DECISIONS.md` | PD-001 t/m PD-021. Vastgelegd; niet heropenen zonder aanleiding. PD-002 draagt sinds 5 september een omkeringsbanner — hij blijft staan omdat PD-008 hem als precedent aanhaalt. Let op: dit document is Engels, in tegenstelling tot de rest van `docs/`. |
| `DESIGN.md`, `DESIGN-SOCIAL.md`, `ARCHITECTURE.md` | Staande documenten. Zie de waarschuwing onderaan over `DESIGN.md`. `ARCHITECTURE.md`'s sectie over de 16:00-push draagt sinds 5 september een banner: die specificatie is niet tegen deze database te bouwen. |

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
npm test                 2698 tests / 111 bestanden
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

## Wat er op 5 september gebeurde

De eigenaar keek voor het eerst op een toestel en kwam met tien punten
terug. Zes daarvan zijn gebouwd; de rest is geblokkeerd op iets dat niet
in code te betalen is. Wat dit een leerzame dag maakt is dat **vier van de
zes defecten die hij noemde niet in de code zaten maar in een document dat
niemand tegen de code had gehouden** — hetzelfde patroon als 3 en 4
september, voor de derde dag op rij.

**De rating-slider had twee losse bugs, allebei door hem gevonden.**
Vasthouden in het midden sprong naar links, want `locationX` wordt gemeten
tegen het element dat je aanraakt, en er liggen er drie onder dat gebaar:
de duim van 28pt, de gevulde balk en het gevoelige gebied. Raak je de duim
— die middenin staat tot je iets kiest — dan is `locationX` 0–28, gedeeld
door een balk van ~317. Nu `gestureState.x0` in vensterco̱ördinaten, min
één gemeten linkerrand. En loslaten legde meteen een cijfer vast; nu
verschuift de vinger alleen een concept en legt `Klaar` het vast. De
header van dat bestand beweerde het tegenovergestelde en is meegegaan.

**Dubbele import was een onwaarheid in de documentatie**, geen vergeten
controle. `confirm.tsx:42` beweerde al maanden dat `sourceUrl` de
dedup-sleutel is, en gebruikte die zin zelfs om uit te leggen waarom
`recipeId` nooit opnieuw afgeleid mag worden. Er stond niets achter.

**De tabbalk tekende vier ⏷-driehoekjes.** Het commentaar erboven zei "No
tab icons", op grond van het feit dat dit bestand geen `tabBarIcon` zet.
Niet instellen is niet hetzelfde als niet hebben: expo-router geeft
`icon: options.tabBarIcon ?? (() => <MissingIcon/>)` door, en die `??`
garandeert dat de prop nooit undefined is. En het label "Mijn recepten"
was 93,6pt tegen een vak van 88,25pt bij `numberOfLines: 1` — het stond
dus op elke ondersteunde telefoon afgekapt.

**De 16:00-push bestond niet, en de specificatie ervoor was onbouwbaar.**
Alle onderdelen lagen klaar: `push_tokens` sinds 0001, `expo-notifications`
in package.json, `ARCHITECTURE.md` met de hele werking. En
`expo-notifications` werd in nul bestanden onder `src/` geïmporteerd.

Bij het bouwen bleek de specificatie zichzelf tegen te spreken:
`DecisionRequest` heeft leden, restricties, saves en beslissingen nodig, en
`mirror/types.ts` zegt dat die bewust nooit de telefoon verlaten —
`member_restrictions` in het bijzonder, want dat is Artikel 9-data "whose
blast radius is not worth widening for a feature that does not want it".
**De server zou dus de allergieën van een huishouden moeten krijgen om dat
huishouden te kunnen vertellen wat het eet.** Het is een lokale melding
geworden; ARCHITECTURE.md heeft een banner die dat uitlegt.

---

## De agentronde van 5 september, en wat die leerde

Drie agents parallel, elk met een strikt gescheiden bestandslijst. Dat is
de voorwaarde, niet een nettigheid: save-intent en het overzichtsscherm
botsten allebei op `recipes.tsx` en konden daarom níét mee.

**Wat goed werkte:** elk van de drie verifieerde zichzelf in een eigen
`git worktree` met alleen de eigen bestanden erin, omdat de gedeelde boom
halverwege niet typechecked door het werk van een ander. Dat is het
verschil tussen "mijn wijziging is groen" en "de boom is groen", en zonder
die scheiding is het eerste niet vast te stellen.

**Wat je moet weten voor de volgende ronde:** de foto-agent ging buiten
zijn bestandslijst — tien bestanden, elk compiler-gedwongen omdat
`ImportPlatform` en `RecipeProvenance` in exhaustieve `Record<>`-maps
gelezen worden. Dat was niet ongehoorzaamheid maar een fout in mijn
opdracht: wie een lid aan die twee unions toevoegt, raakt onvermijdelijk
elke map die erover gaat. Reken dat vooraf uit bij het afbakenen.

**Drie dingen die de agents vonden en die niemand gevraagd had:**
`Chip.tsx` had twee verwijzingen naar het verwijderde `DeclineReasonRow`,
niet één. `LibrarySearchBar` had vijf ALL-CAPS eyebrows in de bron, niet
de drie die STYLING-PLAN noteert. En Feather heeft 287 glyphs, niet de 286
die WS4 telde — met nul keukenglyphs, wat bevestigt dat het icoonfont
(GAP-19) echt de blokkade is en geen aanname.

---

## De les die deze drie dagen opleverde

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
- `confirm.tsx:42` noemde `sourceUrl` de dedup-sleutel en gebruikte die zin
  om een tweede regel te onderbouwen. Er stond niets achter (GAP-29).
- `(tabs)/_layout.tsx` zei "No tab icons" terwijl er vier ⏷'s getekend
  werden (GAP-25).
- `ARCHITECTURE.md` specificeert een 16:00-push die data veronderstelt die
  `mirror/types.ts` bewust nooit verstuurt. Twee documenten die elkaar
  tegenspreken, waarbij de code de privacykant volgde (GAP-30).
- `RatingScale`'s header beargumenteerde waarom vastleggen-bij-loslaten
  juist was. Het argument klopte; de uitvoering maakte de schaal
  onverkenbaar (GAP-28).
- WS4 telt 286 Feather-glyphs; het geïnstalleerde pakket heeft er 287.

**Het patroon is inmiddels scherper dan "documenten verouderen".** Vijf van
deze elf zijn comments die een regel *beargumenteren* die nooit gebouwd is.
Dat is gevaarlijker dan een verouderde zin, want de argumentatie leest als
bewijs dat iemand het gecontroleerd heeft. Wie een comment tegenkomt die
uitlegt waarom iets zo werkt: grep of het zo werkt.

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

**De Supabase-CLI staat lokaal, niet globaal.** `supabase db push` geeft
`CommandNotFoundException`; het is `npx supabase db push`. De CLI is een
devDependency (`supabase ^2.116.0`) met zijn binary in `node_modules/.bin/`,
en het project is al gekoppeld — `supabase/.temp/linked-project.json` staat
er. `npx supabase migration list` toont zonder iets te wijzigen welke
migraties lokaal en welke remote bestaan.

**Draai de Expo-server in je EIGEN terminal, niet als achtergrondtaak van
de assistent.** Op 5 september is hij drie keer door de geheugenbewaker
afgebroken: de machine had nog 1,9 GB van 15,8 GB vrij en Metro is dan de
laatste die erbij komt. Erger is wat er achterblijft — het onderliggende
`node`-proces overleeft de afbreking en blijft **poort 8081 vasthouden**,
waarna de volgende start naar 8083 wil uitwijken. En 8081 is precies de
poort die in Supabase's redirect-allowlist staat.

Er hingen er die dag drie tegelijk, waarvan één van twee dagen oud met 269
MB. Opruimen kan met:

```
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'expo[\/]bin[\/]cli' }
```

Kijk vóór het afsluiten naar de commandline: tussen de node-processen zitten
ook de MCP-servers van de assistent zelf, en die omzeep helpen breekt de
sessie.

---

## Wat er nu open ligt

Op volgorde, en de eerste twee zijn van een andere soort dan de rest: die
kosten geen code maar een handeling van de eigenaar.

1. **`npx supabase db push` draaien.** Migratie `0014_photo_import.sql`
   staat gecommit en is nog niet toegepast. Zonder die migratie faalt het
   opslaan van een gefotografeerd recept op de CHECK-constraint die
   `'photo'` moet toelaten. Eén commando, zie Conventies voor waarom er
   `npx` voor moet.

2. **De app op een toestel doorlopen, en dit blijft punt één met stip.**
   Alles wat op 4 en 5 september gebouwd is, is precies het soort dat geen
   enkele test kan zien: een trilling, een groene haarlijn, een balk die
   verschijnt, een blok dat niet meer flikkert, een melding om 16:00. Vier
   checks groen betekent hier alleen dat niets kapot is.

   Het scherpst is dat bij de **foto-import**: die is nooit end-to-end
   gedraaid. Onbevestigd blijven dat `expo-image-picker` op een echt
   toestel `base64` en `mimeType` levert zoals aangenomen, dat Gemini deze
   `inlineData`-vorm accepteert, en dat drie segmenten op 320pt passen.
   De Nederlandse permissieteksten verschijnen sowieso nog niet — die
   vragen een native build, en er wordt in Expo Go getest.

   Doe ook de throttle-test (21 imports binnen tien minuten; de 21e hoort
   `import_throttled` te krijgen).

3. **Save-intent weghalen en het receptoverzichtsscherm.** De laatste twee
   punten van de tien die de eigenaar op 5 september gaf. Allebei
   uitgewerkt gepland en nergens op wachtend; ze konden alleen niet mee in
   de agentronde omdat ze allebei `recipes.tsx` raken en dat bestand toen
   al door een derde agent bewerkt werd.

   Let bij save-intent op wat de analyse vond: het verwijdert de "wanneer?"
   -vraag maar **niet** het weekplan — sinds LIB-04 maakt een lang indrukken
   op een bibliotheektegel al een `this_week`-save, dus `deze-week.tsx`
   houdt zijn bron. Wat je wél verliest is `'someday'` als bereikbare keuze,
   en de aanbeveling is die als default te schrijven zodat PD-004a's belofte
   overeind blijft. Dat verandert wél wat de engine voorstelt, en geen test
   ziet dat.

4. **Het icoonfont** (GAP-19). Ongeveer een dag, geen nieuwe dependency, en
   het is nu goedkoper dan het was: de seam staat er (`iconFont.ts`,
   `Icon.tsx`), dus als het font landt verandert er één bestand en gaan
   twintig voorstellen tegelijk open. Alles in `STYLING-PLAN.md` dat om een
   glyph vraagt wacht hierop en op niets anders. En sinds GAP-25 is het
   staande bezwaar tegen tabbalk-iconen weg: het icoonvak wordt toch al
   getekend, dus een echt icoon kost nul punten.

5. **Trending met gepubliceerde cijfers.** De eigenaar heeft besloten dat
   het privé-cijfer publiek wordt en dat PD-019 daarmee vervalt. Voordat
   daar een regel code voor geschreven wordt moeten de PD-wijzigingen er
   staan — deze codebase draait beslissingen schriftelijk terug, en PD-015,
   PD-017 en PD-019 breken alle drie.

   Twee dingen die de analyse vond en die zwaarder wegen dan het werk:
   `rateRecipe` heeft **nul aanroepers**, dus Trending is vandaag leeg om
   een andere reden dan iedereen dacht — er ontbreekt een schrijver, geen
   beleid. En een cijfer dat uit koken volgt omzeilt de drie poorten van
   `shared_cooks`: `recipe_ratings` is leesbaar voor élke ingelogde
   gebruiker, waar kookbewijs op wederzijdse vriendschap en twee
   opt-ins gepoort is.

6. **De mail naar Food Influencers United.** Het mandje vullen bij AH en
   Jumbo is gelicentieerd (`api.tobasket.com`, sinds oktober 2025), gratis
   te testen vóór betaling, en BSK-06 staat daarom open in plaats van dicht.
   De vraag die telt staat nergens publiek beantwoord: **krijgt een
   betalende integrator ook prijsdata?** Dat beslist of BSK-05
   (prijsvergelijking) legaal kan bestaan. Lange doorlooptijd, dus vroeg
   sturen.

7. **Eigen SMTP**, waarna de zes-cijfer-route werkt en er testgebruikers
   kunnen bestaan.

8. **IMP-05** — één secret, geen code: `GEMINI_MODEL` op een gedateerde
   snapshot pinnen. Sinds de foto-import is dit dringender: een
   multimodale aanroep kost een veelvoud van een tekstaanroep, en een
   verschoven alias faalt als `llm_request_failed`, onzichtbaar in alles
   wat je kunt tellen.

9. **GAP-02 / open vraag A** — mag een webpagina een canonieke receptrij
   hebben? Het duurst betaalde openstaande punt.

**Geblokkeerd op iets dat niet in code te betalen is:** ENT-01, de share
extension. Het EAS-project bestaat sinds 5 september (`extra.eas.projectId`
staat in `app.json`), dus die helft is rond. Wat blijft is dat een share
extension native code is — op iOS een aparte target, op Android een
`intent-filter` — en Expo Go is één vaste app die alle projecten draait,
dus die kan geen extensie van dít project registreren. Het vraagt
`eas.json`, `expo-dev-client`, een development build, en voor iOS een
betaald Apple Developer-account.

**Twee kleine keuzes die op de eigenaar wachten**, elk één regel om te
overrulen: `Vrienden · 2` past niet onder 390pt en verliest daar zijn
teller met een ellips (`Vrienden·2` zonder spaties past wel, maar PD-020
citeert de vorm mét). En het kopje boven de ingrediëntenchips is
`Waarmee?` gebleven in plaats van `Ingrediënten`, omdat acht van de
zeventien chips geen ingrediënt zijn.

**Beslist en niet heropenen zonder aanleiding:** GAP-08 (`dishTags` blijft
optioneel, om de symmetrie met `recipeId`), ENT-03 (klembord-detectie
geschrapt, botst met `paste.tsx`'s "nooit de invoer inspecteren").

**Ligt bij de eigenaar:** de mascotte. Zes van de zeven audits raden hem af
op vastgelegde gronden — WS4 verbiedt gezichten in illustratie, WS5 verbiedt
attract loops. Eén audit ontwierp hem voor de importwachttijd, de enige plek
waar geen van beide regels reikt. `STYLING-PLAN.md` heeft beide kanten, plus
de naamkwestie rond `remyapp.io` die WS1 opwerpt.

---

## Drie schulden die nergens anders staan

**`DESIGN.md` is ouder dan het onderzoek dat hem tegenspreekt** (GAP-13).
`ui-research/ASSEMBLY.md` zegt te noteren wat het onderzoek "factually
wrong" vond in de staande documenten. `DESIGN-SOCIAL.md` is bij de makeover
bijgewerkt; `DESIGN.md` (27 aug), `PRODUCT-DECISIONS.md` (27 aug) en
`ARCHITECTURE.md` (23 aug) niet. Die correcties leven alleen in
`ui-research/`, terwijl `DESIGN.md` uit tientallen bronbestanden als gezag
wordt aangehaald. **Wie erop gaat bouwen, leze eerst wat `ASSEMBLY.md` over
de staande documenten zegt.**

**De weigermeting is weg en er is geen vervanging.** `handleDecline` was de
enige plek in de app die `status: 'skipped'` schreef, en met `Niet koken`
is die verdwenen (PD-021). Een geweigerde avond staat nu voor altijd op
`'pending'`, niet te onderscheiden van een avond waarop niemand de app
opende. PD-001 noemt de acceptatiegraad uit plan §8 verplichte
instrumentatie; die kan nog lezen wat er aangeboden en aangenomen is, en
niet meer wat er geweigerd is. Bewust geaccepteerd, en `RespondToDecisionInput`
houdt expres nog de vorm waarin een weigering vastgelegd kan worden — als
de meting ooit nodig blijkt is het eerlijke instrument een
decision-viewed-event, geen knop die iemand moet indrukken om geteld te
worden.

**WS2, WS3 en het grootste deel van WS6 zijn nooit tegen de code gehouden**
(GAP-18). De styling-audit raakte ze alleen waar ze iconen, beeld en motion
kruisten. Gegeven dat 26 van 26 kleuren en 0 van 21 markeringen gemist
bleken, is de kans klein dat layout, copy en de sociale laag wél volledig
geland zijn. Dat is dezelfde controle als deze week: lezen wat besloten is,
en het tegen de code houden.
