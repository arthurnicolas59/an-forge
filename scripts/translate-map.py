#!/usr/bin/env python3
"""Traduit en français les textes de l'interface de la carte générée par le skill visual.

Le skill visual est une copie d'un projet anglophone (voir super-board.lock) : on ne le modifie
pas, on traduit la page après coup. Chaque texte à remplacer doit exister dans la page, sinon le
script échoue : une mise à jour du skill qui change un texte se voit tout de suite.

Usage : scripts/translate-map.py docs/skill-map/index.html
"""
import sys

REMPLACEMENTS = [
    ('<html lang="en">', '<html lang="fr">'),
    # Barre du haut
    ("Find a node or view…", "Chercher…"),
    ("Search nodes and views (${modK})", "Chercher une carte ou une vue (${modK})"),
    ('placeholder="Search nodes and views" aria-label="Search nodes and views"', 'placeholder="Chercher une carte ou une vue" aria-label="Chercher une carte ou une vue"'),
    ('aria-label="Search"', 'aria-label="Recherche"'),
    ('title="Views (O)" aria-label="Toggle the views list"', 'title="Vues (O)" aria-label="Afficher la liste des vues"'),
    ('aria-label="Breadcrumb"', 'aria-label="Fil d\'Ariane"'),
    ('title="Light / dark" aria-label="Toggle theme"', 'title="Clair / sombre" aria-label="Changer de thème"'),
    ("Export ▾", "Exporter ▾"),
    ("SVG · this view", "SVG · cette vue"),
    ("PNG · this view (2×)", "PNG · cette vue (2×)"),
    ("Copy link to view", "Copier le lien de la vue"),
    ("Map model (JSON)", "Données de la carte (JSON)"),
    ('title="Pause" aria-label="Pause"', 'title="Pause" aria-label="Pause"'),
    ("'Play' : 'Pause'", "'Lecture' : 'Pause'"),
    ('title="Keys (?)" aria-label="Keyboard shortcuts"', 'title="Raccourcis (?)" aria-label="Raccourcis clavier"'),
    ('aria-label="Views"></aside>', 'aria-label="Vues"></aside>'),
    # Barre de zoom
    ('title="Overview — click or drag to move"', 'title="Aperçu : clique ou glisse pour te déplacer"'),
    ('title="Up one level (Esc)" aria-label="Up one level"', 'title="Niveau au-dessus (Échap)" aria-label="Niveau au-dessus"'),
    ('title="Zoom out (−)" aria-label="Zoom out"', 'title="Dézoomer (−)" aria-label="Dézoomer"'),
    ('title="Fit to screen (0)"', 'title="Ajuster à l\'écran (0)"'),
    ('title="Zoom in (+)" aria-label="Zoom in"', 'title="Zoomer (+)" aria-label="Zoomer"'),
    ('title="Actual size (1)"', 'title="Taille réelle (1)"'),
    ('title="Animate flow direction (F)" aria-label="Animate flow"', 'title="Animer le sens des flèches (F)" aria-label="Animer les flèches"'),
    ('title="Reading depth follows zoom">READ<', 'title="Le niveau de détail suit le zoom">LIRE<'),
    ('aria-label="Node details"', 'aria-label="Détail de la carte"'),
    # Aide en bas de la carte
    ("<span>pinch = zoom</span><span>drag = move</span><span>tap = details</span>", "<span>pincer = zoom</span><span>glisser = déplacer</span><span>toucher = détail</span>"),
    ("<span>scroll = zoom</span><span>drag = move</span><span>double-click ⤢ = open</span><span>${modK} = search</span><span>? = keys</span>",
     "<span>molette = zoom</span><span>glisser = déplacer</span><span>double-clic ⤢ = ouvrir</span><span>${modK} = chercher</span><span>? = raccourcis</span>"),
    # Fenêtre des raccourcis
    ('aria-label="Keys" hidden><b>Keys</b>', 'aria-label="Raccourcis" hidden><b>Raccourcis</b>'),
    ("<dd>search nodes and views</dd>", "<dd>chercher une carte ou une vue</dd>"),
    ("<dt>/ or ${modK}</dt>", "<dt>/ ou ${modK}</dt>"),
    ("<dt>Scroll · pinch</dt><dd>zoom (two-finger drag pans)</dd>", "<dt>Molette · pincer</dt><dd>zoom (deux doigts pour se déplacer)</dd>"),
    ("<dt>Click</dt><dd>details below the map</dd>", "<dt>Clic</dt><dd>détail sous la carte</dd>"),
    ("<dt>Double-click · Enter</dt><dd>open a stacked node ⤢</dd>", "<dt>Double-clic · Entrée</dt><dd>ouvrir une carte empilée ⤢</dd>"),
    ("<dt>Esc · Backspace</dt><dd>close, then up one level</dd>", "<dt>Échap · Retour arrière</dt><dd>fermer, puis remonter d'un niveau</dd>"),
    ("<dd>zoom in, out, fit, 100%</dd>", "<dd>zoomer, dézoomer, ajuster, 100 %</dd>"),
    ("<dt>← ↑ → ↓</dt><dd>pan</dd>", "<dt>← ↑ → ↓</dt><dd>se déplacer</dd>"),
    ("<dd>previous / next details tab</dd>", "<dd>onglet précédent / suivant</dd>"),
    ("<dt>i</dt><dd>about this view</dd>", "<dt>i</dt><dd>à propos de cette vue</dd>"),
    ("<dt>O</dt><dd>views list</dd>", "<dt>O</dt><dd>liste des vues</dd>"),
    ("<dd>flow on/off</dd>", "<dd>animation des flèches</dd>"),
    # Recherche
    ("<span>↑↓ move</span><span>↵ open</span><span>esc close</span>", "<span>↑↓ choisir</span><span>↵ ouvrir</span><span>échap fermer</span>"),
    ("<h4>Nothing called “", "<h4>Rien ne s'appelle « "),
    ("${esc(q.value.trim())}”</h4>", "${esc(q.value.trim())} »</h4>"),
    ("Did you mean <button", "Tu voulais dire <button"),
    ("'Try a skill, verb, script or view name.'", "'Essaie un nom de skill, de script ou de vue.'"),
    ("!qs ? 'Views' : h.t === 'n' ? 'Nodes' : 'Views'", "!qs ? 'Vues' : h.t === 'n' ? 'Cartes' : 'Vues'"),
    ("${here ? 'this view' : esc(vs.map(v => shortT(v.title || v.id)).slice(0, 2).join(', ') || 'no view')}",
     "${here ? 'cette vue' : esc(vs.map(v => shortT(v.title || v.id)).slice(0, 2).join(', ') || 'aucune vue')}"),
    # Vue
    ("title=\"About this view (i)\"", "title=\"À propos de cette vue (i)\""),
    ("(v.stepIds || v.nodeIds || []).length + ' steps' : seq ? ve.length + ' steps' : geo.nodes.length + ' nodes'",
     "(v.stepIds || v.nodeIds || []).length + ' étapes' : seq ? ve.length + ' étapes' : geo.nodes.length + ' cartes'"),
    ("${geo.nodes.length} nodes · ${geo.edges.length} wires${views.length > 1 ? ` · level ${chain(cur).length} of ${depth}` : ''}",
     "${geo.nodes.length} cartes · ${geo.edges.length} flèches${views.length > 1 ? ` · niveau ${chain(cur).length} sur ${depth}` : ''}"),
    ("{ head: 'Map', items: roots", "{ head: 'Carte', items: roots"),
    ("<h4>Nothing here yet</h4><p>This view has no nodes. Add them to the map model and run /visual again.</p>",
     "<h4>Rien ici pour l'instant</h4><p>Cette vue n'a aucune carte. Ajoute-en dans map.json puis relance scripts/build-maps.sh.</p>"),
    ("← Back to", "← Retour à"),
    # Légende
    ("'Public skill', 'you run it'", "'Skill public', 'tu le lances'"),
    ("'Board lane', 'the board starts it'", "'Couloir du tableau', 'le tableau le lance'"),
    ("'External skill', 'from another pack'", "'Skill externe', 'vient d\\'un autre projet'"),
    ("'Impeccable verb', 'a design command'", "'Verbe', 'une commande'"),
    ("'Script', 'code a skill runs'", "'Script', 'du code qu\\'un skill lance'"),
    ("'Hook / guard', 'fires on its own'", "'Garde', 'se déclenche seul'"),
    ("'State', 'board, config, ledgers'", "'État', 'tableau, config, journaux'"),
    ("'Process step', 'open for implementation details'", "'Étape', 'à ouvrir pour le détail'"),
    ("<b>⤢ Stacked</b><span>double-click to open</span>", "<b>⤢ Empilée</b><span>double-clic pour ouvrir</span>"),
    ("<b>Step</b><span>run order</span>", "<b>Étape</b><span>ordre d’exécution</span>"),
    ("<b>@author</b><span>who wrote it</span>", "<b>@auteur</b><span>qui l’a écrit</span>"),
    ("<b>loops back</b><span>the one line that runs right to left</span>", "<b>retour</b><span>la seule flèche qui va de droite à gauche</span>"),
    ("['calls', 'calls', 'runs or invokes it'], ['feeds', 'feeds', 'hands work on'], ['triggers', 'triggers', 'suggests, offers, fires'], ['state', 'state', 'reads or writes a file, board, config'], ['guard', 'guard', 'a hook steps in']",
     "['calls', 'appelle', 'le lance'], ['feeds', 'alimente', 'passe le travail'], ['triggers', 'déclenche', 'propose ou lance'], ['state', 'état', 'lit ou écrit un fichier, une config'], ['guard', 'garde', 'une garde intervient']"),
    ("<span>LEGEND</span>", "<span>LÉGENDE</span>"),
    ("${legendFolded ? 'Show' : 'Hide'} legend", "${legendFolded ? 'Afficher' : 'Masquer'} la légende"),
    # Panneau de détail
    ("? 'PUBLIC' : ext ? 'EXTERNAL' : 'INTERNAL'", "? 'PUBLIC' : ext ? 'EXTERNE' : 'INTERNE'"),
    ("n.k === 'm-public' ? 'PUBLIC' : n.k === 'm-ext' ? 'EXTERNAL' : n.k === 'm-lane' ? 'LANE' : ''", "n.k === 'm-public' ? 'PUBLIC' : n.k === 'm-ext' ? 'EXTERNE' : n.k === 'm-lane' ? 'COULOIR' : ''"),
    ("· author unknown", "· auteur inconnu"),
    ("['when', 'When to use'], ['what', 'What it is'], ['how', 'How it works']", "['when', 'Quand l\\'utiliser'], ['what', 'Ce que c\\'est'], ['how', 'Comment ça marche']"),
    ("['examples', 'Example']] : []), ['links', 'Behind the scenes']", "['examples', 'Exemple']] : []), ['links', 'En coulisses']"),
    ("text('When to use', n.when", "text('Quand l\\'utiliser', n.when"),
    ("text('What it is', n.what", "text('Ce que c\\'est', n.what"),
    ("text('How it works', n.how", "text('Comment ça marche', n.how"),
    ("Not written yet — add <code>${key}</code> to this node in the map model.", "Pas encore écrit : ajoute <code>${key}</code> à cette carte dans map.json."),
    ("<h4>Example</h4>", "<h4>Exemple</h4>"),
    ("<h4>← Comes from</h4>", "<h4>← Vient de</h4>"),
    ("<h4>→ Leads to</h4>", "<h4>→ Mène à</h4>"),
    ("<h4>Source files</h4>", "<h4>Fichiers sources</h4>"),
    ("Also shown in", "Aussi présente dans"),
    ("'Nothing calls this here' : 'Calls nothing here'", "'Rien ne l\\'appelle ici' : 'N\\'appelle rien ici'"),
    ("No source listed", "Aucune source indiquée"),
    ('title="Open ${esc(sb ? srcLabel(s) : base + s)}"', 'title="Ouvrir ${esc(sb ? srcLabel(s) : base + s)}"'),
    ('title="Copy path" aria-label="Copy path"', 'title="Copier le chemin" aria-label="Copier le chemin"'),
    ("⤢ Open ${esc(shortT(V[child].title || child))} <span>${(V[child].nodeIds || []).length} nodes · Enter</span>",
     "⤢ Ouvrir ${esc(shortT(V[child].title || child))} <span>${(V[child].nodeIds || []).length} cartes · Entrée</span>"),
    ('title="Close (Esc)" aria-label="Close details"', 'title="Fermer (Échap)" aria-label="Fermer le détail"'),
    ('aria-label="Details">${tabs', 'aria-label="Détail">${tabs'),
    ('title="Previous ([)" aria-label="Previous tab"', 'title="Précédent ([)" aria-label="Onglet précédent"'),
    ('title="Next (])" aria-label="Next tab"', 'title="Suivant (])" aria-label="Onglet suivant"'),
    ("data-more>Show all<", "data-more>Tout afficher<"),
    ("Open live page ↗", "Ouvrir la page ↗"),
    ("(stage.dataset.depth || 'read').toUpperCase()", "({ map: 'vue', read: 'lire', full: 'détail' }[stage.dataset.depth || 'read']).toUpperCase()"),
    # Messages
    ("status('Link copied')", "status('Lien copié')"),
    ("status('Path copied')", "status('Chemin copié')"),
    ("status('Already at the top')", "status('Déjà tout en haut')"),
    ("status('No inner view for this node')", "status('Cette carte n\\'a pas de vue intérieure')"),
]

def main(chemin):
    page = open(chemin, encoding="utf-8").read()
    manque = [a for a, _ in REMPLACEMENTS if a not in page]
    if manque:
        for a in manque:
            print(f"TRADUCTION : texte introuvable dans la page : {a[:90]}")
        sys.exit(1)
    for a, b in REMPLACEMENTS:
        page = page.replace(a, b)
    open(chemin, "w", encoding="utf-8").write(page)
    print(f"Traduction : {len(REMPLACEMENTS)} textes passés en français.")

if __name__ == "__main__":
    main(sys.argv[1])
