<p align="center">
  <strong>Nonead DSH Desktop · Änderungsprotokoll</strong><br>
  <sub><a href="CHANGELOG.md">中文</a> · <a href="CHANGELOG.en.md">English</a> · <a href="CHANGELOG.ja.md">日本語</a> · <a href="CHANGELOG.es.md">Español</a> · <a href="CHANGELOG.fr.md">Français</a> · Deutsch · <a href="CHANGELOG.ru.md">Русский</a> · <a href="CHANGELOG.pt.md">Português</a></sub>
</p>

# Änderungsprotokoll

Diese Datei dokumentiert die für Nutzer sichtbaren Änderungen an Nonead DSH Desktop. Jede Version hebt die Versionsnummer in beiden Desktop-Workspaces (`nonead-dsh-desktop` und `dsh-plugin-desktop-beta`) gemeinsam an; die Versionsnummer erscheint außerdem in den Dateinamen der Installationspakete, in der Antwort des Update-Endpunkts und im Mapping der direkten Download-URLs, und alle drei müssen übereinstimmen.

Konventionen für die Pflege:

- Jede Veröffentlichung ergänzt einen Eintrag je Sprache (`CHANGELOG.md`, `CHANGELOG.en.md` sowie die Versionen ja/es/fr/de/ru/pt) und aktualisiert die in `CHANGELOG.i18n.yaml` hinterlegten Git-Blob-Hashes; andernfalls schlägt `corepack yarn check:bilingual-docs` fehl.
- Einträge halten ausschließlich Änderungen fest, die Nutzer wahrnehmen können, sowie Grenzänderungen, die Maintainer kennen müssen; reine Refactorings erhalten keinen eigenen Eintrag.
- Die frühere Historie findet sich in den Git-Tags (`v1.7.3`, `v2.0.7`, `v2.0.8`, `v2.1.3`, `v2.1.4`, `v2.1.5`) und in der Commit-Historie.

## 2.2.3 — 2026-10-29

Die Desktop-Shell ist in acht Sprachen lokalisiert (vereinfachtes Chinesisch, Englisch, Japanisch, Spanisch, Französisch, Deutsch, Russisch und brasilianisches Portugiesisch):

- Shell-Texte: Für Spanisch, Französisch, Deutsch, Russisch und brasilianisches Portugiesisch kommen Wörterbücher mit je 209 Einträgen zu den bestehenden Sprachen hinzu; native Dialoge, die Berechtigungsansicht, Computer Use, die Seite Einstellungen, die Plugin-Steuerung und die Bezeichnung des Terminalmodus laufen einheitlich über `desktopText`, und die nativen Menüs sowie die gespeicherte Sprache der Oberfläche folgen demselben Satz von acht Sprachen.
- Seite Einstellungen: Einstellungswörterbücher in sechs Sprachen (je 125 Einträge) decken die gemeinsam genutzten Bereiche Plugin-Marktplatz, Fernsteuerung, Fenster, Browser und lokales Netzwerk sowie Benachrichtigungen ab, statt auf Englisch zurückzufallen.
- Interpolierte Texte: elf Dialoge mit Platzhaltern (Profil entfernen und wechseln, Plugin aktivieren/deaktivieren/deinstallieren, Datenverzeichnis und Update-Status) schlagen jetzt `{name}`-Vorlagen nach und setzen den Wert ein, sodass sie in sechs Sprachen nicht mehr auf Englisch zurückfallen.
- Renderer: Die Rückmeldungstexte der Wiederherstellung wurden aus dem Modul herausgelöst, das Node-Built-ins importiert; der native-ui-Build meldet keine Externalisierungswarnungen für `node:fs`/`node:path`/`node:crypto` mehr.
- Abgrenzung: Der Wiederherstellungsassistent und die Profilauswahl stammen aus dem gemeinsamen Workspace `dsh-plugin-desktop-beta` und bleiben ausschließlich chinesisch/englisch.
- Version: Das Produkt wechselt in beiden Desktop-Workspaces von 2.2.2 auf **2.2.3**.
- Dokumentation: README und CHANGELOG erscheinen jetzt auch auf Japanisch, Spanisch, Französisch, Deutsch, Russisch und brasilianischem Portugiesisch; das Bilingual-Gate akzeptiert nun mehrsprachige Aufzeichnungen (mindestens zwei Dokumente pro Aufzeichnung).


