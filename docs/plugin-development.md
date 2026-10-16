# DSH Desktop 插件开发

> **当前接口与 Draft 请勿混淆：** 本文介绍现在可用的 DSH/Cordis 与 Desktop service。`dsh-community-fabric` 中的 manifest、capability 和统一事件模型仍处于[社区 RFC Draft](../dsh-community-fabric/README.zh.md)，尚不能作为依赖或发布目标。

## 先理解两层插件

一个普通 DSH 插件可以提供 Host service、命令、路由、bundle 或 Web Client。它应该尽量只依赖官方 DSH contract，因此可以在命令行、普通 Web profile 和 DSH Desktop 中复用。

Desktop 另外提供两个公开的 Host service：

- `desktopProfiles`：读取当前 profile。
- `desktopPnpm`：在当前 profile 中执行打包的 pnpm，或通过官方 `dsh plugin` CLI 语义管理插件。

它们属于 Host 子进程的 Cordis generation。Renderer 不能直接读取它们；有浏览器界面的插件仍应使用普通 DSH Web routes、RPC、client metadata、service 和 slot。

完整类型、生命周期和失败语义见 [`dsh-plugin-desktop-beta/docs/plugin-services.md`](../dsh-plugin-desktop-beta/docs/plugin-services.md)。下面只给出选择方式和最小原则。

### 先认清两个 service 的**实际形状**

这是最容易踩的一处：**存在同名 service 不等于存在同名方法。** 目前运行时真正提供的是：

```ts
// desktopProfiles
interface DesktopProfiles {
  readonly current: { readonly name: string; readonly dir: string }
}

// desktopPnpm
interface DesktopPnpm {
  run(argv: readonly string[], signal?: AbortSignal): DesktopPnpmHandle
  runPlugin(argv: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
  runExternalMarketPluginInstall(argv: readonly string[], invokingDir: string, signal?: AbortSignal): DesktopPnpmHandle
}

interface DesktopPnpmHandle {
  readonly stdout: Readable
  readonly stderr: Readable
  readonly done: Promise<{ readonly exitCode: number | null; readonly signal: NodeJS.Signals | null }>
  cancel(): void
}
```

`desktopProfiles` 在当前的桌面壳 Host 里**只有 `current`**——profile 的发现与切换由壳自己的窗口负责，不经过 Host service。`desktopPnpm` **没有** `installPlugin()` 这类"可恢复安装"入口，也不提供快照、回滚、重试、安装收据或恢复记账：**调用方自己拥有包身份策略、命令构造、`dsh.profile.bundles` 协调和操作后校验。**

## Desktop 专用插件

如果插件只应该在 Desktop 中运行，可以把服务声明为 required injection：

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { DesktopPnpmHandle } from 'dsh-plugin-desktop-beta/pnpm'
import type {} from 'dsh-plugin-desktop-beta/profile-service'

export const name = 'example-desktop-plugin'
export const inject = ['desktopProfiles', 'desktopPnpm']

declare function registerInstallAction(
  callback: (target: string) => Promise<void>,
): () => void

export function apply(ctx: Context): void {
  ctx.logger.info(`profile: ${ctx.desktopProfiles.current.name}`)
  ctx.effect(() => {
    let active: DesktopPnpmHandle | undefined

    // 把这个回调接到插件界面的明确用户操作上。
    const dispose = registerInstallAction(async (target) => {
      // 先校验 target 是否符合本插件的信任策略，再动包管理器。
      const signal = AbortSignal.timeout(5 * 60_000)
      const operation = ctx.desktopPnpm.run(['add', '--save-exact', `${target}@1.0.0`], signal)
      active = operation
      operation.stdout.setEncoding('utf8')
      operation.stderr.setEncoding('utf8')
      operation.stdout.on('data', chunk => ctx.logger.info(String(chunk).trimEnd()))
      operation.stderr.on('data', chunk => ctx.logger.warn(String(chunk).trimEnd()))
      try {
        const outcome = await operation.done
        if (outcome.exitCode !== 0) {
          throw new Error(
            `plugin install failed: exit=${String(outcome.exitCode)} signal=${String(outcome.signal)}`,
          )
        }
      } finally {
        if (active === operation) active = undefined
      }
    })

    return async () => {
      dispose()
      const operation = active
      operation?.cancel()
      await operation?.done.catch(() => {})
    }
  }, 'example: package-manager user action')
}
```

实际项目应该把 package operation 放在明确的用户动作中，校验目标来源，自己设置 deadline，持续读取 stdout/stderr，并在结束后同时检查 `exitCode` 与 `signal`；退出码为 0 也不替代插件自己的领域校验。一个 generation 同时只允许一个 `desktopPnpm` package operation，第二次调用会**同步抛出**；插件卸载时必须取消并等待它结束。

### 依赖不存在的服务名会静默 pending

Cordis 对 required `inject` 的语义是"等这个服务出现才激活"：**服务名写错、或依赖一个当前运行时并不存在的服务，插件就永远不激活，宿主不会报错。** 表现是它的路由、命令、工具全部不存在，界面只看到莫名的 HTTP 4xx。

要确认一个 service 名是否真的存在，看两个地方：运行时目录里壳贡献的 `cordis.patch.yml` / `host.cordis.patch.yml`，以及你依赖的包是否在 `dsh.profile.bundles` 里被挂成 Loader 行。不要靠"名字看起来对"来判断。

## 兼容 Desktop 和普通 DSH

如果同一个插件也要在普通 `dsh web` 中运行，不要把 Desktop service 放进顶层 required `inject`。先用 `ctx.get('desktopProfiles')` 判断是否处于 Desktop，再把 Desktop service 放进嵌套 injection，让 adapter 随着 service 的 generation 一起卸载：

```ts
export const inject = ['webServer', 'loader']

