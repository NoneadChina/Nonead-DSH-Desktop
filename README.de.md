<p align="center">
  <a href="https://www.nonead.com"><img src="https://www.nonead.com/assets/img/desktop-Nonead.jpg" alt="Nonead DSH Desktop, ein quelloffener Desktop-Client auf Basis von DeepSeek Harness" width="100%"></a>
</p>

<h1 align="center">Nonead DSH Desktop</h1>

<p align="center">
  <strong>Ein quelloffener Desktop-Client für Windows, macOS und Linux auf Basis von DeepSeek Harness.</strong>
</p>

<p align="center">
  Produkt <code>2.2.3</code> · DSH-Laufzeit <code>0.2.2-alpha.2</code> · Electron 44 · MIT License
</p>

<h3 align="center"><a href="https://www.nonead.com">Mit einem Klick herunterladen, sofort einsatzbereit.</a></h3>

<p align="center">
  Alles ist ein Plugin – auch der Desktop selbst.
</p>

<p align="center"><sub>Ein unabhängiges Open-Source-Projekt der Community. Es besteht keine Zugehörigkeit zu DeepSeek, keine Partnerschaft, keine Lizenzierung und keine Billigung durch DeepSeek.<br>An diesem Repository sind derzeit weder Mitarbeitende von DeepSeek noch Mitglieder des offiziellen Upstream-Teams von DeepSeek Harness beteiligt; die unter GitHub Contributors angezeigten Upstream-Beitragenden stammen aus der per Fork übernommenen und synchronisierten Commit-Historie.<br><a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · Deutsch · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a></sub></p>

<a id="toc"></a>

## Inhaltsverzeichnis

