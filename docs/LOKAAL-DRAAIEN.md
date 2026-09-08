# Lokaal draaien

Van niets naar een werkende lokale stack, op deze machine (Windows 11 Home).

**Waarom dit document bestaat.** Alle SQL in deze repo — negentien migraties en
twee seed-bestanden — is nooit uitgevoerd behalve met de hand, door de eigenaar,
in de SQL-editor, **tegen productie**. Dat is op 8 september 2026 twee keer
misgegaan, waarvan één keer met drieëntwintig ongeldige uuid-literals in vier van
de negen tabellen. Er is geen enkele plek waar SQL kan falen zonder dat het de
echte database is.

Dit document maakt die plek. Niet omdat lokaal draaien mooi is, maar omdat
`npx supabase db reset` de enige manier is om de vraag te beantwoorden die
hieronder als hoofdstuk 4 staat: **bouwt dit schema vanaf nul op?** Daar staat
vandaag geen antwoord op, en dat antwoord moet "ja" zijn vóór er vrienden op
zitten.

---

## 0. Wat er nu is, zodat je weet waar je begint

| Ding | Stand |
|---|---|
| Supabase-CLI | `supabase@2.116.0`, als devDependency in `package.json` — dus `npx supabase …` of `npm run db:…` pakt die, niet een globale installatie |
| `supabase/config.toml` | Compleet ingevuld, `project_id = "remy"`, Postgres major 17 |
| Migraties | `supabase/migrations/0001_init.sql` t/m `0019_friend_suggestions.sql` |
| Seed | `supabase/seed/demo_social.sql` + `supabase/seed/demo_social_teardown.sql` |
| Project gelinkt aan productie | **JA.** `supabase/.temp/project-ref` bestaat (gemaakt 2 september). Zie hoofdstuk 6 — dat is het gevaarlijke deel |
| Docker | Staat niet op deze machine. Dat is hoofdstuk 1 |
| App | `npx expo start`, Expo Go, QR scannen — zie `docs/HANDOVER.md`, "Wat er draait" |

De CLI meldt bij elke aanroep dat `2.117.0` beschikbaar is. Dat is informatie,
geen fout; upgrade als je wilt, maar niet halverwege een sessie waarin je iets
probeert te bewijzen.

---

## 1. Docker Desktop op Windows 11 Home

Windows 11 **Home** heeft geen Hyper-V. Docker Desktop draait daar dus altijd op
de **WSL2-backend** — dat is geen keuze maar de enige optie, en het is ook de
optie die je wilt: de Linux-containers draaien dan in een echte Linux-kernel in
plaats van in een vertaallaag.

### Installeren

1. **WSL2 eerst, Docker daarna.** Open PowerShell als Administrator:

   ```powershell
   wsl --install
   ```

   Herstart. Controleer daarna:

   ```powershell
   wsl --status
   wsl --list --verbose
   ```

   Je wilt `VERSION 2` zien staan bij de distributie die er staat.

2. **Docker Desktop** van docker.com, de standaardinstaller. Bij *Configuration*
   staat "Use WSL 2 instead of Hyper-V" aangevinkt — laat dat zo.

3. **Start Docker Desktop en wacht tot het walvisicoontje stil staat.** Zolang
   het beweegt is de engine nog niet op. `npx supabase start` tegen een engine
   die nog opstart geeft een verbindingsfout die eruitziet als een defect.

4. Controle:

   ```powershell
   docker version
   docker run --rm hello-world
   ```

   Draait `hello-world`, dan is de rest van dit document zinvol. Zo niet, dan is
   hoofdstuk 1 nog niet af.

### Waar het misgaat

- **"Virtualization is not enabled."** Virtualisatie staat uit in het
  BIOS/UEFI. Bij Intel heet het VT-x, bij AMD SVM. Taakbeheer → Prestaties →
  CPU laat rechtsonder zien of virtualisatie aan staat. Dit is de enige fout in
  deze lijst waarvoor je de machine opnieuw moet opstarten en een BIOS-scherm in
  moet.
