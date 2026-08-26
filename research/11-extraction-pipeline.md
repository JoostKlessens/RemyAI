# Extractie-pipeline: van audio/video naar gestructureerd recept

Onderzoeksdatum: 2026-08-25. Alle prijzen zijn opgehaald van officiële pricing-/docpagina's op deze datum en veranderen regelmatig — vóór het bouwen opnieuw verifiëren. Scope: uitsluitend de extractie-pipeline (ASR, OCR, video-LLM, fusie, kosten, faalgevallen), gegeven dat audio/frames al beschikbaar zijn. Geen juridisch of concurrentie-onderzoek.

## Kernconclusie

**Aanbeveling: "Gebalanceerd"** — Deepgram Nova-3 (Nederlands monolingual, $0,004/min) voor spraak + Google Cloud Vision OCR op 5-6 scene-detected keyframes ($0,009) + Claude Sonnet 5 als fusiemodel met een uitgebreid `report_recipe`-schema dat per veld een brontag (`caption`/`transcript`/`on_screen_text`) en een grounding-check verplicht (~$0,010). **Totaal ≈ $0,023 (~€0,021) per import van 60 seconden video, latency ~12-20s.** Dit bouwt direct voort op het bestaande anti-hallucinatiepatroon in `buildExtractionRequest.ts`/`validateParsed.ts` (twee-tools-forceren, verbatim kopiëren, expliciete "geen recept"-uitweg) — nu uitgebreid naar drie bronnen in plaats van één.

De goedkope variant (Groq Whisper + self-hosted OCR) kost ~$0,005 maar heeft een reëel, gedocumenteerd hallucinatierisico bij Whisper op muziek/stilte [S16]. De maximale-kwaliteit variant (Gemini video-native, 2× self-consistency + kruiscontrole) kost ~$0,11 en is alleen te rechtvaardigen voor moeilijke/betwiste imports, niet als default. Zie tabel in §5.

**Aanvulling (platform-ondertitels, zie §1a):** TikTok's gratis `subtitleLinks`-spoor is een nuttige *opportunistische* eerste stap binnen de aanbevolen pipeline (kost niets extra bovenop de toch al noodzakelijke scrape), maar verandert het kostenplaatje nauwelijks — TikTok's en Instagrams officiële talenlijsten voor automatische ondertiteling bevatten in geen enkele gevonden bron (2021-medio 2026) Nederlands, dus de verwachte hit-rate van een bruikbaar NL-spoor is naar verwachting laag en het meeste verkeer valt terug op betaalde ASR ($0,0043/min bij Deepgram) — zie §1a.3 en de herziene tabel in §5.

---

## 1. Spraak naar tekst (ASR)

| Provider / model | Prijs/min (batch) | Nederlands | Achtergrondgeluid/muziek |
|---|---|---|---|
| OpenAI Whisper (`whisper-1`) | $0,006/min [S1] | Ondersteund; officiële WER-tabel per taal is een afbeelding, geen tekstwaarden — Nederlandse WER **ONBEVESTIGD** exact, maar Whisper large-v3 zit doorgaans in de middenmoot voor Germaanse talen (Duits ~4,9%, Engels ~4,7-5,6% WER op Common Voice15/FLEURS in onafhankelijke benchmarks) [S19][S20] | Zwak: gedocumenteerd hallucinatiegedrag bij stilte en achtergrondmuziek — herhaalde zinnen, verzonnen tekst; mediane WER kan oplopen tot 4x hoger op "vuile" audio dan op schone audio [S16]. Grotere modellen (large > medium > small) zijn robuuster [S17]. |
| OpenAI `gpt-4o-transcribe` | $0,006/min ($2,50/$10 per MTok) [S1] | Nieuwer multimodaal model, geen aparte NL-cijfers gevonden — **ONBEVESTIGD** | Niet apart benchmarked in dit onderzoek — **ONBEVESTIGD** |
| OpenAI `gpt-4o-mini-transcribe` | $0,003/min ($1,25/$5 per MTok) [S1] | **ONBEVESTIGD** | **ONBEVESTIGD** |
| Groq — Whisper large-v3-turbo (hosted) | **$0,04/uur = $0,00067/min** [S2] | Zelfde onderliggende Whisper-gewichten, dus zelfde taalkwaliteit/risico's als OpenAI Whisper | Zelfde hallucinatierisico als open-source Whisper large-v3-turbo (identiek model, alleen sneller gehost — 216× realtime [S2]) |
| Deepgram Nova-3 (monolingual `nl`) | **$0,0043/min** batch (pre-recorded); multilingual variant $0,0052/min [S3] | Expliciet Nederlands-model sinds 2025-uitbreiding, met gerapporteerde WER/KRR-verbetering t.o.v. Nova-2 (exacte %-cijfers alleen als grafiek gepubliceerd, niet als tekst — **ONBEVESTIGD** precies getal) [S4][S5] | Vendor claimt sterke ruisonderdrukking; niet onafhankelijk geverifieerd in dit onderzoek — **ONBEVESTIGD** |
| AssemblyAI Universal-2 | **$0,15/uur = $0,0025/min** [S5]; Universal-3.5 Pro $0,21/uur | Ondersteunt Nederlands incl. dialecten (Vlaams, Surinaams-Nederlands) binnen het 99-talenmodel [S6] | Niet apart benchmarked — **ONBEVESTIGD** |
| Gemini 2.5 Flash (audio-only input) | 32 tokens/sec audio × $1,00/1M tokens (standaard) = **~$0,0019/min**; Flash-Lite: ~$0,0006/min [S9][S12] | Onderdeel van algemene multimodale kwaliteit, geen aparte NL-ASR-benchmark gevonden — **ONBEVESTIGD** | **ONBEVESTIGD** — geen specifieke robuustheidscijfers gevonden |
| Zelf-hosted `faster-whisper` (eigen GPU) | Marginale compute-kosten, geen API-fee; community-benchmark op RTX 3090 geeft ~$0,003/audiominuut aan cloud-GPU-kosten [S21] (secundaire bron, **ONBEVESTIGD** als productie-cijfer) | Zelfde Whisper-gewichten dus zelfde taalkwaliteit als hierboven | Zelfde hallucinatierisico als Whisper |

