# 更新服务

[English](update-service.en.md)

Desktop 客户端会在启动后、以及此后按固定间隔检查是否有新版本；用户确认后，客户端把安装包下载到本地，校验通过才交给系统安装。这一章说明客户端与服务端之间**已经固定下来**的契约：服务端必须提供什么、客户端会拒绝什么，以及每次发版要做的检查。

这些地址和请求头都写死在已发布版本的代码里，客户端不提供任何配置项去改变它们。服务端只能适配现有契约，升级客户端不会让旧契约消失。`scripts/check-update-service.mjs` 会用客户端自己的编译产物逐条验证下面每一项。

## 检查更新

| 项目 | 值 |
| --- | --- |
| 方法 | `GET` |
| 地址 | `https://www.nonead.com/software/ndsh-desktop/version` |
| 重定向 | 不允许；客户端以 `redirect: "error"` 请求 |
| 缓存 | 不允许；客户端以 `cache: "no-store"` 请求 |
| 超时 | 15 秒 |

请求头：

| 请求头 | 含义 |
| --- | --- |
| `X-Nonead-DSH-Desktop-Version` | 当前安装的版本，例如 `1.7.3` |
| `X-Nonead-DSH-Desktop-Channel` | `stable` 或 `beta` |
| `X-Nonead-DSH-Desktop-Installation-Id` | 本机安装标识（UUID），同一次安装内稳定 |
| `Accept` | `application/json` |

期望响应：状态码 `200`、`application/json`，正文不超过 4096 字节。

```json
{ "version": "1.7.3", "channel": "stable" }
```

正文规则：

- `version` 必须是规范 SemVer，不能带 `v` 前缀：写成 `"v1.7.3"` 会被判为非法。
- `stable` 通道的版本不能带预发布段；`beta` 通道的版本必须是 `X.Y.Z-beta.N`。
- `beta` 通道的响应必须额外带 `"channel": "beta"`。
- 响应必须是 `200`。非 200、重定向或无法解析的正文都会被客户端当作“没有更新”，并保持静默，不会向用户报错。
- 某个通道暂时没有新版本时不要返回错误页：返回非 `200`（例如 `404`）即可，客户端会安静跳过。

## 下载安装包

| 项目 | 值 |
| --- | --- |
| 方法 | `GET` |
| Windows 地址 | `https://www.nonead.com/software/ndsh-desktop/downloads/windows/Nonead-DSH-Desktop-<版本>-windows.exe` |
| macOS 地址 | `https://www.nonead.com/software/ndsh-desktop/downloads/mac/Nonead-DSH-Desktop-<版本>-mac.dmg` |
| 旧版裸地址 | `…/downloads/windows`、`…/downloads/mac`（本次改动之前发布的客户端仍只请求这两条，必须继续可用） |
| 重定向 | 允许；客户端跟随重定向 |
| 大小上限 | 1 GiB |

请求头：`X-Nonead-DSH-Desktop-Target-Version` 给出目标版本，`X-Nonead-DSH-Desktop-Channel` 给出通道。

请求路径里的文件名由客户端按下述规则拼出，版本号取自版本端点报告的版本：

- 稳定通道：`Nonead-DSH-Desktop-<版本>-windows.exe`、`Nonead-DSH-Desktop-<版本>-mac.dmg`。
- Beta 通道：`Nonead-DSH-Desktop-Beta-<版本>-windows.exe`、`Nonead-DSH-Desktop-Beta-<版本>-mac.dmg`。
- 平台目录来自固定前缀 `…/software/ndsh-desktop/downloads/windows` 与 `…/software/ndsh-desktop/downloads/mac`。

**版本化地址必须直接返回安装包字节，或 302 到真正的文件；旧版裸地址同样必须可用。** 客户端不解析目录列表，也不接受 HTML 页面：任何 `200` 加 `text/html` 的响应都会被判定为 `invalid-artifact`（“下载到的文件不是 PE 可执行文件”）。

下载过程与失败行为：

- 客户端先把安装包写进目标目录下的隐藏临时文件（`.<文件名>.<进程号>.<随机值>.partial`），全部写完并校验通过后才重命名为用户选择的 `.exe` / `.dmg`。用户拿到的最终文件一定来自一次完整的下载。
- 传输中断、长时间没有新数据（默认 120 秒）、超过 1 GiB、校验失败或被取消时，客户端会删除临时文件、不改动已存在的同名安装包，并弹出“更新失败”对话框说明原因，提示重新选择保存位置再试。失败不再是静默的。
- 进程被强杀（任务管理器、断电、崩溃）时来不及清理的临时文件，会在下一次下载同一文件名时自动删除；所以下载失败后目录里可能短暂出现一个 `.partial`，但会自愈。仍然不要把 `.partial` 分发给用户。

客户端对安装包的校验规则：

- Windows：前 64 字节必须以 `MZ`（`4d 5a`）开头，并且 PE 头处出现 `PE\0\0`。
- macOS：末尾 512 字节处必须出现 `koly`，即 DMG 尾部标记。
- 文件大小必须在 1 MiB 与 1 GiB 之间。
- **最终地址（跟随重定向后）的文件名里如果带版本号，该版本号必须等于客户端请求的版本号**。因此“302 落到别的版本”会被客户端直接拒绝，而不是等用户装完才发现版本没变。

