# Prior art & concurrentie: video-naar-recept apps

Onderzoeksscope: alleen prior art en concurrentie. Niet de technische pipeline, niet juridisch, niet media-acquisitie — dat is voor andere onderzoeken. Peildatum: augustus 2026.

## Kernconclusie

De markt voor "plak een TikTok/Reel-link, krijg een recept" is in 2025–2026 volgestroomd: naast de gevestigde namen (ReciMe, Pestle, Crouton, Flavorish, Samsung Food) zijn er tientallen bijna-identieke nieuwkomers (Preplo, Pluck, Deglaze, Flav, Stockpot, PlanPlate, Clemi, Mealist, Recimarry, Stashcook, e.a.) die vrijwel allemaal hetzelfde beloven. Vrijwel niemand doet echte multimodale extractie: de norm is "lees eerst de caption, probeer bij gebrek daaraan de audio, en zoek anders de originele website" [S1][S2]. Alleen Pluck en Deglaze claimen ook beeld/OCR te gebruiken [S30][S61]; Pestle's "AI" blijkt bij nader inzien caption-only te zijn, geen audiotranscriptie [S6][S23]. Het onopgeloste pijnpunt is precies wat de opdracht al vermoedde: video's zonder caption, met alleen gesproken of getoonde info, falen structureel of leveren wisselvallige kwaliteit — ook bínnen dezelfde app van video tot video [S21][S28][S29]. Alle relevante spelers zijn Engelstalig-eerst; zelfs open source ingrediëntparsers met recente taaluitbreiding behandelen Nederlands als een laat toegevoegde, deels kapotte edge case [S43][S44][S45]. Er is precies één klein, solo-ontwikkeld Nederlands app'je gevonden (ReciKeep) en één marketingclaim van HelloFresh zonder onafhankelijke verificatie [S56][S58]. Dat is de opening: een Nederlandstalig-eerst, multimodaal (audio + beeld + caption) product, specifiek gevalideerd op Nederlandse creators, in een markt waar "Nederlands" nu overal een voetnoot is. Let op: **remyapp.io** bestaat al als naam voor een (B2B-georiënteerd) "agentic food commerce"-platform met vergelijkbare social-import-claims [S19][S20] — een naamsrisico dat losstaat van deze productanalyse maar het vermelden waard is.

## Vergelijkingstabel: bekende apps

| App | Video-import? | Alleen caption, of ook audio/beeld? | Prijs | Platforms |
|---|---|---|---|---|
| **ReciMe** | Ja: TikTok, Instagram, Facebook, YouTube, Pinterest | Caption eerst → audio als fallback → zoekt anders de originele site [S1][S2] | Gratis: 5 imports/week. Premium $59.99/jaar (fors verhoogd in 2025/2026) [S4] | iOS, Android |
| **Pestle** | Ja: TikTok, Instagram Reels | **Alleen caption**, verwerkt on-device (geen ChatGPT/derde partij); geen audiotranscriptie ondanks "AI"-framing [S6][S7][S23] | $2.99/maand, $24.99/jaar, of $39.99 lifetime | **Alleen iOS**, Engelstalig ("stuur me Engelse recepten die niet werken") [S23] |
| **Flavorish** | Ja: TikTok, Instagram/Facebook Reels, YouTube | AI-tekstextractie; simplificeert instructies soms te sterk (test: "sizzle your eyebrows off hot" → "really hot") [S9][S21] | Gratis: 5 social-imports totaal (alle bronnen samen). Premium $4.99/mnd of $49.99/jaar | iOS, Android |
| **Crouton** | Beperkt: werkt goed op websites/foto's/PDF; bij TikTok/Instagram “meestal alleen als de tekst in de caption of een gelinkte blog staat” | Caption/gelinkte blog; geen eigen audio- of video-analyse gedocumenteerd [S10] | ~£19.99 eenmalig (Apple Design Award 2024) | Alleen Apple-ecosysteem. **Van de App Store verwijderd in januari 2026** (reden niet openbaar gemaakt) [S11] |
| **Recipe Keeper** | Ja, claimt web/Instagram/TikTok-zoeken | Techniek niet gedocumenteerd; veel gemelde sync/import-bugs (algemeen, niet video-specifiek) [S12][S13] | Niet gepubliceerd op de site | iOS, Android, Windows, Mac |
| **Mealime** | **Nee** — gesloten receptenbibliotheek (~1000 curated recepten), geen social-import | n.v.t. | Pro $5.99/mnd of $49.99/jaar; gratis tier zonder import | iOS, Android |
| **Paprika 3** | Alleen als de video doorlinkt naar een webpagina met recept; bij pure video/caption "heeft Paprika niets om te pakken" | Puur webscraping, geen audio/beeld-analyse — expliciet bevestigd door Reddit-gebruiker: "if it's just a video, it's impossible" [S15][S22] | $4.99 eenmalig per platform | iOS, Android, macOS, Windows |
| **Whisk / Samsung Food** | Ja: TikTok, Instagram, YouTube Shorts, Pinterest, Facebook | "Extraheert automatisch ingrediënten en stappen, zelfs als de post ze niet vermeldt" — techniek achter die claim niet gepubliceerd | Gratis (~240.000 recepten-catalogus) | iOS, Android, web; Family Hub-koelkastintegratie [S16][S17] |
| **Cookmate / MyCookMate** | Ja: TikTok, Instagram, Facebook — claimt ook "video's zonder geschreven instructies te transcriberen" | Claimt transcriptie, geen technische details gepubliceerd [S18] | Niet gepubliceerd | iOS, Android |
| **Preplo** | Ja: YouTube, TikTok, Instagram Reels | Transcript + caption + beschrijving (tekst-only AI); **geen** beeld/OCR-analyse — faalt op stille/ASMR-content en pure visuele info [S4][S29] | Gratis tier; premium niet expliciet gevonden | iOS; Android "coming soon" |
| **Pluck** | Ja: TikTok, Instagram, YouTube, Facebook, foto's | Claimt écht multimodaal: video-frame-analyse + audiotranscriptie + OCR van tekst-overlays + caption-parsing + metadata, met confidence-score per import [S29][S30] | Niet gevonden | Niet gevonden |
| **Deglaze** | Ja: Instagram, TikTok, YouTube (incl. Shorts), Facebook, Pinterest | Claimt als enige de video zelf te analyseren (beeld, niet alleen tekst-overlay-OCR) — "the only recipe app that analyzes the video itself" [S60][S61] | Gratis met wekelijks importlimiet; Pro = onbeperkt | iOS (Android niet bevestigd) |
| **Stashcook** | Ja: TikTok, Instagram, Facebook, Pinterest, YouTube | Techniek niet gepubliceerd | Gratis met proefperiode, daarna abonnement (bedrag niet gepubliceerd) | iOS, Android [S62] |

