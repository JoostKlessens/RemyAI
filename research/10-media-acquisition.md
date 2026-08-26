# Media-acquisitie: hoe kom je aan meer dan de caption van één TikTok/Instagram-post?

Scope van dit document: uitsluitend de technische vraag hoe je — gegeven één URL die de gebruiker
al heeft geplakt — aan audio, videobestand, on-screen tekst of transcript van díé post komt. Geen
extractie-logica (ander onderzoek), geen juridische beoordeling (ander onderzoek — zie wel de korte
ToS-signalen hieronder als risicofactor, niet als juridisch advies), geen concurrentieanalyse.

## Kernconclusie

Geen enkele officiële API geeft een klein product toegang tot video/audio/transcript van een post
die niet van de eigen ingelogde gebruiker is. TikTok's Display/Content Posting API's zijn hard
gebonden aan de ingelogde gebruiker [S4][S5][S6]; de Research API bestaat wél en geeft zelfs een
kant-en-klaar `voice_to_text`-veld [S2], maar is contractueel beperkt tot academische/non-profit
onderzoekers — een consumentenapp komt er niet voor in aanmerking [S1][S3]. Instagram's Graph API
is net zo hard beperkt tot de eigen Business/Creator-account [S12][S13]; Basic Display API (de
enige route naar persoonlijke accounts) is per 4 december 2024 uitgefaseerd (zie
`docs/PRODUCT-DECISIONS.md` PD-007). Wat overblijft is *niet-geautoriseerde* toegang: yt-dlp (gratis,
maar breekbaar, en IP-blokkades op datacenter-IP's zijn een reëel, gedocumenteerd probleem [S30]) of
een betaalde derde-partij-scraper (Apify, ScrapeCreators, RapidAPI) die dat breekbare werk voor je
doet en er reverse-engineered TikTok/Instagram-endpoints achter verbergt. Voor een klein product is
een betaalde derde-partij-API (ScrapeCreators of Apify) het enige praktisch onderhoudbare pad —
niet omdat het officieel is, maar omdat het onderhoud dan bij de leverancier ligt in plaats van bij
jou. Al deze routes — inclusief de betaalde — draaien op ongeautoriseerde toegang tot platforms die
dat in hun ToS expliciet verbieden [S9][S11][S15]; dat is een continu operationeel risico
(blokkade, prijswijziging, stopzetting), niet een eenmalig te tekenen contract.

---

## 1. Officiële APIs

### 1.1 TikTok

| API | Toegang tot posts van andere gebruikers? | Scopes / goedkeuring | Rate limit | Bruikbaar voor Remy? |
|---|---|---|---|---|
| **Display API** (`/v2/video/list/`) | **Nee.** Retourneert alleen "a *specified user's* most recent videos" — die "specified user" is de gebruiker die via Login Kit is ingelogd, niet een willekeurige URL [S4][S6]. | `user.info.basic` + `video.list` scopes, app-review + Login Kit-approval nodig [S4]. | 600 requests/minuut per endpoint, sliding window, HTTP 429 bij overschrijding — officieel gedocumenteerd voor `/v2/video/list/`, `/v2/video/query/`, `/v2/user/info/` [S8]. | Nee — de gebruiker moet zelf zijn eigen TikTok-account koppelen; werkt niet voor een creator-URL die de gebruiker plakt. |
| **Content Posting API** | N.v.t. — dit is een *publiceer*-API (`video.publish` scope), geen leesroute voor bestaande content van derden [S7]. | App-approval + `video.publish` scope. | Niet apart geverifieerd; zie Display API-tabel voor vergelijkbare endpoints. | Nee — verkeerde richting (posten, niet ophalen). |
| **Research API** | **Ja, in principe** — kan video's opvragen inclusief een `voice_to_text`-veld: "Voice to text and subtitles (for videos that have voice to text features on, show the texts already generated)" [S2]. Dit is het enige officiële TikTok-endpoint dat een kant-en-klaar transcript teruggeeft. | Strikt beperkt: alleen academische instellingen in de VS/EER/VK/Zwitserland of non-profit onderzoeksinstellingen in de EU, "independent from commercial interests", non-profit basis, ethische toetsing vereist, ~4 weken doorlooptijd [S1][S3]. | Niet gepubliceerd op de geraadpleegde pagina's — ONBEVESTIGD. | **Nee** — een commerciële consumenten-app zoals Remy komt niet in aanmerking, ongeacht de technische mogelijkheden van het endpoint. |
| **oEmbed** (`tiktok.com/oembed`) | Ja, voor de URL die je opgeeft — geen auth nodig. Al geïmplementeerd in `src/lib/oembed.ts`. | Geen (publiek, ongedocumenteerd of je rate-limited wordt). | ONBEVESTIGD. | Alleen titel/thumbnail/auteur — geen video, audio, of transcript. Dit is precies de huidige, ontoereikende bron. |

**"Unofficial but tolerated" pad bij TikTok?** Niet gevonden. TikTok's Terms of Service verbieden
expliciet "scraping, crawling, exporting or otherwise extracting any data or content [...] using
any automated system [...] except as approved in writing by TikTok" [S9], en TikTok publiceert zelf
een blogpost over hoe ze scraping actief bestrijden [S10]. Er is geen officiële uitzondering voor
"één URL die een eindgebruiker al bezit" — de contractuele lijn ligt bij *elke* vorm van
geautomatiseerde toegang zonder schriftelijke toestemming.

### 1.2 Instagram / Meta

| API | Toegang tot posts van andere gebruikers? | Scopes / goedkeuring | Rate limit | Bruikbaar voor Remy? |
|---|---|---|---|---|
| **Instagram Basic Display API** | Was de enige route naar *persoonlijke* accounts. **Definitief uitgefaseerd per 4 december 2024** (vastgesteld in `docs/PRODUCT-DECISIONS.md` PD-007). | N.v.t. — bestaat niet meer. | N.v.t. | Nee — bestaat niet meer. |
| **Instagram Graph API** (media endpoint) | **Nee.** "returns only data for media owned by Instagram professional accounts and cannot be used to get data for media owned by personal Instagram accounts" [S12][S13]. Zelfs voor professionele accounts geldt: alleen de eigen gekoppelde account, niet een willekeurige creator-URL. | OAuth + Business/Creator-account gekoppeld aan een Facebook-pagina; "Advanced Access" (content van derden) vereist volledige Meta App Review, 2–4 weken doorlooptijd. | Business Use Case-formule: max. calls/24u = 4800 × aantal impressies van de gekoppelde account in de laatste 24u (officieel, Meta Graph API-docs) [S14]. Voor losstaande gebruikersacties: 200 calls/uur/actieve gebruiker, rolling window [S14]. | Nee — zelfs met volledige app review krijg je nooit toegang tot een creator-post die niet via jouw gekoppelde account loopt. |
| **oEmbed (Instagram)** | Ja, voor de URL die je opgeeft, via `graph.facebook.com/v19.0/instagram_oembed` met `{app-id}|{client-token}`. Al geïmplementeerd in `src/lib/oembed.ts`. Meta heeft dit in 2026 hernoemd/heringericht als "oEmbed Read" — zelfde functie, geen video-/audiotoegang toegevoegd (derde-partij samenvatting, niet op Meta's eigen pagina geverifieerd — ONBEVESTIGD in detail). | App-level token, app moet bestaan; geen user-login nodig voor het lezen zelf. | ONBEVESTIGD. | Alleen titel/thumbnail/auteur — zelfde beperking als TikTok oEmbed. |

**"Unofficial but tolerated" pad bij Instagram?** Niet gevonden, eerder het tegenovergestelde. Meta's
"Automated Data Collection Terms" verbieden expliciet elke geautomatiseerde toegang zonder
voorafgaande schriftelijke toestemming, en zijn per 1 januari 2025 aangescherpt zodat de bepaling
ook geldt wanneer *uitgelogd* wordt gescraped (een gat dat een Amerikaanse rechter in 2024 nog had
opengelaten) [S15]. Er bestaat dus geen door Meta erkende grijze zone, ook niet voor incidentele,
gebruiker-geïnitieerde ophaalacties.

---

## 2. Derde-partij APIs

Deze diensten leveren zelf geen "officiële" toegang — ze bouwen op reverse-engineered mobiele/web-
endpoints van TikTok en Instagram, net als yt-dlp, maar verpakken dat in een stabiele, betaalde HTTP-
API en nemen het onderhoud (headers, tokens, CDN-URL's die binnen ~24u verlopen, layout-wijzigingen)
voor hun rekening.

### 2.1 ScrapeCreators

Prijsmodel (van de eigen pricing-pagina, credits vervallen niet) [S24]:

| Tier | Prijs | Credits | Prijs / 1.000 requests |
|---|---|---|---|
| Free | $0 | 100 (+tot 7.000 bonus) | — |
| Freelance | $47 | 25.000 | ≈ $1,88 |
| Business | $497 | 500.000 | ≈ $0,99 |
| Enterprise | maatwerk | 1M+ | maatwerk |

Relevante endpoints:
- **TikTok**: `GET /v1/tiktok/video/transcript` — kant-en-klaar transcript, apart endpoint [S24].
  `GET /v2/tiktok/video` (Video Info) — bestaat, maar de precieze responsvelden (bevat het een
  no-watermark downloadlink?) kon ik niet uit de gepubliceerde documentatie bevestigen —
  ONBEVESTIGD.
- **Instagram**: transcript-endpoint (`/v2/instagram/media/transcript/`) — stuurt een post-/
  reel-URL, laat de audio via een AI-pipeline transcriberen, en geeft platte transcripttekst terug.
  Expliciete beperking: **video moet korter zijn dan 2 minuten**, verwerkingstijd 10–30 seconden,
  1 credit per aanvraag, cache tot 30 dagen (goedkoper/gratis bij cache-hit) [S25].
- Leverancier claimt "geen rate limit", met de aanbeveling onder de 500 gelijktijdige requests te
  blijven [S24] — een marketingclaim van de leverancier zelf, niet onafhankelijk geverifieerd.

Dit is voor Remy's use case (één URL, on-demand, klein volume) het best passende derde-partij-pad:
prijs per losse call, geen opstartkosten per run, en met het Instagram-transcript-endpoint een
kant-en-klaar antwoord op precies het "ingesproken recept"-probleem — mits de video onder de 2
minuten blijft.

### 2.2 Apify

Pay-per-event model (kosten per actor-run + per resultaat + per optionele feature), niet puur per
1.000 resultaten zoals vaak vereenvoudigd wordt weergegeven.

**TikTok — `clockworks/tiktok-scraper`** (grootste/bekendste actor):
- Basisprijs vaak samengevat als "vanaf $1,70 / 1.000 results" [S16], maar de daadwerkelijke
  structuur is event-based: circa $0,03 per actor-start + $0,003 per dataset-item + **$0,001 per
  gedownloade video** wanneer `shouldDownloadVideos` aan staat (gevonden via Apify's eigen
  pricing-issue-thread voor deze actor — niet rechtstreeks op de hoofdpagina bevestigd, dus met
  enige onzekerheid gemarkeerd) [S17]. Belangrijk voor Remy's *single-URL* gebruikspatroon: de vaste
  **$0,03 opstartkost per run** weegt zwaar wanneer je de actor telkens voor één enkele video
  aanroept in plaats van in batch — dat maakt de werkelijke kostprijs per ad-hoc lookup een stuk
  hoger dan het geadverteerde "$1,70/1.000".
- Retourneert volgens de actor-documentatie: metadata, engagement-cijfers, en — indien
  ingeschakeld — het gedownloade videobestand zelf én een `subtitleLinks`-veld met
  `downloadLink`/`tiktokLink` per taal, dus TikTok's eigen (auto-)ondertitelbestand is via deze
  route direct op te halen zonder zelf audio te hoeven transcriberen [S16].
- Betrouwbaarheid: actor-pagina toont een historisch slagingspercentage van "92,8% runs succeeded"
  [S16] — geen garantie, wel een concreet, door Apify zelf gepubliceerd cijfer.
- Losstaand: er bestaat ook een dedicated `linen_snack/tiktok-subtitles-extractor`-actor die
  specifiek ondertitels/transcript/VTT/SRT uit een TikTok-URL trekt [S42].

**Instagram — meerdere concurrerende actors** (o.a. `memo23/instagram-video-downloader`,
`igview-owner/instagram-video-downloader`, `lance_api/instagram-reels-downloader-api`):
- Prijzen rond $1,50–$2,50 per 1.000 resultaten, aflopend met volume [S20][S21][S22].
- Retourneren volgens de listings: videobestand (of een herhoste MP4-URL zonder verlooptijd — een
  actor claimt expliciet dat Instagram's eigen CDN-links binnen ~24u verlopen en dat zij dat
  oplossen door zelf te herhosten [S20][S21]), audiotrack apart, cover-image, en carrousel-slides.
- `apidojo/instagram-scraper` heeft een transparante event-pricing: $0,005/query + $0,0005/post
  [S23].

### 2.3 RapidAPI-scrapers (TikTok "no-watermark downloader" e.d.)

Een groot aantal concurrerende, individueel gepubliceerde wrappers (bv. het "7scorp"-aanbod met
>5M requests/maand) die claimen "direct te verbinden met de TikTok-backend" [S28] — in de praktijk
dezelfde reverse-engineered aanpak als Apify en yt-dlp, alleen zonder de schaal/reputatie van een
gespecialiseerde leverancier. Prijzen variëren sterk per aanbieder: sommige plannen $300/maand
onbeperkt, andere 500.000 requests/maand gratis met 1.000 requests/uur-limiet [S28] — dit segment is
sterk gefragmenteerd, kwaliteitsverschillen tussen aanbieders zijn groot, en betrouwbaarheidscijfers
zijn niet systematisch gepubliceerd (ONBEVESTIGD per individuele aanbieder). Risico: veel van deze
wrappers zijn eenmansprojecten zonder SLA — een aanbieder die stopt is een harde, onaangekondigde
breuk voor wie erop bouwt.

---

## 3. yt-dlp en vergelijkbare open-source tools

**Werkt het nog in 2026?** Ja, met kanttekeningen. yt-dlp wordt actief onderhouden — releases
volgens een datum-gebaseerd versienummer, recentste geziene release `2026.08.19` [S35], met een
release-cadans van ongeveer eens per twee à drie weken op de stable branch (master-builds vaker,
volgens community-bronnen — ONBEVESTIGD als officiële uitspraak). De TikTok-extractor wordt als
"prima" (niet stuk) omschreven in recente community-bronnen, met de kanttekening dat een aantal
*secundaire* TikTok-extractors (`tiktok:effect`, `tiktok:sound`, `tiktok:tag`) wél als kapot
gemarkeerd stonden [via search, ONBEVESTIGD in primaire yt-dlp-bron].

**Concrete breekbaarheid — gedocumenteerd in open GitHub-issues:**
- IP-blokkades: "[TikTok] Your IP address is blocked from accessing this post" — gebruikers melden
  dit ongeacht of ze cookies gebruiken [S30].
- Herhaalde "Unable to extract webpage video data"-issues voor TikTok, ook mét browser-cookies
  [S31][S32][S33].
- CDN-URL's die yt-dlp teruggeeft zijn kortlevend (`?expire=`-parameter) en falen met HTTP 403 zonder
  de juiste `Referer`/`User-Agent`-headers en (vaak) een geldige sessie — meerdere losse issues
  documenteren dit specifieke faalpatroon voor zowel yt-dlp [S36][S37][S38] als vergelijkbare
  community-tools [S39].
- Instagram: cookies van een ingelogde browsersessie zijn in de praktijk vereist — zonder cookies
  is de uitkomst vaak een login-wall of lege extractie; sommige gebruikers wijken uit naar
  `gallery-dl` wanneer yt-dlp's Instagram-extractor faalt [via search, ONBEVESTIGD in primaire
  yt-dlp-bron; S34 bevestigt wel dat Instagram-download via yt-dlp mogelijk is].

**Datacenter-IP's geblokkeerd — klopt dat?** Grotendeels ja, maar het generieke patroon ("platforms
toetsen tegen publiek bekende IP-ranges van AWS/GCP/Azure/Hetzner/DigitalOcean") is niet aan één
primaire bron te herleiden — dat is een algemeen beschreven marktpatroon uit secundaire bronnen, dus
met enige onzekerheid gemarkeerd. Concreet en wél direct gedocumenteerd in een primaire bron: yt-dlp
issue #16605 toont exact dit IP-blokkade-symptoom voor TikTok [S30].

**Residential proxying — kosten.** Bright Data's residentiële proxies: pay-as-you-go rond
**$5–$8,40/GB** op instapniveau, dalend naar **$3,50/GB** bij een $499-groeiplan en richting
**$2–3/GB** op enterprise-volume [S40]; bredere marktrange $8–15/GB wordt ook genoemd voor
sessie-gebonden/precisie-targeting varianten [S41]. Eigen rekensom (niet in een bron zo
gepresenteerd, dus expliciet als afgeleide berekening, niet als gepubliceerd cijfer): een
TikTok-video weegt ruwweg 5–20 MB; bij $5/GB en ~10 MB/video kom je op ~100 video's per GB, oftewel
**~$0,05 per video** aan pure bandbreedtekosten, exclusief de proxy-orkestratie en de scraping-logica
die je zelf moet bouwen en onderhouden. Dat is duurder dan Apify's geadverteerde $1,70/1.000
($0,0017/video) of ScrapeCreators' $0,99–$1,88/1.000 ($0,001–0,0019/video) — bij een derde-partij-
API zit de proxy-kost al verwerkt in de prijs per resultaat, en de operationele last (IP-rotatie,
header-onderhoud, CDN-URL-verval) verschuift naar de leverancier.

**Praktisch haalbaar server-side?** Voor een klein product: alleen met een betaalde residential-proxy-
laag erbovenop yt-dlp, plus doorlopend onderhoud van de extractor-versie en headers. Dat is
effectief hetzelfde bouwwerk als wat Apify/ScrapeCreators al leveren, alleen zelf gebouwd en zelf
onderhouden — voor een klein team is dat waarschijnlijk niet de efficiëntste inzet van tijd, tenzij
volume zo hoog wordt dat de per-call-prijs van een derde-partij-API duurder uitpakt dan eigen
infrastructuur (kruispunt niet berekend — hangt af van werkelijk volume, ONBEVESTIGD wat dat
kruispunt precies is voor Remy).

---

## 4. Wat krijg je precies terug, per route

| Route | Metadata | Thumbnail | Videobestand | Audiotrack | Kant-en-klaar transcript/ondertitels | Bron |
|---|---|---|---|---|---|---|
| TikTok oEmbed (huidige implementatie) | Ja (titel, auteur) | Ja | Nee | Nee | Nee | oEmbed-spec, `src/lib/oembed.ts` |
| Instagram oEmbed (huidige implementatie) | Ja | Ja | Nee | Nee | Nee | idem |
| TikTok Display API | Ja, maar alleen eigen account | — | Nee | Nee | Nee | S4 S5 S6 |
| TikTok Research API | Ja | — | Nee (metadata only) | Nee | **Ja — `voice_to_text`-veld** | S2 |
| Instagram Graph API | Ja, alleen eigen professionele account | Ja | Ja (eigen media, via andere endpoints) | via videobestand | Nee | S12 S13 |
| Apify `clockworks/tiktok-scraper` | Ja | Ja | Ja (optioneel, +$0,001/video) | via videobestand | **Ja — `subtitleLinks` (TikTok's eigen ondertitelbestand)** | S16 |
| Apify Instagram-downloader-actors | Ja | Ja | Ja (soms herhost, geen verlooptijd) | via videobestand | Nee (niet gevonden) | S20 S21 S22 |
| ScrapeCreators TikTok | Ja | ONBEVESTIGD | ONBEVESTIGD | ONBEVESTIGD | **Ja — apart transcript-endpoint** | S24 |
| ScrapeCreators Instagram | Ja | ONBEVESTIGD | ONBEVESTIGD | Nee (alleen transcript, geen videobestand) | **Ja — AI-transcript, alleen <2 min video's** | S25 |
| yt-dlp (TikTok) | Ja | Ja | Ja (bij succes) | via videobestand | Beperkt — leest TikTok's eigen ondertitelspoor indien aanwezig; geen eigen ASR | [via search, ONBEVESTIGD in primaire bron] |
| yt-dlp (Instagram) | Ja | Ja | Ja (bij succes, cookies vaak vereist) | via videobestand | Nee | S34 |

Voor "on-screen tekst" (tekst die in beeld staat, niet gesproken) geeft **geen enkele** van deze
routes iets kant-en-klaars terug — dat vereist altijd een eigen OCR-stap op de videoframes, ongeacht
welke acquisitieroute je kiest. Dat is extractie, niet acquisitie, en valt buiten deze scope.

---

## 5. Breekbaarheid en onderhoud

| Route | Onderhoudslast bij jou | Wat breekt typisch | Frequentie |
|---|---|---|---|
| Officiële APIs (Display/Graph/Research) | Laag technisch, maar toegang zelf is het probleem — geen onderhoud lost het "niet-eigen-account"-probleem op. | Scope-/beleidswijzigingen (zeldzaam, wel hoog-impact — zie Basic Display API-uitfasering). | Laag, maar destructief wanneer het gebeurt. |
| yt-dlp zelf gehost | Hoog: eigen proxy-laag, eigen monitoring op extractiefouten, eigen upgrade-discipline (community raadt regelmatig updaten aan gezien de release-cadans) [S35]. | CDN-URL-formaat, headers, cookie-vereisten, IP-blokkades [S30][S31][S32][S33][S36][S37][S38]. | Continu — meerdere open issues per platform-wijziging. |
| Apify-actors | Laag: leverancier repareert de extractor; jij merkt alleen een tijdelijke verhoogde faalratio (vgl. 92,8% success rate) [S16]. | Actor kan tijdelijk falen tijdens een platform-wijziging, herstelt doorgaans binnen dagen. | Matig, buiten je eigen controle. |
| ScrapeCreators | Laag, zelfde argument als Apify — expliciet gepositioneerd als "developers who won't babysit scrapers" [S27]. | Idem. | Matig, buiten je eigen controle. |
| RapidAPI-eenmansprojecten | Middel tot hoog: geen SLA, aanbieder kan zonder aankondiging stoppen. | Aanbieder-specifiek, niet systematisch gedocumenteerd. | Onvoorspelbaar. |

**Netto voor een klein product als Remy:** zelf yt-dlp draaien is de goedkoopste optie in
theorie, maar verschuift alle onderhoudslast (extractor-updates, proxy-rotatie, header-tuning, IP-
blokkade-monitoring) naar het eigen (kleine) team — een continue, niet-triviale kostenpost in
engineering-tijd, los van de directe geldkosten van residential proxies (~$0,05/video, zie §3). Een
betaalde derde-partij-API (ScrapeCreators voor transcript-first gebruik, of Apify voor
video+ondertitel-first gebruik) kost meer per call, maar koopt expliciet in dat die onderhoudslast
bij de leverancier ligt. Beide paden blijven, zonder uitzondering, buiten de officiële ToS van beide
platforms [S9][S11][S15] — dat is een blijvend operationeel risico (account-/IP-blokkade van de
scraper, prijswijziging, of stopzetting van de dienst), niet een eenmalig juridisch obstakel dat je
passeert en dan vergeet.

---

## Bronnen

1. TikTok for Developers — Research API, Getting Started. https://developers.tiktok.com/docs/en/research-api-get-started
2. TikTok for Developers — Research API, Query Videos spec (bevat `voice_to_text`-veld). https://developers.tiktok.com/docs/en/research-api-specs-query-videos
3. TikTok for Developers — Research API productpagina (toelatingscriteria). https://developers.tiktok.com/products/research-api/
4. TikTok for Developers — Display API, Get Started. https://developers.tiktok.com/docs/en/display-api-get-started
5. TikTok for Developers — Display API Overview. https://developers.tiktok.com/docs/en/display-api-overview
6. TikTok for Developers — API v2 Video List. https://developers.tiktok.com/doc/tiktok-api-v2-video-list
7. TikTok for Developers — Content Posting API, Get Started. https://developers.tiktok.com/doc/content-posting-api-get-started
8. TikTok for Developers — API v2 Rate Limits (officieel, 600 req/min sliding window). https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit
9. TikTok — Terms of Service (US). https://www.tiktok.com/legal/page/us/terms-of-service/en
10. TikTok — "How We Combat Unauthorized Data Scraping of TikTok". https://www.tiktok.com/privacy/blog/how-we-combat-scraping/en
11. TikTok — Research Tools Terms of Service. https://www.tiktok.com/legal/page/global/terms-of-service-research-api/en
12. Meta for Developers — Instagram Media Endpoint Reference. https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/
13. Meta for Developers — Instagram Platform Overview. https://developers.facebook.com/docs/instagram-platform/overview/
14. Meta for Developers — Graph API Rate Limiting (officiële BUC-formule). https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
15. Meta — Automated Data Collection Terms. https://www.facebook.com/legal/automated_data_collection_terms
16. Apify — clockworks/tiktok-scraper (actor-pagina, pricing + subtitleLinks + succes-percentage). https://apify.com/clockworks/tiktok-scraper
17. Apify — clockworks/tiktok-scraper, pricing-discussie ($0,001/gedownloade video). https://apify.com/clockworks/tiktok-scraper/issues/pricing-structure-GgJ2G0RqYUCNMHEpp
18. Apify — apidojo/tiktok-scraper. https://apify.com/apidojo/tiktok-scraper
19. Apify — xtdata/tiktok-scraper. https://apify.com/xtdata/tiktok-scraper
20. Apify — memo23/instagram-video-downloader. https://apify.com/memo23/instagram-video-downloader
21. Apify — igview-owner/instagram-video-downloader. https://apify.com/igview-owner/instagram-video-downloader
22. Apify — lance_api/instagram-reels-downloader-api. https://apify.com/lance_api/instagram-reels-downloader-api
23. Apify — apidojo/instagram-scraper. https://apify.com/apidojo/instagram-scraper
24. ScrapeCreators — homepage/pricing. https://scrapecreators.com/
25. ScrapeCreators — Instagram Transcript API docs. https://docs.scrapecreators.com/v2/instagram/media/transcript/
26. ScrapeCreators — TikTok Video Info docs (beperkt geverifieerd). https://docs.scrapecreators.com/v1/tiktok/video/info
27. ScrapeCreators — blog, "Best Social Media Scraping APIs". https://scrapecreators.com/blog/best-social-media-scraping-apis
28. RapidAPI — 7scorp TikTok Downloader pricing. https://rapidapi.com/7scorp-7scorp-default/api/tiktok-downloader-download-tiktok-videos-without-watermark/pricing
29. yt-dlp — GitHub repository. https://github.com/yt-dlp/yt-dlp
30. yt-dlp — Issue #16605, "[TikTok] Your IP address is blocked from accessing this post". https://github.com/yt-dlp/yt-dlp/issues/16605
31. yt-dlp — Issue #15566, "Titkok -- unable to extract webpage video data". https://github.com/yt-dlp/yt-dlp/issues/15566
32. yt-dlp — Issue #15418, "[TikTok] Unable to extract webpage video data". https://github.com/yt-dlp/yt-dlp/issues/15418
33. yt-dlp — Issue #15629, "Unable to extract data" (TikTok). https://github.com/yt-dlp/yt-dlp/issues/15629
34. ytdlp.org — "How to download Instagram videos and Reels with yt-dlp". https://ytdlp.org/guides/yt-dlp-for-instagram
35. yt-dlp — Release 2026.08.19. https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19
36. yt-dlp — Issue #12641, TikTok CDN-URL 403 Forbidden. https://github.com/yt-dlp/yt-dlp/issues/12641
37. yt-dlp — Issue #13771, TikTok 403 bij direct downloaden. https://github.com/yt-dlp/yt-dlp/issues/13771
38. yt-dlp — Issue #9789, TikTok HTTP 403 bij web formats. https://github.com/yt-dlp/yt-dlp/issues/9789
39. drawrowfly/tiktok-scraper — Issue #305, video-downloads 403 (referer-header). https://github.com/drawrowfly/tiktok-scraper/issues/305
40. dataresearchtools.com — Bright Data Pricing 2026. https://dataresearchtools.com/bright-data-pricing-2026/
41. aimultiple.com — "How Much Does a Proxy Cost in 2026?". https://aimultiple.com/proxy-pricing
42. Apify — linen_snack/tiktok-subtitles-extractor (OpenAPI-definitie). https://apify.com/linen_snack/tiktok-subtitles-extractor---download-captions-from-any-video/api/openapi
43. TokCaption — TikTok subtitle downloader (illustreert dat TikTok een ondertitelspoor publiek blootstelt). https://www.tokcaption.com/tiktok-subtitles

**Interne bronnen (Remy-repo):**
- `src/lib/oembed.ts` — huidige, geïmplementeerde oEmbed-client (caption/thumbnail-only).
- `src/domain/import/buildExtractionRequest.ts` — huidige caption-only extractieprompt.
- `docs/PRODUCT-DECISIONS.md`, PD-007 — eerdere vaststelling dat geen officiële API een browsbare
  feed van niet-eigen content mogelijk maakt; basis voor de opt-in-only Feed-beslissing.
