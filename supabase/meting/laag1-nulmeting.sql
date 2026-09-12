-- ---------------------------------------------------------------------------
-- Remy — laag 1 van het meetplan, als één draaibaar bestand.
--
-- WAT DIT IS. `docs/archief/MEETPLAN.md` beschrijft twee lagen. Laag 1 is
-- "SQL over wat er al staat": geen migratie, geen trackingcode, geen externe
-- verwerker. Dat plan droeg 21 queries verspreid over zeshonderd regels proza,
-- en stap 1 van zijn eigen volgorde is: draai ze één keer als nulmeting. Dit
-- bestand is die stap, uitvoerbaar gemaakt.
--
-- ALLES HIERIN IS EEN `select`. Geen insert, geen update, geen delete, geen
-- DDL. Het is veilig tegen productie te draaien en veilig twee keer te draaien.
--
-- HOE. Plak dit in de SQL-editor van het Supabase-dashboard, of draai het per
-- blok. De CLI in deze repo heeft géén `db query`-subcommando (gecontroleerd op
-- 12 september 2026: `npx supabase db --help` geeft diff, dump, push, pull,
-- reset), dus het npm-script `db:seed` werkt alleen tegen een lokale stack met
-- een oudere CLI. De SQL-editor is de route die dit project eerder voor `0013`
-- gebruikte.
--
-- ===========================================================================
-- REGEL NUL — DEMO-DATA TELT NIET MEE
-- ===========================================================================
--
-- `supabase/seed/demo_social.sql` schrijft nepdata waarvan elke id begint met
-- `5eed5eed`. Elke query hieronder filtert daarop, en waar de vraag over een
-- huishouden of een persoon gaat óók op die sleutel — een echte `cook_events`-
-- rij in een demo-huishouden is nog steeds demo.
--
-- ⚠ ZEG ERBIJ WELKE VAN DE TWEE JE MEET. Draai de teardown vóór de nulmeting
-- (`supabase/seed/demo_social_teardown.sql`), óf noteer dat de nulmeting de
-- demo bevat. Dat onderscheid vergeten is hoe een nulmeting later onleesbaar
-- wordt.
--
-- ===========================================================================
-- ⚠ WAT ER SINDS HET PLAN VERANDERD IS, EN WAT DAT AAN DE QUERIES DEED
-- ===========================================================================
--
-- Het meetplan is kolom voor kolom nagelopen tegen `0001` t/m `0019`. Er zijn
-- daarna drie migraties geland, en juist die drie raken de sociale laag:
--
--   0020  `saves.origin`
--   0021  `follows` en `blocks`; `friendships` wordt een BEVROREN KOPIE
--   0022  `shared_cooks` volgt de follow
--
-- DAARDOOR WAS ÉÉN QUERY STIL FOUT. Het plan vraagt "worden er vriendschappen
-- gesloten?" en leest `public.friendships`. Sinds `0021` is dat niet meer de
-- waarheid maar een bevroren kopie: `follows` is de graaf, niets in het product
-- schrijft nog naar `friendships`, en geen trigger houdt de twee in de pas. Die
-- query zou dus voor altijd de stand van vóór 11 september rapporteren, zonder
-- te falen en zonder het te zeggen — het soort fout dat een nulmeting waardeloos
-- maakt omdat hij plausibel oogt. Vraag 8 hieronder is herschreven.
--
-- EN HET IS GEEN HERNOEMING. `follows` is GERICHT: een vriendschap is daar twee
-- geaccepteerde rijen, één per kant. `count(*)` op `follows` telt kanten, geen
-- vriendschappen. 8a telt de kanten, 8b telt de wederzijdse paren, en het
-- verschil tussen die twee is zelf een meting: eenzijdig volgen.
--
-- ⚠ EN ÉÉN MEETVRAAG HEEFT VANDAAG GEEN BRON. `saves.origin` (0020) bestaat om
-- de closed-loop rate te kunnen splitsen naar waar een bewaring vandaan kwam.
-- De tabel `saves` staat er sinds `0001` — maar **niets in de app schrijft
-- ernaar**: `grep -rn "from('saves')" src/` geeft nul treffers, de bewaringen
-- zijn local-only. Een query erop geeft nul rijen, en dat is geen bevinding over
-- gedrag. Dat is LONGLIST ONT-05, en zolang die openstaat is de closed-loop
-- rate alleen via `recipe_shares` te benaderen (vraag 10).
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- DEEL A — DE TRECHTER: van een geplakte link tot een gekookt bord
-- ===========================================================================

