<p align="center">
  <strong>Nonead DSH Desktop · Journal des modifications</strong><br>
  <sub><a href="CHANGELOG.md">中文</a> · <a href="CHANGELOG.en.md">English</a> · <a href="CHANGELOG.ja.md">日本語</a> · <a href="CHANGELOG.es.md">Español</a> · Français · <a href="CHANGELOG.de.md">Deutsch</a> · <a href="CHANGELOG.ru.md">Русский</a> · <a href="CHANGELOG.pt.md">Português</a></sub>
</p>

# Journal des modifications

Ce fichier consigne les changements de Nonead DSH Desktop visibles par l’utilisateur. Chaque version élève de concert le numéro de version dans les deux espaces de travail de bureau (`nonead-dsh-desktop` et `dsh-plugin-desktop-beta`) ; ce numéro apparaît aussi dans le nom des fichiers d’installation, dans la réponse du point d’accès de mise à jour et dans l’association de l’URL de téléchargement directe, et les trois doivent concorder.

Conventions de maintenance :

- Chaque version ajoute une entrée par langue (`CHANGELOG.md`, `CHANGELOG.en.md` et les versions ja/es/fr/de/ru/pt) et rafraîchit les hachages de blob Git enregistrés dans `CHANGELOG.i18n.yaml`, sans quoi `corepack yarn check:bilingual-docs` échoue.
- Les entrées ne décrivent que les changements perceptibles par l’utilisateur et les changements de limite que les responsables de maintenance doivent connaître ; les refactorisations pures ne font pas l’objet d’une entrée.
- L’historique plus ancien se trouve dans les étiquettes Git (`v1.7.3`, `v2.0.7`, `v2.0.8`, `v2.1.3`, `v2.1.4`, `v2.1.5`) et dans le journal des commits.

## 2.2.10 — 2026-11-12

Runtime porté à DSH 0.2.2-rc.2, avec adaptation des changements incompatibles du nouveau noyau :

- Runtime : DeepSeek Harness embarqué passe de 0.2.2-rc.1 à **0.2.2-rc.2** (commit amont `ddac96760`, 374 paquets re-vendored, 24 correctifs de bureau rebasés). `dsh-experimental-agent-team` devient `@deepseek-ai/dsh-agent-team` ; des paquets comme `dsh-error` deviennent des dépendances peer que l'application déclare explicitement.
- Pont : le pont Agents Anywhere reste sur la ligne 2.1.0, dont la plage peer précède rc.2 ; activer le contrôle à distance écrit une exemption de version exacte dans `compatibility.json` du profil, et le pont continue de se charger.
- Plugins inclus : `@deepseek-ai/dsh-tool-subagent` passe à 0.2.2-rc.2 pour suivre la chaîne de dépendances du runtime ; le lot passe de 35 à **27** : `@linxin666/dsh-client-ui-skill-explorer`, `@weibaohui/skills-management`, `dsh-image-gen`, `dsh-nonead-ursim`, `dsh-nonead-universal-robots`, `dsh-superagent`, `dsh-univer-office` et `dshmarket` quittent le lot fourni (le marché de plugins reste intégré à l’installateur à sa version épinglée, il n’est simplement plus préinstallé), et sept autres suivent npm latest ; la liste complète figure plus bas.
- Documentation : les README en huit langues et `THIRD_PARTY_NOTICES` suivent les nouvelles données de version.
- Version : produit 2.2.9 → **2.2.10** (les deux espaces de travail de bureau).

### Liste des plugins fournis (27)

Ces 27 plugins sont livrés avec l’installateur ; après le premier démarrage, activez, désactivez ou supprimez-les depuis la page Plugins. Le nombre après chaque nom est la version fournie.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Mémoire automatique. Rappelle l’historique et les décisions arrêtées avant une tâche.
- `@changfenhuang/dsh-genui` 0.16.0 — Interface générative. Affiche dans la réponse des mises en page et des graphiques.
- `@deepseek-ai/dsh-tool-subagent` 0.2.2-rc.2 — Délégation de sous-agents. Confie une tâche isolée au moteur d’exécution de son choix.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Graphe Git. Change de branche et affiche l’historique des commits.
- `@linxin666/dsh-client-ui-task-board` 0.4.16 — Tableau des tâches. Exécute les cartes en sessions réelles, avec planification cron.
- `@michengai/dsh-agency-agents` 1.2.27 — Bibliothèque d’experts. 331 agents spécialisés et cinq équipes invocables.
- `@michengai/dsh-archive-manager` 1.3.1 — Archivage des sessions. Archive, restaure ou supprime définitivement une session.
- `@michengai/dsh-code-review` 1.0.10 — Revue de code. Un sous-agent indépendant inspecte le code et rend un rapport.
- `@michengai/dsh-skills-manager` 1.4.1 — Gestionnaire de compétences. Charge et gère les compétences locales en sécurité.
- `@tt-a1i/archify-dsh` 1.1.0 — Diagrammes d’architecture. Génère un schéma d’architecture depuis une description.
- `@wenaixi/dsh-superpower` 8.0.0 — Compétences d’ingénierie. Quinze savoir-faire d’ingénierie activables séparément.
- `@yolk_vat-y/dsh-project-memory` 0.6.12 — Mémoire de projet. Indexe documents et symboles, puis répond avec des sources.
- `billion-context` 0.1.213 — Compression du contexte. Résume les longs échanges pour libérer de la place.
- `dsh-better-sidebar` 0.30.1 — Barre latérale enrichie. Fichiers, éditeur, modifications et tâches en une colonne.
- `dsh-client-auto-continue` 0.18.0 — Reprise automatique. Relance la requête après une coupure involontaire.
- `dsh-config-manager` 0.8.0 — Gestion de configuration. Sauvegarde, restaure et synchronise la configuration DSH.
- `dsh-context` 0.83.1 — Analyse du contexte. Montre la composition du contexte et le compresse au besoin.
- `dsh-cost-meter` 1.9.64 — Suivi des coûts. Compte les jetons et les dépenses de la session et de l’historique.
- `dsh-excel-chat` 0.43.0 — Dialogue sur tableur. Modifie les feuilles en langage naturel et vérifie les formules.
- `dsh-find-plugins` 0.3.0 — Découverte de plugins. Cherche dans cinq catalogues, GitHub et npm en direct.
- `dsh-github-skills` 0.2.1 — Compétences GitHub. Flux de travail GitHub pour plusieurs fournisseurs.
- `dsh-markitdown` 0.2.2 — Conversion en Markdown. Transforme documents et pages web en texte lisible.
- `dsh-mcp-connector` 0.2.101 — Connecteur MCP. Gère les connexions et recherche les outils disponibles.
- `dsh-nonead-prompt-recall` 0.8.7 — Historique de saisie. Rappelle l’instruction précédente avec la flèche haut.
- `dsh-nonead-prompt-rewind` 0.5.4 — Retour arrière. Revient à un message antérieur et restaure les fichiers modifiés.
- `dsh-ppt-master` 6.1.0 — Présentations. Produit des PPTX modifiables et enrichit les diaporamas existants.
- `dsh-remotion` 0.10.5 — Atelier vidéo. Transforme un projet React en vidéo, avec aperçu et export MP4.