**Latency (60-90s clip, batch/pre-recorded):**
- Groq: near-instant compute (216-228× realtime → <1s aan reken­tijd voor 60-90s audio [S2]), reken 1-3s totaal met netwerk/queue.
- AssemblyAI async: "vast meerderheid van files klaar binnen 45 seconden", real-time-factor tot 0,008× (125× sneller dan audioduur) [S7].
- Deepgram: pre-recorded is doorgaans sub-lineair/near-realtime; geen exacte publieke SLA gevonden voor een 60-90s clip — **ONBEVESTIGD** exact getal, schat 2-6s.
- OpenAI Whisper API: batch-only, geen streaming; op basis van 216×-snelheidscijfers voor de turbo-variant is 1-5s voor een 1-minuutclip een redelijke schatting — **ONBEVESTIGD** exact, geen officiële latency-SLA gevonden [S27].

**Praktische implicatie voor Remy:** stel voor alle providers expliciet `language=nl` in plaats van auto-detect — voorkomt taalwissel-fouten bij code-switching (NL-creators die Engelse merk-/ingrediëntnamen door hun Nederlands heen gebruiken, wat vaker voorkomt in food-content dan in generieke spraak).

---

## 1a. Platform-eigen ondertitelsporen (losse subtitle-tracks — geen ingebrande tekst)

Dit is een ander signaal dan de ingebrande on-screen tekst in §2: TikTok (en mogelijk Instagram) genereert zelf een spraak-naar-tekst-ondertitelspoor per video — een los, tijdgestempeld bestand, niet in de pixels gebakken, dat de kijker aan/uit kan zetten. Als zo'n spoor bestaat, bruikbaar is, én in het Nederlands is, is het ophalen ervan vrijwel gratis: het komt mee met de sowieso al noodzakelijke stap waarin het platform gescraped wordt om aan video/audio te komen (die stap valt buiten de scope van dit rapport — zie inleiding), dus er is geen aparte, betaalde ASR-call voor nodig.

### 1a.1 Hoe je erbij komt

**TikTok:** de Apify-actor `clockworks/tiktok-scraper` (en verwante actors van dezelfde auteur) geeft per video een `videoMeta.subtitleLinks`-array terug met per beschikbaar spoor: `language` (bv. `"kor-KR"`), `downloadLink`/`tiktokLink` (directe URL naar het bestand), `source` (bv. `"ASR"` voor automatisch-gegenereerd via spraakherkenning, `"MT"` voor machinevertaling van een ander spoor) en `version`. Het downloaden van dit spoor valt onder de standaard-extractie van de actor — geen extra kosten bovenop de gewone scrape-run; alleen wanneer je de actor's eigen AI-fallback-transcriptie inschakelt (voor video's zónder eigen TikTok-spoor) reken je een los "transcript"-event [S34][S40].

TikTok's officiële Research API kent een vergelijkbaar `voice_to_text`-veld ("voice to text and subtitles for videos that have voice to text features on") — voor Remy zelf niet bruikbaar (de Research API is alleen toegankelijk voor geaccrediteerde academische onderzoekers, geen commerciële consumer-apps), maar het bevestigt dat TikTok deze data intern structureel bijhoudt en dat ze potentieel exporteerbaar is [S35].

**Instagram:** in dit onderzoek is **geen** vergelijkbaar publiek/gedocumenteerd veld gevonden. Meerdere Instagram-"transcript"-scrapers op Apify vermelden expliciet dat Instagram geen ondertitelsporen publiek blootgeeft en dat zij daarom zelf audio downloaden en er Whisper overheen halen [S38] — functioneel dus gewoon eigen ASR onder een andere naam, niet een native Meta-ondertitelbestand. Voor Instagram Reels is er dus, voor zover uit dit onderzoek blijkt, geen "gratis" platform-ondertitel-kortpad zoals bij TikTok — **ONBEVESTIGD** dat zo'n intern veld helemaal niet bestaat (afwezigheid van bewijs is geen bewijs van afwezigheid), maar geen enkele geraadpleegde bron claimt het tegendeel.

### 1a.2 Formaat en tijdcodes

Bevestigd: WebVTT (en bij sommige community-scrapers ook SRT), met tijdgestempelde cues [S34][S40]. Dat is direct bruikbaar om een specifieke uitspraak te koppelen aan het bijbehorende keyframe uit §2 — bijvoorbeeld: een cue rond t=14,2s noemt "bloem", dus pak het dichtstbijzijnde scene-detected keyframe rond t≈14s voor de OCR-stap. Dat is een reëel voordeel boven zelf-gedraaide ASR zonder timestamps, al bieden Deepgram/AssemblyAI/Whisper desgewenst ook woord-niveau-timestamps (tegen dezelfde per-minuutprijs, zie §1) — het verschil zit dus niet in "kán tijdcodes geven" maar in "je hoeft er niet apart voor te betalen".

### 1a.3 Kwaliteit op Nederlands — de kernvraag

Dit is waar het optimistische scenario spaak loopt. TikTok's officiële aankondigingen noemen een expliciete, beperkte talenlijst voor automatische ondertiteling, en Nederlands staat daar in geen enkele gevonden bron in, van lancering tot de laatste vermelding gevonden in dit onderzoek:

