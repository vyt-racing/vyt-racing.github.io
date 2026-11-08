// Lecture des pages de la Ligue de Karting Occitanie Pyrénées.
// Fonctions pures : elles prennent du HTML et renvoient des données, sans réseau.
import * as cheerio from 'cheerio';

const MONTHS = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad = (n) => String(n).padStart(2, '0');

// "SAMEDI 28 FÉVRIER - DIMANCHE 1ER MARS", "05, 06 & 07 JUIN", "DIMANCHE 25 OCTOBRE"
export function parseDateRange(text, year) {
  const tokens = deaccent(clean(text)).toLowerCase().match(/1er|\d{1,2}|[a-z]+/g) || [];
  const days = [];
  let pending = [];
  for (const t of tokens) {
    if (t === '1er' || /^\d{1,2}$/.test(t)) {
      pending.push(t === '1er' ? 1 : Number(t));
    } else if (MONTHS[t]) {
      for (const d of pending) days.push({ day: d, month: MONTHS[t] });
      pending = [];
    }
  }
  if (!days.length) return null;
  const first = days[0];
  const last = days[days.length - 1];
  // Une saison qui déborderait sur l'année suivante (décembre → janvier)
  const endYear = last.month < first.month ? year + 1 : year;
  return {
    start: `${year}-${pad(first.month)}-${pad(first.day)}`,
    end: `${endYear}-${pad(last.month)}-${pad(last.day)}`,
  };
}

const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'à', 'et', 'en', 'lors']);

