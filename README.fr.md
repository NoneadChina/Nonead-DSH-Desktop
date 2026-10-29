<p align="center">
  <a href="https://www.nonead.com"><img src="https://www.nonead.com/assets/img/desktop-Nonead.jpg" alt="Nonead DSH Desktop, client de bureau open source construit sur DeepSeek Harness" width="100%"></a>
</p>

<h1 align="center">Nonead DSH Desktop</h1>

<p align="center">
  <strong>Un client de bureau open source pour Windows, macOS et Linux, construit sur DeepSeek Harness.</strong>
</p>

<p align="center">
  Version du produit <code>2.2.3</code> · Runtime DSH <code>0.2.2-alpha.2</code> · Electron 44 · Licence MIT
</p>

<h3 align="center"><a href="https://www.nonead.com">Téléchargement en un clic, prêt à l’emploi.</a></h3>

<p align="center">
  Tout est un plugin — y compris le bureau lui-même.
</p>

<p align="center"><sub>Projet open source communautaire indépendant, sans lien d’affiliation, de partenariat, de licence ou de caution avec DeepSeek.<br>Aucun salarié de DeepSeek ni membre de l’équipe officielle en amont de DeepSeek Harness ne participe actuellement à ce dépôt ; les contributeurs en amont affichés dans GitHub Contributors proviennent d’un historique de commits forké et synchronisé.<br><a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.es.md">Español</a> · Français · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a></sub></p>

<a id="toc"></a>

## Table des matières