-- 1. Wat is er de afgelopen 48 uur geprobeerd, per platform?
--    ⚠ `import_attempts` wordt elk uur op :17 geleegd tot 48 uur (0013), dus
--    dit is per definitie een venster en nooit een totaal.
select
  platform,
  count(*)                            as pogingen,
  sum(cost_units)                     as modelaanroepen,
  count(distinct caller_fingerprint)  as bellers,
  count(distinct household_id)        as huishoudens
from public.import_attempts
where attempted_at > now() - interval '48 hours'
group by platform
order by pogingen desc;


-- 2. Welke platforms leveren daadwerkelijk een extractie op?
select
  platform,
  count(*)              as recepten,
  min(created_at)::date as eerste,
  max(created_at)::date as laatste
from public.recipes
where id::text not like '5eed5eed%'
group by platform
order by recepten desc;


-- 3. Hoeveel van wat er geëxtraheerd is, is ook daadwerkelijk bewaard?
--    Het gat tussen deze en vraag 2 is "wel gelukt, niet gewild".
select
  platform,
  count(*)                             as extracties,
  count(*) filter (where niet_bewaard) as door_niemand_bewaard
from (
  select
    r.platform,
    not exists (
      select 1 from public.meals m
      where m.recipe_id = r.id
        and m.id::text           not like '5eed5eed%'
        and m.household_id::text not like '5eed5eed%'
    ) as niet_bewaard
  from public.recipes r
  where r.id::text not like '5eed5eed%'
) t
group by platform
order by extracties desc;


-- 4. Wat staat er per huishouden, en hoe kwam het binnen?
select
  m.household_id,
  count(*)                                          as recepten_totaal,
  count(*) filter (where m.recipe_id is not null)   as geimporteerd,
  count(*) filter (where m.recipe_id is null)       as handmatig_of_geseed,
  count(*) filter (where m.archived_at is not null) as verwijderd,
  min(m.created_at)::date                           as eerste,
  max(m.created_at)::date                           as laatste
from public.meals m
where m.id::text           not like '5eed5eed%'
  and m.household_id::text not like '5eed5eed%'
group by m.household_id
order by recepten_totaal desc;


-- 5. Kookmomenten per huishouden per week.
select
  ce.household_id,
  date_trunc('week', ce.cooked_on::timestamp)::date as week,
  count(*)                                          as kookmomenten,
  count(distinct ce.meal_id)                        as verschillende_gerechten
from public.cook_events ce
where ce.id::text           not like '5eed5eed%'
  and ce.household_id::text not like '5eed5eed%'
group by 1, 2
order by 1, 2;


-- 6. SAVE-TO-COOK, GESLOTEN COHORT. Alleen recepten die minstens veertien dagen
--    de kans hebben gehad. Zonder die afkap daalt het getal naarmate er meer
--    geïmporteerd wordt, wat het onleesbaar maakt.
with bewaard as (
  select m.id, m.household_id, m.title, m.created_at
  from public.meals m
  where m.id::text           not like '5eed5eed%'
    and m.household_id::text not like '5eed5eed%'
    and m.recipe_id is not null
    and m.created_at <= now() - interval '14 days'
),
eerste_kook as (
  select
    b.household_id,
    b.created_at,
    (
      select min(ce.created_at)
      from public.cook_events ce
      where ce.meal_id = b.id
        and ce.id::text not like '5eed5eed%'
        and ce.created_at <= b.created_at + interval '14 days'
    ) as gekookt_op
  from bewaard b
)
select
  household_id,
  count(*)          as bewaard,
  count(gekookt_op) as gekookt_binnen_14_dagen,
  round(avg(extract(epoch from gekookt_op - created_at)) / 86400.0, 1)
                    as gem_dagen_tot_koken
