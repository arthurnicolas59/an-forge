#!/usr/bin/env python3
"""Met en page un brief à partir de brief.json, avec le modèle fixe templates/brief.html.

Usage : render.py <dossier-du-brief> [--base <ref>]
  lit   <dossier>/brief.json
  écrit <dossier>/index.html

--base <ref> ajoute l'annexe : la liste des fichiers créés, modifiés, supprimés ou renommés
entre <ref> et HEAD, calculée par git (le dossier docs/briefs/ est exclu).

Refuse un brief trop long ou incomplet, pour que la synthèse tienne sur une page.
"""

import argparse
import html
import json
import subprocess
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "brief.html"

LIMITS = {
    "titre": 60,
    "objectif": 300,
    "changement": 140,
    "texte_avant_apres": 280,
    "fiabilite": 140,
    "choix": 700,
    "a_decider": 160,
    "role": 100,
}
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
        '<section class="annexe">\n'
        '<h2 class="title">Annexe : les fichiers touchés</h2>\n'
        f'<p class="summary-line">{esc(summary)}</p>\n'
        f"{table}\n</section>"
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
    if bool(ecrans) == bool(texte):
        errors.append("avant_apres : mets soit « ecrans » (captures), soit « texte », pas les deux")
    if len(ecrans) > 2:
        errors.append("avant_apres.ecrans : 2 écrans au maximum")
    for i, ecran in enumerate(ecrans, 1):
        need(ecran, "nom", 60, f"avant_apres.ecrans[{i}].")
        for key in ("avant", "apres"):
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

    annexe = ""
    if args.base:
        files = changed_files(folder, args.base)
        known = {f[1] for f in files}
        for path in roles:
            if path not in known:
                errors.append(f"fichiers[{path}] : ce fichier n'est pas dans le diff")
        annexe = annexe_html(files, roles)

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
                f'<figure><img src="{esc(e["avant"].strip())}" alt="Avant : {nom}"><figcaption>Avant</figcaption></figure>'
                '<span class="arrow" aria-hidden="true">→</span>'
                f'<figure><img src="{esc(e["apres"].strip())}" alt="Après : {nom}"><figcaption>Après</figcaption></figure>'
                "</div></div>"
            )
        avant_apres = "\n".join(rows)
    else:
        avant_apres = (
            '<div class="text-pair">'
            f'<div class="text-box"><p class="label">Avant</p><p>{esc(texte["avant"].strip())}</p></div>'
            '<span class="arrow" aria-hidden="true">→</span>'
            f'<div class="text-box after"><p class="label">Après</p><p>{esc(texte["apres"].strip())}</p></div>'
            "</div>"
        )

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
        "ANNEXE": annexe,
    }
    for key, value in values.items():
        page = page.replace("{{" + key + "}}", value)

    out = folder / "index.html"
    out.write_text(page, encoding="utf-8")
    print(f"Brief écrit : {out}")


if __name__ == "__main__":
    main()
