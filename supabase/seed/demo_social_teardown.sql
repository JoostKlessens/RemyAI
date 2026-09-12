-- ---------------------------------------------------------------------------
-- Remy — demo-data weghalen. Het spiegelbeeld van demo_social.sql.
--
-- EEN VOORVOEGSEL EN NIETS ANDERS. Elke rij die de seed schreef draagt een id
-- die met 5eed5eed begint, dus dit bestand hoeft niet te weten WELKE rijen dat
-- waren — het vraagt het de database. Dat is het hele punt van die keuze: een
-- teardown die een LIJST bijhoudt raakt achter zodra iemand de seed uitbreidt,
-- en dan blijft er nepdata staan die niemand meer als nepdata herkent.
--
-- VEILIG OM TE DRAAIEN ALS ER NIETS STAAT. Elke delete is een no-op op een
-- lege verzameling; er is geen volgorde waarin dit iets kapotmaakt, en geen
-- stand waarin twee keer draaien iets anders doet dan één keer.
--
-- DE VOLGORDE IS ER VOOR DE FOREIGN KEYS en loopt van blad naar wortel. Veel
-- hiervan zou ook door `on delete cascade` gebeuren; expliciet verwijderen
-- zegt precies wat er weggaat in plaats van het over te laten aan een cascade
-- die iemand later kan wijzigen.
--
-- ALLES IN ÉÉN TRANSACTIE, zodat een fout halverwege geen half opgeruimde
-- database achterlaat — de toestand waarin "is de demo-data weg?" geen
-- eenduidig antwoord meer heeft.
--
-- (!) follows EN blocks ZIJN ER OP 11 SEPTEMBER 2026 BIJ GEKOMEN, en de reden
-- dat ze ontbraken is het leerzame deel. Migratie 0021 maakte `follows` DE
-- graaf en `friendships` een bevroren kopie; demo_social.sql verhuisde diezelfde
-- dag mee en schrijft sindsdien dertien rijen in `follows`. Dit bestand
-- verhuisde NIET mee en bleef alleen `friendships` legen — dus "de teardown is
-- gedraaid" betekende dertien demo-volgrelaties die bleven staan, precies de
-- toestand waar de kop hierboven voor waarschuwt. De EEN-VOORVOEGSEL-regel
-- beschermt tegen een verouderde lijst BINNEN een tabel; tegen een tabel die
-- er niet bij staat beschermt hij niets, en dat verschil was onopgemerkt.
-- `scripts/check-seed-teardown.mjs` is de poort die dit voortaan vindt.
--
-- (!) blocks STAAT ER TERWIJL DE SEED ER GEEN RIJ IN SCHRIJFT, en dat is geen
-- vergissing om op te ruimen. De delete is een no-op op een lege verzameling
-- (zie VEILIG OM TE DRAAIEN hierboven) en kost niets; wat hij wél doet is de
-- dag opvangen waarop iemand een geblokkeerd demo-profiel toevoegt om het
-- blokkeerscherm te kunnen zien. Dat is exact het scenario dat `follows`
-- hierboven wél overkwam.
--
-- (!) auth.users GAAT ALS LAATSTE. profiles hangt eraan met een cascade, dus
-- die rijen zouden vanzelf meegaan. Ze staan er apart in omdat een
-- auth-gebruiker die blijft rondhangen het enige spoor is dat je niet in het
-- publieke schema terugvindt — en dus het enige dat je zou missen als je
-- alleen naar de tabellen van de app keek.
-- ---------------------------------------------------------------------------

begin;

delete from public.recipe_shares     where id::text like '5eed5eed%';
delete from public.recipe_ratings    where id::text like '5eed5eed%';
delete from public.cook_events       where id::text like '5eed5eed%';
delete from public.meals             where id::text like '5eed5eed%';
delete from public.household_members where id::text like '5eed5eed%';
delete from public.households        where id::text like '5eed5eed%';
delete from public.recipes           where id::text like '5eed5eed%';
delete from public.follows           where id::text like '5eed5eed%';
delete from public.blocks            where id::text like '5eed5eed%';
delete from public.friendships       where id::text like '5eed5eed%';
delete from public.profiles          where id::text like '5eed5eed%';
delete from auth.users               where id::text like '5eed5eed%';

commit;

-- Controle. Dit hoort overal nul terug te geven; staat er ergens iets anders,
-- dan is er een tabel bijgekomen die de seed wel vult en dit bestand niet
-- leegt.
select 'profiles' as tabel, count(*) from public.profiles where id::text like '5eed5eed%'
union all select 'follows',           count(*) from public.follows           where id::text like '5eed5eed%'
union all select 'blocks',            count(*) from public.blocks            where id::text like '5eed5eed%'
union all select 'friendships',       count(*) from public.friendships       where id::text like '5eed5eed%'
union all select 'recipes',           count(*) from public.recipes           where id::text like '5eed5eed%'
union all select 'households',        count(*) from public.households        where id::text like '5eed5eed%'
union all select 'household_members', count(*) from public.household_members where id::text like '5eed5eed%'
union all select 'meals',             count(*) from public.meals             where id::text like '5eed5eed%'
union all select 'cook_events',       count(*) from public.cook_events       where id::text like '5eed5eed%'
union all select 'recipe_ratings',    count(*) from public.recipe_ratings    where id::text like '5eed5eed%'
union all select 'recipe_shares',     count(*) from public.recipe_shares     where id::text like '5eed5eed%'
union all select 'auth.users',        count(*) from auth.users               where id::text like '5eed5eed%';
