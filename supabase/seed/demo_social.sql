-- ---------------------------------------------------------------------------
-- Remy — demo-data voor de sociale laag. NEP, HERKENBAAR EN OMKEERBAAR.
--
-- De eigenaar, 8 september 2026: "Ik zie op het moment geen mock accounts en
-- mock recepten staan waarmee ik kan checken hoe het social gedeelte van de
-- app werkt" — en eerder: "zorg wel dat het duidelijk is welke data nep is
-- zodat we deze ook weer eenvoudig kunnen verwijderen."
--
-- ALLES WAT DIT BESTAND SCHRIJFT BEGINT MET 5eed5eed. Elke id die hier
-- ontstaat draagt dat voorvoegsel, in elke tabel, zonder uitzondering. Daarmee
-- is "wat is nep?" een query en geen archeologie:
--
--     select 'profiles' as tabel, id from public.profiles where id::text like '5eed5eed%'
--     union all select 'meals', id from public.meals where id::text like '5eed5eed%';
--
-- en demo_social_teardown.sql haalt precies die rijen weg en niets anders.
-- Dat bestand houdt geen lijst bij maar vraagt de database naar het
-- voorvoegsel, dus deze seed mag groeien zonder dat de teardown meegroeit.
-- Er is GEEN kolom en GEEN migratie bijgekomen: is de nepdata weg, dan is er
-- geen spoor dat ze er ooit was.
--
-- DE HANDLES BEGINNEN MET demo_, zodat het ook in de app zichtbaar is en niet
-- alleen in de database. Wie "Sanne (demo)" in Vrienden ziet staan hoeft dit
-- bestand niet te kennen om te weten wat hij ziet.
--
-- DIT HEET BEWUST NIET supabase/seed.sql. Dat is de naam die de Supabase-CLI
-- automatisch toepast bij `db reset`, en demo-data die ongevraagd meelift met
-- een reset is precies het soort spookdata dat seedData.ts's eigen header
-- verbiedt ("a fresh install must be honestly empty"). Dit bestand draait
-- alleen als iemand het zelf plakt.
--
-- (!) DIT SCHRIJFT IN auth.users, en dat is niet vrijblijvend. profiles.id
-- verwijst met een foreign key naar auth.users (id), dus een profiel kan niet
-- bestaan zonder auth-rij en er is geen route eromheen. Deze rijen krijgen
-- geen wachtwoord en geen bevestigd adres, dus er valt niet mee in te loggen;
-- ze bestaan alleen om die sleutel te vervullen. De teardown ruimt ze op.
--
-- HOE JE HEM DRAAIT: plak het geheel in de Supabase SQL-editor en voer uit.
-- Je hoeft niets in te vullen — zie het blok hieronder. Idempotent: twee keer
-- draaien verandert niets aan de uitkomst.
-- ---------------------------------------------------------------------------