export function apply(ctx: Context, config: { profile?: string }): void {
  const profiles = ctx.get('desktopProfiles')
  if (profiles === undefined) {
    mountOrdinaryDshManager(ctx, config.profile ?? 'web')
    return
  }

  ctx.inject(['desktopPnpm'], (desktopCtx) => {
    desktopCtx.effect(() => mountManager(desktopCtx, {
      profile: profiles.current.name,
      profileDir: profiles.current.dir,
      runPnpm: (argv, signal) => desktopCtx.desktopPnpm.run(argv, signal),
    }), 'example: Desktop plugin manager')
  })
}
```

`ctx.inject()` 不是"可选依赖"声明：传进去的每个名字对该回调都是必需的，这正是它在这里的用途——**只有嵌套的 Desktop adapter 需要等 `desktopPnpm`**，外层插件仍然持有普通 DSH 的 fallback。

普通 DSH 的 fallback 仍然是插件自己的权威实现。不要从 `process.argv`、`ctx.baseUrl`、settings 或 `$DSH_HOME` 推断 Desktop profile；在 Desktop 中以 `desktopProfiles.current` 为准。**不要**用非 Desktop 时反推出来的名字去猜另一个 profile。

## 用 profile 补丁接入平台能力

桌面能力的正式接入方式是**补丁**，而不是替换上游源码。补丁按 row id 命中，有三种作用，选错了不会报错、只会静默失效（详见[架构说明的补丁一节](architecture.md#补丁按-row-id-命中写错不会报错)）：

- **覆盖一个上游行的配置**：`- id: <row id>` + 字段（`config` 整体替换，不深合并）。
- **关掉一个上游行**：`- id: <row id>` + `disabled: true`。
- **加入自己的行**：`- insert: [{ id: ..., name: ... }]`；带 `id` 时插进该 group，不带 `id` 时追加到顶层。

```yaml
# 一个插件 bundle 自己的 cordis.patch.yml
- id: ui-sidebar-browser
  # 上游把这一行按 Profile 名判断要不要开；本产品不依赖用户的 Profile 名。
  disabled: false
- insert:
    - id: example-capabilities
      name: example-plugin
