# Toesteltest

Een zitting van ongeveer een uur, op een telefoon, waarin je alles bekijkt wat
tussen 4 en 8 september gebouwd is en wat **niemand ooit op een scherm heeft
gezien**. Vier checks groen betekent voor dit werk alleen dat er niets kapot is;
het zegt niets over of het klopt.

Per onderdeel staan er drie dingen: **wat je doet**, **wat je hoort te zien**, en
**wat het betekent als het anders is**. Die derde regel is het punt van dit
document. Een waarneming zonder interpretatie kost je een tweede zitting.

**Neem een notitieblok mee.** Wat je opschrijft bij een afwijking is de
foutmelding letterlijk, de schermnaam, en of het bij hertikken opnieuw gebeurt.

---

## Vóór je begint — vijf minuten

- [ ] **Welke database?** Kijk of `.env.local` bestaat in de projectmap. Bestaat
      hij, dan draai je tegen lokaal (zie `docs/LOKAAL-DRAAIEN.md`); bestaat hij
      niet, dan tegen productie. **Weet welke van de twee**, want de helft van de
      verwachtingen hieronder hangt aan de demo-data.

- [ ] **Staat migratie `0019` er?**

      ```powershell
      npx supabase migration list
      ```

      Dit leest en wijzigt niets. Je wilt `0019` in de kolom `remote` zien staan.
      Zo niet:

      ```powershell
      npx supabase db push
      ```

      ⚠ **Zonder `0019` verdwijnt het blok "Misschien ken je" volledig en
      stil.** De read faalt met `PGRST202` (function not found) en dat is met
      opzet geen zichtbare fout: de feed eromheen laadt gewoon door. Je krijgt
      dus géén melding die zegt dat dit nog moet. Test onderdeel 2 hieronder niet
      voordat deze regel afgevinkt is — je zou een werkende feature als kapot
      wegschrijven.

- [ ] **Staat de demo-data er?** Draai de controlequery onderaan
      `supabase/seed/demo_social.sql`. Verwacht: 6 vrienden, 1 open verzoek,
      8 recepten, 6 kookgebeurtenissen, 18 stemmen, 1 doorgestuurd recept. Nee?
      Draai eerst `npm run check:seed` (geen database nodig, vindt de fout van
      8 september) en dan de seed.

- [ ] **Beide toestellen bij de hand**, als je ze hebt: iOS en Android. Onderdeel
      1 gaat alleen over Android.

---

## 1. Start de app op Android — doe dit als eerste

**Waarom bovenaan:** dit is de goedkoopste meting met het grootste gevolg. Het
kost twee minuten en het antwoord bepaalt of de helft van je gebruikers de app
überhaupt kan openen. Alles hieronder is zinloos als dit rood is.

**De achtergrond, zodat je weet waar je naar kijkt.** `expo-notifications` roept
bij het laden `warnOfExpoGoPushUsage()` aan, en die functie **gooit een exception
op Android** waar hij op iOS alleen waarschuwt. Zolang die import bovenin
`_layout.tsx` stond, gebeurde dat tijdens het evalueren van dat bestand — en dan
start de app niet, over een pushfunctie die deze app bewust niet heeft. De import
is inmiddels naar binnen verplaatst zodat de throw in een `try` valt en als
`{ kind: 'unavailable' }` terugkomt. **Dat is uit broncode afgeleid en nooit op
een toestel gezien.** Deze test is de eerste keer.

- [ ] **Wat je doet:** `npx expo start` op de laptop. Expo Go op een
      **Android**-toestel, QR scannen, wachten tot de bundel binnen is.

- [ ] **Wat je hoort te zien:** de app opent. Het inlogscherm of, als je al
      ingelogd bent, Kiezen. In de Metro-console mag een gele waarschuwing over
      `expo-notifications` en Expo Go staan — **die is verwacht en onschadelijk**,
      en verschijnt alleen op een start die daadwerkelijk een melding inplant.