## 2.2.9 — 2026-11-10

Le runtime passe à DSH 0.2.2-rc.1, l’ensemble des plugins fournis atteint 35 et l’assistant d’installation présente les choses autrement :

- Runtime : le DeepSeek Harness fourni passe de 0.2.2-alpha.3 à **0.2.2-rc.1** (commit amont `66491b0`, avec la famille cordis promue en 4.1.0 et schemastery 3.19.0). `vendor/dsh-runtime/0.2.2-rc.1` est reconstruit depuis le code amont local en 373 paquets, avec exactement le même ensemble de paquets que la version précédente ; les 24 correctifs de bureau sont tous rebasés sur les nouveaux artefacts, les `resolutions` racine et les dépendances DSH des deux espaces de travail de bureau pointent vers la nouvelle version, et `yarn check:vendored-runtime` passe sur les deux canaux.
- Assistant d’installation : à l’étape « prêt à l’emploi », la liste complète des plugins n’est plus affichée d’emblée ; seules les grandes catégories expliquent ce que ce lot de plugins préinstallés permet de faire. Une fois l’installation lancée, chaque plugin affiche à son tour son nom, sa version, sa catégorie et sa description complète, et remercie son auteur — « Merci à X pour ce plugin ».
- Plugins fournis : le lot passe de 30 à **35** et accueille `@changfenhuang/dsh-genui`, `@deepseek-ai/dsh-tool-subagent`, `@linxin666/dsh-client-ui-task-board`, `@weibaohui/skills-management`, `billion-context`, `dsh-client-auto-continue`, `dsh-cost-meter`, `dsh-markitdown`, `dsh-nonead-prompt-rewind`, `dshmarket` ; `dsh-api-client`, `dsh-design`, `dsh-doc-reader`, `dsh-rewind-plugin`, `@kenz1117/dsh-ui-usage-billing` quittent le lot fourni.
- Mise à jour des plugins : `dsh-ppt-master` 1.0.8 → 6.1.0, `dsh-config-manager` 0.3.1 → 0.6.0, `@michengai/dsh-skills-manager` 1.2.28 → 1.4.0, `dsh-better-sidebar` 0.28.2 → 0.30.1, `dsh-context` 0.80.3 → 0.83.0, les autres suivent npm latest.
- Manifeste des plugins : `plugin/manifest.json` passe en v4 ; chaque entrée porte désormais une catégorie et un auteur, ce qui pilote le regroupement et les remerciements de l’assistant d’installation.
- Version : produit 2.2.6 → **2.2.9** (les deux espaces de travail de bureau avancent ensemble).
- Avertissement au démarrage : un Profile qui n'active pas le contrôle à distance n'écrit plus la ligne du pont dans sa couche cordis, donc `patch: entry "agents-anywhere-bridge-next" not found` n'apparaît plus à chaque démarrage ; les Profile qui l'activent conservent la ligne précédente, y compris les redirections de l'installation packagée.
- Extensions fournies : `dsh-nonead-ursim` passe à **0.3.15** avec une description orientée simulation (elle était auparavant identique octet pour octet à l'extension robot réel `dsh-nonead-universal-robots`, ce qui invitait à l'installer pour du matériel).
- Pont intégré : le pont Agents Anywhere passe à la branche **2.1.0** (tag `v2.1.0`). AA impose de mettre le plugin à jour en même temps qu'une montée MINOR de Desktop/Connector, sinon la connexion locale reste en attente. L'artefact reste la variante desktop compilée localement, avec le correctif de robustesse du connecteur réappliqué sur 2.1.0.
- Mises à jour : `@michengai/dsh-archive-manager` 1.3.1, `dsh-config-manager` 0.7.0, `dsh-context` 0.83.1, `dshmarket` 1.73.17.

### Liste des plugins fournis (35)

