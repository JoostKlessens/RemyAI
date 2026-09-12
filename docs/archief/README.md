# Archief

Afgesloten documenten. **Ze worden niet meer bijgewerkt en je mag niets uit deze
map als stand lezen.** Ze staan er omdat code, commit-messages en de levende
documenten eruit citeren — en omdat de argumentatie bij een afgesloten stuk vaak
precies is wat je nodig hebt als je later wil weten waaróm iets werkt zoals het
werkt.

Waar we nu staan: **`../STATUS.md`**.

---

## Waarom deze map bestaat

Dit project schreef per ronde een nieuw document en schreef elk ervan als
*levend* document. Ze verouderden daarna tot momentopname zonder dat iemand ze
sloot. Op 12 september 2026 stonden er 23.400 regels documentatie in de repo
zonder voordeur, waarvan een flink deel iets beweerde dat niet meer waar was:

- `OPEN-BESLISSINGEN.md` stond op *"2476 tests over 97 bestanden"* — het waren er
  toen 3809 over 160.
- `MEETPLAN.md` rustte op *"`0019` is nooit gedraaid"* — alle 22 draaien.
- `HANDOVER.md` voerde de cijfervraag-na-twaalf-uur op als het enige onaffe werk
  in de boom, terwijl `PendingRatingSheet.tsx` er al stond, gemonteerd en getest.
- `RONDE-8-SEPTEMBER-TRENDING.md` vroeg om een tap op de Trending-kaart die op
  11 september gebouwd is.

**Het probleem was niet dat er te veel geschreven werd, maar dat niets ooit
gesloten werd.** Vandaar deze map, en vandaar dat `STATUS.md` één pagina is die
bijgewerkt wordt in plaats van aangevuld.

---

## Wat hier ligt

| Bestand | Wat het is | Waarom het dicht is |
|---|---|---|
| `HANDOVER.md` | Het dagboek, 4 t/m 11 september 2026, 2.720 regels. Per dag wat er gebeurde en wat het leerde. | De stand erin is achterhaald; `git log` houdt de chronologie. De vier delen die géén dagboek waren zijn eruit gelicht: de conventies naar `/CLAUDE.md`, *Wat er draait* en *Inloggen* naar `ARCHITECTURE.md`, en *Schulden die nergens anders staan* naar `LONGLIST.md`. |
| `OPEN-BESLISSINGEN.md` | De open vragen A t/m K met hun volledige afweging, plus DEC-01, DEC-02 en het Expo-upgradeplan. | Stand van 2 september. De vragen die nog open staan zijn overgezet naar `PRODUCT-DECISIONS.md`; hier ligt de lange versie van de redenering. |
| `MEETPLAN.md` | Hoe je zou meten wat mensen werkelijk gebruiken. Twee lagen met een harde regel ertussen, alle SQL tegen het schema nagelopen. | Inhoudelijk nog bruikbaar, maar geschreven op de aanname dat `0019` niet gedraaid was. De wens van de eigenaar staat nog open in `STATUS.md`. |
| `TOESTELTEST.md` | Checklist voor een zitting van een uur op een telefoon: wat je doet, wat je hoort te zien, en wat het betekent als het anders is. | Geschreven voor het werk van 4 t/m 8 september. De toesteltest zelf staat nog open (`STATUS.md` punt 1) — gebruik deze lijst, maar vul hem aan met wat er sindsdien bij kwam. |
| `STYLING-PLAN.md` | De audit van 4 september: zeven parallelle controles die het ontwerponderzoek tegen de code hielden. Vond dat 26 van 26 kleurtokens nooit waren toegepast. | Zegt in zijn eigen kop dat zes bevindingen niet meer waar zijn. |
| `RONDE-8-SEPTEMBER-TRENDING.md` | Vier meldingen van de eigenaar op een iPhone 16 Pro, met wat eruit volgde. | Alle vier afgehandeld. De laatste — *"kan ik niet op de recepten klikken die ik daar zie"* — op 11 september, als ONT-08. |
| `ontwerp-audit-9-september.html` | De visuele ontwerpaudit van 9 september, als pagina. | Momentopname. |
| `ui-research/` | Het oorspronkelijke ontwerponderzoek: zes werkstromen (WS1 t/m WS6) plus `ASSEMBLY.md`, samen 8.244 regels en 47 schermafbeeldingen. Richting en palet, layout en dichtheid, Nederlandse stem, iconen en beeld, motion, en de sociale laag. | **Gedateerd onderzoeksarchief, en het wordt bewust niet bewerkt** — ook niet waar het inmiddels achterhaald is. Twee plekken om te kennen: `WS1` draagt nog het volledige oude palet plus een app-icoon-specificatie in het oude blauw, en `WS5` citeert een zin uit `DESIGN.md` die daar inmiddels is teruggedraaid. |

---

## Als je hier iets uit wil gebruiken

Neem de **redenering** over, nooit de **meting**. Elk getal in deze map is van de
dag waarop het geschreven werd. De poorten draaien in een halve minuut en
`npx supabase migration list` leest en wijzigt niets.
