// Marée Salée : page « Panier ».
(function () {
  "use strict";
  var M = window.MareeSalee, zone = document.querySelector("[data-panier-page]");
  if (!M || !zone) return;
  var vide = '<div class="vide-panier"><p>Votre panier est vide.</p><p>Quelques idées pour commencer : un pot de caramel au beurre salé, une boîte de sardines, un coffret à offrir.</p><p><a class="bouton" href="catalogue.html">Voir l’épicerie</a></p></div>';
  function rendre() {
    var p = M.get(), ids = Object.keys(p);
    if (!ids.length) { zone.innerHTML = vide; return; }
    zone.innerHTML = '<div class="panier-page"><ul class="lignes">' + ids.map(function (id) { return M.ligneHTML(id, p[id]); }).join("") + '</ul>' +
      '<div>' + M.resumeHTML({ pageTexte: true }).replace('class="resume"', 'class="resume"') + '</div></div>';
  }
  function majSurPlace() {
    var p = M.get(), ids = Object.keys(p);
    var lignes = zone.querySelectorAll("[data-ligne]");
    var memes = ids.length === lignes.length && ids.every(function (i) { return zone.querySelector('[data-ligne="' + i + '"]'); });
    if (!memes) { rendre(); return; }
    ids.forEach(function (i) {
      var l = zone.querySelector('[data-ligne="' + i + '"]');
      l.querySelector(".quantite-valeur").textContent = p[i];
      l.querySelector("[data-total-ligne]").textContent = M.euro.format(p[i] * M.produits[i].prix);
      l.querySelector("[data-plus]").disabled = p[i] >= M.MAX;
    });
    var r = zone.querySelector(".resume"); if (r) r.outerHTML = M.resumeHTML({ pageTexte: true });
  }
  rendre();
  M.surChangement(majSurPlace);
  zone.addEventListener("click", function (e) {
    var plus = e.target.closest("[data-plus]"), moins = e.target.closest("[data-moins]"), ret = e.target.closest("[data-retirer]");
    if (plus) M.changer(plus.getAttribute("data-plus"), 1);
    else if (moins) {
      var id = moins.getAttribute("data-moins");
      M.changer(id, -1);
    } else if (ret) {
      var idr = ret.getAttribute("data-retirer"), ligne = ret.closest(".ligne");
      if (ligne && !M.reduit) { ligne.classList.add("sort"); setTimeout(function () { M.changer(idr, 0, 0); }, 260); } else M.changer(idr, 0, 0);
    }
  });
})();