- Lancering (6 april 2021, officiële TikTok Newsroom): alleen Amerikaans-Engels en Japans, "with additional language support in the coming months" [S29].
- Grote uitbreiding (21 juli 2022, officiële TikTok Newsroom, onafhankelijk bevestigd door The Verge en Android Central): "English, Portuguese, German, Indonesian, Italian, Korean, Mandarin, Spanish and Turkish" — negen talen, geen Nederlands [S30][S31][S32].
- Een latere, niet-officiële samenvatting (secundaire bron, **ONBEVESTIGD** als volledig/actueel) noemt een verder uitgebreide lijst — Chinees, Indonesisch, Koreaans, Thai, Duits, Italiaans, Turks, Russisch, Portugees, Arabisch, Frans, Spaans, Vietnamees, Tagalog, Nepalees — nog altijd zonder Nederlands.
- Nederlandstalige creator-gerichte bronnen bevestigen dit beeld vanuit de praktijk: geadviseerd wordt handmatig te transcriberen/ondertitelen omdat TikTok geen automatische ondertitels genereert in talen buiten de ondersteunde lijst [S39].
- TikTok's officiële supportpagina onderscheidt expliciet "Auto-generated captions" (spraakherkenning, taal vooraf te kiezen uit een lijst) van "Creator captions" (door de maker zelf getypt/bewerkt, los van spraakherkenning) [S33] — zie de kanttekening hieronder.

Instagram's auto-generated captions ondersteunen volgens Meta's eigen 2022-aankondiging 17 talen (Engels, Spaans, Portugees, Frans, Arabisch, Vietnamees, Italiaans, Duits, Turks, Russisch, Thai, Tagalog, Urdu, Maleisisch, Hindi, Indonesisch, Japans) — ook hier ontbreekt Nederlands [S36]. De nieuwere AI-vertaal/dubbing-uitbreiding van Instagram Reels (gevolgd tot medio 2026) voegt onder meer Frans, Duits, Italiaans, Japans en Koreaans toe — wederom geen Nederlands gevonden in de geraadpleegde bronnen [S37].

**Conclusie:** geen van beide platforms noemt Nederlands in zijn officiële lijst van ondersteunde talen voor automatische ondertiteling, op geen enkel moment tussen 2021 en medio 2026 in de bronnen die in dit onderzoek gevonden zijn. Dit is geen 100%-sluitend bewijs dat een Nederlandstalige TikTok-video nooit een `subtitleLinks`-entry met `language` beginnend met `nl`/`nld` zal hebben (platforms breiden talenlijsten soms stilzwijgend uit), maar de bewijslast wijst sterk richting "niet ondersteund voor Nederlands als brontaal", en geen enkele bron claimt het tegendeel. Door de creator zelf getypte/gecorrigeerde "creator captions" kunnen in principe wél Nederlandstalig zijn — maar of zulke handmatige captions via `subtitleLinks` als apart, herkenbaar `source`-type worden blootgegeven (in plaats van alleen als ingebrande pixels, terug in OCR-territorium van §2), kon in dit onderzoek niet worden bevestigd — **ONBEVESTIGD**.

### 1a.4 Kwaliteitsrisico's specifiek voor platform-ondertitels (t.o.v. eigen ASR)

Zelfs in het gunstige geval dat er wél een bruikbaar Nederlands spoor bestaat (bv. via een handmatig gecorrigeerde creator caption, of een niet-aangekondigde taaluitbreiding), gelden risico's die je met een eigen, gecontroleerde ASR-aanroep niet hebt — dit beantwoordt vraag 5 van de coördinator:

- **Geen of minimale interpunctie.** Consumer-ondertitels zijn geoptimaliseerd voor leesbaarheid in korte regels op een telefoonscherm, niet voor grammaticale zinsstructuur — een aaneengesloten woordenstroom zonder komma's maakt het automatisch scheiden van ingrediënten onbetrouwbaar (bv. "tweehonderd gram bloem een half zakje bakpoeder twee eieren" zonder scheidingstekens). Deepgram/AssemblyAI leveren structurele interpunctie standaard als functie; er is geen aanwijzing dat platform-auto-captions dat evengoed doen.
- **Geen confidence-score per woord.** In tegenstelling tot Google Vision-OCR of Deepgram (die per woord/segment een betrouwbaarheidsscore teruggeven, bruikbaar voor de drempelwaarde-aanpak uit §6) is er geen gedocumenteerd confidence-veld op het platform-ondertitelspoor — je kunt dus niet automatisch filteren op "dit stuk was onzeker voor het model".
- **Getallen/eenheden kunnen fout of genormaliseerd zijn.** Consumer-captioning is getraind op breed platforminhoud (dans, comedy, vlogs), niet op culinaire terminologie; merk- en ingrediëntnamen (bv. "Bertolli", "speculaaskruiden") vallen buiten dat trainingsdomein. Deepgram en AssemblyAI adverteren expliciet met domeinwoordenlijsten/keyword-boosting; er is geen aanwijzing dat TikTok's/Instagrams auto-captions dat ondersteunen.
- **ASR/MT/creator-edit lopen door elkaar.** Omdat `subtitleLinks` zowel `"ASR"`- als `"MT"`-sporen (machinevertaling van een ander spoor) kan bevatten, loop je zonder filtering het risico een terugvertaald — dus dubbel-lossy — spoor te gebruiken in plaats van het origineel. Expliciet filteren op `source == "ASR"` én `language` beginnend met `nl`/`nld` is dus verplicht, niet optioneel.
- **Geen garantie dat het spoor er is**, zelfs binnen een ondersteunde taal — TikTok's eigen aankondiging noemt dat de functie initieel alleen op "geselecteerde video's" beschikbaar was [S32]. Een lege/missende `subtitleLinks`-array is het normale, verwachte pad, geen foutcase.

Kortom: zelfs wanneer een spoor beschikbaar is, is het geen vervanging voor de per-veld grounding-check en brontag-aanpak uit §4 — behandel platform-ondertitels als "nog een bron met eigen ruis", nooit als geverifieerde grondtruth.

---

## 2. On-screen tekst (ingebrande ondertiteling/ingrediëntenlijst)

