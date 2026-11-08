// Construit le site dans dist/ à partir de src/, des données (data/) et de site.config.json.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readJson = (p, fallback) => (existsSync(join(ROOT, p)) ? JSON.parse(read(p)) : fallback);

const config = readJson('site.config.json', {});
const ligue = readJson('data/ligue.json', { races: [], standings: [] });
const decouverte = readJson('data/decouverte.json', { dates: [] });
const helloasso = readJson('data/helloasso.json', { evenements: [] });

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Date du jour à Paris, au format AAAA-MM-JJ
const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
function parts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, wd, day: d === 1 ? '1er' : String(d) };
}
function fmtDate(iso, withYear = false, withDay = false) {
  const p = parts(iso);
  return `${withDay ? JOURS[p.wd] + ' ' : ''}${p.day} ${MOIS[p.m - 1]}${withYear ? ' ' + p.y : ''}`;
}
function fmtRange(start, end) {
  if (!end || start === end) return fmtDate(start, false, true);
  const a = parts(start); const b = parts(end);
  if (a.m === b.m) return `${a.day} – ${b.day} ${MOIS[b.m - 1]}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}
const shortPlace = (c) => (c || '').replace(/^Circuit (de |d’|d')/i, '').replace(/\s*\(\d+\)$/, '');

const TAGS = { sud: 'Championnat du Sud', sanchez: 'Challenge Sanchez', national: 'National', evenement: 'Événement' };
const races = [...(ligue.races || [])].sort((a, b) => a.start.localeCompare(b.start));
const upcoming = races.filter((r) => r.end >= today && r.kind !== 'evenement');
const past = races.filter((r) => r.end < today && r.kind !== 'evenement');

// ---- Blocs générés ---------------------------------------------------------

function prochaineCourse() {
  const next = upcoming[0];
  if (next) {
    const link = next.registrationUrl || next.infoUrl;
    return `<div class="carte">
<p class="surtitre bleu">Prochaine course · Ligue Occitanie Pyrénées</p>
<p class="grand">${esc(next.title)}</p>
<p class="meta">${esc(fmtRange(next.start, next.end))}${next.circuit ? ' · ' + esc(next.circuit) : ''}</p>
${link ? `<a class="lien-fleche" href="${esc(link)}">${next.registrationUrl ? 'Inscriptions et infos' : 'Infos sur le site de la ligue'}</a>` : '<a class="lien-fleche" href="/calendrier.html">Tout le calendrier</a>'}
</div>`;
  }
  const last = past[past.length - 1];
  const season = ligue.season || new Date().getFullYear();
  return `<div class="carte">
<p class="surtitre bleu">Ligue Occitanie Pyrénées</p>
<p class="grand">Saison ${season} terminée</p>
<p class="meta">${last ? `Dernière course : ${esc(last.title)}, ${esc(shortPlace(last.circuit))}, ${esc(fmtDate(last.end)).replace(/\.$/, '')}. ` : ''}Le calendrier ${season + 1} s'affichera ici dès sa publication par la ligue.</p>
<a class="lien-fleche" href="/calendrier.html">Voir les résultats ${season}</a>
</div>`;
}

function datesDecouverte() {
  const manual = (decouverte.dates || []).map((d) => ({ ...d }));
  const fromHelloAsso = (helloasso.evenements || []).map((e) => ({
    date: e.date, lieu: e.lieu, details: e.titre, inscription: e.url,
  }));
  return [...manual, ...fromHelloAsso]
    .filter((d) => d.date && d.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const mailto = (subject) => `mailto:${config.email}?subject=${encodeURIComponent(subject)}`;

function decouverteCarte() {
  const next = datesDecouverte()[0];
  if (next) {
    return `<div class="carte">
<p class="surtitre">Prochaine journée découverte</p>
<p class="grand">${esc(fmtDate(next.date, false, true))}${next.lieu ? ' · ' + esc(next.lieu) : ''}</p>
${next.details ? `<p class="meta">${esc(next.details)}</p>` : ''}
<a class="lien-fleche" href="${esc(next.inscription || '/#decouverte')}">Réserver une place</a>
</div>`;
  }
  return `<div class="carte">
<p class="surtitre">Journées découverte</p>
<p class="grand">Prochaines dates bientôt annoncées</p>
<p class="meta">Écrivez-nous pour être prévenu de la prochaine journée sur la piste de Muret.</p>
<a class="lien-fleche" href="${esc(mailto('Journée découverte'))}">Être prévenu</a>
</div>`;
}

function decouverteDates() {
  const dates = datesDecouverte();
  if (!dates.length) {
    return `<div class="actions">
<a class="btn btn-rose" href="${esc(mailto('Journée découverte'))}">Être prévenu des prochaines dates</a>
</div>
<p class="note">Les dates publiées sur HelloAsso apparaîtront ici automatiquement.</p>`;
  }
  const items = dates.map((d) => `<li><span><strong>${esc(fmtDate(d.date, true, true))}</strong>${d.lieu ? ' · ' + esc(d.lieu) : ''}${d.details ? `<br><span class="note">${esc(d.details)}</span>` : ''}</span>${d.inscription ? `<a class="btn btn-rose" href="${esc(d.inscription)}">S'inscrire</a>` : ''}</li>`).join('\n');
  return `<ul class="dates">\n${items}\n</ul>`;
}

function calendrierTableau() {
  if (!races.length) return '<p class="source">Le calendrier de la ligue n\'est pas disponible pour le moment.</p>';
  const rows = races.map((r) => {
    const future = r.end >= today;
    const links = [];
    if (future && r.registrationUrl) links.push(`<a href="${esc(r.registrationUrl)}">S'inscrire</a>`);
    else if (future && r.infoUrl) links.push(`<a href="${esc(r.infoUrl)}">Infos</a>`);
    if (r.resultsUrl) links.push(`<a href="${esc(r.resultsUrl)}">${/\.pdf$/i.test(r.resultsUrl) ? 'Résultats (PDF)' : 'Classement'}</a>`);
    return `<tr${future ? ' class="a-venir"' : ''}>
<td class="date">${esc(fmtRange(r.start, r.end))}</td>
<td>${esc(r.title)}</td>
<td class="lieu">${esc(r.circuit || '')}${r.address ? `<small>${esc(r.address)}</small>` : ''}</td>
<td><span class="tag tag-${esc(r.kind)}">${esc(TAGS[r.kind] || r.kind)}</span></td>
<td class="liens">${links.join('') || '<span class="sr-only">Aucun lien</span>–'}</td>
</tr>`;
  }).join('\n');
  return `<div class="tableau">
<table>
<caption class="sr-only">Épreuves de la saison ${esc(ligue.season)}</caption>
<thead><tr><th scope="col">Date</th><th scope="col">Épreuve</th><th scope="col">Lieu</th><th scope="col">Type</th><th scope="col" style="text-align:right">Liens</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>`;
}