Ces 35 plugins sont livrés avec l’installateur ; après le premier démarrage, activez, désactivez ou supprimez-les depuis la page Plugins. Le nombre après chaque nom est la version fournie.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Mémoire automatique. Rappelle l’historique et les décisions arrêtées avant une tâche.
- `@changfenhuang/dsh-genui` 0.16.0 — Interface générative. Affiche dans la réponse des mises en page et des graphiques.
- `@deepseek-ai/dsh-tool-subagent` 0.2.2-rc.1 — Délégation de sous-agents. Confie une tâche isolée au moteur d’exécution de son choix.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Graphe Git. Change de branche et affiche l’historique des commits.
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.16 — Centre des compétences. Parcourt, active ou supprime les compétences chargées.
- `@linxin666/dsh-client-ui-task-board` 0.4.16 — Tableau des tâches. Exécute les cartes en sessions réelles, avec planification cron.
- `@michengai/dsh-agency-agents` 1.2.27 — Bibliothèque d’experts. 331 agents spécialisés et cinq équipes invocables.
- `@michengai/dsh-archive-manager` 1.3.1 — Archivage des sessions. Archive, restaure ou supprime définitivement une session.
- `@michengai/dsh-code-review` 1.0.9 — Revue de code. Un sous-agent indépendant inspecte le code et rend un rapport.
- `@michengai/dsh-skills-manager` 1.4.0 — Gestionnaire de compétences. Charge et gère les compétences locales en sécurité.
- `@tt-a1i/archify-dsh` 1.1.0 — Diagrammes d’architecture. Génère un schéma d’architecture depuis une description.
- `@weibaohui/skills-management` 0.9.3 — Marché de compétences. Gère les compétences locales et un catalogue de 6600 entrées.
- `@wenaixi/dsh-superpower` 8.0.0 — Compétences d’ingénierie. Quinze savoir-faire d’ingénierie activables séparément.
- `@yolk_vat-y/dsh-project-memory` 0.6.12 — Mémoire de projet. Indexe documents et symboles, puis répond avec des sources.
- `billion-context` 0.1.213 — Compression du contexte. Résume les longs échanges pour libérer de la place.
- `dsh-better-sidebar` 0.30.1 — Barre latérale enrichie. Fichiers, éditeur, modifications et tâches en une colonne.
- `dsh-client-auto-continue` 0.17.4 — Reprise automatique. Relance la requête après une coupure involontaire.
- `dsh-config-manager` 0.7.0 — Gestion de configuration. Sauvegarde, restaure et synchronise la configuration DSH.
- `dsh-context` 0.83.1 — Analyse du contexte. Montre la composition du contexte et le compresse au besoin.
- `dsh-cost-meter` 1.9.62 — Suivi des coûts. Compte les jetons et les dépenses de la session et de l’historique.
- `dsh-excel-chat` 0.43.0 — Dialogue sur tableur. Modifie les feuilles en langage naturel et vérifie les formules.
- `dsh-find-plugins` 0.3.0 — Découverte de plugins. Cherche dans cinq catalogues, GitHub et npm en direct.
- `dsh-github-skills` 0.2.1 — Compétences GitHub. Flux de travail GitHub pour plusieurs fournisseurs.
- `dsh-image-gen` 0.11.1 — Génération d’images. Crée et retouche des images via plusieurs fournisseurs.
- `dsh-markitdown` 0.2.2 — Conversion en Markdown. Transforme documents et pages web en texte lisible.
- `dsh-mcp-connector` 0.2.97 — Connecteur MCP. Gère les connexions et recherche les outils disponibles.
- `dsh-nonead-prompt-recall` 0.8.7 — Historique de saisie. Rappelle l’instruction précédente avec la flèche haut.
- `dsh-nonead-prompt-rewind` 0.5.4 — Retour arrière. Revient à un message antérieur et restaure les fichiers modifiés.
- `dsh-nonead-universal-robots` 0.8.6 — Bras UR. Pilote les bras Universal Robots en langage naturel.
- `dsh-nonead-ursim` 0.3.15 — Simulation UR. Valide les trajectoires hors ligne avant de bouger le bras réel.
- `dsh-ppt-master` 6.1.0 — Présentations. Produit des PPTX modifiables et enrichit les diaporamas existants.
- `dsh-remotion` 0.10.5 — Atelier vidéo. Transforme un projet React en vidéo, avec aperçu et export MP4.
- `dsh-superagent` 0.1.0 — Prototype d’agent proactif. Transforme des demandes autorisées en tickets exécutés.
- `dsh-univer-office` 0.4.0 — Intégration Office. Tableurs, documents et présentations prévisualisables dans DSH.
- `dshmarket` 1.73.17 — Marché de plugins. Parcourt, recherche et installe des plugins communautaires.

## 2.2.6 — 2026-11-03

Le runtime passe à DSH 0.2.2-alpha.3 et l'ensemble des plugins fournis atteint 30 :

- Runtime : le DeepSeek Harness fourni passe de 0.2.2-alpha.2 à **0.2.2-alpha.3** (commit amont `05b1cae`, avec la mise à jour vendor cordis 4.0.6-alpha.2 et cosmokit 1.8.7-alpha.2). `vendor/dsh-runtime/0.2.2-alpha.3` est reconstruit depuis le code amont local en 373 paquets, et les `resolutions` racine comme les deux espaces de travail de bureau pointent vers la nouvelle version ; `yarn check:vendored-runtime` passe sur les deux canaux.
- Nouveau plugin : `dsh-superagent` 0.1.0 (prototype de recherche DeepSeek : surveille GitHub et Feishu, transforme les demandes autorisées en tickets exécutés dans leurs propres sessions, et un panneau web regroupe ce qui demande une personne ; construit depuis `deepseek-ai/dsh-superagent-prototype` avec sa chaîne de compilation officielle).
- Mise à jour des plugins : `dsh-remotion` passe à 0.10.4 et `dsh-design` remplace `dsh-design-skills`, non publié ; `@michengai/dsh-agency-agents` 1.2.23, `@michengai/dsh-archive-manager` 1.2.0, `@michengai/dsh-code-review` 1.0.7, `@michengai/dsh-skills-manager` 1.2.28, `dsh-config-manager` 0.3.1, `dsh-context` 0.80.3 et `dsh-rewind-plugin` 0.19.2 suivent npm latest.
- Marché fourni : `dshmarket` passe à 1.73.9.
- Outillage : le nouveau `yarn plugins:update` met à jour toutes les archives de `plugin/` vers npm latest et reconstruit le manifeste.
- Version : produit 2.2.5 → **2.2.6** (les deux espaces de travail de bureau avancent ensemble).

### Liste des plugins fournis (30)

