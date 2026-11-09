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

## 2.2.9 — 2026-11-10

Die Laufzeit wechselt auf DSH 0.2.2-rc.1, das mitgelieferte Plugin-Set erreicht 36, und der Installationsassistent erzählt das anders:

- Laufzeit: das mitgelieferte DeepSeek Harness wechselt von 0.2.2-alpha.3 auf **0.2.2-rc.1** (Upstream-Commit `66491b0`, mit der cordis-Familie auf 4.1.0 und schemastery 3.19.0). `vendor/dsh-runtime/0.2.2-rc.1` wird aus dem lokalen Upstream-Checkout als 373 Pakete neu gebaut, mit exakt demselben Paketsatz wie die vorherige Version; alle 24 Desktop-Patches werden auf die neuen Artefakte neu aufgesetzt, die `resolutions` im Wurzelverzeichnis und die DSH-Abhängigkeiten beider Desktop-Workspaces zeigen auf die neue Version, und `yarn check:vendored-runtime` läuft für beide Kanäle durch.
- Onboarding: Der Schritt „sofort einsatzbereit“ des Installationsassistenten listet nicht mehr zuerst alle Plugins auf, sondern erklärt nur nach Kategorien, was das vorinstallierte Set leisten kann; nach dem Start der Installation zeigt jedes Plugin bei seiner Runde Name, Version, Kategorie und vollständige Beschreibung und dankt seinem Autor – „Danke an X für dieses Plugin“.
- Mitgelieferte Plugins: Das Set wächst von 30 auf **36** und nimmt `@changfenhuang/dsh-genui`, `@deepseek-ai/dsh-tool-subagent`, `@linxin666/dsh-client-ui-task-board`, `@weibaohui/skills-management`, `billion-context`, `dsh-client-auto-continue`, `dsh-cost-meter`, `dsh-markitdown`, `dsh-nonead-prompt-rewind`, `dsh-office-tools`, `dshmarket` auf; `dsh-api-client`, `dsh-design`, `dsh-doc-reader`, `dsh-rewind-plugin`, `@kenz1117/dsh-ui-usage-billing` verlassen das mitgelieferte Set.
- Plugin-Aktualisierung: `dsh-ppt-master` 1.0.8 → 6.1.0, `dsh-config-manager` 0.3.1 → 0.6.0, `@michengai/dsh-skills-manager` 1.2.28 → 1.4.0, `dsh-better-sidebar` 0.28.2 → 0.30.1, `dsh-context` 0.80.3 → 0.83.0, die übrigen folgen npm latest.
- Plugin-Manifest: `plugin/manifest.json` steigt auf v4; jeder Eintrag trägt nun eine Kategorie und einen Autor, woraus sich Gruppierung und Danksagung im Installationsassistenten ergeben.
- Version: Produkt 2.2.6 → **2.2.9** (beide Desktop-Workspaces wandern gemeinsam).

### Mitgelieferte Plugins (36)

