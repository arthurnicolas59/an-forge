#!/usr/bin/env python3
"""La fiche ARCHITECTURE.md du projet : la crée, tient sa liste de dossiers fidèle au vrai projet, et
vérifie qu'elle est à jour.

L'agent écrit le texte (la vue d'ensemble, le schéma, les technologies, et une explication par dossier).
Ce script, lui, s'occupe de ce qui doit être exact : quels dossiers existent vraiment. Il redessine
l'arbre des dossiers entre les marqueurs <!-- an-forge:dossiers --> et <!-- /an-forge:dossiers -->,
garde l'explication de chaque dossier qui existe toujours, et marque « À EXPLIQUER » les nouveaux.

Usage :
  architecture.py init        crée ARCHITECTURE.md depuis le modèle s'il n'existe pas (n'écrase jamais)
  architecture.py tree        redessine l'arbre des dossiers dans ARCHITECTURE.md
  architecture.py check       dit si la fiche est à jour : architecture=ok|stale|missing, puis une ligne par
                              chose à faire (texte « À REMPLIR », dossier « À EXPLIQUER », dossier ajouté
                              ou disparu depuis le dernier « tree »)

Les dossiers lus sont ceux que git connaît (suivis, ou nouveaux mais pas ignorés), sur 2 niveaux par défaut.
Pour en montrer plus : <!-- an-forge:dossiers profondeur=3 -->. Les dossiers cachés sont omis, sauf .github.

Codes : 0 à jour (ou fait) · 1 pas à jour · 2 erreur d'outil · 3 pas d'ARCHITECTURE.md (check)
"""
import re
import subprocess
import sys
from pathlib import Path

FILE = "ARCHITECTURE.md"
TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "ARCHITECTURE.md"
START = re.compile(r"<!--\s*an-forge:dossiers(?:\s+profondeur=(\d+))?\s*-->")
END = "<!-- /an-forge:dossiers -->"
TODO_DIR = "À EXPLIQUER"
TODO_TEXT = "À REMPLIR"
LINE = re.compile(r"^((?:│   |    )*)(?:├── |└── )(.+?)/\s*(?:#\s*(.*?))?\s*$")


def run(*args, cwd=None):
    res = subprocess.run(list(args), cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"{' '.join(args[:3])}… a échoué : {res.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    return res.stdout


def root_dir():
    """La racine du worktree courant : la fiche se met à jour dans la branche où l'on travaille."""
    res = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if res.returncode != 0:
        print("Pas de repo git ici : lance ce script depuis le projet.", file=sys.stderr)
        sys.exit(2)
    return Path(res.stdout.strip())


def real_dirs(root, depth):
    """Les dossiers du projet, jusqu'à `depth` niveaux, d'après les fichiers que git connaît."""
    files = run("git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", cwd=root).split("\0")
    dirs = set()
    for f in files:
        if not f or not (root / f).exists():
            continue
        parts = f.split("/")[:-1]
        for i in range(min(len(parts), depth)):
            sub = parts[: i + 1]
            if any(p.startswith(".") and p != ".github" for p in sub):
                break
            dirs.add("/".join(sub))
    return dirs


def parse_block(lines):
    """Les explications déjà écrites, par chemin de dossier."""
    comments, stack = {}, []
    for line in lines:
        m = LINE.match(line)
        if not m:
            continue
        level = len(m.group(1)) // 4
        stack = stack[:level] + [m.group(2).strip()]
        comments["/".join(stack)] = (m.group(3) or "").strip()
    return comments


def draw(root_name, dirs, comments):
    children = {}
    for d in sorted(dirs, key=lambda p: [s.lower() for s in p.split("/")]):
        parent = d.rsplit("/", 1)[0] if "/" in d else ""
        children.setdefault(parent, []).append(d)
    rows = []

    def walk(parent, prefix):
        kids = children.get(parent, [])
        for i, d in enumerate(kids):
            last = i == len(kids) - 1
            rows.append((prefix + ("└── " if last else "├── ") + d.rsplit("/", 1)[-1] + "/", d))
            walk(d, prefix + ("    " if last else "│   "))

    walk("", "")
    width = max([len(r[0]) for r in rows] + [0]) + 2
    out = [f"{root_name}/"]
    for text, path in rows:
        out.append(f"{text.ljust(width)}# {comments.get(path) or TODO_DIR}")
    return out


def locate(lines):
    for i, line in enumerate(lines):
        m = START.search(line)
        if m:
            for j in range(i + 1, len(lines)):
                if lines[j].strip() == END:
                    return i, j, int(m.group(1) or 2)
            break
    return None


def block_tree(lines, start, end):
    """Les lignes de l'arbre, entre ``` et ``` à l'intérieur des marqueurs."""
    fences = [k for k in range(start + 1, end) if lines[k].strip().startswith("```")]
    if len(fences) < 2:
        return None
    return fences[0], fences[1]


def main(argv):
    if not argv or argv[0] not in ("init", "tree", "check"):
        print(__doc__.split("Usage :")[1], file=sys.stderr)
        return 2
    cmd = argv[0]
    root = root_dir()
    path = root / FILE

    if cmd == "init":
        if path.exists():
            print("architecture=exists")
            return 0
        text = TEMPLATE.read_text(encoding="utf-8").replace("<Nom du projet>", root.name)
        path.write_text(text, encoding="utf-8")
        print(f"architecture=created ({path})")
        return 0

    if not path.exists():
        print("architecture=missing")
        return 3 if cmd == "check" else 1
    lines = path.read_text(encoding="utf-8").splitlines()
    found = locate(lines)
    if not found or not block_tree(lines, found[0], found[1]):
        print("architecture=stale")
        print(f"  pas de marqueurs : la section des dossiers doit être entourée de "
              f"<!-- an-forge:dossiers --> et {END}, avec l'arbre dans un bloc ``` ```.")
        return 1
    start, end, depth = found
    f0, f1 = block_tree(lines, start, end)
    current = lines[f0 + 1 : f1]
    comments = parse_block(current)
    dirs = real_dirs(root, depth)
    drawn = draw(root.name, dirs, comments)

    if cmd == "tree":
        new = sorted(d for d in dirs if not comments.get(d))
        gone = sorted(d for d in comments if d not in dirs)
        lines[f0 + 1 : f1] = drawn
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"nouveaux={len(new)} disparus={len(gone)}")
        for d in new:
            print(f"  à expliquer : {d}/")
        for d in gone:
            print(f"  retiré : {d}/")
        return 0

    problems = []
    text = "\n".join(lines)
    if TODO_TEXT in text:
        problems.append(f"il reste « {TODO_TEXT} » dans le texte : complète-le")
    listed = set(comments)
    for d in sorted(dirs - listed):
        problems.append(f"dossier pas encore dans la fiche : {d}/ (lance tree)")
    for d in sorted(listed - dirs):
        problems.append(f"dossier qui n'existe plus : {d}/ (lance tree)")
    for d in sorted(listed & dirs):
        if not comments[d] or comments[d] == TODO_DIR:
            problems.append(f"dossier pas encore expliqué : {d}/")
    if not problems and current != drawn:
        problems.append("l'arbre n'est pas dessiné comme le script le dessine (lance tree)")
    print("architecture=ok" if not problems else "architecture=stale")
    for p in problems:
        print(f"  {p}")
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