from eerste_kook
group by household_id
order by bewaard desc;


-- 7. Dezelfde trechter, maar per recept en zonder afkap — dit is de lijst waar
--    je bij n=5 een gesprek mee voert.
with bewaard as (
  select m.id, m.household_id, m.title, m.created_at
  from public.meals m
  where m.id::text           not like '5eed5eed%'
    and m.household_id::text not like '5eed5eed%'
    and m.recipe_id is not null
)
select
  b.household_id,
  b.title,
  b.created_at::date               as bewaard_op,
  (select min(ce.created_at)::date
     from public.cook_events ce
    where ce.meal_id = b.id
      and ce.id::text not like '5eed5eed%') as eerst_gekookt_op,
  now()::date - b.created_at::date as dagen_oud
from bewaard b
order by b.household_id, b.created_at;


-- ===========================================================================
-- DEEL B — DE SOCIALE LAAG
-- ===========================================================================

-- 8a. ⚠ HERSCHREVEN — leest `follows` en niet `friendships`. Zie de kop.
--     Worden er volgrelaties gesloten, en hoe snel wordt er geantwoord?
--     Dit telt KANTEN. Een wederzijdse vriendschap is er twee.
--     `responded_at` is null zolang een verzoek open staat en wordt op null
--     gezet bij een hernieuwd verzoek (0021 neemt die semantiek over van 0007:
--     "a new question rather than an amendment to an answered one"), dus het
--     gemiddelde geldt alleen voor beantwoorde rijen en telt een heraanvraag
--     als één antwoord.
select
  status,
  count(*) as kanten,
  round(avg(extract(epoch from responded_at - created_at)) / 3600.0, 1)
    as gem_uren_tot_antwoord
from public.follows
where id::text not like '5eed5eed%'
group by status
order by kanten desc;


-- 8b. Hoeveel daarvan zijn WEDERZIJDS — dat is pas een vriendschap. Het
--     verschil met 8a's `accepted` is het aantal eenzijdige volgrelaties, en
--     dat getal is zelf de meting: PD-024 maakte de graaf gericht juist om
--     eenzijdig volgen mogelijk te maken.
select
  count(*) filter (where wederzijds)     as wederzijdse_paren,
  count(*) filter (where not wederzijds) as eenzijdig_volgen
from (
  select
    f.follower_id,
    f.followee_id,
    exists (
      select 1 from public.follows t
      where t.follower_id = f.followee_id
        and t.followee_id = f.follower_id
        and t.status = 'accepted'
        and t.id::text not like '5eed5eed%'
    ) as wederzijds
  from public.follows f
  where f.status = 'accepted'
    and f.id::text not like '5eed5eed%'
    -- Elk paar één keer, anders telt een wederzijdse relatie dubbel.
    and (
      f.follower_id < f.followee_id
      or not exists (
        select 1 from public.follows t
        where t.follower_id = f.followee_id
          and t.followee_id = f.follower_id
          and t.status = 'accepted'
          and t.id::text not like '5eed5eed%'
      )
    )
) t;


-- 8c. ⚠ NIEUW — het plan kende `blocks` nog niet. Wordt er geblokkeerd, en
--     wordt het teruggedraaid? Een opgeheven block blijft als rij staan
--     (`lifted_at`), dus dit is te tellen zonder iets te bewaren dat er niet al
--     was.
select
  count(*)                                  as blocks_ooit,
  count(*) filter (where lifted_at is null)  as nu_van_kracht,
  count(lifted_at)                          as opgeheven