Ces 30 plugins sont livrés avec l'installateur ; après le premier démarrage, activez, désactivez ou supprimez-les depuis la page Plugins. Le nombre après chaque nom est la version fournie.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Mémoire automatique. Injecte le travail passé pertinent et les décisions déjà arrêtées avant le début d'une tâche, sans avoir à le demander ; le contexte accumulé reste sur cette machine et demeure consultable d'une session à l'autre.
- `@kenz1117/dsh-ui-usage-billing` 1.8.1 — Tableau de bord d'usage et de coût. Regroupe les indicateurs de consommation et le détail des dépenses dans la barre latérale pour vérifier le coût à tout moment.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Graphe des branches Git. Affiche l'historique des commits et le flux des branches, et permet de changer de branche depuis une session vide sans revenir au terminal.
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.14 — Centre des compétences. Parcourt les compétences chargées par origine, indique ce que fait chacune et précise quel composant fournit une capacité donnée.
- `@michengai/dsh-agency-agents` 1.2.23 — Bibliothèque d'experts. 331 agents spécialisés invocables en ingénierie, design, marketing, juridique et plus encore ; lorsqu'un jugement de domaine est nécessaire, l'expert adéquat est invoqué plutôt que de laisser la session principale l'approximer.
- `@michengai/dsh-archive-manager` 1.2.0 — Archivage des sessions. Archive, restaure, met en favori et supprime définitivement des sessions, et diagnostique les journaux de session corrompus, afin que le nettoyage courant ne fasse pas perdre des enregistrements encore utiles.
- `@michengai/dsh-code-review` 1.0.7 — Revue de code. Un flux de revue de style Codex exécuté par un sous-agent natif indépendant, avec un périmètre de revue librement choisi (modifications, plage de commits ou dépôt entier).
- `@michengai/dsh-skills-manager` 1.2.28 — Gestionnaire de compétences. Charge en un seul endroit les compétences d'agent locales et les gère en sécurité, avec l'origine et l'état d'activation sous les yeux.
- `@tt-a1i/archify-dsh` 1.0.0 — Diagrammes d'architecture. Transforme la structure d'un système ou un processus métier en diagrammes interactifs d'architecture, de flux, de séquence, de flux de données et d'états.
- `@wenaixi/dsh-superpower` 8.0.0 — Paquet de compétences d'ingénierie. Quinze compétences d'ingénierie superpowers, utilisables en chinois et en anglais.
- `@yolk_vat-y/dsh-project-memory` 0.6.9 — Mémoire de projet. Indexe les documents (PDF, Markdown) et les symboles de code pour que les questions ultérieures soient résolues par recherche plutôt que par relecture.
- `dsh-api-client` 0.2.0 — Débogage d'API. Envoie des requêtes HTTP et affiche les réponses dans l'éditeur, pour le travail d'intégration d'interfaces.
- `dsh-better-sidebar` 0.28.2 — Une meilleure barre latérale. Réunit arborescence, éditeur, modifications, tâches et discussion latérale en une seule colonne, indépendante par session ; elle expose aussi aux autres plugins un service d'enregistrement d'onglets latéraux et de visionneuses de fichiers.
- `dsh-config-manager` 0.3.1 — Gestionnaire de configuration. Sauvegarde, restauration, export, import, migration et synchronisation de la configuration DSH, pour transférer l'environnement vers une autre machine ou après une réinstallation.
- `dsh-context` 0.80.3 — Observation et gestion du contexte. Affiche l'occupation actuelle du contexte et compresse lorsqu'elle approche de la limite.
- `dsh-design` 0.2.0 — Compétences de design system. Contraint les choix de design et utilise `design_audit` pour mesurer l'échelle typographique, le contraste, les espacements et la dérive de palette sur les pages rendues.
- `dsh-doc-reader` 0.2.0 — Lecteur de documents. Extrait le texte de PDF, Word et formats similaires afin que le modèle lise le document et non son seul nom de fichier.
- `dsh-excel-chat` 0.43.0 — Discussion sur tableur. Manipule des feuilles Excel en langage naturel sans mémoriser de fonctions ni de coordonnées de cellules.
- `dsh-find-plugins` 0.3.0 — Recherche de plugins. Cherche des plugins dans cinq catalogues communautaires et effectue des recherches en direct sur GitHub et npm.
- `dsh-github-skills` 0.2.1 — Compétences de flux de travail GitHub. Adaptées des compétences GitHub d'OpenAI Codex.
- `dsh-image-gen` 0.10.2 — Génération d'images. Se connecte à Gemini, OpenAI et fournisseurs similaires pour créer et retoucher des images.
- `dsh-mcp-connector` 0.2.93 — Connecteur MCP. Connecte des services MCP et fournit une recherche et une invocation unifiées des outils entre eux.
- `dsh-nonead-prompt-recall` 0.8.4 — Historique de saisie. Appuyez sur ↑ dans une zone de saisie vide pour rappeler l'instruction précédente.
- `dsh-nonead-universal-robots` 0.8.5 — Bras robotiques UR. Pilote directement les bras Universal Robots en langage naturel, sans écrire de scripts à la main.
- `dsh-nonead-ursim` 0.3.13 — Simulation UR. Programme le mouvement du bras dans un simulateur hors ligne, pour valider une trajectoire avant de toucher du matériel réel.
- `dsh-ppt-master` 1.0.8 — Génération de présentations. Produit des diaporamas à partir du contenu fourni.
- `dsh-remotion` 0.10.4 — Production vidéo. Rendu de vidéo depuis un projet React au sein de DSH.
- `dsh-rewind-plugin` 0.19.2 — Retour arrière de la conversation. Remonte la conversation dans la même fenêtre et restaure avec elle les fichiers de l'espace de travail.
- `dsh-superagent` 0.1.0 — Prototype de super-agent. Surveille GitHub et Feishu, transforme les demandes autorisées en tickets exécutés dans des sessions séparées, et un panneau web regroupe ce qui demande une personne (prototype de recherche DeepSeek, pas un produit officiel).
- `dsh-univer-office` 0.4.0 — Documents Office. Intégration de DSH et Univer pour les tableurs, documents et présentations.

## 2.2.4 — 2026-10-31

