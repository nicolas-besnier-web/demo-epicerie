// Marée Salée : commande de démonstration en 3 étapes. Rien n'est envoyé : les saisies restent en mémoire
// dans la page, puis disparaissent. À la fin, le panier est vidé et on arrive sur la page finale.
(function () {
  "use strict";
  var M = window.MareeSalee, form = document.querySelector("[data-commande]");
  if (!M || !form) return;
  var vide = document.querySelector("[data-commande-vide]"), resume = document.querySelector("[data-resume]");
  var etapes = Array.prototype.slice.call(form.querySelectorAll("[data-etape]"));
  var indic = Array.prototype.slice.call(form.querySelectorAll("[data-indic] li"));
  var courante = 0, terminee = false;
  var e_ = M.echapper;

  function mode() { return form.elements.mode.value; }
  function fraisChoisis() { return mode() === "retrait" ? 0 : M.frais(M.sousTotal()); }
  function textePrix(n) { return n === 0 ? "Gratuit" : M.euro.format(n); }

  function majResume() {
    var p = M.get(), ids = Object.keys(p);
    if (!ids.length && !terminee) { form.hidden = true; resume.hidden = true; vide.hidden = false; return; }
    var sous = M.sousTotal(), frais = fraisChoisis();
    resume.innerHTML = '<h2>Votre panier</h2><ul>' + ids.map(function (id) { return M.ligneHTML(id, p[id], { simple: true }); }).join("") + '</ul>' +
      '<dl class="totaux"><div><dt>Sous-total</dt><dd>' + M.euro.format(sous) + '</dd></div><div><dt>' + (mode() === "retrait" ? "Retrait en boutique" : "Livraison") + '</dt><dd>' + textePrix(frais) + '</dd></div><div class="total"><dt>Total</dt><dd>' + M.euro.format(sous + frais) + '</dd></div></dl>' +
      '<p class="resume-note">Démonstration : aucun paiement n’est demandé.</p>';
    var pl = form.querySelector("[data-prix-livraison]");
    if (pl) pl.textContent = textePrix(M.frais(sous));
  }

  function montrer(i, retour, sansFocus) {
    etapes.forEach(function (s, k) { s.hidden = k !== i; s.classList.remove("entre", "entre-retour"); });
    var s = etapes[i];
    if (!M.reduit) { void s.offsetWidth; s.classList.add(retour ? "entre-retour" : "entre"); }
    indic.forEach(function (li, k) { li.classList.toggle("fait", k < i); li.classList.toggle("courante", k === i); if (k === i) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
    courante = i;
    if (i === 2) rendreRecap();
    if (sansFocus) return;
    var titre = s.querySelector("legend");
    if (titre) { titre.setAttribute("tabindex", "-1"); titre.focus({ preventScroll: true }); }
    var haut = form.getBoundingClientRect().top + window.scrollY - 110;
    if (window.scrollY > haut) window.scrollTo({ top: haut, behavior: M.reduit ? "auto" : "smooth" });
  }

  function erreur(champ, msg) {
    var p = champ.closest(".champ").querySelector("[data-erreur]");
    if (msg) { champ.setAttribute("aria-invalid", "true"); champ.setAttribute("aria-describedby", p.id = p.id || champ.id + "-err"); p.textContent = msg; p.hidden = false; }
    else { champ.removeAttribute("aria-invalid"); champ.removeAttribute("aria-describedby"); p.hidden = true; p.textContent = ""; }
    return !msg;
  }
  function valider(i) {
    var ok = true, premier = null;
    function v(champ, msg) { var bon = erreur(champ, msg); if (!bon) { ok = false; premier = premier || champ; } }
    var f = form.elements;
    if (i === 0) {
      v(f.prenom, f.prenom.value.trim() ? "" : "Indiquez votre prénom.");
      v(f.nom, f.nom.value.trim() ? "" : "Indiquez votre nom.");
      v(f.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim()) ? "" : "Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.");
    } else if (i === 1 && mode() === "livraison") {
      v(f.rue, f.rue.value.trim() ? "" : "Indiquez votre adresse.");
      v(f.cp, /^\d{5}$/.test(f.cp.value.trim()) ? "" : "Le code postal comporte 5 chiffres.");
      v(f.ville, f.ville.value.trim() ? "" : "Indiquez votre ville.");
    } else if (i === 2) {
      v(f.cgv, f.cgv.checked ? "" : "Cochez la case pour continuer.");
    }
    if (premier) premier.focus();
    return ok;
  }

  function rendreRecap() {
    var f = form.elements, sous = M.sousTotal(), frais = fraisChoisis();
    var livr = mode() === "retrait" ? "<strong>Retrait en boutique</strong><br>" + e_(M.livraison.retrait) + ", au 12 rue du Beurre-Salé, 35000 Rennes (adresse fictive)." :
      "<strong>Livraison à domicile</strong> (" + e_(M.livraison.delai) + ")<br>" + e_(f.rue.value) + ", " + e_(f.cp.value) + " " + e_(f.ville.value);
    form.querySelector("[data-recap]").innerHTML = '<h3>Vos coordonnées</h3><p>' + e_(f.prenom.value) + " " + e_(f.nom.value) + "<br>" + e_(f.email.value) + (f.tel.value ? "<br>" + e_(f.tel.value) : "") + '</p>' +
      '<h3>Mode de réception</h3><p>' + livr + '</p>' +
      '<h3>Total à payer</h3><p>' + M.euro.format(sous + frais) + ' TTC. <strong>Démonstration : rien ne sera débité.</strong></p>';
  }

  form.addEventListener("click", function (e) {
    if (e.target.closest("[data-suivant]")) { if (valider(courante)) montrer(courante + 1, false); }
    else if (e.target.closest("[data-precedent]")) montrer(courante - 1, true);
  });
  form.addEventListener("change", function (e) {
    if (e.target.name === "mode") { form.querySelector("[data-adresse]").hidden = mode() !== "livraison"; majResume(); }
  });
  form.addEventListener("input", function (e) { if (e.target.getAttribute("aria-invalid")) erreur(e.target, ""); });
  form.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "radio" && courante < 2) { e.preventDefault(); if (valider(courante)) montrer(courante + 1, false); }
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!valider(2)) return;
    terminee = true;
    form.reset();
    M.vider();
    window.location.href = "commande-terminee.html";
  });

  form.hidden = false; resume.hidden = false;
  M.surChangement(majResume);
  if (!Object.keys(M.get()).length) { majResume(); return; }
  majResume();
  montrer(0, false, true);
})();
