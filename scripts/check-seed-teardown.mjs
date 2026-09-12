// Controleert dat de teardown elke tabel leegt die de seed vult — ZONDER
// database.
//
// DIT IS DE POORT DIE DE FOUT VAN 11 SEPTEMBER 2026 HAD GEVONDEN. Migratie
// 0021 maakte `follows` de sociale graaf en `friendships` een bevroren kopie.
// demo_social.sql verhuisde diezelfde dag mee en schrijft sindsdien dertien
// rijen in `public.follows`. demo_social_teardown.sql verhuisde NIET mee. Het
// gevolg is de ergste soort: een opruimscript dat exit 0 geeft en zegt dat het
// klaar is, terwijl er dertien demo-volgrelaties blijven staan. En juist die
// tabel voedt "Misschien ken je", dus wie de teardown draaide vóór een echte
// tester en hem vertrouwde, liet drie neppe mensen op diens scherm staan.
//
// ---------------------------------------------------------------------------
// WAAROM check-seed-uuids.mjs DIT NIET KON VINDEN, EN WAAROM DAT GEEN GEBREK
// AAN DIE POORT IS
//
// Die poort parseert uuid-LITERALS. Elk id in het nieuwe `follows`-blok is een
// geldig uuid, dus hij keurde het terecht goed. Hij kan per constructie niet
// zien dat een tabelnaam in het ENE bestand staat en in het ANDERE niet: dat
// is geen eigenschap van een waarde maar van het verschil tussen twee
// bestanden, en dat is precies wat dit script meet.
//
// ---------------------------------------------------------------------------
// WAAROM DE "EEN VOORVOEGSEL EN NIETS ANDERS"-REGEL HIER NIET TEGEN BESCHERMDE
//
// De teardown draagt in zijn kop een sterk en juist argument: hij houdt geen
// lijst van RIJEN bij, want die raakt achter zodra de seed groeit; hij vraagt
// het de database via `id like '5eed5eed%'`. Dat klopt — maar het beschermt
// tegen een verouderde lijst BINNEN een tabel. De verzameling TABELLEN is nog
// altijd een lijst met de hand, in twee bestanden, en niets hield die twee in
// de pas. Een goed argument dat één laag lager niet meer geldt is moeilijker te
// zien dan een fout argument, en daarom staat hij hier opgeschreven.
//
// ---------------------------------------------------------------------------
// WAT DIT SCRIPT NIET IS
//
// Geen SQL-parser. Het herkent `insert into <tabel>` en `delete from <tabel>`
// en verder niets — genoeg voor twee bestanden die in deze vorm geschreven
// zijn, en ruim onvoldoende voor willekeurige SQL. Zodra de seed een tabel via
// een CTE of een `execute` vult, ziet deze poort dat niet, en dan hoort dit
// commentaar mee te veranderen.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { stripCommentaarPerRegel } from './sql-comments.mjs';

/**
 * De twee bestanden, met de standaard als argument te overschrijven — net als
 * check-seed-uuids.mjs doet.
 *
 * DAT IS GEEN COMFORT MAAR DE MANIER WAAROP DEZE POORT BEWEZEN IS. Een controle
 * die alleen groen is op het gerepareerde bestand toont niets aan; met deze twee
 * argumenten kun je hem tegen de versie van vóór de reparatie draaien, waar hij
 * exit 1 hoort te geven:
 *
 *     git show HEAD:supabase/seed/demo_social_teardown.sql > /tmp/oud.sql
 *     node scripts/check-seed-teardown.mjs supabase/seed/demo_social.sql /tmp/oud.sql
 */
const [SEED = 'supabase/seed/demo_social.sql', TEARDOWN = 'supabase/seed/demo_social_teardown.sql'] =
  process.argv.slice(2);

/** `insert into public.follows (...)` en `insert into auth.users (...)`. */
const INSERT = /\binsert\s+into\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi;
/** `delete from public.follows where ...`. */
const DELETE = /\bdelete\s+from\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi;
/** De labels uit de controle-select: `select 'profiles' as tabel`, `union all select 'follows',`. */
const LABEL = /\bselect\s+'([a-z_][a-z0-9_.]*)'/gi;

