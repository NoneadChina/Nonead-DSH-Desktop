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