Diese 36 Plugins werden mit dem Installer ausgeliefert; nach dem ersten Start lassen sie sich auf der Seite „Plugins“ aktivieren, deaktivieren oder entfernen. Die Zahl hinter jedem Namen ist die mitgelieferte Version.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Automatisches Gedächtnis. Erinnert vor jeder Aufgabe an frühere Entscheidungen.
- `@changfenhuang/dsh-genui` 0.16.0 — Generative Oberfläche. Zeigt Layouts, Diagramme und Formulare direkt in der Antwort.
- `@deepseek-ai/dsh-tool-subagent` 0.2.2-rc.1 — Subagent-Delegierung. Übergibt eine eigenständige Aufgabe an ein gewähltes Backend.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Git-Graph. Wechselt Branches und zeigt die Commit-Historie als Graphen.
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.16 — Skill-Center. Durchsucht, aktiviert oder löscht geladene Skills.
- `@linxin666/dsh-client-ui-task-board` 0.4.16 — Aufgabenboard. Führt Karten in echten Sitzungen aus, inklusive Cron-Zeitplan.
- `@michengai/dsh-agency-agents` 1.2.27 — Expertenbibliothek. 331 aufrufbare Spezialisten und fünf Expertenteams.
- `@michengai/dsh-archive-manager` 1.3.0 — Sitzungsarchiv. Archiviert, stellt wieder her oder löscht Sitzungen.
- `@michengai/dsh-code-review` 1.0.9 — Code-Review. Ein eigener Subagent prüft den Code und liefert einen Bericht.
- `@michengai/dsh-skills-manager` 1.4.0 — Skill-Verwaltung. Lädt und verwaltet lokale Skills sicher an einer Stelle.
- `@tt-a1i/archify-dsh` 1.1.0 — Architekturdiagramme. Erzeugt Architekturdiagramme aus einer Beschreibung.
- `@weibaohui/skills-management` 0.9.3 — Skill-Marktplatz. Verwaltet lokale Skills und einen Katalog mit über 6600 Einträgen.
- `@wenaixi/dsh-superpower` 8.0.0 — Engineering-Skills. Fünfzehn einzeln schaltbare Ingenieurskompetenzen.
- `@yolk_vat-y/dsh-project-memory` 0.6.12 — Projektgedächtnis. Indexiert Dokumente und Symbole und antwortet mit Quellen.
- `billion-context` 0.1.213 — Kontextkompression. Fasst lange Gespräche zusammen und spart Kontextfenster.
- `dsh-better-sidebar` 0.30.1 — Erweiterte Seitenleiste. Dateien, Editor, Änderungen und Aufgaben in einer Spalte.
- `dsh-client-auto-continue` 0.17.4 — Automatische Fortsetzung. Startet die Anfrage nach einer Unterbrechung erneut.
- `dsh-config-manager` 0.6.0 — Konfigurationsverwaltung. Sichert, stellt wieder her und synchronisiert die Konfiguration.
- `dsh-context` 0.83.0 — Kontextanalyse. Zeigt die Zusammensetzung des Kontexts und komprimiert bei Bedarf.
- `dsh-cost-meter` 1.9.62 — Kostenübersicht. Zählt Token und Ausgaben der Sitzung und der Historie.
- `dsh-excel-chat` 0.43.0 — Tabellen-Chat. Bearbeitet Tabellen in natürlicher Sprache und prüft Formeln.
- `dsh-find-plugins` 0.3.0 — Plugin-Entdeckung. Sucht in fünf Katalogen sowie live auf GitHub und npm.
- `dsh-github-skills` 0.2.1 — GitHub-Skills. GitHub-Workflows, angepasst an mehrere Anbieter.
- `dsh-image-gen` 0.11.1 — Bilderzeugung. Erzeugt und bearbeitet Bilder über mehrere Anbieter.
- `dsh-markitdown` 0.2.2 — Markdown-Konvertierung. Wandelt Dokumente und Webseiten in lesbaren Text um.
- `dsh-mcp-connector` 0.2.97 — MCP-Connector. Verwaltet Verbindungen und sucht verfügbare Werkzeuge.
- `dsh-nonead-prompt-recall` 0.8.7 — Eingabeverlauf. Ruft die vorherige Anweisung mit der Pfeiltaste auf.
- `dsh-nonead-prompt-rewind` 0.5.4 — Gesprächs-Rückspulen. Kehrt zu einer früheren Nachricht zurück und stellt Dateien her.
- `dsh-nonead-universal-robots` 0.8.6 — UR-Roboterarme. Steuert Universal-Robots-Arme in natürlicher Sprache.
- `dsh-nonead-ursim` 0.3.14 — UR-Simulation. Prüft Trajektorien offline, bevor der echte Arm bewegt wird.
- `dsh-office-tools` 1.0.8 — Office-Dateien. Erstellt und bearbeitet Word-, Excel- und PowerPoint-Dateien.
- `dsh-ppt-master` 6.1.0 — Präsentationen. Erzeugt bearbeitbare PPTX und erweitert bestehende Foliensätze.
- `dsh-remotion` 0.10.5 — Videowerkstatt. Wandelt ein React-Projekt in Video um, mit Vorschau und MP4-Export.
- `dsh-superagent` 0.1.0 — Proaktiver Agent. Wandelt autorisierte Anfragen in ausgeführte Tickets um.
- `dsh-univer-office` 0.4.0 — Office-Integration. Tabellen, Dokumente und Präsentationen direkt in DSH bearbeiten.
- `dshmarket` 1.73.16 — Plugin-Marktplatz. Durchsucht und installiert Community-Plugins visuell.