**De lange staart** — tientallen functioneel bijna-identieke apps die in 2025–2026 zijn gelanceerd, allemaal met de belofte "plak een link, krijg een recept": Flav, Stockpot, PlanPlate, ingrdnt, Poach, WhatsCook, Clemi, Mealist, Recimarry, Recipool, RecipeSnap, Flambae, CookTok, Chef, Negi, Souschef, Cooked, Seasoned, OurRecipes, Rechef, CookPal, ChefTime, Spiceful, Recipe Notes, RecipeDrop [S51][S54][diverse zoekresultaten]. Dit is een indicator op zich: het bouwen van een basisversie (URL → caption/transcript → LLM → recept-JSON) is met huidige AI-tooling triviaal geworden, waardoor differentiatie via marketing, prijs of een specifieke niche (zoals taal) moet komen — niet via de kerntechniek.

### Nederlandstalige/lokale spelers

| App | Status | Taal & techniek |
|---|---|---|
| **ReciKeep** (recikeep.nl) | Solo-ontwikkelaar (Jorrit van Vrouwerff), gratis, klein — changelog toont vroege-fase kenmerken ("v1.5 — sneller en rustiger, snellere cold start") [S56][S57] | Volledig Nederlandstalige interface; claimt AI-video-omzetting maar techniek (caption vs. audio) niet gedocumenteerd |
| **HelloFresh Kookboek** | Gratis feature binnen de HelloFresh-app, geen abonnement vereist; marketing claimt verwerking van "beelden en gesproken tekst" | Geen onafhankelijke reviews/gebruikerservaringen gevonden die de claim bevestigen — puur promotioneel materiaal [S58] |
| **Receptar** | Klein, domeinnaam `de.receptar.app` wijst op Duitse/DACH-markt, niet NL-specifiek gepositioneerd | Claimt audiotranscriptie in 99 talen zonder ondertiteling nodig te hebben — technisch dus mogelijk Nederlands-capabel, maar niet als zodanig gemarket of getest bevonden [S59] |
| **remyapp.io** | Bestaand, Engelstalig, B2B/retailer-partnerplatform ("Agentic Infrastructure for Food Commerce") — géén Nederlandse consumenten-app, maar wél dezelfde naam en overlappende social-import-claim | Claimt import van Instagram/TikTok/YouTube/web; geen prijzen, geen taalvermeldingen gevonden [S19][S20] |