### Keyframe-selectie
Drie strategieën, oplopend in kosten en betrouwbaarheid:
1. **Vast interval** (bv. elke 3-5s): simpel, goedkoop, maar mist tekst die korter dan het interval in beeld staat en verspilt calls aan frames zonder tekst.
2. **Scene-detectie** (bv. PySceneDetect, open source, gratis, content-aware cut-detectie) [S18]: detecteert harde cuts tussen "shots" (bv. wissel van spreker naar tekst-overlay-shot) — geeft een klein, representatief aantal frames (~5-8 voor een 60s Reel) zonder near-duplicates.
3. **Laatste frame vóór elke cut / langst-stilstaande frame**: verfijning bovenop scene-detectie — pakt het frame waar tekst het langst en scherpst in beeld staat (minder motion blur), relevant omdat veel recept-Reels tekst laten "inzoomen" of vasthouden vlak vóór de cut.

Aanbeveling: scene-detectie (PySceneDetect, `detect-content`) + laatste-frame-heuristiek. Kosten: verwaarloosbaar (open source, CPU, enkele seconden voor een 60s clip) [S18].

### OCR-opties

| Optie | Prijs | Sterktes/zwaktes |
|---|---|---|
| Tesseract (open source, self-hosted) | Gratis, marginale compute | Snelst (453ms/beeld CPU), maar zwakst op lage kwaliteit/gestileerde tekst (58% accuracy op lage-kwaliteit scans in één 2025-benchmark vs. 82% voor PaddleOCR) [S22] |
| PaddleOCR (open source, self-hosted) | Gratis, marginale compute | Beter op tabellen, lage kwaliteit, multilingual — maar 4-5× trager dan Tesseract (2143ms/beeld CPU) [S22]. Geen aparte Nederlandse benchmark gevonden — **ONBEVESTIGD** |
| Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) | $1,50/1000 units = **$0,0015/frame** boven gratis tier van 1000/maand [S8] | Cloud-OCR met per-woord confidence scores — bruikbaar voor drempelwaarde-gebaseerde validatie |
| AWS Textract (`DetectDocumentText`) | $1,50/1000 pagina's = **$0,0015/frame** (eerste 1M) [S9] | Vergelijkbaar prijsniveau als Google Vision; sterker op documentlay-out, minder relevant voor korte video-tekstoverlays |
| Vision-LLM op keyframes (Claude/Gemini/GPT) | Zie berekening hieronder | Begrijpt *context* (weet dat "200g" bij "bloem" hoort, ook als OCR de layout doorelkaar haalt), maar duurder per frame en met eigen hallucinatierisico als je het los laat lopen zonder brontekst-verificatie |

**Vision-LLM kostenvoorbeeld (Claude Sonnet 5):** een 1920×1080-keyframe wordt op standaard-resolutie gedownscaled naar 1456×819 px = 1560 visual tokens [S14]. Bij $2/MTok input: **~$0,0031 per frame**. Voor 6 frames: ~$0,019 — duurder dan cloud-OCR ($0,009 voor 6 frames) maar met ingebouwd tekstbegrip in plaats van kale strings.