```

三条判据：

1. **`id` 写错 → 只有一条 Loader 警告，启动照常。** `name` 是断言而不是改名，写错同样只跳过并警告。所以"改了配置但没生效"要先看启动日志里的 patch 警告，而不是怀疑插件没加载。
2. **`insert` 的 `name` 是模块标识符**，它由运行时按 Node 解析规则解析；写错会在加载该行时报错，这与 `id` 写错的表现相反。
3. **补丁层有顺序**：每个 bundle 自己的补丁 → profile 目录里的 `cordis.patch.yml` → launcher 覆盖层。后面的层覆盖前面的层，所以用户补丁能关掉 bundle 加的默认行为。

## 让浏览器半边被加载

有 Web Client 半边的插件（例如品牌皮肤这类纯前端插件）要同时满足三件事，缺一件就"Host 半边在跑、页面没有变化"：

1. `package.json` 声明 `dsh.bundle.patch` 指向自己的补丁文件，其中 `insert` 一行 loader entry —— **客户端模块扫描的是 Host Loader 里已经存在的行**，没有这一行，浏览器半边不会被纳入 boot graph。
2. `package.json` 声明 `dsh.client.platform = "web"`，并导出 `./client` bundle。声明了 `dsh.client` 却没有 `./client` 导出会直接报错；`platform` 不是 `web` 的包会被扫描跳过。
3. 包保留一个 Node 半边（`main` 指向的文件必须存在），即使它什么也不做。这是一个双面包的约定：**去掉 Node 半边，包就没有 `lib/index.js`，Host Loader 无法 import 它。**

可参考仓库里的实际实现：[`dsh-nonead-client-skin`](../dsh-nonead-client-skin/)——它的 `cordis.patch.yml` 只做一次 `insert`，`dsh.client.platform = web`，Host 半边是一个空 `apply()`，浏览器半边用 slot 定位注入样式。

角色边界：**插件的宿主只是"被 Loader 行引用的普通包"**，它没有特权。安装进 profile 的包走与官方包相同的解析与加载路径。

## `run()`、`runPlugin()` 和 `runExternalMarketPluginInstall()` 的区别

`desktopPnpm.run(argv, signal)` 是低层 pnpm operation，cwd 固定为当前 profile 目录。当你需要像 `['--dir', pluginDir, 'run', 'build']` 这样的生命周期自管本地工作，并且希望继承 Desktop 打包的 pnpm 与 Node surface、又不修改激活 profile 时，它是合适的选择。它不保证 DSH 的 profile 初始化、调用方相对 `file:`/`link:` source 锚定或 `dsh.profile.bundles` reconcile——**这些都由调用方负责。**

`desktopPnpm.runPlugin(argv, invokingDir, signal)` 用打包的 `dsh plugin --profile <active>` 语义执行非安装类 mutation，并保留上游插件管理语义（含 bundle reconcile）。它需要调用方提供一个**绝对**的工作目录。

`desktopPnpm.runExternalMarketPluginInstall(argv, invokingDir, signal)` 是给随包 `dshmarket` 的窄适配器：只接受 `add`、flag 形式选项和**一个精确版本**的 npm 目标，其他形状同步拒绝。

```ts
const signal = AbortSignal.timeout(5 * 60_000)
desktopPnpm.run(['add', '--save-exact', 'example-plugin@1.0.0'], signal)
desktopPnpm.runPlugin(['remove', packageName], invokingDir, signal)
desktopPnpm.runPlugin(['update'], invokingDir, signal)
desktopPnpm.runPlugin(['install', '--no-frozen-lockfile'], invokingDir, signal)
```

参数始终作为 argv 传递；不要拼接 shell 字符串，也不要依赖 Windows `.cmd` shim。空 argv、含 NUL 的参数、已经 abort 的 signal、以及 generation 已有操作在跑，都会**在返回 handle 之前同步抛出**。服务会在完整子进程树退出后 settle（不是 wrapper 一退出就 settle），并在 generation dispose 时终止仍在运行的 operation。

## 不要依赖的接口

`desktopRuntime`、`desktopPnpmBootstrap`、Electron `BrowserWindow`、托盘注册表、private Node helper、`ELECTRON_RUN_AS_NODE` 和生成的 shim 都是 Desktop 内部实现。即使它们出现在 declaration 或运行时上下文中，也不属于第三方兼容 contract。

壳与 Host 子进程之间的 IPC 消息（`ready` / `fatal` / `shutdown` / `permission` 等）同样属于内部握手，不是插件接口。

## 测试与发布检查

插件至少应覆盖：

- 在普通 DSH 中没有 Desktop service 时仍能加载，或按产品定义保持 pending。
- Desktop 中读取的 profile name/dir 与用户实际选择一致。
- package operation 的取消、非零退出、spawn failure 和 generation teardown。
- 插件变更后重新启动，bundle 能进入下一次 Loader 组合。
- 有浏览器半边时，页面侧确实看到了变化（Host 半边加载成功不代表客户端半边被纳入 boot graph）。

开发者可以先阅读 [架构说明](architecture.md)，再使用包级 [service contract](../dsh-plugin-desktop-beta/docs/plugin-services.md)。

## 打包时要注意的依赖分类

安装包里的 payload 由桌面壳脚本独立组装，生产闭包 = `dependencies` + 非可选 `peerDependencies` + 已安装的 `optionalDependencies`。**如果本地插件只有类型上需要桌面包，那些依赖必须降为可选 peer，或只留在 `devDependencies`：** 留在 `dependencies` 里会被当成运行时依赖打进安装包，既增加体积，也可能因为版本与安装包内已有版本冲突而让构建失败。另外，workspace 包按 `files` 列表发布，而 `files` 只接受字面名和 `目录/**` 形式，其它 glob 会让构建直接失败。

## 生态愿景：保持插件生态可组合

DSH 的插件生态正在快速增长。插件越多，它们能否协同工作就越重要——如果每个插件都假设或覆盖其他插件的内部实现，装几个插件就会开始冲突，生态会逐渐碎片化。

我们倡导像浏览器插件一样的开发方式：大家在同一个平台上、按同一套约定扩展，而不是各自维护一份改过的运行时。DSH Desktop 是这套方式的第一个实践者——桌面壳本身就是一个普通插件，与官方、第三方插件走同一条组合路径，没有任何特权。

为此我们发起一项开发规范倡议，希望它通过社区的采纳成为事实标准：

- **组合优先**：通过官方 slot、service 和 patch 组合能力，不要假设或覆盖其他插件的内部实现。
- **声明清晰**：明确声明依赖的 service 和 slot，不依赖运行时巧合。
- **兼容优先**：升级保持向后兼容，不破坏已有组合。

倡议是活文档，随生态实践更新，接受社区讨论和修订。插件市场上线后，遵循共同约定的插件将更容易被发现、安装和判断兼容性，让"按规范开发"成为对每个作者都有利的选择。完整愿景见 [DSH 插件生态倡议书](plugin-ecosystem.md)；未来互操作 contract 的讨论见 [DSH Community Fabric](../dsh-community-fabric/README.zh.md)。
