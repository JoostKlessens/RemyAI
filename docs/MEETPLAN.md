# Meetplan — wat mensen gebruiken, en hoe we dat weten

De eigenaar, 8 september 2026: *"Ik wil ook een plan gaan opstellen voor hoe we
de feature performance kunnen gaan meten. Ik wil namelijk door en door
begrijpen wat mensen gebruiken en wat niet."*

Dit document beantwoordt die vraag in twee lagen met een harde regel ertussen,
en het begint met een vondst die de vorm van het plan bepaalt. Er wordt hier
**niets geïmplementeerd**: geen tabel, geen migratie, geen trackingcode, geen
pakket. Het is een plan, en het is met opzet een plan, omdat er op dit moment
ongetest werk in de boom ligt (`0019` is nooit gedraaid, het suggestieblok is
nooit op een scherm gezien) en er in deze repo niet op ongetest werk gebouwd
wordt.

Alle SQL hieronder is tegen het echte schema nagelopen — `0001` t/m `0019`,
kolom voor kolom. **Geen enkele query is tegen een draaiende Postgres
uitgevoerd**, want die staat niet op deze machine. Dat onderscheid staat er
omdat het in dit project al eerder tijd heeft gekost: nagelopen is niet
gedraaid.

---

## De vondst die dit plan vormgeeft: het meeste staat niet in Postgres

De premisse waarmee dit plan begon was *"de database is al een event log"*.
Dat is voor de helft waar, en de andere helft is het belangrijkste dat in dit
document staat.

**Remy's bron van waarheid is AsyncStorage op het toestel.**
`src/lib/repository/localRepository.ts` zegt het in zijn eigen kop, en
`src/lib/repository/mirror/types.ts` somt op wat er wél naar Postgres gaat:

> "VIJF TARGETS, EN DE LIJST IS DELIBERATELY SHORT. `meals`,
> `meal_ingredients`, `meal_steps`, `cook_events` — exactly what the social
> surfaces read — plus ONE COLUMN of `households`,
> `share_cooks_with_friends`. Saves, decisions, members and restrictions stay
> local."

Dat is geen omissie maar een beslissing met een reden: `member_restrictions`
is Artikel 9-gezondheidsdata (PD-005), en de spiegel is bewust smal gehouden
tot precies de rijen die een ánder huishouden moet kunnen lezen.

Wat dat voor meten betekent, per tabel:

| Tabel | Staat in Postgres? | Wie schrijft hem |
|---|---|---|
| `profiles` | ja | client, bij `/claim-handle` (`src/lib/auth.ts:325`) |
| `households` | ja | `ensureRemoteHousehold.ts` (insert); de spiegel raakt alleen `share_cooks_with_friends` |
| `household_members` | ja | `ensureRemoteHousehold.ts` |
| `meals` | ja | write-through spiegel |
| `meal_ingredients`, `meal_steps` | ja | write-through spiegel |
| `cook_events` | ja | write-through spiegel — ⚠ `decision_id` is **altijd null** |
| `recipes`, `recipe_ingredients`, `recipe_steps` | ja | edge functie `parse-recipe`, service role |
| `recipe_ratings` | ja | client (de openbare stem) |
| `recipe_shares` | ja | client (het pannetje) |
| `friendships` | ja | client |
| `import_attempts` | ja, **48 uur** | edge functie; daarna weg via pg_cron (`0013`) |
| `saves` | **NEE** | alleen AsyncStorage |
| `decisions` | **NEE** | alleen AsyncStorage |
| `decision_alternatives` | **NEE** | wordt nergens geschreven, ook lokaal niet |
| `member_restrictions` | **NEE** | alleen AsyncStorage, met opzet (PD-005) |
| `vetoes`, `push_tokens` | **NEE** | geen schrijver in de app |
| `creators`, `feed_items` | **NEE** | de Feed is nooit gebouwd |

⚠ **Dit haalt de middenmoot uit de save-to-cook-trechter.** "Bewaard met welke
intentie" (`saves.intent`), "aangeboden op Kiezen" (`decisions`) en "gekozen"
(`decisions.status`) leven op de telefoon en nergens anders. Ze zijn met SQL
niet te beantwoorden — vandaag niet en na `0019` ook niet.

⚠ **En `cook_events.decision_id` is remote altijd null.**
`src/lib/repository/mirror/rows.ts` typeert die kolom letterlijk als `null`,
omdat de rij waarnaar hij zou verwijzen nooit naar Postgres gaat. De join
"welke aanbeveling werd deze maaltijd" bestaat dus wel in het schema en nooit
in de data.

⚠ **De spiegel is best-effort en asynchroon.** `localRepository.ts`: *"nothing
below awaits the sink, and nothing below lets it fail a write."* Er is een
duurzame outbox met herhaling (`mirror/outbox.ts`), dus een rij raakt zelden
kwijt — maar een telefoon die offline blijft levert niets, en "de rij staat in
Postgres" loopt altijd achter op "de rij is geschreven". Bij een test met vijf
vrienden is dat verschil klein maar niet nul: een ontbrekende rij is geen
bewijs dat er niet gekookt is.