## Klachtenanalyse: wat gaat er mis volgens gebruikers?

Dit is het kernprobleem dat Remy moet oplossen, in gebruikers' eigen woorden.

### 1. Caption-only breekt op pure video-/audio-content

ReciMe's eigen supportdocumentatie bevestigt het probleem expliciet:

> "Smart Import works best when the recipe is written in the video caption, that's the easiest place for us to pull the details from. If there's no caption, we'll try pulling the recipe from the video's audio. Still no luck? We'll go hunting for the original recipe on a website." [S2]

En met een harde beperking: als het recept in de *comments* staat in plaats van de caption, faalt het volledig — "Smart Import only reads the caption, so if the steps (or ingredients) are tucked into the comments, pinned or not, we won't be able to grab them" [S2].

Op Reddit bevestigt een gebruiker hetzelfde met Paprika 3:

> "downloaded paprika 3 thinking it would be able to import my saved recipes directly, but you have to manually copy and paste every link, and if it's just a video, it's impossible. A lot of my recipes are just videos" [S22]

En een andere gebruiker over een generieke recipe-app:

> "it doesn't work for TT, it just saves the link but not any of the content" [S24]

### 2. Kwaliteit is onvoorspelbaar — zelfs bínnen dezelfde app

Een directe vergelijkingstest van vier apps (ReciMe, Stashcook, Recify, Flavorish) op drie video's liet zien dat prestaties sterk wisselen per video-stijl. Op een ASMR-stijl video zonder audio/tekst-uitleg **faalde ReciMe volledig** om te importeren, terwijl drie andere apps wel resultaat gaven — maar op een casual instructievideo zonder metingen "misnamed the recipe" en werden stappen gemist die "clearly stated" waren [S21]. De reviewer concludeert:

> "I'm fine with AI making mistakes, but it needs to make them predictably and consistently." [S21]

Een technische analyse van de bredere categorie bevestigt dit patroon:

> "One app regularly failed to import videos entirely. Multiple apps invented steps not shown or mentioned in the original video. Key steps were sometimes omitted — one test found two apps missed 'add potatoes to the pan.' [...] The same app might handle one video perfectly and completely botch another." [S28]

En over structurele fragiliteit: "TikTok updates their backend (which happens regularly), extraction services break. When Instagram changes their embed format, the whole pipeline [breaks]. Users end up with an app [that worked] one week and [fails] mysteriously the next." [S28]

### 3. Import "werkt gewoon niet" — generieke bugreports

Op het gebruikersforum JustUseApp meldt een ReciMe-gebruiker simpelweg:

> "App is not importing the recipes. Just not working." [S27]

Recipe Keeper heeft een vergelijkbare stroom klachten, voornamelijk over sync tussen apparaten en witte/onleesbare tekst na import — niet video-specifiek, maar het onderstreept dat "import" in deze hele categorie fragiel blijft:

> "When i import recipes from URL (any website), the inported recipe text is white. Only when i cancel and import it again, it is in a normal readable black font." [S13]

### 4. Prijsverhogingen en frustratie over freemium-limieten

ReciMe kreeg kritiek op agressieve prijsverhogingen in 2025–2026, van een oorspronkelijk lagere prijs naar $59.99/jaar — de duurste optie in vergelijkingen [S4]. Flavorish's gratis tier telt slechts 5 social-imports **in totaal**, niet per platform [S9]. Dit soort freemium-frictie duikt herhaaldelijk op in vergelijkende reviews als reden om over te stappen.

### 5. Groeiend wantrouwen tegen AI-gegenereerde/aangepaste recepten

Een breder, deels tangentieel maar veelzeggend signaal: op r/Baking uit een gebruiker met 490 upvotes expliciete frustratie over AI-vervuiling van receptencontent in het algemeen:

> "I'm so sick of 80% of the recipes I see online being AI generated. I'm so sick of having to use detective work on a recipe site to figure out if it's AI generated. [...] I'm just going to stick to recipe books and using bakers I know and trust." [S26]

Dit is geen klacht over video-import specifiek, maar het raakt aan een groeiend vertrouwensprobleem rond AI-in-de-loop bij recepten — relevant omdat het laat zien dat gebruikers steeds kritischer worden op AI-"interpretatie" versus letterlijke overname van wat de creator zei.

### 6. Wat gebruikers wél waarderen (contrast)

Ter kalibratie: als een app het wél goed doet, wordt dat organisch en enthousiast gedeeld. Een Reddit-gebruiker over Deglaze:

> "Omg you have to try Deglaze. I actually found it on reddit and it's so good at digesting recipes from social media (TT and Instagram) and blogs/websites. Couldn't recommend more." [S22]

