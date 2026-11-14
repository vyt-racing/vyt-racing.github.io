# Site de VYT Racing

Site de l'association VYT Racing (loi 1901, n° W313034292) : promouvoir les sports mécaniques chez les jeunes.

En ligne : https://vyt-racing.github.io

## Comment ça marche

- Le site est **statique** : `npm run build` assemble les pages de `src/pages/` dans `dist/`.
- Chaque nuit (et à chaque modification), GitHub Actions :
  1. lit le **calendrier et les résultats de la Ligue de Karting Occitanie Pyrénées** (`scripts/fetch-ligue.mjs` → `data/ligue.json`) ;
  2. lit les **événements HelloAsso** si l'API est configurée (`scripts/fetch-helloasso.mjs` → `data/helloasso.json`) ;
  3. reconstruit le site et le publie sur GitHub Pages.
- Si la ligue change la mise en page de son site, l'import échoue : le site reste en ligne avec les dernières données, et GitHub envoie un e-mail d'alerte.

## Modifier le site

| Je veux… | Fichier |
|---|---|
| changer un texte de l'accueil | `src/pages/index.html` |
| ajouter un compte rendu de course | `src/pages/carnet.html` |
| ajouter une journée découverte (sans HelloAsso) | `data/decouverte.json` |
| renseigner les liens HelloAsso, Instagram, le domaine | `site.config.json` |
| changer les couleurs ou la mise en page | `src/assets/style.css` |

## Brancher HelloAsso

1. Dans HelloAsso : *Mon compte › API et intégrations* → créer une clé (client ID + client secret).
2. Dans GitHub : *Settings › Secrets and variables › Actions* → ajouter `HELLOASSO_CLIENT_ID` et `HELLOASSO_CLIENT_SECRET`.
3. Dans `site.config.json` : `helloasso.organisation` (le nom de l'association dans l'adresse HelloAsso), `adhesionUrl`, `donUrl`.

## Brancher le nom de domaine (vyt-racing.com)

1. Acheter le domaine, puis chez le registraire créer les enregistrements DNS de GitHub Pages
   (4 enregistrements A vers 185.199.108.153, .109.153, .110.153, .111.153 et un CNAME `www` → `vyt-racing.github.io`).
2. Dans `site.config.json` : `"customDomain": "vyt-racing.com"`.
3. Dans GitHub : *Settings › Pages* → vérifier le domaine et cocher *Enforce HTTPS*.

## Développement

```
npm install
npm test            # teste la lecture des pages de la ligue
npm run build       # construit dist/
npx http-server dist
```

## Carnet de course (src/pages/carnet.html)

Organisé par année, du plus récent au plus ancien. Pour ajouter un récit, insérer dans la bonne
`<section class="annee">` (créer la section si l'année n'existe pas encore) :

```html
<li class="etape" data-type="course">   <!-- course | podium | victoire | roulage -->
<div class="etape-date" aria-hidden="true"><span class="j">21</span><span class="m">sept.</span></div>
<article id="r-2025-09-21" class="type-course">
<p class="quand">21 septembre 2025 · Muret (31)</p>
<h2>Titre</h2>
<span class="badge">…</span>
…
</article>
</li>
```

Puis mettre à jour : les chiffres clés en haut de page, la frise (un `<a class="point type-…" href="#r-…">`
dans l'année) et le résumé de l'année (`.annee-tete p`). Les récits longs se replient tout seuls.
Photos : retirer les métadonnées EXIF/GPS avant publication.
