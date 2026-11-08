// Récupère les événements publiés sur HelloAsso (billetteries) pour les afficher
// dans « Journées découverte ». Ne fait rien tant que les secrets ne sont pas configurés.
//
// Secrets GitHub attendus : HELLOASSO_CLIENT_ID, HELLOASSO_CLIENT_SECRET
// Et dans site.config.json : helloasso.organisation = le nom de l'association dans les
// adresses HelloAsso (ex. « vyt-racing » pour https://www.helloasso.com/associations/vyt-racing).
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../data/helloasso.json', import.meta.url);
const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const { HELLOASSO_CLIENT_ID: id, HELLOASSO_CLIENT_SECRET: secret } = process.env;
const org = config.helloasso?.organisation;

if (!id || !secret || !org) {
  console.log('HelloAsso non configuré : étape ignorée.');
  process.exit(0);
}

async function main() {
  const tokenRes = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!tokenRes.ok) throw new Error(`jeton HelloAsso refusé (HTTP ${tokenRes.status})`);
  const { access_token: token } = await tokenRes.json();

  const url = `https://api.helloasso.com/v5/organizations/${encodeURIComponent(org)}/forms?formTypes=Event&states=Public&pageSize=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`liste des campagnes refusée (HTTP ${res.status})`);
  const { data = [] } = await res.json();

  const evenements = data
    .filter((f) => f.startDate)
    .map((f) => ({
      titre: f.title,
      date: String(f.startDate).slice(0, 10),
      lieu: [f.place?.name, f.place?.city].filter(Boolean).join(', ') || null,
      url: f.url || `https://www.helloasso.com/associations/${org}/evenements/${f.formSlug}`,
    }));

  writeFileSync(OUT, JSON.stringify({ evenements, fetchedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`HelloAsso : ${evenements.length} événement(s).`);
}

main().catch((err) => {
  // Une panne HelloAsso ne doit pas bloquer la mise à jour du site
  console.warn(`HelloAsso indisponible : ${err.message}`);
});
