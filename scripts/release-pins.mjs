/** Next 外壳的复制文件溯源记录、以及多语言发布文档，都必须与当前 pin 对齐。 */
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const RELEASE_HEADING = /^## (\d+\.\d+\.\d+) — \d{4}-\d{2}-\d{2}$/mu

/** 仓库地址去掉尾部斜杠与 .git 后缀后比较：upstream.json 带 .git，溯源记录不带。 */
export function normalizeRepository(repository) {
  return String(repository ?? '').trim().replace(/\/+$/u, '').replace(/\.git$/u, '')
}

/** 只在「不是更长版本号的一部分」时算命中，避免 2.2.3 在 2.2.30 里假通过。 */
export function mentionsVersion(content, version) {
  return new RegExp(`(?<![0-9.])${version.replaceAll('.', '\\.')}(?![0-9])`, 'u').test(content)
}

/**
 * 溯源记录必须与 active channel 的 pin 完全一致，且每条记录都要用上游 checkout 的
 * 实际字节重新算哈希 —— 只比版本号或只检查文件存在都会让手工改动静默通过。
 */
export function verifyUpstreamReference({ reference, channel, repository, upstreamSha256, localExists }) {
  const violations = []
  if (normalizeRepository(reference?.repository) !== normalizeRepository(repository)) {
    violations.push(`repository ${JSON.stringify(reference?.repository)} differs from upstream.json ${JSON.stringify(repository)}`)
  }
  if (!COMMIT_PATTERN.test(reference?.commit ?? '')) {
    violations.push('commit is not a full 40-character Git SHA')
  } else if (reference.commit !== channel.commit) {
    violations.push(`commit ${reference.commit} differs from the active channel ${channel.commit}`)
  }
  if (reference?.version !== channel.sourceVersion) {
    violations.push(`version ${String(reference?.version)} differs from the active channel ${channel.sourceVersion}`)
  }
  const files = reference?.files
  if (!Array.isArray(files) || files.length === 0) {
    violations.push('records no copied file')
  } else {
    for (const [index, entry] of files.entries()) {
      const where = `files[${String(index)}]`
      if (typeof entry?.upstream !== 'string' || entry.upstream.length === 0) {
        violations.push(`${where} has no upstream path`)
        continue
      }
      if (typeof entry.local !== 'string' || entry.local.length === 0) {
        violations.push(`${where} has no local path`)
        continue
      }
      if (!SHA256_PATTERN.test(entry.upstreamSha256 ?? '')) {
        violations.push(`${where} ${entry.upstream} has an invalid upstreamSha256`)
        continue
      }
      const actual = upstreamSha256(entry.upstream)
      if (actual === undefined) {
        violations.push(`${where} ${entry.upstream} is missing from the pinned upstream checkout`)
      } else if (actual !== entry.upstreamSha256) {
        violations.push(`${where} ${entry.upstream} no longer matches the recorded upstreamSha256`)
      }
      if (!localExists(entry.local)) violations.push(`${where} ${entry.local} is missing from the Next shell`)
    }
  }
  if (violations.length > 0) throw new Error(`upstream reference gate failed:\n- ${violations.join('\n- ')}`)
  return { fileCount: files.length }
}

/**
 * `.i18n.yaml` 记录声明的每个语言都要带上当前版本：CHANGELOG 以发布标题为准，
 * README 只要求出现版本号（各语言措辞不同，不能要求同一句式）。
 */
export function verifyLanguageReleaseParity({ recordPath, entries, readDocument, version, headings = false }) {
  const violations = []
  for (const entry of entries) {
    let content
    try {
      content = readDocument(entry.filename)
    } catch (cause) {
      violations.push(`${recordPath} cannot read ${entry.filename}: ${cause instanceof Error ? cause.message : String(cause)}`)
      continue
    }
    if (headings) {
      const released = RELEASE_HEADING.exec(content)?.[1]
      if (released === undefined) {
        violations.push(`${entry.filename} must lead with a "## <version> — <date>" release heading`)
      } else if (released !== version) {
        violations.push(`${entry.filename} leads with ${released}, but the released version is ${version}`)
      }
    } else if (!mentionsVersion(content, version)) {
      violations.push(`${entry.filename} does not mention the released version ${version}`)
    }
  }
  if (violations.length > 0) throw new Error(`release document parity gate failed:\n- ${violations.join('\n- ')}`)
  return { documentCount: entries.length }
}
