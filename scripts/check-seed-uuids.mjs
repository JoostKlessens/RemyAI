// Controleert de uuid-literals in supabase/seed/*.sql ZONDER database.
//
// DIT IS DE POORT DIE DE FOUT VAN 8 SEPTEMBER 2026 HAD GEVONDEN. Toen draaide
// de seed voor het eerst en viel om op:
//
//     ERROR: 22P02: invalid input syntax for type uuid:
//     "5eed5eed-0000-4000-8000-00000000h001"
//
// Drieentwintig id's over vier van de negen tabellen, drie dagen onopgemerkt,
// omdat een uuid-literal een datatype heeft dat je niet kunt zien zonder hem te
// parsen. Lezen vond hem niet; parsen vindt hem in een fractie van een seconde.
//
// ---------------------------------------------------------------------------
// WAAROM NODE EN NIET DE GREP-KETEN UIT DE HEADER VAN demo_social.sql
//
// Die keten is:
//
//     grep -v "^\s*--" demo_social.sql \
//       | grep -o "5eed5eed-0000-4000-8000-[0-9a-zA-Z]*" \
//       | grep -v "^5eed5eed-0000-4000-8000-[0-9a-f]\{12\}$"
//
// Hij klopt inhoudelijk en is met de hand gedraaid: nul treffers. Maar als
// npm-script deugt hij niet, om drie redenen, en de eerste is fataal:
//
//  1. DE EXITCODE STAAT OMGEKEERD. `grep -v` eindigt met 1 als er niets
//     overblijft. Geen enkele ongeldige uuid geeft dus exit 1 (= mislukt) en
//     EEN gevonden fout geeft exit 0 (= geslaagd). Precies verkeerd om, en dat
//     is geen poort maar een alarm dat afgaat als er niets aan de hand is.
//  2. HIJ HANGT AAN GIT BASH. npm draait scripts op Windows via cmd.exe; daar
//     bestaat `grep` niet, en `^\s*--` in dubbele aanhalingstekens overleeft de
//     JSON-escaping van package.json niet ongeschonden.
//  3. HIJ KIJKT ALLEEN NAAR HET VOORVOEGSEL 5eed5eed. Een fout uuid met een
//     ander voorvoegsel glipt er onderdoor.
//
// De variant die in de header van demo_social.sql zelf staat mist bovendien het
// `grep -v "^\s*--"`-deel, en meldt daardoor drie valse treffers uit zijn eigen
// commentaarblok (het foutvoorbeeld hierboven staat er letterlijk in).
//
// Node staat er al (het is een Expo-project), draait identiek op cmd.exe,
// PowerShell en Git Bash, en kan zijn eigen exitcode kiezen.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { stripCommentaar } from './sql-comments.mjs';

/** Wat Postgres accepteert als uuid: acht-vier-vier-vier-twaalf, hex, hoofdletters mogen. */
const GELDIGE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Een token met de VORM van een uuid maar met een willekeurig alfabet — dit is
 * wat `...h001` te pakken krijgt. De randen voorkomen dat een langere reeks
 * halverwege wordt aangesneden.
 */
const UUID_VORMIG =
  /(?<![0-9a-zA-Z-])[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}(?![0-9a-zA-Z-])/g;

/**
 * De tweede soort fout, die de vormcontrole hierboven niet ziet: een literal
 * met de juiste tekens maar een verkeerde groepslengte
 * ('5eed5eed-0000-4000-8000-00000001' — acht in plaats van twaalf). Vier
 * streepjes, verder alleen alfanumeriek, en een lengte in de buurt van 36.
 */
const BIJNA_UUID = /'([0-9a-zA-Z]+(?:-[0-9a-zA-Z]+){4})'/g;

// `stripCommentaar` stond hier tot 11 september 2026 en is naar
// ./sql-comments.mjs verhuisd toen check-seed-teardown.mjs hem ook nodig had.
// Zonder die stap meldt deze controle zijn eigen documentatie als fout: de
// header van demo_social.sql citeert het kapotte id om uit te leggen wat er
// misging.

function controleerBestand(pad) {
  const bevindingen = [];
  const regels = readFileSync(pad, 'utf8').split(/\r?\n/);

  regels.forEach((ruweRegel, index) => {
    const regel = stripCommentaar(ruweRegel);
    const regelnummer = index + 1;

    for (const treffer of regel.matchAll(UUID_VORMIG)) {
      if (!GELDIGE_UUID.test(treffer[0])) {
        bevindingen.push({ pad, regelnummer, waarde: treffer[0], reden: 'geen hexadecimaal teken' });
      }
    }

    for (const treffer of regel.matchAll(BIJNA_UUID)) {
      const waarde = treffer[1];
      if (GELDIGE_UUID.test(waarde) || waarde.length < 30 || waarde.length > 40) {
        continue;
      }
      // Al gemeld door de vormcontrole hierboven; niet twee keer noemen.
      if (bevindingen.some((b) => b.regelnummer === regelnummer && b.waarde === waarde)) {
        continue;
      }
      bevindingen.push({ pad, regelnummer, waarde, reden: 'verkeerde groepslengte' });
    }
  });

  return bevindingen;
}

const STANDAARD_BESTANDEN = ['supabase/seed/demo_social.sql', 'supabase/seed/demo_social_teardown.sql'];

const opgegeven = process.argv.slice(2);
const bestanden = opgegeven.length > 0 ? opgegeven : STANDAARD_BESTANDEN;

let bevindingen = [];
for (const pad of bestanden) {
  try {
    bevindingen = bevindingen.concat(controleerBestand(pad));
  } catch (fout) {
    console.error(`Kan ${pad} niet lezen: ${fout.message}`);
    process.exit(2);
  }
}

if (bevindingen.length > 0) {
  console.error(`ONGELDIGE UUID-LITERALS: ${bevindingen.length}`);
  console.error('');
  for (const { pad, regelnummer, waarde, reden } of bevindingen) {
    console.error(`  ${pad}:${regelnummer}  ${waarde}  (${reden})`);
  }
  console.error('');
  console.error('Postgres weigert deze met 22P02 zodra je het bestand plakt.');
  console.error('Een uuid kent alleen 0-9 en a-f, in groepen van 8-4-4-4-12.');
  process.exit(1);
}

console.log(`Geen ongeldige uuid-literals in ${bestanden.length} bestand(en): ${bestanden.join(', ')}`);