## 2.2.6 — 2026-11-03

Die Laufzeit wechselt auf DSH 0.2.2-alpha.3, und das mitgelieferte Plugin-Set erreicht 30:

- Laufzeit: das mitgelieferte DeepSeek Harness wechselt von 0.2.2-alpha.2 auf **0.2.2-alpha.3** (Upstream-Commit `05b1cae`, inklusive der Vendor-Aktualisierung cordis 4.0.6-alpha.2 und cosmokit 1.8.7-alpha.2). `vendor/dsh-runtime/0.2.2-alpha.3` wird aus dem lokalen Upstream-Checkout als 373 Pakete neu gebaut, und sowohl die `resolutions` im Wurzelverzeichnis als auch beide Desktop-Workspaces zeigen auf die neue Version; `yarn check:vendored-runtime` läuft für beide Kanäle durch.
- Neues Plugin: `dsh-superagent` 0.1.0 (Forschungsprototyp von DeepSeek: beobachtet GitHub und Feishu, wandelt autorisierte Anfragen in Tickets um, die in eigenen Sitzungen laufen, und ein Web-Panel bündelt, was einen Menschen braucht; gebaut aus `deepseek-ai/dsh-superagent-prototype` mit dessen offizieller Build-Kette).
- Plugin-Aktualisierung: `dsh-remotion` wechselt auf 0.10.4 und `dsh-design` ersetzt das unveröffentlichte `dsh-design-skills`; `@michengai/dsh-agency-agents` 1.2.23, `@michengai/dsh-archive-manager` 1.2.0, `@michengai/dsh-code-review` 1.0.7, `@michengai/dsh-skills-manager` 1.2.28, `dsh-config-manager` 0.3.1, `dsh-context` 0.80.3 und `dsh-rewind-plugin` 0.19.2 folgen npm latest.
- Mitgelieferter Markt: `dshmarket` wechselt auf 1.73.9.
- Werkzeuge: neues `yarn plugins:update` aktualisiert alle Archive in `plugin/` auf npm latest und baut das Manifest neu.
- Version: Produkt 2.2.5 → **2.2.6** (beide Desktop-Workspaces wandern gemeinsam).

### Mitgelieferte Plugins (30)

Diese 30 Plugins werden mit dem Installer ausgeliefert; nach dem ersten Start lassen sie sich auf der Seite „Plugins“ aktivieren, deaktivieren oder entfernen. Die Zahl hinter jedem Namen ist die mitgelieferte Version.