En specifiek over het probleem van video's zónder tekst: "I've been using 'cookbook' for a long time [...] though it still sounds like it wants the recipe written somewhere" — implicerend dat de afwezigheid van geschreven tekst nog steeds dé onderscheidende faalmodus is waar gebruikers apps op beoordelen [S22].

## Technische aanpak (voor zover publiek bekend)

Er is geen enkele grote consumenten-app die haar volledige pipeline publiceert, maar uit blogs, PR's en open source projecten is een consistent beeld te destilleren van hoe de categorie het oplost:

**De "standaardpijplijn"** (bevestigd door meerdere onafhankelijke bronnen, o.a. de officiële Mealie-implementatie): download video met `yt-dlp` → probeer eerst officiële ondertitels/captions (snelst, goedkoopst) → bij ontbreken: extraheer audio met `ffmpeg` naar mono MP3 → transcribeer met een ASR-model (meestal OpenAI Whisper, soms Deepgram) → stuur transcript + titel/beschrijving naar een LLM (GPT-4o/4o-mini, Gemini, Claude) met instructie om te structureren tot ingrediënten/stappen/tijd/porties [S39][S40][S31].

- **Pestle** is de uitzondering: founder Will Bishop koos bewust tegen LLM-callouts (ChatGPT) vanwege snelheid en privacy-zorgen, en bouwde een **eigen lichtgewicht on-device model** dat alleen de *caption* verwerkt — geen audio. Verwerkingstijd: ~1/10e seconde; het grootste deel van de tijd gaat naar het ophalen van de caption zelf via de Reels/TikTok-API [S6][S7].
- **ReciMe** documenteert een drietrapsraket: caption → audio (als caption ontbreekt) → zoek de originele website [S1][S2]. De onderliggende ASR/LLM-stack is niet gepubliceerd.
- **Mealie** (open source, zie hieronder) heeft de meest transparante, production-grade referentie-implementatie: prioriteit voor bestaande ondertitels, anders Whisper-transcriptie van de audiotrack, gevolgd door LLM-parsing (OpenAI of Gemini 2.5 Flash, met Gemini merkbaar sneller in tests van de auteur) [S40].
- **Pluck** claimt als een van de weinigen echte multimodaliteit: vijf extractiemodi tegelijk (video-frame-analyse, audiotranscriptie, OCR van on-screen tekst, caption/ondertitel-parsing, metadata), met cross-referencing tussen modi en een confidence-score per recept. Hun eigen voorbeeld: als audio "add some flour" zegt en de beeld-overlay "1 cup AP flour" toont, combineert het systeem beide voor het specifiekste resultaat [S29][S30].
- **Google Gemini native video understanding** is een opkomend alternatief pad dat de hele download-transcribeer-stap overslaat: een hackathon-project ("Eaten") stuurt YouTube-links direct naar Gemini 2.0 Flash, dat de video *native* bekijkt (inclusief beeld) zonder aparte ASR-stap, en tijdgestempelde stappen teruggeeft [S32]. Dit is technisch relevant omdat het de noodzaak van een aparte Whisper-stap kan wegnemen zodra taalspecifieke videobegrip-kwaliteit voldoende is.
- Bekende faalmodi volgens een onafhankelijke technische analyse: achtergrondmuziek/meerdere sprekers verlagen ASR-nauwkeurigheid, vage taal ("een scheutje room") wordt terecht niet naar valse precisie omgezet door goede systemen (maar wél door zwakkere), en platform-API-wijzigingen breken pipelines regelmatig [S28][S30][S31].

## Open source projecten

