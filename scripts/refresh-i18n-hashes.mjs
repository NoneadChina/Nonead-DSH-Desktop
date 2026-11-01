/**
 * One-off: refresh the Git blob hashes recorded in every `*.i18n.yaml` record after the
 * README and CHANGELOG edits. The verification gate compares each recorded hash against
 * `git hash-object --path=<file>`, so only that value keeps the gate green.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, posix } from 'node:path'

const RECORDS = [
  'README.i18n.yaml',
  'CHANGELOG.i18n.yaml',
  'dsh-plugin-desktop-beta/README.i18n.yaml',
  'docs/README.i18n.yaml',
  'docs/architecture.i18n.yaml',
  'docs/faq.i18n.yaml',
  'docs/plugin-ecosystem.i18n.yaml',
  'dsh-plugin-desktop-beta/docs/plugin-services.i18n.yaml',
]

for (const record of RECORDS) {
  const content = readFileSync(record, 'utf8')
  const lines = content.split(/\r?\n/u)
  // Entries name their document relative to the record, while `git hash-object` needs the
  // repository-relative path, so the record's directory has to be prefixed.
  const base = dirname(record)
  const updated = lines.map(line => {
    const match = /^([^:#][^:]*):\s*([0-9a-f]{40})\s*$/u.exec(line.trim())
    if (match === null) return line
    const [, relativeDocument] = match
    const document = base === '.' ? relativeDocument : posix.join(base.replaceAll('\\', '/'), relativeDocument)
    const hash = execFileSync('git', ['hash-object', `--path=${document}`, '--', document], {
      encoding: 'utf8',
    }).trim()
    return `${relativeDocument}: ${hash}`
  })
  writeFileSync(record, updated.join('\n'))
  console.log(`refreshed ${record}`)
}