## 2.2.2 — 2026-10-28

Die Runtime wechselt auf DSH `0.2.2-alpha.2`, der Marktplatz steigt auf 1.73.1:

- Runtime-Upgrade: Der Beta-Kanal springt von dsh `0.2.1-rc.3` auf **`0.2.2-alpha.2`** (Submodul-Pin `1f81c047` → `f3803c96`, Upstream „release(dsh): 0.2.2-alpha.2“) – die Runtime wird neu gepackt und neu vendort (370 Pakete statt 344), und alle 24 Versionspatches werden neu aufgesetzt. Sieben Pakete mussten semantisch neu verankert werden, weil sich ihre gepackte Ausgabe geändert hat: Die Bundle-Dateinamen in `dsh`, `dsh-sandbox-windows-acl` und `dsh-web-frontend` tragen neue Hashes; `dsh-client-ui-plugin-manager` wurde upstream so umgebaut, dass `available` aus `listed` abgeleitet wird, aber nie definiert ist (dieser Patch stellt die Desktop-Slots wieder her und liefert die fehlende Definition); `dsh-client-ui-settings-account` hat das Zurück-Symbol des Onboardings in eine Modulvariable verschoben; `dsh-client-ui-directory-picker-browse` ist auf neun Sprachwörterbücher gewachsen; `dsh-client-ui-primitives` hat breite Tabellen auf eine nur bei Hover sichtbare Bildlaufleiste umgestellt, die dieser Patch wieder zu einem dauerhaft sichtbaren schmalen Balken macht. Der Runtime-Snapshot von rc.3 und die zugehörigen Patches bleiben als Historie erhalten.
- Abhängigkeitsoberfläche: `@deepseek-ai/cordis` geht auf 4.0.6-alpha.1, `schemastery` auf 3.18.6-alpha.1, und drei Cordis-Plugin-Pakete steigen je eine Minor-Alpha-Stufe, sonst schlagen die Peer-Prüfungen von 0.2.2-alpha.2 fehl; `nonead-dsh-desktop` wird manuell an den Beta-Kanal angeglichen, da es zur Stable-Linie gehört und außerhalb der automatisch synchronisierten Workspace-Liste liegt.
- Marktplatz: `dshmarket` 1.70.1 → **1.73.1**, der Desktop-Patch (Selbstupdate-Eintrag, vom Host bereitgestellte Versionen, Baseline-Vergleich des Testlaufs) wird auf 1.73.1 neu aufgesetzt; upstream hat den Update-Cache auf `recheckAt`-Semantik umgestellt, deshalb ist der `checkUpdates`-Hunk gegen die neue Struktur neu geschrieben.
- Agents Anywhere bridge: für die neuen Peer-Bereiche neu gebaut (Artefakt `rd9c47cbc`, Pin unverändert bei `39b82d4`), Connector-Patch unverändert.
- Version: Das Produkt wechselt in beiden Desktop-Workspaces von 2.1.18 auf **2.2.2**.

## 2.1.18 — 2026-10-24

Upstream-Runtime-Upgrade, ein Quellbau von Agents Anywhere und ein experimenteller Windows-ARM64-Build (enthält den Audit-Fix-Batch aus 2.1.17):

