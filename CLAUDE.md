# Werkafspraken

Voor wie in deze repo werkt, mens of agent. `README.md` zegt wat Remy is;
`docs/STATUS.md` zegt waar we staan. Dit bestand zegt hoe hier gewerkt wordt.

## De vijf poorten

```bash
npm run typecheck && npm run lint && npm run check:functions && npm run check:seed && npm test
```

**Het zijn er vijf en geen vier.** Dat is hier vaker misgegaan dan enig ander
detail; `check:seed` kwam er op 9 september 2026 bij en werd daarna dagenlang
vergeten. `check:functions` is **geen** functielengte-controle maar de typecheck
over de Edge Functions.

**Draai ze zelf en schrijf het getal over uit de terminal.** Een testaantal
overnemen uit een document is hier al meermaals fout gebleken.

## Schrijven

**Comments leggen uit *waarom*, en noemen het afgewezen alternatief erbij.** Dat
is geen stijlvoorkeur maar de reden dat dit project zijn eigen beslissingen kan
terugvinden. Code en comments zijn Engels; documenten in `docs/` zijn Nederlands.

**Corrigeer door door te strepen, niet door te wissen.** Een achterhaalde
bewering blijft staan met `~~doorstreept~~` en een blok eronder dat zegt wat er
nu geldt en waarom het veranderde. De fout is vaak leerzamer dan de fix.

**Citeer documenten op hun kopregels, nooit op regelnummers.** Ankers als
`DESIGN.md:181` zijn hier een keer 202 regels verschoven omdat er een sectie
bovenaan bij kwam — een anker in een document dat van boven groeit, schuift stil
mee.

**Grenzen:** functies onder de 50 regels, bestanden onder de 800. Die tweede
heeft geen geautomatiseerde poort en wordt met de hand gehouden.

## Valkuilen van deze omgeving

**De Supabase-CLI staat lokaal, niet globaal.** `supabase db push` geeft
`CommandNotFoundException`; het is `npx supabase db push`. Het project is al
gekoppeld. `npx supabase migration list` leest en wijzigt niets — gebruik hem
vóór je iets over de migratiestand beweert.

**Draai de Expo-server in je eigen terminal, niet als achtergrondtaak van een
assistent.** Op 5 september 2026 is hij drie keer door de geheugenbewaker
afgebroken, en het onderliggende `node`-proces overleeft dat: het blijft poort
**8081** vasthouden, waarna de volgende start uitwijkt naar 8083. En 8081 is
precies de poort die in Supabase's redirect-allowlist staat, dus inloggen breekt.

Opruimen kan met — en kijk naar de commandline vóór je afsluit, want tussen de
node-processen zitten ook de MCP-servers van de assistent zelf:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'expo[\/]bin[\/]cli' }
```

**Bewerk bestaande bestanden binair, niet als tekst.** De regeleindes in deze
repo zijn niet uniform, en Python's tekstmodus normaliseert ze stilletjes: een
CRLF wordt een kale newline en komt zo terug, waarmee een wijziging van twee
regels als een herschrijving van het hele bestand in de diff belandt. Dat is op
4 september 2026 precies één keer gebeurd en kostte meer tijd om terug te draaien
dan om te voorkomen. Lees en schrijf met `'rb'` / `'wb'`.

⚠ `(tabs)/friends.tsx` en `(tabs)/index.tsx` dragen sinds de
`DEV_SCENARIO_ROWS_VISIBLE`-wijziging **kapotte regeleindes** — een dubbele CR op
de ene import, een kale newline op de volgende. Onschadelijk, elke parser leest
er overheen, maar het maakt elke normalisatie zichtbaar als een herschrijving van
693 regels. Wie ze opruimt doet dat in een eigen commit die verder niets aanraakt.

**Heredocs met veel inhoud falen in deze shell.** Grote `python - <<'PY'`-blokken
breken op "unexpected EOF"; schrijf het script dan naar de scratchpad en voer het
daarvandaan uit. En let op CRLF: `^…$` met `re.M` matcht niet door de `\r` heen,
gebruik `\r?$`.

**Er is een Fact-Forcing Gate actief.** Vóór het aanmaken van een bestand, het
bewerken van een bestaand bestand of een destructief commando eist die eerst de
feiten: wie roept dit aan, bewijs dat het niet al bestaat, welke data het raakt,
en de instructie van de gebruiker letterlijk geciteerd. Bij een bounce: feiten
presenteren en exact hetzelfde commando opnieuw geven. Een geweigerde bewerking
is dus niet "geblokkeerd" maar "nog niet op de juiste manier gevraagd" — dat
onderscheid heeft hier een keer een echte reparatie tegengehouden (ONT-06).

## Twee dingen die "pushen" heten

`git push` gaat over code. `npx supabase db push` gaat over de database. Dit
project heeft ze een keer verward en daar een halve dag aan besteed. Als iemand
vraagt of er gepusht is: vraag welke van de twee, of meet ze allebei.

⚠ **Migraties gaan vóór de code die ze nodig heeft.** Draai je code met een
ongedraaide migratie, dan bestaan de tabellen en functies niet en staat het
scherm leeg mét de data netjes in de database — een storing die eruitziet als
een lege app.

## Voordat je zegt dat iets niet gedaan is

De migratiestand in deze documenten is **vijf keer** onwaar gebleken, altijd
dezelfde kant op: het document beweerde dat een migratie nog niet gedraaid was
terwijl hij allang liep. De oorzaak is telkens dezelfde: "ik heb een
migratiebestand toegevoegd" wordt opgeschreven als "de migratie staat nog niet
remote", en dat is een aanname vermomd als meting.

Hetzelfde geldt voor half afgemaakt werk. `docs/archief/HANDOVER.md` voerde tot
12 september de cijfervraag-na-twaalf-uur op als "het enige onaffe werk in de
boom"; `PendingRatingSheet.tsx` stond er toen al, gemonteerd in `_layout.tsx` en
gedekt door drie testbestanden.

**Meet het, of vraag het. Allebei kost twintig seconden.**
