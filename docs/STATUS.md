# Status

Waar Remy staat en wat er nu gebeurt. **Eén pagina, en hij wordt bijgewerkt in
plaats van aangevuld** — dit document heeft geen geschiedenis; die staat in
`git log` en in `docs/archief/`.

**Laatst gemeten: 12 september 2026.** Branch `feat/live-import-and-plan-phases`.

---

## De stand

| | |
|---|---|
| **Poorten** | Alle vijf groen: typecheck 0, lint 0, `check:functions` 0, `check:seed` 0, **3815 tests over 160 bestanden** |
| **Database** | Migraties **`0001` t/m `0022`**, `local` en `remote` gelijk. Er staat niets klaar dat nog gedraaid moet worden. |
| **Werkmap** | Schoon. Er ligt geen ongecommit werk en niets staat half geschreven. |
| **Backlog** | 91 af, **25 open**, 15 geblokkeerd op een beslissing, **7 halverwege**, 5 afgewogen, 2 afgewezen. Gedefinieerd in `LONGLIST.md`. |
| **Op een toestel gezien** | Het meeste wel, sinds 9 september. Wat sindsdien gebouwd is niet — zie punt 1 hieronder. |

**Wat er de laatste ronde landde:** Ontdek fase 0, 1 en 2 (de sociale graaf werd
gericht, de twee sociale tabs werden één scherm met een feed en een explore),
daarna de vormwijziging waardoor beide kanten dezelfde kaart tekenen, en
tenslotte het spoor daarvan — ONT-06 (de demo-teardown liet de graaf staan),
ONT-08 (de tap op explore's kaart) en ONT-07 (gesloten als bewaard).

---

## Wat nu, op volgorde

### 1. De app op een toestel, en er doorheen lopen — dit is van de eigenaar

```bash
npm run start:log     # niet `npx expo start`: zo is de Metro-log achteraf leesbaar
```

Dubbel zoveel waard als het lijkt. Sinds de sprong van SDK 51 naar 57 draait de
app op de **nieuwe React Native-architectuur**, en `Animated`, `expo-haptics` en
safe-area zitten daardoor op een ander renderpad. **Geen enkele poort kan dat
zien** — het blijkt op een toestel of nergens.

Neem mee in dezelfde zitting:

- **Eén echte import door de flow.** Het is de enige manier om een foto op
  explore te zien: de demo-seed kan er geen krijgen, want oEmbed-URL's zijn
  kortlevend en ondertekend en kopiëren mag niet (PD-007).
- **De throttle-test.** 21 imports binnen tien minuten; de 21e hoort
  `import_throttled` te geven.
- **De drie sociale schermen**, die sinds fase 2 grondig veranderd zijn en die
  nog niemand op een scherm heeft gezien.

⚠ **Draai `supabase/seed/demo_social_teardown.sql` vóórdat er echte vrienden op
de app komen.** `suggested_friends()` leest `recipe_ratings` globaal, dus drie
demo-profielen verschijnen bij elke tester in "Misschien ken je".

~~En: draaide je die teardown op 11 september overdag, draai hem dan opnieuw —
hij was toen stuk en liet de dertien demo-volgrelaties staan.~~ **Dat was
onjuist, en het is op 12 september nagemeten.** De oude teardown liet niets
staan: `follows` hangt met `on delete cascade` aan `profiles`, dus de
volgrelaties verdwenen mee met de profielen. Wat er wél mis was is kleiner en
nog steeds echt — de controlequery telde `follows` en `blocks` niet, dus je kon
niet zíén of het gelukt was, en of het lukte hing aan een cascade in een andere
migratie. Beide tellingen staan er nu, en de teardown is lokaal **gedraaid**:
twaalf tabellen, alle nul.

De oude checklist staat in `docs/archief/TOESTELTEST.md`. Hij is geschreven voor
het werk van 4 tot 8 september, dus loop hem na op wat er sindsdien bij kwam.

### 2. `GEMINI_MODEL` pinnen — één secret, geen code (IMP-05)

`callExtractionModel.ts` valt vandaag terug op `gemini-3.6-flash`, een
**zwevende alias**. Verschuift die alias, dan faalt de extractie als
`llm_request_failed` — dezelfde emmer als een facturatiestoring, en in niets wat
je kunt tellen daarvan te onderscheiden. Zet `GEMINI_MODEL` in de
Supabase-secrets op een gedateerde snapshot.

### 3. Ontdek fase 3 — zoeken op ingrediënt en receptnaam

De volgende echte bouwronde. Eén zoekbalk bovenaan Ontdek over de twee assen
waarvan de tabellen al wereldleesbaar zijn voor ingelogde lezers. De
ingrediënt-matcher bestaat al (GAP-34); nieuw is één serverlees met een plafond.
`docs/ONTDEK-PLAN.md` fase 3 heeft de opzet inclusief de drie risico's — waarvan
het scherpste is dat een zoekresultaat een recept kan zijn dat niemand beoordeeld
heeft, en **wat zo'n kaart dan toont is nog niet ontworpen.**

### 4. De vijf die Ontdek bewust liet liggen — ONT-01 t/m ONT-05

Elk met de reden erbij in `LONGLIST.md`. De twee met de meeste hefboom:

- **ONT-04** — `friendships` droppen. Sinds `0021` is die tabel een bevroren
  kopie naast `follows`, en niets houdt de twee in de pas. Twee tabellen die
  hetzelfde beweren en uiteenlopen, is een houdbaarheidsdatum.
- **ONT-05** — de closed-loop rate werkelijk uitlezen. `saves.origin` is er,
  `isSocialSaveOrigin` is er, en er is nog geen enkele lezer. ⚠ `saves` is
  vandaag local-only.

### 5. De zeven die halverwege staan

⚠ **Deze regel is er op 12 september bij gekomen omdat de telling fout was.**
Er stond hier "niets staat halverwege" — overgenomen uit een zin in `LONGLIST.md`
die over de *werkmap* ging, niet over de *backlog*. Er stonden er acht op 🟡 —
"domeinlaag af, geen scherm of geen aanroeper" — en na GAP-32 zijn het er zeven.
Dat is niet erg, maar het is wél werk dat niemand ziet:

| | Wat er ligt zonder aanroeper |
|---|---|
| `GAP-12`, `GAP-14` | De twee inlogroutes naast het wachtwoord: link en zescijferige code. Gebouwd en getest; de code wacht op een mailserver (zie `ARCHITECTURE.md`). |
| `GAP-53` | De terugknop op `/friends/add` reageert soms niet, en de oorzaak is nooit gevonden — de reparatie die er staat is de `canGoBack()`-vorm. Vraagt een meting op een toestel, dus hoort bij punt 1. |
| ~~`GAP-32`~~ | ✅ **Af op 12 september.** Een verzonden recept credite niemand — `buildLiveSentSharedRecipe` gaf hardgecodeerd geen attributie, en daarmee ook geen link naar de oorspronkelijke post. `SentMeal.creator` leest die nu van de canonieke rij; geen migratie, geen nieuwe rechten. |
| `GAP-02` | Wacht op open vraag A. |
| `GAP-11`, `GAP-18`, `OPS-09` | Onderhoud: onvolledige tellingen in commentaar, WS1-onderdelen die nooit tegen de code gehouden zijn, en de tweede helft van Deno's resolutieregel. |

### 6. De rest van de backlog

`PRF-03`, `RCP-04`, `LIB-05`, `ENT-04`, `ENT-06`, `SRC-07` — kleiner, geen van
alle geblokkeerd. Zie `LONGLIST.md`.

---

## Wat op een beslissing van de eigenaar wacht

Geen van deze blokkeert punt 1 t/m 5 hierboven. De volledige uitwerking staat in
`PRODUCT-DECISIONS.md` onder *Open vragen*.

| | Vraag | Wat het kost dat hij open staat |
|---|---|---|
| **A** | Mag een webpagina een canonieke receptrij hebben? (GAP-02) | Het duurst. Een populair blogrecept is één URL die veel huishoudens delen — juist de route die het meest aan de cache zou hebben, en hij is uitgesloten. Ook geen kookbewijs. |
| **K** | Hoe diep mag de feed op explore? (`LEADERBOARD_MIN_VOTES = 3`) | Op de demo-data is explore drie kaarten diep. De vloer verlagen maakt de ranglijst minder waar. |
| **D–H** | Betaalgrens, voedingswaarden, groeperen, supermarkt, Engelse vertaling | Blokkeren BSK-04/05/06, RCP-02, LIB-02, OPS-03 en BIZ-01/03. |

**En het meten is begonnen.** De eigenaar vroeg erom — *"Ik wil door en door
begrijpen wat mensen gebruiken en wat niet"* — en laag 1 van het plan staat nu
als één draaibaar bestand in **`supabase/meting/laag1-nulmeting.sql`**. Alle 21
queries zijn op 12 september tegen een lokale stack gedraaid, exit 0; dat was het
grootste openstaande punt van het plan, dat van zichzelf zei dat geen enkele
query ooit was uitgevoerd.

**Wat er nog van jou is:** plak dat bestand in de SQL-editor van het dashboard en
draai het één keer als nulmeting tegen productie. Alles erin is een `select`.
Noteer erbij of de demo-seed er op dat moment in zat. Laag 2 — een eigen
eventtabel — begint pas ná de vriendentest, en alleen voor vragen waarvan laag 1
aantoont dat ze daar niet te beantwoorden zijn.

---

## Waar de rest staat

`README.md` heeft de volledige kaart. Kort:

- **Bouwen?** → `CLAUDE.md` voor de werkafspraken, `LONGLIST.md` voor de code die
  bij je taak hoort.
- **Waarom is dit zo?** → `PRODUCT-DECISIONS.md` (de besluiten), `DESIGN.md` en
  `DESIGN-SOCIAL.md` (schermen en de sociale weigeringen), `ARCHITECTURE.md`
  (datamodel en RLS).
- **Wat ging hieraan vooraf?** → `docs/archief/`, met een index die per bestand
  zegt waarom het dicht is.