do $$
declare
  -- JE HOEFT HIER NIETS MEER IN TE VULLEN, en dat is een verandering ten
  -- opzichte van de vorige versie van dit bestand. Die eiste dat je je eigen
  -- handle intypte; het stond in HANDOVER.md als openstaand punt 2 en het is
  -- vier dagen niet gebeurd. Een script dat pas werkt na een bewerking is een
  -- script dat blijft liggen.
  --
  -- Laat dit op null staan en het script zoekt zelf de enige echte gebruiker:
  -- het profiel dat NIET met demo_ begint. Zijn dat er meerdere — een tweede
  -- testaccount, een huisgenoot — dan weigert het en somt het ze op, want dan
  -- is "welke ben jij?" een vraag die alleen jij kunt beantwoorden. Vul in dat
  -- geval hieronder je handle in, zonder @.
  owner_handle constant text := null;

  owner_id uuid;
  resolved_handle text;
  real_profile_count integer;

  -- Vaste id's, zodat opnieuw draaien dezelfde rijen raakt en de teardown ze
  -- exact kan vinden. Het voorvoegsel IS het label.
  --
  -- (!) EEN UUID KENT ALLEEN 0-9 EN a-f. DIT BESTAND HEEFT DAAR OP
  -- 8 SEPTEMBER 2026 OP GEFAALD, bij de eerste keer dat iemand het draaide:
  --
  --     ERROR: 22P02: invalid input syntax for type uuid:
  --     "5eed5eed-0000-4000-8000-00000000h001"
  --
  -- De tabellen kregen oorspronkelijk een letter als geheugensteun — h voor
  -- household, m voor member, r voor rating, s voor share — en van die vier
  -- is er geen enkele hexadecimaal. Vier van de negen tabellen konden dus
  -- nooit één rij schrijven, en dat is drie dagen niemand opgevallen omdat
  -- het bestand er wél doordacht uitzag en niemand het uitvoerde.
  --
  -- De les is niet "kijk beter": het is dat een uuid-literal een DATATYPE
  -- heeft dat je niet kunt zien zonder hem te parsen. De tags hieronder zijn
  -- daarom alle negen geldig hex, en de controle is één regel die je kunt
  -- draaien vóór je plakt:
  --
  --     grep -o "5eed5eed-0000-4000-8000-[0-9a-zA-Z]*" demo_social.sql \
  --       | grep -v "^5eed5eed-0000-4000-8000-[0-9a-f]\{12\}$"
  --
  -- Leeg is goed. De tags, met de betekenis die de letter niet meer draagt:
  --
  --     0 profiles      a recipes     b households   c cook_events
  --     1 recipe_ratings              d household_members
  --     2 recipe_shares  e meals      f friendships
  --
  -- DE VORM VAN HET NETWERK IS HET BELANGRIJKSTE AAN DIT BESTAND, want de
  -- vriendensuggesties (0019) rekenen op de TWEEDE stap in de grafiek en die
  -- kun je niet zien met alleen twee vrienden. Wat hieronder ontstaat:
  --
  --     jij ─┬─ Sanne ─┬─ Noor        Noor kent Sanne EN Bram -> 2 gemeenschappelijk
  --          │         └─ Youssef     Youssef kent alleen Sanne -> 1 gemeenschappelijk
  --          └─ Bram ─── Noor
  --                        └─ Tessa   Tessa kent alleen Noor -> DERDE stap, onzichtbaar
  --
  --     Fatima -> openstaand verzoek AAN jou (geen suggestie: er is al een rij)
  --     Daan   -> kent niemand, maar stemde op zes recepten -> "actief"
  --
  -- Daarmee toont het Vrienden-scherm alle drie de gevallen tegelijk: een
  -- suggestie op gedeelde vrienden, een suggestie op activiteit, en een
  -- wachtend verzoek. Tessa hoort er NIET in te staan; staat ze er wel, dan
  -- reikt de query een stap te ver.
  sanne_id   constant uuid := '5eed5eed-0000-4000-8000-000000000001';
  bram_id    constant uuid := '5eed5eed-0000-4000-8000-000000000002';
  fatima_id  constant uuid := '5eed5eed-0000-4000-8000-000000000003';
  noor_id    constant uuid := '5eed5eed-0000-4000-8000-000000000004';
  youssef_id constant uuid := '5eed5eed-0000-4000-8000-000000000005';
  tessa_id   constant uuid := '5eed5eed-0000-4000-8000-000000000006';
  daan_id    constant uuid := '5eed5eed-0000-4000-8000-000000000007';

  recipe_a   constant uuid := '5eed5eed-0000-4000-8000-00000000a001';
  recipe_b   constant uuid := '5eed5eed-0000-4000-8000-00000000a002';
  recipe_c   constant uuid := '5eed5eed-0000-4000-8000-00000000a003';
  recipe_d   constant uuid := '5eed5eed-0000-4000-8000-00000000a004';
  recipe_e   constant uuid := '5eed5eed-0000-4000-8000-00000000a005';
  recipe_f   constant uuid := '5eed5eed-0000-4000-8000-00000000a006';
  recipe_g   constant uuid := '5eed5eed-0000-4000-8000-00000000a007';
  recipe_h   constant uuid := '5eed5eed-0000-4000-8000-00000000a008';
