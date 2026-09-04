# Stylingplan — iconen, beeld en animatie

Gemaakt op 4 september 2026 door zeven parallelle audits, één per
menusectie, elk met dezelfde opdracht: **lees eerst wat het onderzoek al
besloten heeft, en zeg per aanbeveling of het (a) besloten én toegepast is,
(b) besloten maar níét toegepast, of (c) werkelijk nieuw.**

Die driedeling is de reden dat dit document bestaat. Op 3 september bleek
dat WS1's palet — een kant-en-klaar codeblok — nooit was toegepast: 26 van
de 26 kleurtokens stonden nog op de oude waarden. GAP-18 legde vast dat
WS2 t/m WS6 nog nooit tegen de code waren gehouden. Dit is die controle.

---

## ⚠ Lees dit eerst: een deel is inmiddels gebouwd

**Dit document is een momentopname van de audit, en de code is er sinds de
middag van 4 september op vooruitgelopen.** De bevindingen per sectie
hieronder staan er onveranderd bij, want ze zijn het bewijs waarop de
volgorde rust — maar zes ervan zijn niet meer waar. Wie hierop gaat bouwen,
houde eerst deze tabel ernaast, en daarna alsnog de code: dat is dezelfde
les die dit document zelf opleverde.

| Bevinding | Nu | Waar |
|---|---|---|
| ~12 vastgelegde haptics ongebouwd | **Alle gebouwd**, plus vijf die de lijst niet noemde | GAP-20, `src/lib/haptics.ts` |
| Het einde van kookmodus is stil | **Alle drie de dingen staan er** | GAP-21, `OutcomeCard.tsx` |
| De vaste timerbalk ontbreekt | **Gebouwd**, inclusief de stille helft | GAP-22, `CookTimerBar.tsx` |
| Het importlaadblok flikkert | **Gerepareerd** met een uitgestelde start | GAP-23, `paste.tsx` |
| De voortgangslijn springt | **Vult zich**, `scaleX` op de native driver | GAP-24, `ProgressRule.tsx` |
| `typeScale.button` is monospace | **Van monospace af** | GAP-18, `tokens.ts` |

**Wat níét veranderd is, en de rest van dit document dus onverkort blokkeert:
er is nog steeds geen icoonfont.** Elke bevinding hieronder die om een glyph
vraagt — het vinkje in de checkpoints, de `cooking-pot`, de 21 markeringen,
de vervanging van `×`, `+`, `▶`, `❚❚` — wacht nog altijd op punt 4 van de
volgorde. Dat is nu het eerstvolgende werk.

---

## De hoofdbevinding

**Het meeste van wat "meer iconen, beeld en animatie" zou opleveren is al
ontworpen en ligt ongebruikt.** Niet als schets, maar als beslissing met
maatvoering, tokens en argumentatie erbij.

| Wat | Stand |
|---|---|
| Empty-state markeringen (WS4 §5.3-5.5) | **0 van 21** geleverd |
| `@expo/vector-icons` | 4 aanroepplekken in de hele app, allemaal `Feather`, in 5 van de 7 secties nul |
| ~~`expo-haptics`~~ | ~~geïnstalleerd, gebruikt in 3 bestanden; ~12 vastgelegde haptics ongebouwd~~ — **gedaan**, zie de tabel hierboven |
| Gedeelde componenten | `Icon`, `EmptyState`, `Thumbnail`, `Monogram`, `ListRow`, `Section`, `Sheet` — **geen enkele bestaat** |
| Letterlijke tekens die iconen vervangen | `×`, `+`, `▶`, `❚❚` op zeven plekken |

Dat betekent iets prettigs: het grootste deel van de polish die je zoekt is
geen ontwerpwerk meer, maar uitvoerwerk met een geschreven spec.

En iets ongemakkelijks: er is geen enkele reden om aan te nemen dat de rest
van WS2 t/m WS6 wél geland is. Deze audit dekt iconen, beeld en motion.
Layout (WS2), copy (WS3) en de sociale laag (WS6) zijn alleen aangeraakt
waar ze die drie kruisten.