**Kwaliteit van video-OCR in het algemeen:** de MME-VideoOCR-benchmark (18 multimodale LLM's getest op OCR-in-video-taken) laat zien dat zelfs het best scorende model (Gemini 2.5 Pro) slechts 73,7% haalt, en dat modellen zwakker presteren zodra tekst over meerdere frames verspreid staat of cross-frame-redenering nodig is [S15]. Dit geldt naar analogie ook voor los-toegepaste vision-LLM-OCR op keyframes: betrouwbaar voor een enkel, scherp, stilstaand tekstframe; onbetrouwbaarder bij snelle cuts of tekst die "inrolt".

---

## 3. Video direct naar model (Gemini)

Gemini rekent video in tokens op basis van framerate + audio, niet per API-call [S11]:
- **Default resolutie:** ~300 tokens/seconde video (258 tokens/frame @1fps + 32 tokens/sec audio) [S11].
- **Lage resolutie:** ~100 tokens/seconde video (66 tokens/frame + 32 tokens/sec audio) [S11].
- Audio-only (los, zonder beeld): 32 tokens/seconde = 1920 tokens/minuut [S12].

**Kosten 60s video, default resolutie, Gemini 2.5 Flash:** 300×60 = 18.000 tokens input × $0,30/MTok (text/image/video-tarief) [S10] = **$0,0054**, plus output (~700 tokens recept-JSON × $2,50/MTok) ≈ $0,002 → **totaal ~$0,007 per video-call**. Met Gemini 3.1 Pro Preview (hogere kwaliteit, $2,00/MTok ≤200k context) [S10]: 18.000 × $2,00/MTok = $0,036 + output ~$0,0084 → **~$0,044 per call**.

Dit is dus **goedkoper dan de gesplitste aanpak** in ruwe tokenkosten (vooral met Flash), omdat één model-call zowel beeld als geluid in dezelfde tokenstroom verwerkt zonder aparte ASR-/OCR-facturen. De prijs-kwaliteit-afweging zit niet in kosten maar in **betrouwbaarheid**: video-OCR haalt in benchmarks ~74% op het best scorende model [S15], en een video-native model heeft geen aparte, controleerbare tussenstap (transcript, OCR-tekst) die je tegen elkaar kunt afzetten voor een grounding-check — het "verzint" beeld en geluid direct door naar een antwoord, wat het moeilijker maakt om achteraf te bewijzen dat een hoeveelheid ergens *daadwerkelijk* genoemd is.

**Andere modellen met (zeer) korte video-input:** Claude ondersteunt **geen** native video- of audio-invoer — de Messages API kent alleen `image`-blocks (JPEG/PNG/GIF/WebP) en documenten, geen video/audio content-type [S14]; workarounds bestaan alleen als losse frame-extractie + aparte ASR (dus feitelijk de gesplitste aanpak, niet "video direct naar model"). OpenAI's GPT-modellen hebben op moment van onderzoek geen breed beschikbare directe-video-input-API voor korte clips zoals Gemini die heeft; audio wel (zie §1). Gemini is dus praktisch de enige aanbieder met een volwaardige, geprijsde video-native invoer voor dit gebruik.

**Praktisch risico:** File API-uploadlatency voor Gemini is niet consistent gedocumenteerd — één community-rapport meldde een 30s-video die soms in enkele seconden en soms in "tientallen minuten" verwerkte (forumbron, **ONBEVESTIGD**, niet in bronnenlijst opgenomen wegens lage betrouwbaarheid). Voor `inline data` (<100MB, <1 min, wat een 60s Reel typisch is) raadt Google zelf inline invoer aan boven de File API, wat de uploadstap überhaupt vermijdt [S11].

---

## 4. Fusie van drie tegensprekende bronnen

Het probleem is precies wat de bestaande caption-only pipeline al gedeeltelijk oplost, maar dan met drie bronnen: caption, transcript, on-screen tekst kunnen elkaar tegenspreken (`200 g` vs. `een half pakje` vs. een ingebrand `250gr`), en een fusiemodel dat gedwongen wordt één antwoord te geven, verzint dan stilzwijgend een compromis.

### Wat de huidige code al goed doet (uitbreidbaar)
`src/domain/import/buildExtractionRequest.ts` gebruikt nu al twee kernpatronen die één-op-één naar multi-bron-fusie doorgetrokken kunnen worden:
1. **Twee mutually-exclusive tools + `tool_choice: any` + `disable_parallel_tool_use: true`** — het model kan niet hedgen met proza of met beide tools tegelijk.
2. **Verbatim-kopiëren, nooit schatten**: `quantity`/`unit` worden letterlijk overgenomen of `null`, nooit afgeleid. `validateParsed.ts` faalt de hele parse bij structurele twijfel in plaats van een half leeg recept door te laten.

### Uitbreiding voor drie bronnen — concrete technieken uit de literatuur

1. **Per-veld bronattributie in het schema.** Voeg aan elk ingrediënt een `source: "caption" | "transcript" | "on_screen_text"` en, bij conflict, een `alternatives: [{value, unit, source}]`-array toe in plaats van één stilzwijgend gekozen waarde. Dit dwingt het model expliciet te *rapporteren* dat er een conflict is in plaats van het op te lossen — vergelijkbaar met de bestaande `report_no_recipe`-uitweg, maar dan op veldniveau.
2. **Grounding-check (verplicht citeren).** Vraag voor elk numeriek veld een kort, letterlijk citaat uit één van de drie ruwe brontensten. Valideer *buiten* het model om (net als `validateParsed.ts` nu al doet) dat dat citaat daadwerkelijk als substring in de meegegeven brontekst voorkomt; zo niet, verwerp het veld. Dit is een goedkope, deterministische maatregel tegen het meest voorkomende hallucinatiepatroon: een plausibel maar nergens genoemd getal.
3. **Deterministische voorrangsregel als tie-breaker, geen LLM-gok.** Tekst-gebaseerde bronnen (caption, OCR) zijn feitelijk minder foutgevoelig voor exacte getallen dan spraak (ASR verhoort cijfers, met name bij snel gesproken Nederlands); een simpele regel — "als caption én on-screen tekst overeenstemmen, gebruik die; noteer transcript-waarde alleen als geen van beide een getal geeft" — hoeft niet door het LLM zelf beslist te worden en is dus 100% voorspelbaar en auditeerbaar.
4. **Self-consistency (Wang et al., 2022, arXiv:2203.11171 [S25]).** Roep de fusiestap 2-3× aan (of varieer temperature/volgorde van bronnen) en accepteer een veld alleen als de meerderheid het eens is; bij divergentie: flag voor review in plaats van de eerste output te vertrouwen. Kost een factor 2-3× meer tokens, dus alleen zinvol voor de "maximale kwaliteit"-variant of specifiek voor velden die al gevlagd zijn door de grounding-check.
5. **Per-veld confidence/trustworthiness scoring.** Twee recente (2026) arXiv-papers zijn hier direct toepasbaar: "Real-Time Trustworthiness Scoring for LLM Structured Outputs and Data Extraction" [S23] en "Beyond Logprobs: A Multi-Signal Confidence Engine for LLM-Based Document Field Extraction" [S24]. Beide combineren meerdere signalen (log-probabilities, self-consistency-agreement, en — belangrijk voor dit domein — expliciete "ik kon dit niet goed lezen"-signalen zoals lage OCR-confidence of stille/muzikale passages in de ASR) tot een per-veld score, en tonen aan dat log-probability alléén een zwakke voorspeller is (ROC-AUC 0,705 op een 55-veld-benchmark, degenereert bij praktische drempels [S24]) — dus niet vertrouwen op logprobs alleen. Praktisch: sla per veld een simpele score op (bv. "in 2 van 3 bronnen genoemd, waarden komen overeen" = hoog; "alleen in transcript, geen citaat elders" = laag) en toon lage-score-velden in de UI als "twijfelachtig, controleer" in plaats van ze stil te presenteren als zeker.
6. **Semantische entropie (Farquhar et al., Nature 2024 [S26])** is de meer onderzoeksmatige variant van hetzelfde idee — clustert betekenis-equivalente antwoorden en meet entropie over de clusters in plaats van over exacte tokens. Interessant voor toekomstige iteratie, maar zwaarder (vereist meerdere generaties + NLI-clustering) dan nodig is voor een MVP; de eenvoudigere self-consistency + grounding-check-combinatie hierboven dekt het praktische geval al grotendeels.

**Concreet schema-voorstel** (uitbreiding van het bestaande `report_recipe`-schema):
```
ingredient: {
  name: string,
  quantity: string | null,
  unit: string | null,
  source: "caption" | "transcript" | "on_screen_text",
  sourceQuote: string,          // verbatim citaat, extern gevalideerd tegen ruwe brontekst
  conflicting: [{ value, unit, source }] | null   // gevuld als bronnen elkaar tegenspreken
}
```
De UI kan dan bij `conflicting !== null` de gebruiker laten kiezen ("caption zegt 200 g, in de video hoor je 'een half pakje' — welke bedoel je?") in plaats van dat het systeem zelf een keuze verzint.

---

## 5. Kosten en latency per import (60 seconden video)

Alle bedragen berekend uit de officieel geverifieerde per-eenheid-prijzen hierboven; token-aantallen voor de fusiestap zijn schattingen voor een representatief recept (transcript ~150 woorden, 4-6 OCR-frames, recept met 6-10 ingrediënten) en dus **indicatief**, niet gegarandeerd.

| Variant | ASR | On-screen tekst | Fusie-LLM | Berekening | **Totaal/import** | Latency (schatting) | Verwachte kwaliteit |
|---|---|---|---|---|---|---|---|
| **0. Platform-ondertitels eerst** *(opportunistische laag bovenop "Gebalanceerd")* | Poging 1: TikTok `subtitleLinks` (§1a) — ~$0 marginaal (al onderdeel van de scrape). Poging 2 (fallback bij ontbrekend/niet-nl/leeg spoor): Deepgram Nova-3 nl — $0,0043 | PySceneDetect + Google Vision OCR, 6 frames — $0,009 (blijft altijd nodig, zie §1a-intro) | Claude Sonnet 5 + brontag-schema, bron getagd als `platform_caption` of `own_asr` — $0,010 | Gunstig: 0+0,009+0,010. Ongunstig (fallback): 0,0043+0,009+0,010 | **$0,019 (gunstig) tot $0,023 (ongunstig, = gelijk aan "Gebalanceerd")** | ~10-20s (gunstig, geen ASR-call nodig) tot ~12-20s (fallback) | Verwacht overwegend gelijk aan "Gebalanceerd", want het gunstige pad is voor Nederlandstalige content naar verwachting zeldzaam — zie toelichting hieronder |
| **Goedkoop** | Groq Whisper large-v3-turbo — $0,00067 | Self-hosted PaddleOCR/Tesseract, vast interval, ~$0 marginaal | Claude Haiku 4.5, ~1200 in / 500 out tokens → $0,0037 | 0,00067+0+0,0037 | **~$0,004-0,005** | ~8-15s | Matig — Whisper hallucineert aantoonbaar bij muziek/stilte [S16]; self-hosted OCR zwakker op bewogen/gestileerde tekst; geen per-veld confidence in fusie |
| **Gebalanceerd** *(aanbevolen)* | Deepgram Nova-3 nl — $0,0043 | PySceneDetect + Google Vision OCR, 6 frames — $0,009 | Claude Sonnet 5 + brontag-schema, ~1500 in / 700 out → $0,010 | 0,0043+0,009+0,010 | **~$0,023 (~€0,021)** | ~12-20s | Goed — taal-specifiek ASR-model, OCR met confidence-scores, expliciete brontracering en conflict-detectie in fusie |
| **Maximale kwaliteit** | Gemini 3.1 Pro video-native ×2 (self-consistency) — $0,0888 + Deepgram als kruiscontrole $0,0043 | *(inbegrepen in video-call)* | Claude Sonnet 5 verificatie/reconciliatie, ~3000 in / 800 out → $0,014 | 0,0888+0,0043+0,014 | **~$0,107 (~€0,098)** | ~30-60s (afhankelijk van Gemini-uploadlatency, **ONBEVESTIGD** exacte SLA) | Hoogst — twee onafhankelijke modaliteiten (video-native + los ASR) plus self-consistency verkleint kans op een niet-gegronde waarde drastisch, maar blijft duurder en trager |

**Toelichting bij variant 0 — hoeveel verandert dit echt?** Minder dan gehoopt. Twee redenen:

1. **Het plafond van de besparing is al klein.** Deepgram Nova-3 (Nederlands) kost $0,0043 per minuut — dat is het enige bedrag dat variant 0 kan wegstrepen. Op een totaal van $0,023 is dat maximaal ~19% besparing per import, nooit meer, want de OCR-stap ($0,009) en de fusiestap ($0,010) blijven sowieso nodig: on-screen ingrediëntentekst is een aparte bron dan het gesproken-woordspoor, en die twee vervangen elkaar niet (dat is precies het punt uit de bevinding van de coördinator — het gaat om iets anders dan §2's ingebrande tekst, niet om een vervanging ervan).
2. **Het gunstige pad treedt naar verwachting zelden op voor Nederlandstalige content.** Zoals in §1a.3 onderbouwd met TikTok's en Instagrams eigen taalaankondigingen (2021-medio 2026), staat Nederlands in geen enkele gevonden officiële talenlijst voor automatische ondertiteling. Het overgrote deel van de Nederlandstalige imports zal dus **ONBEVESTIGD, maar naar verwachting**, uitkomen op het "ongunstige" pad — d.w.z. functioneel identiek aan de "Gebalanceerd"-variant, met de gratis check als verwaarloosbare, maar kosteloze, eerste poging.

**Hoe je het percentage wél zou meten (in plaats van schatten):** neem een steekproef van bv. 100-200 recente Nederlandstalige receptvideo's van TikTok, draai `clockworks/tiktok-scraper` (of vergelijkbaar) erop, en meet het percentage video's waarbij `videoMeta.subtitleLinks` een niet-lege entry bevat met `source == "ASR"` én `language` beginnend met `nl`/`nld` (dus origineel, geen terugvertaling). Dat percentage is direct de empirische hit-rate voor variant 0's gunstige pad, en is met de tools van dit onderzoek (webonderzoek, geen live platformtoegang) niet zelf te produceren — vandaar de expliciete **ONBEVESTIGD**-markering hierboven in plaats van een geraden cijfer.

Ter referentie: de bestaande caption-only stap (Claude Sonnet 5, ~500-800 tokens in/uit) kost een fractie van een cent en blijft als eerste, goedkope pre-filter zinvol — alleen wanneer die stap `report_no_recipe` teruggeeft (of laag-confidence velden overhoudt) hoeft de duurdere audio/video-pipeline hierboven ingeschakeld te worden.

---

## 6. Faalgevallen: wanneer gaat dit gegarandeerd mis, en hoe detecteer je het

| Faalgeval | Trigger | Detectie | Reactie |
|---|---|---|---|
| ASR-hallucinatie bij stilte/muziek | Instrumentale intro/outro, lange muziekpassages zonder spraak | Herhaling-heuristiek (n-gram-repeat-ratio op de transcript-output — Whisper's bekende faalpatroon is exact dezelfde zin 5-7× herhalen [S16]); voice-activity-detection (VAD) vóór ASR om stille segmenten te markeren | Verwerp/negeer transcript-segment; val terug op caption + OCR alleen voor dat deel |
| Geen spraak, alleen tekst-op-scherm (ASMR-stijl cooking video) | Creator praat niet, toont alleen tekstkaarten | Transcript is leeg of extreem kort t.o.v. video­duur (woorden/minuut ver onder normale spreeksnelheid van 100-200 wpm) | Gewoon doorgaan met caption+OCR als enige bronnen; niet als fout behandelen |
| OCR-tekst onleesbaar door motion blur / snelle cuts / gestileerd font | Snel gemonteerde Reels, tekst die inrolt/uitzoomt | Per-woord confidence score van cloud-OCR (Google Vision/Textract geven dit terug); frames met confidence onder drempel negeren | Frame overslaan, niet forceren; als alle frames laag scoren: on-screen-tekst-bron leeg laten, niet gokken |
| On-screen tekst is incompleet (alleen ingrediëntnamen, geen hoeveelheden — "teaser"-stijl) | Veel gebruikte contentvorm op TikTok | Schema staat expliciet `quantity: null` toe zonder dat dit de hele parse laat falen (bestaand patroon in `validateParsed.ts`) | Nooit een ontbrekende hoeveelheid invullen vanuit "typisch voor dit gerecht"-kennis — exact het patroon dat het huidige systeemprompt al verbiedt, nu ook voor OCR-bron |
| Video-native model (Gemini) verzint een plausibele hoeveelheid die nergens letterlijk genoemd wordt | Model "ziet" een hoeveelheid ingrediënt in beeld en rondt af naar een precieze waarde die niet expliciet gezegd/getoond is | Grondingscheck (§4, techniek 2): elk numeriek veld moet een letterlijk citeerbaar fragment hebben; zonder citaat → veld afwijzen | Veld op `null` zetten i.p.v. plausibele schatting doorgeven |
| Taalwissel/code-switching (NL-spraak met Engelse merk-/ingrediëntnamen) | Veel voorkomend in Nederlandse food-content | Vergelijk ASR-taal-confidence per taal-hint; expliciet `language=nl` forceren i.p.v. auto-detect voorkomt dat het hele fragment naar Engels overschakelt | Bij lage taal-confidence: transcript als lage-prioriteit bron behandelen, caption/OCR zwaarder wegen |
| Video bevat helemaal geen recept (vlog, "wat ik in een dag eet", reactie-video) | Categorie die de bestaande caption-only pipeline al met `report_no_recipe` afvangt | Dezelfde uitweg moet op fusieniveau blijven bestaan: als geen van de drie bronnen concrete ingrediënten+stappen bevat, moet de fusiestap ook `report_no_recipe` kunnen teruggeven — niet gedwongen worden altijd een recept te vullen omdat er nu wél audio/video beschikbaar is | Zelfde principe als huidige systeemprompt: "correct, verwacht antwoord, geen fallback om te vermijden" |
| Drie bronnen spreken elkaar tegen zonder duidelijke winnaar | bv. caption "200 g", transcript "een half pakje", OCR toont "250gr" | Conflict-detectie in schema (§4) vult `conflicting`-array i.p.v. zwijgend te middelen/kiezen | Nooit automatisch middelen tot een vierde, verzonnen waarde; toon conflict in UI of kies via de deterministische tekst-boven-spraak-regel, nooit via een LLM-gok |

---

## Bronnen

1. OpenAI — API pricing (transcriptiemodellen: `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `gpt-transcribe`) — https://developers.openai.com/api/docs/pricing
2. Groq — Whisper Large v3 Turbo modeldocumentatie (prijs $0,04/uur, snelheid 216×) — https://console.groq.com/docs/model/whisper-large-v3-turbo
3. Deepgram — Pricing (Nova-3 pre-recorded $0,0043/min monolingual, $0,0052/min multilingual) — https://deepgram.com/pricing
4. Deepgram — "Deepgram Expands Nova-3 with German, Dutch, Swedish, and Danish Support" — https://deepgram.com/learn/deepgram-expands-nova-3-with-german-dutch-swedish-and-danish-support
5. AssemblyAI — Pricing (Universal-2 $0,15/uur, Universal-3.5 Pro $0,21/uur) — https://www.assemblyai.com/pricing
6. AssemblyAI — Supported languages (Nederlands incl. dialecten) — https://www.assemblyai.com/docs/supported-languages
7. AssemblyAI — FAQ: "How long does it take to transcribe a file?" (RTF/turnaround) — https://www.assemblyai.com/docs/faq/how-long-does-it-take-to-transcribe-a-file
8. Google Cloud — Vision API pricing (TEXT_DETECTION/DOCUMENT_TEXT_DETECTION $1,50/1000 units) — https://cloud.google.com/vision/pricing
9. AWS — Textract pricing (DetectDocumentText $1,50/1000 pagina's) — https://aws.amazon.com/textract/pricing/
10. Google — Gemini API pricing (alle modellen, audio/video-tarieven) — https://ai.google.dev/gemini-api/docs/pricing
11. Google — Gemini API video understanding (tokens/seconde video, inline vs. File API) — https://ai.google.dev/gemini-api/docs/video-understanding
12. Google — Gemini API audio documentatie (32 tokens/seconde audio) — https://ai.google.dev/gemini-api/docs/audio
13. Anthropic — Claude API pricing (Sonnet 5: $2/$10 per MTok) — https://platform.claude.com/docs/en/about-claude/pricing
14. Anthropic — Claude vision documentatie (image-tokenformule, ondersteunde formaten, géén video/audio-support) — https://platform.claude.com/docs/en/build-with-claude/vision
15. MME-VideoOCR — benchmark voor OCR-capaciteiten van multimodale LLM's in video (Gemini 2.5 Pro 73,7%) — https://mme-videoocr.github.io/
16. Deepgram — "Whisper-v3 Hallucinations on Real World Data" — https://deepgram.com/learn/whisper-v3-results
17. Gong et al. — "Whisper-AT: Noise-Robust Automatic Speech Recognizers are also Strong General Audio Event Taggers" — https://arxiv.org/abs/2307.03183
18. PySceneDetect — officiële projectpagina (open source scene-detectie) — https://www.scenedetect.com/
19. OpenAI Whisper — GitHub-repo (talenoverzicht, Common Voice15/FLEURS WER-grafiek) — https://github.com/openai/whisper
20. TheStageAI — "TheWhisper" benchmark README (multilingual WER-vergelijkingstabel) — https://github.com/TheStageAI/TheWhisper/blob/main/benchmark/README.md
21. GigaGPU — "Whisper Large-v3 on RTX 3090: Transcription Speed & Cost" (secundaire bron, self-hosted kostenschatting) — https://gigagpu.com/whisper-large-v3-on-rtx-3090-benchmark/
22. CodeSOTA — "PaddleOCR vs Tesseract vs EasyOCR: OCR Speed and Accuracy 2026" (secundaire bron) — https://www.codesota.com/ocr/paddleocr-vs-tesseract
23. arXiv — "Real-Time Trustworthiness Scoring for LLM Structured Outputs and Data Extraction" — https://arxiv.org/abs/2603.18014
24. arXiv — "Beyond Logprobs: A Multi-Signal Confidence Engine for LLM-Based Document Field Extraction" — https://arxiv.org/abs/2606.24420
25. Wang et al. — "Self-Consistency Improves Chain of Thought Reasoning in Language Models" — https://arxiv.org/abs/2203.11171
26. OATML (Oxford) — samenvatting van Farquhar et al., "Detecting hallucinations in large language models using semantic entropy", Nature 630:625-630 (2024) — https://oatml.cs.ox.ac.uk/blog/2024/06/19/detecting_hallucinations_2024.html
27. Artificial Analysis — Whisper snelheid/prijs/WER-index — https://artificialanalysis.ai/speech-to-text/models/whisper
28. Google — "Gemini 3 Pro: the frontier of vision AI" (video/document-OCR-capaciteiten) — https://blog.google/innovation-and-ai/technology/developers-tools/gemini-3-pro-vision/
29. TikTok Newsroom — "Introducing auto captions" (6 april 2021, lancering EN/JA) — https://newsroom.tiktok.com/en-us/introducing-auto-captions
30. TikTok Newsroom — "Auto-translations and captions" (21 juli 2022, uitbreiding naar 9 talen, geen Nederlands) — https://newsroom.tiktok.com/en-us/auto-translations-and-captions
31. The Verge — "TikTok will now let viewers turn on closed captions even if a creator doesn't" (21 juli 2022, onafhankelijke bevestiging talenlijst) — https://www.theverge.com/2022/7/21/23272700/tiktok-auto-captions-subtitles-accessibility-language-translations
32. Android Central — "These TikTok caption features will make videos more accessible in any language" (23 juli 2022) — https://www.androidcentral.com/apps-software/tiktok-captions-enabled-for-viewers
33. TikTok Support — "Accessibility for your videos" (officiële helppagina, onderscheid auto-generated captions vs. creator captions) — https://support.tiktok.com/en/using-tiktok/creating-videos/accessibility
34. Apify — `clockworks/tiktok-scraper` actorpagina (`videoMeta.subtitleLinks`-veld: language, downloadLink, source ASR/MT, version; inbegrepen in standaardextractie) — https://apify.com/clockworks/tiktok-scraper
35. TikTok for Developers — Research API Codebook (`voice_to_text`-veld) — https://developers.tiktok.com/doc/research-api-codebook
36. TechCrunch — "Instagram is rolling out auto-generated captions for videos" (1 maart 2022, 17 ondersteunde talen, geen Nederlands) — https://techcrunch.com/2022/03/01/instagram-is-rolling-out-auto-generated-captions-for-videos/
37. Social Media Today — "Instagram Reels adds more AI translations" (2026, uitbreiding vertaal/dubbing-talen, geen Nederlands gevonden) — https://www.socialmediatoday.com/news/instagram-reels-adds-more-ai-translations/825258/
38. Apify — "Instagram AI Transcript Extractor" (bevestigt dat Instagram geen ondertitelsporen publiek blootgeeft; derde partijen transcriberen zelf audio) — https://apify.com/sian.agency/instagram-ai-transcript-extractor
39. Amberscript (NL) — "Ondertiteling toevoegen aan Tiktok-video's" (secundaire, Nederlandstalige creator-gerichte bron over taalbeperkingen van TikTok's auto-ondertiteling) — https://www.amberscript.com/nl/blog/how-to-add-closed-captions-to-tiktok-videos/
40. GitHub — Radeance/tiktok-video-scraper-public (bevestigt WebVTT/SRT-formaat en tijdgestempelde ondertitelbestanden) — https://github.com/Radeance/tiktok-video-scraper-public