- [ ] **Wat het betekent als het anders is:**
      - **Rood scherm bij het opstarten met `warnOfExpoGoPushUsage` of
        `expo-notifications` in de stacktrace** → de verplaatste import heeft het
        niet opgelost, of er is een tweede aanroeppad. Schrijf de hele stacktrace
        over. Dit blokkeert Android volledig.
      - **Rood scherm met iets anders** → een ander probleem, maar even
        blokkerend. Ook overschrijven.
      - **De app blijft op het splashscherm hangen** → geen throw maar een
        vastloper. Kijk in de Metro-console wat de laatste regel is.
      - **App opent maar er komt geen 16:00-melding** → dat is een aparte, veel
        goedkopere vraag. Noteer hem en ga door; de app start, en dat was de
        vraag hier.

- [ ] **Loop daarna in tien minuten door alle vier de tabs** (Kiezen, Recepten,
      Vrienden, Trending) en open één recept. Je zoekt niets specifieks — je
      zoekt of Android op een ander scherm alsnog omvalt. Alles wat je vindt is
      winst; dit is de eerste keer dat iemand kijkt.

---

## 2. De Vrienden-tab, zoals die op 8 september herschreven is

⚠ **Eerste stap, en sla hem niet over: `0019` moet gepusht zijn.** Zie de
voorbereiding hierboven. Zonder die migratie verdwijnt het suggestieblok stil, en
dan test je niets.

Ga naar de tab **Vrienden**.

### 2a. De kop

- [ ] **Wat je doet:** kijk naar de bovenkant van het scherm.

- [ ] **Wat je hoort te zien:** het woord **`Vrienden`**, en verder niets. Geen
      knop `+ Vriend toevoegen` rechtsboven, geen zin *"Wat vrienden echt gekookt
      hebben."* eronder.

- [ ] **Wat het betekent als het anders is:** staat de knop of de zin er nog, dan
      draai je op een oudere bundel. Sluit Expo Go helemaal af en scan opnieuw.

### 2b. De regel voor wachtende verzoeken

Fatima heeft je in de demo-data één verzoek gestuurd.

- [ ] **Wat je doet:** kijk direct onder het woord `Vrienden`.

- [ ] **Wat je hoort te zien:** één regel, letterlijk **`1 vriendschapsverzoek
      wacht op je`**, in de accentkleur, met een dunne lijn eronder. Tik erop →
      je komt op `/friends/add`, waar je Fatima kunt accepteren of weigeren.

- [ ] **Wat het betekent als het anders is:**
      - **De regel staat er niet** → er is geen `pending`-rij. Controleer de seed
        (verwacht: 1 open verzoek).
      - **Er staat `1 vriendschapsverzoeken`** → de enkelvoud/meervoud-regel in
        `formatPendingRequests` is stuk. Onwaarschijnlijk (er zijn tests op), maar
        het is precies het soort ding dat een interface machinaal doet aanvoelen.
      - **De regel staat er terwijl er niets wacht** → hij hoort alleen te
        tekenen als er echt iets is. Een regel die "er wacht niets" zegt, kost
        ruimte om niets te zeggen.
      - **Accepteer Fatima** en kom terug: de regel hoort weg te zijn.

### 2c. Het blok "Misschien ken je"

Scroll naar de onderkant van het scherm, onder de feed.

- [ ] **Wat je doet:** kijk naar het blok onder de kaarten.

- [ ] **Wat je hoort te zien:** het kopje **`MISSCHIEN KEN JE`** in kleine
      hoofdletters (mono), met daaronder **exact drie rijen, in deze volgorde**:

      | Naam | Regel eronder |
      |---|---|
      | Noor (demo) | `2 gemeenschappelijke vrienden` |
      | Youssef (demo) | `1 gemeenschappelijke vriend` |
      | Daan (demo) | `Beoordeelde 6 recepten` |

      Elke rij: naam boven de handle (`@demo_noor`), de reden eronder in klein
      grijs, en rechts een lichte knop **`Toevoegen`**.

      De volgorde is niet toevallig — `0019` sorteert op gemeenschappelijke
      vrienden aflopend, dan op stemmen aflopend, dan op handle. Noor (2) boven
      Youssef (1) boven Daan (0 gemeenschappelijk, 6 stemmen).