- **"WSL 2 installation is incomplete" / kernelfout.** `wsl --update` in
  PowerShell, daarna herstarten.
- **Docker Desktop start, maar `docker version` geeft alleen de client.** De
  engine is niet op. Dat is normaal in de eerste minuut na het inloggen, en
  abnormaal daarna.
- **Antivirus of een VPN pakt de netwerkbrug.** Symptoom: containers starten wel,
  maar poorten zijn niet bereikbaar vanaf Windows. Zeldzaam, maar het is de
  verklaring als hoofdstuk 2 aan het eind vastloopt terwijl `docker ps` alles
  gezond noemt.
- **Geheugen.** WSL2 pakt standaard een groot deel van je RAM en geeft het niet
  makkelijk terug (`vmmemWSL` in Taakbeheer). Je kunt dat begrenzen in
  `%UserProfile%\.wslconfig`:

  ```ini
  [wsl2]
  memory=8GB
  processors=4
  ```

  Na wijziging: `wsl --shutdown` in PowerShell, dan Docker Desktop opnieuw
  starten.

⚠ **Ik heb dit niet uitgevoerd.** Op deze machine draait geen Docker en het is
niet aan een agent om die te installeren. De stappen hierboven zijn de
standaardroute voor Windows 11 Home met WSL2; de foutenlijst is wat er bij die
route standaard misgaat. Wat je werkelijk tegenkomt kan afwijken, en dat is dan
informatie voor dit document.

---

## 2. `npx supabase start`

```powershell
npm run db:start
```

(is `supabase start`; de CLI komt uit `node_modules/.bin`, dus dit werkt zonder
globale installatie)

### Wat het opstart

Een stuk of veertien containers. De volledige lijst staat in de CLI zelf, in de
hulp van `--exclude`:

```
gotrue, realtime, storage-api, imgproxy, kong, mailpit, postgrest,
postgres-meta, studio, edge-runtime, logflare, vector, supavisor
```

plus Postgres zelf. De eerste keer worden die images gedownload; reken op minuten
en op enkele GB schijf. Daarna is starten een stuk sneller.

### Geheugen

⚠ **Niet gemeten op deze machine, en ik ga geen getal verzinnen.** Wat je moet
weten: het zijn veertien containers, Postgres 17 zit erbij, en WSL2 geeft
geheugen slecht terug. Meet het zelf zodra het draait:

```powershell
docker stats --no-stream
```

Is het te zwaar, dan is `--exclude` de knop. Voor **alleen** het schema testen
(hoofdstuk 4) heb je van die lijst bijna niets nodig:

```powershell
npx supabase start -x realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,mailpit
```

Voor de app tegen lokaal draaien (hoofdstuk 5) heb je `kong`, `gotrue` en
`postgrest` wél nodig, en `studio` wil je waarschijnlijk ook.

⚠ Of `-x logflare,vector` samengaat met `[analytics] enabled = true` in
`config.toml` weet ik niet — dat is niet uitgeprobeerd. Klaagt de CLI, zet dan
`enabled = false` onder `[analytics]` of laat die twee erin.

### Poorten

Uit `supabase/config.toml`, niet uit het hoofd:

| Poort | Wat |
|---|---|
| **54321** | API-gateway (Kong). Hier komt REST, Auth, Storage en de edge-runtime binnen. Dit is de URL die de app krijgt |
| **54322** | Postgres |
| **54323** | **Studio** — de lokale beheeromgeving |
| 54324 | Mailpit: de mail die de auth-server zou versturen, opgevangen in een webinterface |
| 54327 | Analytics (Logflare) |
| 54320 | Shadow-database, alleen gebruikt door `db diff` |
| 54329 | Pooler — staat op `enabled = false`, dus deze luistert niet |
| 8083 | Inspector voor edge functions |

Metro/Expo draait op **8081**. Geen botsing met bovenstaande, wat prettig is want
die twee draaien tegelijk.

### Studio lokaal bereiken

<http://127.0.0.1:54323>

Dat is een aparte Studio met een aparte database. Hij lijkt op de Studio van
supabase.com en is het niet. Zie hoofdstuk 6.

