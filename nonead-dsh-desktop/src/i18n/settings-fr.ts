/** French copy for the Desktop settings page, keyed by the shared settings locale key. */

import type { DesktopSettingsLocaleKey } from '../../../dsh-plugin-desktop-beta/src/client/desktop-settings-locales.ts'

export const settingsFr: Record<DesktopSettingsLocaleKey, string> = {
  loggingTitle: 'Journalisation',
  developerLogging: 'Journalisation de développement',
  developerLoggingBody:
    'Enregistre immédiatement les métadonnées des modèles, des outils, des nouvelles tentatives, du HTTP, de la communication inter-processus et des diagnostics de l’interface, sans collecter activement les prompts, les arguments des outils ni le corps des réponses ; les journaux sont inclus dans l’export ZIP de diagnostic. Les événements de session peuvent être comparés au Session Log officiel par numéro de séquence.',
  logLevel: 'Niveau de journalisation',
  remoteControl: 'Contrôle à distance',
  remoteControlNew: 'Nouveauté',
  aaSaving: 'Enregistrement des paramètres de connexion mobile…',
  aaLoadFailed:
    'La connexion mobile n’a pas pu démarrer. Sélectionnez « Réessayer le chargement » pour réessayer ; si le problème persiste, consultez les journaux.',
  retryAa: 'Réessayer le chargement',
  aaSaveFailed: 'Impossible d’enregistrer les paramètres de connexion mobile. Veuillez réessayer.',
  aaSaved: 'Paramètres de connexion mobile enregistrés.',
  aaTitle: 'Agents-Anywhere',
  aaIntro:
    'Avec Agents-Anywhere, accédez à DSH sur cet ordinateur depuis votre téléphone ou un navigateur.',
  aaDisabled: 'Désactiver la connexion mobile',
  aaDisabledBody:
    'Ne pas accéder à cet ordinateur depuis un téléphone ou un navigateur via Agents-Anywhere.',
  aaEnabled: 'Activer la connexion mobile',
  aaEnabledBody:
    'Une fois activée, ouvrez « Connexion mobile » dans la barre latérale pour terminer la configuration.',
  beta: 'Beta',
  nav: 'Paramètres',
  title: 'Paramètres DSH Desktop',
  intro:
    'Gérez les Profils et configurez l’apparence de la fenêtre, les connexions et les notifications.',
  loading: 'Chargement des paramètres…',
  retry: 'Réessayer',
  unavailable: 'Les paramètres du bureau ne sont pas disponibles pour le moment.',
  operationFailed: 'Cette action n’a pas pu être effectuée. Veuillez réessayer dans un instant.',
  exportDiagnostics: 'Exporter les diagnostics',
  exportingDiagnostics: 'Préparation de l’export…',
  exportDiagnosticsError: 'Impossible de préparer les diagnostics. Veuillez réessayer.',
  openTerminal: 'Ouvrir le terminal DSH',
  openingTerminal: 'Ouverture…',
  openTerminalError:
    'Impossible d’ouvrir le terminal DSH. Veuillez réessayer ; si le problème persiste, exportez les diagnostics pour en identifier la cause.',
  updatesTitle: 'Version et mises à jour',
  updatesIntro:
    'Consultez la version actuelle et vérifiez si une nouvelle version est disponible. Si c’est le cas, Desktop vous accompagne dans son téléchargement et son installation.',
  currentVersion: 'Version actuelle',
  checkForUpdates: 'Rechercher des mises à jour',
  checkingForUpdates: 'Recherche en cours…',
  checkForUpdatesError:
    'Impossible de rechercher les mises à jour pour le moment. Veuillez réessayer plus tard.',
  restartDesktop: 'Redémarrer',
  restartingDesktop: 'Redémarrage…',
  restartOptions: 'Options de redémarrage',
  restartToRecovery: 'Redémarrer en mode récupération',
  restartDesktopError:
    'DSH Desktop n’a pas pu redémarrer pour le moment. Veuillez réessayer plus tard.',
  developerOptions: 'Options de développement',
  reloadRenderer: 'Recharger l’interface',
  reloadRendererError: 'Impossible de recharger l’interface. Veuillez réessayer.',
  toggleDeveloperTools: 'Afficher ou masquer les outils de développement',
  toggleDeveloperToolsError:
    'Impossible d’afficher ou de masquer les outils de développement pour le moment. Veuillez réessayer plus tard.',
  readOnly: 'Ces paramètres sont en lecture seule. Les modifications ne peuvent pas être enregistrées.',
  restarting:
    'Votre choix a été enregistré. DSH Desktop redémarre pour appliquer la modification.',
  restartRequired:
    'Votre choix a été enregistré et prendra effet au redémarrage de DSH Desktop.',
  profileTitle: 'Profil',
  profileIntro:
    'Un Profil est un environnement de configuration. Choisissez le Profil utilisé au démarrage ou créez-en un nouveau.',
  profileReady: 'Disponible',
  profileUnavailable: 'Non compatible avec Desktop',
  activeProfile: 'Actif',
  profileName: 'Nom du Profil',
  profileNamePlaceholder: 'Par exemple : work',
  creatingProfile: 'Création…',
  create: 'Créer',
  deleteProfile: 'Supprimer',
  confirmDeleteProfile: 'Supprimer le Profil',
  cancelDeleteProfile: 'Annuler',
  deleteProfileWarning:
    'Cette action supprime la configuration locale et les fichiers de plugins de ce Profil. Elle est irréversible.',
  deletingProfile: 'Suppression…',
  marketTitle: 'Marché de plugins',
  marketIntro: 'Choisissez un marché de plugins. Un seul peut être activé à la fois.',
  marketDisabled: 'Désactiver le marché de plugins',
  marketDisabledBody: 'Ne pas charger d’interface de marché de plugins.',
  communityMarket: 'dsh-community-market',
  communityMarketBody:
    'Le marché de plugins ouvert intégré à DSH Desktop, qui prend en charge l’ajout et la sélection de sources de données de plugins personnalisées.',
  dshMarket: 'dsh-market',
  dshMarketBody: 'Un marché de plugins populaire dans la communauté, avec des données de',
  legacyMarketNotice:
    'Après une mise à niveau depuis une version précédente, le marché de plugins reste désactivé tant que vous n’en choisissez pas un ici.',
  marketLoadFailed:
    'Le marché de plugins sélectionné n’a pas pu être chargé. Choisissez un autre marché ou sélectionnez « Réessayer le chargement ».',
  selected: 'Sélectionné',
  retryMarket: 'Réessayer le chargement',
  presentationTitle: 'Mode de fenêtre',
  presentationIntro: 'Choisissez une disposition de fenêtre et un mode de contrôle du bureau.',
  compatibilityMode: 'Mode compatibilité',
  compatibilityModeBody:
    'Utilise la disposition du client officiel, avec une barre de contrôle Desktop indépendante au-dessus. Compatibilité optimale.',
  extendedMode: 'Mode étendu',
  extendedModeBody:
    'Ajoute une barre de titre et une barre latérale indépendantes autour de la zone de contenu officielle, avec un fond en verre en option.',
  extendedUnavailableLinux: 'Le mode étendu est actuellement disponible sur macOS et Windows.',
  advancedMode: 'Mode amélioré',
  advancedModeBody:
    'Utilise une disposition propre au bureau, avec des barres latérales, des panneaux de contenu et des contrôles de fenêtre adaptés.',
  advancedUnavailableLinux: 'Le mode amélioré est actuellement disponible sur macOS et Windows.',
  switchPresentationMode: 'Changer de mode de fenêtre',
  switchingPresentationMode: 'Enregistrement et préparation du redémarrage…',
  switchPresentationModeError: 'Impossible de changer de mode de fenêtre. Veuillez réessayer.',
  windowMaterial: 'Apparence de la fenêtre',
  windowMaterialBody:
    'Définit l’effet d’arrière-plan de la fenêtre. Un redémarrage de l’application est nécessaire pour appliquer le changement.',
  windowMaterialOff: 'Fond uni',
  windowMaterialTransparent: 'Fond en verre',
  webTitle: 'Navigateur et réseau local',
  webIntro:
    'Autorisez l’ouverture du Profil actuel dans un navigateur et choisissez les appareils qui peuvent y accéder.',
  openBrowser: 'Autoriser l’ouverture du Profil dans un navigateur',
  browserCompatibilityNotice:
    'L’accès par navigateur n’est disponible qu’en mode compatibilité. Sélectionnez d’abord le mode compatibilité pour l’activer.',
  lanAccess: 'Accès au LAN (HTTPS requis)',
  lanStatus: 'État du HTTPS sur le LAN',
  lanStatusInactive: 'Désactivé',
  lanStatusStarting: 'Démarrage',
  lanStatusReady: 'Prêt',
  lanStatusFailed: 'Échec du démarrage',
  lanError: 'Code d’erreur',
  browserUrls: 'Adresses d’accès au navigateur',
  copyBrowserUrl: 'Copier l’adresse',
  browserUrlCopied: 'Copié',
  lanHttpsUrls: 'Adresses HTTPS du LAN',
  lanTrustNotice:
    'Installez et approuvez le certificat ci-dessous sur chaque appareil utilisé pour la connexion. Contourner l’avertissement de certificat du navigateur ne garantit pas le bon fonctionnement de la page ; certains navigateurs peuvent encore restreindre des fonctionnalités de sécurité.',
  lanCaTitle: 'Approuver le certificat',
  lanCaFingerprint: 'Empreinte SHA-256 du CA local',
  lanCaDownloads:
    'Téléchargez, installez et approuvez ce certificat sur chaque appareil qui accédera à DSH Desktop :',
  lanWarningTitle: 'Activer l’accès au LAN ?',
  lanWarningBody:
    'Toute personne du même LAN disposant du lien d’accès peut utiliser DSH pour contrôler cet ordinateur. Ne partagez le lien qu’avec des personnes de confiance. Les connexions utilisent HTTPS ; chaque appareil doit installer et approuver le certificat fourni par cet ordinateur.',
  lanCancel: 'Annuler',
  lanConfirm: 'Activer l’accès au LAN',
  notificationsTitle: 'Notifications du bureau',
  notificationsIntro:
    'Recevez des notifications système à la fin ou en cas d’échec d’une tâche. Les notifications n’affichent pas le contenu des conversations.',
  notificationsEnabled: 'Activer les notifications du bureau',
  turnCompletion: 'Tour actuel terminé',
  turnFailure: 'Échec du tour actuel',
  jobCompletion: 'Tâche en arrière-plan terminée',
  jobFailure: 'Échec de la tâche en arrière-plan',
  scheduleCompletion: 'Tâche automatisée terminée',
  scheduleFailure: 'Échec de la tâche automatisée',
}
