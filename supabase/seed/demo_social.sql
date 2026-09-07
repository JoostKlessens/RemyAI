-- ---------------------------------------------------------------------------
-- Remy — demo-data voor de sociale laag. NEP, HERKENBAAR EN OMKEERBAAR.
--
-- De eigenaar, 8 september 2026: "Ik wil ook dat je een paar mock vrienden en
-- personen toevoegt aan het platform zodat ik kan zien hoe de app werkt in dat
-- stuk" — en daarna: "zorg wel dat het duidelijk is welke data nep is zodat we
-- deze ook weer eenvoudig kunnen verwijderen."
--
-- ALLES WAT DIT BESTAND SCHRIJFT BEGINT MET 5eed5eed. Elke id die hier
-- ontstaat draagt dat voorvoegsel, in elke tabel, zonder uitzondering. Daarmee
-- is "wat is nep?" een query en geen archeologie:
--
--     select 'profiles' as tabel, id from public.profiles where id::text like '5eed5eed%'
--     union all select 'meals', id from public.meals where id::text like '5eed5eed%';
--
-- en demo_social_teardown.sql haalt precies die rijen weg en niets anders.
-- Er is GEEN migratie en GEEN kolom bijgekomen: is de nepdata weg, dan is er
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
-- HOE JE HEM DRAAIT: vul hieronder je eigen handle in, plak het geheel in de
-- Supabase SQL-editor en voer uit. Idempotent — twee keer draaien verandert
-- niets aan de uitkomst.
-- ---------------------------------------------------------------------------

do $$
declare
  -- (!) VUL HIER JE EIGEN HANDLE IN, zonder @. Dit is de enige regel die je
  -- hoort aan te passen. Het script weigert te draaien als hij hem niet vindt:
  -- een vriendschap zonder de andere helft levert een Vrienden-tab op die er
  -- nog steeds leeg uitziet, en dan lijkt het script stuk terwijl de invoer
  -- dat was.
  owner_handle constant text := 'VUL_HIER_JE_HANDLE_IN';

  owner_id uuid;

  -- Vaste id's, zodat opnieuw draaien dezelfde rijen raakt en de teardown ze
  -- exact kan vinden. Het voorvoegsel IS het label.
  sanne_id   constant uuid := '5eed5eed-0000-4000-8000-000000000001';
  bram_id    constant uuid := '5eed5eed-0000-4000-8000-000000000002';
  fatima_id  constant uuid := '5eed5eed-0000-4000-8000-000000000003';

  recipe_a   constant uuid := '5eed5eed-0000-4000-8000-00000000a001';
  recipe_b   constant uuid := '5eed5eed-0000-4000-8000-00000000a002';
  recipe_c   constant uuid := '5eed5eed-0000-4000-8000-00000000a003';
  recipe_d   constant uuid := '5eed5eed-0000-4000-8000-00000000a004';
