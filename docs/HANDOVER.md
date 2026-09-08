# Handover

Waar dit project op dit moment staat, geschreven voor een verse sessie die
niets van de voorgaande gesprekken gelezen heeft.

**Stand:** 8 september 2026, branch `feat/live-import-and-plan-phases`, t/m
`16d9e1c` gecommit. **De werkboom is schoon** — `git status --short` geeft nul
regels. Vier checks groen, nagemeten en niet overgeschreven uit de vorige
stand: typecheck 0, lint 0, `check:functions` 0, **3249 tests over 135
bestanden**.

⚠ **Vier commits staan nog niet op `origin`.** Gemeten met `git rev-list
--left-right --count origin/feat/live-import-and-plan-phases...HEAD`, dat
`0	4` teruggeeft. `origin` staat op `13db125`; wat daarna kwam — `775cb59`,
`7bac986`, `7718b9f`, `16d9e1c` — leeft alleen hier. Op 7 september is er wél
gepusht (zestien commits, `8f49b3b..13db125`), dus dit is een verse
achterstand en niet de oude.

**EN HIER STOND EEN BEWERING DIE ONWAAR BLEEK, IN DE MEEST LEERZAME RICHTING.**
Dit document zei dagenlang, in hoofdletters: "niets van dit alles staat op
`origin`, en de eigenaar denkt van wel". De meting klopte — er stonden elf
commits lokaal — maar de CONCLUSIE over wat hij dacht was fout. Hij had gezegd
"Ik heb het gepusht", en hij bedoelde `npx supabase db push`: de migratie, niet
git. Dat was precies punt 1 van het lijstje dat hem was voorgelegd. Hij had
gedaan wat er gevraagd was, en dit document heeft hem twee keer verteld dat
zijn push niet was aangekomen.

De les is niet "meet je remote" — dat stond er al. **De les is dat "pushen" in
dit project twee dingen betekent, en dat een assistent die er één van aanneemt
een correcte meting aan een verkeerde vraag hangt.** Vraag welke, of meet ze
allebei: `git rev-list --left-right --count origin/<branch>...HEAD` voor de
ene, `npx supabase migration list` voor de andere.

**De database is bij: `0001` t/m `0018` draaien, local én remote.** Nagemeten
op 8 september; er staat niets klaar dat nog toegepast moet worden. `0018`
(ingrediëntsecties) is door de eigenaar zelf gedraaid.

⚠ **ÉÉN DING IS HALF GEBOUWD EN DAT IS HET EERSTE WAT JE MOET WETEN.** De
eigenaar vroeg om een cijfervraag die pas twaalf uur na het koken verschijnt.
Het DOMEIN staat compleet in `src/domain/cookRating.ts` met 16 tests —
`RATING_DELAY_HOURS`, `isRatingDue`, `selectPendingRating`, `averageCookRating`.
**De UI bestaat niet.** Nagemeten: `grep -rn "selectPendingRating\|isRatingDue"
src/ --include=*.tsx` geeft nul treffers. `OutcomeCard` vraagt het cijfer dus
nog steeds direct na het koken, precies wat hij weg wilde. Zie punt 1 onder
*Wat er nu open ligt* voor wat er nog moet gebeuren en welke beslissing hij al
genomen heeft.

⚠ **Er ging één commit aan vooraf die niets doet en die je moet kennen
voordat je `git log` leest**: `84e0125` normaliseert de regeleindes van
`(tabs)/index.tsx` en verder niets. Dat bestand was het enige in de repo
waarvan de blob CRLF droeg, en met `core.autocrlf=true` normaliseert de
clean-filter hem bij het eerstvolgende stagen — 783 regels ruis om 50 regels
inhoud te dragen. Deze commit betaalt dat één keer, apart, zodat de diff van
GAP-35/36 leesbaar is. De inhoud is byte voor byte gelijk aan zijn voorganger:
784 bytes eraf, precies de 784 CR-karakters.

Twee waarschuwingen die hier dagenlang stonden zijn opgelost. **`.gitignore`
kent nu een `.claude/`-regel** (`e5532fc`), en **de drie agent-worktrees zijn
op 7 september verwijderd**: `.claude` ging van 1,4 GB naar 4 KB. Vóór het
verwijderen is per worktree nagegaan of zijn toegevoegde regels in main staan
— 101 van 101, 196 van 196, 246 van 246, overal volledig — en de twee
schijnbare uitzonderingen bleken opmaak en een hernoemd bestand
(`_trendingSource.ts` leeft als `src/lib/trendingSource.ts`). De drie
`worktree-agent-*`-branches zijn ook weg; alle drie waren voorouders van HEAD.
⚠ Op Windows weigeren zulke mappen met *"Filename too long"*: spiegel er een
lege map overheen met `robocopy <leeg> <doel> /MIR`, dan gaat het wel.

En **`research/` is niet untracked**, wat hier eerder wél stond: drie van de
vier bestanden zijn gewoon gecommit, en `13-legal-tos.md` staat bewust in
`.gitignore` met de reden erbij.

De secties hieronder over 4 t/m 7 september staan er niet als logboek maar
omdat elke bevinding erin een *patroon* is dat zich herhaalt.

| Lees dit | Waarvoor |
|---|---|
| `LONGLIST.md` | De genummerde backlog. Elke code (IMP-, SRC-, ENT-, OPS-, GAP-…) is daar gedefinieerd, met status en reden. **Sinds 5 september gaat het bovenste deel alleen over openstaand werk**; alles wat af is staat onderaan onder *Afgerond*, verplaatst en niet verwijderd, omdat commit-messages en codecommentaar naar die codes bij naam verwijzen. |
| `OPEN-BESLISSINGEN.md` | Wat er nog open staat en waarom. Open vragen A t/m H, plus de beantwoorde met hun bewijs. |
| `STYLING-PLAN.md` | Iconen, beeld en animatie: wat het onderzoek besloot, wat daarvan geland is, en wat niet. Nieuw op 4 september. |
| `PRODUCT-DECISIONS.md` | PD-001 t/m **PD-023**. Vastgelegd; niet heropenen zonder aanleiding. PD-002 draagt sinds 5 september een omkeringsbanner, en **PD-015, PD-017 en PD-019 sinds 6 september** — alle vier blijven staan, want dit document draait beslissingen schriftelijk terug en verwijdert het argument nooit. Let op: dit document is Engels, in tegenstelling tot de rest van `docs/`. |
| `SESSIE-6-SEPTEMBER.md` | Wat er op 6 september gevraagd, gebouwd en gevonden is, inclusief het groeiplan voor de sociale laag en het antwoord op de embed-vraag. **Wegwerpdocument**: zodra dit handover-bestand het heeft opgenomen mag het weg — deze repo heeft zijn procesdocumenten op 3 september bewust opgeruimd. |
| `DESIGN.md`, `DESIGN-SOCIAL.md`, `ARCHITECTURE.md` | Staande documenten. Zie de waarschuwing onderaan over `DESIGN.md`. `ARCHITECTURE.md`'s sectie over de 16:00-push draagt sinds 5 september een banner: die specificatie is niet tegen deze database te bouwen. |

---

## Wat er draait

**De infrastructuur staat, en is nagemeten in plaats van aangenomen.**
Migraties `0001` t/m **`0018`** draaien tegen de live database — nagemeten op
7 september met `npx supabase migration list`, dat leest en niets wijzigt, en
dat voor alle achttien `local` en `remote` gelijk teruggeeft. Er staat niets
meer klaar dat nog gedraaid moet worden.

⚠ **EN DAAR HOORT `0018` BIJ, WAT DE VIERDE KEER IS DAT DIT MIS GING.**
`0018_ingredient_sections.sql` — de nullable `section` op `meal_ingredients`
en `recipe_ingredients` waar de ingrediëntenkopjes op leunen — stond in de
opdracht voor deze ronde nog als "nog niet gedraaid", met de instructie het
te controleren vóór er iets over beweerd werd. Dat is gedaan, en het
antwoord is `{"local":"0018","remote":"0018"}`: **hij draait.** De
subsecties op het receptscherm zijn dus vandaag op een toestel te testen en
niet geblokkeerd op een `db push`.

⚠ **DE MIGRATIESTAND IN DIT DOCUMENT IS NU VIER KEER ONWAAR GEBLEKEN, EN
ALTIJD DEZELFDE KANT OP: het beweerde dat migraties nog niet gedraaid waren
terwijl ze allang liepen.** Eerst `0011` en `0012` (2 september), toen `0014`
(7 september, het stond zelfs als eerste punt onder "wat er nu open ligt"),
toen `0015` en `0016`, en nu `0018`. `0015` en `0016` kwamen aan het licht
doordat de eigenaar `db push` draaide en de tool hem **alleen `0017`**
aanbood — de andere twee waren er al.

