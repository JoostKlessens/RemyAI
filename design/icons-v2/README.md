# Iconen v2 — 45 tekeningen, in kleur, ter beoordeling

**Bekijk ze hier:** open `design/icons-v2/contact-sheet.html` in je browser (dubbelklikken volstaat —
de pagina heeft geen internet nodig en laadt niets van buiten). Elk icoon staat er op **14, 16, 24 en
48 pt**, met de naam eronder, plus drie rijen waarin alle 45 naast elkaar op 16 pt staan: op wit, op de
nieuwe groene grond en op de put van een niet-geselecteerde chip.

**Er is nog niets bedraad.** Geen enkel bestand onder `src/` is aangeraakt. Bedraden is een aparte
opdracht die pas bestaat na jouw akkoord — zie "Wat er nog moet gebeuren" onderaan.

---

## Eerst een correctie: het zijn er 45, niet 41

De opdracht sprak van 41 iconen en somde er vervolgens 45 op. `ICON_NAMES` in
`src/components/iconFont.ts` bevat er 45. Het generatiescript leest die lijst uit de bron en weigert
te draaien als wat het tekent er ook maar één van afwijkt — dus dit is geteld, niet aangenomen.

---

## Het palet, en de regel eronder

Twintig waarden, zeven kleurfamilies. De kleur wordt **niet per icoon gekozen maar per
voedselfamilie**, en elk icoon in die familie erft hem. Dat is de hele reden dat 45 tekeningen als
één set lezen in plaats van als een fruitschaal:

| Familie | Waarde | Waar hij voor staat |
|---|---|---|
| `ink` | `#26332C` | elke omtreklijn, en het lijnwerk van elke knop |
| `inkSoft` | `#7A887F` | secundaire lijnen: stoom, zwakke scheidingen |
| `cream` | `#F8F2E4` | het neutrale binnenste: rijst, deeg, kommen, eiwit, bot |
| `green` / `greenSoft` / `greenDeep` | `#2E7A4E` `#BCDFC6` `#1C5637` | planten — blad, kiemplant, kruiden, peulen, sla |
| `amber` / `amberSoft` | `#E4AC44` `#F7E2B4` | granen en zuivelvet — brood, pasta, graan, kaas, dooier, zand |
| `orange` / `orangeSoft` | `#E07C3A` `#F6C9A2` | wortelgroente en specerij — wortel, curry |
| `red` / `redSoft` | `#CB4A3D` `#EFAA9E` | fruit — appel, tomaat |
| `brown` / `brownSoft` | `#8C6446` `#D9BCA1` | aarde — noten, grond, hout, eetstokjes, aardappelschil |
| `meat` / `meatSoft` / `fat` | `#B45A3E` `#DE9A72` `#F3E3D2` | dierlijk eiwit, plus vet en bot |
| `teal` / `tealSoft` | `#3E8AA6` `#C2DEE9` | water en koelte — vis, het etiket op het melkpak |
| `berry` / `berrySoft` | `#8D4C85` `#E0C3DB` | suiker — snoep |

**De zestien knoppen zijn inkt met precies één groen accent** — het onderdeel dat "het punt" van de
knop is: het vinkje, de plus, de gemarkeerde dag, de actieve filter. De grond wordt wit-met-groen, dus
een bonte knop zou concurreren met het enige accent dat het product echt uitgeeft. Twee bewuste
uitzonderingen: `warning` is amber (een waarschuwing die eruitziet als het accent is een waarschuwing
die niemand opmerkt) en `timer` heeft amber zand.

**Waarom niet gewoon de kleuren uit `src/theme/tokens.ts`?** Die tokens zijn semantische UI-rollen
(background, surface, accent, positive) en beantwoorden "welke kleur heeft een ingedrukte chip", niet
"welke kleur heeft een wortel". `positive` lenen voor een blaadje zou de tekening van een groente
vastklinken aan de betekenis van een afgeronde maaltijd.

> **Één open punt voor jou.** De parallelle tokenwijziging heeft `accent: #006D35` gezet. Mijn
> `green` is `#2E7A4E` — dezelfde kleurfamilie (tint 145° tegen 149°), lichter en grijzer. Ze bijten
> niet, maar het zijn wel drie groenen op één scherm (`accent`, `positive` `#374123`, en dit).
> Als je liever twee wilt, is de goedkoopste ingreep één regel in `tools/palette.py`.