- Upstream-Runtime-Upgrade: Der Beta-Kanal ist von dsh `0.2.1-rc.2` auf **`0.2.1-rc.3`** gestiegen (Submodul-Pin `687f282e` → `1f81c047`): Die 24 Versionspatches wurden auf rc.3 neu aufgesetzt, `vendor/dsh-runtime/0.2.1-rc.3/` wurde neu vendort (344 Pakete), und die Root-Manifeste, beide Desktop-Workspaces sowie die Peer-Bereiche der Agents Anywhere bridge folgen mit; die abgelösten Runtime-Snapshots und Patches von rc.2 werden nicht mehr verfolgt.
- Agents Anywhere bridge: jetzt **aus dem Quellcode gebaut** (`39b82d4`, zuvor ein wiederverwendetes Artefakt), der Connector-Patch ist auf das neue Artefakt neu aufgesetzt – das Health-Reporting blockiert das Veröffentlichen von Benachrichtigungen nicht mehr, die Umschreibung der reinen IPv6-Adresse in `NO_PROXY` und die Meldung der Betriebsbereitschaft bleiben erhalten, und die Änderung am answer-provider, die durch den Upstream-Umbau auf `interactionPeer(connection)` abgelöst wurde, entfällt; die Python-Dateien im Artefakt sind auf LF normalisiert, damit der Patch reproduzierbar anwendbar ist.
- Windows ARM64 (experimentell): Ein neuer Build-Pfad `DSH_PACKAGE_ARCH=arm64` liefert einen nativen arm64-Hauptprozess, während die gebündelten Python-/Node-/Office-Runtimes die x64-Payload unter Windows-Emulation weiterverwenden; das architekturübergreifende Packen überspringt die Smoke-Tests, die nur auf dem Host laufen können, der x64-Build und seine Prüfungen bleiben unberührt, und dieses Artefakt ist noch nicht mit den Download-Links oder dem Update-Kanal verbunden.
- Update-Karte der Seite Einstellungen: Die Meldung bei Dienstausfall lautet jetzt „Updates für Nonead-DSH-Desktop sind vorübergehend nicht verfügbar. Versuchen Sie es später erneut.“, statt den ausgemusterten Produktnamen Next zu nennen; der Fortschrittsbalken des Downloads steht nun zwischen der Beschriftung „Update wird heruntergeladen: x %“ und den Versionshinweisen.

## 2.1.17 — 2026-10-24

Audit-Fix-Batch (26 Korrekturen, im Einzelnen unten):

- Wiederherstellungsassistent: Wenn der automatische Diagnose-Export und eine Benutzeraktion dasselbe Dokument gleichzeitig aktualisierten, schlug die vorangehende Navigation mit `ERR_ABORTED` fehl; auf dem Pfad ohne Benutzeraktion konnte dieser Fehler durch fail-loud zu einem vollständigen Beenden der Anwendung eskalieren. Aktualisierungen sind jetzt serialisiert, eine durch Fensterzerstörung abgebrochene Navigation gilt als normales Ende, und Fehler auf dem Aktionspfad werden nur als Diagnose protokolliert.
- Checkpoint-Lesen und Degradierung: Manifest- und Sicherungsdateien werden nach dem Öffnen per Inode erneut geprüft (`O_NOFOLLOW` + `fstat`), sodass ein zwischen `lstat` und dem Lesen ausgetauschter Pfad nicht mehr vertrauenswürdig ist; ein beschädigter Slot lässt die gesamte Snapshot-Liste nicht mehr scheitern, sondern wird als „nicht lesbar“ markiert, bleibt auf der Wiederherstellungsseite sichtbar, ist dort aber nicht bedienbar, und die Rotation verwendet ihn als nächstes Überschreibziel.
- Einstellungen schreiben: `settings.yaml` und die `pnpm-workspace.yaml` eines Profils werden über eine temporäre Datei plus rename veröffentlicht, sodass ein unterbrochener Schreibvorgang entweder den alten oder den neuen Inhalt hinterlässt statt eines halben YAML, das beim nächsten Start alle Einstellungen verliert.
- Updates: Antwortkörper werden auf den Pfaden für Größenüberschreitung und Dekodierfehler freigegeben; macOS bereitet die Übergabe an die Installation vor, bevor die native Phase startet, sodass ein Beenden nicht mehr das Paket löscht, das der lokale Feed noch ausliefert; die vom Benutzer in einem selbst geöffneten Wiederherstellungsfenster gewählte Option „Beenden“ wird nicht mehr als Startfehler gemeldet (Erfolgscode), während Startfehler weiterhin ungleich null bleiben.
- Plugin- und Zustandsspeicher: Das Lesen des Plugin-Zustands prüft den Inode erneut; die Rückgewinnung veralteter Daten-Locks toleriert ein gleichzeitiges `ENOENT`; die Absicherung gegen beschädigten Zustand prüft jetzt die Datei, die sie tatsächlich schützt; Runtime-Staging-Verzeichnisse, die ein Absturz hinterlassen hat, werden vor der nächsten Veröffentlichung aufgeräumt.
- Stable-Shell: Der vom Tray ausgelöste Dialog mit dem Ergebnis der Update-Prüfung gehört jetzt zum Hauptfenster, sodass er nicht mehr verdeckt werden und die Antwort verlieren kann; der Computer-Use-Schalter behandelt `cancelled` wie `failed`; das Beenden eines Browser-Gasts ist zeitlich begrenzt (nach 1,5 s erzwungen, danach 0,5 s Nachfrist), die Lease wird zuerst freigegeben, und `browserRelease` hängt nicht mehr endlos.
- Community-Marktplatz und Skin: Eine unterbrochene Paginierungsanfrage lässt „Mehr laden“ nicht mehr dauerhaft im Ladezustand; das Marktplatz-Overlay gibt den Fokus zurück, wenn es geschlossen wird; das injizierte Stylesheet deklariert `data-plugin`, sodass ein später geladenes Plugin es nicht mehr beanspruchen und beim Entladen löschen kann; die Grammatik der Paketnamen entspricht dem Host.
- Gates und CI: `upstream-command-windows` installiert die Abhängigkeiten vor `check:layout`; die Änderungsklassifizierung deaktiviert die Umbenennungserkennung, sodass eine in einen Dokumentationspfad umbenannte Quelldatei die Produkt-Gates nicht mehr überspringen kann; der Kompatibilitätstest des Inspectors ist auf dem Repository-Root verankert.
- Paketierung: `verify:safe-cleanup` der Stable-Shell richtet `TEMP` des Electron-Kindprozesses jetzt auf ein beschreibbares Verzeichnis im Workspace (Electron 44 wird auf diesem Host das Anlegen von Verzeichnissen unter `%TEMP%` verweigert), sodass die Vorprüfung nicht mehr abbricht, bevor das Installationspaket erzeugt ist.