Dat is geen toeval maar een structurele fout in hoe dit bestand geschreven
wordt: "ik heb een migratiebestand toegevoegd" wordt hier opgeschreven als
"de migratie staat nog niet remote", en dat is een aanname vermomd als stand
van zaken. **Draai `npx supabase migration list` vóór je hier iets over de
database beweert.** Het kost één commando, het wijzigt niets, en het heeft
deze fout nu drie keer gevonden nadat het document hem drie keer maakte.

Daarmee vervalt ook de blokkade die hier stond: `0016` maakt de view
`namable_recipe_votes` waar de vriendenkant van Trending op leest, en `0017`
de kolom voor het gerechttype. Allebei toegepast, dus allebei te testen op een
toestel.

De drie secrets staan er (`IMPORT_FINGERPRINT_SALT`, `YOUTUBE_API_KEY`,
`GEMINI_API_KEY`). De edge functie is gedeployed, dus de throttlepoort en de
dichting van het anon-key-gat zijn werkelijk actief.

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
npm test                 3249 tests / 135 bestanden
```

⚠ Hier stond **3137 over 130**, en dat was de stand van vóór de twee rondes
van 7 september. De drie nieuwe testbestanden zijn
`tests/decisionFilterCopy.test.ts`, `tests/vanavondActionCopy.test.ts` en
`tests/ingredientSections.test.ts`; de rest van de aanwas zit in bestaande
bestanden. **Deze telling is gedraaid, niet opgehoogd** — dezelfde fout die
de bundleberekening onder punt 6 hieronder maakte, waar "achttien glyphs"
bleef staan terwijl er negen bij waren gekomen.

⚠ **`check:functions` groen betekent minder dan het lijkt**, en dat is op
7 september apart bewezen in plaats van aangenomen. De Deno-regel uit OPS-09
eist een expliciete `.ts` op elke relatieve *waarde*-import onder
`src/domain/import/**`, maar `tsc` kán een ontbrekende extensie structureel
niet zien: `allowImportingTsExtensions` maakt hem optioneel. De echte poort is
de ESLint-regel. Wie daar een bestand toevoegt, test die poort apart — met een
stdin-probe op een extensieloze import — in plaats van op een groene
`check:functions` te vertrouwen.

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
(GAP-19) echt de blokkade is en geen aanname. ⚠ **Die laatste conclusie is
op 7 september onderuitgegaan, en dit is het leerzaamste voorbeeld in dit
document.** De meting klopte tot op de glyph. De conclusie ging over
"Feather" waar hij over "de families die we al hebben" had moeten gaan, en
één van de veertien ongecontroleerde buren tekende alles. Een uitputtende
meting van de verkeerde bron leest als bewijs en is het niet — zie punt 6.

---

## Wat er op 6 en 7 september gebeurde

Elf agents over twee dagen. De vier grootste wijzigingen zijn alle vier door
de eigenaar gevraagd, en drie ervan draaien een vastgelegde beslissing om.

**Delen is de standaard geworden (PD-022).** `share_cooks_with_friends` stond
op `default false` en `DESIGN-SOCIAL.md` §5 verdedigde dat uitvoerig. De
default draait om, de weigering wordt een vinkje bij het koken. Wat de
omkering overleeft is één regel, en die is de moeite van het onthouden waard:
**geen enkele migratie zet delen namens iemand aan.** `0015` verandert een
kolomdefault en **nul rijen**; een bestaand huishouden dat de vraag nooit
beantwoordde blijft uit tot het gevraagd wordt, met het vakje voorgevinkt. Een
default mag een eigenaar omkeren, toestemming mag geen DDL-statement leveren.

**Het cijfer is ook een openbare stem geworden (PD-023).** En de reden dat
Ranglijst leeg was bleek een andere dan iedereen dacht: `rateRecipe` had
**nul aanroepers**. Geen beleid, een ontbrekende schrijver — en `DESIGN.md`
§10 zei het al letterlijk ("a repository seam, `rateRecipe`, with no screen
behind it") zonder dat iemand de conclusie trok. Eén ontbrekende aanroepplek
hield PD-014, PD-017 én PD-018 tegelijk inert.

**Kiezen en Mijn recepten zijn opnieuw ingedeeld.** Het REDEN-blok is weg;
er staan nu een foto, één tot drie hoofdingrediënten en de tijd. De
tijdblokjes zijn een klok met stappen van vijf minuten geworden, dezelfde
control op beide schermen. De bibliotheek ging van **452pt chrome naar 262pt**
— van 0,83 zichtbare tegelrijen naar 3,03 — omdat de chiprijen nu zijwaarts
scrollen in plaats van te wrappen. Dat was WS2's redline, jaren geleden
opgeschreven en nooit toegepast.

**Drie Expo Go-waarschuwingen zijn opgelost, en één ervan was geen
waarschuwing.** `warnOfExpoGoPushUsage` **gooit** op Android in plaats van te
waarschuwen, en met `expo-notifications` op moduleniveau geïmporteerd gebeurde
dat tijdens de evaluatie van `_layout.tsx` — **de app startte daar dus
vermoedelijk niet**, over een push-functie die dit product bewust niet heeft.
De import staat nu binnen de `try`. Vastgesteld uit de broncode plus de log
van de eigenaar; op een Android-toestel nog onbevestigd.

**En het patroon van deze twee dagen is scherper dan "documenten
verouderen".** Vijf keer bleek een *comment die een regel beargumenteert* te
argumenteren uit een premisse die nooit gecontroleerd was:

- `_devScenarios.tsx` noemde het `_`-voorvoegsel "load-bearing" tegen
  expo-router. Onwaar — `_ctx.js` sluit alleen `+api` en `+html` uit, en
  alleen `_layout` is bijzonder. **Drie andere headers argumenteerden uit
  diezelfde fout**, en negen bestanden stonden in de routemap op grond van een
  regel die niet bestaat.
- `urlParsing.ts:72` noemde zijn import-cyclus "deliberate" en onschadelijk.
  Het tweede klopte — nagemeten, elke top-level binding is een letterlijke
  waarde — maar onschadelijk is een eigenschap van waar de aanroepen toevallig
  staan, niet van de cyclus.
- `routeParams.ts` beriep zich op een conventie uit
  `src/app/onboarding/routeParams.ts`. Dat bestand is in `e73d73f` verwijderd;
  de zin wees nergens naar, en werd verderop nog eens herhaald.
- `decisionNotificationCopy.ts:24` zei dat `warnOfExpoGoPushUsage` alleen de
  remote-paden bewaakt. Letterlijk waar, en misleidend: het nodigt uit tot de
  conclusie dat deze app hem dus nooit raakt, terwijl de log hem elke start
  laat vuren.
- Vijf plekken beweerden dat de kring-copy ongewijzigd was overgezet. `b9b0f59`
  had twee strings herschreven — terecht, want WS3 haalde het woord *kring*
  uit alles wat een gebruiker leest. **Hier had de code gelijk en het document
  niet**, wat de omgekeerde richting is van de rest van deze lijst.

**De agentronde zelf leverde twee dingen op.** Alle drie de worktrees kwamen
binnen op `e73d73f`, honderd commits achter, zonder `docs/` en zonder
`node_modules`; alle drie merkten het, bewezen de ancestor-relatie en spoelden
zichzelf vooruit. Drie van de drie is geen toeval. En **een agent in een
worktree kan niet in de hoofdboom werken** — de harness pint hem vast op zijn
eigen map, dus "ga in main werken" is geen opdracht die een geïsoleerde agent
kan opvolgen; breng het werk zelf over of isoleer hem niet.

---

## De les die deze vier dagen opleverde

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

## Wat er op 7 september 's avonds gebeurde

De eigenaar keek voor de tweede keer op een toestel en kwam met zeven punten
terug. Vier agents hebben ze parallel gebouwd, met strikt gescheiden
bestandslijsten. **Alle vier staan inmiddels in een eigen commit**
(`a8d686a`, `1a49630`, `4dc32d4`, `fd8ece0`), elk apart groen geverifieerd.

**Twee van de vier corrigeerden de opdracht op een meting, en dat is de reden
dat zij het werk deden en niet de planner.**

**De badge (`libraryTileBadge.ts`, `RecipeTile.tsx`).** De eigenaar las het
vinkje rechtsboven als "dit wil ik ooit koken" terwijl het "al gekookt"
betekent — de omgekeerde betekenis, op de ene toestand waar fout zijn bepaalt
wat een huishouden vanavond eet. Het plan was de badge te splitsen in planning
plus een apart kookmerk. **Dat bleek onmogelijk en het bewijs staat in de
code**: `resolveRecipeSchedulingState` leest kookgebeurtenissen eerst, dus
`al_gekookt` sluit de andere drie uit en de vier toestanden zijn *al* precies
de vraag "heb ik dit gekookt". Een tweede merk zou op drie van de vier per
definitie afwezig zijn. Twee merken eerlijk maken vraagt een verbreding van
`RecipeSchedulingInfo` — een type dat 22 modules importeren, inclusief het
bibliotheekfilter, de sortering, de zoekindex en de vriendenfeed. Dat is een
domeinwijziging vermomd als badge-herontwerp. Uitkomst: `al_gekookt` wordt een
**koksmuts** (`chef-hat`), een keukenobject in plaats van een afvinkobject;
`deze_week` houdt de kalender; `ooit` blijft bewust het wóórd, want elk
icoonalternatief liegt (`bookmark` is waar voor alle vier, `calendar-blank` is
op 14pt niet van de kalender te onderscheiden, `clock` betekent op ditzelfde
scherm al iets anders).

**De filters (`LibrarySearchBar.tsx`, `libraryFilterCopy.ts`).** De eigenaar
vroeg `Wanneer?` weg én drie zinnen later om een geavanceerd filter "of je het
al gekookt hebt". **Dat is dezelfde as** — `al_gekookt` is één van de vier
waarden erin. Er is dus niets nieuws gebouwd; `Wanneer?` en `Welke gang?`
staan achter een `Geavanceerd`-opening met een teller erop, en een tweede
control voor dezelfde vraag is vermeden. Die zou hier niet eens een leeg
raster hebben gegeven maar de filters stilletjes verbreed, want
`filterRowsBySchedulingStates` OF't deze as. `Waar heb je zin in?` is in de
gewone balk gebleven — een keuze van de agent, met de reden opgeschreven.
Gemeten: 191pt dicht, 246pt open, tegen 194pt eerder.

**De Kiezen-kaart (`DecisionCard.tsx`, `(tabs)/index.tsx`).** De
hoofdingrediënten zijn weg omdat ze niet klopten — geen renderfout maar de
gok die `mainIngredients.ts` zelf aankondigt, en een plausibel ogende
onwaarheid is het duurst op het ene scherm dat één keer geloofd moet worden.
De kooktijd staat nu boven de foto met dezelfde klok als `TimeCapPicker`. En
er kwam een bug uit die niemand gevraagd had: `Ja`/`Iets anders` werd omhoog
gehouden door een **dubbel gerekende inset** — Kiezen telde `insets.bottom` op
bij zijn padding terwijl de tabbalk die al verrekent, zo'n 34pt lege
achtergrond, en dit was het enige van de vier tabschermen dat het deed.

⚠ **`src/domain/mainIngredients.ts` heeft nu nul productie-aanroepers.** De
module en zijn tests staan er bewust nog; weggooien is een aparte beslissing.

**De chip (`Chip.tsx`, `IconChip.tsx`).** Het glyph zit nu ín de pil. Dat was
een schuld die `IconChip` zelf had opgeschreven ("changing `Chip` is one
small, correct edit that belongs to whoever ships GAP-19"). `Chip` kreeg een
optionele `icon`-prop; de layout verandert alleen wanneer er echt een glyph
is, dus een chip zonder icoon houdt zijn breedte byte voor byte — daarom paste
dit in twee bestanden en bleven de zes aanroepplekken onaangeraakt. `IconChip`
is een doorgeefluik geworden en blijft bestaan om één reden: zijn `icon` is
verplicht waar die van `Chip` optioneel is, dus een rij die geïllustreerd
hoort te zijn kan zijn glyph niet stil verliezen in een refactor.

**Wat GEEN van de vier kon vaststellen: hoe het eruitziet.** Geen agent heeft
een toestel. Optische uitlijning van een glyph naast een woord, of een
koksmuts op 14pt als "al gekookt" leest, of 34pt genoeg is — dat zijn alle
drie toestelvragen. De koksmuts is de zwakste schakel en is als zodanig
gemarkeerd.

---

## Wat er op 7 september daarna nog gebeurde: twee ontwerprondes

De eigenaar keek voor de derde keer op een toestel en gaf twee reeksen
instructies. De eerste reeks staat in vijf commits (`55c3187` t/m
`5f0c762`), de tweede in vijf daarna (`d7f5e42` t/m `13db125`). ⚠ **Ronde B
stond hier dagenlang beschreven als "nog ongecommit in de werkboom"; dat is
sinds 7 september niet meer waar** — de opsomming per bestand hieronder is
bewaard omdat ze precies zegt wat er in die commits zit, niet omdat er nog
iets los staat.

### Ronde A — gecommit, `55c3187` t/m `5f0c762`

**Het palet is wit met twee groenen** (`55c3187`). De accent-groen en de
positive-groen worden niet meer uit elkaar gehouden op tint maar op
helderheid én chroma, en dat onderscheid is nu een assertie in
`tests/contrast.test.ts` in plaats van een afspraak in een document. Dat is
de belangrijke helft: een WCAG-contrastratio íís een helderheidsratio en
scoort twee kleuren van gelijke helderheid en wild verschillende tint als
1,00:1, dus een gewone contrastcheck op deze twee groenen kon per constructie
niets zien. De test rekent nu in OKLab.

**De bibliotheektegel-badge antwoordt op een andere vraag** (`378d7d0`,
LIB-10). Een cijfer als het gerecht gekookt én beoordeeld is, een koksmuts
als het gekookt is zonder cijfer, en diezelfde muts als neutrale stand.
⚠ **De kalender voor `deze_week` en het woord "Ooit" zijn daarmee van de
tegel af** — twee goede merken, bewust verloren, met de reden in
`libraryTileBadge.ts` en in `DESIGN.md` §2 bij het overruled blok. De
ordening (`sortMealsByScheduling`) en het `Wanneer?`-filter dragen die
informatie nog; het tegeloppervlak niet meer.

**De ingrediëntenlijst op het receptscherm heeft kopjes en geen icoontjes**
(`d62e947`). De subsecties ("Voor het beslag") worden **overgeschreven uit
het bronrecept en nooit afgeleid** — de goedkope variant, die een kopje
herkent aan een dubbele punt zonder hoeveelheid, is expliciet afgewezen omdat
"Zout: naar smaak" er dan een kopje wordt en alles eronder stil onder een
subrecept belandt dat niet bestaat. Migratie `0018` draagt dat, en die draait.

⚠ **`ingredientCategories.ts` en `ingredientCategoryIcons.ts` hebben nu nul
productie-aanroepers** (RCP-08/RCP-09, gisteren op verzoek van de eigenaar
gebouwd). Nagemeten: elke overgebleven verwijzing is een comment of een test.
Dat is de twééde module in twee dagen die dit overkomt —
`mainIngredients.ts` ging er onder GAP-35 aan vooraf. Beide modules blijven
staan; weggooien is de beslissing van de eigenaar en niet van een agent.

**45 iconen zijn opnieuw getekend, in kleur, onder `design/icons-v2/`**
(`d908a1b`) en **niet bedraad**. Nagemeten: 45 `.svg`-bestanden plus een
contactsheet en een palet-script; geen enkel bestand onder `src/` verwijst
ernaar. Ze wachten op het oordeel van de eigenaar, en dat oordeel is een
toestelvraag.

**`Waarmee?` heet `Ingrediënten`** op Mijn recepten (`5f0c762`). ⚠ Die
commit raakte **tien** bestanden, niet de twaalf die hier eerder gerapporteerd
is — nagemeten met `git show --stat`.

### Ronde B — gecommit, `d7f5e42` t/m `13db125`

Dertien gewijzigde bestanden en vier nieuwe. De nieuwe zijn
`src/components/decisionFilterCopy.ts`, `src/components/vanavondActionCopy.ts`
en hun twee tests.

**`DecisionFilterBar` is een uitklaplade geworden**, achter een knop die
`Filters` heet en niet `Geavanceerd`. Gemeten uit de stylesheets in plaats van
geschat: **73pt dicht**, tegen 235pt open voor een gewone bibliotheek en 462pt
in het slechtste geval. Voorheen was de balk altijd 235pt en in het slechtste
geval 462pt, dus de winst is 162pt respectievelijk 389pt — maar de eigenschap
die meer waard is dan beide getallen is dat de hoogte dicht **niet meer
afhangt van hoe groot de bibliotheek is**. Dat is dezelfde eigenschap die
LIB-06 een dag kostte voor Mijn recepten. Het woord `Filters` is dat van de
eigenaar en `Geavanceerd` is bewust niet overgenomen: die belooft iets *bóven*
de gewone controls, wat waar is voor een lade over twee van vier assen en
onwaar hier, waar de lade elke control bevat die de balk heeft.

Kiezen zegt nu `Ingrediënten` in plaats van `WAARMEE?`, en `HOEVEEL TIJD?`
staat er niet meer boven de klok. Die laatste constante blijft wél bestaan,
en dat is met opzet: hij benoemt de verborgen tijd-as in het gesproken label
van de dichte lade, en een schermlezergebruiker is de één die hem niet even
open kan klappen om te kijken.

⚠ **Kiezens tagchips tekenen nu dezelfde glyphs als de bibliotheek**
(`IconChip` + `iconForDishTag`). **Dat is niet gevraagd door de eigenaar.**
Het staat hier apart omdat het de enige wijziging van deze ronde is zonder
instructie erachter, en het is in één regel terug te draaien: `IconChip`
terugruilen voor `Chip`.

**`DecisionCard`: de `KIEZEN`-eyebrow is weg en `PHOTO_WIDTH` ging van 80
naar 200** — 2,5× de breedte, 6,25× het oppervlak. Die twee horen bij
elkaar: de eigenaar vroeg om een grotere thumbnail en noemde zelf de twee
teksten die ervoor moesten wijken. Zie `DESIGN.md` §1, dat nu een
omkeringsbanner draagt.

**`VanavondActionRow`: de knoppen staan naast elkaar en `Ja` heet
`Dit koken`.** De hernoeming overruled `ui-research/WS3` §3.10, dat `Ja`
"the whole thesis in two letters" noemt. Het argument dat wint is een
koppeling en geen voorkeur: WS3 schreef die zin over een scherm met een
`KIEZEN`-eyebrow erboven, en zonder vraag antwoordt `Ja` nergens op. De
meetbare helft staat in `VANAVOND_LABEL_LENGTH_TOLERANCE`: naast elkaar in
even brede vakken laat `Ja` (2 tekens) naast `Iets anders` (11) de primaire
knop grotendeels leeg.

**Vier bestanden zijn alleen meegegaan in die hernoeming** en dat is het
opschrijven waard, want ze staan in de diff en lijken anders op ruis:
`Button.tsx`, `haptics.ts`, `types.ts` en `tokens.ts` noemden `Ja` alle vier
bij naam in hun comments. `OutcomeCard.tsx` legt bovendien vast dat **de `Ja`
verderop in dát bestand blijft**: die beantwoordt "Heb je … gemaakt?" tegen
"Nog niet", een echte ja/nee-vraag die boven de knop gedrukt staat.

**`Button.tsx` kreeg er een echt argument bij.** Deze primitive is niet
flex-baar: de `Pressable` erin zet `width: '100%'`, wat in een kolom klopt en
in een rij stil niet — een rijkind zonder `flex` meet zich naar zijn eigen
inhoud, dus twee knoppen komen op twee verschillende breedtes uit.
`VanavondActionRow` wikkelt daarom elke knop in een eigen `flex: 1`-`View`.
Het afgewezen alternatief was een `style`- of `flex`-prop op de primitive:
één regel, en de verkeerde — 27 bestanden importeren dit component over 66
aanroepplekken, en een style-ontsnapping op iets dat zo breed gebruikt wordt
is hoe een designsysteem ophoudt er een te zijn.

**Drie kleine reparaties die niemand gevraagd had:**

- **`(tabs)/index.tsx` kreeg `onRequestClose`** op de enige `<Modal>` van zes
  die hem miste. Androids hardware-terugknop deed niets terwijl de
  uitkomstkaart openstond. De verzendsheet eronder heeft hem niet nodig: dat
  is een geneste `<Modal>`.
- **`cook/[mealId].tsx` kreeg een uitgang in de laadstaat.** ⚠ En dat is de
  ernstigste van de drie, om een reden die niet in de opdracht stond: **die
  branche kan nooit uit zichzelf eindigen.** `loadMealData` heeft geen
  timeout en `setLoadState('error')` draait alleen uit de `.catch`, dus een
  read die *hangt* in plaats van te verwerpen komt nooit in de foutstaat
  terecht — hij blijft in "Laden…" staan, in een `fullScreenModal`, die op
  iOS geen veegdismiss heeft. Het is `Terug` geworden en niet `Stoppen`:
  `Stoppen` is het woord voor een kooksessie die al loopt en belooft "Er
  wordt niets opgeslagen", een geruststelling die alleen betekenis heeft als
  er voortgang is die verloren kon gaan.
- **`friends/add.tsx` zet zijn terugknop in een vaste header.** Hij was het
  eerste kind van de `ScrollView`, dus de uitgang scrolde weg met de rest —
  op een scherm met drie lijsten die na elke accept of decline opnieuw
  gelezen en getekend worden. Elk ander gepusht scherm tekent zijn uitgang
  al in deze vorm; dit was het enige dat het niet deed.

---

## Wat er op 8 september gebeurde

Vijf dingen van de eigenaar, op een toestel, plus twee meldingen. Vier
commits: `775cb59`, `7bac986`, `7718b9f`, `16d9e1c`.

**De filters overlapten de receptnaam, en de oorzaak was de verdeling.** Zie
punt 3 hieronder; dit is de belangrijkste les van de dag en hij gaat over
agentafbakening, niet over CSS.

**De 45 tekeningen zijn aangesloten, en MaterialCommunityIcons is eruit.** De
eigenaar keurde ze goed en zag ze daarna niet werken — terecht, ze lagen als
losse SVG's onder `design/icons-v2/` omdat zijn eigen voorwaarde was ze eerst
te bekijken. `src/components/iconArtwork/` is nu de kopie in de app:
`drawings.ts` (211 elementen over 45 tekeningen, gegenereerd uit de bron),
`palette.ts` (22 kleuren) en `IconArtwork.tsx`. Geen nieuwe dependency —
`react-native-svg` stond er al — en geen buildstap.

De bundlewinst is de eigenlijke opbrengst: `iconFont.ts` had de prijs van
MaterialCommunityIcons zelf gemeten op **1277 KB `.ttf` plus 212 KB
glyphmap-JSON**, voor 28 glyphs van de 7448, en schreef erbij dat die ruil
gemaakt moest worden zodra de bundle pijn deed. `@expo/vector-icons` laadt per
familie, dus met de laatste aanroepplek weg stopt de familie met meeliften.
Nagemeten: nul verwijzingen in `src/` behalve proza. Feather (54,3 KB) blijft.

⚠ **Twee dingen om te weten vóór je een icoon aanraakt.** `Icon`'s `color`-prop
doet NIETS meer voor een naam met artwork, en dat is alle namen — een tekening
die ÍS een wortel kan geen `textMuted` aannemen en een wortel blijven. `Chip`
tintte zijn glyph mee met de geselecteerde staat; dat is weg, en overleefbaar
omdat `Chip`'s eigen header al betoogt dat die staat de vulling plus de rand
is. En donkere modus is een REGEL, geen tweede set tekeningen: de kleuren
heten bij rol, de vier neutralen flippen, de vijftien kleuren blijven
byte-identiek. ⚠ Dat donkere palet is afgeleid en door niemand bekeken.

**Vier bestanden omzeilen de naad** en importeren `Feather` rechtstreeks:
`friends/[feedItemId].tsx`, `CreatorAttribution.tsx`, `ImportCreatorCredit.tsx`
en `ImportSourceField.tsx`. Daarom kan `@expo/vector-icons` niet helemaal weg.

**Het gemiddelde cijfer staat op de tegel.** `RecipeSchedulingInfo.lastRating`
heet nu `averageRating` en komt uit `averageCookRating`. Geen `count > 1`-tak:
het gemiddelde van één cijfer is dat cijfer, dus één regel in plaats van twee
die uit elkaar kunnen lopen. Een overgeslagen cijfer telt niet als nul.
⚠ Bijwerking die bewust geaccepteerd is: `lastCookedOn` en het getal
beschrijven niet langer dezelfde avond.

**En een fout van mij die de eigenaar meldde:** "a props object containing a
'key' prop is being spread into JSX". `renderElement` zette `key` in het object
dat het in elk SVG-element spreidde. React leest `key` van het element af
vóórdat props bestaan, dus dat werkt én waarschuwt. Nu expliciet, en ná de
spread — een `{...common}` erachter zou hem terugzetten.

**Wat deze dag over agents leerde, los van de code:** de CEO die de ronde
verdeelde corrigeerde vier fouten in zijn eigen opdracht (regelaantallen,
regelnummers, een verschuiving van +202 die als +194 was doorgegeven — en dat
getal bestond helemaal niet, er stonden kale regelnummers). Een uitvoerder
weigerde een instructie over te schrijven die onwaar was (`alignItems:
'stretch'` garandeert géén gelijke knophoogtes). Een derde las de icoonlijst
uit `iconFont.ts` in plaats van uit de prozalijst in zijn opdracht, en vond er
45 waar de opdracht 41 zei. **Drie keer corrigeerde de bron de opdracht.** Dat
is precies waarom de briefings hier metingen meegeven én zeggen ze na te
meten.

---

## Wat er nu open ligt

Punt 1 is half gebouwd en heeft een beslissing die al genomen is; punt 2 kost
geen code maar één handeling. De rest is werk.

1. ⚠ **DE CIJFERVRAAG NA TWAALF UUR — HET DOMEIN STAAT, DE SHEET NIET.** Dit
   is het enige onaffe werk in de boom en het is met opzet zo achtergelaten:
   de helft die een test kan bewaken is af en geverifieerd, de helft die dat
   niet kan is niet begonnen.

   **Wat de eigenaar vroeg, letterlijk:** "Daarnaast wil ik dat je pas een
   cijfer kan geven de eerste keer dat je de app opent na 12 uur sinds het
   afronden van het recept. Anders heb je het waarschijnlijk nog helemaal
   niet gegeten."

   **Wat er af is:** `src/domain/cookRating.ts`, 16 tests.
   `RATING_DELAY_HOURS` (12), `isRatingDue(event, nowMs)`,
   `selectPendingRating(cookEvents, nowMs)` — de OUDSTE die toe is, zodat een
   achterstand op volgorde van gebeuren leegloopt — en `averageCookRating`,
   dat al wél bedraad is op de bibliotheektegel.

   **Wat er niet is:** elke aanroepplek. `grep -rn "selectPendingRating\|isRatingDue"
   src/ --include=*.tsx` geeft nul treffers. Concreet nog te doen:
   - het cijfer UIT `OutcomeCard` halen (daar staat het nu, direct na het
     koken — precies wat weg moest). ⚠ Alleen het CIJFER; de "Gemaakt!"-
     bevestiging en het deel-vinkje blijven waar ze zijn.
   - een sheet die bij het openen van de app verschijnt als
     `selectPendingRating` iets teruggeeft. **De eigenaar heeft die vorm al
     gekozen** uit drie opties: een sheet bij het openen, niet een kaart op
     Kiezen en niet alleen een badge op de tegel. Hij komt terug tot je
     antwoordt of hem wegstuurt.
   - de schrijfkant hergebruiken, niet opnieuw bedenken:
     `cook/[mealId].tsx:435`'s `handleRate` doet al de twee schrijfacties die
     hierbij horen (`setCookEventRating` privé + `castPublicVote` openbaar).

   **De meting die dit goedkoop maakte, zodat je hem niet opnieuw hoeft te
   doen:** `cook_events` heeft sinds `0001` een `created_at timestamptz`, en
   die rij wordt geschreven door `handleCooked(true)` — de "Gemaakt!"-
   bevestiging. Dat ís dus het afrondmoment dat zijn zin noemt. `cookedOn` is
   een `date` zonder tijd en had het nooit gekund. **Er is geen migratie
   nodig**; de kolom was er al en niemand las hem.

2. ⚠ **`supabase/seed/demo_social.sql` DRAAIEN — nog niet gebeurd.** De
   eigenaar meldde op 8 september dat Vrienden en Ranglijst leeg zijn. Dat is
   geen defect: `loadLiveFriends` keert vroeg terug zodra
   `collectAcceptedFriendIds` leeg is, en Ranglijst rangschikt
   `recipe_ratings`-rijen die niet bestaan. Er staat niets in de database.

   Eén regel invullen (zijn eigen handle, bovenin) en plakken in de
   SQL-editor. Het script weigert te draaien als het die handle niet vindt en
   somt op welke er wél zijn — een vriendschap zonder de andere helft levert
   een tab op die nog steeds leeg is, en dan lijkt het script stuk terwijl de
   invoer dat was. `demo_social_teardown.sql` haalt alles weer weg.

   **Waarom de keten langer is dan "voeg een vriend toe", want dat is de
   bevinding hier:** de view `shared_cooks` (0009) poort op VIER dingen
   tegelijk — een wederzijds geaccepteerde vriendschap,
   `households.share_cooks_with_friends`, een maaltijd die niet is uitgesloten,
   én een `recipe_id`. Mist er één, dan blijft de feed leeg zonder dat iets
   zegt waarom.

3. ~~**De vier pakketten van de toestelronde committen.**~~ **Gedaan op
   7 september**, en de voorspelling in dit blok klopte: de vier
   bestandslijsten raakten elkaar niet, dus het werden vier commits en geen
   één.

   **Wat het opleverde en wat de volgende ronde ervan mag overnemen:** elk
   pakket is apart groen gemeten in plaats van alleen samen, door de rest van
   de boom met `git stash push --keep-index` opzij te zetten en de vier checks
   op de gestagede inhoud alleen te draaien. Dat is hetzelfde onderscheid dat
   de worktrees van 5 september maakten — "mijn wijziging is groen" tegen "de
   boom is groen" — voor een fractie van de kosten, zolang de pakketten
   disjunct zijn.

   ⚠ **EN OP 8 SEPTEMBER BLEEK DAT ONVOLDOENDE, OP DE DUURSTE MANIER.** Twee
   pakketten van de ontwerpronde — de filterlade op Kiezen en de grotere foto
   — zijn zo geverifieerd, elk apart groen, bestandslijsten volledig
   disjunct. Toen liep de receptnaam over de filterlade heen zodra die
   openging. De hoogtebegroting loopt dwars door die scheiding: de
   foto-agent rekende met de lade DICHT (73pt) omdat dat het getal was dat hij
   kreeg, open is hij 235pt, en dan wil de kaart 453pt in een hero van 382.
   **Disjuncte bestanden zijn geen disjuncte layouts.** Wie de volgende ronde
   zo verdeelt, benoemt vooraf welke GEDEELDE GROOTHEDEN er zijn — een
   hoogtebudget, een scrollpositie, een z-volgorde — en geeft die aan één
   pakket. De reparatie zit in `DecisionCard.tsx` (`775cb59`): de foto is een
   plafond geworden in plaats van een vaste maat.

4. ~~**`npx supabase db push` draaien.**~~ **Gedaan door de eigenaar.**
   Nagemeten op 8 september: `0001` t/m `0018`, `local` en `remote` gelijk
   voor alle achttien. ⚠ Deze regel is in dit document VIER keer onwaar
   geweest, drie keer te pessimistisch (`0011`/`0012`, `0014`, `0015`/`0016`)
   en één keer te optimistisch omgekeerd — op 8 september stond hier dat
   `0018` nog local-only was, op een meting die 's middags klopte en 's avonds
   niet meer. Draai `npx supabase migration list` vóór je hier iets beweert;
   het leest en wijzigt niets.

5. **De app op een toestel doorlopen, en dit blijft punt één met stip** — nu
   met zeven verse dingen erbij die niemand heeft gezien. In volgorde van
   twijfel: de **koksmuts** op de tegel (leest die als "al gekookt" op
   14pt, of als "recept"?), de **200pt foto op Kiezen** en de **dichte
   filterlade** eromheen, de **glyphs in de chips** (een glyph vult zijn
   hele em-vak waar een letter alleen zijn kaphoogte vult, dus hij oogt snel
   zwaar — en de schijnbare afstand tot het woord ging van 24pt naar 8pt), de
   **twee zelfgetekende glyphs** (melkpak en peul, alleen als geometrie
   geverifieerd en nooit door react-native-svg gerenderd), of
   `react-native-svg` **in Expo Go** doet wat het SDK-manifest belooft, de
   **34pt** die `Ja`/`Iets anders` zakten, de **`Geavanceerd`-opening**, en de
   kooktijd met klok boven de foto.
   Alles wat op 4 t/m 7 september gebouwd is, is precies het soort dat geen
   enkele test kan zien. Vier checks groen betekent hier alleen dat niets
   kapot is.

   Wat het scherpst onbevestigd is, op volgorde:

   - **Android.** `warnOfExpoGoPushUsage` gooit daar in plaats van te
     waarschuwen, en dat gebeurde tot 7 september tijdens de evaluatie van
     `_layout.tsx`. De conclusie dat de app er niet startte is uit broncode
     afgeleid, niet op een toestel gezien. Dit is de goedkoopste meting met
     het grootste gevolg.
   - **Foto-import**, nooit end-to-end gedraaid: dat `expo-image-picker`
     `base64` en `mimeType` levert zoals aangenomen, en dat Gemini deze
     `inlineData`-vorm accepteert.
   - **De embed-probe** (`exp://<lan-ip>:8081/--/dev-embed-probe`). TikTok en
     YouTube staan voorgevuld; Instagram en Facebook moet de eigenaar zelf
     plakken, want Meta publiceert geen voorbeeldpost. "Document geladen"
     vuurt óók voor een foutpagina — dus tikken op play, kijken of het inline
     blijft, en op een makersnaam tikken om te zien of die naar de browser
     gaat in plaats van naar de TikTok-app.
   - **De drie kolommen in de bibliotheek.** WS2 wees ze destijds op meting
     af (een titel van vijf regels bedekt 85% van de foto); de eigenaar vroeg
     er expliciet om en de titel is nu op twee regels gekapt. Dit is de plek
     om te kijken of dat genoeg was.
   - **200% tekstgrootte op Kiezen.** De foto heeft een vaste maat in punten
     en schaalt dus niet mee; WS2 mat dat scherm vóór de foto al op 1011pt
     tegen een scherm van 852.

   Doe ook de throttle-test (21 imports binnen tien minuten; de 21e hoort
   `import_throttled` te krijgen).

6. **De filterbug is nog maar half weg, en Ronde B heeft hem goedkoper
   gemaakt in plaats van hem op te lossen** (GAP-33). De bibliotheek
   herberekent zijn chips tegen wat de andere filters overlaten; **Kiezen
   doet dat niet.** Kies daar twee chips die niet samen voorkomen en je
   krijgt nog steeds een leeg resultaat. Het is geen overname van één
   functie: de bibliotheek werkt met `LibrarySearchState`, Kiezen met
   `DecisionFilters`, en Kiezen berekent zijn chips bij het laden in plaats
   van per render — `(tabs)/index.tsx:283` houdt daarom nog een eigen kopie
   van `collectAvailableDishTags`. ⚠ Dit stond hier als `:273`; dat is de
   aanroep, niet de definitie.

   **Waarom dit bewust niet in Ronde B is meegenomen, terwijl het in dezelfde
   twee bestanden ligt:** de lade veranderde de vorm van het probleem. Het
   narrowen gebeurt nu binnen een geópende lade — exact de situatie waar de
   bibliotheek in zit — dus LIB-07's oplossing past er nu op, waar hij er
   vóór de lade niet op paste. **Ná de lade is deze fix beter geïnformeerd;
   ervóór was hij duurder.** Dat is de reden om hem te laten liggen, en niet
   dat er geen tijd was.

7. **Dislikes doen letterlijk niets, en dat is groter dan een filter.** Je
   typt `paddenstoelen` — het voorbeeld dat de app zelf voorstelt — en het
   sluit nooit iets uit, want dislikes worden vergeleken met
   `Meal.ingredientTags`, dat alleen uit de EU-14 allergenenlijst gevuld
   wordt. De kern eronder: **`MealIngredient.name` wordt door geen enkel
   filter in de hele app gelezen**, alleen voor weergave. Er is dus geen
   ingrediëntfilter; er is een allergenenfilter dat eruitziet als één.

8. **De iconen** (GAP-19) — ✅ **twee keer af, en de tweede keer verving de
   eerste.** Op 7 september kreeg de seam een tweede fontfamilie; op
   8 september kreeg hij 45 eigen gekleurde tekeningen en ging die familie er
   weer uit. Wat er nu nog ligt is één ding: de **21 empty-state markeringen**
   uit WS4 §5.3-5.5, waarvan er nul geleverd zijn. Die waren op het font
   geblokkeerd en zijn dat allang niet meer.

   ⚠ **ALLES HIERONDER BESCHRIJFT DE EERSTE OPLOSSING EN IS ALS VERANTWOORDING
   BEWAARD, NIET ALS BESCHRIJVING VAN VANDAAG.** Lees het voor het argument —
   het legt uit waarom `iconFont.ts` `{ family, name }` teruggeeft in plaats
   van een kale glyphnaam, en dat mechanisme staat er nog — maar niet voor de
   stand. Vandaag draait de app op `src/components/iconArtwork/`, tekent
   MaterialCommunityIcons niets meer, en is `Icon`'s `color`-prop inert voor
   elke naam met artwork. Zie *Wat er op 8 september gebeurde*.

   In de vorm waarin dit punt op 7 september werd opgeschreven: **gebouwd, en
   wat er nu nog
   ligt is een oordeel en geen werk.** De seam draagt twee families, alle
   zeventien mappings staan aan, en `isIconAvailable` is van vijftien van de
   drieëndertig naar drieëndertig van de drieëndertig gegaan. Vier checks
   groen (3137 tests toen; 3249 nu, zie *Wat er draait*). Wat hieronder stond als opdracht staat er nu als
   verantwoording; lees het door vóór je aan de mappings tornt.

   **Wat er veranderde, en waar.** `iconFont.ts` geeft geen kale glyphnaam
   meer terug maar `{ family, name }` — een discriminated union, zodat
   `Icon.tsx` elke naam in de `name`-prop van *zijn eigen* familie legt en de
   compiler hem daar tegen de echte glyphmap houdt. Een
   `Record<IconFamily, Component>` was het afgewezen alternatief: dan typeert
   elke glyphnaam als de unie van béide fonts, en `pot-mix` compileert als
   Feather-glyph om vervolgens als leeg vierkantje te tekenen. Verder is er
   niets aangeraakt: geen enkele aanroepplek weet welk font hij tekent, en
   dat is precies de migratie die WS4 §1 op "no call-site change beyond the
   import" begrootte.

   **De bundlekosten, gemeten in plaats van geschat:**

   | | `.ttf` | glyphmap JSON |
   |---|---|---|
   | Feather | 54,3 KB | 6,0 KB |
   | MaterialCommunityIcons | **1277,0 KB** | **212,4 KB** |

   Dat is 1,25 MB fontasset plus 212 KB JSON die bij het starten in de
   JS-bundle geparsed wordt, voor **28** glyphs van de 7448 — 0,38% van de
   glyphs voor 100% van het gewicht. ⚠ Hier stond "achttien" en "0,24%", en
   dat was al onwaar toen het geschreven werd: de ingrediëntcategorieën
   voegden er diezelfde dag negen toe en niemand hertelde. Een agent vond het
   op 7 september 's avonds en herrekende het in plaats van op te hogen. Zelfde
   fout als de migratiestand hierboven, in hetzelfde document, op dezelfde dag. **Dit is de enige echte prijs van deze
   route en hij is niet weggeschreven.** De goedkopere weg bestaat en is
   bewust níét genomen: `createIconSet` neemt een eigen glyphmap, dus die
   achttien codepoints kunnen tegen dezelfde `.ttf` die het pakket al
   meelevert, en dan valt de 212 KB weg. Het kost de compilercontrole
   hierboven — het enige dat elke naam in dat bestand gecontroleerd houdt in
   plaats van onthouden — en het spijkert codepoints vast die het pakket mag
   verplaatsen. Doe die ruil als de bundle pijn doet, niet eerder.

   ⚠ **Drie van de zeventien zijn een gok, en dat staat nu bij de regel zelf
   in `iconFont.ts`.** MaterialCommunityIcons heeft geen aardappel, geen
   salade en niets veganistisch — gegrepen, niet aangenomen. Dus:
   `aardappel → food-variant` is een afgedekte schaal en zegt "een gerecht",
   niet "een aardappel"; `salade → leaf` is het dichtstbijzijnde ware ding;
   en **het dieetpaar kruist**: Remy's `leaf` (vegetarisch) wordt getekend
   door het font zijn `sprout`, en Remy's `sprout` (veganistisch) door
   `leaf-circle`, omdat `leaf` al aan salade op was. Op het scherm leesbaar,
   in de tabel verwarrend — daarom staat de waarschuwing erbij in plaats van
   dat een volgende lezer het zelf moet ontdekken.

   **`timer` heeft eindelijk een eigen glyph**, en niet de klok. Het was het
   enige icoon waarvan de afwezigheid beargumenteerd was in plaats van
   toevallig ("een polshorloge is geen kookwekker"); dat argument overleeft
   de wijziging. Het is `timer-sand` geworden en niet MCI's eigen `timer`,
   want die laatste is een wijzerplaat en botst op 16pt met `clock`, dat
   elders al "hoeveel tijd heb ik" betekent.

   **En de seam heeft er diezelfde dag een tweede klant bij gekregen, op
   verzoek van de eigenaar (RCP-08):** een generiek icoon per
   *ingrediëntcategorie*, "in plaats van een icoon voor een appel hebben en
   een voor een banaan". Dat is de moeite van het opschrijven waard omdat het
   een staande weigering omdraait. `dishTagIcons.ts` verbood precies dit met
   drie argumenten — een open glyph-vocabulaire, een matcher tussen
   Nederlandse woorden en tekeningen, en "welk ingrediënt is het
   belangrijkste". Twee daarvan zijn eraf: een icoon per *categorie* is een
   gesloten twaalf, en `mainIngredients.ts` beantwoordt die derde vraag
   allang elders. De matcher blijft, en faalt eerlijk: een onbekend woord
   levert géén icoon in plaats van een verkeerd icoon. Hele woorden, nooit
   substrings — `boter` zit in `boterhamworst`, de les die
   `mainIngredients.ts` al betaald had.

   **Zuivel en peulvruchten waren niet te tekenen en zijn daarom zélf
   getekend (RCP-09), ook op verzoek van de eigenaar.** Dat er nergens melk,
   yoghurt, boter of een boon te vinden was, is deze keer over alle vijftien
   families gemeten in plaats van over één — de enige treffer op "butter" is
   `butterfly`. Anders dan bij `timer` vóór GAP-19 ging beter zoeken dat niet
   oplossen.

   **Een `.ttf` genereren is overwogen en afgewezen.** fontTools staat lokaal
   en WS4 §1 had die route al uitgetekend, dus het kon. Het is afgewezen op
   deze repo's eigen maatstaf: een `.ttf` is een binair blok dat niemand in
   een diff leest of met de hand corrigeert, met een generatiescript dat moet
   blijven werken en codepoints die stil kunnen verschuiven — en dan krijg je
   een VERKEERDE TEKENING zonder foutmelding. Een SVG-pad is tekst in de bron.
   **De prijs is één nieuwe dependency**, `react-native-svg`, gepind op
   15.15.4 omdat dat de versie in Expo SDK 57's `bundledNativeModules.json`
   is; in dat bestand staan is wat hem in Expo Go laat werken zonder
   development build. ⚠ Dat is uit het SDK-manifest gelezen, niet op een
   toestel gezien — eerste ding om te bevestigen.

   **De seam kreeg er een derde familie bij** (`remy`) voor één unielid, één
   constructor en één tak in `Icon.tsx`. Geen aanroepplek bewoog, voor de
   tweede keer in twee dagen; dat is het sterkste bewijs dat de vorm van
   gisteren klopte.

   **Beide vormen zijn gerasterd en bekeken vóór ze bleven staan**, en dat was
   geen formaliteit: de eerste melkverpakking las als een pot en is opnieuw
   getekend, en een kale puntgevel las als een huis. ⚠ Wat dat níét
   vaststelt: er is gerasterd met Pillow en niet met react-native-svg, en geen
   toestel heeft ze getekend. De geometrie is dus geverifieerd, de rendering
   niet. De erwten in de peul zijn zwak op 16 fysieke px en helder vanaf 24;
   het oppervlak rendert op 16 punten, wat 32 of 48 px is op een 2x/3x-scherm.

   **Wat er nog wel open ligt onder deze noemer:** de **21 empty-state
   markeringen** uit WS4 §5.3-5.5, waarvan er nul geleverd zijn. Die waren
   geblokkeerd op het font en zijn dat nu niet meer — het is gewoon werk. En
   de zeventien chips zijn **nooit op een toestel gezien**: elke chip ging in
   één commit van geen tekening naar een tekening, en de uitlijning van een
   16pt-glyph naast `typeScale.body` is afgestemd op een rij die nooit een
   glyph tekende.

   **Hieronder staat waarom dit item van vorm veranderde. De premisse
   eronder bleek te smal, en dat is de les die blijft.**

   WS4 §1 koos een gegenereerde Phosphor-subset, op één waarneming die klopt:
   *"Feather has zero kitchen glyphs — no pot, no bowl, no chef, no timer"*.
   Nagemeten en waar. **Maar Feather is één van de vijftien families die
   `@expo/vector-icons` al meelevert, en de andere veertien had niemand ooit
   gecontroleerd.** MaterialCommunityIcons heeft er **7448**, met `pot`,
   `pot-steam`, `pot-mix`, `bowl-mix`, `chef-hat`, `noodles`, `pasta`,
   `mushroom`, `silverware`, `stove` en `carrot` — precies de vier die WS4 bij
   naam mist, en meer.

   **De beslissende meting: 17 van 17 `DISH_TAGS` zijn er vandaag mee te
   tekenen**, zonder één nieuwe dependency, zonder een `.ttf` te genereren en
   zonder buildstap:

   ```
   pasta → pasta          soep → bowl-mix        stamppot → pot-mix
   rijst → rice           salade → leaf          kip → food-drumstick
   aardappel → food-variant  ovenschotel → toaster-oven  rundvlees → cow
   noedels → noodles      wok → pot-steam        varkensvlees → pig
   brood → bread-slice    curry → bowl           visgerecht → fish
   vegetarisch → sprout   veganistisch → leaf-circle
   ```

   **De conclusie van WS4 was juist voor de premisse die onderzocht was; de
   premisse was alleen te smal.** Dat is dezelfde vorm als de rest van dit
   document, één laag dieper: niet een document dat de code tegenspreekt,
   maar een onderzoek dat één bron uitputtend nakeek en veertien buren
   oversloeg.

   **Wat het werk wás**, en wat er die dag ook van gemaakt is: `Icon.tsx` en
   `iconFont.ts` meer dan één familie laten dragen, de zeventien mappings
   erin, en de bundlekosten meten — `@expo/vector-icons` laadt per familie,
   dus de vraag was of er één familie bij mag, niet of we van nul beginnen.
   De seam was hier precies voor gebouwd, en de belofte is uitbetaald:
   `iconFont.ts` zei zelf dat op de dag dat dit landt *"THIS FILE is the one
   that changes… Nothing else moves"*, en behalve `Icon.tsx` — de
   renderende helft van diezelfde seam — is er geen aanroepplek aangeraakt.

   Drie oppervlakken wachtten hierop. Twee zijn af: de zeventien chips
   tekenen nu, en de bibliotheekheader tekende al (die drie knoppen waren
   Feather en dus nooit geblokkeerd — dat stond hier verkeerd). Wat blijft is
   de derde: de 21 empty-state markeringen uit WS4, nog steeds nul geleverd.
   En sinds GAP-25 is het staande bezwaar tegen tabbalk-iconen weg: het
   icoonvak wordt toch al getekend, dus een echt icoon kost nul punten — met
   twee families is er nu ook iets om erin te zetten.

9. **`Bewaren` op de gedeelde receptpagina** (GAP-32). De Vrienden-tab is op
   echte data grotendeels inert: bewijskaarten krijgen geen `onPress`,
   `/friends/[feedItemId]` draait op fixtures — en op **elke** build, niet
   alleen in dev, want dat scherm heeft geen `__DEV__`-poort — en de enige
   handeling die een ontvanger heeft bestaat niet. Twee onafhankelijke
   analyses wezen dit als nummer één aan, en de eigenaar bedacht het los
   daarvan zelf als vervanger voor Strava's kudos. Het is volledig
   gespecificeerd in `DESIGN-SOCIAL.md` §3.3 en §4.3.

10. **`src/app/import/confirm.tsx` is 963 regels**, ver over het plafond van
   800, en was op 892 vóór iemand hem deze week aanraakte. Eruit halen wat
   eruit moet — `buildEditedRecipe`, `buildMealInput`, `persistImportedMeal`
   naar `src/domain/import/**` — is een schone, afgebakende klus.

11. **De mail naar Food Influencers United.** Het mandje vullen bij AH en
   Jumbo is gelicentieerd (`api.tobasket.com`, sinds oktober 2025), gratis
   te testen vóór betaling, en BSK-06 staat daarom open in plaats van dicht.
   De vraag die telt staat nergens publiek beantwoord: **krijgt een
   betalende integrator ook prijsdata?** Dat beslist of BSK-05
   (prijsvergelijking) legaal kan bestaan. Lange doorlooptijd, dus vroeg
   sturen.

12. **Eigen SMTP**, waarna de zes-cijfer-route werkt en er testgebruikers
    kunnen bestaan.

13. **IMP-05** — één secret, geen code: `GEMINI_MODEL` op een gedateerde
   snapshot pinnen. Sinds de foto-import is dit dringender: een
   multimodale aanroep kost een veelvoud van een tekstaanroep, en een
   verschoven alias faalt als `llm_request_failed`, onzichtbaar in alles
   wat je kunt tellen.

14. **GAP-02 / open vraag A** — mag een webpagina een canonieke receptrij
   hebben? Het duurst betaalde openstaande punt.

**Geblokkeerd op iets dat niet in code te betalen is:** ENT-01, de share
extension. Het EAS-project bestaat sinds 5 september (`extra.eas.projectId`
staat in `app.json`), dus die helft is rond. Wat blijft is dat een share
extension native code is — op iOS een aparte target, op Android een
`intent-filter` — en Expo Go is één vaste app die alle projecten draait,
dus die kan geen extensie van dít project registreren. Het vraagt
`eas.json`, `expo-dev-client`, een development build, en voor iOS een
betaald Apple Developer-account.

**Één kleine keuze die op de eigenaar wacht**, één regel om te overrulen:
`Vrienden · 2` past niet onder 390pt en verliest daar zijn teller met een
ellips (`Vrienden·2` zonder spaties past wel, maar PD-020 citeert de vorm
mét).

⚠ **Hier stonden er twéé. De tweede is beslist, en waarom hij hier stond is
het bewaren waard.** Het kopje boven de ingrediëntenchips heette `Waarmee?`,
en dit blok noemde dat een openstaande keuze op grond van een telling: acht
van de zeventien chips zijn geen ingrediënt. **Die telling is nog steeds waar
en heeft de beslissing niet gewonnen.** De eigenaar vroeg op 7 september eerst
om `Ingrediënten` op Mijn recepten (`5f0c762`), keek toen naar het andere
scherm en vroeg het daar ook — letterlijk: *"bij kiezen staat er nog wel
'waarmee' ipv Ingredienten."* Beide schermen zeggen het nu. De voorwaarde om
het terug te draaien staat vast en is op beide schermen dezelfde: als de acht
ooit de negen voorbijgroeien, liegt het kopje over de meerderheid van zijn
eigen rij. `tests/libraryFilterCopy.test.ts` bewaakt die verhouding tegen het
echte vocabulaire, zodat het geen kwestie van opmerken blijft.

**Beslist en niet heropenen zonder aanleiding:** GAP-08 (`dishTags` blijft
optioneel, om de symmetrie met `recipeId`), ENT-03 (klembord-detectie
geschrapt, botst met `paste.tsx`'s "nooit de invoer inspecteren").

**Ligt bij de eigenaar:** de mascotte. Zes van de zeven audits raden hem af
op vastgelegde gronden — WS4 verbiedt gezichten in illustratie, WS5 verbiedt
attract loops. Eén audit ontwierp hem voor de importwachttijd, de enige plek
waar geen van beide regels reikt. `STYLING-PLAN.md` heeft beide kanten, plus
de naamkwestie rond `remyapp.io` die WS1 opwerpt.

---

## Schulden die nergens anders staan

**`DESIGN.md` is ouder dan het onderzoek dat hem tegenspreekt** (GAP-13), **en
sinds 7 september 's avonds ook ouder dan de code — maar §1 is nu wel
bijgewerkt.** Bijgewerkt op de manier die deze repo eist: elke verloren zin
staat er nog, doorgestreept en met de reden van zijn verlies erbij, in plaats
van gewist. §1 draagt daarom nu een omkeringsbanner en §2 ook, bij de
badge-mapping die Ronde A verving.

⚠ **DE ANKERS DIE HIER STONDEN WAREN 202 REGELS VERSCHOVEN, EN DAT IS
NAGEMETEN IN PLAATS VAN GESCHAT.** Er stond `:181`, `:206` en `:209-221`.
Dat klopte tegen `b03fa30`, toen `DESIGN.md` 924 regels telde; `55c3187`
voegde de kleursectie in bóven §1 en maakte er 1149 van — precies 202 regels
hóger, op alle drie de ankers gelijk. Ze werden dus `:383`, `:408` en
`:411-428`, en met de herschrijving van §1 zijn ze opnieuw verschoven.
**Citeer dit bestand daarom voortaan op zijn kopregels en niet op zijn
regelnummers** — een anker in een document dat van boven groeit is een anker
dat stil verschuift, en dit document heeft daar nu een gemeten voorbeeld van.

De vier plekken die het betrof, voor wie de geschiedenis wil volgen: de
meta-rij die `"25 min" · "voor 4"` in mono toonde met "**no icons**" (er
staat nu één feit met een klok ervoor); "the action row never moves", wat in
de code al verzacht was naar "beweegt niet bij een wissel" en deze ronde
alsnog onwaar werd doordat de rij van gestapeld naar naast elkaar ging; de
ASCII van de oude volgorde; en de **twee dingen die er helemaal niet in
stonden** — de foto op de kaart en de filterbalk uit PD-009. Die laatste twee
waren het duurst: niemand kon ze tegenspreken, want niemand had ze
opgeschreven.

⚠ **`ui-research/WS5-motion-feedback-cook-mode.md:307-308` citeert de
"never moves"-zin nog bij naam en redeneert eruit.** Dat bestand is
gedateerd onderzoeksarchief en wordt niet bewerkt; de omkeringsbanner in
§1 noemt dit citaat expliciet, zodat wie vanaf WS5 terugleest merkt dat hij
over een scherm redeneert dat niet meer bestaat.


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

**Het oude palet leeft nog in het onderzoeksarchief en in één echt
configuratiebestand, en dat tweede telt.** `app.json:25` zet de
Android-accentkleur van expo-notifications op een hardgecodeerde `#ffffff`,
nooit afgeleid van het palet en dus ook niet meegegaan met `55c3187` — dat is
de kleur achter de notificatie die het hele product moet aankondigen. En
`docs/ui-research/WS1-direction-and-palette.md:600-676` draagt het volledige
oude palet, terwijl `:1221-1264` **app-icoon én splash specificeert in het
oude blauw**: `#1D4094` als vouw en accent op een `#DDD9D0`-grond, met een
varianten-tabel voor licht, donker en tinted, en een splash die diezelfde
grond herhaalt. Die specificatie is nu achterhaald, tot en met de
`focusRing`. ⚠ `ui-research/` is gedateerd onderzoeksarchief en wordt
**niet bewerkt**; dit staat hier omdat het de enige plek is waar een lezer
erover struikelt vóór hij een icoon laat maken.

**Twee contrastcijfers in de bron komen uit een palet van vóór alles.**
`OutcomeCard.tsx:544-545` verdedigt `textSecondary` boven `textMuted` met
"3,60:1 (light) / 4,26:1 (dark) tegen `surfaceRaised`, beide onder 4,5:1".
`git log -S` legt die regel in `52b45d0` van **23 augustus 2026**, het
MVP-palet — dus de cijfers gaan over kleuren die daarna vervangen zijn.
**De beslissing houdt** en `tests/contrast.test.ts` bewijst dat elke ronde
opnieuw; het zijn alleen de getallen die niets meer meten. Zelfde vorm als
`tokens.ts:264-265`, waar dit al met een banner is opgelost. Wie erlangs komt
haalt de cijfers weg of hertelt ze; niemand moet ze citeren.

**Er is geen pijlglyph in dit project, en dat is de kern van de
terugknop-klacht.** Nagemeten: van de dertien niet-tab-schermen hebben er
twáálf een uitgang, dus de klacht van de eigenaar ging vrijwel zeker over
**vindbaarheid** en niet over aanwezigheid. Elke deur is 14pt
`bodySmall`-tekst in `textMuted` zonder pijl, met **vier verschillende
woorden** — `Terug`, `Annuleren`, `Sluiten`, `Stoppen`. Een pijl toevoegen
kan niet goedkoop: `ICON_NAMES` kent `chevron-right` en `close` en géén
`chevron-left` of `arrow-left`, en er een toevoegen raakt de uitputtende
`Record<IconFamily, …>` in `iconFont.ts` plus `remyGlyphs.ts` en
`tests/iconFont.test.ts`. Dat is een eigen ronde. Één gedeeld
terug-component of één woord is het dúúrdere alternatief en niet het
goedkopere: het raakt acht routebestanden en drie copy-modules, en het
overruled twee vastgelegde onderscheiden (`Annuleren` op een editor is niet
`Terug` op een leesscherm).

⚠ **Het dertiende scherm is `claim-handle.tsx`, en dat heeft helemaal geen
uitgang.** Nagemeten met `grep -c "router\."`: **nul** treffers in het hele
bestand — geen `router.back()`, geen `router.replace()`, geen `Annuleren`.
Zijn enige control is `Klaar`, die opslaat. Dit stond in geen enkel
overzicht, en het is de enige echte doodlopende route in de app.

⚠ **En er is een veertiende scherm dat nergens geteld werd:**
`src/app/dev-embed-probe.tsx`, 296 regels, dev-only. Het heeft dezelfde
scroll-fout die `friends/add.tsx` deze ronde kwijtraakte, én een
`router.replace('/')` op `:229` waar `router.back()` hoort — dat wist de
navigatiestack in plaats van één stap terug te gaan.

**`thumbZoneMinHeight` wordt nergens gelezen.** Alleen gedeclareerd
(`tokens.ts:621`) en gezet op 96 (`:641`); `grep` vindt geen enkele lezer.
Ronde B heeft dat in het token zelf opgeschreven in plaats van het weg te
halen — 96 is een gemeten ondergrens die het waard is te hebben op de dag dat
een scherm hem wél wil afdwingen, maar de zin die eronder stond ("de Kiezen
`Ja` / `Iets anders` / `Niet koken` rij moet erbinnen passen") beschreef een
beperking die niets controleerde, over een rij die niet meer bestaat.

**WS2, WS3 en het grootste deel van WS6 zijn nooit tegen de code gehouden**
(GAP-18). De styling-audit raakte ze alleen waar ze iconen, beeld en motion
kruisten. Gegeven dat 26 van 26 kleuren en 0 van 21 markeringen gemist
bleken, is de kans klein dat layout, copy en de sociale laag wél volledig
geland zijn. Dat is dezelfde controle als deze week: lezen wat besloten is,
en het tegen de code houden.
