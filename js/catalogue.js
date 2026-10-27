// Marée Salée : filtres et tri du catalogue. Sans JavaScript, tous les produits restent affichés
// et les catégories sont de simples ancres.
(function () {
  "use strict";
  var grille = document.getElementById("grille");
  var form = document.querySelector("[data-filtres]");
  if (!grille || !form) return;
  var cartes = Array.prototype.slice.call(grille.querySelectorAll(".produit"));
  var chipsNav = document.querySelector(".chips");
  var resultats = document.querySelector("[data-resultats]");
  var vide = document.querySelector("[data-vide]");
  var reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var titres = {};
  var etat = { cat: "", prix: "", tri: "ordre", sg: false };

  form.hidden = false;
  // Les catégories deviennent des boutons (aria-pressed) : ce sont des filtres, pas des liens
  Array.prototype.slice.call(chipsNav.querySelectorAll("a")).forEach(function (a) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = a.textContent; b.setAttribute("data-cat", a.getAttribute("data-cat"));
    titres[a.getAttribute("data-cat")] = a.textContent;
    chipsNav.replaceChild(b, a);
  });
  chipsNav.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-cat]"); if (!b) return;
    etat.cat = b.getAttribute("data-cat"); appliquer(true);
  });
  form.addEventListener("change", function () {
    etat.prix = form.elements.prix.value; etat.tri = form.elements.tri.value; etat.sg = form.elements.sg.checked; appliquer(true);
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  document.querySelector("[data-effacer]").addEventListener("click", function () {
    etat = { cat: "", prix: "", tri: "ordre", sg: false };
    form.reset(); appliquer(true);
  });

  function lireHash() {
    var h = (location.hash || "").replace(/^#/, "").replace(/^cat-/, "");
    if (titres[h] !== undefined && h) { etat.cat = h; }
  }

  function appliquer(anime) {
    var min = 0, max = Infinity;
    if (etat.prix) { var p = etat.prix.split("-"); min = parseFloat(p[0]); max = parseFloat(p[1]); }
    var visibles = [];
    cartes.forEach(function (c) {
      var prix = parseFloat(c.getAttribute("data-prix"));
      var ok = (!etat.cat || c.getAttribute("data-cat") === etat.cat) && prix >= min && prix < max && (!etat.sg || c.getAttribute("data-sg") === "1");
      c.hidden = !ok;
      if (ok) visibles.push(c);
    });
    var cle = {
      ordre: function (a, b) { return a.getAttribute("data-ordre") - b.getAttribute("data-ordre"); },
      "prix-asc": function (a, b) { return a.getAttribute("data-prix") - b.getAttribute("data-prix"); },
      "prix-desc": function (a, b) { return b.getAttribute("data-prix") - a.getAttribute("data-prix"); },
      kilo: function (a, b) { var x = parseFloat(a.getAttribute("data-kilo")) || Infinity, y = parseFloat(b.getAttribute("data-kilo")) || Infinity; return x - y; },
      nom: function (a, b) { return a.getAttribute("data-nom").localeCompare(b.getAttribute("data-nom"), "fr"); }
    }[etat.tri];
    cartes.slice().sort(cle).forEach(function (c) { grille.appendChild(c); });
    chipsNav.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-cat") === etat.cat)); });
    var n = visibles.length;
    resultats.textContent = n + (n > 1 ? " produits" : " produit") + (etat.cat ? " dans « " + titres[etat.cat] + " »" : "");
    vide.hidden = n !== 0;
    if (anime && !reduit) {
      grille.classList.remove("filtre-en-cours"); void grille.offsetWidth; grille.classList.add("filtre-en-cours");
      visibles.forEach(function (c, i) { c.style.animationDelay = Math.min(i, 8) * 40 + "ms"; });
    }
    visibles.forEach(function (c) { c.classList.add("visible"); });
    try { history.replaceState(null, "", etat.cat ? "#cat-" + etat.cat : location.pathname); } catch (e) {}
  }
  lireHash();
  form.elements.prix.value = etat.prix;
  appliquer(false);
  window.addEventListener("hashchange", function () { lireHash(); appliquer(true); });
})();