- [ ] **Tessa (demo) staat er NIET bij.**

      ⚠ **En let op wát dat bewijst, want dit is op 8 september bijgesteld en de
      oude lezing staat nog in drie documenten.** De seed en `HANDOVER.md` zeggen
      "staat Tessa erin, dan reikt de query een stap te ver". Dat is **niet meer
      waar**: Tessa heeft één stem, en de activiteitspool in `0019` heeft een
      drempel van `vote_count >= 3` gekregen. Ze valt af op die drempel, niet op
      de graafafstand. De twee foutbeelden zijn dus verschillend:

      - **Tessa met `1 gemeenschappelijke vriend`** → de tweede hop lekt naar een
        derde. Dít is het echte defect waar de seed voor gebouwd is.
      - **Tessa met `Beoordeelde 1 recept`** → de drempel van drie stemmen doet
        niets. Ook fout, maar een andere fout.
      - **Tessa staat er helemaal niet** → goed, en dat is de verwachting.

- [ ] **Wat het betekent als het blok er helemaal niet is:** dat is de stille
      `PGRST202`. Ga terug naar de voorbereiding: `0019` staat niet remote.

- [ ] **Wat het betekent als er een rij zonder regel eronder staat:** een
      suggestie die niet kan zeggen waarom hij een suggestie is. Dat hoort
      onmogelijk te zijn — `selectFriendSuggestions` gooit zulke rijen weg vóór ze
      getekend worden. Zie je het toch, noteer wie.

- [ ] **Wat het betekent als er een naam zonder `(demo)` in staat:** dan
      suggereert de app een echte persoon, en dat is geen fout maar wél iets om
      te weten voordat je vrienden uitnodigt.

### 2d. Toevoegen

- [ ] **Wat je doet:** tik op `Toevoegen` bij Noor.

- [ ] **Wat je hoort te zien:** de knop **verdwijnt** en er staat de tekst
      **`Verzoek verstuurd`** op die plek. Niet een grijze uitgeschakelde knop —
      een uitgeschakelde knop zegt "dit mag je niet", de tekst zegt wat er
      gebeurd is.

- [ ] **Wat het betekent als het anders is:**
      - **Er verschijnt `Het verzoek kon niet verstuurd worden.` in rood onder de
        lijst** → de schrijfactie is geweigerd. Meest waarschijnlijk RLS of de
        trigger op `friendships`. Noteer het en probeer een tweede naam.
      - **Er gebeurt niets** → de knop is aangeraakt maar de handler niet.
      - **Verlaat het scherm en kom terug:** Noor hoort nu weg te zijn uit de
        suggesties (`0019` sluit iedereen uit met wie je al een rij deelt).

### 2e. De deur naar `/friends/add`

Dit is het gevaarlijkste stukje van de herschrijving: het weghalen van de kopknop
haalde de enige duurzame ingang naar het toevoegscherm weg.

- [ ] **Wat je doet:** kijk helemaal onderaan het suggestieblok.

- [ ] **Wat je hoort te zien:** de regel **`Zoeken op gebruikersnaam`**, tikbaar,
      en die brengt je naar `/friends/add`.

- [ ] **En de eigenlijke test:** die regel hoort er **ook** te staan als er nul
      suggesties zijn. Kun je dat opwekken (bijvoorbeeld door alle drie de
      suggesties toe te voegen), doe dat en kijk of de regel blijft.

- [ ] **Wat het betekent als hij verdwijnt bij nul suggesties:** dan heeft iemand
      met een volle feed en twee vrienden geen enkele manier meer om een derde
      toe te voegen. Dat is de bug die deze regel bestaat om te voorkomen.

### 2f. De lege staat

- [ ] **Wat je doet:** dit zie je alleen zonder gedeelde kookgebeurtenissen — dus
      vóór de seed, of op een vers account. Sla over als je het niet goedkoop
      kunt maken.

