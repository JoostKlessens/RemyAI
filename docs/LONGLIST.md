# Longlist

De genummerde backlog. `OPEN-BESLISSINGEN.md` en de commit-messages van
september 2026 verwijzen naar de codes hieronder; dit is waar ze gedefinieerd
staan.

Ontstaan uit een vergelijking met **SlimMandje**, een Nederlandse app die
recepten uit TikTok, Instagram, YouTube, Facebook en Pinterest omzet in een
boodschappenmand bij Albert Heijn of Jumbo. De overlap met Remy is uitsluitend
de import; hun tweede helft (boodschappen, prijzen, supermarktkoppeling) is
grotendeels bewust niet overgenomen.

**Stand:** 2 september 2026, `feat/live-import-and-plan-phases`, t/m `a4a220f`.

| Status | Betekenis |
|---|---|
| ✅ | Gebouwd, getest, gepusht |
| 🟡 | Deels — domeinlaag af, geen scherm of geen aanroeper |
| ⬜ | Open, geen blokkade |
| 🔒 | Geblokkeerd — wacht op een beslissing, zie `OPEN-BESLISSINGEN.md` |

---

## IMP — de importpijplijn

| # | Status | Wat |
|---|---|---|
| IMP-01 | ✅ | TikTok-shortlinks (`vm.`/`vt.`) worden nu server-side uitgeklapt, met begrensde hops, timeout per hop en validatie van de eindbestemming |
| IMP-02 | ✅ | Creator-attributie op `no_recipe_in_caption` — was een KNOWN GAP |
| IMP-03 | ✅ | `unsupported_url` noemt nu welke platforms wél werken |
| IMP-04 | ✅ | Instagram `missing_credentials` — opgelost via de tokenloze oEmbed-route |
| IMP-05 | 🔒 | Gemini-model staat op een zwevende alias. Wacht op één snapshot-ID van de eigenaar |
| IMP-06 | 🟡 | Rate limiting. Beleid gebouwd en getest, bewust niet aangesloten — er is geen duurzame teller. Migratie `0012` ligt klaar |
| IMP-07 | ✅ | Import-telemetrie. Eén structurele regel per uitkomst, geen SDK, geen tabel, geen PII |
| IMP-08 | — | Geschrapt: "opnieuw proberen" bestond al |
| IMP-09 | ⬜ | Handmatig aanvullen na mislukte extractie is nog steeds de zwakste plek |
| IMP-10 | 🟡 | Kostenplafond per huishouden. Zelfde situatie als IMP-06 |

## SRC — importbronnen

