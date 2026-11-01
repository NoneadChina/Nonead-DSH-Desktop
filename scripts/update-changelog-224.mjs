/**
 * One-off: replace the 2.2.4 entry in every CHANGELOG with the features it actually shipped
 * (30 bundled plugins, install progress, four-column list, bundle verification, arm64 build).
 * Literal replacement per language; reports any file whose entry no longer matches.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const REWRITES = [
  {
    file: 'CHANGELOG.md',
    before: `## 2.2.4 — 2026-10-31

版本号推进，无功能变更：

- 版本号：产品 2.2.3 → **2.2.4**（两个桌面工作区同步）。`,
    after: `## 2.2.4 — 2026-10-31

内置插件与安装体验：

- 内置插件：安装包携带 30 个插件，首次设置的最后一页列出清单；点「完成并开始」后自动安装，装好后在插件市场的「已安装」里管理。
- 安装进度：安装期间显示当前插件的中文说明与进度条（n/30）；单个插件失败只跳过该插件，结束时汇总提示。
- 插件列表：四列紧凑布局，一屏放下且不出现右侧滚动条。
- 加载保证：安装后按 Profile 的依赖与 bundle 清单核对，缺失项自动补齐，避免「已安装但显示已停用」。
- Windows ARM64：新增独立的 arm64 安装包，与 x64 包共用同一份载荷；内置 Python / Node / Office 运行时仍是 x64 载荷，经 Windows 仿真层执行。

版本号：产品 2.2.3 → **2.2.4**（两个桌面工作区同步）。`,
  },
  {
    file: 'CHANGELOG.en.md',
    before: `## 2.2.4 — 2026-10-31

Version bump with no functional changes:

- Version: product 2.2.3 → **2.2.4** (both desktop workspaces in sync).`,
    after: `## 2.2.4 — 2026-10-31

Bundled plugins and install experience:

- Bundled plugins: the installer carries 30 plugins, listed on the last setup page; pressing "Finish and start" installs them, and they are managed under Installed in the plugin market afterwards.
- Install progress: the wizard shows the current plugin's description and a progress bar (n/30); a failing plugin is skipped so the rest still install, and failures are summarised at the end.
- Plugin list: a compact four-column layout that fits on one screen without a scrollbar.
- Load guarantee: after installing, the Profile's dependencies and bundle list are verified and gaps are filled, so plugins no longer appear installed-but-disabled.
- Windows ARM64: a separate arm64 installer now exists and shares the same payload as the x64 package; the bundled Python / Node / Office runtime remains the x64 payload executed through Windows emulation.

Version: product 2.2.3 → **2.2.4** (both desktop workspaces in sync).`,
  },
  {
    file: 'CHANGELOG.ja.md',
    before: `## 2.2.4 — 2026-10-31

バージョン番号の更新のみで、機能変更はありません：

- バージョン：製品 2.2.3 → **2.2.4**（2 つのデスクトップワークスペースを同期）。`,
    after: `## 2.2.4 — 2026-10-31

同梱プラグインとインストール体験：

- 同梱プラグイン：インストーラーに 30 個のプラグインを同梱し、初期設定の最終ページに一覧を表示します。「完了して開始」を押すと自動的にインストールされ、以後はプラグインマーケットの「インストール済み」から管理できます。
- インストール進捗：インストール中は現在のプラグインの説明とプログレスバー（n/30）を表示します。失敗したプラグインはスキップして残りを継続し、最後にまとめて通知します。
- プラグイン一覧：4 列のコンパクトなレイアウトで、スクロールバーなしで 1 画面に収まります。
- 読み込みの保証：インストール後に Profile の依存関係と bundle 一覧を照合し、不足分を補います。「インストール済みなのに無効」という状態を防ぎます。
- Windows ARM64：独立した arm64 インストーラーを追加しました。x64 パッケージと同じペイロードを共有し、同梱の Python / Node / Office ランタイムは引き続き x64 ペイロードを Windows のエミュレーション層で実行します。

バージョン：製品 2.2.3 → **2.2.4**（2 つのデスクトップワークスペースを同期）。`,
  },
  {
    file: 'CHANGELOG.es.md',
    before: `## 2.2.4 — 2026-10-31

Actualización de versión sin cambios funcionales:

- Versión: producto 2.2.3 → **2.2.4** (ambos espacios de trabajo de escritorio sincronizados).`,
    after: `## 2.2.4 — 2026-10-31

Complementos incluidos y experiencia de instalación:

- Complementos incluidos: el instalador incorpora 30 complementos, listados en la última página de la configuración inicial; al pulsar «Finalizar y empezar» se instalan automáticamente y luego se gestionan en «Instalados» del mercado de complementos.
- Progreso de instalación: durante la instalación se muestra la descripción del complemento actual y una barra de progreso (n/30); si uno falla se omite y el resto continúa, con un resumen al final.
- Lista de complementos: diseño compacto en cuatro columnas que cabe en una pantalla sin barra de desplazamiento.
- Garantía de carga: tras instalar se verifican las dependencias y la lista de bundle del Profile y se completan los huecos, evitando el estado «instalado pero deshabilitado».
- Windows ARM64: ahora existe un instalador arm64 independiente que comparte el mismo payload que el paquete x64; el runtime de Python / Node / Office incluido sigue siendo el payload x64 ejecutado mediante la emulación de Windows.

Versión: producto 2.2.3 → **2.2.4** (ambos espacios de trabajo de escritorio sincronizados).`,
  },
  {
    file: 'CHANGELOG.fr.md',
    before: `## 2.2.4 — 2026-10-31

Mise à jour de version sans changement fonctionnel :

- Version : produit 2.2.3 → **2.2.4** (les deux espaces de travail de bureau sont synchronisés).`,
    after: `## 2.2.4 — 2026-10-31

Extensions intégrées et expérience d’installation :

- Extensions intégrées : l’installateur embarque 30 extensions, listées sur la dernière page de la configuration initiale ; « Terminer et démarrer » les installe, puis elles se gèrent dans « Installées » du marché des extensions.
- Progression de l’installation : pendant l’installation, la description de l’extension en cours et une barre de progression (n/30) sont affichées ; une extension en échec est ignorée et les autres continuent, avec un récapitulatif à la fin.
- Liste des extensions : disposition compacte sur quatre colonnes, tenant sur un écran sans barre de défilement.
- Garantie de chargement : après l’installation, les dépendances et la liste de bundle du Profile sont vérifiées et les manques complétés, évitant l’état « installée mais désactivée ».
- Windows ARM64 : un installateur arm64 distinct existe désormais et partage la même charge utile que le paquet x64 ; les runtimes Python / Node / Office embarqués restent des charges utiles x64 exécutées via l’émulation Windows.

Version : produit 2.2.3 → **2.2.4** (les deux espaces de travail de bureau sont synchronisés).`,
  },
  {
    file: 'CHANGELOG.de.md',
    before: `## 2.2.4 — 2026-10-31

Versionserhöhung ohne funktionale Änderungen:

- Version: Produkt 2.2.3 → **2.2.4** (beide Desktop-Arbeitsbereiche synchron).`,
    after: `## 2.2.4 — 2026-10-31

Mitgelieferte Plugins und Installationserlebnis:

- Mitgelieferte Plugins: Der Installer enthält 30 Plugins, die auf der letzten Seite der Ersteinrichtung aufgelistet werden; „Fertig stellen und starten“ installiert sie, danach lassen sie sich im Plugin-Markt unter „Installiert“ verwalten.
- Installationsfortschritt: Während der Installation werden die Beschreibung des aktuellen Plugins und ein Fortschrittsbalken (n/30) angezeigt; ein fehlschlagendes Plugin wird übersprungen, die übrigen laufen weiter und am Ende folgt eine Zusammenfassung.
- Plugin-Liste: kompaktes Vier-Spalten-Layout, das ohne Scrollbalken auf einen Bildschirm passt.
- Ladegarantie: Nach der Installation werden Abhängigkeiten und Bundle-Liste des Profiles geprüft und Lücken gefüllt, sodass „installiert, aber deaktiviert“ nicht mehr auftritt.
- Windows ARM64: Ein eigener arm64-Installer ist nun verfügbar und nutzt dieselbe Payload wie das x64-Paket; die mitgelieferte Python-/Node-/Office-Laufzeit bleibt die x64-Payload, die über die Windows-Emulation ausgeführt wird.

Version: Produkt 2.2.3 → **2.2.4** (beide Desktop-Arbeitsbereiche synchron).`,
  },
  {
    file: 'CHANGELOG.ru.md',
    before: `## 2.2.4 — 2026-10-31

Обновление версии без функциональных изменений:

- Версия: продукт 2.2.3 → **2.2.4** (оба рабочих пространства настольной версии синхронизированы).`,
    after: `## 2.2.4 — 2026-10-31

Встроенные плагины и установка:

- Встроенные плагины: установщик содержит 30 плагинов, перечисленных на последней странице первичной настройки; «Готово и запуск» устанавливает их, после чего ими можно управлять в разделе «Установленные» магазина плагинов.
- Ход установки: во время установки показываются описание текущего плагина и индикатор прогресса (n/30); неудачный плагин пропускается, остальные устанавливаются, а в конце выводится сводка.
- Список плагинов: компактная раскладка в четыре колонки, помещающаяся на одном экране без полосы прокрутки.
- Гарантия загрузки: после установки проверяются зависимости и список bundle профиля, недостающее дополняется — состояние «установлен, но отключён» больше не возникает.
- Windows ARM64: появился отдельный arm64-установщик, использующий ту же полезную нагрузку, что и пакет x64; встроенная среда выполнения Python / Node / Office остаётся x64-нагрузкой, исполняемой через эмуляцию Windows.

Версия: продукт 2.2.3 → **2.2.4** (оба рабочих пространства настольной версии синхронизированы).`,
  },
  {
    file: 'CHANGELOG.pt.md',
    before: `## 2.2.4 — 2026-10-31

Atualização de versão sem mudanças funcionais:

- Versão: produto 2.2.3 → **2.2.4** (ambos os workspaces de desktop sincronizados).`,
    after: `## 2.2.4 — 2026-10-31

Plugins embutidos e experiência de instalação:

- Plugins embutidos: o instalador traz 30 plugins, listados na última página da configuração inicial; «Concluir e iniciar» instala todos e, depois, eles são gerenciados em «Instalados» no mercado de plugins.
- Progresso da instalação: durante a instalação são exibidos a descrição do plugin atual e uma barra de progresso (n/30); um plugin com falha é ignorado e os demais continuam, com um resumo no final.
- Lista de plugins: layout compacto em quatro colunas, cabendo em uma tela sem barra de rolagem.
- Garantia de carregamento: após instalar, as dependências e a lista de bundle do Profile são verificadas e as lacunas preenchidas, evitando o estado «instalado, mas desativado».
- Windows ARM64: agora existe um instalador arm64 separado que compartilha o mesmo payload do pacote x64; o runtime de Python / Node / Office embutido continua sendo o payload x64 executado pela emulação do Windows.

Versão: produto 2.2.3 → **2.2.4** (ambos os workspaces de desktop sincronizados).`,
  },
]

let changed = 0
for (const { file, before, after } of REWRITES) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes(before)) {
    console.error(`MISS ${file}: 2.2.4 entry not found`)
    continue
  }
  writeFileSync(file, text.replace(before, after))
  changed += 1
  console.log(`ok   ${file}`)
}
console.log(`\nrewrote ${changed}/${REWRITES.length}`)