## 2.1.16 — 2026-10-22

Sicherheitshärtung und Gate-Korrekturen (Ergebnis eines vollständigen Audits):

- CI führt die Änderungsklassifizierung und die Dokumentations-/Marktplatz-Gates jetzt **mit den Skripten der PR-Basisseite** aus, sodass der geprüfte Code seinen eigenen Klassifizierer nicht mehr abschwächen kann, um alle Produkt-Gates zu überspringen.
- Electron-Fuses verschärft: Beide Shells schließen die Injektionsfläche von `NODE_OPTIONS` und `--inspect`; die Stable-Shell (`asar: true`) lädt nur noch aus `app.asar`, während der Beta-Kanal dieses Bit ausgeschaltet lässt, weil er als physisches Verzeichnis ausgeliefert wird (`asar: false`). `runAsNode` muss eingeschaltet bleiben – unter Windows starten Host, CLI und die pnpm-Shims die Electron-Binary alle mit `ELECTRON_RUN_AS_NODE`. Beide `verify-fuses`-Skripte leiten den erwarteten Wert jetzt aus dem tatsächlichen Layout ab und prüfen die ganze Menge, sodass eine Lockerung fehlschlägt; die Stable-Shell rief zuvor `verifyElectronExecutableFuses(path, undefined, false)` auf und prüfte das Archiv-Bit damit überhaupt nicht.
- Die Renderer-Anmeldedaten laufen nicht mehr über die Umgebung des Host-Kindprozesses, sondern werden beim Start einmalig über eine private Pipe injiziert, sodass Prozesse desselben Benutzers sie nicht mehr aus der Prozessumgebung oder einem Absturzdump lesen und sich als Renderer ausgeben können.
- Das Web-Zugriffsgate **schlägt bei fehlenden Anmeldedaten geschlossen fehl** (zuvor fail-open); Anfragen der Browser-Klasse werden nicht mehr stillschweigend durchgelassen.
- Deep Links mit `dsh-desktop://` werden über eine Aktions-Allowlist verteilt; unbekannte Aktionen werden verworfen und mit einer einzelnen Logzeile protokolliert.
- Die Maskierung von Geheimnissen in Diagnosen und Logs deckt jetzt auch base64url-Formen ab, sodass die Renderer-Anmeldedaten nicht mehr exportiert werden können.
- Die Route des Verzeichnisauswahl-Dialogs nutzt dieselbe Loopback-Same-Origin-Prüfung wie die Einstellungsroute, statt einem vom Client gelieferten `Origin` zu vertrauen.

Paketierung und Veröffentlichung:

- Der `asarUnpack`-Vertrag der Stable-Shell wurde gegen app-builder-lib 26.15.7 neu belegt: Weil Treffer gegen den **Pfad des Paketierungsprojekts** aufgelöst werden, müssen die drei Patterns das Präfix `.desktop-build/payload/` aus `files[].from` behalten, um zu greifen (`scripts/node-bin`, `assets` und `build` werden tatsächlich neben `app.asar` entpackt). Die Patterns bleiben unverändert; ein neuer Test leitet das erwartete Präfix aus `files[].from` ab und prüft es, sodass eine Abweichung auf einer der beiden Seiten fehlschlägt – diese Kopplung war zuvor durch keine Assertion abgedeckt.
- CI hat nun eine Paketierungsabdeckung für die Stable-Shell, und `verify-layout` erzwingt die Versionsgleichheit: Das `version` beider Workspaces muss mit der neuesten `CHANGELOG`-Überschrift übereinstimmen.
- CI schreibt `dsh-plugin-desktop-beta/package.json` nicht mehr an Ort und Stelle um, um den AA-Smoke zu überspringen; ein explizites `check:ci`-Skript ersetzt diese Mutation, sodass CI und lokale Läufe übereinstimmen.

Repository-Hygiene und Lieferkette:

- Jede von der CI verwendete Drittanbieter-Action ist auf einen Commit-SHA festgelegt (`actions/checkout`, `actions/setup-node`, `actions/cache`); der Tag bleibt nur als nachgestellter Kommentar für die Lesbarkeit erhalten, damit ein verschobener Upstream-Tag nicht stillschweigend ändert, was die Gates ausführen.
- Der Änderungsklassifizierer behandelt nicht mehr jede Datei unter `docs/` als Dokumentation: Nicht-Dokument-Endungen in `docs/` (`.js`/`.mjs`/`.json`/`.ts` und Verwandte) lösen jetzt die Produkt-Gates aus, ausgenommen sind nur echte Dokumentationsformate und `docs/schemas/*.schema.json`.
- Sechs unreferenzierte historische tgz-Dateien (rund 1,7 MB) wurden aus `vendor/agents-anywhere/` entfernt, sodass nur die gepinnte übrig bleibt; die README dieses Verzeichnisses lehrt nicht mehr den entfernten Pfad `DSH_AA_SOURCE_REF=pinned`, sondern pinnt über `provenance.pinnedCommit`.
- Die Dateien `nonead-dsh-desktop/README.md` und `README.zh.md` schreiben die Produktversion nicht mehr fest (sie nannten `2.1.3`), sondern verweisen auf `version` in `package.json` und den neuesten Eintrag im Root-`CHANGELOG`.
- Die Dokumentation stellt jetzt klar, dass AppImage und deb für Linux x64 nur vom Beta-Kanal gebaut werden und der Stable-Kanal unter Linux ein lauffähiges Verzeichnis ausliefert; die erste echte Prüfung der Fuses und von `onlyLoadAppFromAsar` ist der CI-Job `desktop-windows-stable` (`package:dir:stable`), lokal decken sie nur Unit-Tests ab.

### Ergänzung vom 2026-10-23 (gleiche Versionsnummer, in späteren Builds enthalten)

Paketierungskette:

- Drei Windows-Paketierungsgates korrigiert, die vom tatsächlichen Verhalten des Produkts abgewichen waren: Von pnpm in einem Profil angelegte Junctions ließen sich nicht rekursiv entfernen; `verify:host` übergab die Renderer-Anmeldedaten nicht (32 base64url-Bytes, und es müssen dieselben sein, die der Host erhalten hat); und dasselbe Skript gab sich mit einer festen Zeichenkette als Renderer aus, was das geschlossen fehlschlagende Web-Gate zurückweist.
- `dsh-plugin-desktop-beta` deklariert jetzt `@deepseek-ai/dsh-plugin-manager` (ein erforderlicher Peer von `dsh-plugin-market`) und stellt damit den 318-Knoten-Closure der Runtime wieder her.

## 2.1.15 — 2026-10-22

Die Version springt von `2.1.13` direkt auf `2.1.15`; ein eigener Release-Commit für `2.1.14` existiert in der Historie nicht.

Runtime und Abhängigkeiten:

- Die DSH-Runtime bleibt auf **`0.2.1-rc.2`**, und `channels.beta.commit` in `upstream.json` ist weiterhin `687f282e`; die Agents Anywhere bridge ist weiterhin `39b82d4`.
- Der Plugin-Marktplatz `dshmarket` steigt auf `1.66.45`, und der Desktop-Patch wird darauf neu aufgesetzt.
- Der Marken-Patch ist von `.yarn/patches/dsh-web-frontend-nonead-wordmark.patch` zu `patches/dsh-web-frontend@0.2.1-rc.2.patch` gewandert und liegt damit bei den übrigen Runtime-Patches.
- Der httpx-Patch des AA-Connectors wurde erweitert und deckt den neuen Verbindungspfad ab.

Updates und Wiederherstellung:

- Die Update-Karte kann **Versionshinweise** anzeigen, die die Versionsantwort mitliefert; das Tray-Menü und die nativen Dialoge des Beta-Kanals bieten zusätzlich einen Eintrag „Vollständige Versionshinweise anzeigen“ (Tray-Beschriftungen und Benachrichtigungstexte werden nach Plattformregeln gekürzt), während der native Update-Dialog des Stable-Kanals weiterhin nur feste Texte enthält.
- **Diese Version überspringen** ist neu: Die Entscheidung wird gespeichert, sodass die unbeaufsichtigte geplante Prüfung eine übersprungene Version nicht erneut anbietet.
- Eine fehlgeschlagene Installation lässt sich wiederholen, und die Wiederherstellung kann auf **jeden gespeicherten Snapshot** zurücksetzen, nicht nur auf den neuesten.
- Das Starten des nativen Installers beginnt jetzt **vor** dem Beenden, sodass das Beenden den Installer nicht mitreißen kann.
- Die Signierung von Windows-Installationspaketen und die Herausgeberprüfung wurden eingeführt und anschließend in `c5896ac` **vollständig zurückgenommen**; Windows-Installationspakete vergleichen weiterhin nur `ProductName` / `ProductVersion` aus der PE-Versionsressource.

Desktop-Shell:

- Fensterposition und -größe werden gemerkt; die Wiederherstellung erfolgt nur, solange das Fenster noch einen angeschlossenen Bildschirm überlappt, sodass das Abziehen eines Monitors es nicht außerhalb des Bildschirms platziert.
- Strenge geschichtete `.env`-Dateien werden unterstützt: Fehlende Variablen für den Host-Kindprozess werden ergänzt, ohne die bestehende Umgebung zu überschreiben.
- Deep Links mit `dsh-desktop://` werden unterstützt (zum Beispiel `dsh-desktop://settings/general`).
- Ein Schalter für den Start bei der Anmeldung liest den tatsächlichen Zustand des Betriebssystems.
- Lese-Ändere-Schreibe-Zyklen der Profilkonfiguration laufen jetzt unter einer einzigen Schreiber-Sperre, sodass die Shell und der Profilmanager des Hosts ihre Aktualisierungen nicht mehr stillschweigend gegenseitig verwerfen.
- Die Wiederholungsbudgets für die Einzelinstanz- und die Disposable-Bereinigung sind auf drei festgelegt; unbehandelte Renderer-Fehler erscheinen im Benachrichtigungsbereich.
- `.env` und Runtime-Umgebung des Gastbrowsers werden korrekt durchgereicht.

Marktplatz und Skin:

- Der Marktplatz zeigt Vorschauen für **Medien, die keine Bilder sind**, und kann **ein Plugin anhand seines Namens installieren**.
- Das Überspringen des Plugin-Marktplatzes im Onboarding wird gemerkt, und beim erneuten Öffnen des Assistenten bleibt die gespeicherte Marktplatz-Einstellung erhalten.
- Der Austausch der Hero-Überschrift im Marken-Skin ist auf den Hero-Teilbaum begrenzt und berührt keine anderen Texte mehr.

Korrekturen:

- Der AA-Interaktionsstream hält einen lebenden Peer, und die DSH-Runtime bleibt während der Verlaufssynchronisierung nutzbar.
- Plattformübergreifende Assertions wurden repariert, und das Marktplatz-Bundle wird jetzt mit dem Paket ausgeliefert.
- CI führt die Produkt-Gates auch dann aus, wenn sich ein Runtime-JSON-Schema ändert.
- Der Release-Ablauf leitet die ausgelieferte Version aus den Manifesten ab.