| # | Status | Wat |
|---|---|---|
| SRC-01 | ✅ | Webimport via schema.org/Recipe JSON-LD. Geen model nodig, geen hallucinatierisico, geen kosten |
| SRC-02 | ✅ | YouTube via Data API v3 (`videos.list?part=snippet`) |
| SRC-03 | ✅ | YouTube Shorts genormaliseerd naar dezelfde canonieke vorm |
| SRC-04 | 🔒 | Instagram volledige extractie. Technisch één functie; wacht op DEC-01 (Meta's oEmbed-voorwaarden) |
| SRC-05 | ✅ | Pinterest — rich pins dragen de structured data van de bronpagina, dus dit liftte mee met SRC-01 |
| SRC-06 | 🔒 | Facebook. Zelfde Meta-voorwaarden als Instagram, en weinig NL-kookcontent |
| SRC-07 | ⬜ | Foto van een kookboek of screenshot. Juridisch het schoonste: het is je eigen boek |
| SRC-08 | ✅ | Platte tekst plakken. Expliciete moduskeuze, nooit raden of iets "op een URL lijkt" |
| SRC-09 | 🔒 | Audio-transcriptie of OCR van de video. Wacht op DEC-02 én op een maand telemetrie |

## ENT — hoe recepten binnenkomen

| # | Status | Wat |
|---|---|---|
| ENT-01 | 🔒 | **Share extension.** Nog steeds het item met de meeste hefboom. Geblokkeerd door OPS-01/02 |
| ENT-02 | 🔒 | Achtergrond-import met notificatie. Volgt op ENT-01 |
| ENT-03 | ⬜ | Klembord-detectie (`expo-clipboard` zit al in de dependencies) |
| ENT-04 | ⬜ | Meerdere links tegelijk |
| ENT-05 | ⬜ | De lege eerste ervaring is kaal — importdrempel is ook activatiedrempel |
| ENT-06 | ⬜ | Deeplinks vanuit een gedeeld recept van een vriend |

## BSK — boodschappen

| # | Status | Wat |
|---|---|---|
| BSK-01 | ✅ | Boodschappenlijst uit de weekplanning |
| BSK-02 | ✅ | Ingrediënten normaliseren en optellen. `ShoppingListItem` heeft bewust géén `total`-veld, zodat gram en stuks niet opgeteld kúnnen worden |
| BSK-03 | ✅ | Afvinken in de winkel |
| BSK-04 | 🔒 | Productmatching AH/Jumbo. Geen publieke API; zie DEC-03 |
| BSK-05 | 🔒 | Prijzen tonen en vergelijken |
| BSK-06 | 🔒 | Naar de winkelwagen van de supermarkt |
| BSK-07 | ⬜ | "Dit heb ik al in huis" — voorraadkast |

## RCP — kwaliteit van het recept

| # | Status | Wat |
|---|---|---|
| RCP-01 | 🟡 | Porties schalen. Domeinlaag af en getest; de UI kan alleen in `cook/[mealId].tsx` landen en dat is een makeover-bestand |
| RCP-02 | 🔒 | Voedingswaarden. Overnemen uit JSON-LD is feitelijk, schatten uit een caption is verzinnen — en het is gezondheidsdata onder PD-005 |
| RCP-03 | ✅ | Opgeslagen recept corrigeren |
| RCP-04 | ⬜ | Eigen notities bij een recept |
| RCP-05 | ⬜ | Omgang met een verdwenen bronvideo |
| RCP-06 | ✅ | Herkomst tonen: publisher-data versus een model dat proza las. Als feit gebracht, niet als score |
| RCP-07 | ✅ | Hoeveelheden. Een onaangeraakte regel houdt nu zijn `quantity`/`unit`; een bewerkte regel blijft eerlijk `null` |

## PRF — huishouden en voorkeuren

| # | Status | Wat |
|---|---|---|
| PRF-01 | ⬜ | Dieetprofielen in één tik. Machinerie bestaat al; let op de grens tussen voorkeur en Artikel 9-data |
| PRF-02 | 🔒 | Filters bij het importeren. Ziet eruit als bedrading, is het niet — zie `OPEN-BESLISSINGEN.md` §7 |
| PRF-03 | ⬜ | Instellingen zijn alleen bereikbaar via een tekstlink |
| PRF-04 | ⬜ | Tweede volwassene in hetzelfde huishouden (uitnodigingsstroom ontbreekt) |

## LIB — de bibliotheek

| # | Status | Wat |
|---|---|---|
| LIB-01 | ✅ | Zoeken in eigen recepten |
| LIB-02 | 🔒 | Collecties. Botst met PD-004a — mappen zijn hoe je een kerkhof bouwt |
| LIB-03 | ✅ | Filteren op tijd, dieet en stemming (kolommen bestonden al sinds 0004 en 0010) |
| LIB-04 | ✅ | Sorteren en verwijderen. Archiveren, geen hard delete — `on delete restrict` maakt dat laatste onmogelijk zodra er kookgeschiedenis is |
| LIB-05 | ⬜ | Thumbnails hangen aan een externe CDN |
| LIB-06 | ✅ | Weekplanning (`/deze-week`), leest dezelfde bron als de boodschappenlijst |

## OPS — platform en onderhoud

| # | Status | Wat |
|---|---|---|
| OPS-01 | 🔒 | Expo SDK 51 / RN 0.74 zijn van medio 2024. Blokkeert ENT-01 |
| OPS-02 | 🔒 | Geen development build-pijplijn. Share extension kan niet in Expo Go |
| OPS-03 | 🔒 | Engelse vertaling. Geen i18n-laag; copy zit hardcoded in tientallen modules |
| OPS-04 | ⬜ | Fixtures naast de echte paden |
| OPS-05 | ✅ | End-to-end test over plakken → parsen → bevestigen → opslaan |
| OPS-06 | 🔒 | **De UI-makeover committen.** Blokkeert nu actief RCP-01 |
| OPS-07 | ⬜ | Werken zonder verbinding |

## BIZ — verdienmodel

| # | Status | Wat |
|---|---|---|
| BIZ-01 | 🔒 | Geen verdienmodel, kosten lopen per import op |
| BIZ-02 | ⬜ | SlimMandje's prijs is hun zwakste plek volgens hun eigen reviews |
| BIZ-03 | 🔒 | Waar ligt de betaalgrens? Niet op imports, niet op de sociale laag |
| BIZ-04 | ⬜ | Makers als kanaal in plaats van als risico (PD-007 bouwt de opt-in al) |

---

## Punten die na de eerste analyse zijn ontdekt

Niet uit de SlimMandje-vergelijking, maar gevonden tijdens het bouwen.

| Status | Wat |
|---|---|
| 🔒 | **Het anon-key-gat.** `verify_jwt` accepteert de anon key, die per ontwerp publiek is. Zie `OPEN-BESLISSINGEN.md` §1 — dit is het dringendste openstaande punt |
| 🔒 | **`recipes.platform` CHECK.** Web- en YouTube-imports kunnen geen kookbewijs zijn. Migratie `0011` ligt klaar |
| 🔒 | **Niets kan een gerecht inplannen.** `createSave` is alleen bereikbaar vanaf het bevestigingsscherm. Plaatsingsvraag, geen migratie |
| ⬜ | `src/app/(tabs)/recipes.tsx` staat op 816 regels, over de 800-grens |
| ⬜ | `LibraryHeader`'s deur zegt "Boodschappen", zou "Deze week" moeten zeggen |
| ⬜ | `<Stack.Screen>`-declaraties ontbreken voor `/deze-week` en `/boodschappen` |
| ⬜ | Twee verouderde `'text'`-doccomments plus een dode guard in `resolveImport` |
| ⬜ | `CreateMealInput.dishTags` naar verplicht |
| 🔒 | Niets onder `supabase/functions/` is ooit uitgevoerd — geen tsc, geen ESLint, geen tests |

---

## Wat bewust niet overgenomen is van SlimMandje

Voor de volledigheid, zodat dit niet elke keer opnieuw wordt voorgesteld.

- **Productmatching en prijzen.** Hun halve product, en een doorlopende
  onderhoudslast zonder officiële API. BSK-01 lost het grootste deel op zonder
  die last.
- **Video-transcriptie.** Zij beloven "de bereiding uit de video"; dat
  suggereert audio of OCR. Bij ons bewust buiten scope op auteursrechtelijke
  gronden, op twee plekken in de code vastgelegd.
- **Collecties.** Zie LIB-02 — botst met PD-004a.
- **Import-gebaseerde paywall.** Hun eigen App Store-reviews laten zien wat
  dat kost, en het wurgt precies de invoer waar de app op draait.