### Contrast, gemeten

Elke vulling heeft een omtreklijn in `ink` (`#26332C`), en die haalt **12,6:1 tegen wit**. Daardoor
haalt het *silhouet* van elk icoon WCAG 1.4.11's 3:1 voor een niet-tekstuele afbeelding, hoe bleek de
vulling erbinnen ook is. Dat is precies waarom `cream` (1,06:1 tegen wit) bruikbaar is als neutrale
body zonder dat het icoon van de kaart verdwijnt.

---

## De drie gokken die hiermee vervallen

`iconFont.ts` markeert drie toewijzingen met een ⚠ omdat MaterialCommunityIcons het ding niet kón
tekenen. Zelf tekenen haalt die beperking weg, dus alle drie zijn opgelost:

| Naam | Was | Is nu |
|---|---|---|
| `potato` | `food-variant`, een afgedekte schaal — "zegt *een gerecht* en niet *een aardappel*" | Een aardappel: een knollige tan vorm met donkere oogjes. |
| `salad-bowl` | `leaf`, omdat het font geen salade had | Een brede **houten** kom met blad dat over de rand hangt en een tomaat. De enige bruine kom in de set. |
| `leaf` / `sprout` | **Gekruist**: `leaf` (vegetarisch) werd getekend door `sprout`, en `sprout` (veganistisch) door `leaf-circle`, omdat het gewone blad al aan salade was uitgegeven | De kruising is weg. `leaf` is één blad, `sprout` is een kiemplant uit de aarde. |

Nog steeds een blad en een kiemplant, nooit een doorgestreept dier: PD-006 houdt beschrijvende
categorieën en veiligheidsclaims strikt gescheiden, en een verbodsbord is de beeldtaal van een
allergiewaarschuwing.

---

## Welke iconen bewust op elkaar lijken, en welke bewust niet

`tests/iconFont.test.ts` weigert twee namen op één tekening, "which would make two controls look
identical". Die regel geldt onverkort als de tekeningen van onszelf zijn:

| Paar | Hoe ze uit elkaar worden gehouden |
|---|---|
| **`cooked` / `wok`** | Een koksmuts tegen een lange steelpan. Dit is hét paar waar `iconFont.ts` een half scherm tekst aan wijdt, want ze staan op hetzelfde scherm — de badge op een tegel en de chip "Wokgerecht". Ze delen nu geen enkel onderdeel, geen verhouding en geen kleur. |
| **De vijf ronde kommen** | `bowl-steam` (drie stoomkrullen, bleke bouillon) · `rice-bowl` (witte berg **boven** de rand, plus een voet) · `curry-bowl` (massief oranje, room-swirl, géén stoom) · `salad-bowl` (hout, blad over de rand) · `noodles` (**helemaal geen kom** — een nest en eetstokjes). Silhouet eerst, kleur tweede. |
| **`potato` / `nuts`** | Een ronde knol met donkere oogjes tegen een noot met een **dop**. Allebei tan, dus de dop doet het werk en niet de kleur. |
| **`beef` / `meat`** | Een bot tegen een spies. `beef` is de gerechtstag (T-bone), `meat` de ingrediëntcategorie (spies met drie stukken) — een categorie-icoon mag geen diersoort noemen, dezelfde reden waarom `iconFont.ts` `cow` ervoor weigerde. |
| **`pasta` / `noodles`** | Een vlinderpasta tegen een nest golvende slierten. Twee keer "kluwen met bestek" was de voor de hand liggende tekening en zou botsen. |
| **`leaf` / `sprout` / `herbs`** | Eén groot blad · twee zaadlobben boven bruine aarde · een schuine tak met blaadjes eraan. De dichtstbevolkte hoek van de set. |
| **`clock` / `timer`** | `clock` is de enige cirkel in de bedieningsset; `timer` is een zandloper met amber zand. Dat is dezelfde afweging die `iconFont.ts` al maakte toen het het font zijn eigen `timer` (een wijzerplaat) weigerde. |
| **`plus` / `close`** | Beide een kruis; `plus` is groen en rechtop, `close` is inkt en gedraaid. De kleur scheidt ze vóór de rotatie dat doet. |
| **`check` / `cooked`** | Het oude probleem was dat een vinkje op een tegel als een afvinkhokje las. Een groen vinkje tegen een koksmuts kan dat niet meer worden. |