Mise à jour de version sans changement fonctionnel :

- Version : produit 2.2.3 → **2.2.4** (les deux espaces de travail de bureau sont synchronisés).

## 2.2.3 — 2026-10-29

La coque de bureau est désormais localisée en huit langues (chinois simplifié, anglais, japonais, espagnol, français, allemand, russe et portugais du Brésil) :

- Textes de la coque : des dictionnaires espagnol, français, allemand, russe et portugais du Brésil sont ajoutés, 209 entrées chacun aux côtés des langues existantes ; les boîtes de dialogue natives, le panneau des autorisations, Computer Use, la page des paramètres, les contrôles de plugins et le libellé du mode terminal passent tous par `desktopText`, et les menus natifs ainsi que la langue d’interface enregistrée suivent le même ensemble de huit langues.
- Page des paramètres : des dictionnaires de paramètres en six langues (125 entrées chacun) couvrent les sections partagées — marché de plugins, contrôle à distance, fenêtre, navigateur et réseau local, notifications — au lieu de retomber sur l’anglais.
- Textes interpolés : onze boîtes de dialogue (suppression et changement de Profil, activation/désactivation/désinstallation de plugin, répertoire de données et état de mise à jour) consultent désormais des gabarits `{name}` et substituent la valeur, si bien qu’elles ne retombent plus sur l’anglais dans six langues.
- Processus de rendu : les textes de retour de la récupération ont été sortis du module qui importe les modules intégrés de Node, si bien que la compilation native-ui n’émet plus d’avertissements d’externalisation de `node:fs`/`node:path`/`node:crypto`.
- Limite : l’assistant de récupération et le sélecteur de Profil proviennent de l’espace de travail partagé `dsh-plugin-desktop-beta` et restent en chinois et en anglais uniquement.
- Version : le produit passe de 2.2.2 à **2.2.3** dans les deux espaces de travail de bureau.
- Documentation : le README et le CHANGELOG sont désormais aussi publiés en japonais, espagnol, français, allemand, russe et portugais du Brésil ; la porte bilingue accepte désormais des enregistrements multilingues (au moins deux documents par enregistrement).


## 2.2.2 — 2026-10-28

Le runtime passe à DSH `0.2.2-alpha.2` et le marché à 1.73.1 :

- Mise à niveau du runtime upstream : le canal beta passe de dsh `0.2.1-rc.3` à **`0.2.2-alpha.2`** (pin du sous-module `1f81c047` → `f3803c96`, commit upstream « release(dsh): 0.2.2-alpha.2 ») — le runtime est réempaqueté et revendorisé (370 paquets, contre 344), et les 24 correctifs de version sont tous rebasés. Sept paquets ont exigé un réancrage sémantique parce que leur sortie empaquetée a changé : les noms de fichier de bundle dans `dsh`, `dsh-sandbox-windows-acl` et `dsh-web-frontend` portent de nouveaux hachages ; `dsh-client-ui-plugin-manager` a été refactorisé en amont pour dériver `available` de `listed` sans jamais le définir (ce correctif restaure les emplacements de bureau et fournit cette définition) ; `dsh-client-ui-settings-account` a déplacé son icône de retour d’onboarding dans une variable de module ; `dsh-client-ui-directory-picker-browse` est passé à neuf dictionnaires de langue ; `dsh-client-ui-primitives` a basculé les tableaux larges vers une barre de défilement visible au survol seulement, que ce correctif rétablit en barre fine toujours visible. L’instantané du runtime rc.3 et ses correctifs restent conservés comme historique.
- Surface de dépendances : `@deepseek-ai/cordis` passe à 4.0.6-alpha.1, `schemastery` à 3.18.6-alpha.1 et trois paquets de plugins Cordis gagnent chacun une version alpha mineure, faute de quoi les contrôles de peer de l’upstream 0.2.2-alpha.2 échouent ; `nonead-dsh-desktop` est aligné à la main sur le canal beta parce qu’il relève de la ligne stable et reste hors de la liste des espaces de travail synchronisés automatiquement.
- Marché : `dshmarket` 1.70.1 → **1.73.1**, le correctif de bureau (entrée d’auto-mise à jour, versions fournies par l’hôte, comparaison de base de l’exécution d’essai) étant rebasé sur 1.73.1 ; l’upstream a fait passer le cache de mise à jour à la sémantique `recheckAt`, si bien que le fragment de `checkUpdates` est réécrit selon la nouvelle structure.
- Pont Agents Anywhere : reconstruit pour les nouvelles plages de peer (artefact `rd9c47cbc`, pin inchangé à `39b82d4`), correctif du connecteur intact.
- Version : le produit passe de 2.1.18 à **2.2.2** dans les deux espaces de travail de bureau.

## 2.1.18 — 2026-10-24

Mise à niveau du runtime upstream, une compilation depuis les sources d’Agents Anywhere et une compilation Windows ARM64 expérimentale (comprenant le lot de correctifs d’audit 2.1.17) :