- `@a9i5k4/dsh-auto-memory` 3.3.17 — Automatisches Gedächtnis. Injiziert vor einer Aufgabe die relevanten früheren Arbeiten und bereits getroffenen Entscheidungen, ohne dass man danach fragen muss; der gesammelte Kontext bleibt auf diesem Rechner und ist weiterhin durchsuchbar.
- `@kenz1117/dsh-ui-usage-billing` 1.8.1 — Nutzungs- und Kostenübersicht. Bündelt Verbrauchskennzahlen und Ausgabendetails in der Seitenleiste, damit sich die Kosten jederzeit prüfen lassen.
- `@linxin666/dsh-client-ui-git-graph` 0.4.14 — Git-Branchgraph. Zeichnet Commit-Historie und Branch-Verlauf und erlaubt den Branchwechsel aus einer leeren Sitzung, ohne ins Terminal zurückzugehen.
- `@linxin666/dsh-client-ui-skill-explorer` 0.4.14 — Skill-Center. Durchsucht geladene Skills nach Herkunft, zeigt ihren Zweck und macht sichtbar, welche Komponente eine Fähigkeit bereitstellt.
- `@michengai/dsh-agency-agents` 1.2.23 — Expertenbibliothek. Enthält 331 aufrufbare Spezialisten aus Engineering, Design, Marketing, Recht und weiteren Bereichen; wenn eine Fachbeurteilung nötig ist, wird der passende Experte aufgerufen, statt die Hauptsitzung raten zu lassen.
- `@michengai/dsh-archive-manager` 1.2.0 — Sitzungsarchiv. Archiviert, stellt wieder her, markiert als Favorit und löscht Sitzungen endgültig und diagnostiziert beschädigte Sitzungsprotokolle, sodass das Aufräumen keine noch benötigten Aufzeichnungen vernichtet.
- `@michengai/dsh-code-review` 1.0.7 — Code-Review. Ein Review-Ablauf im Codex-Stil, ausgeführt von einem nativen, eigenständigen Sub-Agenten, mit frei wählbarem Prüfumfang (Änderungen, Commit-Bereich oder ganzes Repository).
- `@michengai/dsh-skills-manager` 1.2.28 — Skill-Verwaltung. Lädt lokale Agent-Skills an einer Stelle und verwaltet sie sicher, mit Herkunft und Aktivierungsstatus auf einen Blick.
- `@tt-a1i/archify-dsh` 1.0.0 — Architekturdiagramme. Wandelt Systemstrukturen oder Geschäftsprozesse in interaktive Architektur-, Ablauf-, Sequenz-, Datenfluss- und Zustandsdiagramme um.
- `@wenaixi/dsh-superpower` 8.0.0 — Engineering-Skill-Paket. Fünfzehn superpowers-Engineering-Skills, auf Chinesisch und Englisch nutzbar.
- `@yolk_vat-y/dsh-project-memory` 0.6.9 — Projektgedächtnis. Indexiert Dokumente (PDF, Markdown) und Codesymbole, damit spätere Fragen durch Abruf statt durch erneutes Lesen beantwortet werden.
- `dsh-api-client` 0.2.0 — API-Debugging. Sendet HTTP-Anfragen und zeigt Antworten im Editor, für die Arbeit an Schnittstellen.
- `dsh-better-sidebar` 0.28.2 — Eine bessere Seitenleiste. Fasst Dateibaum, Editor, Änderungen, Aufgaben und Seitenchat in einer Spalte zusammen, je Sitzung getrennt; außerdem stellt sie anderen Plugins einen Dienst zur Registrierung von Seitenleisten-Registern und Dateibetrachtern bereit.
- `dsh-config-manager` 0.3.1 — Konfigurationsverwaltung. Sicherung, Wiederherstellung, Export, Import, Migration und Synchronisierung der DSH-Konfiguration, damit sich die Umgebung auf einen anderen Rechner oder nach einer Neuinstallation übertragen lässt.
- `dsh-context` 0.80.3 — Kontexttransparenz und -verwaltung. Zeigt die aktuelle Kontextbelegung und komprimiert, wenn sie sich dem Limit nähert.
- `dsh-design` 0.2.0 — Designsystem-Fähigkeiten. Schränkt Designentscheidungen ein und misst mit `design_audit` Schriftskala, Kontrast, Abstände und Palettenabweichung auf gerenderten Seiten.
- `dsh-doc-reader` 0.2.0 — Dokumentenleser. Liest den Textkörper von PDF-, Word- und ähnlichen Dateien aus, damit das Modell das Dokument selbst statt nur seinen Dateinamen sieht.
- `dsh-excel-chat` 0.43.0 — Tabellen-Chat. Bearbeitet Excel-Arbeitsblätter in natürlicher Sprache, ohne Funktionen oder Zellkoordinaten auswendig zu lernen.
- `dsh-find-plugins` 0.3.0 — Plugin-Suche. Durchsucht Plugins in fünf Community-Katalogen und führt Live-Suchen auf GitHub und npm aus.
- `dsh-github-skills` 0.2.1 — GitHub-Workflow-Skills. Abgeleitet von den GitHub-Skills von OpenAI Codex.
- `dsh-image-gen` 0.10.2 — Bilderzeugung. Verbindet sich mit Gemini, OpenAI und ähnlichen Anbietern zum Erzeugen und Bearbeiten von Bildern.
- `dsh-mcp-connector` 0.2.93 — MCP-Connector. Verbindet MCP-Dienste und bietet eine einheitliche Werkzeugsuche und -ausführung über sie hinweg.
- `dsh-nonead-prompt-recall` 0.8.4 — Eingabeverlauf. Mit ↑ im leeren Eingabefeld wird die vorherige Anweisung wieder aufgerufen.
- `dsh-nonead-universal-robots` 0.8.5 — UR-Roboterarme. Steuert Universal-Robots-Arme direkt in natürlicher Sprache, ohne Skripte von Hand zu schreiben.
- `dsh-nonead-ursim` 0.3.13 — UR-Simulation. Entwickelt Armbewegungen in einem Offline-Simulator, damit sich eine Trajektorie prüfen lässt, bevor echte Hardware angefasst wird.
- `dsh-ppt-master` 1.0.8 — Präsentationserzeugung. Erzeugt Foliensätze aus den gelieferten Inhalten.
- `dsh-remotion` 0.10.4 — Videoproduktion. Rendert Video aus einem React-Projekt innerhalb von DSH.
- `dsh-rewind-plugin` 0.19.2 — Gesprächs-Rückspulen. Setzt die Unterhaltung im selben Fenster zurück und stellt dabei die Dateien des Arbeitsbereichs wieder her.
- `dsh-superagent` 0.1.0 — Superagent-Prototyp. Beobachtet GitHub und Feishu, wandelt autorisierte Anfragen in Tickets um, die in eigenen Sitzungen laufen, und ein Web-Panel bündelt, was einen Menschen braucht (Forschungsprototyp von DeepSeek, kein offizielles Produkt).
- `dsh-univer-office` 0.4.0 — Office-Dokumente. Integration von DSH und Univer für Tabellen, Dokumente und Präsentationen.

