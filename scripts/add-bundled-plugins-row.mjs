/**
 * One-off: add the bundled-plugin capability row to every README's capabilities table,
 * right after the built-in market row. Literal anchor per language.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ROWS = [
  ['README.md', '| 内置插件市场 |', '| 内置插件预装 | 安装包携带 30 个插件，首次设置的最后一页列出清单；点「完成并开始」后逐个安装并显示进度，装好后可在插件市场的「已安装」里管理 |'],
  ['README.en.md', '| Built-in plugin market |', '| Bundled plugins | The installer carries 30 plugins, listed on the last setup page; pressing "Finish and start" installs them one by one with visible progress, and they are managed under Installed in the plugin market |'],
  ['README.ja.md', '| 組み込みプラグインマーケット |', '| 同梱プラグイン | インストーラーに 30 個のプラグインを同梱し、初期設定の最終ページに一覧を表示します。「完了して開始」で 1 つずつインストールしながら進捗を表示し、以後はマーケットの「インストール済み」で管理できます |'],
  ['README.es.md', '| Mercado de plugins integrado |', '| Plugins incluidos | El instalador incorpora 30 plugins, listados en la última página de la configuración inicial; «Finalizar y empezar» los instala uno a uno mostrando el progreso, y se gestionan en «Instalados» del mercado de plugins |'],
  ['README.fr.md', '| Marché de plugins intégré |', '| Extensions intégrées | L’installateur embarque 30 extensions, listées sur la dernière page de la configuration initiale ; « Terminer et démarrer » les installe une par une avec la progression, puis elles se gèrent dans « Installées » du marché des extensions |'],
  ['README.de.md', '| Integrierter Plugin-Marktplatz |', '| Mitgelieferte Plugins | Der Installer enthält 30 Plugins, aufgelistet auf der letzten Seite der Ersteinrichtung; „Fertig stellen und starten“ installiert sie einzeln mit Fortschrittsanzeige, danach Verwaltung im Plugin-Markt unter „Installiert“ |'],
  ['README.ru.md', '| Встроенный магазин плагинов |', '| Встроенные плагины | Установщик содержит 30 плагинов, перечисленных на последней странице первичной настройки; «Готово и запуск» устанавливает их по одному с показом прогресса, после чего ими можно управлять в разделе «Установленные» магазина плагинов |'],
  ['README.pt.md', '| Mercado de plugins integrado |', '| Plugins embutidos | O instalador traz 30 plugins, listados na última página da configuração inicial; «Concluir e iniciar» instala um a um com progresso, e depois são gerenciados em «Instalados» no mercado de plugins |'],
]

let changed = 0
for (const [file, anchor, row] of ROWS) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const index = lines.findIndex(line => line.startsWith(anchor))
  if (index === -1) {
    console.error(`MISS ${file}: anchor ${anchor} not found`)
    continue
  }
  if (lines[index + 1]?.startsWith('| 内置插件预装') || lines[index + 1]?.includes('Bundled plugins |')) {
    console.log(`skip ${file} (already present)`)
    continue
  }
  lines.splice(index + 1, 0, row)
  writeFileSync(file, lines.join('\n'))
  changed += 1
  console.log(`ok   ${file}`)
}
console.log(`\ninserted ${changed}/${ROWS.length}`)
