import { readFileSync } from 'node:fs'

/*
 * `git diff -z` separates paths with NUL, but a hand-fed list (or a Windows pipeline)
 * arrives newline-separated, sometimes with CRLF. Splitting on both keeps manual runs
 * from silently classifying every path as documentation.
 */
const changedPaths = readFileSync(0)
  .toString('utf8')
  .split(/\0|\r?\n/u)
  .filter(Boolean)

const productCriticalDocument = /(?:^|\/)(?:LICENSE(?:\.[^/]*)?|THIRD_PARTY_NOTICES\.md)$/u
/*
 * JSON Schemas under `docs/schemas/` are runtime assets: dsh-community-market loads
 * them through `new URL('../../docs/schemas/${name}.schema.json', import.meta.url)`
 * and validates catalog payloads against them, so a schema edit must run the product
 * gates even though it sits in a documentation directory.
 */
const runtimeSchema = /(?:^|\/)docs\/schemas\/[^/]+\.schema\.json$/u
/*
 * Documentation-only changes skip the product gates, but a documentation LOCATION
 * is not enough: `docs/` also carries runtime assets (the JSON Schemas above and
 * any future script or data module), so `docs/foo.js` or `docs/foo.json` must run
 * the product gates like any other source change. The extension has to be a
 * documentation format as well, wherever the file lives (root README/CHANGELOG,
 * `docs/`, `.agents/notes/`); issue templates and documentation images are the two
 * explicit positional exceptions below.
 */
const documentationFile = /\.(?:mdx?|i18n\.ya?ml)$/u
/*
 * Two positions stay documentation without a documentation extension: GitHub issue
 * templates (YAML that only shapes the issue form) and images the documentation
 * embeds under `docs/`. Product assets such as `build/app-icon.png` are NOT covered
 * here and keep running the product gates.
 */
const documentationPosition = /(?:^|\/)\.github\/ISSUE_TEMPLATE\/[^/]+$/u
const documentationImage = /^docs\/(?:[^/]+\/)*[^/]+\.(?:png|jpe?g|gif|svg|webp|avif)$/u

const isDocumentation = (path) =>
  documentationFile.test(path) || documentationPosition.test(path) || documentationImage.test(path)

const productChanged = changedPaths.length === 0 || changedPaths.some((path) => {
  if (productCriticalDocument.test(path) || runtimeSchema.test(path)) return true
  return !isDocumentation(path)
})

process.stdout.write(productChanged ? 'true\n' : 'false\n')