## 2.2.4 — 2026-10-31

Versionserhöhung ohne funktionale Änderungen:

- Version: Produkt 2.2.3 → **2.2.4** (beide Desktop-Arbeitsbereiche synchron).

## 2.2.3 — 2026-10-29

Die Desktop-Shell ist in acht Sprachen lokalisiert (vereinfachtes Chinesisch, Englisch, Japanisch, Spanisch, Französisch, Deutsch, Russisch und brasilianisches Portugiesisch):

- Shell-Texte: Für Spanisch, Französisch, Deutsch, Russisch und brasilianisches Portugiesisch kommen Wörterbücher mit je 209 Einträgen zu den bestehenden Sprachen hinzu; native Dialoge, die Berechtigungsansicht, Computer Use, die Seite Einstellungen, die Plugin-Steuerung und die Bezeichnung des Terminalmodus laufen einheitlich über `desktopText`, und die nativen Menüs sowie die gespeicherte Sprache der Oberfläche folgen demselben Satz von acht Sprachen.
- Seite Einstellungen: Einstellungswörterbücher in sechs Sprachen (je 125 Einträge) decken die gemeinsam genutzten Bereiche Plugin-Marktplatz, Fernsteuerung, Fenster, Browser und lokales Netzwerk sowie Benachrichtigungen ab, statt auf Englisch zurückzufallen.
- Interpolierte Texte: elf Dialoge mit Platzhaltern (Profil entfernen und wechseln, Plugin aktivieren/deaktivieren/deinstallieren, Datenverzeichnis und Update-Status) schlagen jetzt `{name}`-Vorlagen nach und setzen den Wert ein, sodass sie in sechs Sprachen nicht mehr auf Englisch zurückfallen.
- Renderer: Die Rückmeldungstexte der Wiederherstellung wurden aus dem Modul herausgelöst, das Node-Built-ins importiert; der native-ui-Build meldet keine Externalisierungswarnungen für `node:fs`/`node:path`/`node:crypto` mehr.
- Abgrenzung: Der Wiederherstellungsassistent und die Profilauswahl stammen aus dem gemeinsamen Workspace `dsh-plugin-desktop-beta` und bleiben ausschließlich chinesisch/englisch.
- Version: Das Produkt wechselt in beiden Desktop-Workspaces von 2.2.2 auf **2.2.3**.
- Dokumentation: README und CHANGELOG erscheinen jetzt auch auf Japanisch, Spanisch, Französisch, Deutsch, Russisch und brasilianischem Portugiesisch; das Bilingual-Gate akzeptiert jetzt mehrsprachige Datensätze (mindestens zwei Dokumente pro Datensatz).


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
