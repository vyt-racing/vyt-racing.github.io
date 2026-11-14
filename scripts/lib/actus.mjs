// Lecture de flux RSS (WordPress) et sélection des actualités du karting en Occitanie.
import * as cheerio from 'cheerio';

// Mots qui rattachent un article au karting régional
export const MOTS_OCCITANIE = [
  'occitanie', 'midi-pyrénées', 'midi pyrénées', 'muret', 'toulouse', 'haute-garonne', 'lavelanet',
  'aigues-vives', 'kart\'are', 'belmont', 'layrac', 'albi', 'castelnaudary', 'ariège', 'aveyron',
  'championnat du sud', 'sanchez', 'grouillard', 'jules bianchi', 'ligue de karting', 'ask31',
];

const propre = (s) => cheerio.load(`<p>${s || ''}</p>`).text().replace(/\s+/g, ' ').trim();

export function parseRss(xml, source) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $('item').each((_, el) => {
    const it = $(el);
    const titre = propre(it.find('title').first().text());
    const lien = it.find('link').first().text().trim();
    const date = new Date(it.find('pubDate').first().text().trim());
    const categories = it.find('category').map((__, c) => $(c).text().trim()).get();
    const resume = propre(it.find('description').first().text()).slice(0, 400);
    if (!titre || !/^https?:\/\//.test(lien) || Number.isNaN(date.getTime())) return;
    items.push({ titre, lien, date: date.toISOString().slice(0, 10), source, categories, resume });
  });
  return items;
}

export function estRegional(item) {
  const texte = `${item.titre} ${item.categories.join(' ')} ${item.resume}`.toLowerCase();
  return MOTS_OCCITANIE.some((m) => texte.includes(m));
}

// Sujets qu'on ne met pas en avant sur l'accueil d'une association jeunesse
const EXCLUS = ['décès', 'deces', 'hommage', 'obsèques', 'nécrologie', 'disparition'];
export const aAfficher = (a) => !EXCLUS.some((m) => a.titre.toLowerCase().includes(m));

// Fusionne, dédoublonne par lien, écarte le trop ancien, trie du plus récent au plus ancien
export function fusionner(listes, max = 6, depuis = null) {
  const vus = new Set();
  return listes.flat()
    .filter(aAfficher)
    .filter((a) => !depuis || a.date >= depuis)
    .filter((a) => (vus.has(a.lien) ? false : (vus.add(a.lien), true)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, max)
    .map(({ titre, lien, date, source }) => ({ titre, lien, date, source }));
}
