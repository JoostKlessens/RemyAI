// `--`-commentaar uit een SQL-regel halen, maar niet als het binnen een string
// staat.
//
// WAAROM DIT EEN EIGEN BESTAND IS EN GEEN KOPIE. Deze functie stond sinds
// 8 september in check-seed-uuids.mjs, en op 11 september kwam er een tweede
// poort bij die exact hetzelfde nodig had. De twee alternatieven waren allebei
// slechter: kopiëren geeft twee parsers die uit elkaar kunnen lopen, en
// importeren uit check-seed-uuids.mjs zou dié poort een tweede keer draaien,
// want dat bestand voert zijn controle uit op moduleniveau.
//
// ZONDER DEZE STAP MELDEN BEIDE POORTEN HUN EIGEN DOCUMENTATIE ALS FOUT. De
// header van demo_social.sql citeert een kapot uuid om uit te leggen wat er
// misging, en de header van de teardown noemt tabelnamen in proza. Een
// controle die commentaar meeleest, meet het commentaar.
//
// REGELNUMMERS BLIJVEN KLOPPEN: commentaar wordt afgekapt, regels worden niet
// weggegooid. Een aanroeper mag dus op index + 1 blijven rekenen.

/**
 * @param {string} regel Eén regel SQL, zonder regeleinde.
 * @returns {string} Dezelfde regel, met een eventueel `--`-staartcommentaar eraf.
 */
export function stripCommentaar(regel) {
  let inString = false;
  for (let i = 0; i < regel.length; i += 1) {
    const teken = regel[i];
    if (teken === "'") {
      // '' binnen een string is een ontsnapt aanhalingsteken, geen einde.
      if (inString && regel[i + 1] === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (!inString && teken === '-' && regel[i + 1] === '-') {
      return regel.slice(0, i);
    }
  }
  return regel;
}

/**
 * Hetzelfde, over een heel bestand.
 *
 * @param {string} inhoud De ruwe bestandsinhoud.
 * @returns {readonly string[]} De regels, elk zonder staartcommentaar.
 */
export function stripCommentaarPerRegel(inhoud) {
  return inhoud.split(/\r?\n/).map(stripCommentaar);
}