begin
  select id into owner_id from public.profiles where handle = owner_handle;
  if owner_id is null then
    raise exception
      'Geen profiel met handle %. Vul bovenin je eigen handle in (zonder @). Bekende handles: %',
      owner_handle,
      (select coalesce(string_agg(handle, ', '), '(geen enkel profiel)') from public.profiles);
  end if;

  -- 1. De personen. auth.users eerst, want profiles hangt eraan.
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (sanne_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_sanne@example.invalid',  '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now()),
    (bram_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_bram@example.invalid',   '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now()),
    (fatima_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo_fatima@example.invalid', '{"provider":"demo"}'::jsonb, '{}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, handle, display_name, avatar_url)
  values
    (sanne_id,  'demo_sanne',  'Sanne (demo)',  null),
    (bram_id,   'demo_bram',   'Bram (demo)',   null),
    (fatima_id, 'demo_fatima', 'Fatima (demo)', null)
  on conflict (id) do update set display_name = excluded.display_name;

  -- 2. De vriendschappen. Twee geaccepteerd, een derde in behandeling, zodat
  --    het scherm ook zijn wachtstand toont en niet alleen de gelukkige.
  insert into public.friendships (id, requester_id, addressee_id, status)
  values
    ('5eed5eed-0000-4000-8000-00000000f001', owner_id,  sanne_id,  'accepted'),
    ('5eed5eed-0000-4000-8000-00000000f002', bram_id,   owner_id,  'accepted'),
    ('5eed5eed-0000-4000-8000-00000000f003', fatima_id, owner_id,  'pending')
  on conflict (id) do update set status = excluded.status;

  -- 3. Canonieke recepten. Hier rangschikt Ranglijst op, en hiernaar wijst een
  --    bewijskaart: zonder recipe_id bestaat er geen gedeeld object om het
  --    over te hebben (zie de shared_cooks-view in 0009).
  insert into public.recipes (id, normalized_url, platform, title, estimated_minutes, servings, author_name, dish_tags)
  values
    (recipe_a, 'https://www.tiktok.com/@demo/video/5eed0001', 'tiktok', 'Romige pasta met spinazie',   25, 4, 'demo_kok', array['pasta','vegetarisch']),
    (recipe_b, 'https://www.tiktok.com/@demo/video/5eed0002', 'tiktok', 'Kip uit de oven met citroen', 45, 4, 'demo_kok', array['kip','ovenschotel']),
    (recipe_c, 'https://www.tiktok.com/@demo/video/5eed0003', 'tiktok', 'Rode linzensoep',             30, 4, 'demo_kok', array['soep','veganistisch']),
    (recipe_d, 'https://www.tiktok.com/@demo/video/5eed0004', 'tiktok', 'Wok met noedels en broccoli', 20, 2, 'demo_kok', array['noedels','wok'])
  on conflict (id) do update set title = excluded.title;

  -- 4. Huishoudens voor de vrienden, met delen AAN. Zonder die vlag levert
  --    shared_cooks niets op en blijft de feed leeg — precies de reden dat de
  --    Vrienden-tab er tot nu toe leeg uitzag.
  insert into public.households (id, name, share_cooks_with_friends)
  values
    ('5eed5eed-0000-4000-8000-00000000h001', 'Huishouden Sanne (demo)', true),
    ('5eed5eed-0000-4000-8000-00000000h002', 'Huishouden Bram (demo)',  true)
  on conflict (id) do update set share_cooks_with_friends = true;

  insert into public.household_members (id, household_id, display_name, auth_user_id)
  values
    ('5eed5eed-0000-4000-8000-00000000m001', '5eed5eed-0000-4000-8000-00000000h001', 'Sanne (demo)', sanne_id),
    ('5eed5eed-0000-4000-8000-00000000m002', '5eed5eed-0000-4000-8000-00000000h002', 'Bram (demo)',  bram_id)
  on conflict (id) do nothing;

  -- 5. Hun maaltijden en kookgebeurtenissen. Dit is het bewijs: shared_cooks
  --    koppelt (household_member.auth_user_id, meal.recipe_id) en niets meer.
  insert into public.meals (id, household_id, title, source, recipe_id, estimated_minutes, servings, excluded_from_cook_proof)
  values
    ('5eed5eed-0000-4000-8000-00000000e001', '5eed5eed-0000-4000-8000-00000000h001', 'Romige pasta met spinazie',   'saved', recipe_a, 25, 4, false),
    ('5eed5eed-0000-4000-8000-00000000e002', '5eed5eed-0000-4000-8000-00000000h001', 'Rode linzensoep',             'saved', recipe_c, 30, 4, false),
    ('5eed5eed-0000-4000-8000-00000000e003', '5eed5eed-0000-4000-8000-00000000h002', 'Kip uit de oven met citroen', 'saved', recipe_b, 45, 4, false),
    ('5eed5eed-0000-4000-8000-00000000e004', '5eed5eed-0000-4000-8000-00000000h002', 'Wok met noedels en broccoli', 'saved', recipe_d, 20, 2, false)
  on conflict (id) do update set recipe_id = excluded.recipe_id;

  insert into public.cook_events (id, household_id, meal_id, cooked_on, rating, created_at)
  values
    ('5eed5eed-0000-4000-8000-00000000c001', '5eed5eed-0000-4000-8000-00000000h001', '5eed5eed-0000-4000-8000-00000000e001', current_date - 2, 8.5, now() - interval '2 days'),
    ('5eed5eed-0000-4000-8000-00000000c002', '5eed5eed-0000-4000-8000-00000000h001', '5eed5eed-0000-4000-8000-00000000e002', current_date - 5, 7.0, now() - interval '5 days'),
    ('5eed5eed-0000-4000-8000-00000000c003', '5eed5eed-0000-4000-8000-00000000h002', '5eed5eed-0000-4000-8000-00000000e003', current_date - 1, 9.0, now() - interval '1 day'),
    ('5eed5eed-0000-4000-8000-00000000c004', '5eed5eed-0000-4000-8000-00000000h002', '5eed5eed-0000-4000-8000-00000000e004', current_date - 8, 6.5, now() - interval '8 days')
  on conflict (id) do nothing;

  -- 6. Openbare stemmen. Hier rangschikt Ranglijst op; zonder deze rijen is die
  --    tab leeg ongeacht hoeveel er gekookt is. Vier recepten met verschillende
  --    aantallen stemmen, zodat de sortering zichtbaar iets doet in plaats van
  --    vier gelijke rijen te tonen.
  insert into public.recipe_ratings (id, recipe_id, rater_profile_id, rating)
  values
    ('5eed5eed-0000-4000-8000-00000000r001', recipe_a, sanne_id,  8.5),
    ('5eed5eed-0000-4000-8000-00000000r002', recipe_a, bram_id,   9.0),
    ('5eed5eed-0000-4000-8000-00000000r003', recipe_a, fatima_id, 8.0),
    ('5eed5eed-0000-4000-8000-00000000r004', recipe_b, bram_id,   9.0),
    ('5eed5eed-0000-4000-8000-00000000r005', recipe_b, sanne_id,  7.5),
    ('5eed5eed-0000-4000-8000-00000000r006', recipe_c, sanne_id,  7.0),
    ('5eed5eed-0000-4000-8000-00000000r007', recipe_d, bram_id,   6.5)
  on conflict (id) do update set rating = excluded.rating;

  -- 7. Een doorgestuurd recept, zodat "het pannetje" ook iets te tonen heeft.
  insert into public.recipe_shares (id, meal_id, sender_profile_id, recipient_profile_id, note)
  values
    ('5eed5eed-0000-4000-8000-00000000s001', '5eed5eed-0000-4000-8000-00000000e003', bram_id, owner_id, 'Deze moet je proberen!')
  on conflict (id) do nothing;

  raise notice 'Demo-data geplaatst voor handle %. Alles begint met 5eed5eed; draai demo_social_teardown.sql om het weg te halen.', owner_handle;
end $$;