begin
  -- 0. Wie ben jij. Twee routes, en de foutmeldingen zijn het belangrijkste
  --    deel: een vriendschap zonder de andere helft levert een Vrienden-tab op
  --    die er nog steeds leeg uitziet, en dan lijkt het script stuk terwijl de
  --    invoer dat was.
  if owner_handle is not null then
    select id, handle into owner_id, resolved_handle
      from public.profiles where handle = owner_handle;

    if owner_id is null then
      raise exception
        'Geen profiel met handle %. Bekende handles: %',
        owner_handle,
        (select coalesce(string_agg(handle, ', '), '(geen enkel profiel)') from public.profiles);
    end if;
  else
    -- `like 'demo\_%'` met een backslash: in een SQL-string is `_` een
    -- joker die op elk teken past, dus `demo_%` zou ook `demoxiets` vinden.
    select count(*) into real_profile_count
      from public.profiles where handle not like 'demo\_%';

    if real_profile_count = 0 then
      raise exception
        'Geen echt profiel gevonden (alles begint met demo_, of de tabel is leeg). Maak eerst een account aan in de app. Bekende handles: %',
        (select coalesce(string_agg(handle, ', '), '(geen enkel profiel)') from public.profiles);
    end if;

    if real_profile_count > 1 then
      raise exception
        'Meer dan een echt profiel gevonden, dus ik weet niet welke jij bent. Vul owner_handle bovenin in. Kandidaten: %',
        (select string_agg(handle, ', ') from public.profiles where handle not like 'demo\_%');
    end if;

    select id, handle into owner_id, resolved_handle
      from public.profiles where handle not like 'demo\_%';
  end if;

  -- 1. De personen. auth.users eerst, want profiles hangt eraan.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (sanne_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_sanne@example.invalid',   '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now()),
    (bram_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_bram@example.invalid',    '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now()),
    (fatima_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_fatima@example.invalid',  '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now()),
    (noor_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_noor@example.invalid',    '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now()),
    (youssef_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_youssef@example.invalid', '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now()),
    (tessa_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_tessa@example.invalid',   '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now()),
    (daan_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_daan@example.invalid',    '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, handle, display_name, avatar_url)
  values
    (sanne_id,   'demo_sanne',   'Sanne (demo)',   null),
    (bram_id,    'demo_bram',    'Bram (demo)',    null),
    (fatima_id,  'demo_fatima',  'Fatima (demo)',  null),
    (noor_id,    'demo_noor',    'Noor (demo)',    null),
    (youssef_id, 'demo_youssef', 'Youssef (demo)', null),
    (tessa_id,   'demo_tessa',   'Tessa (demo)',   null),
    (daan_id,    'demo_daan',    'Daan (demo)',    null)
  on conflict (id) do update set display_name = excluded.display_name;

  -- 2. De vriendschappen. Zie het diagram bij de id's hierboven; de rijen
  --    vanaf f004 zijn wat de suggesties voeden en waren er tot vandaag niet,
  --    wat de reden was dat "Misschien ken je" niets te tonen had.
  --
  --    (!) DE RICHTING DOET ER NIET TOE voor een geaccepteerde vriendschap —
  --    0007 slaat het paar op in gegenereerde `profile_low`/`profile_high`
  --    kolommen, dus (a,b) en (b,a) zijn dezelfde rij en de unique constraint
  --    weigert de tweede. Voor `pending` doet de richting er wel toe: de
  --    requester heeft gevraagd, de addressee moet antwoorden. Fatima staat
  --    daarom als requester, want anders wacht ZIJ op JOU en toont het scherm
  --    niets.
  insert into public.friendships (id, requester_id, addressee_id, status)
  values
    ('5eed5eed-0000-4000-8000-00000000f001', owner_id,   sanne_id,   'accepted'),
    ('5eed5eed-0000-4000-8000-00000000f002', bram_id,    owner_id,   'accepted'),
    ('5eed5eed-0000-4000-8000-00000000f003', fatima_id,  owner_id,   'pending'),
    -- De tweede stap: vrienden van jouw vrienden, die jou niet kennen.
    ('5eed5eed-0000-4000-8000-00000000f004', sanne_id,   noor_id,    'accepted'),
    ('5eed5eed-0000-4000-8000-00000000f005', bram_id,    noor_id,    'accepted'),
    ('5eed5eed-0000-4000-8000-00000000f006', sanne_id,   youssef_id, 'accepted'),
    -- De DERDE stap. Tessa kent alleen Noor, en Noor ken jij niet. Zij hoort
    -- dus niet in je suggesties te staan; ze ligt hier om dat te kunnen zien.
    ('5eed5eed-0000-4000-8000-00000000f007', noor_id,    tessa_id,   'accepted')
  on conflict (id) do update set status = excluded.status;

  -- 3. Canonieke recepten. Hier rangschikt Ranglijst op, hiernaar wijst een
  --    bewijskaart, en hierop wordt gestemd: zonder recipe_id bestaat er geen
  --    gedeeld object om het over te hebben (zie de shared_cooks-view in 0009).
  insert into public.recipes (id, normalized_url, platform, title, estimated_minutes, servings, author_name, dish_tags)
  values
    (recipe_a, 'https://www.tiktok.com/@demo/video/5eed0001', 'tiktok',    'Romige pasta met spinazie',   25, 4, 'demo_kok',    array['pasta','vegetarisch']),
    (recipe_b, 'https://www.tiktok.com/@demo/video/5eed0002', 'tiktok',    'Kip uit de oven met citroen', 45, 4, 'demo_kok',    array['kip','ovenschotel']),
    (recipe_c, 'https://www.tiktok.com/@demo/video/5eed0003', 'tiktok',    'Rode linzensoep',             30, 4, 'demo_kok',    array['soep','veganistisch']),
    (recipe_d, 'https://www.tiktok.com/@demo/video/5eed0004', 'tiktok',    'Wok met noedels en broccoli', 20, 2, 'demo_kok',    array['noedels','wok']),
    (recipe_e, 'https://www.tiktok.com/@demo/video/5eed0005', 'tiktok',    'Shakshuka met feta',          25, 3, 'demo_keuken', array['eieren','vegetarisch']),
    (recipe_f, 'https://www.instagram.com/reel/5eed0006',     'instagram', 'Traybake met kikkererwten',   40, 4, 'demo_keuken', array['ovenschotel','veganistisch']),
    (recipe_g, 'https://www.instagram.com/reel/5eed0007',     'instagram', 'Groene curry met aubergine',  35, 4, 'demo_keuken', array['curry','veganistisch']),
    (recipe_h, 'https://www.youtube.com/watch?v=5eed0008',    'youtube',   'Risotto met champignons',     40, 2, 'demo_kok',    array['rijst','vegetarisch'])
  on conflict (id) do update set title = excluded.title;

  -- 4. Huishoudens voor de twee vrienden, met delen AAN. Zonder die vlag
  --    levert shared_cooks niets op en blijft de feed leeg — precies de reden
  --    dat de Vrienden-tab er tot nu toe leeg uitzag.
  --
  --    ALLEEN VOOR SANNE EN BRAM, en dat is met opzet. Noor, Youssef, Tessa
  --    en Daan hebben geen huishouden: zij zijn er om gesuggereerd te worden,
  --    niet om in de feed te staan, en `shared_cooks` poort toch al op een
  --    geaccepteerde vriendschap die zij niet met jou hebben.
  insert into public.households (id, name, share_cooks_with_friends)
  values
    ('5eed5eed-0000-4000-8000-00000000b001', 'Huishouden Sanne (demo)', true),
    ('5eed5eed-0000-4000-8000-00000000b002', 'Huishouden Bram (demo)',  true)
  on conflict (id) do update set share_cooks_with_friends = true;

  insert into public.household_members (id, household_id, display_name, auth_user_id)
  values
    ('5eed5eed-0000-4000-8000-00000000d001', '5eed5eed-0000-4000-8000-00000000b001', 'Sanne (demo)', sanne_id),
    ('5eed5eed-0000-4000-8000-00000000d002', '5eed5eed-0000-4000-8000-00000000b002', 'Bram (demo)',  bram_id)
  on conflict (id) do nothing;

  -- 5. Hun maaltijden en kookgebeurtenissen. Dit is het bewijs: shared_cooks
  --    koppelt (household_member.auth_user_id, meal.recipe_id) en niets meer.
  insert into public.meals (id, household_id, title, source, recipe_id, estimated_minutes, servings, excluded_from_cook_proof)
  values
    ('5eed5eed-0000-4000-8000-00000000e001', '5eed5eed-0000-4000-8000-00000000b001', 'Romige pasta met spinazie',   'saved', recipe_a, 25, 4, false),
    ('5eed5eed-0000-4000-8000-00000000e002', '5eed5eed-0000-4000-8000-00000000b001', 'Rode linzensoep',             'saved', recipe_c, 30, 4, false),
    ('5eed5eed-0000-4000-8000-00000000e003', '5eed5eed-0000-4000-8000-00000000b002', 'Kip uit de oven met citroen', 'saved', recipe_b, 45, 4, false),
    ('5eed5eed-0000-4000-8000-00000000e004', '5eed5eed-0000-4000-8000-00000000b002', 'Wok met noedels en broccoli', 'saved', recipe_d, 20, 2, false),
    ('5eed5eed-0000-4000-8000-00000000e005', '5eed5eed-0000-4000-8000-00000000b001', 'Shakshuka met feta',          'saved', recipe_e, 25, 3, false),
    ('5eed5eed-0000-4000-8000-00000000e006', '5eed5eed-0000-4000-8000-00000000b002', 'Risotto met champignons',     'saved', recipe_h, 40, 2, false)
  on conflict (id) do update set recipe_id = excluded.recipe_id;

  -- Relatieve datums, nooit vaste. Een seed met '2026-09-08' erin is over een
  -- maand een seed die "vorige maand gekookt" zegt.
  insert into public.cook_events (id, household_id, meal_id, cooked_on, rating, created_at)
  values
    ('5eed5eed-0000-4000-8000-00000000c001', '5eed5eed-0000-4000-8000-00000000b001', '5eed5eed-0000-4000-8000-00000000e001', current_date - 2, 8.5, now() - interval '2 days'),
    ('5eed5eed-0000-4000-8000-00000000c002', '5eed5eed-0000-4000-8000-00000000b001', '5eed5eed-0000-4000-8000-00000000e002', current_date - 5, 7.0, now() - interval '5 days'),
    ('5eed5eed-0000-4000-8000-00000000c003', '5eed5eed-0000-4000-8000-00000000b002', '5eed5eed-0000-4000-8000-00000000e003', current_date - 1, 9.0, now() - interval '1 day'),
    ('5eed5eed-0000-4000-8000-00000000c004', '5eed5eed-0000-4000-8000-00000000b002', '5eed5eed-0000-4000-8000-00000000e004', current_date - 8, 6.5, now() - interval '8 days'),
    ('5eed5eed-0000-4000-8000-00000000c005', '5eed5eed-0000-4000-8000-00000000b001', '5eed5eed-0000-4000-8000-00000000e005', current_date - 3, 8.0, now() - interval '3 days'),
    ('5eed5eed-0000-4000-8000-00000000c006', '5eed5eed-0000-4000-8000-00000000b002', '5eed5eed-0000-4000-8000-00000000e006', current_date - 6, 7.5, now() - interval '6 days')
  on conflict (id) do nothing;

  -- 6. Openbare stemmen. Twee dingen tegelijk: Ranglijst rangschikt hierop
  --    (zonder deze rijen is die tab leeg ongeacht hoeveel er gekookt is), en
  --    0019 telt ze per persoon voor de "actief op Remy"-suggestie.
  --
  --    (!) DAAN HEEFT ER ZES EN KENT NIEMAND, en dat is de hele reden dat hij
  --    bestaat: hij is het enige geval waarin je de tweede soort suggestie te
  --    zien krijgt. Zou hij ook maar een vriend van jou kennen, dan won de
  --    gemeenschappelijke-vriendenregel en zag je "Beoordeelde 6 recepten"
  --    nooit staan.
  --
  --    Een stem per persoon per recept — 0007 heeft daar een unique op, dus
  --    zes stemmen van Daan zijn zes verschillende recepten.
  insert into public.recipe_ratings (id, recipe_id, rater_profile_id, rating)
  values
    ('5eed5eed-0000-4000-8000-000000001001', recipe_a, sanne_id,   8.5),
    ('5eed5eed-0000-4000-8000-000000001002', recipe_a, bram_id,    9.0),
    ('5eed5eed-0000-4000-8000-000000001003', recipe_a, fatima_id,  8.0),
    ('5eed5eed-0000-4000-8000-000000001004', recipe_b, bram_id,    9.0),
    ('5eed5eed-0000-4000-8000-000000001005', recipe_b, sanne_id,   7.5),
    ('5eed5eed-0000-4000-8000-000000001006', recipe_c, sanne_id,   7.0),
    ('5eed5eed-0000-4000-8000-000000001007', recipe_d, bram_id,    6.5),
    ('5eed5eed-0000-4000-8000-000000001008', recipe_e, sanne_id,   8.0),
    ('5eed5eed-0000-4000-8000-000000001009', recipe_h, bram_id,    7.5),
    -- Noor en Youssef stemmen ook, maar minder: hun suggestie leunt op de
    -- gedeelde vrienden, en een hoge stemtelling erbij zou niet zichtbaar
    -- maken welke van de twee regels hen omhoog bracht.
    ('5eed5eed-0000-4000-8000-000000001010', recipe_c, noor_id,    9.0),
    ('5eed5eed-0000-4000-8000-000000001011', recipe_f, youssef_id, 8.0),
    -- Daan: zes recepten, zes stemmen, nul vrienden.
    ('5eed5eed-0000-4000-8000-000000001012', recipe_a, daan_id,    7.0),
    ('5eed5eed-0000-4000-8000-000000001013', recipe_b, daan_id,    8.5),
    ('5eed5eed-0000-4000-8000-000000001014', recipe_c, daan_id,    6.0),
    ('5eed5eed-0000-4000-8000-000000001015', recipe_e, daan_id,    9.5),
    ('5eed5eed-0000-4000-8000-000000001016', recipe_g, daan_id,    7.5),
    ('5eed5eed-0000-4000-8000-000000001017', recipe_h, daan_id,    8.0),
    -- Tessa stemt een keer. Genoeg om te bestaan, te weinig om Daan te
    -- verdringen — en zij hoort sowieso niet in de suggesties te staan.
    ('5eed5eed-0000-4000-8000-000000001018', recipe_g, tessa_id,   7.0)
  on conflict (id) do update set rating = excluded.rating;

  -- 7. Een doorgestuurd recept, zodat "het pannetje" ook iets te tonen heeft.
  insert into public.recipe_shares (id, meal_id, sender_profile_id, recipient_profile_id, note)
  values
    ('5eed5eed-0000-4000-8000-000000002001', '5eed5eed-0000-4000-8000-00000000e003', bram_id, owner_id, 'Deze moet je proberen!')
  on conflict (id) do nothing;

  raise notice 'Demo-data geplaatst voor handle %. Alles begint met 5eed5eed; draai demo_social_teardown.sql om het weg te halen.', resolved_handle;
