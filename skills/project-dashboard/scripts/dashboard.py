#!/usr/bin/env python3
"""Le tableau de bord du projet : une page HTML autonome, recalculée à chaque fois.

Les faits sont lus à la source, jamais recopiés à la main : l'avancement des tickets (GitHub, ou les
fichiers .scratch/ d'un projet sans GitHub), les décisions (docs/adr/), le lexique (GLOSSARY.md), les
dernières livraisons. Seule la description du projet (résumé, schéma d'architecture, stack) est écrite
par l'agent, dans description.json, et le script dit quand elle n'est plus à jour par rapport à AGENTS.md
et ARCHITECTURE.md.

La page et description.json sont rangés dans .an-forge/dashboard/ à la racine du projet : propres à
cette machine, jamais commités.

Usage :
  dashboard.py status                 où en est la description : description=missing|stale|ok,
                                      puis tracker=github|local|none et output=<dossier>
  dashboard.py stamp                  note dans description.json les versions d'AGENTS.md et d'ARCHITECTURE.md
                                      qu'elle décrit
  dashboard.py render [--open]        fabrique index.html (et l'ouvre dans le navigateur avec --open)
      [--from-json <fichier>]         lit les tickets dans ce fichier au lieu de GitHub (tests)
      [--out <dossier>]               écrit ailleurs que dans .an-forge/dashboard/

Codes : 0 ok · 1 description.json invalide (les erreurs sont listées) · 2 erreur d'outil (git, gh)
"""
import datetime
import hashlib
import html
import json
import re
import subprocess
import sys
import webbrowser
from pathlib import Path

OUT_DIR = ".an-forge/dashboard"
TRACKER_DOC = "docs/agents/issue-tracker.md"
MAX_BOXES = 6
LIMITS = {"nom": 60, "resume": 320, "pour_qui": 160, "box_nom": 28, "box_detail": 48, "lien": 16,
          "couche": 24, "techno": 40, "role": 90}
ICONES = ["user", "screen", "phone", "server", "database", "cloud", "lock", "mail", "card", "box", "gear", "chart"]

# ---------------------------------------------------------------------------
# Outils


