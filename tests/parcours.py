"""Parcours complet de la boutique de démonstration (Playwright).
Usage : python3 tests/parcours.py [--captures]  (serveur sur http://localhost:8000, dist/ généré)"""
import sys, re
from playwright.sync_api import sync_playwright
BASE = "http://localhost:8000/"
CAPT = "--captures" in sys.argv
problemes = []
def verifie(ok, msg):
    print(("OK  " if ok else "ECHEC ") + msg)
    if not ok: problemes.append(msg)

def scenario(browser, nom, w, h, scheme, js=True, capt=False):
    ctx = browser.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, java_script_enabled=js)
    pg = ctx.new_page()
    errs, externes = [], []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("request", lambda r: externes.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith("data:") else None)
    def deborde(): return pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
    def montre(): pg.evaluate("document.querySelectorAll('.apparait').forEach(e=>e.classList.add('visible'))"); pg.wait_for_timeout(500)
    def cap(n, full=False):
        if capt:
            montre(); pg.screenshot(path=f"captures/{n}-{nom}.png", full_page=full)
    tag = f"[{nom}]"
    pg.goto(BASE + "index.html"); pg.wait_for_timeout(300)
    verifie(not deborde(), f"{tag} accueil sans débordement horizontal")
    cap("accueil", full=True)
    # catalogue + filtre
    pg.goto(BASE + "catalogue.html"); pg.wait_for_timeout(300)
    verifie(not deborde(), f"{tag} catalogue sans débordement")
    n = pg.locator(".produit").count(); verifie(n == 18, f"{tag} catalogue : 18 produits ({n})")
    if js:
        pg.click(".chips button[data-cat='biscuits']"); pg.wait_for_timeout(300)
        vis = pg.locator(".produit:not([hidden])").count(); verifie(vis == 3, f"{tag} filtre biscuits : 3 produits ({vis})")
        pg.click(".chips button[data-cat='']"); pg.select_option("select[name=prix]", "0-8"); pg.check("input[name=sg]"); pg.select_option("select[name=tri]", "prix-desc"); pg.wait_for_timeout(300)
        prix = pg.eval_on_selector_all(".produit:not([hidden])", "e=>e.map(x=>+x.dataset.prix)")
        verifie(prix == sorted(prix, reverse=True) and all(p < 8 for p in prix) and len(prix) > 0, f"{tag} filtres prix + sans gluten + tri : {prix}")
        pg.click("[data-effacer]") if pg.locator("[data-vide]:not([hidden])").count() else None
        pg.click(".chips button[data-cat='']"); pg.select_option("select[name=prix]", ""); pg.uncheck("input[name=sg]"); pg.select_option("select[name=tri]", "ordre"); pg.wait_for_timeout(200)
        pg.click(".chips button[data-cat='caramels']"); pg.wait_for_timeout(300)
        cap("catalogue", full=False)
    else:
        cap("catalogue-sans-js", full=False)
    # fiche produit
    pg.goto(BASE + "produit-caramel-beurre-sale.html"); pg.wait_for_timeout(300)
    verifie(not deborde(), f"{tag} fiche sans débordement")
    verifie("Lait" in pg.inner_text(".fiche-infos"), f"{tag} fiche : allergènes présents")
    verifie(pg.locator(".fiche strong", has_text="crème").count() >= 1, f"{tag} fiche : allergène en gras (INCO)")
    cap("fiche-produit")
    if js:
        pg.click(".quantite-plus"); pg.click("[data-achat] [data-ajouter]"); pg.wait_for_timeout(1000)
        verifie(pg.evaluate("document.querySelector('[data-tiroir]').open"), f"{tag} tiroir ouvert après ajout")
        verifie(pg.inner_text("[data-panier-nb]") == "2", f"{tag} compteur = 2")
        cap("panier-ouvert")
        pg.click("[data-tiroir] [data-plus]"); pg.wait_for_timeout(200)
        verifie(pg.inner_text("[data-panier-nb]") == "3", f"{tag} quantité +1 dans le tiroir")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(600)
        verifie(not pg.evaluate("document.querySelector('[data-tiroir]').open"), f"{tag} tiroir fermé avec Échap")
        # page panier
        pg.goto(BASE + "panier.html"); pg.wait_for_timeout(400)
        verifie(not deborde(), f"{tag} panier sans débordement")
        verifie(pg.inner_text("[data-panier-nb]") == "3", f"{tag} panier persistant (localStorage)")
        pg.click("[data-panier-page] [data-moins]"); pg.wait_for_timeout(200)
        verifie("17,80" in pg.inner_text(".lignes").replace(" ", " ").replace(" ", " "), f"{tag} total ligne 2 × 8,90 = 17,80 €")
        cap("panier-page")
        pg.click("text=Commander (démonstration)"); pg.wait_for_timeout(500)
        # commande
        pg.click("[data-suivant]"); pg.wait_for_timeout(200)
        verifie(pg.locator("[data-erreur]:not([hidden])").count() >= 3, f"{tag} validation : erreurs affichées")
        pg.fill("#prenom", "Test"); pg.fill("#nom", "Démo"); pg.fill("#email", "test@exemple.fr"); pg.click("[data-suivant]"); pg.wait_for_timeout(600)
        pg.check("input[value=livraison]"); pg.wait_for_timeout(200)
        pg.fill("#rue", "1 rue Fictive"); pg.fill("#cp", "35000"); pg.fill("#ville", "Rennes")
        cap("commande")
        pg.click("[data-etape='1'] [data-suivant]"); pg.wait_for_timeout(600)
        verifie("Démonstration" in pg.inner_text("[data-etape='2']"), f"{tag} récapitulatif : mention démonstration")
        verifie(pg.locator("input[type=text][name*=carte], input[autocomplete*=cc-]").count() == 0, f"{tag} aucun champ carte bancaire")
        pg.click("[data-etape='2'] button[type=submit]"); pg.wait_for_timeout(300)
        verifie(pg.locator("[data-erreur]:not([hidden])").count() == 1, f"{tag} CGV obligatoire")
        pg.check("input[name=cgv]"); pg.click("[data-etape='2'] button[type=submit]"); pg.wait_for_url("**/commande-terminee.html"); pg.wait_for_timeout(300)
        verifie("aucune commande n'a été passée" in pg.inner_text("h1").lower().replace("’", "'"), f"{tag} page finale claire")
        verifie(pg.inner_text("[data-panier-nb]") == "0", f"{tag} panier vidé à la fin")
        cap("commande-terminee")
    for page in ["a-propos", "contact", "livraison-retours", "faq", "cgv", "mentions-legales", "confidentialite", "actualites", "404"]:
        pg.goto(BASE + page + ".html"); pg.wait_for_timeout(150)
        if deborde(): verifie(False, f"{tag} {page} : débordement horizontal")
    verifie(not errs, f"{tag} aucune erreur console {errs[:3]}")
    verifie(not externes, f"{tag} aucune requête externe {externes[:3]}")
    ctx.close()

with sync_playwright() as p:
    b = p.chromium.launch()
    scenario(b, "bureau-clair", 1280, 800, "light", capt=CAPT)
    scenario(b, "mobile-clair", 375, 740, "light", capt=CAPT)
    scenario(b, "bureau-sombre", 1280, 800, "dark")
    scenario(b, "mobile-sombre", 375, 740, "dark")
    scenario(b, "bureau-sans-js", 1280, 800, "light", js=False)
    scenario(b, "mobile-sans-js", 375, 740, "light", js=False)
    b.close()
print("\n%d problème(s)" % len(problemes)); sys.exit(1 if problemes else 0)
