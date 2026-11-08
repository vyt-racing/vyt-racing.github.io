import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseDateRange, frenchTitle, parseCourses, parseResults, attachResults,
  parseSeasonYear, findResultsPage,
} from './lib/ligue.mjs';

const courses = readFileSync(new URL('./fixtures/courses.html', import.meta.url), 'utf8');
const resultats = readFileSync(new URL('./fixtures/resultats.html', import.meta.url), 'utf8');

test('dates', () => {
  assert.deepEqual(parseDateRange('SAMEDI 28 FÉVRIER - DIMANCHE 1ER MARS', 2026), { start: '2026-02-28', end: '2026-03-01' });
  assert.deepEqual(parseDateRange('05, 06 & 07 JUIN', 2026), { start: '2026-06-05', end: '2026-06-07' });
  assert.deepEqual(parseDateRange('19 - 20 - 21 JUIN', 2026), { start: '2026-06-19', end: '2026-06-21' });
  assert.deepEqual(parseDateRange('DIMANCHE 25 OCTOBRE', 2026), { start: '2026-10-25', end: '2026-10-25' });
  assert.equal(parseDateRange('Ready to Race ?', 2026), null);
});

test('titres', () => {
  assert.equal(frenchTitle('CIRCUIT D’AIGUES-VIVES (09)'), 'Circuit d’Aigues-Vives (09)');
  assert.equal(frenchTitle('CHALLENGE JC SANCHEZ #2'), 'Challenge J.-C. Sanchez #2');
  assert.equal(frenchTitle('Soirée remise des prix 2026'), 'Soirée remise des prix 2026');
});

test('calendrier et résultats 2026', () => {
  const year = parseSeasonYear(courses);
  assert.equal(year, 2026);
  const races = attachResults(parseCourses(courses, year), parseResults(resultats));
  assert.equal(races.length, 15);
  const sud1 = races.find((r) => r.title === 'Championnat du Sud #1');
  assert.equal(sud1.start, '2026-02-28');
  assert.match(sud1.resultsUrl, /csm1/);
  const belmont = races.find((r) => r.title === 'Championnat du Sud #2');
  assert.equal(belmont.circuit, 'Circuit de Belmont/Rance (12)');
  const slalom = races.find((r) => r.title === 'Challenge J.-C. Sanchez #3');
  assert.match(slalom.resultsUrl, /\.pdf$/);
  const s4 = races.find((r) => r.title === 'Challenge J.-C. Sanchez #4');
  assert.match(s4.registrationUrl, /course-karting/);
  assert.deepEqual(parseResults(resultats).standings.map((s) => s.name),
    ['Championnat du Sud', 'Championnat de Ligue', 'Trophée J.-C. Sanchez']);
  assert.equal(findResultsPage(courses, 'https://vitrine.karting-midipyrenees.fr/courses/'),
    'https://vitrine.karting-midipyrenees.fr/2026-2/');
});