from public.blocks
where id::text not like '5eed5eed%';


-- 9. Wordt het pannetje gebruikt, en komt het aan?
select
  count(*)            as verstuurd,
  count(seen_at)      as geopend,
  count(withdrawn_at) as ingetrokken,
  count(note)         as met_briefje,
  round(avg(extract(epoch from seen_at - created_at)) / 3600.0, 1)
    as gem_uren_tot_openen
from public.recipe_shares
where id::text                   not like '5eed5eed%'
  and sender_profile_id::text    not like '5eed5eed%'
  and recipient_profile_id::text not like '5eed5eed%';


-- 10. DE GESLOTEN LUS (DESIGN-SOCIAL §3.4): leidt een zending tot een kook?
--     ⚠ Dit is vandaag de ENIGE benadering ervan. `saves.origin` is gebouwd om
--     dit te kunnen splitsen naar herkomst, maar niets schrijft naar `saves` —
--     zie de kop en LONGLIST ONT-05.
--     De join op `hm.auth_user_id = rs.recipient_profile_id` klopt omdat
--     `profiles.id` en `household_members.auth_user_id` allebei naar
--     `auth.users(id)` verwijzen (0007 en 0001).
select
  rs.created_at::date as verstuurd_op,
  exists (
    select 1
    from public.meals m2
    join public.cook_events ce       on ce.meal_id      = m2.id
    join public.household_members hm on hm.household_id = m2.household_id
    where hm.auth_user_id = rs.recipient_profile_id
      and m2.recipe_id    = m.recipe_id
      and ce.created_at   > rs.created_at
      and ce.id::text not like '5eed5eed%'
  ) as ontvanger_kookte_het
from public.recipe_shares rs
join public.meals m on m.id = rs.meal_id
where rs.id::text not like '5eed5eed%'
  and m.recipe_id is not null
order by rs.created_at;