| Project | Sterren | Laatste commit | Licentie | Bruikbaarheid voor Remy |
|---|---|---|---|---|
| **mealie-recipes/mealie** [S39] | 13.068 | 25 aug 2026 (zeer actief) | AGPL-3.0 | Grootste, best onderhouden self-hosted receptenmanager. Sinds PR #6764 (samengevoegd, release v3.13.0) een **officiële, goed gedocumenteerde** video-import-pipeline (yt-dlp + ffmpeg + Whisper + LLM) [S40]. Uitstekende architectuurreferentie; AGPL maakt directe code-hergebruik in een gesloten commerciële app juridisch niet triviaal (buiten scope van dit onderzoek, wel te checken door de juridische workstream). |
| **TandoorRecipes/recipes** [S42] | 8.558 | 25 aug 2026 | Custom/"Other" (niet OSI-standaard) | Grote self-hosted concurrent van Mealie. Bevestigde, open **Nederlandse taalbug**: ingrediënten worden automatisch naar het Engels vertaald ondanks NL-interface-instelling [S43] — direct bewijs dat zelfs volwassen tools NL als bijzaak behandelen. |
| **GerardPolloRebozado/social-to-mealie** [S50] | 241 | 13 jul 2026 | Niet gespecificeerd (project zelf vrij/open source) | Gerichte Next.js-tool: download via yt-dlp, transcribeer met Whisper, structureer met LLM, push naar Mealie via REST API. 33 releases, 142 commits, één maintainer — "behandel als persoonlijk project, geen ondersteund product" [S51]. Goede referentie-implementatie van de share-sheet-UX. |
| **pickeld/pick-a-recipe** [S35] | 32 | 24 aug 2026 (vandaag, zeer actief) | Niet gespecificeerd | Python/Flask. TikTok/YouTube/Instagram → Tandoor/Mealie. Docker-image beschikbaar. Meest actief onderhouden kleine project in deze lijst — kandidaat om te forken/inspecteren voor pipeline-details. |
| **jt196/vanilla-cookbook** [S46] | 154 | 27 jul 2026 | GPL-3.0 | Zelf-gehoste receptenmanager. **Voegde in feb 2026 expliciet Nederlandse (`nld`) taalondersteuning toe** aan zijn ingrediënt-parser-submodule (`recipe-ingredient-parser`) [S47][S48] — het enige gevonden open source project met een *bewuste*, recente Nederlandse-taal-investering in ingrediëntparsing. Direct relevant als startpunt of referentie voor Remy's NL-ingrediëntnormalisatie. |
| **marijnbent/prepped** [S49] | 0 (gloednieuw) | 13 aug 2026 | Niet gespecificeerd | Zelf-gehost, AI-import, **UI native Engels + Nederlands** (`PUBLIC_UI_LOCALE=nl`) vanaf de eerste release. Ontwikkelaarsnaam en NL-optie wijzen op een Nederlandse maker. Te vroeg/te klein om technisch veel uit te putten, maar signaal dat andere NL-ontwikkelaars dit probleem herkennen. |
| **naari21694/grand-log** [S53] | 1 | 22 aug 2026 | AGPL-3.0 | Instagram-reels → Mealie/Tandoor via Telegram-bot. Caption-eerst met audio/OCR-fallback ("auto mode"), meerdere LLM-providers (Gemini/OpenAI-compatible/Anthropic) met eigen API-key. Interessant patroon: expliciete `--no-video`/caption-only vs. volledige audio+beeld-modus als aparte instelling. |
| **dKaulig/shared-cookbook** [S52] | 1 | 28 jul 2026 | MIT | Full-stack referentie (React 19 + .NET 10 + Python 3.13-extractor-microservice). Gebruikt **faster-whisper CPU-lokaal** (geen externe ASR-API nodig) + Azure OpenAI of zelf-gehoste Ollama. UI momenteel Duits+Engels, geen Nederlands, maar architectuur (aparte Python-extractor-service, AI optioneel uitschakelbaar) is een bruikbaar ontwerp-patroon. MIT-licentie maakt hergebruik eenvoudig. |
| **SachinVenugopalan30/sous-clip** [S36] | 4 | 14 mrt 2026 | Niet gespecificeerd | TypeScript, zelf-gehost, Whisper-transcriptie, lokale SQLite, push naar Mealie. Klein en weinig actief. |
| **modulrdesign/thermomix-mcp** [S54] | Niet opgehaald | Actief (2026) | Niet gespecificeerd | MCP-server (Claude-integratie) + webhook. Caption via oEmbed eerst, optionele Whisper-audiotranscriptie als "Deep-Hunt"-fallback. Duitstalig project (Thermomix/Cookidoo-doelgroep) — interessant omdat het bewijst dat eenzelfde caption-eerst/audio-fallback-patroon ook buiten het Engelse taalgebied wordt toegepast, zonder dat het specifiek voor NL is gebouwd. |
| **abakermi/tiktok-recipe-extractor** [S38] | 7 | 16 nov 2024 (inactief) | Niet gespecificeerd | Klein, gestopt project. Beperkt bruikbaar. |
| **alliecatowo/recipe-bot** [S37] | 4 | 18 nov 2024 (inactief) | Niet gespecificeerd | Whisper + GPT, Instagram-focus. Klein, gestopt project. |
| **ColeMatthewBienek/add_recipe_skill** [S55] | Niet opgehaald | Actief (2026) | MIT | Geen app maar een "agent skill" (Claude Code/Cursor-instructieset) voor het extraheren van recepten naar Obsidian. Waardevol als *heuristiek-referentie*: expliciete prioriteitsvolgorde (caption → gelinkte blog → on-screen tekst → gebruikersinput), en de expliciete regel "audio transcription is a last resort" omdat gesproken taal zelden exacte hoeveelheden bevat. Bevestigt vanuit een heel andere hoek dezelfde prioriteitslogica als ReciMe/Mealie. |

