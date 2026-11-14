// Récupère les dernières actualités du karting en Occitanie (flux RSS publics)
// et les écrit dans data/actus.json : titre, date, source et lien uniquement.
// Une source qui ne répond pas est ignorée ; si aucune ne répond, l'ancien fichier est conservé.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { parseRss, estRegional, fusionner } from './lib/actus.mjs';

const SOURCES = [
  // Flux de la ligue : tout est régional
  { nom: 'Ligue Occitanie Pyrénées', url: 'https://karting-midipyrenees.fr/feed/', filtrer: false },
  { nom: 'Ligue Occitanie Pyrénées', url: 'https://vitrine.karting-midipyrenees.fr/feed/', filtrer: false },
  // Karting-Sud couvre tout le Sud : on ne garde que l'Occitanie
  { nom: 'Karting-Sud', url: 'https://www.karting-sud.com/feed/', filtrer: true },
];
const OUT = new URL('../data/actus.json', import.meta.url);
const UA = 'VYT-Racing-site (association; +https://vyt-racing.com)';

async function lire(source) {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = parseRss(await res.text(), source.nom);
  return source.filtrer ? items.filter(estRegional) : items;
}

async function main() {
  const listes = [];
  const bilan = [];
  for (const s of SOURCES) {
    try {
      const items = await lire(s);
      listes.push(items);
      bilan.push(`${s.url} : ${items.length} article(s)`);
    } catch (err) {
      bilan.push(`${s.url} : indisponible (${err.message})`);
    }
  }
  console.log(bilan.join('\n'));

  // Seulement les 6 derniers mois
  const depuis = new Date(Date.now() - 183 * 864e5).toISOString().slice(0, 10);
  const articles = fusionner(listes, 6, depuis);
  if (articles.length === 0) {
    const ancien = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
    console.warn(`Aucune actualité récupérée : ${ancien ? 'les dernières connues sont conservées' : 'le bloc reste masqué'}.`);
    return;
  }
  writeFileSync(OUT, JSON.stringify({ articles }, null, 2) + '\n');
  console.log(`${articles.length} actualité(s) enregistrée(s).`);
}

main();