### De sleutels ophalen

```powershell
npm run db:status
```

Dat drukt de lokale URL en de lokale sleutels af. Wil je ze in shell-vorm:

```powershell
npx supabase status -o env
```

⚠ **Neem die anon key over uit deze uitvoer en typ hem niet uit je hoofd.** De
lokale sleutel is historisch een vaste demo-JWT geweest, maar het sleutelformaat
van Supabase is recent veranderd en de CLI-versie bepaalt wat je krijgt. Lezen
kost één commando; gokken kost een half uur zoeken naar een 401.

### Stoppen

```powershell
npm run db:stop
```

Dat stopt de containers en **behoudt** de data. `npx supabase stop --no-backup`
gooit de datavolumes weg — dat staat er met opzet niet als npm-script bij, want
het is precies het soort commando dat je niet per ongeluk moet kunnen typen.

---

## 3. Wat er NIET automatisch gebeurt

`config.toml` zegt:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

**`supabase/seed.sql` bestaat niet.** Er is `supabase/seed/demo_social.sql`, en
dat is een andere naam en een andere map. Dat is geen slordigheid maar een
keuze, en de header van dat bestand legt hem uit: demo-data die ongevraagd
meelift met een reset is spookdata.

Gevolg voor jou: **`db reset` zet geen demo-data neer.** Na een reset is de
database eerlijk leeg. Wil je de demo-data erbij, dan is dat hoofdstuk 7 — een
tweede, expliciete handeling.

---

## 4. `npx supabase db reset` — de belangrijkste test in dit document

```powershell
npm run db:reset
```

(is `supabase db reset --local`)

### Wat het doet

Het gooit de **lokale** database weg, maakt een lege, en speelt daar
`0001_init.sql` t/m `0019_friend_suggestions.sql` op af, in volgorde, van voren
af aan.

### Waarom dit de test is die telt

Niemand heeft dit ooit gedaan. Wat er tegen productie is gebeurd, is negentien
keer "voer deze ene migratie uit tegen de database zoals die op dat moment was" —
een reeks incrementen over anderhalve maand, elk in een context die de vorige had
gemaakt. Dat is iets anders dan negentien migraties die samen een schema
opbouwen.

Het verschil is niet theoretisch. Een migratie die leunt op een kolom die
handmatig in de editor is aangemaakt, een `alter table` waarvan de `create` in
een migratie staat die later is aangepast, een functie die naar een view wijst
die pas twee migraties verderop ontstaat, een `create extension` die op de cloud
al gedaan was — al die dingen werken tegen een gegroeide database en falen tegen
een lege. **Ze falen ook precies dan pas: als je een tweede omgeving maakt.** Een
testomgeving, een nieuwe database na een incident, of het moment waarop je dit
project ergens anders opnieuw opzet.

Dus: **draai `db reset` en kijk of hij zonder fout de negentiende haalt.** Dat is
één commando en het beantwoordt de vraag die dit hele document waard is.

### Kandidaten om als eerste om te vallen

Dit is een leeslijst, geen meting — ik heb niets gedraaid:

- **`0013_import_attempts_retention.sql` doet `create extension if not exists
  pg_cron;`.** Op Supabase Cloud is dat een aangevinkte extensie; lokaal moet de
  Postgres-image hem hebben én preloaden. Als er ergens een verschil tussen cloud
  en lokaal zit, is dit de plek waar het zich als eerste laat zien.
- **De migraties die in `auth.users` grijpen.** `auth` is een schema dat de
  auth-container beheert; lokaal ontstaat het bij het opstarten. Volgorde kan
  hier uitmaken.
- **`0019_friend_suggestions.sql`** is op 8 september geschreven en is nooit,
  nergens, tegen een Postgres gehouden. Ook niet tegen productie. Dat het
  compileert is een aanname.

Valt er iets om: **noteer de fout letterlijk en verander de migratie, niet de
database.** Een reparatie die alleen lokaal met de hand is gedaan, brengt je
precies terug in de situatie die dit hoofdstuk beschrijft.

### Nuttige varianten