| Section | Contenu |
| --- | --- |
| [Ce que c’est](#what) | Positionnement du produit et modèle de processus |
| [Versions et runtime](#versions) | Versions, pin en amont, base de dépendances |
| [Téléchargement et installation](#download) | Installation sur les trois plateformes |
| [Fonctionnalités](#features) | Enveloppe de bureau, profils, marché, mises à jour |
| [Frontières de sécurité](#security) | Identifiant du processus de rendu, réseau local, vérification des mises à jour |
| [Documentation](#docs) | Points d’entrée utilisateur et développeur |
| [Structure du dépôt](#layout) | Répertoires et les quatre espaces de travail |
| [Construire depuis les sources](#dev) | Environnement, commandes, garde-fous |
| [Publication et mises à jour](#release) | Protocole de canal et flux de publication |
| [Écosystème de plugins](#plugins) | Pourquoi tout est un plugin |
| [Relation avec l’amont](#upstream) | Frontières et répartition du travail |
| [Journal des modifications](#changelog) | Historique des versions |
| [Limites connues](#limits) | Comportements à connaître à l’avance |
| [Communauté](#community) | Canaux de discussion |
| [Liens](#links) | Projets de l’écosystème |
| [Licence](#license) | Licence et mentions |

<a id="what"></a>

## Ce que c’est

Nonead DSH Desktop intègre l’interface Web locale, le service Host et le système de plugins de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) dans une application de bureau native. Le code source en amont s’exécute **sans modification** et est épinglé sur une version de publication précise ; l’enveloppe de bureau prend en charge les fenêtres, la barre d’état système, le terminal, les mises à jour automatiques, plusieurs profils de travail et le packaging, et **est elle-même montée comme plugin DSH** via le même mécanisme de composition que celui utilisé par les plugins tiers.

Le produit n’est pas une réimplémentation du client — c’est un hôte Electron léger accompagné d’un runtime DSH complet :

| Couche | Emplacement | Responsabilité |
| --- | --- | --- |
| Enveloppe de bureau | Processus principal Electron | Verrou d’instance unique, fenêtres et matériaux, barre d’état système et menus, autorisations, terminal, mises à jour, répertoire de données, état des profils |
| Host | Processus enfant en mode Node | Charge la couche de correctifs du profil, lance le boot de profil en amont, sert le Web carrier, héberge les plugins Host tiers |
| Web carrier | HTTP en boucle locale + WebSocket | Sert l’interface Web officielle (port éphémère par défaut) |
| Processus de rendu | BrowserWindow en bac à sable | Charge l’interface Web officielle et est identifié par un en-tête d’identifiant natif |

L’enveloppe et le Host ne communiquent que par un unique canal IPC de processus enfant. Changer de profil ou de mode dispose toute la génération Host et lance un nouveau processus enfant ; aucun état n’est mis en cache entre deux générations. Le processus de rendu ne reçoit jamais les API Electron — il reçoit l’interface Web officielle et un identifiant d’accès généré par l’enveloppe.

<a id="versions"></a>

## Versions et runtime

| Élément | Valeur |
| --- | --- |
| Version du produit | `2.2.3` (`nonead-dsh-desktop` et `dsh-plugin-desktop-beta` synchronisés) |
| Espace de travail du canal stable | `nonead-dsh-desktop` (les scripts racine utilisent le suffixe `:stable`) |
| Espace de travail du canal Beta | `dsh-plugin-desktop-beta` (les scripts racine utilisent le suffixe `:beta`) |
| Runtime DSH | `0.2.2-alpha.2`, chaque dépendance `@deepseek-ai/dsh*` épinglée exactement, runtime vendored |
| Runtime vendored | `vendor/dsh-runtime/0.2.2-alpha.2/` (plusieurs répertoires de versions historiques sont conservés) |
| Pin en amont | `f3803c96974ad4a94195fb97e5c637e9c2a3afe3fc48fa190a683e469daa699857e9afe8` (`channels.beta` dans `upstream.json`, également consigné dans `nonead-dsh-desktop/upstream-reference.json`) |
| Electron / outil de packaging | Electron `44.0.0` / electron-builder `26.15.7` (`app-builder-lib` patché) |
| Node / Yarn | Node `^22.19.0` ou `>=24.0.0` ; Yarn `4.18.0` via Corepack (`nodeLinker: node-modules`) |
| Marché de plugins | `dshmarket` `1.70.1`, ainsi que `dsh-community-market` `0.1.0-dev.0` de ce dépôt |
| Pont de contrôle à distance | `@agents-anywhere/dsh-bridge-next` `2.1.0-desktop` (commit en amont `39b82d4`) |
| Habillage de marque | `dsh-nonead-client-skin` (fourni avec l’installateur, monté par profil) |

`upstream.json` consigne deux lignes de runtime vendored : `stable` correspond à l’amont `0.2.0-rc.2` et `beta` à l’amont `0.2.2-alpha.2`. Ce qui est réellement embarqué dans un installateur est la ligne épinglée exactement par un espace de travail — actuellement, les deux espaces de travail de bureau épinglent `0.2.2-alpha.2`. **Les noms de canal décrivent des lignes de runtime, pas le canal de publication interrogé par un espace de travail.**

<a id="download"></a>

## Téléchargement et installation

Les installateurs officiels couvrent Windows x64, macOS (Universal, Intel et Apple Silicon) et Linux x64 (AppImage). Aucun environnement supplémentaire n’est requis. Les AppImage et deb Linux x64 sont produits par le canal Beta ; le canal stable ne produit sous Linux qu’un répertoire exécutable, sans installateur.

| Plateforme | Téléchargement | Installation |
| --- | --- | --- |
| Windows x64 | [Télécharger l’installateur](https://www.nonead.com/software/ndsh-desktop/downloads/windows) | Lancez l’installateur NSIS et suivez les instructions |
| macOS Universal | [Télécharger le DMG](https://www.nonead.com/software/ndsh-desktop/downloads/mac) | Ouvrez le DMG et glissez Nonead DSH Desktop dans Applications |
| Linux x64 | [Télécharger l’AppImage](https://www.nonead.com/software/ndsh-desktop/downloads/linux) | Rendez-la exécutable puis lancez : `chmod +x Nonead-DSH-Desktop-*.AppImage && ./Nonead-DSH-Desktop-*.AppImage` |

Remarques pour Linux : certaines distributions nécessitent l’installation de FUSE, ou vous pouvez lancer avec `--appimage-extract-and-run`. La mise à jour intégrée sous Linux **ne vérifie que la version et ne télécharge jamais d’installateur** ; pour mettre à niveau, téléchargez une nouvelle AppImage. Utilisez le canal Beta si vous avez besoin d’un installateur Linux — le canal stable ne produit sous Linux qu’un répertoire exécutable.

Windows ARM64 n’est disponible que sous forme de **build expérimental** et n’est ni proposé par les liens de téléchargement ni par les mises à jour intégrées ci-dessus : l’enveloppe est native arm64, mais les runtimes Python / Node / Office embarqués restent des charges utiles x64 (exécutées via l’émulation Windows), et l’artefact n’a pas encore été exécuté sur du matériel ARM. Pour le construire vous-même, utilisez la commande de la section [Commandes courantes](#dev).

L’utilisation pas à pas, les profils et les commandes de plugins sont décrits dans le [guide utilisateur](docs/user-guide.en.md) ; les questions de plateforme et de périmètre trouvent réponse dans la [FAQ](docs/faq.en.md).

<a id="features"></a>

## Fonctionnalités

| Capacité | Description |
| --- | --- |
| Enveloppe de bureau native | Verrou d’instance unique, fenêtres et menus natifs, barre d’état système, icône Dock ; les matériaux de fenêtre dépendent des capacités du système (macOS accepte `off`/`transparent` et utilise `transparent` par défaut, Linux accepte les deux mais résout toujours en `off`, Windows uniquement `off`) |
| Gestion du Host local | L’enveloppe lance le processus enfant Host et gère son cycle de vie : arrêt gracieux d’abord, `SIGTERM` après 10 s, `SIGKILL` 5 s plus tard ; l’installation d’une mise à jour exige un arrêt gracieux et est refusée sinon |
| Interface Web officielle | Se lie uniquement à `127.0.0.1`, port éphémère par défaut ; l’enveloppe génère un identifiant aléatoire de 32 octets par génération Host et le transmet via `x-dsh-desktop-renderer` |
| Profils et configuration initiale | Les répertoires de profil se trouvent dans `$DSH_HOME/profiles/<name>` ; un profil non initialisé affiche d’abord l’assistant de configuration Desktop (mode et matériau de fenêtre, marché de plugins, notifications, ouverture dans le navigateur par défaut, portée de l’accès Web) avant le démarrage du Host |
| Accès navigateur et réseau local | « Ouvrir dans le navigateur » contrôle uniquement le lancement du navigateur système et ne modifie pas l’exposition ; l’accès réseau local est une option distincte qui affiche aussi l’URL actuelle du réseau local |
| Marché de plugins intégré | DSH Community Market propose les vues découverte / installables / installés / sources, avec des sources de catalogue extensibles et des adaptateurs audités |
| Habillage de marque | `dsh-nonead-client-skin` est fourni avec l’installateur et monté par le profil, pour chaque profil, sans installation séparée |
| Mise à jour automatique | Vérification de version sur une adresse fixe `https://www.nonead.com/software/ndsh-desktop/version`, avec version actuelle, canal et un identifiant d’installation aléatoire ; Windows et macOS téléchargent et installent, Linux se contente de vérifier |
| Expérience de mise à jour | La carte de mise à jour affiche les notes de version fournies par la réponse de version, et le menu de la barre d’état système ainsi que les boîtes de dialogue natives du canal Beta ajoutent une entrée « afficher les notes complètes » ; « ignorer cette version » est mémorisé, de sorte qu’une vérification planifiée sans surveillance ne la propose plus ; une installation échouée peut être relancée et restaurée depuis n’importe quel instantané enregistré |
| État de fenêtre et de session | Mémorise la position et la taille de la fenêtre ; une position enregistrée n’est restaurée que si elle chevauche encore un écran connecté, de sorte que débrancher un moniteur ne peut pas replacer la fenêtre hors écran |
| Liens profonds et lancement à l’ouverture de session | Les liens `dsh-desktop://` sont pris en charge, par exemple `dsh-desktop://settings/general` ouvre directement les paramètres ; l’interrupteur de lancement à l’ouverture de session reflète l’état réel du système |
| Fichier d’environnement | La prise en charge stricte des fichiers `.env` en couches complète les variables manquantes du processus enfant Host et ne remplace jamais l’environnement existant |
| Améliorations du marché | Le marché de plugins prévisualise les médias autres que des images et permet d’installer un plugin par son nom |
| Terminal et répertoire de travail | L’enveloppe expose les capacités de terminal et de choix du répertoire de travail sous forme de services Desktop pour les plugins |
| Capacités expérimentales | L’onboarding active par défaut le marché de plugins et Computer Use ; les capacités vocales, la traduction, Agent Team et Ralph sont fournis avec le runtime |

<a id="security"></a>

## Frontières de sécurité

| Frontière | Comportement réel |
| --- | --- |
| Identité du processus de rendu | Seules les requêtes portant l’identifiant de la génération en cours (`x-dsh-desktop-renderer`) sont considérées comme venant du processus de rendu Electron ; lorsque l’accès navigateur est désactivé, toute autre requête reçoit un 403 et les connexions WebSocket existantes du navigateur sont fermées |
| Transport de l’identifiant du processus de rendu | L’identifiant ne vit que dans la mémoire du processus principal et du Host ; au démarrage, le Host le reçoit sur une ligne par son **stdin privé** puis le tube est refermé aussitôt, si bien qu’il n’entre ni dans l’environnement du processus enfant, ni dans argv, ni dans un fichier (l’ancienne implémentation utilisait une variable d’environnement, qu’un processus du même utilisateur pouvait lire dans l’environnement du processus ou dans un vidage mémoire pour usurper le processus de rendu) |
| Garde d’accès Web | Lorsque le Host n’a pas d’identifiant, il **échoue en refusant** les requêtes de type navigateur et consigne un avertissement au lieu de les autoriser ; l’échange de connexion au `/connect` et les requêtes en lecture seule sont exemptés dans le code, et les routes du marché exigent un identifiant de connexion même en lecture |
| Accès au réseau local | **Aucune authentification** : toute personne du même réseau capable d’atteindre le port peut ouvrir DSH et piloter cette machine. À n’activer que sur des réseaux totalement de confiance |
| Vérification de l’installateur | Le chemin de téléchargement prend en charge un `installerSha256` publié par le serveur et l’applique comme garde-fou strict, mais le point de terminaison de version ne publie pas encore ce champ ; tant qu’il ne le publie pas, Windows ne vérifie que `ProductName` et `ProductVersion` dans les ressources de version du PE, tandis que macOS vérifie l’identité du bundle, le manifeste embarqué, la signature de code et le Team Identifier ; cette vérification d’identité n’existe que dans l’enveloppe stable, alors que le chemin de téléchargement de l’enveloppe Beta ne contrôle que les octets magiques et la taille de l’installateur avant de l’exécuter |
| Erreur de configuration d’un plugin | Un `id` de correctif qui ne correspond à rien consigne `entry not found` et est ignoré ; un `name` qui ne correspond pas consigne `name mismatch ... skipping` ; mais un nom de service `inject` erroné **ne produit aucune erreur** — le plugin reste indéfiniment en attente et l’interface n’affiche qu’un HTTP 4xx inexpliqué |

<a id="docs"></a>

## Documentation

Les utilisateurs ordinaires peuvent commencer par le [guide utilisateur](docs/user-guide.en.md) ; la documentation développeur ne compte que pour étendre ou maintenir le projet. L’index complet se trouve dans l’[index de la documentation](docs/README.en.md).

### Documentation utilisateur

| Objectif | Point d’entrée |
| --- | --- |
| Installation, profils, modes, terminal, commandes de plugins et mises à jour | [Guide utilisateur](docs/user-guide.en.md) |
| Réponses directes sur les plateformes, l’environnement embarqué, les données, les plugins et les mises à jour | [FAQ](docs/faq.en.md) |
| Comprendre pourquoi le projet existe | [Pourquoi Nonead DSH Desktop](docs/why-desktop.en.md) |
| Consulter l’historique des versions | [Journal des modifications](CHANGELOG.fr.md) |

### Documentation développeur et mainteneur

| Objectif | Point d’entrée |
| --- | --- |
| Enveloppe, processus enfant Host, Web carrier et packaging | [Architecture](docs/architecture.en.md) |
| Écrire des plugins ordinaires ou Desktop | [Développement de plugins](docs/plugin-development.en.md) |
| Lire la proposition d’écosystème de plugins | [Proposition d’écosystème de plugins DSH](docs/plugin-ecosystem.en.md) |
| Utiliser `desktopProfiles` / `desktopPnpm` et les autres services Desktop | [Services de plugins Desktop](dsh-plugin-desktop-beta/docs/plugin-services.md) |
| Participer à la discussion sur le contrat de plugins unifié | [DSH Community Fabric Draft](dsh-community-fabric/README.md) |
| Lire la conception produit et sécurité du marché | [DSH Community Market](dsh-community-market/README.md) |
| Construction, publication et limites connues au niveau du paquet | [`dsh-plugin-desktop-beta/README.md`](dsh-plugin-desktop-beta/README.md) |
| L’espace de travail de l’enveloppe du canal stable | [`nonead-dsh-desktop/README.md`](nonead-dsh-desktop/README.md) |
| Le plugin d’habillage de marque | [`dsh-nonead-client-skin/README.md`](dsh-nonead-client-skin/README.md) |

<a id="layout"></a>

## Structure du dépôt

La racine est un espace de travail Yarn `4.18.0` (`nodeLinker: node-modules`) dont les membres et responsabilités sont les suivants :

| Chemin | Responsabilité |
| --- | --- |
| `nonead-dsh-desktop/` | Espace de travail de bureau du canal stable : enveloppe autonome (profils et récupération, contrôles de fenêtre, onboarding), pont Agents Anywhere et adaptateurs Community Market, amorçage Electron et packaging |
| `dsh-plugin-desktop-beta/` | Espace de travail de bureau du canal Beta : doubles faces Host/Client, amorçage Electron, packaging et tests de publication |
| `dsh-community-market/` | Conception produit et sécurité du marché de plugins intégré, contrat de fournisseur de catalogue, tests et build |
| `dsh-community-fabric/` | RFC d’interopérabilité communautaire : Manifest/Capability, Runtime/Presentation, composition de services et diagnostics de provenance |
| `dsh-nonead-client-skin/` | Habillage de marque fourni avec l’installateur, tiré via une dépendance `file:` et hors de la liste d’espaces de travail racine |
| `vendor/dsh-runtime/<version>/` | Paquets de runtime DSH vendored et `manifest.json` par canal |
| `vendor/agents-anywhere/` | Paquets du pont Agents Anywhere vendored |
| `patches/` | Correctifs Yarn pour l’outil de packaging Electron, pnpm, `open`, `fs-ext`, le sous-processus DSH et autres |
| `scripts/` | Garde-fous racine et scripts de publication (documentation bilingue, direction des dépendances du marché, runtime vendored, icônes, layout, publication AA) |
| `docs/` | Documentation produit ; `docs/evidence/` conserve les relevés mesurés de publication et d’installateur |
| `deepseek-harness/` | Sous-module amont en lecture seule, épinglé sur `channels.beta.commit` dans `upstream.json` |

**Le sous-module n’est pas nécessaire au développement quotidien.** Le runtime étant vendored, `corepack yarn install`, `build`, `typecheck`, `test`, `dev:*` et `dist:*` n’en ont pas besoin ; seuls les scripts `upstream:*` (reconstruction et repackaging du runtime) le requièrent. `corepack yarn check:layout` vérifie, lui, le commit et l’arbre de travail du sous-module : il échoue donc nécessairement dans un clone non initialisé — c’est attendu.

<a id="dev"></a>

## Construire depuis les sources

### Prérequis

- Node.js `^22.19.0` ou `>=24.0.0`
- Yarn `4.18.0` à la racine via Corepack (n’installez pas les dépendances racine avec pnpm ou npm)
- Git ; nécessaire uniquement pour initialiser le sous-module amont lors de la reconstruction du runtime

```sh
git clone https://github.com/NoneadChina/Nonead-DSH-Desktop.git
cd Nonead-DSH-Desktop
corepack yarn install
corepack yarn dev:beta     # espace de travail Beta
# corepack yarn dev:stable # espace de travail du canal stable (nonead-dsh-desktop)
```

Lorsque vous avez réellement besoin des sources en amont :

```sh
git submodule update --init --recursive
```

### Commandes courantes

| Commande | Objet |
| --- | --- |
| `corepack yarn dev:beta` / `dev:stable` | Démarre le flux de développement de l’espace de travail correspondant (vérifie le `dshmarket` épinglé, prépare les artefacts AA et construit d’abord le marché) |
| `corepack yarn build` | Construit le marché, l’espace de travail Beta et celui du canal stable (vérifie également le `dshmarket` épinglé au préalable) |
| `corepack yarn typecheck` | Vérification de types des trois espaces de travail |
| `corepack yarn test` | Tests unitaires des trois espaces de travail |
| `corepack yarn check` | Garde-fou headless complet : layout, direction de l’architecture, runtime vendored, documentation bilingue, connecteur AA, vérifications par espace de travail |
| `corepack yarn check:ci` | La chaîne réellement exécutée par la CI : identique à `check`, mais l’espace de travail Beta utilise `check:ci` (retire `verify:aa`, suspendu en amont) au lieu de réécrire le manifeste dans la CI |
| `corepack yarn check:layout` | Topologie des espaces de travail, pins exacts, sous-module, runtime vendored, icônes et garde-fous de layout |
| `corepack yarn check:bilingual-docs` | Vérifie que les hachages de blob Git consignés dans `*.i18n.yaml` correspondent aux documents |
| `corepack yarn check:vendored-runtime` | Vérifie `vendor/dsh-runtime/` par rapport à `upstream.json` |
| `corepack yarn market:prepare` / `market:check` | `market:prepare` fait passer `dshmarket` à la version npm `latest` (uniquement les `resolutions`/dépendances des deux espaces de travail de bureau et `yarn.lock`) ; `market:check` est la vérification de cohérence hors ligne exécutée à chaque build, et seul `--latest` accède au réseau |
| `corepack yarn aa:prepare-release` / `aa:check` | Construit ou vérifie les artefacts de publication Agents Anywhere |
| `corepack yarn package:dir:beta` | Produit un répertoire d’application non empaqueté |
| `corepack yarn dist:win:beta` / `dist:mac:beta` / `dist:win-portable:beta` | Produit les artefacts de publication de la plateforme correspondante |
| `DSH_PACKAGE_ARCH=arm64 corepack yarn dist:win:stable` | Produit un installateur Windows ARM64 expérimental (x64 par défaut ; un build inter-architectures saute les tests de fumée qui ne peuvent s’exécuter que sur cet hôte) |

Conventions :

- Les commandes racine `build`, `dev:*` et `dist:*` exécutent d’abord `corepack yarn market:check` : elle vérifie hors ligne que la version de `dshmarket` commitée, le lockfile et le correctif de compatibilité concordent, sans accéder au réseau ni réécrire les manifestes. Déplacer ce pin exige qu’un humain exécute `corepack yarn market:prepare` et commit ensemble la version, le lockfile et le correctif.
- `nonead-dsh-desktop` et `dsh-plugin-desktop-beta` sont **deux espaces de travail distincts** : les modifications partagées doivent être appliquées des deux côtés en préservant leurs différences déclarées ; exécutez `corepack yarn check` et la vérification de chaque espace de travail avant publication.
- Après avoir modifié `README*.md` ou `CHANGELOG*.md` dans n’importe quelle langue, actualisez les hachages de blob Git dans le `*.i18n.yaml` correspondant (obtenus avec `git hash-object`), sinon `check:bilingual-docs` échoue.
- `corepack yarn check:layout` nécessite un sous-module initialisé ; dans un environnement purement headless, validez le code métier avec `typecheck` / `test` / le `check` de chaque espace de travail.
- **La CI ne doit pas laisser le code audité décider de ce qui s’exécute** : la tâche `changes` restaure `scripts/` depuis la **base de la pull request** avant de lancer le classificateur et les garde-fous documentation/marché (les documents viennent toujours de l’arbre de travail) ; `workflow_dispatch` n’a pas de base et retombe donc sur la copie head avec un avertissement. La CI exécute `corepack yarn check:ci` (= `check` local sans `verify:aa`) au lieu de réécrire `dsh-plugin-desktop-beta/package.json` à l’exécution.
- **La parité de version fait partie du garde-fou** : `scripts/verify-layout.mjs` exige que la `version` des deux espaces de travail soit égale au titre `## <version> — <date>` le plus récent de `CHANGELOG.md` ; omettre l’un des deux côtés lors d’une publication provoque donc un échec.

<a id="release"></a>

## Publication et mises à jour

- **Deux lignes de produits** : produites par les deux espaces de travail de bureau. Les installateurs Beta et stable diffèrent par l’identifiant de bundle, le préfixe d’artefact et le canal de mise à jour, et ne doivent pas être mélangés.
- **Protocole de canal** : la vérification de version appelle `https://www.nonead.com/software/ndsh-desktop/version`, en indiquant la version actuelle dans `X-DSH-Desktop-Version`, `stable` / `beta` dans `X-DSH-Desktop-Channel`, et un UUID aléatoire généré et conservé localement dans `X-DSH-Desktop-Installation-Id`. Les téléchargements d’installateur portent `channel` et `X-DSH-Desktop-Target-Version`, mais jamais l’identifiant d’installation ni la version actuelle.
- **Contrôle du canal** : la réponse du serveur doit renvoyer le canal ; le canal stable n’accepte qu’un SemVer simple, le canal Beta uniquement `-beta.N`, et le client ne télécharge jamais silencieusement depuis un autre canal.
- **Cohérence des versions** : l’artefact téléversé, la correspondance « version → fichier » de l’URL de téléchargement nue et la version annoncée par le point de terminaison doivent concorder — un écart se manifeste par un 404 plutôt que par une mauvaise installation.
- **Prérequis de publication** : exécutez d’abord `corepack yarn aa:prepare-release` ; si cette publication embarque un nouveau `dshmarket`, un humain doit aussi exécuter `corepack yarn market:prepare` et le committer. Les commandes de distribution Windows vérifient en outre les artefacts AA avec `--verify-release`.

<a id="plugins"></a>

## Écosystème de plugins

Les plugins étendent DSH — modèles, outils, interface et workflows sont tous des plugins qui se composent comme des briques. Nonead DSH Desktop ne modifie pas le code source en amont et n’est pas une enveloppe figée : l’amont épinglé s’exécute tel quel, et l’enveloppe de bureau elle-même s’intègre via la même règle « tout est un plugin ».

Les auteurs de plugins n’ont besoin que de trois choses :

1. **Les plugins DSH ordinaires** se développent exactement comme dans n’importe quel environnement DSH — voir [développement de plugins](docs/plugin-development.en.md).
2. **Les services Desktop** (`desktopProfiles`, `desktopPnpm`, …) permettent aux plugins d’inspecter ou de changer de profil et d’installer, mettre à jour ou retirer des plugins — voir [services de plugins Desktop](dsh-plugin-desktop-beta/docs/plugin-services.md).
3. **Composition et correctifs** : un profil se compose par empilement de couches de correctifs, où `id` cible une ligne existante et `insert` ajoute de nouvelles lignes ; attention aux trois modes de défaillance « silencieux » décrits dans [Frontières de sécurité](#security).

La vision et les trois principes figurent dans la [proposition d’écosystème de plugins DSH](docs/plugin-ecosystem.en.md) ; la proposition communautaire d’un contrat de plugins unifié est [Community Fabric](dsh-community-fabric/README.md).

<a id="upstream"></a>

## Relation avec l’amont

Nonead DSH Desktop est un projet communautaire indépendant construit sur [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) et le modèle de plugins Cordis, développé et maintenu par **Nonead Corporation**.

L’amont fournit les capacités d’agent de base, le système de plugins, l’interface Web et les paquets de runtime. Ce dépôt prend en charge :

- Le packaging de l’application de bureau (processus principal Electron, fenêtres, barre d’état système, menus, matériaux)
- Le démarrage, l’arrêt et la récupération du service Host local, y compris les replis en cas de plantage
- Les profils et les couches de correctifs, l’assistant de première configuration, le contrôle de l’accès navigateur et réseau local
- La livraison du marché de plugins et de l’habillage de marque dans l’installateur
- Les builds Windows / macOS / Linux, la signature et le flux de publication, ainsi que les mises à jour automatiques

Si vous souhaitez seulement utiliser DeepSeek Harness en ligne de commande, ou travailler sur son cœur, rendez-vous plutôt dans le dépôt en amont.

<a id="changelog"></a>

## Journal des modifications

L’historique complet se trouve dans le [journal des modifications](CHANGELOG.fr.md) ([中文](CHANGELOG.md)). Versions récentes :

| Version | Date | Points clés |
| --- | --- | --- |
| `2.1.15` | 2026-10-22 | Notes de version dans la carte de mise à jour, la barre d’état système et les boîtes de dialogue natives, possibilité d’ignorer une version, nouvelle tentative d’installation et restauration d’instantané ; mémorisation de l’état de fenêtre, `.env` en couches, liens profonds `dsh-desktop://` et lancement à l’ouverture de session ; aperçu des médias du marché et installation par nom ; `dshmarket` `1.66.45` |
| `2.2.3` | 2026-10-29 | L’enveloppe de bureau est entièrement localisée en huit langues (chinois, anglais, japonais, espagnol, français, allemand, russe, portugais du Brésil) : cinq nouveaux dictionnaires d’enveloppe et des dictionnaires de page de paramètres en six langues, recherche par modèle pour les dialogues interpolés, et l’espace de noms de locale du client ainsi que les menus natifs suivent le même ensemble |
| `2.2.2` | 2026-10-28 | Runtime passé à DSH `0.2.2-alpha.2` (370 paquets re-vendored, 24 correctifs de version et le correctif du marché rebasés), dshmarket passe à 1.73.1, et le pont Agents Anywhere est reconstruit pour les nouvelles plages de peer |
| `2.1.18` | 2026-10-24 | Runtime passé à DSH `0.2.2-alpha.2` (344 paquets re-vendored, 24 correctifs rebasés), le pont Agents Anywhere est construit depuis les sources avec un correctif de connecteur rebasé, un build Windows ARM64 expérimental arrive, et le texte de la carte de mise à jour ainsi que l’emplacement de la progression sont corrigés ; inclut la série de correctifs d’audit 2.1.17 |
| `2.1.17` | 2026-10-24 | Série de correctifs d’audit : course lors du rafraîchissement de la récupération, revérification des inodes de point de contrôle et dégradation à un seul emplacement, écritures atomiques des paramètres, libération du chemin d’échec de mise à jour, nettoyage de l’état des plugins et du staging, propriété des dialogues de la barre d’état système, pagination du marché et déclaration de l’habillage, correctifs des garde-fous CI |
| `2.1.16` | 2026-10-22 | Correctifs de sécurité et de garde-fou : les garde-fous CI exécutent le classificateur côté base, les fuses Electron sont resserrés (`NODE_OPTIONS`/`--inspect` fermés, Stable ne se charge que depuis `app.asar` ; `runAsNode` conservé car les shims Host/CLI/pnpm en ont besoin, et désormais épinglé par des assertions dérivées du layout), identifiant du processus de rendu injecté par un tube privé, garde Web en échec fermé, liste blanche des actions de liens profonds, masquage des secrets base64url ; le couplage `asarUnpack` / `files[].from` de l’enveloppe stable est désormais épinglé par un test qui dérive le préfixe (les motifs existants ont été vérifiés corrects), ajout d’une CI de packaging stable, et `verify-layout` impose maintenant la parité de version |
| `2.1.13` | 2026-10-21 | Runtime passé à DSH `0.2.1-rc.2`, `dshmarket` `1.66.44`, pont AA `39b82d4`, nouveau mot-symbole de démarrage et conseils d’onboarding pour la clé d’API, un débordement de file AA abandonne des événements au lieu de planter |

<a id="limits"></a>

## Limites connues

- **La mise à jour intégrée sous Linux ne vérifie que la version** et ne télécharge jamais d’installateur ; pour mettre à niveau, téléchargez une nouvelle AppImage.
- **Windows ARM64 est livré comme un build expérimental** : `dist:win:stable` ne produit par défaut que l’installateur x64 ; arm64 nécessite `DSH_PACKAGE_ARCH=arm64` (à associer à `DSH_PACKAGE_OUTPUT_DIR` pour un répertoire de sortie distinct). L’enveloppe est native arm64 tandis que le runtime embarqué reste sur la charge utile x64 (émulation Windows), un build inter-architectures saute les tests de fumée exécutables, et le canal de mise à jour ne transporte actuellement qu’un seul artefact `windows`, si bien qu’il ne peut pas servir x64 et arm64 côte à côte.
- **Les installateurs Windows ne sont pas encore vérifiés cryptographiquement** : le chemin de téléchargement prend en charge un `installerSha256` fourni par le serveur, mais le point de terminaison de version ne le publie pas, donc seuls `ProductName` / `ProductVersion` sont comparés pour l’instant (enveloppe stable uniquement ; l’enveloppe Beta ne contrôle que les octets magiques et la taille de l’installateur, puis l’exécute).
- **L’accès au réseau local n’a aucune authentification** — il confie le DSH de cette machine à quiconque se trouve sur le même segment réseau.
- **Un nom de service `inject` erroné échoue silencieusement** sous forme de plugin indéfiniment en attente, qui ne se manifeste que par un HTTP 4xx.
- Un `yarn install` local peut réécrire l’empreinte de contenu de `dsh-nonead-client-skin` dans `yarn.lock` (non reproductible d’une machine à l’autre) ; **ne committez pas ces modifications locales du lockfile**.

<a id="community"></a>

## Communauté

- Discord : [rejoindre la communauté Nonead DSH Desktop](https://discord.gg/TJeGqKRNM)
- Groupes WeChat Work et QQ : après avoir rejoint, envoyez un message à @王博升Benson, ou demandez une invitation par e-mail
- Envie de rejoindre l’équipe technique : contactez [t4wefan@qq.com](mailto:t4wefan@qq.com)

<a id="links"></a>

## Liens

Projets de l’écosystème DeepSeek Harness et outils pour développeurs :

| Projet | Description | Lien |
| --- | --- | --- |
| dshfind | Communauté d’apprentissage et de partage autour de DeepSeek Harness (DSH). | [GitHub](https://github.com/hikariming/dshfind) · [Site web](https://dshfind.com) |
| DSH 1024Store | Catalogue communautaire de plugins pour DSH, avec un marché open source, un pipeline de catalogue et une API publique de requête. | [GitHub](https://github.com/imsai-sh/awesome-deepseek-harness-plugins) |
| Awesome DSH Plugin | Liste sélectionnée de plugins DeepSeek Harness. | [GitHub](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) |
| dsh-market | Marché de plugins visuel dans DSH, avec navigation, recherche et installation en un clic. | [GitHub](https://github.com/dsh-market/dsh-market) |
| ModLens | OCR, reconnaissance de mise en page et sémantique pour DSH et les agents de codage textuels. | [GitHub](https://github.com/liustack/modlens) |
| DeepSeek Harness orange book | Manuel communautaire des pratiques mesurées de DeepSeek Harness. | [GitHub](https://github.com/alchaincyf/deepseek-harness-orange-book) |
| dsh-web-ui | Collection de plugins et d’habillages pour l’interface Web de DeepSeek Harness. | [GitHub](https://github.com/zhu1090093659/dsh-web-ui) |
| dsh-TUI | Interface de terminal interactive plein écran pour DeepSeek Harness. | [GitHub](https://github.com/ccch1mneyyy/dsh-TUI) |
| dsh-context | Panneau d’analyse du contexte pour DSH : tableau de bord, commande `/context` et navigateur. | [GitHub](https://github.com/bowenliang123/dsh-context) |
| Agents-Anywhere | Pilotez depuis votre téléphone un agent de codage installé sur votre ordinateur. | [GitHub](https://github.com/anywhere-labs/Agents-Anywhere) |
| DSH-better-sidebar | Atelier de barre latérale DSH intégrant fichiers, terminal, Git et sous-agents. | [GitHub](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Awesome DeepSeek Harness | Liste sélectionnée de plugins, outils et infrastructures DSH. | [GitHub](https://github.com/0xsline/awesome-deepseek-harness) |

<a id="license"></a>

## Licence

Copyright © 2026 **Nonead Corporation**. Publié sous [licence MIT](LICENSE).

> « DeepSeek Harness » est une marque déposée de DeepSeek. Ce nom n’est utilisé que pour décrire précisément la compatibilité, la provenance technique et la relation avec le logiciel en amont.

> Ce projet est entièrement libre et open source. Si quelqu’un vous vend ce logiciel sous quelque forme que ce soit, refusez la transaction.

> Nonead DSH Desktop est un projet communautaire indépendant, sans lien d’affiliation, de partenariat, de licence ou de caution avec DeepSeek.