- Mise à niveau du runtime upstream : le canal beta est passé de dsh `0.2.1-rc.2` à **`0.2.1-rc.3`** (pin du sous-module `687f282e` → `1f81c047`) : 24 correctifs versionnés ont été rebasés sur rc.3, `vendor/dsh-runtime/0.2.1-rc.3/` a été vendorisé à nouveau (344 paquets), et les manifestes racine, les deux espaces de travail de bureau ainsi que les plages de peer du pont Agents Anywhere suivent ; l’instantané du runtime rc.2 supplanté et ses correctifs ne sont plus suivis.
- Pont Agents Anywhere : désormais **construit depuis les sources** (`39b82d4`, auparavant un artefact réutilisé), avec le correctif du connecteur rebasé sur le nouvel artefact — la remontée d’état de santé ne bloque plus la publication des notifications, la réécriture des adresses IPv6 nues de `NO_PROXY` et la remontée de préparation du runtime sont conservées, et la modification du fournisseur de réponses supplantée par le refactor `interactionPeer(connection)` intervenu en amont est supprimée ; les fichiers Python de l’artefact sont normalisés en LF pour que le correctif s’applique de façon reproductible.
- Windows ARM64 (expérimental) : un nouveau chemin de compilation `DSH_PACKAGE_ARCH=arm64` livre un processus principal arm64 natif, tandis que les runtimes Python / Node / Office embarqués réutilisent la charge utile x64 sous l’émulation de Windows ; l’empaquetage inter-architectures saute les tests de fumée qui ne peuvent s’exécuter que sur l’hôte, la compilation x64 et ses contrôles restent inchangés, et cet artefact n’est pas encore raccordé aux liens de téléchargement ni au canal de mise à jour.
- Carte de mise à jour de la page des paramètres : en cas d’indisponibilité du service, le message indique désormais « Les mises à jour de Nonead-DSH-Desktop sont temporairement indisponibles. Réessayez plus tard. » au lieu de nommer le produit Next retiré ; la barre de progression du téléchargement s’est déplacée entre le libellé « Téléchargement de la mise à jour {progress} » et les notes de version.

## 2.1.17 — 2026-10-24

Lot de correctifs d’audit (26 corrections, détaillées ci-dessous) :

- Assistant de récupération : lorsque l’export automatique des diagnostics et une action de l’utilisateur rafraîchissaient le même document en parallèle, la première navigation échouait avec `ERR_ABORTED` ; sur le chemin sans action utilisateur, cet échec pouvait être promu par le fail-loud en une sortie complète de l’application. Les rafraîchissements sont désormais sérialisés, une navigation interrompue par la destruction de la fenêtre est traitée comme une fin normale, et les échecs du chemin d’action sont seulement consignés comme diagnostics.
- Lecture des points de contrôle et dégradation : les fichiers manifeste et de sauvegarde sont ouverts puis revérifiés par inode (`O_NOFOLLOW` + `fstat`), si bien qu’un chemin remplacé entre `lstat` et la lecture n’est plus considéré comme fiable ; un emplacement endommagé ne fait plus échouer toute la liste d’instantanés — il est marqué illisible, reste visible mais non restaurable dans la page de récupération, et la rotation le réutilise comme prochaine cible d’écrasement.
- Écriture des paramètres : `settings.yaml` et le `pnpm-workspace.yaml` d’un Profil sont publiés via un fichier temporaire puis un renommage, si bien qu’une écriture interrompue laisse soit l’ancien contenu, soit le nouveau, au lieu d’un demi-YAML qui ferait perdre tous les réglages au démarrage suivant.
- Mises à jour : les corps de réponse sont libérés sur les chemins de dépassement de limite et d’échec de décodage ; macOS arme le transfert d’installation avant le début de l’étape native, si bien que quitter ne supprime plus le paquet que le flux local est encore en train de servir ; choisir Quitter dans une fenêtre de récupération ouverte par l’utilisateur n’est plus signalé comme un échec de démarrage (code de succès), tandis que les échecs de démarrage restent non nuls.
- Magasins de plugins et d’état : les lectures d’état de plugin revérifient l’inode ; la récupération des verrous de données obsolètes tolère un `ENOENT` concurrent ; le garde d’état endommagé vérifie désormais le fichier qu’il protège réellement ; les arborescences de staging du runtime laissées par un plantage sont balayées avant la publication suivante.
- Coque stable : la boîte de dialogue de résultat du contrôle de mise à jour lancé depuis la zone de notification appartient à la fenêtre principale, elle ne peut donc plus être enterrée et faire perdre la réponse ; le commutateur Computer Use traite `cancelled` comme `failed` ; la fermeture du guest de navigateur est bornée (forcée après 1,5 s, puis 0,5 s de grâce), le bail est libéré d’abord, et `browserRelease` ne reste plus suspendu indéfiniment.
- Marché communautaire et habillage : une requête de pagination interrompue ne laisse plus le bouton « Charger plus » bloqué en chargement ; la surcouche du marché rend le focus à sa fermeture ; le style injecté déclare `data-plugin`, si bien qu’un plugin chargé plus tard ne peut plus le revendiquer ni le supprimer à son déchargement ; la grammaire des noms de paquets correspond à celle du Host.
- Portes et CI : `upstream-command-windows` installe désormais les dépendances avant `check:layout` ; la classification des changements désactive la détection de renommage, si bien qu’un fichier source renommé vers un chemin de documentation ne peut plus contourner les portes produit ; le test de compatibilité de l’inspecteur s’ancre sur la racine du dépôt.
- Chaîne d’empaquetage : le `verify:safe-cleanup` de la coque stable pointe désormais le `TEMP` du processus enfant Electron vers un répertoire inscriptible de l’espace de travail (sur cet hôte, Electron 44 se voit refuser la création de répertoire sous `%TEMP%`), si bien que le précontrôle n’avorte plus avant la production de l’installateur.

## 2.1.16 — 2026-10-22

Durcissement de la sécurité et corrections des portes (résultat d’un audit complet) :

- La CI exécute désormais la classification des changements et les portes documentation/marché depuis **le côté base de la pull request**, si bien que le code en cours de revue ne peut plus affaiblir son propre classificateur pour sauter toutes les portes produit.
- Fuses Electron resserrés : les deux coques ferment la surface d’injection `NODE_OPTIONS` / `--inspect` ; la coque stable (`asar: true`) ne charge plus que depuis `app.asar`, tandis que le canal Beta laisse ce bit désactivé parce qu’il distribue un répertoire physique (`asar: false`). `runAsNode` doit rester activé : sous Windows, le Host, la CLI et les shims pnpm lancent tous le binaire Electron avec `ELECTRON_RUN_AS_NODE`. Les deux scripts `verify-fuses` dérivent désormais la valeur attendue de la disposition réelle et vérifient l’ensemble des bits, si bien qu’un relâchement échoue ; la coque stable appelait auparavant `verifyElectronExecutableFuses(path, undefined, false)`, ce qui ne contrôlait jamais le bit d’archive.
- L’identifiant du renderer ne circule plus dans l’environnement du processus enfant Host ; il est injecté une seule fois au démarrage via un canal privé, si bien qu’un processus du même utilisateur ne peut plus le lire dans l’environnement du processus ou dans un vidage de crash pour usurper le renderer.
- La porte d’accès Web **refuse par défaut** lorsque l’identifiant manque (elle laissait passer auparavant), et les requêtes de la classe navigateur ne sont plus autorisées silencieusement.
- Les liens profonds `dsh-desktop://` sont distribués via une liste blanche d’actions ; les actions inconnues sont rejetées avec une seule ligne de journal.
- Le masquage des secrets pour les diagnostics et les journaux couvre désormais les formes base64url, si bien que l’identifiant du renderer ne peut plus être exporté.
- La route du sélecteur de répertoire partage le contrôle d’origine identique en loopback utilisé par la route des paramètres, au lieu de faire confiance à un `Origin` fourni par le client.

