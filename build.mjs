#!/usr/bin/env node
// Génération du site : content/*.json + src/ → dist/ (HTML complet, catalogue lisible sans JavaScript).
// Aucune dépendance : Node 18 ou plus suffit. Commande : node build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const erreurs = [];
const echec = (m) => erreurs.push(m);

// ---------- Lecture et validation des contenus
function json(nom) {
  try { return JSON.parse(readFileSync(join(ROOT, "content", nom), "utf8")); }
  catch (e) { echec(`content/${nom} : ${e.message}`); return null; }
}
const site = json("site.json");
const catalogue = json("produits.json");
const actualites = json("actualites.json");
const credits = json("credits.json");
const faq = json("faq.json");
if (erreurs.length) sortir();

for (const k of ["nom", "slogan", "metier", "rue", "codePostalVille", "telephone", "email", "bandeau", "piedDemo", "navigation", "livraison", "horaires"]) {
  if (site[k] === undefined) echec(`content/site.json : champ « ${k} » manquant`);
}
if (!site.livraison || typeof site.livraison.frais !== "number" || typeof site.livraison.seuilOffert !== "number") echec("content/site.json : livraison.frais et livraison.seuilOffert doivent être des nombres");
const idsCat = new Set((catalogue.categories || []).map((c) => c.id));
const idsProd = new Set();
for (const p of catalogue.produits || []) {
  if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) echec(`produits.json : « ${p.nom} » — identifiant invalide (lettres minuscules, chiffres, tirets)`);
  if (idsProd.has(p.id)) echec(`produits.json : identifiant en double « ${p.id} »`);
  idsProd.add(p.id);
  if (!p.nom) echec(`produits.json : un produit n'a pas de nom (${p.id})`);
  if (!idsCat.has(p.categorie)) echec(`produits.json : « ${p.nom} » — catégorie inconnue « ${p.categorie} »`);
  if (typeof p.prix !== "number" || p.prix < 0) echec(`produits.json : « ${p.nom} » — prix invalide`);
  if (p.poidsG != null && (typeof p.poidsG !== "number" || p.poidsG <= 0)) echec(`produits.json : « ${p.nom} » — poids invalide`);
  if (!p.image || !existsSync(join(ROOT, p.image))) echec(`produits.json : « ${p.nom} » — image introuvable (${p.image})`);
  if (!p.alt) echec(`produits.json : « ${p.nom} » — description de la photo (alt) manquante`);
  if (!p.ingredients) echec(`produits.json : « ${p.nom} » — ingrédients manquants (obligatoire, règlement INCO)`);
  if (!p.allergenes) echec(`produits.json : « ${p.nom} » — allergènes manquants (écrire « Aucun » si besoin)`);
}
for (const p of catalogue.produits || []) for (const a of p.associes || []) if (!idsProd.has(a)) echec(`produits.json : « ${p.nom} » — produit associé inconnu « ${a} »`);
for (const c of catalogue.categories || []) if (c.image && !existsSync(join(ROOT, c.image))) echec(`produits.json : catégorie « ${c.titre} » — image introuvable`);
for (const a of actualites.actualites || []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || "")) echec(`actualites.json : « ${a.titre} » — date attendue AAAA-MM-JJ`);
  if (!a.titre || !a.texte) echec("actualites.json : une actualité n'a pas de titre ou de texte");
  if (a.image && !existsSync(join(ROOT, a.image))) echec(`actualites.json : « ${a.titre} » — image introuvable (${a.image})`);
  if (a.image && !a.alt) echec(`actualites.json : « ${a.titre} » — description de l'image (alt) manquante`);
}
// Chaque photo du projet doit être créditée (obligation de la page Mentions légales)
const credites = new Set((credits.credits || []).map((c) => c.fichier));
for (const f of readdirSync(join(ROOT, "assets", "img")).filter((n) => /\.(jpe?g|png|webp)$/i.test(n))) {
  if (!credites.has("assets/img/" + f)) echec(`credits.json : aucun crédit pour assets/img/${f}`);
}
for (const c of credits.credits || []) {
  if (!existsSync(join(ROOT, c.fichier))) echec(`credits.json : fichier introuvable (${c.fichier})`);
  if (!c.auteur || !c.lien || !c.licence) echec(`credits.json : ${c.fichier} — auteur, lien et licence obligatoires`);
}
if (erreurs.length) sortir();