function classements() {
  if (!ligue.standings || !ligue.standings.length) return '';
  const cards = ligue.standings.map((s) => `<a href="${esc(s.url)}"><span><b>${esc(s.name)}</b><small>Classement général · Apex Timing</small></span><span aria-hidden="true">→</span></a>`).join('\n');
  return `<section class="section" style="padding-top: 48px">
<h2 class="titre-m" style="font-size: 34px">Classements généraux ${esc(ligue.season)}</h2>
<div class="classements">
${cards}
</div>
</section>`;
}

// ---- Assemblage ------------------------------------------------------------

const css = read('src/assets/style.css');
const vars = {
  site_url: (config.customDomain ? `https://${config.customDomain}` : config.siteUrl).replace(/\/$/, ''),
  email: config.email,
  adresse: esc(config.adresse),
  directeur_publication: esc(config.directeurPublication),
  annee: String(new Date().getFullYear()),
  version: createHash('sha1').update(css).digest('hex').slice(0, 8),
  saison: String(ligue.season || ''),
  maj: ligue.fetchedAt ? fmtDate(new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(ligue.fetchedAt)), true) : '—',
  live_url: esc(ligue.live || 'https://live.apex-timing.com/ligue-karting-op/'),
  source_url: esc(ligue.source || 'https://vitrine.karting-midipyrenees.fr/courses/'),
  results_page: esc(ligue.resultsPage || 'https://vitrine.karting-midipyrenees.fr/'),
  adhesion_url: esc(config.helloasso?.adhesionUrl || mailto('Adhésion')),
  don_url: esc(config.helloasso?.donUrl || mailto('Don')),
  paiement_mention: config.helloasso?.donUrl
    ? 'Paiements sécurisés via HelloAsso, plateforme gratuite pour les associations.'
    : 'Adhésion et dons en ligne via HelloAsso très bientôt. En attendant, écrivez-nous : nous vous répondrons rapidement.',
  instagram_link: config.instagram ? `<a href="${esc(config.instagram)}">Instagram</a>` : '',
  prochaine_course: prochaineCourse(),
  decouverte_carte: decouverteCarte(),
  decouverte_dates: decouverteDates(),
  calendrier_tableau: calendrierTableau(),
  classements: classements(),
};

const partials = { head: read('src/partials/head.html'), foot: read('src/partials/foot.html') };
const fill = (s, extra) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => {
  const v = { ...vars, ...extra }[k];
  if (v === undefined) throw new Error(`Variable inconnue : ${k}`);
  return v;
});

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'assets/fonts'), { recursive: true });
cpSync(join(ROOT, 'src/assets'), join(DIST, 'assets'), { recursive: true });
for (const f of ['barlow-condensed/files/barlow-condensed-latin-700-normal.woff2', 'barlow-condensed/files/barlow-condensed-latin-800-italic.woff2',
  'inter/files/inter-latin-400-normal.woff2', 'inter/files/inter-latin-600-normal.woff2', 'inter/files/inter-latin-700-normal.woff2']) {
  cpSync(join(ROOT, 'node_modules/@fontsource', f), join(DIST, 'assets/fonts', f.split('/').pop()));
}

const pages = [];
for (const file of readdirSync(join(ROOT, 'src/pages')).filter((f) => f.endsWith('.html'))) {
  let src = read(`src/pages/${file}`);
  const meta = JSON.parse(src.match(/^<!--\s*(\{.*\})\s*-->/)[1]);
  src = src.replace(/^<!--.*?-->\n/, '');
  const path = file === 'index.html' ? '' : file;
  const extra = { title: esc(fill(meta.title, {})), description: esc(meta.description), path };
  let html = src.replace(/\{\{>\s*(\w+)\}\}/g, (m, k) => partials[k]);
  html = fill(html, extra);
  // Lien actif dans le menu
  if (path) html = html.replace(`<a href="/${path}">`, `<a href="/${path}" aria-current="page">`);
  writeFileSync(join(DIST, file), html);
  if (file !== '404.html') pages.push(path);
}

writeFileSync(join(DIST, '.nojekyll'), '');
if (config.customDomain) writeFileSync(join(DIST, 'CNAME'), config.customDomain + '\n');
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${vars.site_url}/sitemap.xml\n`);
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${vars.site_url}/${p}</loc></url>`).join('\n')}
</urlset>
`);

console.log(`Site construit : ${pages.length} pages, ${races.length} épreuves (${upcoming.length} à venir), ${datesDecouverte().length} journée(s) découverte.`);
