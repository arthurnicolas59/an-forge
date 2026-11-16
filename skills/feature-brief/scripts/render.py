#!/usr/bin/env python3
"""Met en page un brief à partir de brief.json, avec le modèle fixe templates/brief.html.

Usage : render.py <dossier-du-brief> [--base <ref>]
  lit   <dossier>/brief.json
  écrit <dossier>/index.html

--base <ref> ajoute ce que git sait, sans passer par l'auteur du brief :
  - l'annexe des fichiers créés, modifiés, supprimés ou renommés entre <ref> et HEAD
    (le dossier docs/briefs/ est exclu) ;
  - les tests existants supprimés ou modifiés ;
  - si les checks (gate.sh de build-ticket) ont passé sur cette version.

Refuse un brief trop long ou incomplet, pour que la synthèse tienne sur une page.
"""

import argparse
import html
import json
import re
import subprocess
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "brief.html"

LIMITS = {
    "titre": 60,
    "objectif": 300,
    "changement": 140,
    "texte_avant_apres": 280,
    "schema": 400,
    "fiabilite": 140,
    "choix": 700,
    "a_decider": 160,
    "role": 100,
    "essayer": 200,
    "revision": 200,
    "critere": 160,
}
MAX_CRITERES = 12
MAX_BOITES = 5
MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs"
# Pose html[data-ready] quand la page est prête, schémas dessinés ou non : to-pdf.sh l'attend.
READY = "<script>document.documentElement.dataset.ready = '1';</script>"
READY_MERMAID = (
    '<script type="module">\n'
    "try {\n"
    f'  const {{ default: mermaid }} = await import("{MERMAID}");\n'
    '  mermaid.initialize({ startOnLoad: false, theme: "neutral", flowchart: { useMaxWidth: false } });\n'
    "  await mermaid.run();\n"
    "} finally { document.documentElement.dataset.ready = '1'; }\n"
    "</script>"
)


def check_schema(code, where, errors):
    """Un schéma Mermaid court et de gauche à droite : 5 boîtes au plus."""
    if not isinstance(code, str) or not code.strip():
        errors.append(f"{where} : vide")
        return
    if len(code) > LIMITS["schema"]:
        errors.append(f"{where} : {len(code)} caractères, {LIMITS['schema']} au maximum")
    if not code.strip().startswith("flowchart LR"):
        errors.append(f"{where} : commence par « flowchart LR » (un schéma de gauche à droite)")
    boites = set(re.findall(r"\b([A-Za-z]\w*)\s*[\[\(\{]", code))
    if len(boites) > MAX_BOITES:
        errors.append(f"{where} : {len(boites)} boîtes, {MAX_BOITES} au maximum")
# Un fichier de test : un dossier de tests, ou un nom en .test. / .spec. / _test. / test_*.py
TEST_FILE = re.compile(
    r"(^|/)(tests?|__tests__|specs?|e2e|cypress)/"
    r"|[._-](test|spec)\.[^/]+$"
    r"|(^|/)test_[^/]+\.py$"
)
# Les réglages qui décident de ce que les checks vérifient. Même liste que gate.sh (skill build-ticket).
CONFIG_FILE = re.compile(
    r"(^|/)(pyproject\.toml|setup\.cfg|tox\.ini|pytest\.ini|conftest\.py|\.coveragerc|mypy\.ini|ruff\.toml"
    r"|\.flake8|Makefile|tsconfig[^/]*\.json|\.eslintrc[^/]*|eslint\.config\.[^/]+|\.eslintignore|biome\.jsonc?"
    r"|(vitest|jest|playwright|cypress|karma|babel)\.config\.[^/]+)$"
    r"|^\.github/workflows/|(^|/)scripts/checks\.sh$"
)
PKG_KEYS = re.compile(r'^[-+]\s*"(test|lint|typecheck|type-check|check|checks|build|jest|eslintConfig|vitest)[^"]*"\s*:')
SKIP_MARK = re.compile(
    r"(^|[^A-Za-z0-9_.])((it|test|describe|context|suite)\.(skip|only|todo)([^A-Za-z0-9_]|$)"
    r"|x(it|test|describe)\s*\(|t\.Skip\s*\()"
    r"|@pytest\.mark\.(skip|xfail)|pytest\.skip\s*\(|@unittest\.skip|@Disabled|@Ignore"
)
RISQUES = {"faible": "low", "moyen": "medium", "élevé": "high"}
MAX_ROWS = 60
EXCLUDE = "docs/briefs/"

errors = []