建议同时返回 `Content-Length`。请求路径里的文件名与客户端保存用的默认文件名是同一套规则（beta 通道前缀为 `Nonead-DSH-Desktop-Beta-`），服务端的 `Content-Disposition` 不影响保存位置。

### 客户端不做的校验（已知限制）

更新服务目前**不提供内容哈希或签名**，所以客户端**无法验证安装包内容是否与发布产物一致**：

- 客户端不比对 `sha256`、不校验代码签名、也不校验 Apple 公证状态 —— 它只有上面的格式、大小与版本一致性四项检查。
- 因此，一个在正确地址上被替换、但与发布产物不同的文件，只要仍是合法 PE / DMG 且文件名版本号正确，客户端就会接受并交给系统安装。这类篡改只能由 CDN / 源站完整性、HTTPS 与发布流程来防。
- 若日后服务端能提供 `Content-Digest` 响应头或同时提供一份 sidecar 哈希文件，客户端即可在此处补上内容校验；在此之前请勿假设客户端会做内容比对。

## 版本号与文件名

服务端的安装包文件名带版本号（例如 `nonead-dsh-desktop-1.7.3-windows.exe`），**每发布一个版本就会变**。客户端把版本号同时写进请求路径与 `X-Nonead-DSH-Desktop-Target-Version` 请求头，服务端可以按路径里的文件名取文件，也可以只按请求头解析，但两条信息必须指向同一个版本。

- **不要把 302 目标写死成某一个版本的文件。** 一旦写死，下一个版本的用户请求 `1.7.3` 时拿到的还是 `1.5.4` 的旧安装包。
- **客户端会拒绝落到别的版本的安装包**：最终地址文件名里的版本号必须等于请求版本，否则下载被拒绝并报错。但文件名不带版本号时客户端无法判断，所以“服务端返回了错误版本”仍可能不可见，用户只会看到“更新跑完了，版本没变”。`scripts/check-update-service.mjs` 同样会把重定向目标文件名里的版本号与服务端报告的版本号做交叉校验。
- 每次发版要同时更新三处：上传的文件、裸地址的“版本 → 文件”映射、版本端点报告的版本号。三者不一致时脚本会报出来。
- 请求的目标版本无法提供时返回 `404`，不要回落到最新版或站点首页。
- 旧版本的安装包建议保留一段时间，避免正在升级的用户请求的版本被撤下。

客户端用版本端点返回的版本号构造这段文件名，所以版本端点、上传的文件与 302 目标三者必须同版本；对不上时表现为 `404`，而不是静默装错版本。

## 发版检查清单

1. 上传安装包并按客户端约定的名字改名：构建产物是 `dsh-plugin-desktop/dist/Nonead-DSH-Desktop-v<版本>-x64-Setup.exe`，服务端应存为 `Nonead-DSH-Desktop-<版本>-windows.exe`（macOS 对应 `Nonead-DSH-Desktop-<版本>-mac.dmg`），再确认 `…/downloads/windows/Nonead-DSH-Desktop-<版本>-windows.exe` 可以下载。
2. 让裸地址也能按请求头里的目标版本解析到该文件：`200` 直接返回字节，或 302 重定向过去；不要写死目标版本。本次改动之前发布的客户端只会请求裸地址。
3. 更新版本端点，使其报告新版本号，并确认它指向的文件与第 2 步是同一版本。
4. 运行 `yarn check:update-service`，确认检查全部通过；它会把最终文件名里的版本号与服务端报告的版本号做交叉校验，并提示旧版裸地址是否仍可用。
5. 发布后至少手工验证一条真实升级链路：旧版本 → 检查更新 → 下载 → 校验 → 交接安装，并确认装完后的版本号确实是新版本。

## 检查脚本

`scripts/check-update-service.mjs` 直接复用客户端编译产物（`dsh-plugin-desktop/lib/update-checker.js` 与 `lib/update-download.js`）来解析响应、比较版本并校验安装包，所以脚本通过意味着已发布的客户端会接受同一份响应。它只读服务端，不会上传或修改任何东西。

```bash
yarn check:update-service
yarn check:update-service --full
yarn check:update-service --expect 1.7.3
yarn check:update-service --base http://127.0.0.1:8080
```

| 选项 | 说明 |
| --- | --- |
| `--base <origin>` | 服务地址，默认 `https://www.nonead.com` |
| `--channel <name>` | `stable`（默认）或 `beta` |
| `--current <version>` | 参与比较的已安装版本，默认取当前包版本 |
| `--expect <version>` | 要求服务端报告的版本正好是该值 |
| `--full` | 额外用客户端实现完整下载并校验安装包（约 140 MB/平台），并打印每个安装包的字节数与 sha256 |
| `-h`, `--help` | 显示用法 |

脚本按顺序检查：版本端点原始响应、客户端解析与版本比较、Windows 安装包地址、macOS 安装包地址（两条下载地址都会把重定向目标文件名里的版本号与服务端报告的版本号做交叉校验），加上 `--full` 时的端到端下载。失败项会附带修复提示。退出码 `0` 表示全部通过，`1` 表示存在未通过的检查，`2` 表示用法错误或客户端产物缺失（需要先构建 `dsh-plugin-desktop`）。