```powershell
npx supabase db reset --local --version 0013   # tot en met 0013 en niet verder
npx supabase db reset --local --no-seed        # sla het seed-script over
```

Beide vlaggen komen uit `npx supabase db reset --help` op versie 2.116.0;
`--version` is handig om een falende migratie te isoleren.

---

## 5. De app op lokaal laten wijzen

### Hoe het nu geconfigureerd is (uitgezocht, niet aangenomen)

`src/lib/supabase.ts` leest twee variabelen en gooit een fout als er één
ontbreekt:

```ts
process.env.EXPO_PUBLIC_SUPABASE_URL
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
```

`app.json` bevat **geen** Supabase-configuratie — geen `extra.supabaseUrl`, geen
plugin die er iets mee doet. De waarden komen dus uitsluitend uit de omgeving, en
Expo vult die uit `.env`-bestanden.

**Er is geen codewijziging nodig.** Dat is de goede uitkomst, en hij is nagemeten
in `node_modules/@expo/env/build/index.js:162-166`: Expo laadt in deze volgorde,
waarbij de bovenste wint:

```
.env.development.local
.env.local
.env.development
.env
```

Een echte omgevingsvariabele uit je shell wint van alle vier. Zowel `.env` als
`.env.local` staan in `.gitignore` (regels 9 en 10).

### Wat je doet

Maak `.env.local` naast `.env`, met de waarden uit `npm run db:status`:

```
EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.42:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<de anon key uit `npm run db:status`>
```

Herstart Metro daarna — `.env` wordt bij het opstarten gelezen, niet per hot
reload.

**Terug naar productie: verwijder `.env.local`.** Eén bestand weg en `.env` is
weer de bovenste. Dat is de reden om `.env.local` te gebruiken in plaats van
`.env` te bewerken: je hoeft je productiesleutels nergens uit te knippen en er is
geen versie van `.env` die half lokaal is.

⚠ Zolang `.env.local` bestaat, wijst **elke** `expo start` naar lokaal. Dat is de
bedoeling en het is ook de valkuil: kom je morgen terug en is de Vrienden-tab
leeg, kijk dan eerst of dit bestand er nog staat.

### ⚠ `127.0.0.1` werkt niet vanaf je telefoon

Dat is het adres van de telefoon zelf. Expo Go op een fysiek toestel heeft het
**LAN-adres van de laptop** nodig:

```powershell
ipconfig
```

Neem het IPv4-adres van de wifi-adapter (`192.168.x.x`) en zet dat in
`EXPO_PUBLIC_SUPABASE_URL`. Dat is hetzelfde adres dat Metro in zijn
`exp://…:8081`-URL gebruikt, dus je kunt het ook daar aflezen.

Twee dingen kunnen dan nog in de weg zitten:

- **Windows Firewall** vraagt bij de eerste keer of Docker/Node op het privé
  netwerk mag. Zeg ja. Weigert het stil, dan hangt de app op een timeout in
  plaats van op een foutmelding.
- **Verander je van netwerk, dan verandert dat IP** en klopt `.env.local` niet
  meer. Precies hetzelfde probleem dat de magic-link-route twee dagen kostte
  (zie `docs/HANDOVER.md`, "Inloggen — drie routes").

Draai je de app in de browser (`npm run web`) op dezelfde machine, dan volstaat
`http://127.0.0.1:54321`.

### Inloggen op lokaal

De lokale auth-server staat in `config.toml` op `enable_confirmations = false`.
Je kunt dus een gebruiker aanmaken en meteen inloggen, zonder mailserver —
precies de blokkade die tegen productie drie keer in de weg heeft gezeten.

Twee routes:

1. Studio → Authentication → Add user → **Auto Confirm User** aan. Daarna het
   `ALLEEN IN ONTWIKKELING`-blok op het inlogscherm van de app.
2. Meld je gewoon aan via de app; de bevestigingsmail die je niet krijgt, staat
   in Mailpit op <http://127.0.0.1:54324>.