| Abschnitt | Inhalt |
| --- | --- |
| [Was das ist](#what) | Produktpositionierung und Prozessmodell |
| [Versionen und Laufzeit](#versions) | Versionen, Upstream-Pin, Abhängigkeitsbasis |
| [Download und Installation](#download) | Installation auf drei Plattformen |
| [Funktionsumfang](#features) | Desktop-Shell, Profile, Marktplatz, Updates |
| [Sicherheitsgrenzen](#security) | Renderer-Anmeldedaten, LAN, Update-Verifikation |
| [Dokumentation](#docs) | Einstiegspunkte für Anwender und Entwickler |
| [Repository-Struktur](#layout) | Verzeichnisse und die vier Workspaces |
| [Aus dem Quellcode bauen](#dev) | Umgebung, Befehle, Gates |
| [Veröffentlichung und Updates](#release) | Kanalprotokoll und Release-Ablauf |
| [Plugin-Ökosystem](#plugins) | Warum alles ein Plugin ist |
| [Verhältnis zum Upstream](#upstream) | Grenzen und Arbeitsteilung |
| [Changelog](#changelog) | Versionshistorie |
| [Bekannte Einschränkungen](#limits) | Verhalten, das Sie vorher kennen sollten |
| [Community](#community) | Diskussionskanäle |
| [Links](#links) | Projekte im Ökosystem |
| [License](#license) | Lizenz und Hinweise |

<a id="what"></a>

## Was das ist

Nonead DSH Desktop bringt die lokale Web UI, den Host-Dienst und das Plugin-System von [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) in eine native Desktop-Anwendung. Der Upstream-Quellcode läuft **unverändert** und ist auf eine bestimmte Version gepinnt; die Desktop-Shell verantwortet Fenster, Tray, Terminal, Auto-Updates, mehrere Arbeitsprofile (Profile) sowie die Paketierung und **wird selbst als DSH-Plugin eingebunden** – über dieselbe Kompositionsmechanik, die auch Drittanbieter-Plugins verwenden.

Das Produkt ist keine „Neuimplementierung des Clients“, sondern ein schlanker Electron-Host plus eine vollständige DSH-Laufzeit:

| Ebene | Ort | Zuständigkeit |
| --- | --- | --- |
| Desktop-Shell | Electron-Hauptprozess | Einzelinstanz-Sperre, Fenster und Materialien, Tray und Menüs, Berechtigungen, Terminal, Updates, Datenverzeichnis, Profilzustand |
| Host | Kindprozess im Node-Modus | Lädt die Patch-Ebene des Profils, startet den Upstream-Profil-Boot, stellt den Web-Carrier bereit und hostet Host-Plugins von Drittanbietern |
| Web-Carrier | Loopback-HTTP + WebSocket | Stellt die offizielle Web UI bereit (standardmäßig ein flüchtiger Port) |
| Renderer | Sandboxierte BrowserWindow | Lädt die offizielle Web UI und wird über einen nativen Anmeldedaten-Header identifiziert |

Shell und Host kommunizieren über genau einen IPC-Kanal zwischen Kindprozessen. Das Umschalten eines Profils oder Modus verwirft die gesamte Host-Generation und startet einen neuen Kindprozess; es wird kein Zustand über eine Generation hinweg zwischengespeichert. Der Renderer erhält niemals Electron-APIs – er erhält die offizielle Web UI plus die von der Shell erzeugten Anmeldedaten.

<a id="versions"></a>

## Versionen und Laufzeit

| Punkt | Wert |
| --- | --- |
| Produktversion | `2.2.3` (`nonead-dsh-desktop` und `dsh-plugin-desktop-beta` im Gleichschritt) |
| Workspace des Stable-Kanals | `nonead-dsh-desktop` (Root-Skripte mit Suffix `:stable`) |
| Workspace des Beta-Kanals | `dsh-plugin-desktop-beta` (Root-Skripte mit Suffix `:beta`) |
| DSH-Laufzeit | `0.2.2-alpha.2`, jede Abhängigkeit von `@deepseek-ai/dsh*` exakt gepinnt, Laufzeit lokal vendored |
| Vendored Laufzeit | `vendor/dsh-runtime/0.2.2-alpha.2/` (mehrere historische Versionsverzeichnisse bleiben erhalten) |
| Upstream-Pin | `f3803c96974ad4a94195fb97e5c637e9c2a3afe3fc48fa190a683e469daa699857e9afe8` (`channels.beta` in `upstream.json`, gespiegelt in `nonead-dsh-desktop/upstream-reference.json`) |
| Electron / Packager | Electron `44.0.0` / electron-builder `26.15.7` (`app-builder-lib` gepatcht) |
| Node / Yarn | Node `^22.19.0` oder `>=24.0.0`; Yarn `4.18.0` über Corepack (`nodeLinker: node-modules`) |
| Plugin-Marktplatz | `dshmarket` `1.70.1`, dazu `dsh-community-market` `0.1.0-dev.0` aus diesem Repository |
| Bridge zur Fernsteuerung | `@agents-anywhere/dsh-bridge-next` `2.1.0-desktop` (Upstream-Commit `39b82d4`) |
| Marken-Skin | `dsh-nonead-client-skin` (wird mit dem Installationsprogramm ausgeliefert, pro Profil eingebunden) |

`upstream.json` führt zwei vendored Laufzeitlinien: `stable` verweist auf Upstream `0.2.0-rc.2`, `beta` auf Upstream `0.2.2-alpha.2`. Was tatsächlich in einem Installationsprogramm landet, ist die Linie, die ein Workspace exakt pinnt – derzeit pinnen beide Desktop-Workspaces `0.2.2-alpha.2`. **Kanalnamen beschreiben Laufzeitlinien, nicht den Release-Kanal, den ein Workspace abfragt.**

<a id="download"></a>

## Download und Installation

Die offiziellen Installationsprogramme decken Windows x64, macOS (Universal, Intel und Apple Silicon) und Linux x64 (AppImage) ab. Eine zusätzliche Umgebung ist nicht erforderlich. Das AppImage und das deb für Linux x64 werden vom Beta-Kanal gebaut; der Stable-Kanal erzeugt unter Linux nur ein lauffähiges Verzeichnis, kein Installationsprogramm.

| Plattform | Download | Installation |
| --- | --- | --- |
| Windows x64 | [Installationsprogramm herunterladen](https://www.nonead.com/software/ndsh-desktop/downloads/windows) | NSIS-Installationsprogramm ausführen und den Anweisungen folgen |
| macOS Universal | [DMG herunterladen](https://www.nonead.com/software/ndsh-desktop/downloads/mac) | DMG öffnen und Nonead DSH Desktop in den Ordner „Programme“ ziehen |
| Linux x64 | [AppImage herunterladen](https://www.nonead.com/software/ndsh-desktop/downloads/linux) | Ausführbar machen und starten: `chmod +x Nonead-DSH-Desktop-*.AppImage && ./Nonead-DSH-Desktop-*.AppImage` |

Hinweise zu Linux: Manche Distributionen benötigen FUSE, alternativ können Sie mit `--appimage-extract-and-run` starten. Das In-App-Update prüft unter Linux **nur die Version und lädt niemals ein Installationsprogramm herunter**; aktualisieren Sie durch Herunterladen eines frischen AppImage. Nutzen Sie den Beta-Kanal, wenn Sie ein Linux-Installationsprogramm benötigen – der Stable-Kanal erzeugt unter Linux nur ein lauffähiges Verzeichnis.

Windows ARM64 ist **nur als experimenteller Build** verfügbar und wird nicht über die obigen Download-Links oder In-App-Updates ausgeliefert: Die Shell ist nativ für arm64 gebaut, die mitgelieferte Python-/Node-/Office-Laufzeit ist jedoch weiterhin die x64-Payload (ausgeführt über die Windows-Emulation), und das Artefakt wurde noch nicht auf ARM-Hardware ausgeführt. Bauen Sie es bei Bedarf selbst mit dem Befehl unter [Häufige Befehle](#dev).

Schritt-für-Schritt-Anleitung, Profile und Plugin-Befehle finden Sie im [Benutzerhandbuch](docs/user-guide.en.md); Fragen zu Plattformen und Geltungsbereich beantwortet die [FAQ](docs/faq.en.md).

<a id="features"></a>

## Funktionsumfang

| Funktion | Beschreibung |
| --- | --- |
| Native Desktop-Shell | Einzelinstanz-Sperre, native Fenster und Menüs, System-Tray, Dock-Symbol; die Fenstermaterialien sind an die Plattformfähigkeiten gebunden (macOS akzeptiert `off`/`transparent` und verwendet standardmäßig `transparent`, Linux akzeptiert beides, löst aber immer zu `off` auf, Windows nur `off`) |
| Lokale Host-Verwaltung | Die Shell startet den Host-Kindprozess und verwaltet dessen Lebenszyklus: zuerst geordnetes Herunterfahren, `SIGTERM` nach 10 s, `SIGKILL` nach weiteren 5 s; die Installation eines Updates setzt ein geordnetes Herunterfahren voraus und wird sonst abgelehnt |
| Offizielle Web UI | Bindet nur `127.0.0.1`, standardmäßig ein flüchtiger Port; die Shell erzeugt pro Host-Generation 32 zufällige Byte als Anmeldedaten und liefert sie über `x-dsh-desktop-renderer` aus |
| Profile und Ersteinrichtung | Profilverzeichnisse liegen unter `$DSH_HOME/profiles/<name>`; ein nicht initialisiertes Profil zeigt zuerst den Desktop-Einrichtungsassistenten (Fenstermodus und Material, Plugin-Marktplatz, Benachrichtigungen, Start im Standardbrowser, Umfang des Web-Zugriffs), bevor der Host startet |
| Browser- und LAN-Zugriff | „Im Browser öffnen“ steuert nur, ob der Systembrowser gestartet wird, und ändert nichts an der Exposition; LAN-Zugriff ist eine separate Option, die zusätzlich die aktuelle LAN-URL anzeigt |
| Integrierter Plugin-Marktplatz | DSH Community Market bietet die Ansichten Entdecken / Installierbar / Installiert / Quellen mit erweiterbaren Katalogquellen und geprüften Adaptern |
| Marken-Skin | `dsh-nonead-client-skin` wird mit dem Installationsprogramm ausgeliefert und vom Profil für jedes Profil eingebunden, ohne separate Installation |
| Auto-Update | Feste Versionsprüfung gegen `https://www.nonead.com/software/ndsh-desktop/version` mit aktueller Version, Kanal und einer zufälligen Installations-ID; Windows und macOS laden herunter und installieren, Linux prüft nur |
| Update-Erlebnis | Die Update-Karte zeigt die von der Versionsantwort gelieferten Versionshinweise, und das Tray-Menü sowie die nativen Dialoge des Beta-Kanals ergänzen einen Eintrag „Vollständige Versionshinweise anzeigen“; „Diese Version überspringen“ wird dauerhaft gespeichert, sodass eine unbeaufsichtigte geplante Prüfung sie nicht erneut anbietet; eine fehlgeschlagene Installation lässt sich wiederholen und auf jeden gespeicherten Stand zurücksetzen |
| Fenster- und Sitzungszustand | Merkt sich Fensterposition und -größe; eine gespeicherte Position wird nur wiederhergestellt, solange sie noch einen angeschlossenen Bildschirm überlappt, sodass ein abgezogener Monitor das Fenster nicht außerhalb des Bildschirms wiederherstellen kann |
| Deep Links und Autostart | `dsh-desktop://`-Links werden unterstützt, zum Beispiel öffnet `dsh-desktop://settings/general` direkt die Einstellungen; der Schalter für den Start bei der Anmeldung liest den tatsächlichen Betriebssystemzustand |
| Umgebungsdatei | Strikte geschichtete `.env`-Unterstützung ergänzt fehlende Variablen für den Host-Kindprozess und überschreibt niemals die vorhandene Umgebung |
| Marktplatz-Verbesserungen | Der Plugin-Marktplatz zeigt auch Nicht-Bildmedien als Vorschau an und kann ein Plugin anhand seines Namens installieren |
| Terminal und Arbeitsverzeichnis | Die Shell stellt Terminal- und Arbeitsverzeichnis-Funktionen als Desktop-Dienste für Plugins bereit |
| Experimentelle Funktionen | Das Onboarding aktiviert den Plugin-Marktplatz und Computer Use standardmäßig; Sprache, Übersetzung, Agent Team und Ralph sind mit der Laufzeit enthalten |

<a id="security"></a>

## Sicherheitsgrenzen

| Grenze | Tatsächliches Verhalten |
| --- | --- |
| Renderer-Identität | Nur Anfragen mit den Anmeldedaten der aktuellen Generation (`x-dsh-desktop-renderer`) gelten als Electron-Renderer; ist der Browserzugriff deaktiviert, erhalten alle anderen Anfragen 403 und bestehende Browser-WebSockets werden getrennt |
| Übertragung der Renderer-Anmeldedaten | Die Anmeldedaten liegen ausschließlich im Speicher des Hauptprozesses und des Hosts; der Host erhält beim Start eine Zeile über seine **private stdin**, und die Pipe wird sofort geschlossen, sodass sie niemals in die Umgebung des Kindprozesses, in argv oder in eine Datei gelangen (die alte Implementierung nutzte eine Umgebungsvariable, die Prozesse desselben Benutzers aus der Prozessumgebung oder einem Absturzabbild lesen konnten, um den Renderer zu imitieren) |
| Web-Zugriffsgate | Hat der Host keine Anmeldedaten, **verweigert er Anfragen der Browser-Klasse (fail closed)** und protokolliert eine Warnung, statt sie zuzulassen; der `/connect`-Login-Austausch und schreibgeschützte Anfragen sind im Code ausgenommen, und Marktplatz-Routen benötigen auch für Lesezugriffe Verbindungsanmeldedaten |
| LAN-Zugriff | **Keine Authentifizierung**: Wer im selben Netzwerk den Port erreichen kann, kann DSH öffnen und diesen Rechner bedienen. Aktivieren Sie dies nur in vollständig vertrauenswürdigen Netzwerken |
| Verifikation des Installationsprogramms | Der Download-Pfad unterstützt ein vom Server veröffentlichtes `installerSha256` und erzwingt es als harte Bedingung, doch der Versions-Endpunkt veröffentlicht dieses Feld noch nicht; bis dahin prüft Windows nur `ProductName` und `ProductVersion` aus der PE-Versionsresource, während macOS Bundle-Identität, eingebettetes Manifest, Codesignatur und Team Identifier prüft; diese Identitätsprüfung existiert nur in der Stable-Shell, wohingegen der Download-Pfad der Beta-Shell nur die Magic Bytes und die Größe des Installationsprogramms prüft, bevor er es ausführt |
| Fehlkonfiguration von Plugins | Eine Patch-`id`, die auf nichts passt, protokolliert `entry not found` und wird übersprungen; ein abweichender `name` protokolliert `name mismatch ... skipping`; ein falscher `inject`-Dienstname **löst jedoch keinen Fehler aus** – das Plugin bleibt dauerhaft ausstehend und die Oberfläche zeigt lediglich unerklärliche HTTP-4xx |

<a id="docs"></a>

## Dokumentation

Anwender beginnen am besten mit dem [Benutzerhandbuch](docs/user-guide.en.md); die Entwicklerdokumentation ist nur beim Erweitern oder Warten relevant. Der vollständige Index steht im [Dokumentationsindex](docs/README.en.md).

### Benutzerdokumentation

| Ziel | Einstieg |
| --- | --- |
| Installation, Profile, Modi, Terminal, Plugin-Befehle und Updates | [Benutzerhandbuch](docs/user-guide.en.md) |
| Direkte Antworten zu Plattformen, mitgelieferter Umgebung, Daten, Plugins und Updates | [FAQ](docs/faq.en.md) |
| Verstehen, warum es dieses Projekt gibt | [Warum Nonead DSH Desktop](docs/why-desktop.en.md) |
| Die Versionshistorie lesen | [Changelog](CHANGELOG.de.md) |

### Entwickler- und Maintainer-Dokumentation

| Ziel | Einstieg |
| --- | --- |
| Shell, Host-Kindprozess, Web-Carrier und Paketierung | [Architektur](docs/architecture.en.md) |
| Normale oder Desktop-Plugins schreiben | [Plugin-Entwicklung](docs/plugin-development.en.md) |
| Den Vorschlag zum Plugin-Ökosystem lesen | [Vorschlag für ein DSH-Plugin-Ökosystem](docs/plugin-ecosystem.en.md) |
| `desktopProfiles` / `desktopPnpm` und andere Desktop-Dienste nutzen | [Desktop-Plugin-Dienste](dsh-plugin-desktop-beta/docs/plugin-services.md) |
| An der Diskussion um den einheitlichen Plugin-Vertrag teilnehmen | [DSH Community Fabric Draft](dsh-community-fabric/README.md) |
| Produkt- und Sicherheitsdesign des Marktplatzes lesen | [DSH Community Market](dsh-community-market/README.md) |
| Build, Release und bekannte Einschränkungen auf Paketebene | [`dsh-plugin-desktop-beta/README.md`](dsh-plugin-desktop-beta/README.md) |
| Der Shell-Workspace des Stable-Kanals | [`nonead-dsh-desktop/README.md`](nonead-dsh-desktop/README.md) |
| Das Marken-Skin-Plugin | [`dsh-nonead-client-skin/README.md`](dsh-nonead-client-skin/README.md) |

<a id="layout"></a>

## Repository-Struktur

Das Root-Verzeichnis ist ein Yarn-`4.18.0`-Workspace (`nodeLinker: node-modules`) mit folgenden Mitgliedern und Zuständigkeiten:

| Pfad | Zuständigkeit |
| --- | --- |
| `nonead-dsh-desktop/` | Desktop-Workspace des Stable-Kanals: eigene Shell (Profile und Wiederherstellung, Fenstersteuerung, Onboarding), Agents-Anywhere-Bridge und Community-Market-Adapter, Electron-Bootstrap und Paketierung |
| `dsh-plugin-desktop-beta/` | Desktop-Workspace des Beta-Kanals: Host-/Client-Doppelseite, Electron-Bootstrap, Paketierung und Release-Tests |
| `dsh-community-market/` | Produkt- und Sicherheitsdesign des integrierten Plugin-Marktplatzes, Katalog-Provider-Vertrag, Tests und Build |
| `dsh-community-fabric/` | RFC für Community-Interoperabilität: Manifest/Capability, Runtime/Presentation, Service-Komposition und Provenienzdiagnose |
| `dsh-nonead-client-skin/` | Marken-Skin, der mit dem Installationsprogramm ausgeliefert wird, über eine `file:`-Abhängigkeit eingebunden ist und nicht zur Root-Workspace-Liste gehört |
| `vendor/dsh-runtime/<version>/` | Pro Kanal vendored DSH-Laufzeitpakete und `manifest.json` |
| `vendor/agents-anywhere/` | Vendored Pakete der Agents-Anywhere-Bridge |
| `patches/` | Yarn-Patches für den Electron-Packager, pnpm, `open`, `fs-ext`, den DSH-Kindprozess und mehr |
| `scripts/` | Root-Gates und Release-Skripte (zweisprachige Dokumente, Abhängigkeitsrichtung des Marktplatzes, vendored Laufzeit, Symbole, Layout, AA-Release) |
| `docs/` | Produktdokumentation; `docs/evidence/` bewahrt gemessene Release- und Installer-Aufzeichnungen auf |
| `deepseek-harness/` | Schreibgeschütztes Upstream-Submodul, gepinnt auf `channels.beta.commit` in `upstream.json` |

**Das Submodul ist für die tägliche Entwicklung nicht erforderlich.** Die Laufzeit ist vendored, daher benötigen `corepack yarn install`, `build`, `typecheck`, `test`, `dev:*` und `dist:*` es nicht; nur die `upstream:*`-Skripte (Laufzeit neu bauen und neu paketieren) brauchen es. `corepack yarn check:layout` prüft jedoch den Commit und den Worktree des Submoduls und schlägt in einem nicht initialisierten Klon zwangsläufig fehl – das ist erwartet.

<a id="dev"></a>

## Aus dem Quellcode bauen

### Voraussetzungen

- Node.js `^22.19.0` oder `>=24.0.0`
- Root-Yarn `4.18.0` über Corepack (installieren Sie die Root-Abhängigkeiten nicht mit pnpm oder npm)
- Git; wird nur benötigt, um das Upstream-Submodul zu initialisieren, wenn die Laufzeit neu gebaut wird

```sh
git clone https://github.com/NoneadChina/Nonead-DSH-Desktop.git
cd Nonead-DSH-Desktop
corepack yarn install
corepack yarn dev:beta     # Beta-Workspace
# corepack yarn dev:stable # Workspace des Stable-Kanals (nonead-dsh-desktop)
```

Wenn Sie tatsächlich Upstream-Quellcode benötigen:

```sh
git submodule update --init --recursive
```

### Häufige Befehle

| Befehl | Zweck |
| --- | --- |
| `corepack yarn dev:beta` / `dev:stable` | Startet den Entwicklungsablauf für den jeweiligen Workspace (prüft das gepinnte `dshmarket`, bereitet AA-Artefakte vor und baut zuerst den Marktplatz) |
| `corepack yarn build` | Baut den Marktplatz, den Beta-Workspace und den Workspace des Stable-Kanals (prüft zuvor ebenfalls das gepinnte `dshmarket`) |
| `corepack yarn typecheck` | Typprüfung für alle drei Workspaces |
| `corepack yarn test` | Unit-Tests für alle drei Workspaces |
| `corepack yarn check` | Vollständiges Headless-Gate: Layout, Architekturrichtung, vendored Laufzeit, zweisprachige Dokumente, AA-Connector, Checks je Workspace |
| `corepack yarn check:ci` | Die Kette, die CI tatsächlich ausführt: wie `check`, aber der Beta-Workspace nutzt `check:ci` (lässt das von upstream pausierte `verify:aa` weg), statt das Manifest innerhalb der CI umzuschreiben |
| `corepack yarn check:layout` | Workspace-Topologie, exakte Pins, Submodul, vendored Laufzeit, Symbole und Layout-Gates |
| `corepack yarn check:bilingual-docs` | Prüft, ob die in `*.i18n.yaml` erfassten Git-Blob-Hashes zu den Dokumenten passen |
| `corepack yarn check:vendored-runtime` | Prüft `vendor/dsh-runtime/` gegen `upstream.json` |
| `corepack yarn market:prepare` / `market:check` | `market:prepare` hebt `dshmarket` auf npm `latest` (nur die `resolutions`/Abhängigkeiten der beiden Desktop-Workspaces und `yarn.lock`); `market:check` ist die Offline-Konsistenzprüfung, die jeder Build ausführt, und nur `--latest` greift auf das Netzwerk zu |
| `corepack yarn aa:prepare-release` / `aa:check` | Baut oder prüft Agents-Anywhere-Release-Artefakte |
| `corepack yarn package:dir:beta` | Erzeugt ein nicht paketiertes Anwendungsverzeichnis |
| `corepack yarn dist:win:beta` / `dist:mac:beta` / `dist:win-portable:beta` | Erzeugt die Release-Artefakte der jeweiligen Plattform |
| `DSH_PACKAGE_ARCH=arm64 corepack yarn dist:win:stable` | Erzeugt ein experimentelles Windows-ARM64-Installationsprogramm (standardmäßig x64; ein architekturübergreifender Build überspringt die Smokes, die nur auf diesem Host laufen können) |

Konventionen:

- Root-`build`, `dev:*` und `dist:*` führen zuerst `corepack yarn market:check` aus: Der Schritt prüft offline, ob die committete `dshmarket`-Version, die Lockfile und der Kompatibilitätspatch übereinstimmen, ohne das Netzwerk zu erreichen oder Manifeste umzuschreiben. Das Verschieben des Pins erfordert, dass ein Mensch `corepack yarn market:prepare` ausführt und Version, Lockfile und Patch gemeinsam committet.
- `nonead-dsh-desktop` und `dsh-plugin-desktop-beta` sind **getrennte Workspaces**: Gemeinsame Änderungen müssen in beiden landen, wobei ihre deklarierten Unterschiede erhalten bleiben; führen Sie vor einem Release `corepack yarn check` und die Checks der jeweiligen Workspaces aus.
- Nach dem Bearbeiten von `README*.md` oder `CHANGELOG*.md` in einer beliebigen Sprache aktualisieren Sie die Git-Blob-Hashes in der passenden `*.i18n.yaml` (ermitteln Sie sie mit `git hash-object`), sonst schlägt `check:bilingual-docs` fehl.
- `corepack yarn check:layout` benötigt ein initialisiertes Submodul; in einer reinen Headless-Umgebung validieren Sie Geschäftscode stattdessen mit `typecheck` / `test` / dem `check` des jeweiligen Workspace.
- **Die CI darf nicht zulassen, dass der geprüfte Code entscheidet, was läuft**: Der `changes`-Job stellt `scripts/` aus der **Pull-Request-Basis** wieder her, bevor er den Klassifizierer und die Dokumentations- und Markt-Gates ausführt (Dokumente stammen weiterhin aus dem Arbeitsbaum); `workflow_dispatch` hat keine Basis und fällt mit einer Warnung auf die Head-Kopie zurück. Die CI führt `corepack yarn check:ci` aus (= lokales `check` ohne `verify:aa`), statt `dsh-plugin-desktop-beta/package.json` zur Laufzeit umzuschreiben.
- **Versionsgleichheit ist Teil des Gates**: `scripts/verify-layout.mjs` verlangt, dass die `version` beider Workspaces mit der neuesten Überschrift `## <version> — <date>` in `CHANGELOG.md` übereinstimmt; wird bei einem Release eine der beiden Seiten vergessen, schlägt das Gate fehl.

<a id="release"></a>

## Veröffentlichung und Updates

- **Zwei Produktlinien**: Sie werden von den beiden Desktop-Workspaces erzeugt. Beta- und Stable-Installationsprogramme unterscheiden sich in Bundle-ID, Artefaktpräfix und Update-Kanal und dürfen nicht vermischt werden.
- **Kanalprotokoll**: Die Versionsprüfung ruft `https://www.nonead.com/software/ndsh-desktop/version` auf und meldet die aktuelle Version in `X-DSH-Desktop-Version`, `stable` / `beta` in `X-DSH-Desktop-Channel` sowie eine lokal erzeugte, persistierte zufällige UUID in `X-DSH-Desktop-Installation-Id`. Downloads von Installationsprogrammen tragen `channel` und `X-DSH-Desktop-Target-Version`, aber niemals die Installations-ID oder die aktuelle Version.
- **Kanaldurchsetzung**: Die Serverantwort muss den Kanal zurückspiegeln; der Stable-Kanal akzeptiert nur reines SemVer, der Beta-Kanal nur `-beta.N`, und der Client lädt niemals stillschweigend kanalübergreifend.
- **Versionskonsistenz**: Das hochgeladene Artefakt, die Zuordnung von Version zu Datei in der reinen Download-URL und die vom Endpunkt gemeldete Version müssen übereinstimmen – eine Abweichung zeigt sich als 404 statt als falsche Installation.
- **Release-Voraussetzungen**: Führen Sie zuerst `corepack yarn aa:prepare-release` aus; bringt dieses Release ein neues `dshmarket` mit, muss ein Mensch zusätzlich `corepack yarn market:prepare` ausführen und committen. Die Windows-Distributionsbefehle prüfen AA-Artefakte zusätzlich mit `--verify-release`.

<a id="plugins"></a>

## Plugin-Ökosystem

Plugins erweitern DSH – Modelle, Werkzeuge, Oberfläche und Arbeitsabläufe sind allesamt Plugins, die sich wie Bausteine zusammensetzen. Nonead DSH Desktop verändert keinen Upstream-Quellcode und ist keine fest verdrahtete Shell: Der gepinnte Upstream läuft unverändert, und die Desktop-Shell selbst ist über dieselbe Regel „alles ist ein Plugin“ eingebunden.

Wer Plugins schreibt, muss nur drei Dinge kennen:

1. **Normale DSH-Plugins** werden genau wie in jeder DSH-Umgebung entwickelt – siehe [Plugin-Entwicklung](docs/plugin-development.en.md).
2. **Desktop-Dienste** (`desktopProfiles`, `desktopPnpm`, …) lassen Plugins Profile einsehen oder wechseln und Plugins installieren, aktualisieren oder entfernen – siehe [Desktop-Plugin-Dienste](dsh-plugin-desktop-beta/docs/plugin-services.md).
3. **Komposition und Patches**: Ein Profil wird durch Stapeln von Patch-Ebenen zusammengesetzt, wobei `id` auf eine vorhandene Zeile passt und `insert` neue Zeilen anhängt; beachten Sie die drei „still wirkungslosen“ Fehlerarten unter [Sicherheitsgrenzen](#security).

Die Vision und die drei Prinzipien stehen im [Vorschlag für ein DSH-Plugin-Ökosystem](docs/plugin-ecosystem.en.md); der Community-Vorschlag für einen einheitlichen Plugin-Vertrag ist [Community Fabric](dsh-community-fabric/README.md).

<a id="upstream"></a>

## Verhältnis zum Upstream

Nonead DSH Desktop ist ein unabhängiges Community-Projekt, das auf [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) und dem Cordis-Plugin-Modell aufbaut und von **Nonead Corporation** entwickelt und gepflegt wird.

Der Upstream liefert die zentralen Agent-Funktionen, das Plugin-System, die Web UI und die Laufzeitpakete. Dieses Repository verantwortet:

- Die Paketierung der Desktop-Anwendung (Electron-Hauptprozess, Fenster, Tray, Menüs, Materialien)
- Starten, Stoppen und Wiederherstellen des lokalen Host-Dienstes, einschließlich Absturz-Fallbacks
- Profile und Patch-Ebenen, den Einrichtungsassistenten beim ersten Start, die Steuerung des Browser- und LAN-Zugriffs
- Das Mitliefern von Plugin-Marktplatz und Marken-Skin im Installationsprogramm
- Builds für Windows / macOS / Linux, Signierung und Release-Ablauf sowie Auto-Update

Wenn Sie DeepSeek Harness nur über die Kommandozeile nutzen oder am Kern mitarbeiten möchten, schauen Sie stattdessen im Upstream-Repository vorbei.

<a id="changelog"></a>

## Changelog

Die vollständige Historie steht im [Changelog](CHANGELOG.de.md) ([中文](CHANGELOG.md)). Die letzten Releases:

| Version | Datum | Highlights |
| --- | --- | --- |
| `2.1.15` | 2026-10-22 | Versionshinweise in der Update-Karte, im Tray und in nativen Dialogen, Überspringen einer Version, Wiederholen der Installation und Snapshot-Rollback; gemerkter Fensterzustand, geschichtete `.env`, `dsh-desktop://`-Deep-Links und Start bei der Anmeldung; Medienvorschau und Installation nach Namen im Marktplatz; `dshmarket` `1.66.45` |
| `2.2.3` | 2026-10-29 | Die Desktop-Shell ist vollständig in acht Sprachen lokalisiert (Chinesisch, Englisch, Japanisch, Spanisch, Französisch, Deutsch, Russisch, brasilianisches Portugiesisch): fünf neue Shell-Wörterbücher plus Wörterbücher für die Einstellungsseite in sechs Sprachen, vorlagenbasierte Nachschlagevorgänge für interpolierte Dialoge, und der Locale-Namespace des Clients und die nativen Menüs folgen derselben Sprachmenge |
| `2.2.2` | 2026-10-28 | Laufzeit auf DSH `0.2.2-alpha.2` umgestellt (370 Pakete neu vendored, 24 Versionspatches und der Marktplatz-Patch neu basiert), `dshmarket` auf 1.73.1 gehoben, die Agents-Anywhere-Bridge für die neuen Peer-Bereiche neu gebaut und die Produktversion auf 2.2.2 gehoben |
| `2.1.18` | 2026-10-24 | Laufzeit auf DSH `0.2.2-alpha.2` umgestellt (344 Pakete neu vendored, 24 Patches neu basiert), die Agents-Anywhere-Bridge aus dem Quellcode mit neu basiertem Connector-Patch gebaut, ein experimenteller Windows-ARM64-Build erscheint, und Text sowie Position des Fortschritts der Update-Karte sind korrigiert; enthält die Audit-Fix-Serie von 2.1.17 |
| `2.1.17` | 2026-10-24 | Audit-Fix-Serie: Refresh-Race im Wiederherstellungsassistenten, Inode-Nachprüfung von Prüfpunkten und Degradation auf einen Slot, atomare Schreibvorgänge für Einstellungen, Freigabe des Fehlerpfads beim Update, Plugin-Status und Staging-Aufräumen, Besitz der Tray-Dialoge, Marktplatz-Paginierung und Skin-Deklaration, CI-Gate-Fixes |
| `2.1.16` | 2026-10-22 | Sicherheits- und Gate-Fixes: CI-Gates führen den Klassifizierer aus der Basis aus, Electron-Fuses verschärft (`NODE_OPTIONS`/`--inspect` geschlossen, Stable lädt nur aus `app.asar`; `runAsNode` bleibt, weil die Host-/CLI-/pnpm-Shims ihn benötigen, und ist jetzt durch layout-abgeleitete Assertions gepinnt), Renderer-Anmeldedaten über eine private Pipe injiziert, Web-Gate verweigert Anfragen im Fehlerfall (fail closed), Allowlist für Deep-Link-Aktionen, base64url-Maskierung von Secrets; die Kopplung aus `asarUnpack` und `files[].from` der Stable-Shell ist jetzt durch einen präfixableitenden Test gepinnt (die bestehenden Patterns wurden als korrekt verifiziert), Stable-Packaging-CI ergänzt, und `verify-layout` erzwingt jetzt Versionsgleichheit |
| `2.1.13` | 2026-10-21 | Laufzeit auf DSH `0.2.1-rc.2` umgestellt, `dshmarket` `1.66.44`, AA-Bridge `39b82d4`, neues Boot-Wortzeichen und Onboarding-Hinweis zum API-Schlüssel, bei Überlauf der AA-Warteschlange werden Ereignisse verworfen statt abzustürzen |

<a id="limits"></a>

## Bekannte Einschränkungen

- **Das In-App-Update prüft unter Linux nur die Version** und lädt niemals ein Installationsprogramm herunter; aktualisieren Sie durch Herunterladen eines frischen AppImage.
- **Windows ARM64 wird als experimenteller Build ausgeliefert**: `dist:win:stable` erzeugt standardmäßig nur das x64-Installationsprogramm; arm64 erfordert `DSH_PACKAGE_ARCH=arm64` (kombinieren Sie es mit `DSH_PACKAGE_OUTPUT_DIR` für ein separates Ausgabeverzeichnis). Die Shell ist nativ für arm64 gebaut, während die mitgelieferte Laufzeit auf der x64-Payload bleibt (Windows-Emulation), ein architekturübergreifender Build überspringt die Smokes, die nur zur Laufzeit möglich sind, und der Update-Kanal führt derzeit ein einziges `windows`-Artefakt, sodass er x64 und arm64 nicht nebeneinander ausliefern kann.
- **Windows-Installationsprogramme werden noch nicht kryptografisch verifiziert**: Der Download-Pfad unterstützt ein serverseitiges `installerSha256`, aber der Versions-Endpunkt veröffentlicht es nicht, daher werden derzeit nur `ProductName` / `ProductVersion` verglichen (nur Stable-Shell; die Beta-Shell prüft nur die Magic Bytes und die Größe des Installationsprogramms und führt es dann aus).
- **Der LAN-Zugriff hat keine Authentifizierung** – er übergibt das DSH dieses Rechners an alle im selben Netzsegment.
- **Ein falscher `inject`-Dienstname eines Plugins scheitert stillschweigend** als dauerhaft ausstehendes Plugin und zeigt sich nur als HTTP-4xx.
- Ein lokales `yarn install` kann den Inhaltsfingerabdruck von `dsh-nonead-client-skin` in `yarn.lock` neu schreiben (nicht maschinenübergreifend reproduzierbar); **committen Sie solche lokal erzeugten Lockfile-Änderungen nicht**.

<a id="community"></a>

## Community

- Discord: [der Nonead-DSH-Desktop-Community beitreten](https://discord.gg/TJeGqKRNM)
- WeChat Work und QQ-Gruppen: Schreiben Sie nach dem Beitritt @王博升Benson an oder fordern Sie die Einladung per E-Mail an
- Interesse, im Team mitzuarbeiten: Kontakt [t4wefan@qq.com](mailto:t4wefan@qq.com)

<a id="links"></a>

## Links

Ökosystemprojekte und Entwicklerwerkzeuge rund um DeepSeek Harness:

| Projekt | Beschreibung | Link |
| --- | --- | --- |
| dshfind | Lern- und Austauschcommunity für DeepSeek Harness (DSH). | [GitHub](https://github.com/hikariming/dshfind) · [Website](https://dshfind.com) |
| DSH 1024Store | Community-Plugin-Katalog für DSH, mit quelloffenem Marktplatz, Katalog-Pipeline und öffentlicher Query-API. | [GitHub](https://github.com/imsai-sh/awesome-deepseek-harness-plugins) |
| Awesome DSH Plugin | Kuratierte Liste von DeepSeek Harness (DSH)-Plugins. | [GitHub](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) |
| dsh-market | Visueller Plugin-Marktplatz in DSH mit Durchsuchen, Suche und Ein-Klick-Installation. | [GitHub](https://github.com/dsh-market/dsh-market) |
| ModLens | OCR, Layout- und Semantikerkennung für DSH und rein textbasierte Coding-Agenten. | [GitHub](https://github.com/liustack/modlens) |
| DeepSeek Harness orange book | Community-Handbuch mit gemessener Praxis zu DeepSeek Harness. | [GitHub](https://github.com/alchaincyf/deepseek-harness-orange-book) |
| dsh-web-ui | Sammlung von DeepSeek Harness Web-UI-Plugins und -Skins. | [GitHub](https://github.com/zhu1090093659/dsh-web-ui) |
| dsh-TUI | Interaktive Vollbild-Terminaloberfläche für DeepSeek Harness. | [GitHub](https://github.com/ccch1mneyyy/dsh-TUI) |
| dsh-context | Kontext-Insight-Panel für DSH: Dashboard, der Befehl `/context` sowie ein Browser. | [GitHub](https://github.com/bowenliang123/dsh-context) |
| Agents-Anywhere | Steuern Sie einen Coding-Agenten auf Ihrem Computer von Ihrem Smartphone aus. | [GitHub](https://github.com/anywhere-labs/Agents-Anywhere) |
| DSH-better-sidebar | Sidebar-Workbench für DSH mit Dateien, Terminal, Git und Subagenten. | [GitHub](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Awesome DeepSeek Harness | Kuratierte Liste von DSH-Plugins, Werkzeugen und Infrastruktur. | [GitHub](https://github.com/0xsline/awesome-deepseek-harness) |

<a id="license"></a>

## License

Copyright © 2026 **Nonead Corporation**. Veröffentlicht unter der [MIT License](LICENSE).

> „DeepSeek Harness“ ist eine eingetragene Marke von DeepSeek. Der Name wird ausschließlich verwendet, um Kompatibilität, technische Herkunft und die Beziehung zur Upstream-Software zutreffend zu beschreiben.

> Dieses Projekt ist vollständig kostenlos und quelloffen. Wenn Ihnen jemand diese Software in irgendeiner Form verkauft, lehnen Sie das Geschäft ab.

> Nonead DSH Desktop ist ein unabhängiges Community-Projekt und steht in keiner Zugehörigkeit, Partnerschaft, Lizenzierung oder Billigung durch DeepSeek.