- [ ] **Wat je hoort te zien:** de kop **`Nog niets gedeeld`**, daaronder één
      alinea, en daaronder het suggestieblok. **Geen** decoratief streepje en
      **geen** twee gestapelde knoppen onder elkaar.

- [ ] **Wat het betekent als die er nog zijn:** oude bundel, zelfde oplossing als
      bij 2a.

---

## 3. De 45 eigen icoontekeningen

Op 8 september is `MaterialCommunityIcons` eruit gegaan (1277 KB `.ttf` plus
212 KB glyphmap voor 28 glyphs) en zijn er 45 eigen tekeningen voor in de plaats
gekomen, als SVG-data via `react-native-svg`. **Geen van die 45 is ooit door
`react-native-svg` in Expo Go gerenderd** — ze zijn als geometrie geverifieerd en
in een browser bekeken, wat iets anders is.

- [ ] **Wat je doet:** open **Kiezen** en open de filterlade (de knop `Filters`).
      Kijk naar de chips onder `Ingrediënten`.

- [ ] **Wat je hoort te zien:** naast elk woord een klein gekleurd tekeningetje —
      pasta bij `pasta`, een kip bij `kip`, een blad bij `vegetarisch`, een kiem
      bij `veganistisch`, een vis bij `visgerecht`, een wok bij `wok`. Ze zijn
      **meerkleurig**; het zijn geen lijntekeningen in de tekstkleur.

- [ ] **Wat het betekent als het anders is:**
      - **Lege ruimte waar het icoon hoort** → `react-native-svg` tekent niets in
        Expo Go. Dat is de kernvraag van dit onderdeel en het raakt alle 45.
      - **Een vierkantje, een blokje of een `?`** → een lettertypeglyph die niet
        opgelost is; dan zit er nog een oud pad in.
      - **Het icoon staat er maar in de verkeerde kleur bij een geselecteerde
        chip** → dat is **verwacht**. Sinds 8 september doet `color` niets meer
        voor een naam met een tekening: een tekening die ÍS een wortel kan geen
        grijstint aannemen. De geselecteerde staat is de vulling en de rand van de
        chip, niet de kleur van het plaatje.
      - **Het icoon oogt te zwaar naast het woord** → dat is de open vraag die je
        zelf had: een tekening vult zijn hele em-vak waar een letter alleen zijn
        kaphoogte vult, en de schijnbare afstand tot het woord ging van 24pt naar
        8pt. Dit is een oordeel, geen fout. Noteer *te zwaar* of *goed zo*.

- [ ] **Ook kijken, dezelfde vraag op andere maten:**
      - De **koksmuts** op een tegel in **Recepten**, bij een recept dat je al
        gekookt hebt, in de hoek van de tegel. Die is klein (14pt). **De vraag is
        of hij op die maat leest als "al gekookt" of als "recept".** Als hij
        alleen leest als "hier staat een plaatje", is dát de bevinding.
      - Het **klokje** boven de foto op Kiezen, bij de kooktijd.
      - Het **chevron** bij de opening `Filters` en bij `Geavanceerd`.
      - Het **kruisje** in het zoekveld op Recepten.

⚠ **Twee van de 45 kun je nergens zien, en dat is geen fout van jou.** `dairy`
(melkpak) en `legumes` (peul) staan in `HANDOVER.md` punt 5 als "te testen", maar
hun enige aanroeper was de ingrediëntenlijst op het receptscherm, en die tekent
sinds 7 september op jouw eigen verzoek geen icoontjes meer
(`ingredientCategoryIcons.ts` draagt bovenin: *"ZERO PRODUCTION CALLERS"*). Er is
vandaag geen scherm dat ze tekent. Sla ze over.

---

## 4. Donkere modus

Het donkere palet is **afgeleid** — de vier neutralen van de tekeningen zijn
omgeklapt, de vijftien kleuren zijn byte-identiek gebleven — en **door niemand
bekeken**.