---

## Vier blokkades, en de eerste ontgrendelt de rest

*Twee van de vier zijn inmiddels weg — nummer 2 en nummer 4. Ze staan er nog
omdat het argument eronder ergens moet blijven staan; de stand is de tabel
hierboven.*

**1. Er is geen icoonfont.** WS4 §1 koos een gegenereerde Phosphor-subset
via `createIconSet` — MIT, ~8-14 KB, **geen nieuwe dependency**, "no native
rebuild, no call-site change beyond the import", geschat op ongeveer een dag
werk. Dat font bestaat niet in de repo. Ongeveer twintig icoonvoorstellen in
dit document wachten er alle op. Dit is het enige item dat, als het landt, in
één klap de helft van deze lijst mogelijk maakt.

**2. Haptics zijn vastgelegd en niet bedraad.** WS5 §3.2 heeft een tabel van
vijftien gebeurtenissen. Drie zijn gebouwd. De rest zijn regels van één regel
code tegen een dependency die er al is. WS5 noemt de trilling bij het
beoordelen van een gerecht "the highest-value single change in this report
per line of code" — die is er niet.

**3. De gedeelde componenten ontbreken.** `EmptyState` alleen al heeft 21
aanroepplekken in WS4's inventaris. Zolang die niet bestaan is elke
empty-state een handgemaakte kopie, en drijft de vormgeving per scherm uit
elkaar.

**4. `typeScale.button` is monospace.** `tokens.ts:385` zet
`fontFamily.monoSemiBold` op elke knop in de app. WS6 noemt dit een gemeten
defect: "Stuur" en "Verstuurd" lezen als een terminalcommando. Eén
tokenwijziging, brede visuele nacontrole.

---

## Per sectie

### Kiezen — het 16:00-besluit

Het best bewaarde scherm van de app. De onthulling (600 ms,
`easingDecelerate`) noemt WS5 "the best motion in the app… should not be
touched", en dat klopt met de code.

