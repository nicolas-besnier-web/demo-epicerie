// Marée Salée : boutique fictive réalisée par BALD.
// Amélioration progressive : tout le contenu est déjà dans le HTML. Ce script ajoute le menu mobile,
// l'apparition douce des blocs et le formulaire de contact de démonstration.
// Aucun cookie, aucune ressource externe. Animations coupées si le visiteur les a réduites.
(function () {
  "use strict";
  var reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Menu mobile
  var bouton = document.querySelector(".menu-bouton");
  var nav = document.getElementById("nav");
  if (bouton && nav) {
    var fermer = function (rendreFocus) {
      nav.classList.remove("ouvert");
      bouton.setAttribute("aria-expanded", "false");
      if (rendreFocus) bouton.focus();
    };
    bouton.addEventListener("click", function () {
      var ouvert = nav.classList.toggle("ouvert");
      bouton.setAttribute("aria-expanded", String(ouvert));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("ouvert")) fermer(true);
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) fermer(false); });
  }

  // Apparition douce : seulement si le visiteur n'a pas réduit les animations
  var blocs = document.querySelectorAll(".apparait");
  function toutMontrer() { blocs.forEach(function (b) { b.classList.add("visible"); }); }
  if (reduit || !("IntersectionObserver" in window)) {
    toutMontrer();
  } else {
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    blocs.forEach(function (b) { obs.observe(b); });
    // Filet de sécurité : rien ne reste invisible si l'observateur tarde
    setTimeout(function () { document.querySelectorAll(".apparait:not(.visible)").forEach(function (b) {
      var r = b.getBoundingClientRect();
      if (r.top < window.innerHeight) b.classList.add("visible");
    }); }, 1200);
  }
  window.addEventListener("beforeprint", toutMontrer);

  // Formulaire de contact : démonstration, rien n'est envoyé
  document.querySelectorAll("[data-demo-form]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var retour = f.querySelector("[data-demo-retour]");
      if (retour) { retour.hidden = false; }
    });
  });
})();