---

## Wat ik opnieuw moest tekenen nadat ik ze gerasterd bekeek

Dit is geen formaliteit geweest. Negen van de 45 zijn afgekeurd op de gerasterde versie en overnieuw
gedaan. Twee ervan waren echt fout:

| Icoon | Wat ik zag op 14 en 16 px | Wat ik eraan deed |
|---|---|---|
| **`meat`** | Een **rugbybal**. Het was een ovaal met twee lichte banden eroverheen — dat ís een rugbybal, en geen enkele kleur wint dat argument van het silhouet. | Volledig hertekend als een **spies met drie stukken vlees**. Niets anders in de set is een schuine lijn met dingen eraan geregen. |
| **`nuts`** | Een **hondenbot**. De pinda was juist gekozen omdat zijn taille hem van de aardappel zou onderscheiden — dat deed hij ook, maar hij botste met iets dat niet eens in de set zit, wat geen enkele onderlinge controle had gevonden. Alleen kijken vond het. | Hertekend als een **noot met een gekartelde dop**. De dop is een beter onderscheid dan de taille was. |
| **`sweets`** | Een **oog**. Een witte spiraal in een donker rond lichaam las als een pupil met een lichtvlekje — nogal verontrustend in een ingrediëntenlijst. | Twee rechte diagonale strepen in plaats van de swirl. Een streep kan niet tot pupil krullen. |
| **`wok`** | Een **kom met een lepel**, nauwelijks te onderscheiden van `salad-bowl` twee chips verderop. | Pan platter (18 breed bij 7 diep), het geheel **20° gekanteld** zodat er geen komsilhouet overblijft, en een lange rechte steel met een dikke houten greep in plaats van een taps toelopende lepel. |
| **`cooked`** | Een **cupcake**. Twee verticale plooilijnen op de band zijn precies wat een papieren cupcakevormpje heeft, en de kroon was hoog en bobbelig genoeg om voor glazuur door te gaan. | Plooien weg, kroon met drie duidelijke bollen en dalen ertussen, en de band smaller dan de kroonvoet (9,2 tegen 13,6) zodat de kroon zichtbaar overhangt. Overhang is wat een koksmuts heeft en een cupcake niet. |
| **`beef`** | Een rode schijf met witte vlekken; en na de eerste reparatie: **twee pleisters**. Dat tweede was een tekenvolgorde-fout — de omtrek van de dwarsbalk werd dwars door de vulling van de staander geschilderd. | Het room-vetrandje geschrapt (het concurreerde met het bot), bot van 2,7 naar 3,4 breed, en beide inktlijnen vóór beide vetlijnen getekend zodat het bot één vorm is. |
| **`pork`** | Vier bleke golfjes; las als lint, niet als spek. | Beide plakken op volle `meat`-sterkte in plaats van één lichte, band 4,2 diep in plaats van 3,2, vetstreep van 1,3 naar 1,8. |
| **`noodles`** | Een dunne amberkleurige krabbel met één bruine balk. | Slierten van 1,9 naar 2,3, een vierde sliert erbij zodat het een *massa* wordt in plaats van lijnen, en de eetstokjes verder uit elkaar zodat de tussenruimte 14 px overleeft. |
| **`chicken`** | Een perzikkleurige cirkel met een klein knobbeltje. | Botschacht van 2,9 naar 3,6 en de knokkels van 2,0 naar 2,4 — het verschil tussen "een drumstick" en "een bal". |

Dat de peulvruchten juist wél meteen goed waren, is niet toevallig: `remyGlyphs.ts` had zijn eigen
peul opgemeten en opgeschreven waar hij faalt — "at 16 PHYSICAL px the three peas are faint, close to
merging into the pod" — omdat de erwten *gaten* waren, en een gat heeft geen eigen kleur. Hier zijn
het lichtgroene schijfjes met een eigen omtrek, dus drie losse objecten op elk formaat in plaats van
drie afwezigheden. **Kleur repareert hier een gemeten zwakte.**

---

## Wat is gemeten, en wat niet

