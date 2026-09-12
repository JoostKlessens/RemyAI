# Remy

Een kookapp die één vraag per dag stelt: **wat eten we vanavond?** Je plakt een
recept uit TikTok, Instagram, YouTube of een blog, Remy haalt er ingrediënten en
stappen uit, en stelt 's middags één gerecht voor dat past bij wat je huishouden
kan en wil eten. Wat je vrienden echt gekookt hebben is het enige sociale signaal
dat telt.

React Native + Expo (SDK 57), TypeScript, Supabase (Postgres + RLS + Edge
Functions), Gemini voor de extractie.

---

## Beginnen

```bash
npm install
npm run start:log      # Expo, met leesbare Metro-log — zie CLAUDE.md
```

Scan de QR-code met Expo Go. Inloggen doe je in ontwikkeling met het
wachtwoordblok onderaan het inlogscherm; de andere twee routes staan in
`docs/ARCHITECTURE.md`.

Lokaal draaien tegen een eigen database — inclusief `npm run db:reset`, de enige
manier om te weten of het schema vanaf nul opbouwt — staat in
`docs/LOKAAL-DRAAIEN.md`.

### De vijf poorten

Alle vijf moeten groen zijn voordat werk af heet. Draai ze zelf; neem het getal
nooit over uit een document.

```bash
npm run typecheck        # tsc over de app
npm run lint             # eslint
npm run check:functions  # tsc over de Edge Functions
npm run check:seed       # uuid-literals + seed/teardown-symmetrie, geen database nodig
npm test                 # vitest
```

---

## Waar staat wat

**Begin hier:**

| Bestand | Waarvoor |
|---|---|
| **`docs/STATUS.md`** | **Waar we staan en wat er nu gebeurt.** Eén pagina. Als je één ding leest, dit. |
| `CLAUDE.md` | Werkafspraken van deze repo — conventies, valkuilen, hoe de shell zich gedraagt. |

**Referentie, waar de code naar verwijst:**

| Bestand | Waarvoor |
|---|---|
| `docs/ARCHITECTURE.md` | Datamodel, RLS, de beslismotor, wat er draait, en de drie inlogroutes. |
| `docs/DESIGN.md` | Schermen en visuele richting. |
| `docs/DESIGN-SOCIAL.md` | De sociale laag, en vooral: wat er bewust **niet** komt. |
| `docs/PRODUCT-DECISIONS.md` | De genomen besluiten (PD-xxx, DEC-xx) en de vragen die nog open staan. |
| `docs/LONGLIST.md` | De genummerde backlog. Codes als GAP-33, ONT-07 en SRC-07 zijn hier gedefinieerd. |
| `docs/ONTDEK-PLAN.md` | Het beslisdossier van Ontdek: de gerichte graaf, de fasen, en de O-vragen die code bij naam citeert. |
| `docs/LOKAAL-DRAAIEN.md` | Van niets naar een werkende lokale stack. |

**`docs/archief/`** — afgesloten rondes, het dagboek en het ontwerponderzoek.
Niet bijgewerkt, wel bewaard: code en documenten citeren eruit.
`docs/archief/README.md` zegt per bestand wat erin zit en waarom het dicht is.

---

## Twee dingen die je tijd besparen als je ze nu leest

**"Pushen" betekent hier twee dingen.** `git push` gaat over code;
`npx supabase db push` gaat over de database. Dit project heeft die twee al een
keer verward, met een halve dag zoeken als gevolg. De Supabase-CLI staat lokaal
en niet globaal — altijd met `npx`.

**Neem geen enkele meting over uit een document.** Testaantallen,
migratiestanden en "dit is nog niet gedaan" zijn hier meermaals verouderd
gebleken, en altijd dezelfde kant op: pessimistischer dan de werkelijkheid.
`npx supabase migration list` leest en wijzigt niets; de vijf poorten hierboven
draaien in een halve minuut. Meten is hier goedkoper dan lezen.
