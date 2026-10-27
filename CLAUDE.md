# Marée Salée : boutique de démonstration (offre Boutique BALD)

Boutique en ligne d'une **épicerie fine bretonne fictive à Rennes**, réalisée par BALD comme exemple de l'offre « Boutique dès 2 490 € ». Aucune vente, aucun paiement, aucun commerce réel.

## Règles à ne jamais casser
- Nom inventé « Marée Salée » (vérifié le 27/10/2026 : aucune épicerie de ce nom à Rennes ni en Bretagne). Adresse, téléphone (02 00 00 00 00) et e-mail (.example) fictifs.
- Bandeau « Site de démonstration réalisé par BALD » sur **chaque** page (partials/tete.html, texte dans content/site.json).
- Mentions légales : éditeur Nicolas Besnier EI (BALD) réel ; la boutique, elle, est fictive.
- Aucun faux avis, faux label, fausse note, fausse presse. Pas d'alcool.
- Photos libres téléchargées dans assets/img/ ; **le build échoue si une photo n'a pas de crédit** (content/credits.json). Ce sont des photos d'illustration, pas celles des produits d'une vraie boutique. Ne jamais garder une photo où figure le nom d'un vrai producteur.
- Aucun cookie, aucune ressource externe. Le panier est dans le localStorage (clé maree-salee-demo-panier), expliqué dans confidentialite.html.
- noindex sur tout le site (content/site.json, champ indexation).

## Génération
`node build.mjs` lit content/*.json et src/ et écrit dist/ (catalogue et fiches lisibles sans JavaScript, une page par produit). `npm start` génère puis sert sur http://localhost:8000.
- src/layout.html, src/partials (tete, tiroir, pied), src/pages/*.html (en-tête --- title/description/classe/scripts ---).
- content : produits.json (catégories + produits : prix TTC, poidsG, ingrédients avec **allergènes** entre ** **, sansGluten…), site.json (coordonnées, livraison.frais et seuilOffert, horaires), actualites.json, faq.json, credits.json.
- js : main.js (menu, apparition), boutique.js (panier, tiroir, boutons Ajouter), catalogue.js (filtres, tri), panier.js, commande.js (3 étapes, factice), fin.js.
- .pages.yml : Pages CMS (produits, prix, photos, catégories, actualités, livraison).
- tests/parcours.py : parcours complet Playwright (6 configurations : 1280 et 375 px, clair et sombre, sans JavaScript). `python3 tests/parcours.py [--captures]` avec dist/ servi sur le port 8000.

## Direction artistique
Papier de sel, encre, ardoise marine, caramel et beurre. Fraunces (titres) et Figtree (texte), hébergées localement. Signature : l'étiquette de prix en carton kraft. Animations rares : apparition douce, survol des photos, ajout au panier (bouton qui bascule, compteur qui rebondit, tiroir qui glisse et se ferme au glissement), transitions entre étapes de commande. Toutes coupées avec prefers-reduced-motion.
