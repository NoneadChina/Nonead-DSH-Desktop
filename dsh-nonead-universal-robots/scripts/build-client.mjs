// scripts/build-client.mjs
// 契约（Task 1 核验，Ruling 6）：shell 用经典 script 加载 bundle，官方产物一律是
// CJS 工厂包装 —— 必须 format:'cjs' + banner/intro/footer，否则 `export` 会 SyntaxError。
// Ruling 13：只做响亮失败（throw），**不做**任何静默的字符串重排兜底。
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'

const OUT = 'lib/client.js'

// DSH 以包名作为插件 id（`/plugins/<id>/client.js` 与 `window.__DSH_BOOT__` 的登记键）。
// bundle id 必须等于 package.json 的 name：漂移时它只会在运行时以
// "loaded without registering"（packages/client/modules/src/client/system.ts）暴露，
// 因此这里改为读 package.json 并断言相等 —— 改名即构建立刻失败。
const EXPECTED_ID = 'dsh-nonead-universal-robots'
const ID = JSON.parse(readFileSync('package.json', 'utf8')).name

const HEAD = `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`
const INTRO = 'var module = { exports: {} }; var exports = module.exports;'
const TAIL = 'return module.exports; } });'

if (ID !== EXPECTED_ID) {
  throw new Error(
    `build-client: package.json 的 name 为 "${ID}"，期望 "${EXPECTED_ID}"。\n` +
      `  bundle id 必须与包名一致（shell 用包名登记 entry），改名需同步 profile 安装与 shell 侧登记。`,
  )
}

await build({
  entryPoints: ['src/client/index.js'],
  outfile: OUT,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome110'],
  minify: true,
  sourcemap: true,
  logLevel: 'info',
  // Ruling 32（更正 Ruling 12 的范围）：esbuild **根本没有 `intro` 选项** —— 不止 CLI，
  // JS API 同样会直接抛 `Invalid option in build() call: "intro"`（此前误判为沙箱 spawn EPERM）。
  // 等价施加：把 INTRO 折进 `banner.js` 的下一行（顺序仍是 HEAD → INTRO → code → footer）。
  banner: { js: `${HEAD}\n${INTRO}` },
  footer: { js: TAIL },
})

// 契约自检（Ruling 13）：任一不满足立即 throw，绝不静默改写产物。
const out = readFileSync(OUT, 'utf8')
const firstLine = out.split(/\r?\n/, 1)[0]
const contractError = (why) =>
  new Error(
    `build-client: ${OUT} 不满足 CJS 工厂包装契约 —— ${why}\n` +
      `  期望首行：${HEAD}\n` +
      `  期望收尾：${TAIL}\n` +
      `  请检查 esbuild 的 format（必须 'cjs'）与 banner.js / footer.js 两个选项，` +
      `并确认注入顺序仍是 banner(HEAD+INTRO) → code → footer（banner 打开 factory 并声明 module/exports、` +
      `footer 关闭 factory 并 return module.exports）。注意 esbuild 没有 \`intro\` 选项（Ruling 32）。`,
  )

if (!out.startsWith(HEAD)) throw contractError(`首行不是 factory 开头（实际：${JSON.stringify(firstLine.slice(0, 80))}）`)
if (/(^|[;\n}])\s*export\s*[{(]/.test(out)) throw contractError('含顶层 export，经典 script 执行时会 SyntaxError')
if (!out.includes(TAIL)) throw contractError('缺少 factory 收尾，footer 未生效')
try {
  new Script(out, { filename: OUT })
} catch (e) {
  throw contractError(`无法作为经典 script 编译（${e.message}）—— 包装括号可能不平衡`)
}

console.log(`build-client: ok — ${OUT} (id=${ID}) 首行契约通过`)