// "CIRCUIT D’AIGUES-VIVES (09)" -> "Circuit d’Aigues-Vives (09)"
export function frenchTitle(s) {
  const text = clean(s);
  // Texte déjà en casse normale : on le garde tel quel
  if (/\p{Ll}/u.test(text.replace(/\b1er\b/gi, ''))) return text;
  const lower = text.toLowerCase();
  return lower
    .split(' ')
    .map((word, i) => {
      if (i > 0 && SMALL.has(word)) return word;
      return word.replace(/(^|[-/’'(])(\p{L})/gu, (m, sep, ch, offset) => {
        // d’ et l’ restent en minuscule
        if (i > 0 && offset === 0 && /^[dl][’']/.test(word)) return m;
        return sep + ch.toUpperCase();
      });
    })
    .join(' ')
    .replace(/\bJc\b/g, 'J.-C.')
    .replace(/\b(Iame|Nsk|Fsa|Ffsa)\b/g, (w) => w.toUpperCase());
}

export function classify(title) {
  const t = deaccent(title).toLowerCase();
  if (/championnat du sud/.test(t)) return 'sud';
  if (/sanchez/.test(t)) return 'sanchez';
  if (/remise des prix|soiree/.test(t)) return 'evenement';
  return 'national';
}

// Clé d'affiche commune aux deux pages : nom de fichier sans le suffixe de taille WordPress.
export function posterKey(src) {
  if (!src) return null;
  const file = src.split('?')[0].split('/').pop();
  return file.replace(/-\d+x\d+(?=\.\w+$)/, '').toLowerCase();
}

function headingText($, el) {
  const h = $(el).clone();
  h.find('br').replaceWith(' – ');
  h.find('span').each((_, s) => { $(s).append(' '); });
  return clean(h.text()).replace(/#\s*(\d+)/, '#$1').replace(/\s+–\s*$/, '');
}

const DATE_RE = /\b(1er|\d{1,2})\b[^]*\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/i;

export function parseSeasonYear(html) {
  const m = deaccent(clean(cheerio.load(html)('h1,h2,h3,h4,h5').text())).match(/SAISON\s+(20\d\d)/i);
  return m ? Number(m[1]) : null;
}

export function parseCourses(html, year) {
  const $ = cheerio.load(html);
  const races = [];
  $('.e-parent').each((_, block) => {
    const h2s = $(block).find('h2').toArray();
    const dateIdx = h2s.findIndex((h) => DATE_RE.test(deaccent(clean($(h).text()))));
    if (dateIdx < 0 || !h2s[dateIdx + 1]) return;
    const dateText = clean($(h2s[dateIdx]).text());
    const dates = parseDateRange(dateText, year);
    if (!dates) return;
    const rawTitle = headingText($, h2s[dateIdx + 1]);
    const kind = classify(rawTitle);
    const paras = $(block)
      .find('.elementor-widget-text-editor p')
      .filter((__, p) => $(p).closest('li').length === 0)
      .toArray()
      .map((p) => clean($(p).text()))
      .filter(Boolean);
    const links = $(block).find('a[href]').toArray().map((a) => ({
      href: $(a).attr('href'),
      text: clean($(a).text()),
    }));
    const infoLink = links.find((l) => /karting-midipyrenees\.fr\/course-karting\//.test(l.href));
    const registration = links.find((l) => /CRIRE/i.test(l.text) && /course-karting/.test(l.href));
    races.push({
      title: frenchTitle(rawTitle).replace(/#(\d)/, '#$1'),
      kind,
      dateLabel: dateText,
      start: dates.start,
      end: dates.end,
      circuit: kind === 'evenement' ? null : (paras[0] ? fixTypos(frenchTitle(paras[0])) : null),
      address: kind === 'evenement' ? null : (paras[1] || null),
      infoUrl: infoLink ? infoLink.href : null,
      registrationUrl: registration ? registration.href : null,
      poster: $(block).find('img').first().attr('src') || null,
      resultsUrl: null,
    });
  });
  return races.sort((a, b) => a.start.localeCompare(b.start));
}

// Coquilles connues sur le site de la ligue
const TYPOS = [[/\bBlemont\b/g, 'Belmont']];
function fixTypos(s) {
  return TYPOS.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

const STANDINGS = {
  champsud: 'Championnat du Sud',
  champligue: 'Championnat de Ligue',
  trsanchez: 'Trophée J.-C. Sanchez',
};

export function parseResults(html) {
  const $ = cheerio.load(html);
  const byPoster = {};
  const byCode = {};
  const standings = [];
  $('a[href]').each((_, a) => {
    if (!/CLASSEMENT|R[ÉE]SULTAT/i.test(clean($(a).text()))) return;
    const href = $(a).attr('href');
    // l'image de l'affiche est dans le même conteneur que le bouton
    let box = $(a).closest('.e-con');
    let img = box.find('img').first();
    while (!img.length && box.length) {
      box = box.parent().closest('.e-con');
      img = box.find('img').first();
    }
    const code = (href.match(/\/(\d{4})\/([a-z0-9]+)\/?$/i) || [])[2] || null;
    if (code && STANDINGS[code.toLowerCase()]) {
      standings.push({ name: STANDINGS[code.toLowerCase()], url: href });
      return;
    }
    const key = posterKey(img.attr('src'));
    if (key) byPoster[key] = href;
    if (code) byCode[code.toLowerCase()] = href;
  });
  return { byPoster, byCode, standings };
}

function codeFor(race) {
  const n = (race.title.match(/#(\d+)/) || [])[1];
  if (!n) return null;
  if (race.kind === 'sud') return `csm${n}`;
  if (race.kind === 'sanchez') return `sanchezm${n}`;
  return null;
}

export function attachResults(races, results) {
  for (const r of races) {
    r.resultsUrl = results.byPoster[posterKey(r.poster)] || results.byCode[codeFor(r)] || null;
  }
  return races;
}

// Lien « résultats » trouvé sur la page calendrier (ex. https://vitrine.karting-midipyrenees.fr/2026-2/)
export function findResultsPage(html, base) {
  const $ = cheerio.load(html);
  const hrefs = $('a[href]').toArray()
    .filter((a) => /R[ÉE]SULTAT/i.test(clean($(a).text())))
    .map((a) => new URL($(a).attr('href'), base).href)
    .filter((h) => new URL(h).hostname === new URL(base).hostname && !/\.pdf$/i.test(h));
  return hrefs[0] || null;
}
