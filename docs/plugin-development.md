# DSH Desktop 插件开发

DSH Desktop 跑的是**未修改的上游运行时**，因此写插件的第一条规则是：先按普通 DSH 插件写，再决定要不要碰桌面独有的能力。桌面壳只额外提供两样东西——Profile 与包操作——并且都被刻意收窄成两个 Host service。

> 本文写的是**当前实现**的接口。`dsh-community-fabric` 里的 manifest / capability 提案仍是 Draft（`0.1.0-dev.0`），不要按提案写生产代码。

## 先理解两层插件

一个能在 Desktop 里跑起来的插件，最多由两半组成：

### Host 侧 Cordis 插件

普通 Cordis 插件，运行在 Host 进程里，`export const name`、`export const inject`、`export function apply(ctx)`。它可以直接用上游提供的所有 service，也可以用桌面壳额外注入的 service。这一半是 Node 代码，能读文件、起子进程、装包。

### 浏览器半边

渲染器里跑的那一半，由 `dsh.client` 声明、由上游的客户端 loader 加载。它**不能**直接读 Profile、不能直接调 Host service；它对桌面的感知只能来自 Web API 与桌面壳暴露给渲染器的通道。

跨这一层的判断和普通 DSH 一样：需要 Node 能力就把逻辑留在 Host 侧，渲染器只拿结果。

### 两个公开 Host service 的实际形状

Desktop 对插件公开的 Host service 只有两个，其余（`desktopRuntime`、`desktopPnpmBootstrap`、`desktopSettingsController` 等）是壳自己用的内部件。

```ts
interface DesktopCurrentProfile { readonly name: string; readonly dir: string }

interface DesktopProfiles {
  readonly current: DesktopCurrentProfile
  create(name: string): DesktopProfileSummary
  list(): readonly DesktopProfileSummary[]
  prepareSelection(name: string): Promise<DesktopProfileSelection>
  select(name: string): Promise<void>
  canDelete(name: string): boolean
  delete(name: string): Promise<void>
}
```

**稳定可依赖的只有 `current`。**`create` / `list` / `prepareSelection` / `select` / `canDelete` / `delete` 是 Desktop 自己扩展出来的 Profile 管理面，属于桌面产品内部能力，随桌面版本演进；写插件时不要拿它当跨平台契约。

```ts
interface DesktopPnpmOutcome {
  exitCode: number | null
  signal: NodeJS.Signals | null
}

interface DesktopPnpmHandle {
  stdout: Readable
  stderr: Readable
  done: Promise<DesktopPnpmOutcome>
  cancel(): void
}

interface DesktopPnpm {
  run(argv: string[], signal?: AbortSignal): DesktopPnpmHandle
  runPlugin(argv: string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
  runExternalMarketPluginInstall(argv: string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
}
```

这里没有 `installPlugin()`、没有快照、没有回滚、没有重试、也没有收据。想装包就发一条 argv，读它的输出，自己判断结果。

## Desktop 专用插件

```ts
export const name = 'example-desktop-capability'
export const inject = ['desktopProfiles', 'desktopPnpm']

export function apply(ctx: any) {
  ctx.effect(() => {
    ctx.logger?.info?.('profile: %s', ctx.desktopProfiles.current.name)
    return () => {}
  })
}
```

真实的包操作长这样：

```ts
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 5 * 60_000)
const handle = ctx.desktopPnpm.runPlugin(
  ['add', 'some-plugin@1.2.3'],
  '/absolute/path/of/your/plugin',
  controller.signal,
)
handle.stdout.on('data', chunk => ctx.logger?.info?.(String(chunk).trimEnd()))
handle.stderr.on('data', chunk => ctx.logger?.warn?.(String(chunk).trimEnd()))
const { exitCode, signal } = await handle.done
clearTimeout(timer)
if (exitCode !== 0 || signal !== null) throw new Error(`package operation failed: ${exitCode ?? signal}`)
```

几条必须记住的规则：

