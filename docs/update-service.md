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
| `X-Nonead-DSH-Desktop-Version` | 当前安装的版本，例如 `1.5.3` |
| `X-Nonead-DSH-Desktop-Channel` | `stable` 或 `beta` |
| `X-Nonead-DSH-Desktop-Installation-Id` | 本机安装标识（UUID），同一次安装内稳定 |
| `Accept` | `application/json` |

期望响应：状态码 `200`、`application/json`，正文不超过 4096 字节。

```json
{ "version": "1.5.3", "channel": "stable" }
```

正文规则：

- `version` 必须是规范 SemVer，不能带 `v` 前缀：写成 `"v1.5.3"` 会被判为非法。
- `stable` 通道的版本不能带预发布段；`beta` 通道的版本必须是 `X.Y.Z-beta.N`。
- `beta` 通道的响应必须额外带 `"channel": "beta"`。
- 响应必须是 `200`。非 200、重定向或无法解析的正文都会被客户端当作“没有更新”，并保持静默，不会向用户报错。
- 某个通道暂时没有新版本时不要返回错误页：返回非 `200`（例如 `404`）即可，客户端会安静跳过。

## 下载安装包

| 项目 | 值 |
| --- | --- |
| 方法 | `GET` |
| Windows 地址 | `https://www.nonead.com/software/ndsh-desktop/downloads/windows` |
| macOS 地址 | `https://www.nonead.com/software/ndsh-desktop/downloads/mac` |
| 重定向 | 允许；客户端跟随重定向 |
| 大小上限 | 1 GiB |

请求头：`X-Nonead-DSH-Desktop-Target-Version` 给出目标版本，`X-Nonead-DSH-Desktop-Channel` 给出通道。

**这两条地址必须直接返回安装包字节，或 302 到真正的文件。** 已发布版本把路径写死在代码里，客户端不会去解析目录列表，也不接受 HTML 页面：任何 `200` 加 `text/html` 的响应都会被判定为 `invalid-artifact`（“下载到的文件不是 PE 可执行文件”），下载被静默放弃，用户只看到“选完保存位置后什么也没发生”。

客户端对安装包的校验规则：

- Windows：前 64 字节必须以 `MZ`（`4d 5a`）开头，并且 PE 头处出现 `PE\0\0`。
- macOS：末尾 512 字节处必须出现 `koly`，即 DMG 尾部标记。
- 文件大小必须在 1 MiB 与 1 GiB 之间。

建议同时返回 `Content-Length`。保存文件名由客户端生成（`Nonead-DSH-Desktop-<版本>-windows.exe`、`Nonead-DSH-Desktop-<版本>-mac.dmg`，beta 通道前缀为 `Nonead-DSH-Desktop-Beta-`），服务端的 `Content-Disposition` 不影响保存位置。

## 版本号与文件名

服务端的安装包文件名带版本号（例如 `nonead-dsh-desktop-1.5.3-windows.exe`），**每发布一个版本就会变**。裸地址本身刻意不带版本号：客户端在下载请求里用 `X-Nonead-DSH-Desktop-Target-Version` 告诉服务端它要哪个版本，服务端必须在当次请求中按这个请求头解析出对应文件。

- **不要把 302 目标写死成某一个版本的文件。** 一旦写死，下一个版本的用户请求 `1.5.4` 时拿到的还是 `1.5.3` 的旧安装包。
- **客户端不会校验下载到的安装包属于哪个版本**：它只校验 PE / DMG 格式和大小。因此“服务端返回了错误版本”在客户端完全不可见，用户只会看到“更新跑完了，版本没变”。这一条只能靠服务端和发版流程保证，所以 `scripts/check-update-service.mjs` 会把重定向目标文件名里的版本号与服务端报告的版本号做交叉校验。
- 每次发版要同时更新三处：上传的文件、裸地址的“版本 → 文件”映射、版本端点报告的版本号。三者不一致时脚本会报出来。
- 请求的目标版本无法提供时返回 `404`，不要回落到最新版或站点首页。
- 旧版本的安装包建议保留一段时间，避免正在升级的用户请求的版本被撤下。

文件名里的版本号只影响观感与排错：客户端保存到本地的默认文件名同样带版本号，但它由客户端自己生成，与服务端文件名无关。

## 发版检查清单

1. 上传安装包，确认带版本号的文件地址可以下载。
2. 让裸地址按请求头里的目标版本解析到该文件：`200` 直接返回字节，或 302 重定向过去；不要写死目标版本。
3. 更新版本端点，使其报告新版本号，并确认它指向的文件与第 2 步是同一版本。
4. 运行 `yarn check:update-service`，确认检查全部通过；它会把重定向目标文件名里的版本号与服务端报告的版本号做交叉校验。
5. 发布后至少手工验证一条真实升级链路：旧版本 → 检查更新 → 下载 → 校验 → 交接安装，并确认装完后的版本号确实是新版本。

## 检查脚本

`scripts/check-update-service.mjs` 直接复用客户端编译产物（`dsh-plugin-desktop/lib/update-checker.js` 与 `lib/update-download.js`）来解析响应、比较版本并校验安装包，所以脚本通过意味着已发布的客户端会接受同一份响应。它只读服务端，不会上传或修改任何东西。

```bash
yarn check:update-service
yarn check:update-service --full
yarn check:update-service --expect 1.5.4
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
