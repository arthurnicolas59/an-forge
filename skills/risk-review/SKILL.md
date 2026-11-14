---
name: risk-review
description: Fait chercher par un agent neuf les bugs, les failles de sécurité et les risques pour les données dans les changements depuis un point fixe (commit, branche, tag), puis donne un niveau de risque. Utilise quand l'utilisateur veut savoir si un changement est sûr, cherche des bugs ou des failles dans une branche ou une PR, ou quand build-ticket l'appelle.
---

# Risk review

Cherche ce qui peut **mal se passer** dans un changement : un bug, une faille, une perte de données. Le skill `code-review` répond à deux autres questions (le code suit-il les règles du projet ? fait-il ce que le ticket demande ?). Celui-ci ne les refait pas.

La relecture est confiée à **un agent neuf**, qui ne voit que le diff, le ticket et les règles du projet, pas le raisonnement de celui qui a écrit le code. C'est ce qui la rend indépendante : on ne relit pas bien sa propre copie.

## 1. Fixer le point de départ

Le point fixe est ce que l'utilisateur a donné (un commit, une branche, un tag, `origin/main`). S'il n'en a pas donné, demande-le.

Vérifie qu'il existe (`git rev-parse <point>`) et que le diff n'est pas vide : `git diff <point>...HEAD` (trois points : la comparaison part de l'ancêtre commun). Note aussi la liste des commits : `git log <point>..HEAD --oneline`.

## 2. Rassembler le contexte

- **Le ticket ou la spec**, s'il y en a : les numéros cités dans les commits (`#12`), ou ce que l'utilisateur a donné. Lis-le selon `docs/agents/issue-tracker.md` s'il existe.
- **Les règles du projet** : `AGENTS.md`, et les ADR qui touchent la zone modifiée.

## 3. Lancer l'agent neuf

Lance un sous-agent avec un contexte vide. Donne-lui la commande du diff, la liste des commits, le ticket, les chemins des règles, et le brief ci-dessous, **copié en entier** : il n'a accès à rien d'autre.

Si ton outil ne sait pas lancer de sous-agent, ne fais pas la relecture toi-même si tu as écrit le code : demande à l'utilisateur de lancer `risk-review` dans une nouvelle session.

<brief>

Tu relis un changement que tu n'as pas écrit. Ton travail : trouver ce qui peut mal se passer une fois ce code en service. Lis le diff, puis ouvre les fichiers autour pour comprendre comment le code modifié est appelé. Tu ne modifies rien.

Cherche dans ces quatre familles :

1. **Bugs** : un cas oublié (valeur vide, zéro, négatif, très grand, doublon, caractères spéciaux), une erreur avalée ou mal traitée, une condition inversée, un décalage d'une unité, un état incohérent si une étape échoue au milieu, deux actions en même temps, un fuseau horaire ou un arrondi d'argent.
2. **Sécurité** : une page ou une action accessible sans être connecté ou sans en avoir le droit, la donnée d'un utilisateur visible par un autre, une entrée de l'utilisateur utilisée sans contrôle (requête à la base, commande, HTML, chemin de fichier, adresse appelée par le serveur), un secret écrit dans le code ou dans un journal, une dépendance ajoutée sans nécessité.
3. **Données** : une suppression ou une modification qui ne peut pas être annulée, une migration qui casse les données existantes ou qui ne peut pas revenir en arrière, un changement de format qui rend les anciennes données illisibles.
4. **Tests** : un test existant supprimé, affaibli ou désactivé ; un test qui passe toujours parce qu'il recalcule le résultat comme le fait le code ; un comportement important du ticket qu'aucun test ne vérifie.

Règles :

- Ne garde un constat que si tu peux décrire **un scénario concret** : telle entrée ou telle situation, tel mauvais résultat. Pas de « pourrait poser problème ».
- Vérifie chaque constat dans le code avant de le rendre. Si tu n'es pas sûr, dis-le dans le constat.
- Ne parle ni du style, ni du nommage, ni de ce qui manque par rapport au ticket : d'autres relecteurs s'en chargent.
- Ne remonte pas ce que les outils du projet attrapent déjà (types, lint).

Rends, en moins de 500 mots :

**Constats**, du plus grave au moins grave. Pour chacun :
- la gravité : `bloquant` (perte de données, faille, fonction principale cassée), `à corriger` (bug réel dans un cas plausible) ou `à noter` (cas rare, effet limité) ;
- le fichier et la ligne ;
- le scénario : ce qui se passe, et ce qui devrait se passer.

S'il n'y a rien, écris « Aucun constat ».

**Risque** : une seule ligne, `Risque : faible`, `Risque : moyen` ou `Risque : élevé`, puis une phrase qui dit pourquoi, avec des mots de tous les jours, et si le changement est facile à annuler.
- `faible` : un ajout isolé, rien d'existant ne change, facile à retirer.
- `moyen` : du comportement existant change, ou des données sont modifiées ou supprimées, ou un accès, une connexion ou un paiement est touché.
- `élevé` : un constat `bloquant` reste, ou une erreur ne pourrait pas être annulée (données perdues, migration sans retour).

**À vérifier soi-même** : une ou deux choses qu'un humain devrait essayer de ses mains, parce que la lecture du code ne suffit pas à trancher. Écris-les comme un geste à faire : « Créez un compte, déconnectez-vous, puis ouvrez l'adresse de votre profil. »

</brief>

## 4. Rendre le rapport

Rends le rapport de l'agent tel quel, sous les titres `## Constats`, `## Risque` et `## À vérifier soi-même`. Ne retire aucun constat et ne change pas le niveau de risque, même s'il te semble sévère : tu peux dire que tu n'es pas d'accord, à côté, avec ta raison.

Si des constats ont été corrigés depuis, relance le skill pour obtenir un niveau de risque à jour plutôt que de le recalculer toi-même.