- [ ] **Wat je doet:** zet de telefoon in donkere modus.
      - iOS: Instellingen → Beeldscherm en helderheid → Donker.
      - Android: Instellingen → Weergave → Donker thema.

      De app volgt de systeeminstelling (`userInterfaceStyle: "automatic"` in
      `app.json`), dus je hoeft in de app niets om te zetten.

- [ ] **Wat je hoort te zien:** loop **Kiezen → Recepten → Vrienden → Trending →
      één recept** door en let per scherm op drie dingen:
      1. **Contrast van de tekeningen.** De omtrek van elk icoon moet lichter zijn
         dan de ondergrond. Wordt een tekening een donkere vlek op een donkere
         achtergrond, dan is een van de vier neutralen niet meegeflipt.
      2. **De foto's.** Die zijn niet omgeklapt en horen dat ook niet te zijn; de
         vraag is of ze niet als een lichtbak op een donker scherm knallen.
      3. **De accentkleur** (de regel met wachtende verzoeken, de primaire knop).
         Die moet leesbaar blijven zonder te gloeien.

- [ ] **Wat het betekent als het anders is:**
      - **Een icoon verdwijnt** → `INK` of `INK_SOFT` doet zijn werk niet in dat
        scherm. Noteer welk icoon en op welk scherm.
      - **Een chip wordt onleesbaar in geselecteerde staat** → de combinatie
        vulling/rand/tekst valt om in donker. Dit is een van de plekken waar een
        afgeleid palet het snelst breekt.
      - **Wit-op-wit of zwart-op-zwart tekstvlak** → een kleur die niet uit de
        tokens komt maar hard geschreven is.

- [ ] Zet de telefoon daarna terug in lichte modus voordat je verder gaat, anders
      beoordeel je de rest van deze lijst in een modus die je niet bedoelde.

---

## 5. Kiezen: de 200pt-foto en de filterlade

De foto is op 7 september van klein naar **200pt breed** gegaan (9:16, dus 356pt
hoog), de knoppen staan naast elkaar, `Ja` heet nu `Dit koken`. Daarna, op
8 september, liep de receptnaam over de filterlade heen zodra die openging — dat
is gerepareerd door van de foto een **plafond** te maken in plaats van een vaste
maat. **Die reparatie is nooit op een toestel gezien.**

- [ ] **Wat je doet:** ga naar **Kiezen** met de lade **dicht**.

- [ ] **Wat je hoort te zien:** een grote foto van het gerecht, de naam volledig
      leesbaar, de kooktijd met een klokje erboven, en twee knoppen naast elkaar:
      **`Dit koken`** en **`Iets anders`**.

- [ ] **Wat je doet:** tik op **`Filters`** en open de lade.

- [ ] **Wat je hoort te zien — en dit is de eigenlijke test:** de lade schuift
      open en **niets overlapt**. De receptnaam loopt niet onder de lade door, de
      knoppen blijven zichtbaar en aanraakbaar, en de foto is **kleiner geworden**
      in plaats van dat de kaart doorschiet.

- [ ] **Wat het betekent als het anders is:**
      - **De naam verdwijnt half onder de lade** → dezelfde bug als op
        8 september, en de plafond-reparatie in `DecisionCard.tsx` werkt niet. Dit
        is het duurst geleerde ding van die dag: het hoogtebudget loopt dwars door
        de scheiding tussen foto en lade heen (de foto-agent rekende met de lade
        dicht op 73pt, open is hij 235pt).
      - **De foto blijft even groot en de knoppen vallen van het scherm** →
        `flexShrink` grijpt niet aan; de foto is nog steeds een vaste maat.
      - **De kaart is scrollbaar geworden** → Kiezen hoort één scherm te zijn.
      - **De lade opent boven de foto met een waas erachter** → dat is de bedoelde
        vorm, geen fout.

- [ ] **De filterbug die nog half open staat, zodat je hem herkent:** kies op
      Kiezen twee chips die niet samen voorkomen (bijvoorbeeld `visgerecht` en
      `veganistisch`). Je krijgt een **leeg resultaat**. In **Recepten** gebeurt
      dat niet — daar rekenen de chips zichzelf uit tegen wat de andere filters
      overlaten. Dit is bekend (GAP-33) en staat op de lijst; je hoeft er alleen
      niet van te schrikken.