function sortir() {
  console.error("\nÉchec de la génération :\n" + erreurs.map((e) => "  - " + e).join("\n") + "\n");
  process.exit(1);
}

// ---------- Outils
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const prixTexte = (n) => euros.format(n);
const prixKilo = (p) => (p.poidsG ? prixTexte((p.prix / p.poidsG) * 1000) + "\u00a0/\u00a0kg" : "");
// **mot** devient <strong>mot</strong> (allergènes en gras, règlement INCO)
const gras = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const urlProduit = (p) => `produit-${p.id}.html`;
const parId = new Map((catalogue.produits || []).map((p) => [p.id, p]));
const parCat = new Map(catalogue.categories.map((c) => [c.id, c]));

function tailleJpeg(fichier) {
  const b = readFileSync(fichier);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

const ICONES = {
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>`,
  sac: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>`,
  fleche: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  croix: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  coche: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  haut: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
};
// Marque : une vague et un grain de sel
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 20c3-4 6-4 9 0s6 4 9 0 5-3 8-1"/><path d="M3 26c3-4 6-4 9 0s6 4 9 0 5-3 8-1" opacity=".5"/><path d="M16 4l3.2 5.2L16 14l-3.2-4.8z" fill="currentColor" stroke="none"/></svg>`;

// ---------- Blocs générés à partir des contenus
function balise(src, alt, { classe = "", lazy = true, sizes = "100vw", priorite = false } = {}) {
  const t = tailleJpeg(join(ROOT, src));
  const dim = t ? ` width="${t.w}" height="${t.h}"` : "";
  const c = classe ? ` class="${classe}"` : "";
  const petit = src.replace("assets/img/", "assets/img/700/");
  let srcset = "";
  if (t && existsSync(join(ROOT, petit))) {
    const p = tailleJpeg(join(ROOT, petit));
    if (p) srcset = ` srcset="${esc(petit)} ${p.w}w, ${esc(src)} ${t.w}w" sizes="${sizes}"`;
  }
  const chargement = priorite ? ` fetchpriority="high"` : lazy ? ` loading="lazy" decoding="async"` : "";
  return `<img src="${esc(src)}"${srcset} alt="${esc(alt || "")}"${dim}${c}${chargement}>`;
}

const SIZES_CARTE = "(min-width: 64rem) 22vw, (min-width: 40rem) 44vw, 92vw";

function carte(p, i = 0, { idAncre = "" } = {}) {
  const kilo = prixKilo(p);
  const cat = parCat.get(p.categorie);
  return `<li class="produit apparait" style="--i:${i % 4}"${idAncre ? ` id="${idAncre}"` : ""} data-id="${p.id}" data-cat="${p.categorie}" data-prix="${p.prix}" data-nom="${esc(p.nom.toLowerCase())}" data-kilo="${p.poidsG ? (p.prix / p.poidsG) * 1000 : ""}" data-sg="${p.sansGluten ? "1" : "0"}" data-ordre="${i}">
        <a class="produit-lien" href="${urlProduit(p)}">
          <figure class="produit-photo"><span class="produit-cadre">${balise(p.image, p.alt, { sizes: SIZES_CARTE })}</span><span class="etiquette"><span class="etiquette-prix">${esc(prixTexte(p.prix))}</span></span></figure>
          <span class="produit-cat">${esc(cat.titre)}</span>
          <h3 class="produit-nom">${esc(p.nom)}</h3>
          <span class="produit-format">${esc(p.format)}${kilo ? `<span class="kilo">${esc(kilo)}</span>` : ""}</span>
        </a>
        <button class="ajouter" type="button" data-ajouter="${p.id}"><span class="ajouter-texte">Ajouter au panier</span><span class="ajouter-fait" aria-hidden="true">${ICONES.coche}Ajouté</span><span class="visuellement-cache"> : ${esc(p.nom)}</span></button>
      </li>`;
}

function blocCartes(arg) {
  let liste;
  if (arg === "moment") liste = catalogue.produits.filter((p) => p.momentane && p.categorie !== "coffrets").slice(0, 4);
  else if (idsCat.has(arg)) liste = catalogue.produits.filter((p) => p.categorie === arg);
  else { echec(`{{cartes:${arg}}} : catégorie inconnue`); return ""; }
  return `<ul class="grille-produits">\n      ${liste.map((p, i) => carte(p, i)).join("\n      ")}\n    </ul>`;
}

function blocCatalogue() {
  const chips = [`<a href="#catalogue" data-cat="">Tout</a>`].concat(catalogue.categories.map((c) => `<a href="#cat-${c.id}" data-cat="${c.id}">${esc(c.titre)}</a>`)).join("\n        ");
  const vus = new Set();
  const cartes = catalogue.produits.slice().sort((a, b) => catalogue.categories.findIndex((c) => c.id === a.categorie) - catalogue.categories.findIndex((c) => c.id === b.categorie)).map((p, i) => {
    const premiere = !vus.has(p.categorie); vus.add(p.categorie);
    return carte(p, i, { idAncre: premiere ? "cat-" + p.categorie : "" });
  }).join("\n      ");
  return `<div class="catalogue-barre" id="catalogue">
      <nav class="chips" aria-label="Catégories">
        ${chips}
      </nav>
      <form class="filtres" data-filtres hidden>
        <label class="champ-filtre"><span>Prix</span>
          <select name="prix"><option value="">Tous les prix</option><option value="0-8">Moins de 8 €</option><option value="8-15">De 8 € à 15 €</option><option value="15-999">Plus de 15 €</option></select></label>
        <label class="champ-filtre"><span>Trier par</span>
          <select name="tri"><option value="ordre">Notre sélection</option><option value="prix-asc">Prix croissant</option><option value="prix-desc">Prix décroissant</option><option value="kilo">Prix au kilo</option><option value="nom">Nom, de A à Z</option></select></label>
        <label class="case"><input type="checkbox" name="sg"><span>Sans gluten</span></label>
      </form>
    </div>
    <p class="resultats" data-resultats role="status" aria-live="polite">${catalogue.produits.length} produits</p>
    <ul class="grille-produits" id="grille">
      ${cartes}
    </ul>
    <p class="vide" data-vide hidden>Aucun produit ne correspond à ces filtres. <button type="button" class="lien-bouton" data-effacer>Effacer les filtres</button></p>`;
}

function blocCategories() {
  const nb = (id) => catalogue.produits.filter((p) => p.categorie === id).length;
  return `<ul class="index-categories">\n` + catalogue.categories.map((c) => `      <li class="apparait"><a href="catalogue.html#cat-${c.id}"><span class="ic-titre">${esc(c.titre)}</span><span class="ic-intro">${esc(c.intro)}</span><span class="ic-nb">${nb(c.id)}\u00a0${nb(c.id) > 1 ? "produits" : "produit"}</span><span class="ic-photo">${balise(c.image, "", { sizes: "6rem" })}</span></a></li>`).join("\n") + `\n    </ul>`;
}

function blocCoffrets() {
  return `<ul class="coffrets">\n` + catalogue.produits.filter((p) => p.categorie === "coffrets").map((p, i) => `      <li class="coffret apparait" style="--i:${i}" data-id="${p.id}">
        <a class="coffret-photo" href="${urlProduit(p)}" tabindex="-1" aria-hidden="true">${balise(p.image, "", { sizes: "(min-width: 56rem) 30vw, 92vw" })}</a>
        <div class="coffret-texte">
          <h3><a href="${urlProduit(p)}">${esc(p.nom)}</a></h3>
          <p class="coffret-prix">${esc(prixTexte(p.prix))}</p>
          <ul class="coffret-contenu">${(p.contenu || []).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
          <button class="ajouter ajouter-clair" type="button" data-ajouter="${p.id}"><span class="ajouter-texte">Ajouter au panier</span><span class="ajouter-fait" aria-hidden="true">${ICONES.coche}Ajouté</span><span class="visuellement-cache"> : ${esc(p.nom)}</span></button>
        </div>
      </li>`).join("\n") + `\n    </ul>`;
}

function blocActus(limite) {
  let liste = [...(actualites.actualites || [])].sort((a, b) => b.date.localeCompare(a.date));
  if (limite) liste = liste.slice(0, Number(limite));
  return `<ul class="actus">\n` + liste.map((a, i) => {
    const img = a.image ? `<div class="actu-photo">${balise(a.image, a.alt, { sizes: "(min-width: 52rem) 40vw, 92vw" })}</div>` : "";
    return `      <li class="actu apparait">${img}<div class="actu-texte"><time datetime="${a.date}">${dateLongue.format(new Date(a.date + "T12:00:00"))}</time><h2>${esc(a.titre)}</h2><p>${esc(a.texte)}</p></div></li>`;
  }).join("\n") + `\n    </ul>`;
}

function blocFaq() {
  return faq.questions.map((q) => `<details class="faq"><summary>${esc(q.question)}</summary><div class="faq-reponse">${q.reponse.split("\n").map((l) => `<p>${gras(l)}</p>`).join("")}</div></details>`).join("\n    ");
}

function blocCredits() {
  return `<ul class="credits">\n` + credits.credits.map((c) => `      <li>${esc(c.description)} : ${esc(c.auteur)}, <a href="${esc(c.lien)}">${esc(c.source)}</a>, <a href="${esc(c.licenceLien)}">${esc(c.licence)}</a></li>`).join("\n") + `\n    </ul>`;
}

function blocHoraires() {
  return `<ul class="horaires">` + site.horaires.map((h) => `<li><span>${esc(h.jours)}</span><span>${esc(h.heures)}</span></li>`).join("") + `</ul>`;
}

function blocDonnees() {
  // Données minimales pour le panier (lues par js/boutique.js) : rien n'est chargé depuis un autre site.
  const produits = {};
  for (const p of catalogue.produits) produits[p.id] = { nom: p.nom, prix: p.prix, format: p.format, image: (existsSync(join(ROOT, p.image.replace("assets/img/", "assets/img/700/"))) ? p.image.replace("assets/img/", "assets/img/700/") : p.image), url: urlProduit(p) };
  const data = { produits, livraison: { frais: site.livraison.frais, seuil: site.livraison.seuilOffert, delai: site.livraison.delai, retrait: site.livraison.retraitDelai } };
  return `<script type="application/json" id="donnees-boutique">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

// ---------- Fiche produit
function ficheProduit(p) {
  const cat = parCat.get(p.categorie);
  const kilo = prixKilo(p);
  const assoc = (p.associes && p.associes.length ? p.associes : catalogue.produits.filter((x) => x.categorie === p.categorie && x.id !== p.id).map((x) => x.id)).map((id) => parId.get(id)).filter(Boolean).slice(0, 4);
  const contenu = p.contenu && p.contenu.length ? `<details class="fiche-detail" open><summary>Dans le coffret</summary><ul class="liste-simple">${p.contenu.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></details>` : "";
  return `<div class="conteneur">
  <nav class="fil" aria-label="Fil d'Ariane"><a href="index.html">Accueil</a><span aria-hidden="true">/</span><a href="catalogue.html">L'épicerie</a><span aria-hidden="true">/</span><a href="catalogue.html#cat-${p.categorie}">${esc(cat.titre)}</a></nav>
  <article class="fiche" data-id="${p.id}">
    <div class="fiche-photo">
      <figure>${balise(p.image, p.alt, { lazy: false, priorite: true, sizes: "(min-width: 56rem) 50vw, 92vw" })}</figure>
      <p class="fiche-credit">Photo d'illustration. <a href="mentions-legales.html#credits">Crédits</a></p>
    </div>
    <div class="fiche-infos">
      <p class="produit-cat">${esc(cat.titre)}</p>
      <h1>${esc(p.nom)}</h1>
      <p class="fiche-accroche">${esc(p.accroche || "")}</p>
      <div class="fiche-prix">
        <span class="etiquette etiquette-grande"><span class="etiquette-prix">${esc(prixTexte(p.prix))}</span></span>
        <p class="fiche-prix-detail">TTC${p.poidsG ? `, ${esc(p.format)}` : `, ${esc(p.format)}`}${kilo ? `<br><span class="kilo">${esc(kilo)}</span>` : ""}</p>
      </div>
      <div class="fiche-achat" data-achat>
        <div class="quantite" role="group" aria-label="Quantité" data-quantite hidden>
          <button type="button" class="quantite-moins" aria-label="Retirer une unité">−</button>
          <output class="quantite-valeur" aria-live="polite">1</output>
          <button type="button" class="quantite-plus" aria-label="Ajouter une unité">+</button>
        </div>
        <button class="ajouter ajouter-grand" type="button" data-ajouter="${p.id}" hidden><span class="ajouter-texte">Ajouter au panier</span><span class="ajouter-fait" aria-hidden="true">${ICONES.coche}Ajouté</span></button>
      </div>
      <noscript><p class="note">L'ajout au panier demande JavaScript. Le catalogue, lui, se lit sans.</p></noscript>
      <ul class="fiche-promesses">
        <li>Retrait gratuit en boutique à Rennes (démonstration)</li>
        <li>Livraison offerte dès ${esc(prixTexte(site.livraison.seuilOffert))}, sinon ${esc(prixTexte(site.livraison.frais))}</li>
      </ul>
      <details class="fiche-detail" open><summary>Description</summary><p>${esc(p.description)}</p></details>
      ${contenu}
      <details class="fiche-detail" open><summary>Ingrédients et allergènes</summary>
        <p><strong class="intitule">Ingrédients : </strong>${gras(p.ingredients)}</p>
        <p><strong class="intitule">Allergènes : </strong>${gras(p.allergenes)}</p>
        ${p.sansGluten ? `<p>Recette sans ingrédient contenant du gluten.</p>` : ""}
      </details>
      <details class="fiche-detail"><summary>Conservation</summary><p>${esc(p.conservation)}</p></details>
      <p class="fiche-demo">Produit fictif, présenté à titre d'exemple : il ne peut pas être acheté.</p>
    </div>
  </article>
  ${assoc.length ? `<section class="associes" aria-labelledby="t-associes"><h2 id="t-associes">Ils vont bien ensemble</h2>
    <ul class="grille-produits">\n      ${assoc.map((x, i) => carte(x, i)).join("\n      ")}\n    </ul></section>` : ""}
</div>`;
}

// ---------- Moteur de gabarits : {{nom}} ou {{nom:argument}}
function remplacer(texte, ctx) {
  for (let passe = 0; passe < 6; passe++) {
    let change = false;
    texte = texte.replace(/\{\{\s*([\w.]+)(?::([\w-]+))?\s*\}\}/g, (m, nom, arg) => {
      change = true;
      if (nom.startsWith("site.")) {
        const v = site[nom.slice(5)];
        if (v === undefined || typeof v === "object") { echec(`{{${nom}}} : champ absent ou non textuel dans content/site.json (${ctx.file})`); return ""; }
        return esc(v);
      }
      if (nom.startsWith("livraison.")) {
        const v = nom === "livraison.frais" ? prixTexte(site.livraison.frais) : nom === "livraison.seuil" ? prixTexte(site.livraison.seuilOffert) : nom === "livraison.retrait" ? site.livraison.retraitDelai : site.livraison[nom.slice(10)];
        if (v === undefined) { echec(`{{${nom}}} inconnu (${ctx.file})`); return ""; }
        return esc(v);
      }
      switch (nom) {
        case "title": return esc(ctx.title);
        case "description": return esc(ctx.description);
        case "robots": return site.indexation ? "" : `<meta name="robots" content="noindex">`;
        case "scripts": return (ctx.scripts || "").split(/\s+/).filter(Boolean).map((s) => `<script src="js/${s}.js" defer></script>`).join("\n");
        case "classePage": return ctx.classe || "";
        case "tete": return partial("tete");
        case "tiroir": return partial("tiroir");
        case "pied": return partial("pied");
        case "contenu": return ctx.contenu;
        case "logo": return LOGO;
        case "icone": return ICONES[arg] || echec(`{{icone:${arg}}} inconnue`) || "";
        case "nav": return site.navigation.map((n) => `<li><a href="${esc(n.fichier)}"${n.fichier === ctx.file ? ' aria-current="page"' : ""}>${esc(n.label)}</a></li>`).join("");
        case "cartes": return blocCartes(arg);
        case "catalogue": return blocCatalogue();
        case "categories": return blocCategories();
        case "coffrets": return blocCoffrets();
        case "actus": return blocActus(arg);
        case "faq": return blocFaq();
        case "credits": return blocCredits();
        case "horaires": return blocHoraires();
        case "donnees": return blocDonnees();
        case "nbProduits": return String(catalogue.produits.length);
        default: echec(`{{${nom}}} : bloc inconnu (${ctx.file})`); return "";
      }
    });
    if (!change) break;
  }
  return texte;
}
const partial = (nom) => readFileSync(join(SRC, "partials", nom + ".html"), "utf8").trimEnd();

function pageSource(fichier) {
  const brut = readFileSync(join(SRC, "pages", fichier), "utf8");
  const m = brut.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { echec(`src/pages/${fichier} : en-tête --- title/description --- manquant`); return null; }
  const meta = {};
  m[1].split("\n").forEach((l) => { const i = l.indexOf(":"); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  if (!meta.title || !meta.description) echec(`src/pages/${fichier} : title et description obligatoires`);
  return { ...meta, contenu: m[2].trimEnd() };
}

// ---------- Génération
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
const layout = readFileSync(join(SRC, "layout.html"), "utf8");
const pages = readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".html"));
let total = 0;
function ecrire(fichier, ctx) {
  const html = remplacer(layout, { ...ctx, file: fichier });
  if (/\{\{|\}\}/.test(html.replace(/<script type="application\/json"[\s\S]*?<\/script>/, ""))) echec(`${fichier} : un {{bloc}} n'a pas été remplacé`);
  writeFileSync(join(DIST, fichier), html);
  total++;
}
for (const fichier of pages) {
  const p = pageSource(fichier);
  if (p) ecrire(fichier, { title: p.title, description: p.description, scripts: p.scripts, classe: p.classe, contenu: p.contenu });
}
for (const p of catalogue.produits) {
  ecrire(urlProduit(p), { title: `${p.nom} | ${site.nom}`, description: `${p.nom} : ${p.accroche || p.description}`.slice(0, 200), classe: "page-produit", scripts: "", contenu: ficheProduit(p) });
}
if (erreurs.length) sortir();
for (const dossier of ["assets", "css", "js"]) cpSync(join(ROOT, dossier), join(DIST, dossier), { recursive: true });
console.log(`Site généré dans dist/ : ${total} pages (dont ${catalogue.produits.length} fiches produit).`);
