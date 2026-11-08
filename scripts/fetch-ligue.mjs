// Récupère le calendrier et les résultats de la Ligue de Karting Occitanie Pyrénées
// et les écrit dans data/ligue.json. En cas d'échec, l'ancien fichier est conservé
// et le script se termine en erreur (GitHub envoie alors un e-mail d'alerte).
import { readFileSync, writeFileSync } from 'node:fs';
import {
  parseSeasonYear, parseCourses, parseResults, attachResults, findResultsPage,
} from './lib/ligue.mjs';

const COURSES_URL = 'https://vitrine.karting-midipyrenees.fr/courses/';
const OUT = new URL('../data/ligue.json', import.meta.url);
const UA = 'VYT-Racing-site (association; +https://vyt-racing.github.io)';

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const coursesHtml = await get(COURSES_URL);
  const year = parseSeasonYear(coursesHtml) || new Date().getFullYear();
  const races = parseCourses(coursesHtml, year);
  if (races.length === 0) {
    throw new Error('Aucune course trouvée : la mise en page du site de la ligue a peut-être changé.');
  }

  const resultsUrl = findResultsPage(coursesHtml, COURSES_URL)
    || `https://vitrine.karting-midipyrenees.fr/${year}-2/`;
  let standings = [];
  try {
    const results = parseResults(await get(resultsUrl));
    attachResults(races, results);
    standings = results.standings;
  } catch (err) {
    console.warn(`Résultats indisponibles (${err.message}) — calendrier publié sans liens de résultats.`);
  }

  const data = {
    season: year,
    source: COURSES_URL,
    resultsPage: resultsUrl,
    live: 'https://live.apex-timing.com/ligue-karting-op/',
    races,
    standings,
  };

  let previous = null;
  try { previous = JSON.parse(readFileSync(OUT, 'utf8')); } catch { /* premier passage */ }
  const same = previous && JSON.stringify({ ...previous, fetchedAt: null }) === JSON.stringify({ ...data, fetchedAt: null });
  data.fetchedAt = same ? previous.fetchedAt : new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`Saison ${year} : ${races.length} épreuves, ${standings.length} classements${same ? ' (inchangé)' : ''}.`);
}

main().catch((err) => {
  console.error(`Import de la ligue en échec : ${err.message}`);
  process.exit(1);
});