**Observatie over Dutch-taalondersteuning in open source recepttools in het algemeen:** meerdere onafhankelijke GitHub-issues bevestigen dat Nederlands structureel een tweederangs taal is in bestaande parsers. Naast de Tandoor-bug [S43] meldt een Mealie-gebruiker: "ingredient amounts are shown in english while langue is Dutch" [S44], en een andere gebruiker specifiek over scraping: "I have added multiple recepts from different sites but in Dutch it is not working well [...] default the nlp parser is selected, but this is focused on English" [S45]. Dit is direct, onafhankelijk bevestigd bewijs — niet giswerk — dat de *technologie* (Whisper e.d. ondersteunt ~99 talen incl. Nederlands) weliswaar taal-agnostisch is, maar dat de *productlaag* (eenheden-dictionaries, ingrediënt-normalisatie, NLP-parsers) bijna overal Engels-eerst is gebouwd en Nederlands hooguit met handmatige patches krijgt.

## Gat in de markt: Nederlandstalige content

Samenvattend de bewijslijnen voor een reëel, aantoonbaar gat:

1. **Geen enkele grote speler (ReciMe, Pestle, Crouton, Flavorish, Samsung Food, Preplo, Pluck, Deglaze, Stashcook, …) claimt of demonstreert specifiek goede prestaties op Nederlandstalige video's.** Pestle's founder vraagt gebruikers expliciet alleen *Engelse* recepten aan te dragen [S23]. Geen van de vergelijkende blogartikelen die tientallen apps testen (S4, S5, S9, S15, S21, S28, S29) noemt taal als testvariabele — alle tests zijn impliciet Engelstalig.
2. **De enige twee Nederlandse spelers zijn klein of ongeverifieerd.** ReciKeep is een solo-ontwikkelaarsproject zonder gepubliceerde gebruikersaantallen of onafhankelijke reviews [S56][S57]. HelloFresh Kookboek is een marketingclaim binnen een gevestigde consumenten-app zonder vindbare technische validatie of gebruikersreviews die de audio/beeld-claim bevestigen [S58] — het kán goed werken, maar er is geen publiek bewijs voor.
3. **Zelfs open source projecten die wél moeite doen, tonen dat Nederlands een laat-toegevoegde patch is, niet een eersteklas ontwerpkeuze.** De Tandoor- en Mealie-issues zijn niet incidenteel; ze zijn een direct symptoom van hoe deze systemen zijn gebouwd: Engelse eenheden- en ingrediëntenlijsten als basis, met losse taalpakketten erbovenop [S43][S44][S45]. Alleen `jt196/vanilla-cookbook` heeft in 2026 bewust een Nederlandse parser-taal toegevoegd — en dat is een project met 154 sterren, geen productiematuur consumentenproduct [S46][S47].
4. **De technologie zelf is geen blocker.** Whisper en vergelijkbare ASR-modellen ondersteunen Nederlands prima in theorie (Receptar claimt zelfs 99 talen zonder ondertiteling [S59]); het probleem zit in de afwezigheid van *validatie, marketing en productbeslissingen* die Nederlands als eerste-klas taal behandelen — inclusief Nederlandse maateenheden, spreektaal-ingrediëntnamen, en Nederlandse/Vlaamse TikTok/Instagram-creators als testset.
5. **Het generieke, taalonafhankelijke pijnpunt (caption-loze video's) is nog nergens goed opgelost** [S2][S21][S22][S28] — een Nederlandstalige app die dát wél goed doet, lost dus twee problemen tegelijk op die momenteel allebei onopgelost zijn: taal én modaliteit.

**Risico om te vermelden, niet te negeren:** de naam "Remy" is al in gebruik door remyapp.io, een Engelstalig platform met overlappende claims (social-import, shoppable recepten, B2B-partnerschappen met retailers) [S19][S20]. Dit is geen directe consumenten-concurrent op de Nederlandse markt, maar wel een naamsoverlap in exact dezelfde productcategorie — de moeite waard om vroeg te laten meewegen, ook al valt de juridische/merkenrechtelijke beoordeling daarvan buiten deze onderzoeksscope.

## Bronnen

[S1]: https://recime.app/help/en/articles/11661452-import-from-tiktok — ReciMe Help, "Import from TikTok"
[S2]: https://recime.app/help/en/articles/14773584-why-didn-t-my-recipe-import-correctly — ReciMe Help, "Why Didn't My Recipe Import Correctly?"
[S3]: https://recime.app/help/en/articles/11596425-import-from-instagram — ReciMe Help, "Import from Instagram"
[S4]: https://preplo.app/best-recipe-app-2026 — Preplo, "13 Best Recipe Apps in 2026"
[S5]: https://www.foodieprep.ai/blog/best-apps-for-saving-recipes-from-social-media — FoodiePrep, "Best Apps to Save Recipes from TikTok & Instagram (2026)"
[S6]: https://techcrunch.com/2024/11/25/pestle-recipe-app-can-now-save-dishes-from-tiktok/ — TechCrunch, "Pestle recipe app can now save dishes from TikTok"
[S7]: https://techcrunch.com/2024/07/08/pestles-app-can-now-save-recipes-from-reels-using-on-device-ai/ — TechCrunch, "Pestle's app can now save recipes from Reels using on-device AI"
[S8]: https://www.flavorish.ai/blog/how-to-save-recipes-from-social-media-with-flavorish — Flavorish blog
[S9]: https://aichief.com/ai-productivity-tools/flavorish/ — AiChief, "Flavorish Review – Cost, Use Cases & Alternatives [2026]"
[S10]: https://combustioninc.gorgias.help/en-US/crouton-recipe-import-troubleshooting-guide-7701731 — Crouton (Combustion Inc.), officiële troubleshooting-gids
[S11]: https://fond.kitchen/alternatives/crouton/ — Fond, "Best Crouton alternative in 2026" (vermeldt verwijdering uit App Store, jan. 2026)
[S12]: https://recipekeeperonline.com/ — Recipe Keeper, officiële site
[S13]: https://justuseapp.com/en/app/974683711/recipe-keeper/problems — JustUseApp, Recipe Keeper probleemrapportages
[S14]: https://mymealticket.app/blog/recipe-apps-compared/ — MyMealTicket, "Recipe Apps Compared: Pricing Models for 2026"
[S15]: https://nutrola.app/en/blog/best-apps-that-extract-recipes-from-video-urls-2026 — Nutrola, "Best Apps That Extract Recipes from Video URLs 2026"
[S16]: https://trywhisk.com/ — Whisk, officiële site
[S17]: https://support.samsungfood.com/hc/en-us/articles/18588347596692-How-Creators-Can-Link-From-Social-Channels-to-Recipes-on-Samsung-Food — Samsung Food Help
[S18]: https://www.mycookmate.io/ — MyCookMate, officiële site
[S19]: https://www.remyapp.io/ — Remy (remyapp.io), "Agentic Infrastructure for Food Commerce"
[S20]: https://www.remyapp.io/blog/the-best-apps-for-saving-recipes-from-tiktok-and-instagram — Remy (remyapp.io) blog
[S21]: https://www.androidpolice.com/i-tried-viral-recipe-apps-clear-winner/ — Android Police, "I tried 4 viral recipe apps, and there's a clear winner"
[S22]: https://www.reddit.com/r/Cooking/comments/1m399qq/recipe_apps_that_import_directly_from_instagram/ — r/Cooking, "Recipe apps that import directly from Instagram"
[S23]: https://www.reddit.com/r/apple/comments/1dxkyxm/ive_just_released_pestle_18_with_support_for/ — r/apple, Pestle-ontwikkelaar over Pestle 1.8
[S24]: https://www.reddit.com/r/Cooking/comments/1cmju24/how_do_you_organize_recipes_you_find_on_tiktok/ — r/Cooking, "How do you organize recipes you find on TikTok, Instagram, etc?"
[S25]: https://www.reddit.com/r/Cooking/comments/1il7kif/best_free_recipe_manager_app_with_an_autoimport/ — r/Cooking, "Best FREE recipe manager app with an auto-import feature"
[S26]: https://www.reddit.com/r/Baking/comments/1n4jo03/ai_recipes_are_ruining_my_life/ — r/Baking, "AI recipes are ruining my life"
[S27]: https://forums.justuseapp.com/en/post/SO1AEP4SGY/app-is-not-importing-the-recipes-just-not-working — JustUseApp forum, ReciMe-klacht
[S28]: https://outofofficeoutdoors.com/blog/how-recipe-apps-extract-from-social-media — Out of Office Outdoors, "How Recipe Apps Extract Recipes from TikTok and Instagram"
[S29]: https://pluckrecipes.com/blog/tested-ai-recipe-extractors/ — Pluck Blog, "We Tested 5 Approaches to AI Recipe Extraction"
[S30]: https://pluckrecipes.com/blog/can-ai-extract-recipes-from-video/ — Pluck Blog, "Can AI Actually Watch a Cooking Video and Extract the Recipe?"
[S31]: https://angel-baez.com/blog/youtube-to-recipe-with-ai/ — Angel Baez, "From YouTube Videos to Recipes with AI"
[S32]: https://devpost.com/software/eaten — Devpost, "Eaten" (hackathon-project met Gemini video understanding)
[S33]: https://foxnews.com/world/grocery-store-ai-app-suggests-bizarre-sometimes-dangerous-recipes-users-report.amp — Fox News, Pak'nSave "Savey Mealmaker" AI-receptenincident
[S34]: https://recipyapp.com/blog/ai-recipe-hallucinations-safety-2026 — Recipy Blog, "Why AI Recipes Get Ingredients Wrong (and Cook Safely) 2026"
[S35]: https://github.com/pickeld/pick-a-recipe — GitHub, pickeld/pick-a-recipe
[S36]: https://github.com/SachinVenugopalan30/sous-clip — GitHub, SachinVenugopalan30/sous-clip
[S37]: https://github.com/alliecatowo/recipe-bot — GitHub, alliecatowo/recipe-bot
[S38]: https://github.com/abakermi/tiktok-recipe-extractor — GitHub, abakermi/tiktok-recipe-extractor
[S39]: https://github.com/mealie-recipes/mealie — GitHub, mealie-recipes/mealie
[S40]: https://github.com/mealie-recipes/mealie/pull/6764 — GitHub, Mealie PR #6764 "feat: Add social media video import"
[S41]: https://github.com/mealie-recipes/mealie/discussions/6015 — GitHub, Mealie Discussion #6015
[S42]: https://github.com/TandoorRecipes/recipes — GitHub, TandoorRecipes/recipes
[S43]: https://github.com/TandoorRecipes/recipes/issues/4453 — GitHub, Tandoor Issue #4453 (Nederlandse vertaalbug)
[S44]: https://github.com/mealie-recipes/mealie/issues/5516 — GitHub, Mealie Issue #5516 (Nederlandse eenheden in het Engels)
[S45]: https://github.com/mealie-recipes/mealie/issues/3460 — GitHub, Mealie Issue #3460 (Nederlandse scraping werkt niet goed)
[S46]: https://github.com/jt196/vanilla-cookbook — GitHub, jt196/vanilla-cookbook
[S47]: https://github.com/jt196/vanilla-cookbook/releases/tag/v1.5.8 — GitHub, Vanilla Cookbook release v1.5.8 (Dutch language added)
[S48]: https://github.com/jt196/vanilla-cookbook/issues/366 — GitHub, Vanilla Cookbook Issue #366 "Add support for Dutch language"
[S49]: https://github.com/marijnbent/prepped — GitHub, marijnbent/prepped
[S50]: https://github.com/GerardPolloRebozado/social-to-mealie — GitHub, GerardPolloRebozado/social-to-mealie
[S51]: https://unsubbed.co/tools/social-to-mealie/ — unsubbed.co, review van Social-to-Mealie
[S52]: https://github.com/dKaulig/shared-cookbook — GitHub, dKaulig/shared-cookbook
[S53]: https://github.com/naari21694/grand-log/ — GitHub, naari21694/grand-log
[S54]: https://github.com/modulrdesign/thermomix-mcp — GitHub, modulrdesign/thermomix-mcp
[S55]: https://github.com/ColeMatthewBienek/add_recipe_skill — GitHub, ColeMatthewBienek/add_recipe_skill
[S56]: https://recikeep.nl/ — ReciKeep, officiële site
[S57]: https://apps.apple.com/nl/app/recikeep/id6757637654 — ReciKeep op de Nederlandse App Store
[S58]: https://www.coolesuggesties.nl/hellofresh-kookboek-recepten-app/ — CooleSuggesties, "Zo bewaar je jouw favoriete recepten van Instagram en TikTok" (over HelloFresh Kookboek)
[S59]: https://play.google.com/store/apps/details?id=de.receptar.app — Receptar op Google Play
[S60]: https://www.deglaze.app/ — Deglaze, officiële site
[S61]: https://www.deglaze.app/how-to/save-recipes-from-tiktok — Deglaze, "How to Save Recipes from TikTok"
[S62]: https://stashcook.com/app-features/recipes — Stashcook, feature-overzicht
[S63]: https://www.girlscene.nl/kookapp-tiktok-recepten/ — Girlscene, "Met deze gratis kookapp heb je al je opgeslagen TikTok-recepten op één plek"