**Wat wél overeind blijft is de belangrijkste metriek die dit product heeft.**
PD-004 noemt save-to-cook-conversie binnen 14 dagen als de enige succesmaat
van de Feed, en `0001` legde daar zelfs een index voor aan (`idx_saves_meal`,
met PD-004 bij naam in het commentaar). Die index wijst naar `saves`, die niet
spiegelt — maar de conversie zelf is óók te meten over `meals` →
`cook_events`, en die twee staan er allebei wel. Zie
[De trechter](#de-save-to-cook-trechter-stap-voor-stap).

---

## De twee lagen, en de regel ertussen

**Laag 1 — SQL over wat er al staat.** Beschikbaar vandaag, zonder één regel
nieuwe code, zonder migratie, zonder externe verwerker. Verreweg de meeste
vragen horen hier thuis, en elke vraag moet hier eerst geprobeerd zijn.

**Laag 2 — een kleine, gesloten set eigen events**, weggeschreven naar een
eigen Postgres-tabel, **alleen** voor vragen waarvan in laag 1 is aangetoond
dat ze daar niet te beantwoorden zijn.

**De regel ertussen, en hij is hard:**

> **Elk event hangt aan een vooraf opgeschreven vraag.** De vraag staat in de
> tabelcomment naast het event. Geen autocapture. Geen "alles vastleggen en
> later kijken". Een event waarvan de vraag beantwoord of vervallen is, gaat
> weg — dat is een opruiming en geen verlies.

De reden dat die regel er staat, staat al in deze codebase, in de kop van
`src/domain/import/importTelemetry.ts`:

> "telemetry is the classic way an app stops obeying that instruction without
> ever deciding to — nobody ever resolves to log a user's diet; somebody adds
> a `context` field to an event for debugging, and eighteen months later the
> log sink holds a searchable record of what every household eats."

Autocapture is precies de vorm die die zin beschrijft, met de knop al
omgezet.

---

## Regel nul: demo-data telt niet mee

`supabase/seed/demo_social.sql` schrijft nepdata in **negen tabellen plus
`auth.users`**: `profiles`, `friendships`, `recipes`, `households`,
`household_members`, `meals`, `cook_events`, `recipe_ratings`,
`recipe_shares`. Elke id die het bestand aanmaakt begint met `5eed5eed`.

**Elke query in dit document sluit die rijen uit, en elke nieuwe query moet
dat ook doen.** Acht recepten, zes kookgebeurtenissen en achttien stemmen
klinken als ruis tot je bedenkt dat de eerste vriendentest er misschien
veertig van elk oplevert. Een meting die de demo meetelt liegt dan niet een
beetje maar met factor twee, en ze liegt het hardst over precies de tabellen
waar het om gaat.

**De regel heeft twee helften.**

```sql
-- (a) altijd: filter de rij op zijn eigen id
where id::text not like '5eed5eed%'

-- (b) gaat de vraag over een huishouden of een persoon: filter die sleutel ook
  and household_id::text not like '5eed5eed%'
```

(b) is niet overbodig. De demo maakt echte vriendschappen tussen jóuw profiel
en `demo_sanne`, en niets houdt tegen dat je een recept écht naar een
demo-profiel stuurt of écht op een demo-recept stemt. Zo'n rij heeft een echte
id en overleeft filter (a). Filter op de sleutel waar de vraag over gaat.

⚠ **De demo verandert niet alleen de tellingen, hij verandert wat de app
doet.** `suggested_friends()` (`0019`) bouwt zijn kandidatenpool uit twee
verzamelingen, en de tweede leest `recipe_ratings` **globaal, over alle
stemmen**. Elke echte tester die nog geen `friendships`-rij met een
demo-profiel heeft, krijgt dat profiel dus in "Misschien ken je" te zien. Dat
is geen bug in `0019`; het is de seed die zijn werk doet op een scherm waar
hij niet voor bedoeld was.

**Het zijn er drie, niet zeven.** Deze paragraaf zei "alle zeven
demo-profielen" en dat klopte op het moment van schrijven; `0019` kreeg die
middag een ondergrens van drie stemmen op de activiteitspool (commit
`463bb53`). Nageteld in de seed: Sanne 4, Bram 4, Daan 6 — die drie halen de
drempel. Fatima, Noor, Youssef en Tessa hebben er één en vallen af, tenzij ze
via een gedeelde vriend binnenkomen.

Drie verzonnen mensen in het eerste sociale scherm dat je testers zien is nog
steeds drie te veel. **Haal de demo weg vóór de vriendentest**
(`demo_social_teardown.sql`).

⚠ **Twee views geven in de SQL-editor altijd nul terug, en dat is geen
defect.** `shared_cooks` (`0009`) en `namable_recipe_votes` (`0016`) gaten op
`auth.uid()` respectievelijk `is_friend_of()`. De editor draait als
`postgres` zonder JWT. **Meet nooit tegen die twee views** — meet tegen de
basistabellen (`cook_events`, `recipe_ratings`) en pas het beleid in je hoofd
toe. Hetzelfde geldt voor `suggested_friends()`; HANDOVER.md waarschuwt daar
al voor bij de controlequery van de seed.

`import_attempts` heeft geen demo-rijen — de seed raakt hem niet aan. Een
filter is daar overbodig maar schaadt niet.

---

## De vijf vragen voor de eerste vriendentest

Dit is de belangrijkste sectie van het document, en niet omdat de vragen zo
bijzonder zijn. Het gaat om het onderscheid: bij **n≈5** is een groot deel van
wat je normaal meet niet zwak maar *betekenisloos*, en het gevaar is niet dat
je het niet weet — het is dat je een percentage uitrekent, het gelooft, en er
een beslissing op neemt.

### Wat bij n=5 betekenisloos is

**Elk percentage.** 3 van de 5 is 60%, 4 van de 5 is 80%, en het verschil is
één persoon die iets anders deed. **Rapporteer aantallen, nooit
verhoudingen.** Dit is de enige discipline van deze hele test die je op elke
regel van elk verslag moet volhouden.

**De 14-daagse save-to-cook-conversie.** Twee redenen tegelijk. Een recept dat
drie dagen geleden binnenkwam kán nog geen veertien dagen oud zijn, dus je
noemer moet een gesloten cohort zijn — en een gesloten cohort van veertien
dagen bestaat in week één van de test niet. En de teller is dan zes. Meet hem
wél, maar schrijf hem op als paren: *"van de negen recepten die Bram bewaarde
zijn er drie gekookt, na 4, 6 en 11 dagen"*. Dat is dezelfde informatie zonder
de valse precisie.

**Retentie, dagelijks actieven, sessieduur.** PD-004 verbiedt ze al als doel
(zie hieronder), en bij vijf vrienden meten ze bovendien iets anders dan ze
lijken te meten: of je vrienden de app openden toen je het ze vroeg.

**Alles wat op een A/B-test lijkt.** Daar heb je honderden per arm voor nodig.

**Gemiddelde cijfers.** Het gemiddelde van vier beoordelingen op een schaal
van 1,0 tot 10,0 heeft een spreiding die groter is dan het verschil dat je
ermee zou willen zien.

**Alles over de sociale grafiek.** Vijf mensen die elkaar allemaal kennen
vormen geen netwerk, en "Misschien ken je" heeft dan niets te suggereren
behalve de demo-profielen.

### De vijf vragen die wél iets opleveren

**1. Komt er überhaupt iets binnen?**
Per huishouden: hoeveel recepten zijn er geïmporteerd, en wanneer het laatst.
Een nul is het luidste signaal dat deze test kan geven en heeft geen enkele
statistiek nodig.

**2. Wordt er uit de app gekookt?**
Kookgebeurtenissen per huishouden per week. Nul of één is betekenisvol; het
verschil tussen drie en vier is dat niet.

**3. Welke bron werkt en welke breekt?**
Per platform: geplakt versus geëxtraheerd. Bij ~40 imports is "TikTok faalde
vijf van de vijf keer" een feit en "web faalde één van de acht" ruis.

**4. Blijft er iets liggen?**
Recepten die er staan en nooit gekookt zijn, met hun leeftijd. Dit is precies
het kerkhof dat PD-004a bestaat om te voorkomen. Bij n=5 kun je de titels
letterlijk oplezen en het aan de persoon vragen — wat honderd keer meer
oplevert dan het getal.

**5. Wat ging er stuk?**
Geen metriek maar een lijst. Lege schermen, mislukte imports, spiegelrijen die
niet aankwamen. Bij deze schaal is de defectenlijst het waardevolste product
van de test, en die komt uit vragen en uit de edge-functielogs, niet uit SQL.

**Wat je bij vijf vrienden vooral moet doen is met ze praten.** De SQL
hieronder is er om het gesprek te richten — "je hebt zes dingen bewaard en er
één gekookt, hoe kwam dat?" is een betere vraag dan een open vraag — en niet
om het gesprek te vervangen. Elk cijfer in dit document is bij n=5 een
gespreksopener.

---

## Wat dit product niet meet, en waarom dat een keuze is

PD-004, letterlijk:

> "Session length, scroll depth, and time-in-app are explicitly **not** goals
> and must not be optimised for, A/B tested toward, or reported as success.
> [...] If dwell time rises while cook rate does not, the Feed is working as
> entertainment and gets cut back, not expanded."

Dat is geen smaak maar een these over hoe dit soort producten doodgaan, en het
meetplan moet hem dragen in plaats van hem te ondermijnen. Concreet:

- **Geen DAU/WAU/MAU als hoofdmaat.** De kernmetriek is save-to-cook. Een
  huishouden dat één keer per week opent en kookt is een succes; een
  huishouden dat dagelijks scrollt en nooit kookt is de faalmodus.
- **Geen sessieduur, geen scrolldiepte, geen tijd-in-app.** Ook niet "gewoon
  om te weten". Een getal dat op een dashboard staat wordt vroeg of laat een
  getal dat iemand omhoog wil hebben.
- **Geen streaks, geen trofeeën, geen leesbevestigingen.** DESIGN-SOCIAL.md §0
  wijst die economie expliciet af, en `0009` bouwt dat structureel in: de
  `shared_cooks`-view heeft twee kolommen en geen tijdstip, *"a timestamp
  turns proof into a feed with recency, a count turns it into a leaderboard of
  your friends' kitchens"*.
- ⚠ **`recipe_shares.seen_at` bestaat en mag als metriek gebruikt worden, maar
  nooit als product.** DESIGN-SOCIAL.md §3.2: het is geen leesbevestiging en
  wordt de afzender nooit getoond. Geaggregeerd achter in Postgres kijken hoe
  vaak een verstuurd recept geopend wordt is een meting; datzelfde getal per
  zending aan de afzender tonen is een leesbevestiging. De grens loopt tussen
  die twee zinnen en niet tussen twee kolommen.

**Wat dit plan in plaats daarvan als hoofdmaat neemt:** binnengekomen →
bewaard → gekookt → beoordeeld, per huishouden, in absolute aantallen.

---

## Laag 1 — SQL over wat er vandaag al staat

Alle queries hieronder draaien in de Supabase SQL-editor. Ze lezen en wijzigen
niets.

### De save-to-cook-trechter, stap voor stap

De volledige trechter uit de vraagstelling is: **link geplakt → import gelukt →
bewaard → aangeboden op Kiezen → gekozen → gekookt → beoordeeld.** Hieronder
per stap welke tabel het antwoord draagt, óf hij het draagt, en de query.

#### Stap 1 — link geplakt

**Tabel:** `import_attempts` (`0012`).
**Kolommen:** `caller_fingerprint`, `household_id` (nullable), `platform`,
`cost_units`, `attempted_at`.

```sql
-- Wat is er de afgelopen 48 uur geprobeerd, per platform?
select
  platform,
  count(*)                            as pogingen,
  sum(cost_units)                     as modelaanroepen,
  count(distinct caller_fingerprint)  as bellers,
  count(distinct household_id)        as huishoudens
from public.import_attempts
where attempted_at > now() - interval '48 hours'
group by platform
order by pogingen desc;
```

⚠ **Deze tabel draagt veel minder dan zijn naam belooft, en dat is met
opzet.** Hij heeft **geen uitkomstkolom**: een gelukte en een mislukte import
zijn hier dezelfde rij. Hij heeft geen url, geen titel, geen tekst — `0012`
noemt dat *"a structural guarantee rather than a promise to be careful: there
is no column any of it could go in"*. En hij wordt **na 48 uur gewist** door
een pg_cron-taak uit `0013`. Er is dus geen geschiedenis, ook niet van
eergisteren.

Het is een throttleteller die toevallig ook verkeer telt, en meer moet je er
niet van maken. **De vraag "waar mislukt import?" is hier niet te
beantwoorden.** Zie [Wat laag 1 niet kan](#wat-laag-1-niet-kan).

#### Stap 2 — import gelukt

**Tabel:** `recipes` (`0006`, verbreed in `0011`).
Een rij ontstaat alleen wanneer een volledig gevalideerd recept uit de
pijplijn kwam: `finishImport.ts` roept `storeCanonicalRecipe` pas aan nadat
elke faalroute al is teruggekeerd.

```sql
-- Welke platforms leveren daadwerkelijk een extractie op?
select
  platform,
  count(*)              as recepten,
  min(created_at)::date as eerste,
  max(created_at)::date as laatste
from public.recipes
where id::text not like '5eed5eed%'
group by platform
order by recepten desc;
```

⚠ **Drie beperkingen, alle drie structureel.**

1. **Gededupliceerd op `normalized_url`.** De upsert is
   `on_conflict=normalized_url` met `resolution=ignore-duplicates`, dus een
   tweede import van dezelfde link maakt géén rij. Dit telt *unieke gelukte
   url's*, niet *gelukte imports*.
2. **Alleen `tiktok`, `instagram`, `youtube`.** `canStoreCanonicalRecipe()`
   weigert `web`, `text` en `photo` — die hebben geen url om een canonieke
   rij op te sleutelen. Een gelukte web- of foto-import laat hier **geen
   spoor** achter; zijn enige spoor is de `meals`-rij van stap 3.
3. **Geen huishouden.** `recipes` is canoniek en globaal. "Wie importeerde
   dit" bestaat niet als kolom — DESIGN-SOCIAL.md §4.5 en `0019` leunen daar
   allebei op.

#### Stap 3 — bewaard

**Tabel:** `meals` (`0001` + `0006`'s `recipe_id`). Dit is de eerste stap die
per huishouden meetbaar is.

```sql
-- Wat staat er per huishouden, en hoe kwam het binnen?
select
  m.household_id,
  count(*)                                          as recepten_totaal,
  count(*) filter (where m.recipe_id is not null)   as geimporteerd,
  count(*) filter (where m.recipe_id is null)       as handmatig_of_geseed,
  count(*) filter (where m.archived_at is not null) as verwijderd,
  min(m.created_at)::date                           as eerste,
  max(m.created_at)::date                           as laatste
from public.meals m
where m.id::text           not like '5eed5eed%'
  and m.household_id::text not like '5eed5eed%'
group by m.household_id
order by recepten_totaal desc;
```

⚠ **`meals.source` is een grovere as dan hij lijkt.** De check staat op
`('seeded', 'saved', 'curated')`; een geïmporteerd recept is `'saved'`, net
als een handmatig ingevoerd gerecht. Wil je "kwam dit uit een import", gebruik
`recipe_id is not null` en niet `source`.

⚠ **`meals.source_platform` is de legacy-woordenlijst uit `0001`**:
`('tiktok', 'reels')`. `recipes.platform` spreekt `('tiktok', 'instagram',
'youtube')`. Wil je per platform meten, join dan op `recipes` en lees
`recipes.platform` — `0006` legt in de kolomcomment uit waarom die twee
bewust niet dezelfde vocabulaire delen.

⚠ **De opslag-intentie is hier niet te vinden.** PD-004a's twee opties (`Deze
week` / `Ooit`) staan in `saves.intent`, en `saves` spiegelt niet. Of iemand
bewaart om vanavond te koken of om ooit te koken, weet Postgres niet.

#### Stap 4 — aangeboden op Kiezen

**Tabel:** `decisions` (`0001`). **Niet in Postgres.**

De rij wordt geschreven door `createTodayDecisionIfSuggested` in
`src/app/(tabs)/index.tsx:309`, met `meal_id`, `initial_meal_id`,
`reason_code` en `reason_text` — precies de kolommen die `0001` aanlegde om
"minstens 40% accepteert de eerste suggestie" te kunnen meten, met dat doel
letterlijk in het commentaar. Die rij blijft op het toestel.

**Er is geen SQL-benadering die dit vervangt.** De enige remote sporen zijn
`cook_events`, en die weten niet of ze uit Kiezen of uit de bibliotheek komen
(`decision_id` is altijd null). Dit is een laag-2-vraag, of een vraag die je
op een toestel stelt.

#### Stap 5 — gekozen

**Tabel:** `decisions.status` (`'pending' | 'accepted' | 'swapped' |
'skipped'`) en de vergelijking `meal_id = initial_meal_id`. **Niet in
Postgres**, om dezelfde reden.

⚠ Merk op dat `respondToDecision(..., { status: 'skipped' })` sinds PD-021
geen aanroeper meer heeft — "Niet koken" is van Kiezen verdwenen. Ook lokaal
is de statusverdeling dus niet meer wat `0001` zich erbij voorstelde.

#### Stap 6 — gekookt

**Tabel:** `cook_events` (`0001`), gespiegeld.
**Kolommen:** `household_id`, `meal_id`, `cooked_on` (date), `created_at`
(timestamptz), `rating` (numeric(4,2), 1,0–10,0 sinds `0008`), `would_repeat`.

```sql
-- Kookmomenten per huishouden per week
select
  ce.household_id,
  date_trunc('week', ce.cooked_on::timestamp)::date as week,
  count(*)                                          as kookmomenten,
  count(distinct ce.meal_id)                        as verschillende_gerechten
from public.cook_events ce
where ce.id::text           not like '5eed5eed%'
  and ce.household_id::text not like '5eed5eed%'
group by 1, 2
order by 1, 2;
```

⚠ **`created_at` is het afrondmoment, `cooked_on` is een datum zonder tijd.**
HANDOVER.md's punt 1 stelde dat al vast voor de cijfervraag-na-twaalf-uur:
`created_at` wordt geschreven door `handleCooked(true)`, de
"Gemaakt!"-bevestiging. Gebruik `created_at` voor alles wat met een venster te
maken heeft en `cooked_on` alleen voor "op welke dag".

#### Stap 7 — beoordeeld

**Twee tabellen, en het onderscheid is een productbeslissing.**
`cook_events.rating` is de **privé** score die de beslismotor voedt en het
huishouden nooit verlaat (PD-008, PD-019). `recipe_ratings` is de **openbare**
stem op het canonieke recept (PD-023: het cijfer voor je eigen kook wordt óók
als openbare stem uitgebracht).

```sql
-- Wordt de cijfervraag beantwoord?
select
  count(*)                 as kookmomenten,
  count(rating)            as met_cijfer,
  count(*) - count(rating) as zonder_cijfer,
  round(avg(rating), 1)    as gemiddeld_cijfer,
  min(rating)              as laagste,
  max(rating)              as hoogste
from public.cook_events
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%';
```

**Deze query is de nulmeting voor het half gebouwde werk.** HANDOVER.md punt
1: het domein voor de cijfervraag-na-twaalf-uur staat
(`src/domain/cookRating.ts`, 16 tests), de sheet niet. `count(rating)` tegen
`count(*)` is precies het getal dat moet stijgen als die sheet er komt, en het
is vandaag al meetbaar. **Meet hem vóór de sheet er is**, of je hebt geen
vergelijking.

⚠ **Tel `would_repeat` niet apart.** Sinds PD-008a is dat een verliesgevende
projectie van `rating`, afgeleid in de repository (`src/domain/rating.ts`), en
null voor de middenband. Het draagt geen informatie die `rating` niet al
draagt.

```sql
-- Openbare stemmen
select
  count(*)                          as stemmen,
  count(distinct rater_profile_id)  as stemmers,
  count(distinct recipe_id)         as recepten,
  round(avg(rating), 1)             as gemiddeld
from public.recipe_ratings
where id::text               not like '5eed5eed%'
  and rater_profile_id::text not like '5eed5eed%';
```

#### De trechter in één query

Dit is de dichtstbijzijnde benadering van PD-004's kernmetriek die vandaag
draait: **bewaard → gekookt binnen 14 dagen**, per huishouden, over een
gesloten cohort.

```sql
-- Save-to-cook, gesloten cohort: alleen recepten die minstens 14 dagen de
-- kans hebben gehad. Zonder die afkap daalt het getal naarmate er meer
-- geïmporteerd wordt, wat het onleesbaar maakt.
with bewaard as (
  select m.id, m.household_id, m.title, m.created_at
  from public.meals m
  where m.id::text           not like '5eed5eed%'
    and m.household_id::text not like '5eed5eed%'
    and m.recipe_id is not null
    and m.created_at <= now() - interval '14 days'
),
eerste_kook as (
  select
    b.household_id,
    b.created_at,
    (
      select min(ce.created_at)
      from public.cook_events ce
      where ce.meal_id = b.id
        and ce.id::text not like '5eed5eed%'
        and ce.created_at <= b.created_at + interval '14 days'
    ) as gekookt_op
  from bewaard b
)
select
  household_id,
  count(*)          as bewaard,
  count(gekookt_op) as gekookt_binnen_14_dagen,
  round(avg(extract(epoch from gekookt_op - created_at)) / 86400.0, 1)
                    as gem_dagen_tot_koken
from eerste_kook
group by household_id
order by bewaard desc;
```

En de versie die je bij n=5 daadwerkelijk voorleest — de paren, niet het
percentage:

```sql
with bewaard as (
  select m.id, m.household_id, m.title, m.created_at
  from public.meals m
  where m.id::text           not like '5eed5eed%'
    and m.household_id::text not like '5eed5eed%'
    and m.recipe_id is not null
)
select
  b.household_id,
  b.title,
  b.created_at::date               as bewaard_op,
  (select min(ce.created_at)::date
     from public.cook_events ce
    where ce.meal_id = b.id
      and ce.id::text not like '5eed5eed%') as eerst_gekookt_op,
  now()::date - b.created_at::date as dagen_oud
from bewaard b
order by b.household_id, b.created_at;
```

---

### Import — welke bronnen werken, en waar het misgaat

**Vraag: hoeveel van wat er geëxtraheerd is, is ook daadwerkelijk bewaard?**
Dit is de dichtstbijzijnde benadering van "afgebroken op het bevestigscherm",
en hij werkt beter dan je zou denken.

```sql
select
  platform,
  count(*)                             as extracties,
  count(*) filter (where niet_bewaard) as door_niemand_bewaard
from (
  select
    r.platform,
    not exists (
      select 1 from public.meals m
      where m.recipe_id = r.id
        and m.id::text           not like '5eed5eed%'
        and m.household_id::text not like '5eed5eed%'
    ) as niet_bewaard
  from public.recipes r
  where r.id::text not like '5eed5eed%'
) t
group by platform
order by extracties desc;
```

⚠ **Twee vertekeningen, allebei te overzien bij n=5.** Een `recipes`-rij is
gedeeld: importeert huishouden B een url die A al ophaalde, dan is er één rij
en telt A's `meals`-kopie als "bewaard". En de spiegel loopt achter, dus een
zojuist bewaard recept kan hier nog even als niet-bewaard staan. Bij vijf
testers met elk hun eigen recepten is het eerste zeldzaam; bij honderd
gebruikers is deze query onbruikbaar en heb je het event van laag 2 nodig.

**Vraag: waar mislukt import?** ⚠ **Niet te beantwoorden in laag 1.**
`import_attempts` heeft geen uitkomst en leeft 48 uur. Het enige spoor van een
mislukking is een regel in de logs van de edge functie:

```
import_event outcome=no_recipe_in_caption platform=tiktok provenance=- failure_detail=-
```

`importTelemetry.ts` bouwt die regel al, met vier gesloten velden en zonder
één vrije-tekstveld, en `importResponse.ts:139` schrijft hem weg met
`console.log`. Hij is dus **te tellen zolang Supabase de logs bewaart** —
grep op `import_event` — en daarna weg. Voor de eerste vriendentest is dat
genoeg; het is expliciet de bedoeling van die module. Voor de vraag "is
`no_recipe_in_caption` vijf procent of zestig, over een kwartaal" is het dat
niet, en de module zegt dat zelf:

> "Those need an `import_events` table, and a table is a schema decision with
> its own PD-005 analysis to write [...] the table stays the owner's call."

Dat is de sterkste laag-2-kandidaat in dit document, en de enige waarvan het
argument al geschreven is. Zie
[Laag 2](#laag-2--een-gesloten-set-eigen-events).

---

### De bibliotheek — wat staat er, en wat verstoft

**Vraag: wat is er nooit gekookt, en hoe lang staat het er al?**
Dit is PD-004a's kerkhof, en de vraag die bij n=5 het meeste oplevert omdat je
de titels kunt voorlezen.

```sql
select
  m.household_id,
  m.title,
  m.created_at::date               as binnengekomen,
  now()::date - m.created_at::date as dagen_oud,
  r.platform
from public.meals m
left join public.recipes r on r.id = m.recipe_id
where m.id::text           not like '5eed5eed%'
  and m.household_id::text not like '5eed5eed%'
  and m.archived_at is null
  and not exists (
    select 1 from public.cook_events ce
    where ce.meal_id = m.id and ce.id::text not like '5eed5eed%'
  )
order by m.household_id, dagen_oud desc;
```

**Vraag: wordt de stemmingsvraag na het koken beantwoord?**
`meals.dish_moods` (`0010`) wordt geschreven ná het koken, één stemming per
beoordeling, opgeteld als een de-gedupliceerde unie. Een lege array betekent
dat niemand de vraag ooit beantwoordde.

```sql
select
  count(*)                                            as recepten,
  count(*) filter (where cardinality(dish_moods) > 0) as met_stemming
from public.meals
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%';

-- En welke stemmingen dan
select mood, count(*) as keren
from public.meals m, unnest(m.dish_moods) as mood
where m.id::text           not like '5eed5eed%'
  and m.household_id::text not like '5eed5eed%'
group by mood
order by keren desc;
```

De gesloten woordenlijst is `('zomers', 'winters', 'high-protein',
'veel-groente', 'soul-food', 'licht')` — `0010` zet daar een CHECK op. Een
stemming die nooit voorkomt is een kandidaat om te schrappen; dat is een
concreet productbesluit dat rechtstreeks uit deze query volgt.

**Vraag: wordt het gerechttype ooit veranderd?**
`0017` geeft `meals.dish_course` de default `'hoofdgerecht'`. **Elke andere
waarde is dus een bewuste handeling**, wat deze kolom tot een van de zuiverste
gebruikssignalen in het schema maakt.

```sql
select dish_course, count(*)
from public.meals
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%'
group by dish_course
order by count(*) desc;
```

**Vraag: hoeveel recepten zijn allergeen-gecontroleerd?**
`meals.allergen_tag_status` is `'unknown'` by default en wordt `'verified'`
door een mens (PD-006).

```sql
select allergen_tag_status, count(*)
from public.meals
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%'
group by allergen_tag_status;
```

⚠ Dit meet één ding en lijkt op iets anders. Het zegt hoe vaak iemand de
controle heeft gedaan; het zegt **niets** over of een huishouden allergieën
heeft, want `member_restrictions` staat niet in Postgres. Dat is precies zoals
het hoort — zie PD-005.

**Vraag: welke gerechten komen terug in de rotatie?**

```sql
select
  m.household_id,
  m.title,
  count(*)          as keren_gekookt,
  max(ce.cooked_on) as laatst
from public.cook_events ce
join public.meals m on m.id = ce.meal_id
where ce.id::text           not like '5eed5eed%'
  and ce.household_id::text not like '5eed5eed%'
group by m.household_id, m.id, m.title
having count(*) > 1
order by keren_gekookt desc;
```

---

### Kiezen — bijna niets, en dat moet je weten voordat je begint

⚠ **Dit is het gebied waar laag 1 het meest tekortschiet.** `decisions`,
`decision_alternatives` en de filters staan geen van drieën in Postgres.
Concreet niet te beantwoorden:

- Hoe vaak wordt er een suggestie gedaan?
- Hoe vaak wordt de eerste suggestie geaccepteerd? (`meal_id =
  initial_meal_id` — de kolom bestaat, de rij niet)
- Hoe vaak wordt "Iets anders" getikt, en hoe vaak twee keer? (PD-001 capt op
  twee)
- Welke `reason_code` overtuigt?
- Worden de filterchips gebruikt?

Die laatste is niet eens lokaal te vinden: `(tabs)/index.tsx:298-305` zegt
expliciet dat filters **alleen in schermstate** leven en met opzet niet in de
`decisions`-rij belanden, *"would freeze a passing mood ('iets met soep',
tapped once) into the permanent record of what Remy suggested"*. Dat is een
goede beslissing die het meten duurder maakt, en dat is de juiste volgorde.

**Wat je wél hebt** is de uitkomst: `cook_events` per huishouden per week (zie
stap 6). Dat is "hoeveel avonden eindigden met koken", zonder te weten via
welk scherm. Bij n=5 is de rest een vraag die je stelt.

---

### Boodschappen — niets

⚠ **Laag 1 kan hier geen enkele vraag beantwoorden.** Het boodschappenscherm
(`src/app/boodschappen.tsx`) leest `listPendingSaves`, en `saves` spiegelt
niet. Of iemand de lijst ooit opent, afvinkt of gebruikt, is in Postgres
onzichtbaar.

Het enige indirecte spoor is `meal_ingredients` — die is wél gespiegeld — maar
dat vertelt je wat er óp een lijst zou staan, niet of iemand hem bekeek:

```sql
select
  m.household_id,
  count(distinct mi.meal_id) as recepten_met_ingredienten,
  count(*)                   as ingredientregels,
  count(mi.section)          as regels_met_kopje   -- 0018
from public.meal_ingredients mi
join public.meals m on m.id = mi.meal_id
where m.id::text           not like '5eed5eed%'
  and m.household_id::text not like '5eed5eed%'
group by m.household_id;
```

De ingrediëntsecties van `0018` zijn hier de moeite waard: `section` is
nullable en wordt alleen gevuld als de extractie kopjes vond. `count(section)`
tegen `count(*)` zegt hoe vaak die feature überhaupt iets te doen heeft.

"Wordt de boodschappenlijst geopend" is een laag-2-vraag.

---

### De sociale laag

**Vraag: worden er vriendschappen gesloten, en hoe snel wordt er
geantwoord?**

```sql
select
  status,
  count(*) as aantal,
  round(avg(extract(epoch from responded_at - created_at)) / 3600.0, 1)
    as gem_uren_tot_antwoord
from public.friendships
where id::text not like '5eed5eed%'
group by status
order by aantal desc;
```

⚠ `responded_at` is null zolang een verzoek open staat, en wordt **op null
gezet** bij een hernieuwd verzoek — `0007` noemt dat *"a new question rather
than an amendment to an answered one"*. Het gemiddelde geldt dus alleen voor
`accepted` en `declined`, en telt een heraanvraag als één antwoord.

**Vraag: wordt het pannetje gebruikt, en komt het aan?**

```sql
select
  count(*)            as verstuurd,
  count(seen_at)      as geopend,
  count(withdrawn_at) as ingetrokken,
  count(note)         as met_briefje,
  round(avg(extract(epoch from seen_at - created_at)) / 3600.0, 1)
    as gem_uren_tot_openen
from public.recipe_shares
where id::text                   not like '5eed5eed%'
  and sender_profile_id::text    not like '5eed5eed%'
  and recipient_profile_id::text not like '5eed5eed%';
```

⚠ Zie de waarschuwing hierboven over `seen_at`: dit getal mag bestaan in een
meting en nooit op het scherm van de afzender.

**Vraag: leidt een zending tot een kook? (de gesloten lus, §3.4)**

```sql
select
  rs.created_at::date as verstuurd_op,
  exists (
    select 1
    from public.meals m2
    join public.cook_events ce       on ce.meal_id     = m2.id
    join public.household_members hm on hm.household_id = m2.household_id
    where hm.auth_user_id = rs.recipient_profile_id
      and m2.recipe_id    = m.recipe_id
      and ce.created_at   > rs.created_at
      and ce.id::text not like '5eed5eed%'
  ) as ontvanger_kookte_het
from public.recipe_shares rs
join public.meals m on m.id = rs.meal_id
where rs.id::text not like '5eed5eed%'
  and m.recipe_id is not null
order by rs.created_at;
```

⚠ Werkt alleen voor zendingen van een meal met een `recipe_id` — zonder
canoniek recept is er geen gedeeld object om de kook aan te herkennen. Dat is
dezelfde beperking waar `shared_cooks` in `0009` op gebouwd is.

**Vraag: hoeveel huishoudens delen hun koken?**

```sql
select share_cooks_with_friends, count(*)
from public.households
where id::text not like '5eed5eed%'
group by 1;
```

⚠ **Dit getal kan een keuze niet van een default onderscheiden.** `0009` zette
de default op `false`, `0015` draaide hem om naar `true` en heeft — met opzet
— geen bestaande rijen bijgewerkt. Een `true` betekent dus "aangezet, óf na
6 september aangemaakt en nooit aangeraakt". Wil je weten of iemand de schakel
bewust omzette, dan is dat een event.

**Vraag: hoe vaak wordt "Deel deze niet" gebruikt?**
`meals.excluded_from_cook_proof` heeft default `false`, dus een `true` is
altijd een handeling — de beste bruikbare weigeringsmetriek die het schema
heeft.

```sql
select
  count(*) filter (where excluded_from_cook_proof) as niet_delen,
  count(*)                                         as recepten
from public.meals
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%';
```

**Vraag: wordt "Misschien ken je" gezien, en wordt erop getikt?**
⚠ **Niet te beantwoorden, op geen enkele manier.** `suggested_friends()` is
een `security definer`-functie die leest en niets schrijft; een aanroep laat
geen spoor na. En een tik op `Toevoegen` maakt een gewone `friendships`-rij
die niet te onderscheiden is van een via `/friends/add` getypte handle.

Dat maakt dit de tweede sterke laag-2-kandidaat — en het is bovendien de
duurste vraag om níet te beantwoorden, want dit blok is een teruggedraaide
weigering (DESIGN-SOCIAL.md §4.4 en §7 zeiden "geen suggesties"). Als het niet
gebruikt wordt, hoort het weer weg, en dat kan alleen met een meting.

⚠ En zoals in [Regel nul](#regel-nul-demo-data-telt-niet-mee) staat: zolang de
demo-seed erin zit, meet je bij dit blok vooral de seed.

---

## Wat laag 1 niet kan

Op een rij, met per vraag een oordeel: is dit een event waard, en zo ja welk.

| Vraag | Waarom laag 1 het niet kan | Event waard? |
|---|---|---|
| Welk tabblad wordt geopend, hoe vaak | Geen schrijver, geen rij | **Nee.** Dit is schermtelling, en PD-004 wijst die als maatstaf af. Bij n=5 vraag je het |
| Wordt de filterlade op Kiezen geopend | Filters leven alleen in schermstate, met opzet (`(tabs)/index.tsx:298`) | **Ja**, één event, zonder welke chip |
| Welke filterchip wordt gekozen | Idem | **Alleen zonder sleutel.** Zie de regel sleutel-óf-inhoud |
| Scrolldiepte, sessieduur, tijd-in-app | Geen rij, en PD-004 verbiedt het als doel | **Nee.** Niet meten, ook niet "gewoon om te weten" |
| Import afgebroken vóór bevestigen | Deels: `recipes` zonder `meals` benadert het, met twee vertekeningen | **Ja**, maar pas als die benadering breekt (grofweg boven de twintig huishoudens) |
| Waarom mislukt een import | `import_attempts` heeft geen uitkomst en leeft 48 uur | **Ja — de sterkste kandidaat.** `importTelemetry.ts` schreef het argument al |
| Wordt "Misschien ken je" getoond | De functie laat geen spoor na | **Ja** |
| Wordt er op een suggestie getikt | Niet te onderscheiden van een getypte handle | **Ja** |
| Wordt de boodschappenlijst geopend | `saves` spiegelt niet | **Ja** |
| Wordt de cijfersheet weggeklikt of beantwoord | De sheet bestaat nog niet; straks is alleen "beantwoord" zichtbaar, via `cook_events.rating` | **Ja**, zodra de sheet er is |
| Hoeveel suggesties per avond, hoe vaak "Iets anders" | `decisions` spiegelt niet | **Nee, niet als event.** Dit hoort in `decisions`, en de echte vraag is of die tabel ooit moet spiegelen — een grotere beslissing dan een event |
| Zette iemand het deel-schakelaartje bewust om | `0015` maakte default en keuze ononderscheidbaar | **Twijfelgeval.** Bij n=5: vragen |

---

## Laag 2 — een gesloten set eigen events

**Nog niet bouwen.** Dit is een voorstel voor ná de eerste vriendentest, want
de test zelf gaat de lijst veranderen: sommige vragen worden beantwoord door
te kijken, en er komen vragen bij die nu niet te bedenken zijn.

### De regels

1. **Elk event hangt aan een vooraf opgeschreven vraag**, en die vraag staat
   in de tabelcomment. Een event zonder vraag is autocapture met extra
   stappen.
2. **Geen `payload jsonb`, geen vrije tekst, geen `context`-veld.** Elk veld
   is een gesloten woordenlijst of een tijdstip. Dit is de discipline die
   `importTelemetry.ts` vier keer eerder in deze codebase aanwijst (PD-011.2,
   PD-015, PD-005/PD-006, en zichzelf): *"a guarantee made of types costs one
   compile error to break [...] a guarantee made of discipline costs one
   distracted afternoon."*
3. **Geen recepttitel, geen url, geen ingrediënt, geen handle, geen naam** —
   niet als afspraak maar als afwezige kolom.
4. **Sleutel óf inhoud, niet allebei.** Een teller zonder persoonssleutel is
   geen persoonsgegeven. Een sleutel plus een inhoudelijke waarde, over weken
   herhaald, is een profiel — en bij eten is dat precies het profiel dat
   PD-005 en PD-015 allebei beschermen (*"a list of named cooks is a dietary
   pattern"*). Kies per event welke helft je nodig hebt.
5. **Retentie in dezelfde migratie**, met pg_cron, precies zoals `0013` het
   voor `import_attempts` deed. `0012` liet de retentie als comment achter en
   moest een migratie later worden ingehaald; dat hoeft niet nog eens.
6. **Een event waarvan de vraag beantwoord is, gaat weg.**

### De vorm die ik zou voorstellen: één keyloze tabel

Bij n=5 heeft **geen van de openstaande vragen een persoonssleutel nodig.**
"Hoe vaak wordt het suggestieblok getoond versus hoe vaak wordt erop getikt"
is een verhouding tussen twee totalen. "Hoe vaak wordt de boodschappenlijst
geopend" is een totaal. "Hoe vaak wordt een import afgebroken" vergelijk je
met `recipes`. De trechtervragen die wél een sleutel nodig hebben, zijn precies
de vragen die je bij vijf mensen beter stelt dan meet.

Dus: **begin zonder sleutel.** Dat is niet alleen veiliger, het is ook
eerlijker over wat je met het getal gaat doen.

Schets — **niet uitvoeren, dit is geen migratie**:

```
public.product_events
  id           uuid primary key default gen_random_uuid()
  name         text not null check (name in ( ...gesloten lijst... ))
  detail       text check (detail is null or detail in ( ...gesloten lijst... ))
  occurred_at  timestamptz not null default now()
```

- **Geen `profile_id`, geen `household_id`, geen fingerprint, geen sessie-id.**
- RLS aan, met **alleen** een insert-policy (`with check (auth.uid() is not
  null)`) en **geen** select-policy — dezelfde vorm die `import_attempts`
  heeft, minus de fingerprint. Een client mag toevoegen en nooit teruglezen.
  Dat laatste is niet netjes maar noodzakelijk: een client die zijn eigen
  tellers kan lezen, kan ze ook interpreteren, en dan is het een feature
  geworden.
- Retentie: 90 dagen, in dezelfde migratie ingepland via pg_cron.

⚠ **De eerlijke helft: keyloos is bij vijf gebruikers geen anonimiteit.** Een
piek om 18:40 is één persoon zijn avond, en met vijf testers weet je welke.
Dat is een argument om de woordenlijst saai te houden — geen chipnamen naast
een tijdstempel bijvoorbeeld — en uitdrukkelijk **geen** argument om er dan
maar een sleutel bij te doen omdat het toch al herleidbaar is.

### De zes events, elk met zijn vraag

| `name` | De vraag die hij beantwoordt | `detail` |
|---|---|---|
| `friend_suggestions_shown` | Wordt "Misschien ken je" überhaupt getoond, of blijft het blok leeg? | aantal rijen: `'0'`, `'1'`, `'2'`, `'3'` |
| `friend_suggestion_added` | Wordt er op een suggestie getikt? De verhouding tot de vorige is de enige zinnige maat voor dit blok | `'mutual'` of `'votes'` — welke reden er stond |
| `shopping_list_opened` | Wordt de boodschappenlijst gebruikt? `saves` spiegelt niet, dus dit is de enige route | null |
| `decision_filters_opened` | Wordt de filterlade op Kiezen gebruikt, of is hij dood gewicht? | null |
| `import_confirm_abandoned` | Hoeveel gelukte extracties halen het bevestigscherm niet? Vervangt de benadering die bij schaal breekt | platform, uit `ImportPlatform` |
| `rating_sheet_dismissed` | Wordt de cijfersheet-na-twaalf-uur weggestuurd? Alleen zinvol náást `count(cook_events.rating)` | null |

**Dat is alles.** Zes is geen budget maar een uitkomst: het is wat er
overblijft als je van elke vraag eist dat laag 1 hem eerst niet kon.

### En apart: `import_events`

De importvraag verdient een **eigen tabel**, niet een zevende event, om drie
redenen.

1. **Een andere schrijver.** De edge functie met de service role, niet de
   client. Dat is een andere RLS-vorm en een andere faalmodus.
2. **De velden bestaan al.** `ImportTelemetryEvent` heeft precies vier
   gesloten velden — `outcome`, `platform`, `provenance`, `failureDetail` —
   en `buildImportTelemetryEvent` heeft een `never`-guard die een tiende
   uitkomst laat falen bij compileren. Dat is een sterkere garantie dan een
   CHECK-constraint, en hij staat er al.
3. **Het argument is geschreven.** De kop van `importTelemetry.ts` legt uit
   waarom de tabel nodig is (SRC-09 mag niet op anekdote heropend worden), wat
   hij zou kosten en waarom hij de beslissing van de eigenaar is.

⚠ **De enige echte keuze daar is of er een `household_id` bij mag.** Zonder
sleutel is het een teller: "hoe vaak faalt een TikTok-caption". Met sleutel
kun je de vraag stellen die de module zelf noemt — *"whether the households
that hit `no_recipe_in_caption` are the same ones that stopped importing"* —
en betaal je er de hele garantie voor waar die module op gebouwd is. **Mijn
advies: zonder.** Bij vijf testers vraag je het gewoon, en de kolom is later
toe te voegen; een geschiedenis van gekoppelde rijen is niet later te
ontkoppelen.

### Wat ik expliciet níet zou meten

- **Schermweergaves per tabblad.** Het is de eerste stap naar een
  sessiedashboard, en PD-004 wijst dat af.
- **Scrolldiepte, tijd-op-scherm, sessieduur.** Zie boven.
- **Welke filterchip, mét sleutel.** Een chipnaam naast een persoon, over
  weken, is een dieetprofiel. De chip zonder sleutel mag; de sleutel zonder
  chip mag; allebei niet.
- **Wat er in het zoekveld getypt wordt.** Vrije tekst, per definitie.
- **`recipe_shares.seen_at` als productfunctie.** Meten mag, tonen niet.
- **Elke vorm van "engagement score".** Er is geen getal dat dit product
  omhoog wil hebben behalve gekookte maaltijden.

---

## Privacy: waarom geen externe analytics-SDK

**Dit is een ontwerpvraag en geen voetnoot**, omdat de keuze hier niet tussen
twee gereedschappen ligt maar tussen twee vormen.

### Het juridische deel, kort

Een SDK van Amplitude, Mixpanel of PostHog Cloud maakt de leverancier een
**verwerker** onder de AVG: verwerkersovereenkomst, opname in het
verwerkingsregister, en voor de Amerikaanse partijen een doorgiftegrondslag
(DPF-certificering of SCC's plus een transfer impact assessment). Dat is werk,
maar het is niet het argument. Papier is te regelen.

### Het echte argument is de vorm

**Elk van deze SDK's is autocapture-first.** Dat is hun verkoopargument:
installeren en het vult zich vanzelf. Wat zich hier dan vult:

- **Schermnamen zijn in deze app identificatoren.** De routes zijn
  `/recipe/[mealId]`, `/friends/[feedItemId]`, `/cook/[mealId]`. Een
  autocapture-`$screen`-event met het pad erin stuurt maaltijd- en
  profiel-id's het land uit, en die id's zijn joinbaar met alles in Postgres.
- **De titel volgt vanzelf.** Zodra iemand een schermtitel meegeeft aan een
  header — een volstrekt normale wijziging — staat de recepttitel in de
  gebeurtenisstroom, en niemand heeft dat besloten.
- **Handles zijn identiteit.** De sociale laag draait op `profiles.handle`.
  Eén `identify()`-aanroep, die elke SDK-integratiegids als stap twee noemt,
  en de handle is de sleutel waarop alles samenvalt.

En dan het punt dat dit product specifiek maakt: **eten plus huishouden is
Artikel 9-nabij** (PD-005). Niet omdat een recept gezondheidsdata is — dat is
het niet — maar omdat de **join** van een persoon aan wat hij eet, herhaald
over weken, een dieetprofiel is. DESIGN-SOCIAL.md en `0009` benoemen precies
die join als het gevaar, en bouwen er structurele beperkingen tegen: de
`shared_cooks`-view projecteert twee kolommen zodat de score er niet in kán
zitten, `recipe_ingredients` heeft geen allergeenkolom zodat één huishouden de
controle van een ander niet kan erven. **Een analytics-SDK bestaat om precies
die join te maken.** Het is niet dat hij hem per ongeluk zou kunnen leggen;
het is zijn productbelofte.

Daar komt bij dat het schema al is ingericht op de plicht die PD-005 noemt —
**hard verwijderen, niet soft-deleten**. Elke tabel hangt met `on delete
cascade` aan `households` of `profiles`; een wisverzoek is één statement en
klaar. Een externe sink heeft zijn eigen bewaartermijn, zijn eigen backups en
zijn eigen wis-API, en "is het daar echt weg" is een vraag die je niet zelf
kunt beantwoorden. Eigen tabellen in de bestaande Postgres zijn dus niet
alleen veiliger maar **goedkoper in precies de verplichting die dit product
al draagt**.

### Het tegenargument, en waarom het hier (nog) niet wint

Het eerlijke tegenargument: een gehost gereedschap geeft je trechters,
cohorten en retentiecurves in een middag, en hetzelfde in SQL bouwen kost
dagen. Dat is waar, en het is geen kleinigheid.

**Bij n=5 is die waarde nul.** Je gaat geen cohortgrafiek van vijf mensen
lezen; je gaat ze bellen. De waarde van een gehost analytics-product begint bij
de schaal waarop je je gebruikers niet meer kúnt bellen, en Remy zit daar twee
ordegroottes vandaan.

**De conclusie is dus niet "nooit" maar "nog niet", met de drempel
opgeschreven**, want een conclusie zonder drempel is een conclusie die niemand
ooit heroverweegt:

> Heroverweeg een externe verwerker zodra er zoveel huishoudens zijn dat je ze
> niet meer één voor één kunt spreken — grofweg boven de honderd. De
> voorwaarden zijn dan: EU-regio, **autocapture uit**, een expliciete
> allowlist van gebeurtenisnamen, geen `identify()` met een handle, en geen
> routepad in een event. Voldoet een leverancier daar niet aan, dan is het
> antwoord nog steeds nee.

En zolang die drempel niet gehaald is, is het alternatief niet armoedig maar
beter: de data staat er al, RLS begrenst hem al, de wisroute bestaat al, en er
komt geen enkele partij bij.

---

## Volgorde

Van goedkoop naar duur, en niets in stap 4 begint voordat stap 3 klaar is.

1. **Vandaag, vóór de test.** Draai de laag-1-queries één keer als nulmeting.
   Dat doet twee dingen tegelijk: je hebt een beginstand, en je weet welke
   queries daadwerkelijk draaien — want geen enkele in dit document is ooit
   tegen een echte Postgres gehouden. ⚠ Verwijder de demo-seed eerst
   (`demo_social_teardown.sql`), of noteer dat de nulmeting hem bevat.
2. **Vóór de test.** Schrijf de vijf vragen op één A4 met de verwachte vorm
   van het antwoord erbij ("een aantal per huishouden", niet "een
   percentage"). Bij n=5 is dat A4 het meetinstrument.
3. **Tijdens de test.** Praten. De SQL richt het gesprek; hij vervangt het
   niet.
4. **Na de test.** Kijk welke vragen laag 1 niet kon beantwoorden en welke
   daarvan je écht miste. Pas dán de eventtabel, en waarschijnlijk met minder
   dan zes events.
5. **Los daarvan, wanneer de importvraag urgent wordt.** `import_events`, met
   het argument dat al in `importTelemetry.ts` staat. Dit is de enige
   laag-2-stap waarvan het ontwerp al af is.

---

## Wat er onzeker is aan dit document

Eerlijk, want dat is hier de conventie.

- **Geen enkele query is uitgevoerd.** Ze zijn kolom voor kolom tegen `0001`
  t/m `0019` nagelopen, inclusief de typewisseling van `0008`
  (`numeric(4,2)`) en de gesloten woordenlijsten van `0010` en `0017`. Dat is
  niet hetzelfde als gedraaid, en in dit project is dat onderscheid al vier
  keer duur geweest.
- **`0019` draait niet.** De suggestievragen in dit document gaan over een
  functie die nog nergens bestaat behalve in een bestand.
- **De benadering "extractie zonder bewaring" is niet gevalideerd.** Hij leunt
  op de aanname dat testers niet massaal dezelfde url's importeren. Bij vijf
  mensen plausibel, niet bewezen.
- **Ik weet niet hoe lang Supabase de edge-functielogs bewaart** op het plan
  dat dit project gebruikt. Dat bepaalt of `grep import_event` tijdens de
  eerste test bruikbaar is, en het is één blik in het dashboard waard vóór je
  erop rekent.
- **De vraag of `decisions` ooit zou moeten spiegelen** is bewust niet
  beantwoord. Hij is groter dan een meetplan: `ARCHITECTURE.md` draagt sinds
  5 september een banner die uitlegt waarom de 16:00-functie niet tegen deze
  database te bouwen is, en het antwoord daarop bepaalt of de halve trechter
  ooit in SQL komt. Dat is een architectuurbeslissing die dit document alleen
  mag agenderen.
- **`docs/HANDOVER.md` verwijst nog niet naar dit bestand.** De "Lees
  dit"-tabel daar (regel 78 e.v.) somt de staande documenten op; een regel
  voor `MEETPLAN.md` hoort erbij. Die is hier bewust niet toegevoegd — deze
  ronde mocht alleen dit ene bestand aanraken.