- [ ] **De opening `Geavanceerd`** in Recepten: tik hem open. Verwacht `Wanneer?`
      en `Welke gang?`. Sluit hem weer en kijk of de lijst niet verspringt.

---

## 6. 200% tekstgrootte

Dit is de test met de grootste kans op een echte vondst, want de foto op Kiezen
heeft een vaste maat in **punten** en schaalt dus **niet** mee met de tekst. WS2
mat dat scherm vóór de foto er was al op 1011pt tegen een scherm van 852.

- [ ] **Wat je doet:** zet de tekst op het maximum.
      - iOS: Instellingen → Toegankelijkheid → Beeldscherm en tekstgrootte →
        Grotere tekst → **Grotere toegankelijkheidstekstgrootten** aan, schuif
        helemaal naar rechts.
      - Android: Instellingen → Weergave → Lettergrootte, helemaal naar rechts.

- [ ] **Wat je hoort te zien, per scherm:**
      - **Kiezen:** de naam van het gerecht kapt af met `…` in plaats van de
        knoppen weg te duwen. Beide knoppen blijven zichtbaar en aanraakbaar.
      - **Recepten:** de tegeltitels kappen op **twee regels**. De drie kolommen
        blijven drie kolommen.
      - **Vrienden:** de regel `2 gemeenschappelijke vrienden` past onder de naam
        zonder de knop `Toevoegen` van het scherm te duwen.
      - **Een recept:** de ingrediëntenlijst en de stappen blijven leesbaar en
        scrollbaar.

- [ ] **Wat het betekent als het anders is:**
      - **Een knop is niet meer te bereiken** → blokkerend. Iemand met grote tekst
        kan die actie niet uitvoeren. Noteer welk scherm en welke knop.
      - **Tekst loopt over tekst heen** → een vaste hoogte waar er een
        meegroeiende had moeten staan.
      - **Kiezen scrollt** → minder erg dan een onbereikbare knop, maar het scherm
        is ontworpen om er één te zijn. Noteer het.
      - **De foto op Kiezen blijft even groot terwijl alles eromheen groeit** →
        dat is verwacht en het is precies waarom dit onderdeel bestaat. De vraag
        is of het resultaat nog werkt, niet of de foto meegroeit.

- [ ] Zet de tekstgrootte terug voordat je verder gaat.

---

## 7. Als er tijd over is

Deze vier zijn geen nieuw werk maar staan al langer ongeverifieerd. Doe ze in
deze volgorde; de eerste is de goedkoopste.

- [ ] **De drie kolommen in Recepten.** WS2 wees ze destijds op meting af: een
      titel van vijf regels bedekte 85% van de foto. De titel is nu op twee regels
      gekapt. **Wat je beoordeelt:** is de foto nog herkenbaar genoeg om een
      recept aan te herkennen zonder de titel te lezen? Nee → de kap op twee
      regels was niet genoeg.

- [ ] **De importlimiet.** Doe 21 imports binnen tien minuten. De 21e hoort
      `import_throttled` terug te geven. Werkt dit niet, dan staat de poort open
      die op 2 september dichtgezet is.

- [ ] **De embed-probe**, via `exp://<lan-ip>:8081/--/dev-embed-probe`. TikTok en
      YouTube staan voorgevuld; Instagram en Facebook moet je zelf plakken, want
      Meta publiceert geen voorbeeldpost. ⚠ *"Document geladen"* vuurt **ook** voor
      een foutpagina — dus: tik op play, kijk of het inline blijft, en tik op een
      makersnaam om te zien of die naar de browser gaat in plaats van naar de
      TikTok-app.