def run(*args, cwd=None, ok_fail=False):
    res = subprocess.run(list(args), cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        if ok_fail:
            return None
        print(f"{' '.join(args[:3])}… a échoué : {res.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    return res.stdout


def project_root():
    """La racine du checkout principal, même lancé depuis le worktree d'un ticket."""
    common = run("git", "rev-parse", "--path-format=absolute", "--git-common-dir", ok_fail=True)
    if common is None:
        print("Pas de repo git ici : lance ce script depuis le projet.", file=sys.stderr)
        sys.exit(2)
    return Path(common.strip()).parent


def exclude_output(root):
    """Range .an-forge/ hors de git, sans toucher au .gitignore du projet."""
    common = Path(run("git", "rev-parse", "--path-format=absolute", "--git-common-dir", cwd=root).strip())
    exclude = common / "info" / "exclude"
    exclude.parent.mkdir(parents=True, exist_ok=True)
    lines = exclude.read_text(encoding="utf-8").splitlines() if exclude.exists() else []
    if "/.an-forge/" not in lines:
        with exclude.open("a", encoding="utf-8") as f:
            f.write("/.an-forge/\n")


def agents_hash(root):
    """L'empreinte des fichiers que la présentation résume : AGENTS.md et, s'il existe, ARCHITECTURE.md."""
    h = hashlib.sha256()
    for name in ("AGENTS.md", "ARCHITECTURE.md"):
        p = root / name
        if p.exists():
            h.update(name.encode() + b"\0" + p.read_bytes())
    return h.hexdigest()[:16]


def esc(text):
    return html.escape(str(text), quote=True)


MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"]


def date_fr(iso):
    try:
        d = datetime.date.fromisoformat(iso[:10])
    except (TypeError, ValueError):
        return ""
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


# ---------------------------------------------------------------------------
# La description du projet, écrite par l'agent


def load_description(path):
    if not path.exists():
        return None, []
    errors = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return None, [f"description.json n'est pas du JSON valide : {e}"]
    if not isinstance(data, dict):
        return None, ["description.json : un objet est attendu"]

    def text(obj, key, limit, where="", required=True):
        v = obj.get(key) if isinstance(obj, dict) else None
        if v is None or (isinstance(v, str) and not v.strip()):
            if required:
                errors.append(f"{where}{key} : manquant ou vide")
            return ""
        if not isinstance(v, str):
            errors.append(f"{where}{key} : du texte est attendu")
            return ""
        if len(v.strip()) > limit:
            errors.append(f"{where}{key} : {len(v.strip())} caractères, {limit} au maximum")
        return v.strip()

    text(data, "nom", LIMITS["nom"])
    text(data, "resume", LIMITS["resume"])
    text(data, "pour_qui", LIMITS["pour_qui"], required=False)
    boxes = data.get("architecture") or []
    if not isinstance(boxes, list):
        boxes = []
    if not 2 <= len(boxes) <= MAX_BOXES:
        errors.append(f"architecture : une liste de 2 à {MAX_BOXES} boîtes, de gauche à droite")
    for i, b in enumerate(boxes):
        text(b, "nom", LIMITS["box_nom"], f"architecture[{i}].")
        text(b, "detail", LIMITS["box_detail"], f"architecture[{i}].", required=False)
        icone = b.get("icone") if isinstance(b, dict) else None
        if icone is not None and icone not in ICONES:
            errors.append(f"architecture[{i}].icone : « {icone} » inconnue, au choix : {', '.join(ICONES)}")
    liens = data.get("liens") or []
    if liens and (not isinstance(liens, list) or len(liens) != max(len(boxes) - 1, 0)):
        errors.append("liens : un texte par flèche entre deux boîtes (une de moins que les boîtes), ou rien")
    else:
        for i, l in enumerate(liens):
            if not isinstance(l, str) or len(l) > LIMITS["lien"]:
                errors.append(f"liens[{i}] : un texte de {LIMITS['lien']} caractères au maximum")
    stack = data.get("stack") or []
    if not isinstance(stack, list) or len(stack) > 12:
        errors.append("stack : une liste de 12 lignes au maximum")
        stack = []
    for i, s in enumerate(stack):
        text(s, "couche", LIMITS["couche"], f"stack[{i}].")
        text(s, "techno", LIMITS["techno"], f"stack[{i}].")
        text(s, "role", LIMITS["role"], f"stack[{i}].")
    return data, errors


# ---------------------------------------------------------------------------
# Les tickets

# L'état d'un ticket, du plus urgent pour toi au moins urgent.
ETATS = {
    "question": ("Une question t'attend", "warn"),
    "stopped": ("Arrêté, à regarder", "bad"),
    "review": ("PR à relire", "info"),
    "building": ("En construction", "info"),
    "ready": ("Prêt à construire", "ok-soft"),
    "waiting": ("Attend un autre ticket", "muted"),
    "draft": ("Pas encore prêt", "muted"),
    "done": ("Terminé", "ok"),
}
ORDRE = list(ETATS)


def blockers_in_body(body):
    out, inside = [], False
    for line in (body or "").splitlines():
        if re.match(r"^\s*#*\s*\**\s*blocked by\b", line, re.I):
            inside = True
            out += [int(n) for n in re.findall(r"#?(\d+)", line.split(":", 1)[-1])]
            continue
        if not inside:
            continue
        if re.match(r"^\s*#{1,6}\s", line) or re.match(r"^\s*\*\*[^*]+:\*\*", line):
            break
        out += [int(n) for n in re.findall(r"#(\d+)", line)]
    return sorted(set(out))


def branch_taken(root, n):
    out = run("git", "for-each-ref", "--format=%(refname)", f"refs/heads/ticket/{n}-*",
              f"refs/remotes/origin/ticket/{n}-*", cwd=root, ok_fail=True)
    return bool(out and out.strip())


def ticket_state(t, open_prs, open_numbers, root):
    labels = set(t.get("labels", []))
    if t["closed"]:
        return "done"
    if any(head.startswith(f"ticket/{t['number']}-") for head in open_prs):
        return "review"
    if "needs-info" in labels:
        return "question"
    if "ready-for-human" in labels:
        return "stopped"
    if t.get("assigned") or branch_taken(root, t["number"]):
        return "building"
    if any(b in open_numbers for b in t.get("blocked_by", [])):
        return "waiting"
    if "ready-for-agent" in labels:
        return "ready"
    return "draft"


def from_github(root, from_json=None):
    if from_json:
        repo = json.loads(Path(from_json).read_text(encoding="utf-8"))
    else:
        name = run("gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner", cwd=root).strip()
        owner, repo_name = name.split("/", 1)
        fields = ("number title url state body labels(first:20){nodes{name}} assignees(first:1){totalCount} "
                  "blockedBy(first:20){nodes{number state}}")
        query = f"""query($o:String!,$r:String!){{repository(owner:$o,name:$r){{
openIssues: issues(states:OPEN,first:100,orderBy:{{field:CREATED_AT,direction:ASC}}){{nodes{{{fields}
  parent{{number}} subIssuesSummary{{total completed}} subIssues(first:60){{nodes{{{fields}}}}}}}}}
closedIssues: issues(states:CLOSED,last:60,orderBy:{{field:CREATED_AT,direction:ASC}}){{nodes{{{fields}
  parent{{number}} subIssuesSummary{{total completed}}}}}}
openPRs: pullRequests(states:OPEN,first:60){{nodes{{number title url headRefName isDraft}}}}
mergedPRs: pullRequests(states:MERGED,last:6,orderBy:{{field:UPDATED_AT,direction:ASC}}){{nodes{{number title url mergedAt headRefName}}}}
}}}}"""
        out = run("gh", "api", "graphql", "-f", f"query={query}", "-f", f"o={owner}", "-f", f"r={repo_name}", cwd=root)
        repo = json.loads(out)["data"]["repository"]

    def ticket(node):
        blocked = [b["number"] for b in (node.get("blockedBy") or {}).get("nodes", [])]
        blocked += blockers_in_body(node.get("body"))
        return {
            "number": node["number"], "title": node["title"], "url": node.get("url", ""),
            "closed": node.get("state") == "CLOSED",
            "labels": [l["name"] for l in (node.get("labels") or {}).get("nodes", [])],
            "assigned": (node.get("assignees") or {}).get("totalCount", 0) > 0,
            "blocked_by": sorted(set(blocked)),
        }

    specs, loose = [], []
    seen = set()
    for node in repo.get("openIssues", {}).get("nodes", []):
        summary = node.get("subIssuesSummary") or {}
        if summary.get("total", 0) > 0:
            subs = [ticket(s) for s in (node.get("subIssues") or {}).get("nodes", [])]
            seen.update(s["number"] for s in subs)
            specs.append({"number": node["number"], "title": node["title"], "url": node.get("url", ""),
                          "closed": False, "tickets": subs})
    for node in repo.get("openIssues", {}).get("nodes", []):
        summary = node.get("subIssuesSummary") or {}
        if summary.get("total", 0) == 0 and not node.get("parent") and node["number"] not in seen:
            loose.append(ticket(node))
    closed_specs = []
    for node in repo.get("closedIssues", {}).get("nodes", []):
        summary = node.get("subIssuesSummary") or {}
        if summary.get("total", 0) > 0:
            closed_specs.append({"number": node["number"], "title": node["title"], "url": node.get("url", ""),
                                 "closed": True, "total": summary.get("total", 0)})
        elif not node.get("parent") and "ready-for-agent" in [l["name"] for l in (node.get("labels") or {}).get("nodes", [])]:
            loose.append(ticket(node))
    open_prs = [p["headRefName"] for p in repo.get("openPRs", {}).get("nodes", [])]
    pr_by_ticket = {}
    for p in repo.get("openPRs", {}).get("nodes", []):
        m = re.match(r"ticket/(\d+)-", p["headRefName"])
        if m:
            pr_by_ticket[int(m.group(1))] = p
    merged = list(reversed(repo.get("mergedPRs", {}).get("nodes", [])))
    return specs, closed_specs, loose, open_prs, pr_by_ticket, merged


def from_local(root):
    """Les fichiers .scratch/<spec>/spec.md et .scratch/<spec>/issues/NN-*.md d'un projet sans GitHub."""
    specs = []
    scratch = root / ".scratch"
    for d in sorted(p for p in scratch.glob("*") if p.is_dir()):
        spec_file = d / "spec.md"
        title = d.name
        if spec_file.exists():
            m = re.search(r"^#\s+(.+)$", spec_file.read_text(encoding="utf-8"), re.M)
            title = m.group(1).strip() if m else d.name
        tickets = []
        for f in sorted((d / "issues").glob("*.md")):
            text = f.read_text(encoding="utf-8")
            n = int(re.match(r"(\d+)", f.name).group(1)) if re.match(r"\d+", f.name) else 0
            m = re.search(r"^#\s+(.+)$", text, re.M)
            status = (re.search(r"^\**Status:?\**:?\s*(.+)$", text, re.M | re.I) or [None, ""])[1].strip().lower()
            blocked = re.search(r"^\**Blocked by:?\**:?\s*(.+)$", text, re.M | re.I)
            labels = [s for s in ("needs-info", "ready-for-human", "ready-for-agent") if s in status]
            tickets.append({
                "number": n, "title": m.group(1).strip() if m else f.stem, "url": "",
                "closed": any(w in status for w in ("done", "closed", "resolved", "terminé", "fermé")),
                "labels": labels, "assigned": "claimed" in status or "en cours" in status,
                "blocked_by": [int(x) for x in re.findall(r"\d+", blocked.group(1))] if blocked else [],
            })
        specs.append({"number": None, "title": title, "url": "", "closed": False, "tickets": tickets, "local": True})
    return specs, [], [], [], {}, []


def tracker_kind(root):
    doc = root / TRACKER_DOC
    if doc.exists() and re.search(r"local markdown|\.scratch", doc.read_text(encoding="utf-8"), re.I):
        return "local"
    if run("git", "remote", "get-url", "origin", cwd=root, ok_fail=True):
        return "github"
    return "none"


# ---------------------------------------------------------------------------
# Les décisions et le lexique


def decisions(root):
    out = []
    for f in sorted(root.glob("docs/adr/*.md")) + sorted(root.glob("src/**/docs/adr/*.md")):
        text = f.read_text(encoding="utf-8")
        m = re.search(r"^#\s+(.+)$", text, re.M)
        status = re.search(r"^status:\s*(.+)$", text, re.M | re.I)
        num = re.match(r"(\d+)", f.name)
        added = run("git", "log", "--diff-filter=A", "--format=%as", "-1", "--", str(f.relative_to(root)),
                    cwd=root, ok_fail=True)
        body = re.sub(r"^---.*?---\s*", "", text, flags=re.S)
        body = re.sub(r"^#.*$", "", body, flags=re.M).strip().split("\n\n")[0]
        out.append({
            "num": int(num.group(1)) if num else 0,
            "title": m.group(1).strip() if m else f.stem,
            "status": status.group(1).strip() if status else "",
            "date": (added or "").strip(),
            "summary": re.sub(r"\s+", " ", re.sub(r"[*_`]", "", body))[:220],
            "path": str(f.relative_to(root)),
        })
    out.sort(key=lambda d: d["num"], reverse=True)
    return out


def glossary(root):
    f = root / "GLOSSARY.md"
    if not f.exists():
        return []
    terms, lines = [], f.read_text(encoding="utf-8").splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"^\*\*(.+?)\*\*\s*:?\s*(.*)$", line.strip())
        if not m:
            continue
        definition = m.group(2).strip()
        j = i + 1
        while not definition and j < len(lines) and not lines[j].strip().startswith("**"):
            definition = lines[j].strip()
            j += 1
        if definition.startswith("_Avoid_"):
            definition = ""
        terms.append((m.group(1).rstrip(":"), re.sub(r"[*_`]", "", definition)))
    return terms


# ---------------------------------------------------------------------------
# La page

ICON_SVG = {
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    "screen": '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 8h18M9 21h6M12 17v4"/>',
    "phone": '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    "server": '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    "database": '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    "cloud": '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    "card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    "box": '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    "gear": '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    "check": '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "flag": '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    "list": '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
}


def icon(name, size=22):
    return (f'<svg class="ic" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON_SVG.get(name, ICON_SVG["box"])}</svg>')


def pill(state):
    label, tone = ETATS[state]
    return f'<span class="pill {tone}">{esc(label)}</span>'


def link(text, url):
    return f'<a href="{esc(url)}">{esc(text)}</a>' if url else esc(text)


def num(t):
    return f"#{t['number']}" if t.get("number") else ""


CSS = """
:root{color-scheme:dark;--bg:#0f1115;--card:#171a21;--ink:#e8eaee;--muted:#9aa2ae;--line:#2a2f3a;--soft:#1f232c;
--ok:#4ade80;--ok-bg:#12301d;--info:#93c5fd;--info-bg:#172a4a;--warn:#fcd34d;--warn-bg:#3a2e0f;
--bad:#fca5a5;--bad-bg:#3d1717;--mut:#a7afbb;--mut-bg:#232833;--accent:#a5b4fc;
--b1:#c7d2fe;--b2:#bbf7d0;--b3:#fde68a;--b4:#f5d0fe;--b5:#bae6fd;--b6:#fed7aa}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:1080px;margin:0 auto;padding:32px 20px 64px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header h1{font-size:30px;margin:0 0 4px;letter-spacing:-.02em}.sub{color:var(--muted);margin:0}
.resume{font-size:17px;margin:14px 0 4px;max-width:760px}
.meta{display:flex;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:13px;margin-top:10px}
section{margin-top:34px}h2{font-size:19px;margin:0 0 12px;display:flex;align-items:center;gap:8px}
h2 .ic{color:var(--accent)}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.stat{display:flex;gap:12px;align-items:center}.stat b{display:block;font-size:28px;line-height:1.1}
.stat span{color:var(--muted);font-size:13px}.stat .ic{flex:none;padding:8px;border-radius:10px;width:40px;height:40px}
.s-ok .ic{color:var(--ok);background:var(--ok-bg)}.s-info .ic{color:var(--info);background:var(--info-bg)}
.s-warn .ic{color:var(--warn);background:var(--warn-bg)}.s-mut .ic{color:var(--mut);background:var(--mut-bg)}
.ring{--p:0;width:64px;height:64px;border-radius:50%;flex:none;display:grid;place-items:center;
background:conic-gradient(var(--ok) calc(var(--p)*1%),var(--soft) 0)}
.ring i{width:48px;height:48px;border-radius:50%;background:var(--card);display:grid;place-items:center;
font-style:normal;font-weight:700;font-size:14px}
.next{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.next div{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:var(--soft)}
.next .ic{color:var(--accent);flex:none;margin-top:1px}code{background:var(--soft);padding:1px 6px;border-radius:6px;font-size:13px}
.next code{background:var(--card)}
.archi{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding:4px 2px 8px}
.box{flex:1 1 0;min-width:120px;border-radius:14px;padding:16px 12px;text-align:center;color:#16181d;
display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1px solid rgba(0,0,0,.08)}
.box b{font-size:15px}.box small{font-size:12px;opacity:.75}
.arrow{flex:0 0 74px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);font-size:11px;gap:2px}
.arrow svg{width:64px;height:14px}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:var(--muted);font-weight:600;font-size:12px;
text-transform:uppercase;letter-spacing:.04em}th,td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}td.n{color:var(--muted);white-space:nowrap;width:56px}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.pill.ok{color:var(--ok);background:var(--ok-bg)}.pill.ok-soft{color:var(--ok);background:transparent;border:1px solid var(--ok-bg)}
.pill.info{color:var(--info);background:var(--info-bg)}.pill.warn{color:var(--warn);background:var(--warn-bg)}
.pill.bad{color:var(--bad);background:var(--bad-bg)}.pill.muted{color:var(--mut);background:var(--mut-bg)}
.spec{margin-bottom:14px}.spec-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap}
.spec-head h3{margin:0;font-size:16px}.bar{height:8px;border-radius:99px;background:var(--soft);overflow:hidden;margin:4px 0 10px}
.bar i{display:block;height:100%;background:var(--ok);border-radius:99px}.count{color:var(--muted);font-size:13px}
.done-specs{display:flex;flex-wrap:wrap;gap:8px}.chip{background:var(--soft);border-radius:999px;padding:4px 12px;font-size:13px}
.adr{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.adr .card{padding:14px}.adr h3{margin:0 0 4px;font-size:15px}.adr p{margin:4px 0 0;color:var(--muted);font-size:13.5px}
.adr .top{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:12px}
.terms{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.terms div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.terms b{display:block}.terms span{color:var(--muted);font-size:13px}
.empty{color:var(--muted);font-style:italic}
.two{display:grid;grid-template-columns:1.3fr 1fr;gap:16px}
footer{margin-top:40px;color:var(--muted);font-size:12.5px;border-top:1px solid var(--line);padding-top:14px}
@media (max-width:760px){.stats{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}
.archi{flex-direction:column}.arrow{flex-basis:44px}.arrow svg{transform:rotate(90deg)}}
"""

BOX_COLORS = ["var(--b1)", "var(--b2)", "var(--b3)", "var(--b4)", "var(--b5)", "var(--b6)"]


def next_steps(all_tickets, pr_by_ticket, has_specs):
    by = {s: [t for t in all_tickets if t["state"] == s] for s in ETATS}
    steps = []
    for t in by["question"][:2]:
        steps.append(("flag", f"Réponds à la question posée sur le ticket {link(num(t) + ' ' + t['title'], t['url'])}, "
                              f"puis relance <code>/build-ticket {t['number']}</code>."))
    for t in by["review"][:2]:
        pr = pr_by_ticket.get(t["number"])
        prl = link(f"la PR #{pr['number']}", pr["url"]) if pr else "sa PR"
        steps.append(("check", f"Lis le brief de {prl} ({esc(t['title'])}), puis dis « merge la PR » ou ce qu'il faut changer."))
    for t in by["stopped"][:2]:
        steps.append(("flag", f"Le ticket {link(num(t) + ' ' + t['title'], t['url'])} s'est arrêté : son dernier "
                              f"commentaire dit pourquoi. Relance <code>/build-ticket {t['number']}</code> une fois réglé."))
    if by["ready"] and not by["building"]:
        t = by["ready"][0]
        steps.append(("clock", f"Construis le prochain ticket : <code>/build-ticket</code> prendra "
                               f"{link(num(t) + ' ' + t['title'], t['url'])}, dans une session neuve."))
    if not steps and by["building"]:
        steps.append(("clock", "Un ticket est en construction : attends son brief."))
    if not steps:
        steps.append(("list", "Tout est fait. Pour la suite : <code>/project-launch</code> pour une nouvelle idée, "
                              "<code>/quick-ticket</code> pour une petite demande." if has_specs or all_tickets else
                      "Aucun ticket pour l'instant : lance <code>/project-launch</code> pour cadrer ton idée, "
                      "ou <code>/quick-ticket</code> pour une petite demande."))
    return steps[:4]


def render_page(root, desc, desc_state, kind, data, adrs, terms):
    specs, closed_specs, loose, open_prs, pr_by_ticket, merged = data
    open_numbers = {t["number"] for s in specs for t in s["tickets"] if not t["closed"]}
    open_numbers |= {t["number"] for t in loose if not t["closed"]}
    for group in [s["tickets"] for s in specs] + [loose]:
        for t in group:
            t["state"] = ticket_state(t, open_prs, open_numbers, root)
            t["pr"] = pr_by_ticket.get(t["number"])
    all_t = [t for s in specs for t in s["tickets"]] + loose
    total = len(all_t)
    done = sum(t["state"] == "done" for t in all_t)
    moving = sum(t["state"] in ("building", "review") for t in all_t)
    attention = sum(t["state"] in ("question", "stopped") for t in all_t)
    todo = total - done - moving - attention
    pct = round(100 * done / total) if total else 0

    nom = (desc or {}).get("nom") or root.name
    today = datetime.date.today().isoformat()
    p = []
    p.append(f'<header><h1>{esc(nom)}</h1><p class="sub">Tableau de bord du projet</p>')
    if desc:
        p.append(f'<p class="resume">{esc(desc.get("resume", ""))}</p>')
        if desc.get("pour_qui"):
            p.append(f'<p class="sub">Pour qui : {esc(desc["pour_qui"])}</p>')
    else:
        p.append('<p class="resume empty">La présentation du projet n\'est pas encore écrite : '
                 'relance <code>/project-dashboard</code> pour que l\'agent la rédige.</p>')
    meta = [f"Mis à jour le {date_fr(today)}"]
    meta.append({"github": "Tickets lus sur GitHub", "local": "Tickets lus dans .scratch/",
                 "none": "Pas de tickets : le projet n'est relié à aucun outil de suivi"}[kind])
    if desc_state == "stale":
        meta.append("⚠ La présentation date d'avant le dernier changement d'AGENTS.md")
    p.append('<div class="meta">' + "".join(f"<span>{esc(m)}</span>" for m in meta) + "</div></header>")

    # Avancement
    p.append(f'<section><h2>{icon("chart")}Où en est le projet</h2><div class="stats">')
    p.append(f'<div class="card stat"><div class="ring" style="--p:{pct}"><i>{pct}%</i></div>'
             f'<div><b>{done}/{total}</b><span>tickets terminés</span></div></div>')
    for n, label, ic, tone in ((moving, "en construction ou à relire", "clock", "s-info"),
                               (attention, "attendent ta réponse", "flag", "s-warn"),
                               (todo, "à faire", "list", "s-mut")):
        p.append(f'<div class="card stat {tone}">{icon(ic)}<div><b>{n}</b><span>{label}</span></div></div>')
    p.append("</div>")
    p.append(f'<div class="card" style="margin-top:12px"><b>À faire maintenant</b><div class="next">')
    for ic, text in next_steps(all_t, pr_by_ticket, bool(specs or closed_specs)):
        p.append(f"<div>{icon(ic, 18)}<span>{text}</span></div>")
    p.append("</div></div></section>")

    # Specs et tickets
    if specs or loose or closed_specs:
        p.append(f'<section><h2>{icon("list")}Les tickets, spec par spec</h2>')
        for s in specs:
            n_done = sum(t["state"] == "done" for t in s["tickets"])
            n = len(s["tickets"])
            title = (f"Spec {num(s)} · " if s.get("number") else "") + s["title"]
            p.append(f'<div class="card spec"><div class="spec-head"><h3>{link(title, s["url"])}</h3>'
                     f'<span class="count">{n_done} sur {n} terminés</span></div>'
                     f'<div class="bar"><i style="width:{round(100 * n_done / n) if n else 0}%"></i></div>')
            p.append(tickets_table(s["tickets"]))
            p.append("</div>")
        if loose:
            open_loose = [t for t in loose if t["state"] != "done"]
            p.append('<div class="card spec"><div class="spec-head"><h3>Petites demandes</h3>'
                     f'<span class="count">{len(open_loose)} ouverte{"s" if len(open_loose) > 1 else ""}</span></div>')
            p.append(tickets_table(sorted(loose, key=lambda t: (t["state"] == "done", t["number"]))[:12]))
            p.append("</div>")
        if closed_specs:
            p.append('<div class="card"><b>Specs terminées</b><div class="done-specs" style="margin-top:8px">')
            for s in closed_specs[-12:]:
                p.append(f'<span class="chip">✓ {link(num(s) + " " + s["title"], s["url"])}</span>')
            p.append("</div></div>")
        p.append("</section>")

    # Architecture et stack
    p.append(f'<section><h2>{icon("server")}Comment le projet est construit</h2>')
    if desc and desc.get("architecture"):
        boxes = desc["architecture"]
        liens = desc.get("liens") or [""] * (len(boxes) - 1)
        p.append('<div class="card"><div class="archi">')
        for i, b in enumerate(boxes):
            if i:
                p.append('<div class="arrow"><span>' + esc(liens[i - 1]) + '</span><svg viewBox="0 0 64 14" fill="none" '
                         'stroke="currentColor" stroke-width="1.6"><path d="M2 7h60M8 2 2 7l6 5M56 2l6 5-6 5"/></svg></div>')
            p.append(f'<div class="box" style="background:{BOX_COLORS[i % len(BOX_COLORS)]}">'
                     f'{icon(b.get("icone") or "box", 28)}<b>{esc(b["nom"])}</b>'
                     + (f'<small>{esc(b["detail"])}</small>' if b.get("detail") else "") + "</div>")
        p.append("</div></div>")
    if desc and desc.get("stack"):
        p.append('<div class="card" style="margin-top:12px"><table><tr><th>Partie</th><th>Technologie</th><th>À quoi ça sert</th></tr>')
        for s in desc["stack"]:
            p.append(f'<tr><td><b>{esc(s["couche"])}</b></td><td>{esc(s["techno"])}</td><td>{esc(s["role"])}</td></tr>')
        p.append("</table></div>")
    if not desc:
        p.append('<p class="empty">Pas encore décrit.</p>')
    p.append("</section>")

    # Livraisons, décisions, lexique
    p.append('<section class="two">')
    p.append(f'<div><h2>{icon("flag")}Les décisions prises</h2>')
    if adrs:
        p.append('<div class="adr" style="grid-template-columns:1fr">')
        for d in adrs[:8]:
            top = f"Décision {d['num']:04d}" + (f" · {date_fr(d['date'])}" if d["date"] else "")
            st = f'<span class="pill muted">{esc(d["status"])}</span>' if d["status"] else ""
            p.append(f'<div class="card"><div class="top"><span>{esc(top)}</span>{st}</div>'
                     f'<h3>{esc(d["title"])}</h3><p>{esc(d["summary"])}</p></div>')
        if len(adrs) > 8:
            p.append(f'<p class="sub">… et {len(adrs) - 8} plus anciennes, dans <code>docs/adr/</code>.</p>')
        p.append("</div>")
    else:
        p.append('<p class="empty">Aucune décision notée pour l\'instant. Elles apparaissent ici quand '
                 '<code>/project-launch</code> en enregistre dans <code>docs/adr/</code>.</p>')
    p.append("</div>")
    p.append(f'<div><h2>{icon("check")}Dernières livraisons</h2>')
    if merged:
        p.append('<div class="card"><table>')
        for pr in merged:
            p.append(f'<tr><td class="n">#{pr["number"]}</td><td>{link(pr["title"], pr.get("url", ""))}</td>'
                     f'<td class="n">{esc(date_fr(pr.get("mergedAt", "")))}</td></tr>')
        p.append("</table></div>")
    else:
        p.append('<p class="empty">Rien de livré pour l\'instant.</p>')
    p.append("</div></section>")

    p.append(f'<section><h2>{icon("box")}Le vocabulaire du projet</h2>')
    if terms:
        p.append('<div class="terms">' + "".join(
            f"<div><b>{esc(t)}</b><span>{esc(d[:140])}</span></div>" for t, d in terms[:40]) + "</div>")
    else:
        p.append('<p class="empty">Pas encore de lexique : il se remplit pendant les questions de '
                 '<code>/project-launch</code>, dans <code>GLOSSARY.md</code>.</p>')
    p.append("</section>")

    p.append("<footer>Page fabriquée par <code>/project-dashboard</code> (an-forge). Les chiffres sont recalculés "
             "à chaque fois à partir des tickets, de <code>docs/adr/</code> et de <code>GLOSSARY.md</code> : "
             "rien n'y est recopié à la main.</footer>")
    return ("<!DOCTYPE html>\n<html lang=\"fr\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            f"<title>{esc(nom)} · tableau de bord</title><style>{CSS}</style></head>"
            f"<body><main>{''.join(p)}</main></body></html>\n")


def tickets_table(tickets):
    if not tickets:
        return '<p class="empty">Aucun ticket.</p>'
    rows = ['<table><tr><th>N°</th><th>Ticket</th><th>État</th></tr>']
    for t in sorted(tickets, key=lambda t: (t["number"] or 0)):
        extra = ""
        if t["state"] == "review" and t.get("pr"):
            extra = f' · {link("PR #" + str(t["pr"]["number"]), t["pr"].get("url", ""))}'
        elif t["state"] == "waiting":
            extra = " · attend " + ", ".join(f"#{b}" for b in t["blocked_by"])
        rows.append(f'<tr><td class="n">{esc(num(t))}</td><td>{link(t["title"], t["url"])}'
                    f'<span class="count">{extra}</span></td><td>{pill(t["state"])}</td></tr>')
    rows.append("</table>")
    return "".join(rows)


# ---------------------------------------------------------------------------


def main(argv):
    if not argv or argv[0] not in ("status", "stamp", "render"):
        print(__doc__.split("Usage :")[1], file=sys.stderr)
        return 2
    cmd, args = argv[0], argv[1:]
    root = project_root()
    out = root / OUT_DIR
    if "--out" in args:
        out = Path(args[args.index("--out") + 1]).resolve()
    desc_path = out / "description.json"
    desc, errors = load_description(desc_path)
    current = agents_hash(root)
    state = "missing" if desc is None and not errors else ("ok" if desc and desc.get("agents_md") == current else "stale")

    if cmd == "status":
        print(f"description={state}")
        print(f"tracker={tracker_kind(root)}")
        print(f"output={out}")
        for e in errors:
            print(f"  erreur : {e}")
        return 1 if errors else 0

    if errors:
        print("description.json refusée :", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    if cmd == "stamp":
        if desc is None:
            print(f"Pas de {desc_path} : écris-la d'abord.", file=sys.stderr)
            return 1
        desc["agents_md"] = current
        desc_path.write_text(json.dumps(desc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"description=ok ({desc_path})")
        return 0

    from_json = args[args.index("--from-json") + 1] if "--from-json" in args else None
    kind = "github" if from_json else tracker_kind(root)
    if kind == "github":
        data = from_github(root, from_json)
    elif kind == "local":
        data = from_local(root)
    else:
        data = ([], [], [], [], {}, [])
    out.mkdir(parents=True, exist_ok=True)
    if out.is_relative_to(root):
        exclude_output(root)
    page = render_page(root, desc, state, kind, data, decisions(root), glossary(root))
    index = out / "index.html"
    index.write_text(page, encoding="utf-8")
    print(f"dashboard={index}")
    print(f"description={state}")
    if "--open" in args:
        webbrowser.open(index.as_uri())
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