- `runPlugin` 的 `invokingDir` 必须是**绝对路径**。
- 参数作为 argv 传入，不拼 shell；空 argv、含 NUL、已经 abort、或本代已有操作进行中，都会**同步抛出**（不是返回一个失败的 Promise）。
- `done` 在完整子进程树退出后才 settle；`exitCode` 与 `signal` 要一起判断，只看 `exitCode` 会把被信号杀掉（`exitCode === null`）当成成功。
- 一个 generation 只允许一个 package operation，第二次调用会同步失败而不是排队。
- 句柄自带 `cancel()`，用于主动放弃这**一次**操作；它与传入的 `AbortSignal` 是两条路径，不要假设调用其中一个之后 `done` 就不再 settle——`done` 仍会给出该次操作的退出码与信号。
- 别把 `AbortSignal` 当成"卸载时多半会触发"的礼貌请求：generation dispose 会终止该操作，你的清理逻辑要能处理这种情况。

### 依赖不存在的服务名会静默 pending

`inject: ['desktopPnpm']` 写错（比如写成 `desktopPnpmBootstrap` 或旧名），插件不会报错——它会永远停在 pending，只有外部症状（前台 4xx）。这是这套 loader 最贵的坑：**没有异常可看**。

排查顺序：确认服务名拼写 → 确认提供它的 bundle 真的在本代装载 → 确认 profile 里的 insert 行没被过滤。实在不确定就用条件注入（下一节），让它降级而不是卡死。

## 兼容 Desktop 和普通 DSH

同一个包要能在两边跑，就不能在顶层声明桌面专属的 required inject。

```ts
export const inject = ['webServer']   // 只声明两边都有的

export function apply(ctx: any) {
  const profiles = ctx.get('desktopProfiles')
  if (!profiles) {
    ctx.logger?.info?.('running outside DSH Desktop; desktop features disabled')
    return
  }
  ctx.inject(['desktopPnpm'], (desktopCtx: any) => {
    // 到这里两个服务都确定存在
  })
}
```

`ctx.get(name)` 返回 `undefined` 表示"没有"，不是"坏了"；`ctx.inject([...], cb)` 用于后到的服务。**不要**在插件里推断当前 profile——`desktopProfiles.current` 是唯一事实来源，读它，不要去解析环境变量或路径。

## 用 profile 补丁接入平台能力

Profile 补丁是插件参与平台组合的正路，而不是"改用户配置文件的捷径"。三种合法用途：

1. 覆盖某个上游行的 config（例如关掉自动开浏览器）。
2. `disabled: true` 关掉某一行。
3. `insert` 追加自己的 loader entry。

```yaml
# <你的包>/cordis.patch.yml
- id: web-runtime
  config:
    openBrowser: false
- insert:
    - id: example-capabilities
      name: example-plugin
```

三条判据按代价从低到高：

- `- id:` 写错只打印 `entry not found` 警告，其余补丁照旧生效——所以"补丁没生效"通常不是补丁写坏了，而是 id 打错了。
- `insert` 的 `name` 是**模块标识符**，写错会报错（模块加载失败），这个比 id 错好查。
- 补丁层有顺序：bundle 自己的补丁 → profile 用户补丁 → 壳的覆盖层 → 机级补丁。不要指望"最后写的赢"，写之前先确认自己被哪一层盖住。

## 让浏览器半边被加载

三件事同时成立才会加载：

1. `package.json` 的 `dsh.bundle.patch` 指向你的补丁文件，且补丁里 insert 一行 loader entry。
2. `dsh.client.platform = "web"`，并导出 `./client`。
3. Node 那一半的 `main` 仍然存在——缺少 Host 侧入口时 loader 会认为这个 bundle 不完整。

最小形状：

```json
{
  "name": "example-plugin",
  "main": "lib/index.js",
  "exports": { "./client": "./lib/client.js" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-layout"] }
  }
}
```

可以直接照 `dsh-nonead-client-skin` 抄：它就是一个完整的"Host 侧插件 + 浏览器半边 + 补丁"范例。

## run()、runPlugin()、runExternalMarketPluginInstall() 的区别

三个方法都跑 pnpm，区别在于**跑哪套语义**：