- **(b)** Geen haptic op `Ja`. WS5: "the decision of the day".
- **(b)** Geen haptic op chipselectie, geen bij het vastzetten van een cijfer.
- **(b)** `OutcomeCard`'s sluitknop is een letterlijk `×`-teken.
- **(b)** `NoCandidateState` mist zijn 48pt-markering bij twee van de vier
  toestanden — de andere twee horen er expres géén te hebben ("it is a filter
  result, not a beginning").
- **(a)** Géén foto op de beslis-kaart, en dat blijft zo: dit scherm mag nooit
  op een doorbladerbare lijst lijken.
- **(a)** Géén icoon op de vier actieknoppen: "the moment one of four buttons
  carries a glyph, the others are ranked."

### Mijn recepten — de bibliotheek

- **(b)** De lege bibliotheek mist zijn `cooking-pot` op 64pt — WS4's "one
  `iconHero` in the product". Dit is het eerste scherm van een verse
  installatie, en de oplossing is gratis: geen illustratie, geen licentie.
- **(b)** `Al gekookt` mist een `check` van 12pt.
- **(b)** `+ Link plakken` heeft het plusteken in de tekst gebakken, in
  monospace, waardoor het als een terminalprompt leest.
- **(b)** Geen haptic bij het bevestigen van allergenen — "PD-006's verified
  stamp is earned here. A safety confirmation should be felt."
- **(c)** `RecipeTile` heeft geen indruk-animatie terwijl zijn tegenhanger in
  Vrienden die wel heeft.
- **(b)** De typografische tegel-fallback (getinte grond + titel over meerdere
  regels) wacht op `tileTint`-tokens en een `Thumbnail`-component.

### Importeren — plakken, wachten, bevestigen

Hier ligt de meeste winst per regel code, en één echte bug.

- **(b)** De checkpoint-cirkels vullen zich maar tonen nooit een vinkje. WS4
  noemt dit **"the highest-value absent icon in the product"**: een gevulde
  stip zegt *er is iets veranderd*, een vinkje zegt *die stap is gelukt* — en
  dat is wat een laatste, holle rij laat lezen als *wachtend* in plaats van
  *vastgelopen*.
- **(b)** Alle vier de checkpoint-animaties uit WS5 §5.3 ontbreken.
- **(b)** Twee haptics ontbreken: succes bij aankomst, fout bij mislukking —
  uitdrukkelijk **niet** bij `display_only`, want dat is geen fout.
- **⚠ Echte bug, gevonden door de audit.** Bij een cachetreffer keert de
  import binnen ~150 ms terug, maar `beginLoading` zet de laadfase synchroon.
  Het hele laadblok flitst dan korter dan een vijfde seconde in beeld. WS5
  heeft de regel al ("below `durationNormal`, show nothing at all") maar die
  is nooit op deze lijst toegepast. **Oplossing: uitgestelde start, geen
  minimale toondrempel** — een drempel verzint wachttijd bij een eerlijk snel
  antwoord, en dat is precies wat de copy van dit scherm weigert te doen.
- **(c)** Bij een `display_only`-import belooft de copy "de maker en het beeld
  blijven bewaard", maar het bevestigingsscherm toont die thumbnail niet. Hij
  is al opgehaald en wordt al meegedragen. Eén `Image`.

### Kookmodus — het volledige scherm

- **(b) Halve reparatie, en de zichtbare helft ontbreekt.** WS5 vroeg om een
  vaste balk die toont dat er een timer loopt op een andere stap, aantikbaar
  om terug te gaan — "the whole reason reading ahead becomes safe". De *state*
  is gehoist (timers overleven navigatie), de *balk* is er niet. Blader naar
  een stap zonder eigen tijd en je sudderklok is onzichtbaar.
- **(b)** Het einde is stil. WS5 noemt het moment waarop je een gerecht
  afvinkt "the emotional peak of the whole product" en schrijft drie dingen
  voor: een succes-haptic, een `positive` haarlijn, een haptic bij het cijfer.
  Geschat op **drie regels code**. Geen ervan bestaat.
- **(b)** Play/pause zijn de letterlijke tekens `▶` en `❚❚`, door WS4 zelf
  benoemd als "neither Feather nor emoji, and outside the icon rule entirely".
- **(b)** Geen haptic bij het wisselen van stap, geen bij het starten van de
  timer.
- **(b)** ~~De voortgangslijn springt in plaats van te vullen.~~ Gedaan
  (GAP-24): `scaleX` op de native driver, geen `width`.
- **(c)** **Geen foto's in kookmodus**, en dat is een aanbeveling om het zo te
  houden: `MealStep` heeft geen beeldveld, de enige thumbnail is die van het
  gerecht (niet van de stap), hij is meestal al verlopen tegen de tijd dat er
  gekookt wordt, en hij zou vechten om de verticale ruimte die de instructie
  nodig heeft om op 60-70 cm leesbaar te zijn.

### Deze week en Boodschappen

**Het onderzoek heeft deze twee schermen nooit bekeken.** Zoeken op
`boodschappen`, `week`, `checkbox`, `supermarket` in WS2, WS4, WS5 en
ASSEMBLY levert niets op. Beide bestanden bestonden vóór die workstreams
werden geschreven en komen in geen enkele inventaris voor — terwijl de
boodschappenlijst het dichtstbedrukte scherm van de app is, en het enige dat
staand in een winkel wordt gebruikt.

- **(a)** Het vinkje is een `Text`-teken en moet dat blijven: het schaalt mee
  met Dynamic Type waar een vectoricoon dat niet doet. Dit omzetten naar een
  icoon zou een verslechtering zijn.
- **(b)** De overgang van skelet naar inhoud hard-wisselt in plaats van over
  te vloeien.
- **(c)** Geen enkele haptic: niet bij afvinken, niet bij verwijderen, niet
  bij een mislukte verwijdering — terwijl er al een foutnotitie staat om hem
  aan te koppelen.
- **(c) Afgewezen: categorie-iconen** (groente/zuivel/vlees).
  `ShoppingListItem` heeft geen categorieveld; er een verzinnen betekent een
  taxonomie bouwen, en groeperen op schap loopt tegen BSK-04 aan, dat
  geblokkeerd is.
- **(c) Afgewezen: een juichende afronding.** `shoppingListCopy.ts` heeft dat
  al beslist: dit scherm leest een feit, het juicht niet.

### De sociale laag

- **(b)** De naam van de vriend staat in mono, uppercase, gedempt — WS6's
  goedkoopste wijziging met de grootste warmte-opbrengst.
- **(b)** `Bewaren` ontbreekt op het gedeelde-receptscherm: er is vandaag geen
  enkele route van een vriendentip naar je eigen bibliotheek.
- **(b)** `CookSharingAskSheet` gebruikt `animationType="fade"` terwijl de
  andere drie sheets een gedeelde `translateY`-taal spreken.
- **(a) Uitdrukkelijk afgewezen en dat blijft zo:** confetti, streaks, badges,
  rangschikkingsanimaties. DESIGN-SOCIAL §8: "the moment cooking earns a
  persistent number, people cook for the number."
- **Correctie op het onderzoek zelf.** WS6 beweert dat de eigen handle op
  `friends/add` in monospace staat en "reads as a serial number". Dat klopt
  niet — `typeScale.title1` is Archivo Bold, en dat was al zo vóór WS6
  geschreven werd.
- **Correctie op de opdracht.** Kookbewijs is géén foto: het is een afgeleid
  tekstueel feit (profiel + canoniek recept-id). Er zit nergens een camera in
  de flow. **De sociale laag draagt dus geen enkel door gebruikers aangeleverd
  beeld**, en erft daarmee geen moderatie- of opslagplicht.

### Binnenkomen en instellingen

Twee keer "niet doen", allebei goed onderbouwd.

- **(a) De tabbalk blijft zonder iconen.** Gemeten, niet gevoeld: "Mijn
  recepten" is 93,6 pt tegen 88,25 pt beschikbare ruimte — de balk loopt bij
  élke ondersteunde breedte al over, en een icoon kost verticale ruimte, niet
  horizontale. Iconen zouden bovendien de ongeziene-teller in een badge duwen,
  precies wat PD-020.1 weigert.
- **(a) Geen banner op het inlogscherm.** `DESIGN.md` sluit foodfotografie als
  behang al productbreed uit ("the contact sheet, not the magazine"), en WS3
  beoordeelt dit scherm als "the best-written screen in the product. Leave it
  alone." De twee regels die het bij de makeover kreeg waren terughoudendheid,
  geen verwaarlozing.
- **(b)** `SegmentedControl` mist zijn selectie-haptic — WS5's goedkoopste
  ongeleverde aanbeveling.
- **(b)** Drie eyebrow-teksten hebben hoofdletters in de bron staan terwijl
  zowel WS3 als `tokens.ts` voorschrijven dat `textTransform` dat doet.
  Pixelidentiek resultaat, maar het is schuld die al twee keer genoteerd is.
- **(c)** `ConsentCheckboxRow` gebruikt een letterlijk `✓`; dit is de enige
  toestemmingscontrole in het product, dus één keer goed doen repareert hem
  overal.

---

## De mascotte — jouw beslissing, met beide kanten

Je stelde een koksmuts voor met een muis eronder, als wachtanimatie. Zes van
de zeven audits raden hem af; één heeft hem zorgvuldig ontworpen voor de
enige plek waar hij standhoudt.

**Wat ertegen pleit, en het is geen smaak.** WS4 §5.4 legt de regel voor
illustratie vast:

> **Subject: an object at rest, never a person and never a face.** No people,
> for three reasons: a drawn cook has a gender and an age and Remy's household
> does not; faces date faster than objects; and the friendly-blob-character
> empty state is the single most template-looking convention in consumer
> software.

En WS5 §1.3 verbiedt de bewegende helft los daarvan: "Anything on a timer the
user did not start. No ambient breathing on idle screens, no attract loops."
Een mascotte die wiebelt naast een aftellende kookwekker is precies die
attract loop.

**Waar die regel níét over gaat.** Hij dekt vier opdrachtillustraties voor
lege toestanden (bibliotheek, vrienden, trending, kookmodus). De
importwachttijd hoort daar niet bij en is geen lege toestand — het is
tijdelijk wachten. Daar reikt het verbod dus niet. Wat wél meereist is de
redenering: gezichten verouderen sneller dan objecten.

**Het ontwerp dat er ligt, als je hem toch wil.** Een platte koksmuts als twee
gestapelde vormen in één lijndikte, zonder vulling; onder de rand twee kleine
gevulde cirkels (ogen), erboven twee boogjes (oren). Verder niets: geen
lichaam, geen staart, geen snorharen, geen kleur buiten de tokens. Hij
*vergezelt* de checkpoint-lijst en vervangt hem nooit, want die lijst doet
eerlijk informatief werk dat een muis niet kan overnemen. Zijn beweging hangt
aan echte pijplijnstatus, niet aan een timer, en hij leent WS5's enige
al-beargumenteerde uitzondering op "niets loopt" in plaats van een nieuwe te
openen. Zuiver `Animated` op gewone `View`s: geen Lottie, geen SVG, geen
nieuwe dependency.

**Wat je moet weten over de naam.** WS1 signaleert dat `remyapp.io` een
bestaand, ongerelateerd product is, en adviseert die naamkwestie te
beslechten vóórdat er een identiteitsmerk wordt getekend — het app-icoon is
"the asset with the longest half-life in the product". Dat verandert de
juridische weging: een tijdelijke laadanimatie die niemand screenshot is laag
risico, een merkteken is precies het ding dat in de App Store-listing en het
icoon belandt, waar herkenbaarheid het hele doel is en dus het hele risico.

**Mijn lezing, expliciet als mening.** Bouw hem niet als merkteken en niet in
kookmodus, de sociale laag of de lege toestanden — daar botst hij met regels
die om goede redenen genomen zijn. Als je hem wil, is de importwachttijd de
enige plek waar hij verdedigbaar is, en dan pas nadat de
checkpoint-animaties uit WS5 §5.3 er zijn, want hij is ontworpen om die timing
te spiegelen.

---

## Wat bevestigd is als "laten staan"

Even belangrijk als de lijst met werk. Deze zijn nagekeken en goed:

- Geen tabbalk-iconen (gemeten, zie boven).
- Geen banner op inloggen.
- Geen foto op de beslis-kaart, in kookmodus, of op de boodschappenlijst.
- Geen icoon op een allergeenlabel — PD-007a, een veiligheidsregel: geen glyph
  in, naast of in plaats van een botsingslabel.
- Geen icoon bij een cijfer of score — PD-008 wees een sterrenrij bij naam af.
- Geen icoon op de vier Kiezen-knoppen.
- Het vinkje op de boodschappenlijst blijft een `Text`-teken (Dynamic Type).
- `KringRow` krijgt geen entree-animatie: "would say a tally was meant for you".
- Skeletten flikkeren niet en vervagen niet in.

---

## Volgorde

**Nu meteen — één regel per stuk, dependency staat er al** ✅ **gedaan op 4
september**

1. ~~De ontbrekende haptics~~ — alle geleverd, plus vijf die deze lijst niet
   noemde (bewaarintentie, timer starten, ingrediëntenblad, de timerbalk
   terugtikken, mislukte weekverwijdering). GAP-20.
2. ~~Het einde van kookmodus~~ — haptic, `positive` haarlijn en het cijfer,
   alle drie. GAP-21.
3. ~~De flikkerbeveiliging op het importlaadblok~~ — GAP-23.

Twee dingen zijn onderweg geleerd en staan hier omdat ze de volgende
uitvoerder aangaan:

- **De woordenschat kreeg een loket.** `src/lib/haptics.ts` draagt alle vier
  de stijlen, benoemd naar het gewicht van het gevolg in plaats van naar de
  API. De `.catch`-ritus die elke aanroep nodig heeft — de webimplementatie
  van `expo-haptics` is een lége default export, dus daar is élke aanroep een
  afgewezen promise — staat nu één keer in plaats van vijftien keer.
- **Twee regels bleken breder dan hun tabelrij.** "Alleen bij selecteren,
  nooit bij deselecteren" geldt voor `Chip`, `SegmentedControl` én de
  boodschappenlijst; en een haptic hoort nooit binnen een `setState`-updater,
  want React mag die meer dan één keer draaien — in StrictMode doet hij dat
  expres, en dan trilt één tik twee keer.

**Daarna — het fundament**

4. Het Phosphor-subsetfont via `createIconSet`. Ongeveer een dag, geen nieuwe
   dependency, en het deblokkeert twintig icoonvoorstellen tegelijk. **Dit is
   nu het eerstvolgende punt.**
5. `EmptyState`, `Thumbnail`, `Monogram`. Daarna zijn de 21 lege toestanden
   invulwerk in plaats van eenentwintig handgemaakte kopieën.
6. ~~`typeScale.button` van monospace af~~ — gedaan, naar `sansMedium` met
   `letterSpacing` op 0. Geen nieuw font nodig: `Archivo_600SemiBold` werd al
   geladen. GAP-18.

**Daarna — de zichtbare winst**

7. De `cooking-pot` op de lege bibliotheek: het eerste scherm van elke nieuwe
   installatie.
8. Het vinkje in de import-checkpoints.
9. De letterlijke tekens vervangen: `×`, `+`, `▶`, `❚❚`.
10. De checkpoint-animaties uit WS5 §5.3. **Let op:** de laadfase heeft er
    sinds GAP-23 een derde toestand bij (`pending`, vóór de onthulling). Wie
    deze animaties bouwt, hangt ze aan `loading` en niet aan "een verzoek is
    weg", anders is de flikkering terug.
11. ~~De vaste timerbalk in kookmodus~~ — gedaan (GAP-22), en het bleek meer
    dan een zichtbaarheidskwestie: de succes-haptic en `Timer klaar` zaten in
    `TimerDisplay`, dat niet gemonteerd is voor een stap waar je vandaan
    gebladerd bent. Een timer die afliep terwijl je vooruitlas zei tegen
    niemand iets. Dat was de echte bug; onzichtbaar was maar de helft.

**Pas als de rest staat**

12. De typografische tegel-fallback (wacht op `tileTint` + `Thumbnail`).
13. `Bewaren` op het gedeelde-receptscherm.
14. Reanimated + Gesture Handler in één commit, voor de `Sheet`-primitive en
    het vegen in kookmodus. WS5 zet dit bewust als laatste, en sinds de
    verplichte nieuwe architectuur van SDK 57 vraagt het eerst een test op een
    toestel.
15. De mascotte, alleen bij de import, alleen na punt 10, alleen als je hem
    wil.

---

## Wat hier níét in zit

Deze audit keek naar iconen, beeld en motion. **WS2 (layout en dichtheid),
WS3 (Nederlandse stem) en het grootste deel van WS6 zijn alleen aangeraakt
waar ze die drie kruisten.** Gegeven dat 26 van 26 kleuren gemist bleken en
0 van 21 markeringen geleverd zijn, is de kans klein dat die drie
workstreams wél volledig geland zijn. Dat is de volgende controle waard, en
het is dezelfde controle als deze: lezen wat er besloten is, en het tegen de
code houden.
