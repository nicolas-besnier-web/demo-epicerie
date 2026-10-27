// Marée Salée : panier et tiroir. Le panier vit dans le localStorage du navigateur (strictement nécessaire
// au fonctionnement, rien n'est envoyé nulle part, aucun cookie). Si le stockage est refusé, le panier
// reste en mémoire pour la page en cours.
(function () {
  "use strict";
  var reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CLE = "maree-salee-demo-panier";
  var MAX = 12;
  var donnees;
  try { donnees = JSON.parse(document.getElementById("donnees-boutique").textContent); } catch (e) { return; }
  var produits = donnees.produits, livraison = donnees.livraison;
  var euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  var memoire = {};
  var stockageOk = true;

  function lire() {
    var brut = null;
    try { brut = window.localStorage.getItem(CLE); } catch (e) { stockageOk = false; }
    var obj = memoire;
    if (stockageOk && brut) { try { obj = JSON.parse(brut); } catch (e) { obj = {}; } }
    var propre = {};
    Object.keys(obj || {}).forEach(function (id) {
      var q = Math.floor(Number(obj[id]));
      if (produits[id] && q > 0) propre[id] = Math.min(q, MAX);
    });
    return propre;
  }
  function ecrire(p) {
    memoire = p;
    try { window.localStorage.setItem(CLE, JSON.stringify(p)); } catch (e) { stockageOk = false; }
  }
  function nombre(p) { return Object.keys(p).reduce(function (n, id) { return n + p[id]; }, 0); }
  function sousTotal(p) { return Object.keys(p).reduce(function (t, id) { return t + p[id] * produits[id].prix; }, 0); }
  function fraisPour(sous) { return sous >= livraison.seuil ? 0 : livraison.frais; }

  var panier = lire();
  var ecouteurs = [];
  function changer(id, delta, absolu) {
    var q = absolu !== undefined ? absolu : (panier[id] || 0) + delta;
    q = Math.max(0, Math.min(MAX, q));
    var copie = Object.assign({}, panier);
    if (q === 0) delete copie[id]; else copie[id] = q;
    panier = copie;
    ecrire(panier);
    ecouteurs.forEach(function (f) { f(id); });
  }

  // Interface partagée avec les autres scripts de la page (panier.js, commande.js, fin.js)
  window.MareeSalee = {
    produits: produits, livraison: livraison, euro: euro, MAX: MAX, CLE: CLE,
    get: function () { return panier; },
    nombre: function () { return nombre(panier); },
    sousTotal: function () { return sousTotal(panier); },
    frais: fraisPour,
    changer: changer,
    vider: function () { panier = {}; ecrire(panier); ecouteurs.forEach(function (f) { f(); }); },
    surChangement: function (f) { ecouteurs.push(f); },
    reduit: reduit,
    ligneHTML: ligneHTML, resumeHTML: resumeHTML, echapper: echapper
  };

  function echapper(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- En-tête : compteur
  var elNb = document.querySelector("[data-panier-nb]");
  var elAnnonce = document.querySelector("[data-panier-annonce]");
  var elLien = document.querySelector("[data-panier-lien]");
  var dernierNb = nombre(panier);
  function majEntete(declencheur) {
    var n = nombre(panier);
    if (elNb) {
      elNb.textContent = String(n);
      elNb.setAttribute("data-zero", n === 0 ? "1" : "0");
      if (n > dernierNb && !reduit) { elNb.classList.remove("bump"); void elNb.offsetWidth; elNb.classList.add("bump"); }
    }
    if (elLien) elLien.setAttribute("aria-label", n === 0 ? "Panier, vide" : "Panier, " + n + (n > 1 ? " articles" : " article") + ", " + euro.format(sousTotal(panier)));
    if (elAnnonce && declencheur !== undefined) elAnnonce.textContent = "Panier : " + n + (n > 1 ? " articles" : " article") + ", " + euro.format(sousTotal(panier));
    dernierNb = n;
  }
  ecouteurs.push(majEntete);
  majEntete();

  // ---------- Rendu partagé : lignes et résumé
  function stepper(id, q) {
    return '<div class="quantite quantite-petite" role="group" aria-label="Quantité de ' + echapper(produits[id].nom) + '">' +
      '<button type="button" data-moins="' + id + '" aria-label="Retirer une unité">−</button>' +
      '<output class="quantite-valeur">' + q + '</output>' +
      '<button type="button" data-plus="' + id + '" aria-label="Ajouter une unité"' + (q >= MAX ? " disabled" : "") + '>+</button></div>';
  }
  function ligneHTML(id, q, options) {
    var p = produits[id];
    options = options || {};
    return '<li class="ligne" data-ligne="' + id + '">' +
      '<a class="ligne-photo" href="' + p.url + '" tabindex="-1" aria-hidden="true"><img src="' + p.image + '" alt="" width="80" height="96" loading="lazy"></a>' +
      '<div class="ligne-infos"><a class="ligne-nom" href="' + p.url + '">' + echapper(p.nom) + '</a>' +
      '<p class="ligne-format">' + echapper(p.format) + '</p>' +
      (options.simple ? '<p class="ligne-prix-unit">' + q + ' × ' + euro.format(p.prix) + '</p>' :
        '<p class="ligne-prix-unit">' + euro.format(p.prix) + ' l’unité</p>' +
        '<div class="ligne-actions">' + stepper(id, q) + '<button type="button" class="ligne-retirer" data-retirer="' + id + '">Retirer<span class="visuellement-cache"> ' + echapper(p.nom) + '</span></button></div>') +
      '</div><p class="ligne-total" data-total-ligne>' + euro.format(q * p.prix) + '</p></li>';
  }
  function resumeHTML(opts) {
    opts = opts || {};
    var sous = sousTotal(panier), reste = livraison.seuil - sous, atteint = reste <= 0;
    var p = Math.max(0, Math.min(1, sous / livraison.seuil));
    return '<div class="resume">' +
      '<div class="seuil' + (atteint ? " atteint" : "") + '"><p class="seuil-texte">' + (atteint ? "La livraison est offerte pour cette commande." : "Plus que <strong>" + euro.format(reste) + "</strong> pour la livraison offerte.") + '</p>' +
      '<div class="seuil-piste" aria-hidden="true"><span class="seuil-barre" style="--p:' + p.toFixed(3) + '"></span></div></div>' +
      '<dl class="totaux"><div class="sous-total"><dt>Sous-total</dt><dd>' + euro.format(sous) + '</dd></div></dl>' +
      '<p class="resume-note">Retrait en boutique : gratuit. Livraison : ' + euro.format(livraison.frais) + ', offerte dès ' + euro.format(livraison.seuil) + '. Le choix se fait à l’étape suivante.</p>' +
      '<p style="margin:1.1rem 0 0">' + (opts.pageTexte ? '<a class="bouton bouton-plein" href="commande.html">Commander (démonstration)</a>' :
        '<a class="bouton bouton-plein" href="commande.html">Commander (démonstration)</a>') + '</p>' +
      (opts.tiroir ? '<p style="margin:.7rem 0 0;text-align:center"><a class="lien-fleche" href="panier.html">Voir le panier</a></p>' : '') +
      '</div>';
  }

  // ---------- Tiroir
  var tiroir = document.querySelector("[data-tiroir]");
  var contenu = document.querySelector("[data-tiroir-contenu]");
  var declencheur = null;
  function rendreTiroir(idEntre) {
    if (!contenu) return;
    var ids = Object.keys(panier);
    if (!ids.length) {
      contenu.innerHTML = '<div class="tiroir-vide"><p>Votre panier est vide.</p><p><a class="lien-fleche" href="catalogue.html">Voir l’épicerie</a></p></div>';
      return;
    }
    contenu.innerHTML = '<ul class="lignes">' + ids.map(function (id) { return ligneHTML(id, panier[id]); }).join("") + '</ul>' + resumeHTML({ tiroir: true });
    if (idEntre && !reduit) { var l = contenu.querySelector('[data-ligne="' + idEntre + '"]'); if (l) l.classList.add("entre"); }
  }
  function ouvrir(idEntre) {
    if (!tiroir || typeof tiroir.showModal !== "function") { window.location.href = "panier.html"; return; }
    rendreTiroir(idEntre);
    if (!tiroir.open) { declencheur = document.activeElement; tiroir.classList.remove("ferme"); tiroir.showModal(); }
    var fermer = tiroir.querySelector("[data-tiroir-fermer]");
    if (fermer) fermer.focus({ preventScroll: true });
  }
  function fermer() {
    if (!tiroir || !tiroir.open) return;
    if (reduit) { tiroir.close(); return; }
    tiroir.classList.add("ferme");
    var fini = function () { tiroir.removeEventListener("animationend", fini); tiroir.classList.remove("ferme"); if (tiroir.open) tiroir.close(); };
    tiroir.addEventListener("animationend", fini);
  }
  if (tiroir) {
    tiroir.addEventListener("close", function () { if (declencheur && declencheur.focus) declencheur.focus({ preventScroll: true }); declencheur = null; });
    tiroir.addEventListener("cancel", function (e) { e.preventDefault(); fermer(); });
    tiroir.addEventListener("click", function (e) {
      if (e.target === tiroir) fermer(); // clic sur le fond
      if (e.target.closest("[data-tiroir-fermer]")) fermer();
      var plus = e.target.closest("[data-plus]"), moins = e.target.closest("[data-moins]"), ret = e.target.closest("[data-retirer]");
      if (plus) changer(plus.getAttribute("data-plus"), 1);
      else if (moins) changer(moins.getAttribute("data-moins"), -1);
      else if (ret) {
        var id = ret.getAttribute("data-retirer"), ligne = ret.closest(".ligne");
        if (ligne && !reduit) { ligne.classList.add("sort"); setTimeout(function () { changer(id, 0, 0); }, 260); } else changer(id, 0, 0);
      }
    });
    // Glisser vers la droite pour fermer : le tiroir suit le doigt 1:1, puis part (ou revient) selon la vitesse du geste
    var glisse = null;
    tiroir.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || e.target.closest("button, a, input, select")) return;
      glisse = { x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, v: 0, actif: false, id: e.pointerId, dernierX: e.clientX, dernierT: e.timeStamp };
    });
    tiroir.addEventListener("pointermove", function (e) {
      if (!glisse || e.pointerId !== glisse.id) return;
      var dx = e.clientX - glisse.x, dy = e.clientY - glisse.y;
      if (!glisse.actif) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) { glisse = null; return; }
        glisse.actif = true; tiroir.setPointerCapture(e.pointerId); tiroir.style.transition = "none"; tiroir.style.animation = "none";
      }
      var dt = e.timeStamp - glisse.dernierT;
      if (dt > 0) glisse.v = (e.clientX - glisse.dernierX) / dt;
      glisse.dernierX = e.clientX; glisse.dernierT = e.timeStamp;
      // au-delà du bord gauche, la résistance augmente (élastique)
      glisse.dx = dx < 0 ? -(Math.abs(dx) * 0.4) / (1 + Math.abs(dx) / 200) : dx;
      tiroir.style.transform = "translateX(" + glisse.dx + "px)";
    });
    function finGlisse(e) {
      if (!glisse || e.pointerId !== glisse.id) return;
      var g = glisse; glisse = null;
      if (!g.actif) return;
      var largeur = tiroir.getBoundingClientRect().width;
      var projete = g.dx + g.v * 1000 * 0.12; // où le geste aurait fini son élan
      tiroir.style.transition = reduit ? "none" : "transform .32s cubic-bezier(.22,.68,0,1)";
      if (projete > largeur * 0.4 || g.v > 0.6) {
        tiroir.style.transform = "translateX(100%)";
        setTimeout(function () { tiroir.style.transition = ""; tiroir.style.transform = ""; tiroir.style.animation = ""; if (tiroir.open) tiroir.close(); }, reduit ? 0 : 300);
      } else {
        tiroir.style.transform = "translateX(0)";
        setTimeout(function () { tiroir.style.transition = ""; tiroir.style.transform = ""; tiroir.style.animation = ""; }, reduit ? 0 : 340);
      }
    }
    tiroir.addEventListener("pointerup", finGlisse);
    tiroir.addEventListener("pointercancel", finGlisse);
    ecouteurs.push(function (id) {
      if (!tiroir.open) return;
      // Met à jour sans reconstruire quand c'est possible (pas de perte de focus)
      var ids = Object.keys(panier);
      var lignes = contenu.querySelectorAll("[data-ligne]");
      var memes = ids.length === lignes.length && ids.every(function (i) { return contenu.querySelector('[data-ligne="' + i + '"]'); });
      if (!memes) { var actif = document.activeElement && document.activeElement.getAttribute && (document.activeElement.getAttribute("data-plus") || document.activeElement.getAttribute("data-moins")); rendreTiroir(); if (actif) { var b = contenu.querySelector('[data-plus="' + actif + '"],[data-moins="' + actif + '"]'); if (b) b.focus(); } return; }
      ids.forEach(function (i) {
        var l = contenu.querySelector('[data-ligne="' + i + '"]');
        l.querySelector(".quantite-valeur").textContent = panier[i];
        l.querySelector("[data-total-ligne]").textContent = euro.format(panier[i] * produits[i].prix);
        l.querySelector("[data-plus]").disabled = panier[i] >= MAX;
      });
      var r = contenu.querySelector(".resume"); if (r) r.outerHTML = resumeHTML({ tiroir: true });
    });
  }
  // Le lien « Panier » ouvre le tiroir, sauf sur la page panier et la page de commande
  if (elLien && !/panier|commande/.test(document.body.className)) {
    elLien.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault(); ouvrir();
    });
  }

  // ---------- Boutons « Ajouter au panier »
  var minuteurs = new WeakMap();
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ajouter]");
    if (!b) return;
    var id = b.getAttribute("data-ajouter");
    if (!produits[id]) return;
    var zone = b.closest("[data-achat]");
    var qte = 1;
    if (zone) { var v = zone.querySelector(".quantite-valeur"); if (v) qte = parseInt(v.textContent, 10) || 1; }
    var avant = panier[id] || 0;
    changer(id, qte);
    if (avant + qte > MAX) { /* plafonné */ }
    b.classList.add("est-ajoute");
    clearTimeout(minuteurs.get(b));
    minuteurs.set(b, setTimeout(function () { b.classList.remove("est-ajoute"); }, 1600));
    if (!/panier|commande/.test(document.body.className)) setTimeout(function () { ouvrir(id); }, reduit ? 0 : 380);
  });

  // ---------- Fiche produit : sélecteur de quantité
  document.querySelectorAll("[data-achat]").forEach(function (zone) {
    var q = zone.querySelector("[data-quantite]"), ajout = zone.querySelector("[data-ajouter]");
    if (q) q.hidden = false; if (ajout) ajout.hidden = false;
    if (!q) return;
    var val = q.querySelector(".quantite-valeur"), moins = q.querySelector(".quantite-moins"), plus = q.querySelector(".quantite-plus");
    var n = 1;
    function maj() { val.textContent = n; moins.disabled = n <= 1; plus.disabled = n >= MAX; }
    moins.addEventListener("click", function () { n = Math.max(1, n - 1); maj(); });
    plus.addEventListener("click", function () { n = Math.min(MAX, n + 1); maj(); });
    maj();
  });
})();