- [ ] **Foto-import**, nooit end-to-end gedraaid. Maak een foto van een recept uit
      een kookboek en laat hem uitlezen. Twee aannames zitten hierin die niemand
      heeft nagemeten: dat `expo-image-picker` `base64` én `mimeType` levert, en
      dat Gemini deze `inlineData`-vorm accepteert. ⚠ Dit werkt **alleen tegen
      productie** — de edge-functie heeft `GEMINI_API_KEY` nodig en die staat niet
      op een lokale stack.

---

## 8. De ronde van 8 september 's avonds — het verzoek, de terugknop en Trending

Drie van je vier punten zijn gerepareerd; het vierde is een toestelvraag
geworden en staat hieronder als zodanig.

### 8a. Het vriendschapsverzoek — dit hoort nu gewoon te werken

- [ ] **Vrienden → `Zoeken op gebruikersnaam` → Fatima's rij → `Accepteren`.**

      **Wat je hoort te zien:** de rij verdwijnt uit `VERZOEKEN` en Fatima
      staat onder `VRIENDEN`. Is dit je eerste geaccepteerde vriendschap in
      dit huishouden, dan komt daarna éénmalig de deelvraag omhoog.

      **Wat het betekent als het anders is:** de reparatie zat in de
      statementvorm die de app naar Postgres stuurt, en die is tegen een
      lokale database met echte RLS bewezen — 403 vóór, 200 ná. Gebeurt er op
      je toestel nog steeds niets, dan is het **niet meer deze oorzaak**.
      Schrijf dan op of er bovenaan het scherm een rode zin staat: die melding
      rendert boven de `VERZOEKEN`-kop en kan buiten beeld staan als je naar
      de rij gescrold bent. Dat vermoeden is nooit op een scherm bevestigd, en
      dit is de meting die het beslist.

- [ ] **`Weigeren` op een verzoek**, en **een nieuw verzoek sturen** naar een
      handle die bestaat. Beide gingen mee in dezelfde reparatie; het nieuwe
      verzoek werkte altijd al en is hier de regressietest.

### 8b. De terugknop — dit is een MEETING, geen reparatie

⚠ **De oorzaak van jouw melding is niet gevonden.** Vier verklaringen zijn
nagemeten en afgevallen, waaronder de twee die het meest voor de hand lagen:
de knop was al 44 × 44 pt (de norm) en de veilige zone wordt wél toegepast.
Wat er is gedaan is het raakvlak vergroten en een bekende opstartfout in de
insets dichten — geen van beide is een diagnose, en de code zegt dat zelf.

- [ ] **Tik `Terug` op `/friends/add` meteen nadat het scherm verschijnt**, en
      nog eens na een seconde wachten. Doe dat vijf keer.

      **Wat je hoort te zien:** je gaat terug naar Vrienden, elke keer.

      **Wat het betekent als het anders is:** noteer of het misgaat bij de
      snelle tik of ook bij de rustige. Alleen bij de snelle → het zit in de
      opstartinsets. Ook bij de rustige → het is iets anders, en dan is de
      volgende meting 8c.

- [ ] **⚠ DE BELANGRIJKSTE METING VAN DEZE SECTIE — 8c.** Doe precies
      hetzelfde op **Mijn recepten → een recept → `Terug`**, op
      **Instellingen → `Sluiten`**, en op **importeren → `Annuleren`**.

      **Waarom:** die drie rijen zijn byte voor byte dezelfde rij als die op
      `/friends/add` — zelfde padding, zelfde 44pt-vloer, zelfde plek. **Is
      het raakvlak de oorzaak, dan mankeren die drie het net zo goed.**
      Mankeert alléén `/friends/add`, dan ligt het aan iets dat uniek is aan
      dát scherm en niet aan de knop, en dat is een heel ander onderzoek.

      Dit is de goedkoopste meting in dit document met het grootste gevolg,
      precies zoals onderdeel 1 dat voor Android is.

- [ ] **De knop staat NIET lager.** Je stelde dat zelf voor. Het is bewust
      niet gedaan zolang de oorzaak onbekend is — verplaatsen zou een pleister
      zijn en dan weten we nooit wat het was. Vind je hem na 8b en 8c nog
      steeds slecht bereikbaar, dan is "lager" alsnog een prima antwoord; zeg
      het, en het gebeurt.