end $$;

-- ---------------------------------------------------------------------------
-- Controle: staat de data er, en in de vorm die de schermen nodig hebben?
--
-- Dit leest en wijzigt niets. Draai het na de seed; klopt het hier en blijft
-- een scherm leeg, dan ligt het aan de app en niet aan de data — het
-- onderscheid dat op 8 september vier dagen kostte om te maken.
--
-- Verwacht: 6 geaccepteerde vriendschappen, 1 open verzoek, 8 recepten,
-- (⚠ hier stond 5, en dat was geteld en niet nageteld: jij↔Sanne, Bram↔jij,
--  Sanne↔Noor, Bram↔Noor, Sanne↔Youssef, Noor↔Tessa. Zes. Een verkeerd
--  verwacht getal maakt een goede run verdacht, wat het omgekeerde is van
--  waar deze query voor staat.)
-- 6 kookgebeurtenissen, 18 stemmen, 1 doorgestuurd recept.
--
-- (!) `suggested_friends()` STAAT HIER NIET BIJ, en dat is geen omissie. Die
-- functie leest `auth.uid()`, en de SQL-editor draait als `postgres` zonder
-- JWT — hij zou nul rijen teruggeven, wat eruitziet als een defect terwijl
-- het de beveiliging is die werkt. Dat deel test je op een toestel.
-- ---------------------------------------------------------------------------

select 'vrienden (geaccepteerd)' as wat, count(*) as aantal
  from public.friendships where id::text like '5eed5eed%' and status = 'accepted'
union all
select 'verzoeken (open)', count(*)
  from public.friendships where id::text like '5eed5eed%' and status = 'pending'
union all
select 'recepten', count(*) from public.recipes where id::text like '5eed5eed%'
union all
select 'gekookt (bewijs)', count(*) from public.cook_events where id::text like '5eed5eed%'
union all
select 'stemmen (ranglijst)', count(*) from public.recipe_ratings where id::text like '5eed5eed%'
union all
select 'doorgestuurd (pannetje)', count(*) from public.recipe_shares where id::text like '5eed5eed%';