| | cwd | 额外行为 |
| --- | --- | --- |
| `run(argv)` | 当前 profile | 就是 pnpm，壳不追加语义 |
| `runPlugin(argv, invokingDir)` | 当前 profile | 需要绝对 `invokingDir`；会做 bundle reconcile |
| `runExternalMarketPluginInstall(argv, invokingDir)` | 当前 profile | 只接受 `add` + 精确版本 npm 目标 |

`runExternalMarketPluginInstall` 只收一种形状：`add` 加 flag 加精确版本的 npm 目标。它拒绝 `latest`、拒绝路径、拒绝 git 目标——因为市场安装需要可复现的结果，而 `latest` 不是。Host 侧会自己解析 `latest` 并校验 DSH manifest，再落到精确版本。

其余共同点：参数永远作为 argv 传递，不经过 shell；空 argv、含 NUL、已 abort、已有操作进行中都会同步抛；`done` 在整棵子进程树退出后才 settle；generation dispose 会终止本代的操作。

## 市场插件：按名安装与非图片媒体预览

`dsh-community-market` 在市场侧有两处和插件作者直接相关的行为（2.1.15）：

- **按名安装**（`src/plugin-spec.ts`）只接受合法包名，拒绝空、超长（>214）、版本锁定写法与非法名；这个模块零依赖，渲染器与 Host 用同一套规则，所以用户看到的拒绝理由与最终安装判定一致。
- **非图片媒体预览**（`src/client/media-preview.ts`）按 `name` 的扩展名给资产分类（`image` / `video` / `audio` / `pdf` / `archive` / `document` / `other`）；非图片资产不会塞进 `<img>` 里等失败，而是呈现类型标签、大小与"用系统处理器打开"。

对插件作者的启示：市场条目里的媒体资产请给带扩展名的 `name`，否则只能落到 `other`。

## 不要依赖的接口

以下是壳内部件，随时会变。写插件时把它们当私有：

- `desktopRuntime`、`desktopPnpmBootstrap`、`desktopSettingsController`
- `BrowserWindow`、托盘注册表、原生菜单项
- 任何 private Node helper、`ELECTRON_RUN_AS_NODE`、壳生成的 shim
- 壳与 Host 之间的控制通道（Beta 是私有 RPC，Stable 是 `process.send` 消息）——那是内部握手，两个壳的实现都不同，插件不该看到它

判断标准很简单：插件在普通 DSH 里跑不起来时，需要的那个东西如果只能从壳里拿，那它就不该进插件。

## 测试与发布检查

- 在**普通 DSH** 里跑一遍：没有桌面服务时插件必须能用 `ctx.get` 降级，而不是挂起。
- 在 Desktop 里跑一遍：确认 `desktopProfiles.current` 与实际打开的窗口 profile 一致。
- 关掉市场、切到另一个 profile、再从恢复模式启动一次——这三个场景最容易暴露"假设某代一定存在"的问题。
- 检查 `dsh.client.platform` 与 `dsh.bundle.patch` 是否同时存在；只有浏览器半边没有 Host 半边会加载失败。
- 检查包是否进了生产闭包：`devDependencies` 里的东西在打包后不存在。

## 打包时要注意的依赖分类

| 分类 | 结果 |
| --- | --- |
| `dependencies` | 进生产闭包，随包分发 |
| 非可选 `peerDependencies` | 进生产闭包（必须是上游确实提供的东西） |
| 已安装的 `optionalDependencies` | 进生产闭包 |
| `devDependencies` | 不进包 |
| 纯类型依赖 | 降级为 optional peer 或 devDependencies，不要留在 `dependencies` |

两条容易踩的边界：闭包落点由"从依赖方解析"决定，不是简单的顶层提升，所以不要把体积大的包依赖在会被 hoist 改变的位置；`files` 只接受字面名与 `目录/**`，通配再花也不会被识别。

## 相关文档

- [架构](architecture.md)
- [插件生态倡议](plugin-ecosystem.md)
- [桌面壳服务参考（Beta）](../dsh-plugin-desktop-beta/docs/plugin-services.zh.md)
- [社区市场](../dsh-community-market/README.zh.md)
- [社区能力层（Draft）](../dsh-community-fabric/README.zh.md)