def need(data, key, limit=None, where=""):
    value = data.get(key) if isinstance(data, dict) else None
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{where}{key} : manquant ou vide")
        return ""
    value = value.strip()
    if limit and len(value) > limit:
        errors.append(f"{where}{key} : {len(value)} caractères, {limit} au maximum")
    return value


MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"]


def date_fr(value):
    """2026-11-11 -> 11 novembre 2026 ; laisse tel quel ce qui n'est pas une date ISO."""
    parts = value.split("-")
    if len(parts) == 3 and all(p.isdigit() for p in parts) and 1 <= int(parts[1]) <= 12:
        return f"{int(parts[2])} {MOIS[int(parts[1]) - 1]} {parts[0]}"
    return value


def esc(text):
    return html.escape(text, quote=True)


def git(folder, *args):
    res = subprocess.run(["git", "-C", str(folder), *args], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"git {' '.join(args)} a échoué : {res.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    return res.stdout


def changed_files(folder, base):
    """Liste (statut, chemin, ancien_chemin, ajouts, suppressions) entre base et HEAD."""
    span = f"{base}...HEAD"
    status = git(folder, "diff", "--name-status", "-M", "-z", span).split("\0")
    numstat = git(folder, "diff", "--numstat", "-M", "-z", span).split("\0")

    counts = {}
    i = 0
    while i < len(numstat) and numstat[i]:
        added, deleted, path = numstat[i].split("\t", 2)
        if path == "":  # renommage : les deux chemins suivent
            path = numstat[i + 2]
            i += 3
        else:
            i += 1
        counts[path] = (added, deleted)

    files = []
    i = 0
    while i < len(status) and status[i]:
        code = status[i][0]
        if code in "RC":
            old, path = status[i + 1], status[i + 2]
            i += 3
        else:
            old, path = None, status[i + 1]
            i += 2
        if path.startswith(EXCLUDE):
            continue
        added, deleted = counts.get(path, ("0", "0"))
        files.append((code, path, old, added, deleted))
    order = {"A": 0, "M": 1, "T": 1, "R": 2, "C": 2, "D": 3}
    files.sort(key=lambda f: (order.get(f[0], 9), f[1]))
    return files


def touched_tests(files):
    """Les tests qui existaient avant et que la branche a supprimés, ou dont elle a retiré des lignes."""
    deleted, modified = [], []
    for code, path, old, added, removed in files:
        if code == "D" and TEST_FILE.search(path):
            deleted.append(path)
        elif code in "MTR" and TEST_FILE.search(old or path) and removed not in ("0", "-"):
            modified.append(path)
    return deleted, modified


def touched_config(folder, base, files):
    """Les réglages des checks modifiés et les tests désactivés par la branche (même règle que gate.sh)."""
    found = []
    for code, path, old, added, removed in files:
        if CONFIG_FILE.search(path) or (old and CONFIG_FILE.search(old)):
            found.append(path)
        elif path.endswith("package.json") and path.split("/")[-1] == "package.json" and code != "D":
            diff = git(folder, "diff", "-U0", f"{base}...HEAD", "--", path)
            if any(PKG_KEYS.match(line) for line in diff.splitlines()):
                found.append(path)
        elif code in "AMR" and TEST_FILE.search(path):
            diff = git(folder, "diff", "-U0", f"{base}...HEAD", "--", path)
            if any(line.startswith("+") and not line.startswith("+++") and SKIP_MARK.search(line[1:])
                   for line in diff.splitlines()):
                found.append(path)
    return found


def config_line(found):
    if not found:
        return "Aucun modifié"
    return f"{len(found)} fichier{'s' if len(found) > 1 else ''} : " + ", ".join(found[:3]) + (" …" if len(found) > 3 else "")


def tests_line(deleted, modified):
    if not deleted and not modified:
        return "Aucun supprimé ni modifié"
    parts = []
    if deleted:
        parts.append(f"{len(deleted)} supprimé{'s' if len(deleted) > 1 else ''}")
    if modified:
        parts.append(f"{len(modified)} modifié{'s' if len(modified) > 1 else ''}")
    return ", ".join(parts) + " (voir l'annexe)"


def checks_line(folder):
    """Le gate a-t-il passé sur cette version ? Lu dans le fichier que gate.sh écrit, pas dans brief.json."""
    res = subprocess.run(["git", "-C", str(folder), "rev-parse", "--git-dir"], capture_output=True, text=True)
    if res.returncode != 0:
        return None
    git_dir = Path(res.stdout.strip())
    if not git_dir.is_absolute():
        git_dir = (folder / git_dir).resolve()
    stamp = git_dir / "an-forge-gate-pass"
    if not stamp.is_file():
        return "Non vérifiés par le script sur cette version"
    sha = stamp.read_text(encoding="utf-8").strip()
    # Depuis le gate, seuls les fichiers du brief ont pu changer.
    res = subprocess.run(
        ["git", "-C", str(folder), "status", "--porcelain", "--", ":(top)", f":(top,exclude){EXCLUDE}"],
        capture_output=True, text=True,
    )
    dirty = res.stdout.strip()
    res = subprocess.run(
        ["git", "-C", str(folder), "diff", "--quiet", sha, "HEAD", "--", ":(top)", f":(top,exclude){EXCLUDE}"],
        capture_output=True, text=True,
    )
    if res.returncode == 0 and not dirty:
        return f"Passés sur cette version ({sha[:7]})"
    return "Non relancés depuis les derniers changements du code"


def criteres_html(criteres):
    rows = []
    for c in criteres:
        preuve = (c.get("preuve") or "").strip()
        if preuve:
            state = '<span class="status added">Prouvé</span>'
            detail = f'<p class="role">{esc(preuve)}</p>'
        else:
            state = '<span class="status deleted">Non prouvé</span>'
            detail = ""
        rows.append(f'<tr><td>{state}</td><td><p>{esc(c["critere"].strip())}</p>{detail}</td></tr>')
    return (
        '<h2 class="title">Les critères du ticket</h2>\n'
        '<p class="summary-line">Pour chaque critère d\'acceptation, le test ou la capture qui le prouve.</p>\n'
        '<div class="table-wrap"><table class="criteres"><thead><tr><th>État</th><th>Critère</th></tr></thead><tbody>\n'
        + "\n".join(rows)
        + "\n</tbody></table></div>\n"
    )


def annexe_html(files, roles):
    labels = {
        "A": ("added", "Créé"), "M": ("modified", "Modifié"), "T": ("modified", "Modifié"),
        "D": ("deleted", "Supprimé"), "R": ("renamed", "Renommé"), "C": ("renamed", "Copié"),
    }
    tally = {}
    for code, *_ in files:
        label = labels.get(code, ("modified", "Modifié"))[1]
        tally[label] = tally.get(label, 0) + 1
    plural = {"Créé": "créés", "Modifié": "modifiés", "Supprimé": "supprimés", "Renommé": "renommés", "Copié": "copiés"}
    parts = [f"{n} {plural[k] if n > 1 else k.lower()}" for k, n in tally.items()]
    total = len(files)
    summary = f"{total} fichier{'s' if total > 1 else ''} : " + ", ".join(parts) + "." if files else "Aucun fichier modifié."

    rows = []
    for code, path, old, added, deleted in files[:MAX_ROWS]:
        cls, label = labels.get(code, ("modified", "Modifié"))
        name = f"{esc(old)} → {esc(path)}" if old else esc(path)
        role = roles.get(path, "")
        role_html = f'<p class="role">{esc(role)}</p>' if role else ""
        lines = "binaire" if added == "-" else f'<span class="plus">+{added}</span> <span class="minus">−{deleted}</span>'
        rows.append(
            f'<tr><td><span class="status {cls}">{label}</span></td>'
            f'<td><p class="path">{name}</p>{role_html}</td>'
            f'<td class="lines">{lines}</td></tr>'
        )
    if total > MAX_ROWS:
        rows.append(f'<tr><td></td><td class="more">et {total - MAX_ROWS} autres fichiers</td><td></td></tr>')

    table = ""
    if files:
        table = (
            '<div class="table-wrap"><table><thead><tr><th>Statut</th><th>Fichier</th><th class="lines">Lignes</th></tr></thead><tbody>\n'
            + "\n".join(rows)
            + "\n</tbody></table></div>"
        )
    return (
        '<h2 class="title">Les fichiers touchés</h2>\n'
        f'<p class="summary-line">{esc(summary)}</p>\n'
        f"{table}\n"
    )


def main():
    parser = argparse.ArgumentParser(description="Met en page un brief an-forge.")
    parser.add_argument("dossier")
    parser.add_argument("--base", help="référence git de départ, pour l'annexe des fichiers")
    args = parser.parse_args()

    folder = Path(args.dossier)
    source = folder / "brief.json"
    if not source.is_file():
        print(f"Introuvable : {source}", file=sys.stderr)
        sys.exit(2)
    try:
        data = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"{source} n'est pas du JSON valide : {exc}", file=sys.stderr)
        sys.exit(2)

    titre = need(data, "titre", LIMITS["titre"])
    ticket = data.get("ticket")
    if not isinstance(ticket, int):
        errors.append("ticket : doit être un numéro")
    ticket_url = data.get("ticket_url", "")
    date = need(data, "date")
    branche = need(data, "branche")
    objectif = need(data, "objectif", LIMITS["objectif"])

    changements = data.get("changements")
    if not isinstance(changements, list) or not 1 <= len(changements) <= 5:
        errors.append("changements : entre 1 et 5 points")
        changements = []
    for i, item in enumerate(changements, 1):
        if not isinstance(item, str) or not item.strip():
            errors.append(f"changements[{i}] : vide")
        elif len(item) > LIMITS["changement"]:
            errors.append(f"changements[{i}] : {len(item)} caractères, {LIMITS['changement']} au maximum")

    aa = data.get("avant_apres") or {}
    ecrans = aa.get("ecrans") or []
    texte = aa.get("texte")
    schemas = aa.get("schemas")
    if sum(bool(x) for x in (ecrans, schemas, texte)) != 1:
        errors.append("avant_apres : mets une seule forme : « ecrans » (captures), « schemas » ou « texte »")
    if schemas:
        if schemas.get("avant"):
            check_schema(schemas["avant"], "avant_apres.schemas.avant", errors)
        check_schema(schemas.get("apres"), "avant_apres.schemas.apres", errors)
    if len(ecrans) > 2:
        errors.append("avant_apres.ecrans : 2 écrans au maximum")
    for i, ecran in enumerate(ecrans, 1):
        need(ecran, "nom", 60, f"avant_apres.ecrans[{i}].")
        # « avant » est facultatif : un écran nouveau n'avait rien à capturer avant.
        for key in ("avant", "apres") if ecran.get("avant") else ("apres",):
            name = need(ecran, key, None, f"avant_apres.ecrans[{i}].")
            if name and not (folder / name).is_file():
                errors.append(f"avant_apres.ecrans[{i}].{key} : image introuvable ({folder / name})")
    if texte:
        need(texte, "avant", LIMITS["texte_avant_apres"], "avant_apres.texte.")
        need(texte, "apres", LIMITS["texte_avant_apres"], "avant_apres.texte.")

    fiab = data.get("fiabilite") or {}
    tests = need(fiab, "tests", LIMITS["fiabilite"], "fiabilite.")
    relecture = need(fiab, "relecture", LIMITS["fiabilite"], "fiabilite.")
    risque = need(fiab, "risque", None, "fiabilite.")
    if risque and risque not in RISQUES:
        errors.append("fiabilite.risque : faible, moyen ou élevé")
    risque_detail = need(fiab, "risque_detail", LIMITS["fiabilite"], "fiabilite.")
    choix = need(data, "choix", LIMITS["choix"])
    a_decider = need(data, "a_decider", LIMITS["a_decider"])

    roles = data.get("fichiers") or {}
    if not isinstance(roles, dict):
        errors.append("fichiers : doit associer un chemin à une phrase")
        roles = {}
    for path, role in roles.items():
        if not isinstance(role, str) or len(role) > LIMITS["role"]:
            errors.append(f"fichiers[{path}] : une phrase de {LIMITS['role']} caractères au maximum")

    essayer = (data.get("essayer") or "").strip()
    if len(essayer) > LIMITS["essayer"]:
        errors.append(f"essayer : {len(essayer)} caractères, {LIMITS['essayer']} au maximum")
    revision = (data.get("revision") or "").strip()
    if len(revision) > LIMITS["revision"]:
        errors.append(f"revision : {len(revision)} caractères, {LIMITS['revision']} au maximum")

    criteres = data.get("criteres") or []
    if not isinstance(criteres, list) or len(criteres) > MAX_CRITERES:
        errors.append(f"criteres : une liste de {MAX_CRITERES} critères au maximum")
        criteres = []
    for i, c in enumerate(criteres, 1):
        need(c, "critere", LIMITS["critere"], f"criteres[{i}].")
        preuve = c.get("preuve") if isinstance(c, dict) else None
        if preuve is not None and (not isinstance(preuve, str) or len(preuve) > LIMITS["critere"]):
            errors.append(f"criteres[{i}].preuve : une phrase de {LIMITS['critere']} caractères au maximum, ou rien")

    facts = []  # lignes calculées, ajoutées à la section Fiabilité
    sections = []
    if criteres and not errors:
        proven = sum(1 for c in criteres if (c.get("preuve") or "").strip())
        facts.append(("Critères", f"{proven} sur {len(criteres)} prouvés (voir l'annexe)"))
        sections.append(criteres_html(criteres))
    if args.base:
        files = changed_files(folder, args.base)
        known = {f[1] for f in files}
        for path in roles:
            if path not in known:
                errors.append(f"fichiers[{path}] : ce fichier n'est pas dans le diff")
        checks = checks_line(folder)
        if checks:
            facts.insert(0, ("Checks", checks))
        facts.append(("Tests existants", tests_line(*touched_tests(files))))
        facts.append(("Réglages des checks", config_line(touched_config(folder, args.base, files))))
        sections.append(annexe_html(files, roles))
    annexe = ""
    if sections:
        annexe = '<section class="annexe">\n<p class="label annexe-label">Annexe</p>\n' + "\n".join(sections) + "</section>"

    if errors:
        print("Brief refusé :", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    ticket_html = f"Ticket #{ticket}"
    if ticket_url:
        ticket_html = f'<a href="{esc(ticket_url)}">{ticket_html}</a>'

    items = "\n".join(f"<li>{esc(c.strip())}</li>" for c in changements)

    if ecrans:
        rows = []
        for e in ecrans:
            nom = esc(e["nom"].strip())
            rows.append(
                '<div class="pair">'
                + (f'<p class="pair-name">{nom}</p>' if len(ecrans) > 1 else "")
                + '<div class="pair-images">'
                + (
                    f'<figure><img src="{esc(e["avant"].strip())}" alt="Avant : {nom}"><figcaption>Avant</figcaption></figure>'
                    if (e.get("avant") or "").strip()
                    else '<div class="text-box"><p class="label">Avant</p><p>Cet écran n’existait pas.</p></div>'
                )
                + '<span class="arrow" aria-hidden="true">→</span>'
                f'<figure><img src="{esc(e["apres"].strip())}" alt="Après : {nom}"><figcaption>Après</figcaption></figure>'
                "</div></div>"
            )
        avant_apres = "\n".join(rows)
    elif schemas:
        avant = (schemas.get("avant") or "").strip()
        avant_apres = (
            '<div class="pair"><div class="pair-images schemas">'
            + (
                f'<figure><pre class="mermaid">{esc(avant)}</pre><figcaption>Avant</figcaption></figure>'
                if avant
                else '<div class="text-box"><p class="label">Avant</p><p>Cela n’existait pas.</p></div>'
            )
            + f'<figure><pre class="mermaid">{esc(schemas["apres"].strip())}</pre><figcaption>Après</figcaption></figure>'
            "</div></div>"
        )
    else:
        avant_apres = (
            '<div class="text-pair">'
            f'<div class="text-box"><p class="label">Avant</p><p>{esc(texte["avant"].strip())}</p></div>'
            '<span class="arrow" aria-hidden="true">→</span>'
            f'<div class="text-box after"><p class="label">Après</p><p>{esc(texte["apres"].strip())}</p></div>'
            "</div>"
        )

    faits = "\n".join(f'    <p><span class="k">{esc(k)}</span><span>{esc(v)}</span></p>' for k, v in facts)
    essayer_html = ""
    if essayer:
        essayer_html = f'  <section class="row"><h2>Pour l\'essayer</h2><p>{esc(essayer)}</p></section>'
    revision_html = ""
    if revision:
        revision_html = f'  <p class="revision"><span class="label">Mis à jour</span> {esc(revision)}</p>'

    page = TEMPLATE.read_text(encoding="utf-8")
    values = {
        "TITRE": esc(titre),
        "TICKET": ticket_html,
        "DATE": esc(date_fr(date)),
        "BRANCHE": esc(branche),
        "OBJECTIF": esc(objectif),
        "CHANGEMENTS": items,
        "AVANT_APRES": avant_apres,
        "TESTS": esc(tests),
        "RELECTURE": esc(relecture),
        "RISQUE": esc(risque),
        "RISQUE_MAJ": esc(risque.capitalize()),
        "RISQUE_CLASSE": RISQUES[risque],
        "RISQUE_DETAIL": esc(risque_detail),
        "CHOIX": esc(choix),
        "A_DECIDER": esc(a_decider),
        "FAITS": faits,
        "ESSAYER": essayer_html,
        "REVISION": revision_html,
        "ANNEXE": annexe,
        "SCRIPTS": READY_MERMAID if schemas else READY,
    }
    for key, value in values.items():
        page = page.replace("{{" + key + "}}", value)

    out = folder / "index.html"
    out.write_text(page, encoding="utf-8")
    print(f"Brief écrit : {out}")


if __name__ == "__main__":
    main()
