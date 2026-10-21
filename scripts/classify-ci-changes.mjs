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
const documentationPath = /^(?:docs\/|\.agents\/notes\/|\.github\/(?:ISSUE_TEMPLATE\/|PULL_REQUEST_TEMPLATE))/u
const nestedDocumentationPath = /\/docs\//u
const documentationFile = /(?:\.mdx?|\.i18n\.ya?ml)$/u

const productChanged = changedPaths.length === 0 || changedPaths.some((path) => {
  if (productCriticalDocument.test(path) || runtimeSchema.test(path)) return true
  return !documentationPath.test(path)
    && !nestedDocumentationPath.test(path)
    && !documentationFile.test(path)
})

process.stdout.write(productChanged ? 'true\n' : 'false\n')