-- 11. Hoeveel huishoudens delen hun koken? (PD-022's standaard)
select share_cooks_with_friends, count(*)
from public.households
where id::text not like '5eed5eed%'
group by 1;


-- 12. Hoe vaak wordt "Deel deze niet" gebruikt? (PD-022's ontsnapping)
select
  count(*) filter (where excluded_from_cook_proof) as niet_delen,
  count(*)                                         as recepten
from public.meals
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%';


-- ===========================================================================
-- DEEL C — DE BIBLIOTHEEK: wat staat er, en wat verstoft
-- ===========================================================================

-- 13. Wordt de cijfervraag beantwoord?
--     ⚠ Dit is de nulmeting voor de cijfervraag-na-twaalf-uur (GAP-46). Die
--     sheet is sinds 7 september gebouwd en gemonteerd, dus dit getal meet
--     vanaf nu gedrag en niet langer afwezigheid.
select
  count(*)                 as kookmomenten,
  count(rating)            as met_cijfer,
  count(*) - count(rating) as zonder_cijfer,
  round(avg(rating), 1)    as gemiddeld_cijfer,
  min(rating)              as laagste,
  max(rating)              as hoogste
from public.cook_events
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%';


-- 14. Openbare stemmen — de andere helft van PD-023.
select
  count(*)                          as stemmen,
  count(distinct rater_profile_id)  as stemmers,
  count(distinct recipe_id)         as recepten,
  round(avg(rating), 1)             as gemiddeld
from public.recipe_ratings
where id::text               not like '5eed5eed%'
  and rater_profile_id::text not like '5eed5eed%';


-- 15. Wat is er nooit gekookt, en hoe lang staat het er al?
select
  m.household_id,
  m.title,
  m.created_at::date               as binnengekomen,
  now()::date - m.created_at::date as dagen_oud,
  r.platform
from public.meals m
left join public.recipes r on r.id = m.recipe_id
where m.id::text           not like '5eed5eed%'
  and m.household_id::text not like '5eed5eed%'
  and m.archived_at is null
  and not exists (
    select 1 from public.cook_events ce
    where ce.meal_id = m.id and ce.id::text not like '5eed5eed%'
  )
order by m.household_id, dagen_oud desc;


-- 16. Welke gerechten komen terug in de rotatie?
select
  m.household_id,
  m.title,
  count(*)          as keren_gekookt,
  max(ce.cooked_on) as laatst
from public.cook_events ce
join public.meals m on m.id = ce.meal_id
where ce.id::text           not like '5eed5eed%'
  and ce.household_id::text not like '5eed5eed%'
group by m.household_id, m.id, m.title
having count(*) > 1
order by keren_gekookt desc;


-- 17. Wordt de stemmingsvraag na het koken beantwoord?
select
  count(*)                                            as recepten,
  count(*) filter (where cardinality(dish_moods) > 0) as met_stemming
from public.meals
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%';


-- 18. En welke stemmingen dan.
select mood, count(*) as keren
from public.meals m, unnest(m.dish_moods) as mood
where m.id::text           not like '5eed5eed%'
  and m.household_id::text not like '5eed5eed%'
group by mood
order by keren desc;


-- 19. Wordt het gerechttype ooit veranderd? (0017's gesloten woordenlijst)
select dish_course, count(*)
from public.meals
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%'
group by dish_course
order by count(*) desc;


-- 20. Hoeveel recepten zijn allergeen-gecontroleerd? (PD-006)
select allergen_tag_status, count(*)
from public.meals
where id::text           not like '5eed5eed%'
  and household_id::text not like '5eed5eed%'
group by allergen_tag_status;


-- 21. Landen de ingrediënten, en krijgen ze kopjes? (0018)
select
  m.household_id,
  count(distinct mi.meal_id) as recepten_met_ingredienten,
  count(*)                   as ingredientregels,
  count(mi.section)          as regels_met_kopje
from public.meal_ingredients mi
join public.meals m on m.id = mi.meal_id
where m.id::text           not like '5eed5eed%'
  and m.household_id::text not like '5eed5eed%'
group by m.household_id;


-- ---------------------------------------------------------------------------
-- WAT LAAG 1 NIET KAN, zodat je niet gaat zoeken naar wat er niet is.
--
--  * KIEZEN IS BIJNA ONZICHTBAAR. `decisions` wordt door de app niet
--    gespiegeld; wat een huishouden aangeboden kreeg en afwees staat nergens.
--    `ARCHITECTURE.md` draagt sinds 5 september een banner over waarom de
--    16:00-functie niet tegen deze database te bouwen is, en dat antwoord
--    bepaalt of de halve trechter ooit in SQL komt.
--  * DE WEIGERMETING IS WEG. `handleDecline` was de enige schrijver van
--    `status = 'skipped'` en is met PD-021 verdwenen. Een geweigerde avond is
--    niet te onderscheiden van een avond waarop niemand de app opende.
--  * BOODSCHAPPEN STAAT NERGENS. Er is geen tabel; vraag 21 meet de
--    ingrediënten, niet het gebruik van de lijst.
--  * BEWARINGEN ZIJN LOCAL-ONLY. Zie de kop bij `saves`.
--
-- En de regel die het plan hard maakt: **laag 2 begint pas ná de test**, en
-- alleen voor vragen waarvan hier is aangetoond dat ze niet te beantwoorden
-- zijn. Elk event hangt dan aan een vooraf opgeschreven vraag, in de
-- tabelcomment ernaast. Geen autocapture — de kop van
-- `src/domain/import/importTelemetry.ts` legt uit waarom dat de vorm is waarin
-- een app stilzwijgend een dagboek van andermans eetgewoonten aanlegt.
-- ---------------------------------------------------------------------------