Wat lokaal **niet** werkt zonder extra stappen: de edge functions
(`parse-recipe`, `daily-decision`) hebben secrets nodig — `GEMINI_API_KEY`,
`IMPORT_FINGERPRINT_SALT`, `YOUTUBE_API_KEY` — en die staan alleen op de
productie-omgeving. Import- en fotoscenario's test je dus voorlopig tegen
productie, en de rest lokaal.

---

## 6. ⚠ Lokaal of productie — hoe de CLI het onderscheidt

**Dit project is gelinkt.** `supabase/.temp/project-ref` bestaat en bevat de
project-ref van de productiedatabase. Daardoor kan elk `db`-commando twee kanten
op, en het verschil zit in één vlag.

| Vlag | Waar het heen gaat |
|---|---|
| `--local` | De Docker-containers op deze machine |
| `--linked` | **De productiedatabase**, via het gelinkte project |
| `--project-ref <ref>` | Een specifiek Supabase-project. Ook productie |
| `--db-url <url>` | Wat er in die URL staat |

`npx supabase db reset --linked` **wist productie en bouwt hem opnieuw op uit de
migraties.** Alle gebruikers, alle recepten, alles. Er is geen ongedaan-knop.

De CLI-hulp van `db reset` zegt zelf: *"Resets the local database to current
migrations"* — lokaal is dus de bedoelde standaard. **Vertrouw daar niet op.**
Alle `db`-scripts in `package.json` schrijven `--local` voluit, en dat is de
gewoonte om over te nemen als je met de hand typt: dan hangt het niet af van wat
een default op een dag doet.

**Vuistregel: `--linked` typ je alleen bij `db push` en `migration list`.** Die
twee zijn bedoeld om iets met productie te doen — de een past nieuwe migraties
toe, de ander leest alleen. Bij `db reset` is `--linked` er een die je nooit
hoort te typen.

Twee dingen die ook helpen om te weten waar je bent:

- **Studio.** Lokaal is <http://127.0.0.1:54323>. Productie is supabase.com.
  Andere URL, andere kleur in de adresbalk. De SQL-editor waar de twee ongelukken
  van 8 september in gebeurden, was de tweede.
- **`npx supabase migration list`** zonder vlag zet `local` en `remote` naast
  elkaar. Dat is de meting die `docs/HANDOVER.md` vier keer had moeten doen
  voordat het iets over de migratiestand beweerde, en het leest en wijzigt niets.

---

## 7. De seed lokaal draaien

### Eerst: de controle die geen database nodig heeft

```powershell
npm run check:seed
```

Die parseert elke uuid-literal in beide seed-bestanden en faalt met exitcode 1
als er één niet hexadecimaal is of een verkeerde groepslengte heeft. **Dit is de
controle die de fout van 8 september in een fractie van een seconde had
gevonden** — drieëntwintig id's als `5eed5eed-0000-4000-8000-00000000h001`, waar
`h` geen hexadecimaal teken is, die vier van de negen tabellen onmogelijk maakten
en die drie dagen niemand zag omdat lezen niet parsen is.

De verantwoording waarom dit een Node-script is en niet de grep-keten uit de
header van `demo_social.sql`, staat bovenin `scripts/check-seed-uuids.mjs`. De
korte versie: bij die keten staat de exitcode omgekeerd — nul fouten geeft exit 1
— en dat is geen poort maar een alarm dat afgaat als er niets aan de hand is.
(Nagemeten, beide kanten: schoon bestand geeft exit 0, een ingevoegde
`…h001` geeft exit 1 met bestandsnaam en regelnummer.)

Draai dit **vóór** je iets plakt, lokaal of niet.

### Dan: de seed zelf

⚠ **De seed heeft een echte gebruiker nodig.** Hij zoekt het enige profiel dat
niet met `demo_` begint en weigert met een opsomming als dat er nul of meer dan
één zijn. Na een `db reset` is de database leeg, dus de volgorde is:

1. `npm run db:reset`
2. Maak een gebruiker aan en log in met de app, zodat er een `profiles`-rij met
   jouw handle ontstaat (het claim-handle-scherm)
3. Pas dán de seed

```powershell
npm run db:seed
```