Empaquetage et publication :

- Le contrat `asarUnpack` de la coque stable a été revérifié face à app-builder-lib 26.15.7 : les correspondances sont résolues par rapport au **chemin du projet d’empaquetage**, si bien que les trois motifs doivent conserver le préfixe `.desktop-build/payload/` de `files[].from` pour correspondre (`scripts/node-bin`, `assets` et `build` sont bien déballés à côté de `app.asar`). Les motifs restent tels quels ; un nouveau test dérive le préfixe attendu de `files[].from` et le vérifie, échouant si l’un des deux côtés dérive — ce couplage n’était couvert par aucune assertion auparavant.
- La CI couvre désormais l’empaquetage de la coque stable, et `verify-layout` impose la parité de version : le champ `version` des deux espaces de travail doit correspondre au plus récent titre de `CHANGELOG`.
- La CI ne réécrit plus `dsh-plugin-desktop-beta/package.json` sur place pour sauter le smoke AA ; un script `check:ci` explicite remplace cette mutation, si bien que la CI et les exécutions locales concordent.

Hygiène du dépôt et chaîne d’approvisionnement :

- Chaque Action tierce utilisée par la CI est épinglée à un SHA de commit (`actions/checkout`, `actions/setup-node`, `actions/cache`), l’étiquette n’étant conservée qu’en commentaire de fin pour la lisibilité, afin qu’une étiquette amont déplacée ne puisse pas modifier silencieusement ce que les portes exécutent.
- Le classificateur de changements ne traite plus chaque fichier de `docs/` comme de la documentation : les extensions non documentaires dans `docs/` (`.js`/`.mjs`/`.json`/`.ts` et assimilées) déclenchent désormais les portes produit, seuls les vrais formats de documentation et `docs/schemas/*.schema.json` étant exemptés.
- Six fichiers tgz historiques non référencés (~1,7 Mo) ont été retirés de `vendor/agents-anywhere/`, seul l’épinglé étant conservé ; le README de ce répertoire n’enseigne plus le chemin `DSH_AA_SOURCE_REF=pinned` supprimé et épingle désormais via `provenance.pinnedCommit`.
- Les fichiers `nonead-dsh-desktop/README.md` et `README.zh.md` ne codent plus en dur la version du produit (ils indiquaient `2.1.3`) ; ils renvoient à la propriété `version` de `package.json` et à l’entrée la plus récente du `CHANGELOG` racine.
- La documentation précise désormais que l’AppImage et le deb Linux x64 ne sont construits que par le canal Beta et que le canal stable ne livre sous Linux qu’un répertoire exécutable ; le premier contrôle réel des fuses et de `onlyLoadAppFromAsar` est la tâche CI `desktop-windows-stable` (`package:dir:stable`), puisque localement seuls des tests unitaires les couvrent.

### Complément du 2026-10-23 (même numéro de version, inclus dans les compilations ultérieures)

Chaîne d’empaquetage :

- Correction de trois portes d’empaquetage Windows qui s’étaient écartées du comportement réel du produit : les jonctions créées par pnpm dans un Profil ne pouvaient pas être supprimées récursivement ; `verify:host` ne transmettait jamais l’identifiant du renderer (32 octets base64url, et il doit être le même que celui reçu par le Host) ; et ce script usurpait le renderer avec une chaîne fixe, que la porte Web à refus par défaut rejette.
- `dsh-plugin-desktop-beta` déclare désormais `@deepseek-ai/dsh-plugin-manager` (un peer obligatoire de `dsh-plugin-market`), ce qui rétablit la fermeture de runtime de 318 nœuds.

## 2.1.15 — 2026-10-22

La version passe directement de `2.1.13` à `2.1.15` ; il n’existe pas de commit de publication `2.1.14` distinct dans l’historique.

Runtime et dépendances :

- Le runtime DSH reste sur **`0.2.1-rc.2`** et `channels.beta.commit` dans `upstream.json` vaut toujours `687f282e` ; le pont Agents Anywhere est toujours `39b82d4`.
- Le marché de plugins `dshmarket` passe à `1.66.45` et le correctif de bureau est rebasé dessus.
- Le correctif de marque est passé de `.yarn/patches/dsh-web-frontend-nonead-wordmark.patch` à `patches/dsh-web-frontend@0.2.1-rc.2.patch`, rejoignant les autres correctifs du runtime.
- Le correctif httpx du connecteur AA s’est élargi pour couvrir le nouveau chemin de connexion.

Mises à jour et récupération :