**Gemeten:**
- Alle 45 namen komen exact overeen met `ICON_NAMES`, in dezelfde volgorde (het script weigert anders).
- Elk icoon past binnen het 24×24-raster (elk afgevlakt punt is nagerekend, inclusief rotaties).
- Elke tekening is gerasterd op 14, 16, 24 en 128 px en met het oog bekeken, meerdere rondes.
- Het contactblad bevat 315 inline SVG's en **nul** externe verwijzingen — hij opent offline.

**Niet gemeten — en dit is de belangrijkste beperking:**
- **Geen toestel en geen `react-native-svg` heeft deze tekeningen ooit gerenderd.** De rasteraar is
  Pillow met de curves met de hand afgevlakt; hij benadert ronde hoeken door bij elk punt een schijfje
  te stempelen en vult elk subpad los. Hij beantwoordt "is dit silhouet leesbaar op deze maat". Hij
  beantwoordt niet "hoe tekent een telefoon dit". Dat is dezelfde grens die `remyGlyphs.ts` voor zijn
  eigen twee glyphs opschreef, en hij is hier 45 keer zo breed.
- Antialiasing op een echt scherm is niet bekeken. De haarlijntjes van 0,9–1,3 eenheden (de plooien in
  `pasta`, de nerven in `leaf`) zijn de eerste die op een toestel kunnen dichtlopen.
- Of de optische zwaarte klopt naast Archivo en IBM Plex Mono in een echte rij is niet vastgesteld —
  het contactblad heeft die lettertypen niet.
- De kleuren zijn niet op een gekalibreerd scherm bekeken en niet in donkere modus getest. **Deze set
  is voor lichte modus getekend**; op een donkere grond zou de inktomtrek moeten wisselen.

---

## Wat er nog moet gebeuren om ze te bedraden (de volgende opdracht, niet deze)

Kort, zodat je weet waar je ja tegen zegt:

1. **`src/components/remyGlyphs.ts` wordt de drager van alle 45** in plaats van twee. Het huidige
   `RemyGlyph`-type (één pad, één `fillRule`, één rotatie) kan geen meerkleurig icoon beschrijven; het
   wordt een lijst vormen per naam. Meerkleurig betekent bovendien dat `Icon`'s `color`-prop niet meer
   elke vulling kan sturen — dat is de ene echte gedragswijziging en hij moet expliciet besloten worden.
2. **`INSTALLED_GLYPH_BY_ICON` in `iconFont.ts` wordt 45× `remy(...)`**, en `feather` en
   `material-community` verdwijnen — samen met 1,25 MB fontbestand en 212 KB glyphmap-JSON die dat
   bestand nu al als kosten opschrijft. Dat is de grootste bijvangst van deze operatie.
3. **De invariant in `tests/iconFont.test.ts`** die twee namen op één tekening weigert moet worden
   herschreven: hij vergelijkt nu glyph-namen uit een font, en er is geen font meer.
4. **De drie ⚠-commentaren over de gokken** en het lange stuk over `pot-steam` mogen weg — de reden
   dat ze bestonden (het font kón het niet) bestaat niet meer. Wat blijft is de *afweging*, en die
   staat hierboven.
5. **Op een toestel kijken**, vóór alles hierboven definitief is. `react-native-svg` staat vast op
   15.15.4 omdat dat de versie in Expo SDK 57's `bundledNativeModules.json` is; dat is uit die
   manifest gelezen en niet op een telefoon gezien.

---

## De bestanden

```
design/icons-v2/
├── contact-sheet.html   ← dit open je
├── README.md            ← dit lees je
├── <45 × naam>.svg      ← de tekeningen, als tekst
└── tools/
    ├── geometry.py      vormen, SVG-uitvoer, rasteraar
    ├── palette.py       de twintig kleuren en de regel eronder
    ├── icons_ui.py      de 16 knoppen + 3 weergaveglyphs
    ├── icons_food.py    de 15 gerechten + 11 categorieën
    └── build_icons.py   python design/icons-v2/tools/build_icons.py
```

De `.svg`-bestanden worden **gegenereerd**; wil je iets veranderen, verander het in `tools/` en draai
het script opnieuw. Een SVG met de hand bijwerken raakt hem los van zijn bron. Dat een `.ttf` hier
geen optie is staat al in `remyGlyphs.ts` en geldt nu dubbel: een icoonfont kán geen meerkleurige
glyph.