(is `supabase db query --local -f supabase/seed/demo_social.sql`)

Weghalen:

```powershell
npm run db:seed:teardown
```

Die verwijdert precies de rijen met het voorvoegsel `5eed5eed` en niets anders —
hij houdt geen lijst bij maar vraagt het aan de database, dus hij is met de seed
meegegroeid zonder aangeraakt te zijn.

⚠ **Hier stond dat dit "niet uitgeprobeerd" was. Op 8 september 2026 is het
uitgeprobeerd, en het WERKT NIET.** De voorspelling die hier stond klopte:
`demo_social.sql` is één `do $$ … $$;`-blok plus een losse `select` eronder, en
`supabase db query` stuurt één prepared statement. Met CLI v2.116.0 geeft
`npm run db:seed`:

```
{"code":"LegacyDbQueryExecError",
 "message":"failed to execute query: error: cannot insert multiple commands
            into a prepared statement"}
```

Twee alternatieven, allebei gedraaid:

```powershell
docker exec -i supabase_db_remy psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/seed/demo_social.sql
```

Dat geeft de `NOTICE` van de seed plus de controletabel hieronder, in één keer.
Of: plak het bestand in de **lokale** Studio op <http://127.0.0.1:54323>,
SQL-editor. Dat is dezelfde handeling als tegen productie, alleen op een
database die je mag slopen — en dat is de hele winst van dit document.

`npm run db:seed:teardown` loopt tegen precies hetzelfde aan zodra het
teardown-bestand meer dan één statement draagt; draai hem dan via dezelfde
`docker exec … psql`-regel.

### Wat er hoort te ontstaan

Onderaan `demo_social.sql` staat een controlequery die dit teruggeeft:

| Wat | Aantal |
|---|---|
| vrienden (geaccepteerd) | 6 |
| verzoeken (open) | 1 |
| recepten | 8 |
| gekookt (bewijs) | 6 |
| stemmen (ranglijst) | 18 |
| doorgestuurd (pannetje) | 1 |

Klopt dat en blijft een scherm tóch leeg, dan ligt het aan de app en niet aan de
data.

⚠ `suggested_friends()` staat met opzet **niet** in die query. Die functie leest
`auth.uid()`, en een SQL-editor draait als `postgres` zonder JWT — hij zou nul
rijen geven, wat eruitziet als een defect terwijl het de beveiliging is die
werkt. Dat deel test je op een toestel; zie `docs/TOESTELTEST.md`.

---

## 8. De hele lus, achter elkaar

```powershell
npm run check:seed     # geen database nodig, doe dit altijd eerst
npm run db:start       # containers op
npm run db:reset       # 0001 t/m 0019 tegen een lege database  <- DE TEST
npm run db:status      # URL en anon key ophalen
# .env.local schrijven met die twee waarden (LAN-IP, geen 127.0.0.1)
npx expo start         # app tegen lokaal
# gebruiker aanmaken + handle claimen in de app
npm run db:seed        # demo-vrienden erbij
# … testen, zie docs/TOESTELTEST.md …
npm run db:seed:teardown
npm run db:stop
```

Terug naar productie: `.env.local` weggooien, Metro herstarten.

---

## Wat er niet in dit document staat, en waarom

- **Getallen die ik niet gemeten heb.** Geheugengebruik, opstarttijd,
  schijfruimte. Er draait geen Docker op deze machine; alles hierboven wat een
  getal is, komt uit `config.toml`, uit `--help` van de CLI, of uit de broncode
  van `@expo/env`. Wat ontbreekt, ontbreekt met vermelding.
- **Vlaggen die ik niet heb geverifieerd.** Elke vlag in dit document is
  afgelezen uit `npx supabase <commando> --help` op versie 2.116.0. Staat er iets
  niet in die hulp, dan is het hier niet opgeschreven.
- **Edge functions lokaal serveren.** `supabase start` zet een edge-runtime neer,
  maar de secrets die `parse-recipe` nodig heeft staan alleen op productie. Dat
  is een apart hoofdstuk dat pas de moeite is als hoofdstuk 4 een antwoord heeft.