- La carte de mise à jour peut afficher les **notes de version** fournies par la réponse de version ; le menu de la zone de notification et les boîtes de dialogue natives du canal Beta offrent en plus une entrée « Afficher les notes de version complètes » (les libellés de la zone de notification et le corps des notifications sont tronqués selon les règles de la plateforme), tandis que la boîte de dialogue native de mise à jour du canal stable ne porte toujours qu’un texte fixe.
- La fonction **Ignorer cette version** est nouvelle : la décision est persistée, si bien que le contrôle planifié sans surveillance ne repropose plus une version ignorée.
- Une installation échouée peut être relancée, et la récupération peut revenir à **n’importe quel instantané enregistré**, pas seulement au plus récent.
- Le lancement de l’installateur natif commence désormais **avant** la séquence de fermeture, si bien que quitter ne peut plus entraîner l’installateur avec lui.
- La signature des installateurs Windows et la vérification de l’éditeur ont été introduites puis **entièrement annulées** dans `c5896ac` ; les installateurs Windows ne comparent toujours que `ProductName` / `ProductVersion` de la ressource de version PE.

Coque de bureau :

- La position et la taille de la fenêtre sont mémorisées ; la restauration n’a lieu que si la fenêtre chevauche encore un écran raccordé, si bien que débrancher un moniteur ne peut pas la placer hors écran.
- La prise en charge stricte et étagée des fichiers `.env` complète les variables manquantes du processus enfant Host sans écraser l’environnement existant.
- Les liens profonds `dsh-desktop://` sont pris en charge (par exemple `dsh-desktop://settings/general`).
- Un commutateur de lancement à l’ouverture de session lit l’état réel du système d’exploitation.
- Les cycles de lecture-modification-écriture de la configuration d’un Profil s’exécutent désormais sous un verrou d’écrivain unique, si bien que la coque et le gestionnaire de profils du Host ne peuvent plus perdre silencieusement les mises à jour de l’autre.
- Les budgets de nouvelle tentative de l’instance unique et du nettoyage des ressources jetables sont fixés à trois ; les échecs non traités du renderer apparaissent dans la zone de notification.
- Le `.env` et l’environnement d’exécution du navigateur invité sont transmis correctement.

Marché de plugins et habillage :

- Le marché prévisualise les **médias non image** et peut **installer un plugin par son nom**.
- Le fait d’ignorer le marché de plugins pendant l’onboarding est mémorisé, et rouvrir l’assistant conserve le réglage de marché enregistré.
- Le remplacement du titre héros de l’habillage est limité au sous-arbre héros et ne touche plus les autres textes.

Corrections :

- Le flux d’interaction AA conserve un pair vivant, et le runtime DSH reste utilisable pendant la synchronisation de l’historique.
- Les assertions inter-plateformes ont été réparées et le bundle du marché est désormais livré avec le paquet.
- La CI exécute les portes produit lorsqu’un schéma JSON du runtime change.
- Le flux de publication dérive la version livrée à partir des manifestes.

## 2.1.13 — 2026-10-21

Runtime et dépendances :

- Le runtime DSH est passé de `0.2.1-alpha.5` à **`0.2.1-rc.2`** : chaque dépendance `@deepseek-ai/dsh*` est épinglée exactement sur cette version, `vendor/dsh-runtime/0.2.1-rc.2/` est livré avec l’installateur, et l’ancien répertoire de runtime `alpha.5` a disparu. `upstream.json` enregistre `channels.beta.commit` = `687f282e`.
- Le marché de plugins `dshmarket` passe à `1.66.44`.
- Le pont Agents Anywhere passe à `2.1.0-desktop` (upstream `39b82d4`) avec le correctif `agents-anywhere-connector-httpx`.

Interface et expérience :

- L’écran de démarrage affiche désormais le logotype NONEAD / DEEPSEEK HARNESS.
- La page finale de l’onboarding guide désormais l’utilisateur vers la saisie d’une clé API et propose un point d’entrée NONEAD.
- L’onboarding active par défaut le marché de plugins et Computer Use (effectif depuis 2.1.12).

Stabilité :

- Le pont AA **abandonne des événements** lorsque sa file est pleine au lieu de planter.
- Correction des assertions PTC cassées par le refactor upstream de rc.2.
- La CI se déclenche désormais sur `main` au lieu de `master`.
- Suppression des fichiers `AGENTS.md`, `CLAUDE.md`, `PRIVACY*`, `CONTRIBUTING*` et `CODE_OF_CONDUCT*` à la racine ; les règles du dépôt ne vivent plus que dans `README.md` et `docs/`.

## 2.1.12 — 2026-10-19

- L’onboarding active par défaut le marché de plugins (`dsh-market`) et Computer Use, si bien que les nouvelles installations disposent des deux dès le premier lancement.

## 2.1.11 — 2026-10-18

- Les deux espaces de travail de bureau sont unifiés à `2.1.11`, avec tests et documentation synchronisés.
- Les manifestes racine et la documentation sont synchronisés sur DSH `0.2.1-rc.2` (après être passés par `0.2.1-rc.1`).
- `aa:prepare-release` peut désormais utiliser une arborescence de sources locale au lieu d’un pack GitHub, ce qui aide les publications hors ligne ou à bande passante limitée.

## 2.1.6 — 2026-10-17

- Ajout d’un correctif de compatibilité pour les plugins de Profil, qui répare le chargement des plugins de profil sous les runtimes plus récents.
- Les points d’accès de téléchargement des mises à jour passent à `nonead.com` ; le README gagne les instructions d’installation et d’exécution de l’AppImage Linux.

## 2.0.8 — 2026-10-11

- Les trois canaux sont unifiés à `2.0.8`, avec des ressources d’icônes, `dshmarket` et une documentation de publication rafraîchis.
- Le runtime upstream était déjà passé à `0.2.0-rc.2`.

## Problèmes connus

- La mise à jour intégrée sous Linux ne vérifie que la version et ne télécharge jamais d’installateur ; pour mettre à niveau, téléchargez un AppImage neuf.
- Les installateurs Windows ne sont pas encore vérifiés cryptographiquement : le chemin de téléchargement accepte un `installerSha256` fourni par le serveur, mais le point d’accès de version ne le publie pas, si bien que seuls `ProductName` et `ProductVersion` de la ressource de version PE sont comparés.
- Un sous-module `deepseek-harness` non initialisé fait échouer `corepack yarn check:layout` ; les compilations normales, la vérification de types et les tests ne sont pas affectés.
