import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRss, estRegional, fusionner } from './lib/actus.mjs';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Karting-Sud</title>
<item><title>Championnat du Sud à Muret : les résultats</title><link>https://exemple.fr/a</link>
<pubDate>Sun, 28 May 2023 20:00:00 +0000</pubDate><category>Occitanie</category>
<description><![CDATA[<p>Les finales du dimanche&#8230;</p>]]></description></item>
<item><title>Rencontres en Provence</title><link>https://exemple.fr/b</link>
<pubDate>Mon, 29 May 2023 08:00:00 +0000</pubDate><category>PACA</category><description>Grabels</description></item>
<item><title>Sans lien</title><pubDate>Mon, 29 May 2023 08:00:00 +0000</pubDate></item>
</channel></rss>`;

test('lit un flux RSS WordPress', () => {
  const items = parseRss(RSS, 'Karting-Sud');
  assert.equal(items.length, 2);
  assert.equal(items[0].titre, 'Championnat du Sud à Muret : les résultats');
  assert.equal(items[0].date, '2023-05-28');
  assert.equal(items[0].resume, 'Les finales du dimanche…');
});

test('ne garde que le karting régional', () => {
  const items = parseRss(RSS, 'Karting-Sud').filter(estRegional);
  assert.deepEqual(items.map((i) => i.lien), ['https://exemple.fr/a']);
});

test('fusionne, dédoublonne et trie', () => {
  const a = { titre: 'A', lien: 'x', date: '2026-01-01', source: 's', categories: [], resume: '' };
  const b = { ...a, titre: 'B', lien: 'y', date: '2026-03-01' };
  const out = fusionner([[a, b], [a]], 5);
  assert.deepEqual(out.map((o) => o.titre), ['B', 'A']);
  assert.deepEqual(Object.keys(out[0]), ['titre', 'lien', 'date', 'source']);
});

test('écarte les avis de décès et le trop ancien', () => {
  const base = { lien: 'l', source: 's', categories: [], resume: '' };
  const out = fusionner([[{ ...base, titre: 'Décès de X', lien: '1', date: '2026-11-01' },
    { ...base, titre: 'Course', lien: '2', date: '2026-11-01' },
    { ...base, titre: 'Vieux', lien: '3', date: '2024-01-01' }]], 6, '2026-05-01');
  assert.deepEqual(out.map((o) => o.titre), ['Course']);
});
