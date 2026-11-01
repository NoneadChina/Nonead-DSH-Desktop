/**
 * One-off: append the bundled-plugin list (name, version, one-line purpose) to the 2.2.4
 * entry of every CHANGELOG. Data comes from plugin/manifest.json so the document cannot
 * drift from what the installer actually carries. Introductions stay in their Chinese
 * source form, which is also what the setup wizard shows.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('plugin/manifest.json', 'utf8'))
const rows = manifest.plugins
  .map(plugin => `| \`${plugin.name}\` | ${plugin.version} | ${plugin.description ?? ''} |`)
  .join('\n')

const TITLES = {
  'CHANGELOG.md': '### 内置插件清单',
  'CHANGELOG.en.md': '### Bundled plugin list',
  'CHANGELOG.ja.md': '### 同梱プラグイン一覧',
  'CHANGELOG.es.md': '### Lista de plugins incluidos',
  'CHANGELOG.fr.md': '### Liste des extensions intégrées',
  'CHANGELOG.de.md': '### Liste der mitgelieferten Plugins',
  'CHANGELOG.ru.md': '### Список встроенных плагинов',
  'CHANGELOG.pt.md': '### Lista de plugins embutidos',
}

const NOTES = {
  'CHANGELOG.md': '插件顺序按包名排序；简介与首次设置向导里显示的一致。',
  'CHANGELOG.en.md': 'Entries are sorted by package name; each introduction matches what the setup wizard shows.',
  'CHANGELOG.ja.md': 'パッケージ名順に並んでいます。各説明は初期設定ウィザードの表示と同じです。',
  'CHANGELOG.es.md': 'Las entradas están ordenadas por nombre de paquete; cada descripción coincide con la que muestra el asistente de configuración.',
  'CHANGELOG.fr.md': 'Les entrées sont classées par nom de paquet ; chaque description correspond à celle affichée par l’assistant de configuration.',
  'CHANGELOG.de.md': 'Die Einträge sind nach Paketnamen sortiert; jede Beschreibung entspricht der Anzeige im Einrichtungsassistenten.',
  'CHANGELOG.ru.md': 'Записи отсортированы по имени пакета; каждое описание совпадает с тем, что показывает мастер первоначальной настройки.',
  'CHANGELOG.pt.md': 'As entradas estão ordenadas por nome de pacote; cada descrição corresponde à exibida pelo assistente de configuração.',
}

const HEADING = /^## (2\.2\.3|2\.2\.2|2\.1\.\d+)/mu
let changed = 0

for (const [file, title] of Object.entries(TITLES)) {
  const text = readFileSync(file, 'utf8')
  if (text.includes(title)) {
    console.log(`skip ${file} (already listed)`)
    continue
  }
  const match = HEADING.exec(text)
  if (match === null) {
    console.error(`MISS ${file}: next version heading not found`)
    continue
  }
  const block = `${title}\n\n${NOTES[file]}\n\n| Plugin | Version | Purpose |\n| --- | --- | --- |\n${rows}\n\n`
  const index = match.index
  writeFileSync(file, `${text.slice(0, index)}${block}${text.slice(index)}`)
  changed += 1
  console.log(`ok   ${file}`)
}

console.log(`\nupdated ${changed}/${Object.keys(TITLES).length}`)