### 8d. Trending — de scrollfeed

- [ ] **Trending, scope `Iedereen`.**

      **Wat je hoort te zien:** **precies drie kaarten**, in deze volgorde —
      *Kip uit de oven met citroen* (8,04), *Romige pasta met spinazie*
      (7,98), *Rode linzensoep* (7,66) — met onderaan *"Dat is de hele
      lijst."*

      ⚠ **Drie is het goede getal en geen bug.** Alleen die drie halen de
      ondergrens van drie stemmen. En de volgorde is bewust niet het rauwe
      gemiddelde: de pasta heeft het hoogste gemiddelde en de kip staat toch
      boven, omdat een cijfer naar het populatiegemiddelde geschaald wordt
      naar hoeveel bewijs eronder ligt.

      ⚠ **Drie kaarten is ook niet de Instagram-ervaring die je beschreef**,
      en dat is een beslissing die bij jou ligt. Zie 8f.

- [ ] **⚠ Elke kaart toont een MONOGRAM en geen foto. Dat is goed gedrag.**

      De acht demo-recepten hebben geen thumbnail, en dat is niet eerlijk te
      repareren: die URL's zijn kortlevend en ondertekend, en de
      licentievoorwaarden staan lezen wel toe en kopiëren niet. **Wil je echte
      foto's zien, importeer dan één echt TikTok- of Instagram-recept** — die
      vult de thumbnail wél. Dat is meteen de enige manier om te zien of de
      kaart klopt mét een foto erop.

- [ ] **Het filter.** Open de lade, kies een gerechttag, kijk of het aantal
      kaarten klopt met wat je koos, en tik `Wissen`.

      ⚠ **Een tijdcap van 20 minuten maakt de feed leeg.** De drie recepten
      duren 45, 25 en 30 minuten. Een lege feed mét een gezet filter is
      correct gedrag en geen fout — maar kijk of het scherm dát ook zegt, in
      plaats van te lijken alsof er niets geladen is.

- [ ] **Tik op een kaart.** Er gebeurt niets, en dat is bekend en
      opgeschreven. Zie 8f.

- [ ] **Schakel naar scope `Vrienden`.**

      ⚠ **Dan zie je de OUDE compacte rijen, niet de nieuwe kaarten.** Dat is
      bekend, staat in de code opgeschreven, en is de hoogste-waarde
      vervolgstap. Kijk of het je stoort — dat oordeel bepaalt of het de
      volgende ronde in gaat.

### 8f. Twee dingen waar alleen jij over gaat

- [ ] **Hoe diep mag de feed?** De ondergrens van drie stemmen houdt de lijst
      nu op drie kaarten. Verlagen geeft je meer om doorheen te scrollen en
      maakt de ranglijst minder waar — één stem is dan al genoeg om mee te
      doen. Niemand heeft dat voor je besloten.

- [ ] **Waar moet een tik heen?** Er bestaat vandaag geen scherm dat een
      recept van iemand anders toont, en er is ook geen pad dat er een kopie
      van in jouw lijst zet. De eerlijke bestemming is *"Bewaren"*, en dat is
      een eigen bouwronde. Het alternatief — de tik opent het bronbericht in
      TikTok — is één regel en leidt de app uit.

---

## Afronden

Schrijf per bevinding drie regels op: **welk scherm**, **wat je zag**, **wat je
verwachtte**. Dat is genoeg om er de volgende ronde iets mee te doen, en het is
minder werk dan een verhaal.

Twee dingen zijn na deze zitting anders dan ervoor, en beide zijn de moeite:

1. **Je weet of Android start.** Dat is vandaag een aanname uit broncode.
2. **Je hebt de suggesties met echte data gezien.** Niets aan
   `suggested_friends()` is testbaar zonder een JWT — een SQL-editor draait als
   `postgres` en krijgt nul rijen terug, wat eruitziet als een defect terwijl het
   de beveiliging is die werkt. Een toestel is de enige plek waar die functie
   bestaat.