## 2.1.13 — 2026-10-21

Runtime und Abhängigkeiten:

- Die DSH-Runtime ist von `0.2.1-alpha.5` auf **`0.2.1-rc.2`** gewechselt: Alle `@deepseek-ai/dsh*`-Abhängigkeiten sind exakt auf diese Version gepinnt, `vendor/dsh-runtime/0.2.1-rc.2/` wird mit dem Installationspaket ausgeliefert, und das alte Runtime-Verzeichnis `alpha.5` ist verschwunden. `channels.beta.commit` in `upstream.json` ist `687f282e`.
- Der Plugin-Marktplatz `dshmarket` steigt auf `1.66.44`.
- Die Agents Anywhere bridge steigt auf `2.1.0-desktop` (Upstream `39b82d4`) und bringt den Patch `agents-anywhere-connector-httpx` mit.

Oberfläche und Bedienung:

- Der Startbildschirm zeigt jetzt das neue Wortzeichen NONEAD / DEEPSEEK HARNESS.
- Die Abschlussseite des Onboardings leitet jetzt zum Eintragen eines API Key an und bietet einen Einstieg zu NONEAD.
- Das Onboarding aktiviert den Plugin-Marktplatz und Computer Use standardmäßig (wirksam ab 2.1.12).

Stabilität:

- Die AA bridge **verwirft Ereignisse**, wenn ihre Warteschlange voll ist, statt abzustürzen.
- Die durch den Upstream-Umbau in rc.2 gebrochenen PTC-Assertions wurden korrigiert.
- CI wird jetzt von `main` statt von `master` ausgelöst.
- Die Dateien `AGENTS.md`, `CLAUDE.md`, `PRIVACY*`, `CONTRIBUTING*` und `CODE_OF_CONDUCT*` im Root wurden entfernt; die Repository-Regeln stehen jetzt nur noch in `README.md` und `docs/`.

## 2.1.12 — 2026-10-19

- Das Onboarding aktiviert den Plugin-Marktplatz (`dsh-market`) und Computer Use standardmäßig, sodass neue Installationen beides ab dem ersten Start haben.

## 2.1.11 — 2026-10-18

- Beide Desktop-Workspaces sind auf `2.1.11` vereinheitlicht, Tests und Dokumentation sind mitgezogen.
- Root-Manifeste und Dokumentation sind auf DSH `0.2.1-rc.2` nachgezogen (zuvor über `0.2.1-rc.1`).
- `aa:prepare-release` kann jetzt einen lokalen Quellbaum statt eines GitHub-Packs verwenden, was Releases offline oder bei knapper Bandbreite erleichtert.

## 2.1.6 — 2026-10-17

- Ein Kompatibilitätspatch für Profil-Plugins behebt, dass profilbezogene Plugins unter neueren Runtimes nicht geladen wurden.
- Die Download-Endpunkte für Updates sind auf `nonead.com` umgezogen; die README enthält nun Anweisungen zum Installieren und Starten des Linux-AppImage.

## 2.0.8 — 2026-10-11

- Alle drei Kanäle sind auf `2.0.8` vereinheitlicht, mit aufgefrischten Icon-Ressourcen, `dshmarket` und aktualisierter Release-Dokumentation.
- Die Upstream-Runtime war bereits zuvor auf `0.2.0-rc.2` gestiegen.

## Bekannte Probleme

- Das In-App-Update unter Linux prüft nur die Version und lädt nie ein Installationspaket herunter; zum Aktualisieren laden Sie ein frisches AppImage herunter.
- Windows-Installationspakete werden noch nicht kryptografisch per Digest geprüft: Der Downloadpfad unterstützt ein serverseitiges `installerSha256`, der Versionsendpunkt veröffentlicht dieses Feld jedoch nicht, sodass nur `ProductName` und `ProductVersion` aus der PE-Versionsressource verglichen werden.
- Ein nicht initialisiertes `deepseek-harness`-Submodul lässt `corepack yarn check:layout` fehlschlagen; normale Builds, der Typecheck und die Tests sind davon nicht betroffen.