/**
 * Alle tabellen die een patroon in een bestand aanwijst.
 *
 * @param {string} inhoud Bestandsinhoud, commentaar mag er nog in zitten.
 * @param {RegExp} patroon Een globaal patroon met de tabelnaam in groep 1.
 * @returns {Set<string>} De namen zoals ze er staan, kleine letters.
 */
function tabellen(inhoud, patroon) {
  const gevonden = new Set();
  for (const regel of stripCommentaarPerRegel(inhoud)) {
    for (const treffer of regel.matchAll(patroon)) {
      gevonden.add(treffer[1].toLowerCase());
    }
  }
  return gevonden;
}

/**
 * Hoe de controle-select een tabel noemt.
 *
 * HET SCHEMA VALT WEG BIJ `public` EN BLIJFT STAAN BIJ DE REST, want dat is wat
 * het bestand vandaag doet: `'profiles'` naast `'auth.users'`. Die inconsistentie
 * is bewust — `public` is de standaard en meeschrijven maakt de kolom breder
 * zonder iets toe te voegen, terwijl `auth` juist het enige spoor is dat je
 * buiten het publieke schema moet zoeken.
 *
 * @param {string} tabel Een naam zoals hij in de SQL staat.
 * @returns {readonly string[]} De labels die als geldig gelden.
 */
function toegestaneLabels(tabel) {
  const zonderPublic = tabel.startsWith('public.') ? tabel.slice('public.'.length) : tabel;
  return zonderPublic === tabel ? [tabel] : [tabel, zonderPublic];
}

function lees(pad) {
  try {
    return readFileSync(pad, 'utf8');
  } catch (fout) {
    console.error(`Kan ${pad} niet lezen: ${fout.message}`);
    process.exit(2);
  }
}

const seed = lees(SEED);
const teardown = lees(TEARDOWN);

const gevuld = tabellen(seed, INSERT);
const geleegd = tabellen(teardown, DELETE);
const gelabeld = tabellen(teardown, LABEL);

/** Een tabel die de seed vult en de teardown niet leegt. Dit is de fout van 11 september. */
const nietGeleegd = [...gevuld].filter((tabel) => !geleegd.has(tabel)).sort();

/**
 * Een tabel die de teardown wél leegt maar niet meetelt in zijn eigen controle.
 *
 * Minder erg dan hierboven en toch een echte fout: de select is wat je NA het
 * draaien afleest om te geloven dat het gelukt is, en een tabel die daar
 * ontbreekt geeft nul terug omdat hij niet gemeten wordt, niet omdat hij leeg is.
 */
const nietGemeten = [...geleegd]
  .filter((tabel) => !toegestaneLabels(tabel).some((label) => gelabeld.has(label)))
  .sort();

if (nietGeleegd.length > 0 || nietGemeten.length > 0) {
  if (nietGeleegd.length > 0) {
    console.error(`TABELLEN DIE DE SEED VULT EN DE TEARDOWN NIET LEEGT: ${nietGeleegd.length}`);
    console.error('');
    for (const tabel of nietGeleegd) {
      console.error(`  ${tabel}  —  wel 'insert into' in ${SEED}, geen 'delete from' in ${TEARDOWN}`);
    }
    console.error('');
    console.error('De teardown zegt dan dat hij klaar is terwijl er demo-data blijft staan.');
    console.error(`Voeg een delete toe in ${TEARDOWN}, vóór public.profiles vanwege de foreign keys.`);
    console.error('');
  }
  if (nietGemeten.length > 0) {
    console.error(`TABELLEN DIE DE TEARDOWN LEEGT MAAR NIET MEET: ${nietGemeten.length}`);
    console.error('');
    for (const tabel of nietGemeten) {
      console.error(`  ${tabel}  —  wel 'delete from', niet in de controle-select onderaan`);
    }
    console.error('');
    console.error('Die select is wat je afleest om te geloven dat het gelukt is.');
    console.error('');
  }
  process.exit(1);
}

console.log(
  `Teardown dekt alle ${gevuld.size} tabellen die de seed vult, en meet alle ${geleegd.size} die hij leegt.`,
);
