# Nonead DSH Desktop 升级服务接口规格

[English](desktop-release-service.en.md)

面向实现升级服务的服务端团队。客户端行为**已经固定**在 Nonead DSH Desktop 的 Desktop 包内，本文件描述的是客户端**已经强制**的契约：服务端任何偏离都不会报错给用户，而是让更新功能**静默失效**。

> 状态：对应 Desktop `2.0.7` 已实现的客户端行为。机器可读版本见 [desktop-release-service.openapi.yaml](desktop-release-service.openapi.yaml)。判定逻辑的权威来源是 `dsh-plugin-desktop/src/update-checker.ts` 与 `update-download.ts`。

## 1. 端点总览

固定主机 `https://www.nonead.com`（客户端硬编码，无环境变量开关）。

| 端点 | 用途 | 客户端何时调用 |
| --- | --- | --- |
| `GET /software/ndsh-desktop/version` | 版本发现 | 打包版启动后 60 秒一次，此后每 6 小时一次（每轮完成后计时）；用户手动点击托盘的"检查更新" |
| `GET /software/ndsh-desktop/downloads/{mac\|windows\|linux}` | 交付安装包 | **只在**用户在原生确认框中选择了"下载"之后 |

请求超时 15 秒。开发与未打包启动不做任何后台网络请求。

## 2. 版本端点

### 2.1 请求

| 头 | 必须 | 取值 | 说明 |
| --- | --- | --- | --- |
| `Accept` | 是 | `application/json` | — |
| `X-DSH-Desktop-Channel` | 是 | `stable` / `beta` / `next` | 选择发布流 |
| `X-DSH-Desktop-Version` | 是 | 已安装版本，规范 SemVer | 客户端自行保证格式 |
| `X-DSH-Desktop-Installation-Id` | 是（仅此端点） | 小写 UUID v4 | 本地生成的匿名安装标识，用于去重统计；**不用于鉴权**，服务端不得据此拒绝请求 |

客户端固定语义：`cache: no-store`，**`redirect: 'error'`（任何 3xx 都会导致本次检查失败）**。

### 2.2 成功响应

状态必须是 **200**；`Content-Type: application/json`；响应体 **≤ 4096 字节**（UTF-8）。

```json
{ "version": "2.0.7", "channel": "stable", "sha256": { "windows": "…", "mac": "…", "linux": "…" } }
```

| 字段 | 必须 | 规则 |
| --- | --- | --- |
| `version` | 是 | 字符串；**规范** SemVer（无 `v` 前缀、无前导零、`parsed.version === 输入`）；必须匹配请求 channel 的形态，见 2.3 |
| `channel` | `stable` 可省略；`beta`/`next` **必须** | 若出现则必须**等于**请求的 channel |
| `sha256` | 否 | 对象；键**只能**是 `windows` / `mac` / `linux`；值为 64 位十六进制（大小写不敏感，会 trim + 转小写）。非法项**逐项静默忽略** |

### 2.3 channel 与 version 的形态矩阵

| 请求 channel | `version` 必须形如 | 合法例 | 会被拒绝的反例 |
| --- | --- | --- | --- |
| `stable` | `x.y.z`（**不得带预发布标识**） | `2.0.7` | `2.0.7-beta.1` |
| `beta` | `x.y.z-beta.N`（**恰好两段**，第一段 `beta`，第二段纯数字） | `2.0.7-beta.1` | `2.0.7-beta`、`2.0.7-beta.1.2` |
| `next` | `x.y.z-next`（**恰好一段**且等于 `next`） | `2.0.7-next` | `2.0.7-next.1` |

同时 `channel` 字段的校验规则是：`stable` 分支不要求该字段；`beta`/`next` 分支**要求其存在且等于请求值**，否则整份响应被丢弃。

### 2.4 失败语义（客户端如何反应）

| 服务端实际返回 | 自动检查 | 手动检查 |
| --- | --- | --- |
| 200 + 版本 > 已安装 | 弹原生"下载/稍后"提示（每个版本每次跨重启只提示一次） | 同左 |
| 200 + 版本 ≤ 已安装 | **静默** | 弹"已是最新"对话框 |
| 任何 3xx、非 200、超时、网络失败 | **静默** | 固定"重试"对话框，不显示细节 |
| 响应体 > 4096 字节、JSON 非法、`version` 非字符串、版本形态不符、`channel` 不符 | **静默** | 固定"重试"对话框 |

**关键后果：客户端没有任何上报通道。** 配置写错不会产生任何服务端可见的错误——只会让全部用户悄悄收不到更新。第 7 节的可观测性是**必需项**，不是可选优化。

### 2.5 明确禁止

- **任何 3xx**：包括 `UseHttpsRedirection`、末尾斜杠规范化、`RedirectToAction`、CDN/网关的路径规范化跳转。
- 把 `sha256` 键写成 `win32` / `darwin`：这些键会被忽略，你会以为有完整性闸门，实际没有。正确键名是 `windows` / `mac` / `linux`。
- 返回带 `v` 前缀或前导零的版本（`v2.0.7`、`02.0.7`）。
- 返回 `2.0.7-next.1` 这类 `next` 版本。
- 让 CDN 缓存该响应；建议 `Cache-Control: no-store`。

## 3. 下载端点

### 3.1 请求

| 头 | 必须 | 取值 |
| --- | --- | --- |
| `X-DSH-Desktop-Channel` | 是 | `stable` / `beta` / `next` |
| `X-DSH-Desktop-Target-Version` | 是 | 用户在界面上确认下载的版本（即 `/version` 刚返回的值） |

客户端 `redirect: 'follow'`：**允许且鼓励**用 302 跳到对象存储 / CDN——这一跳正是"一次用户确认的下载"的记账点。

### 3.2 响应

- 跟随重定向后的**最终响应必须是 200**，且必须有响应体。
- 落点 URL 必须是 `https`，**不得**包含用户名/密码，端口必须为空或 443（`https://cdn.example.com:8443/…` 会被拒绝）。
- 体积：`Content-Length` 若存在，必须是纯十进制（`^(0|[1-9][0-9]*)$`）且 ≤ **1 GiB**；无论是否声明，实际字节数都不得超过 1 GiB。
- 不需要支持 Range（客户端单次 GET）；`Content-Disposition` 与文件名**无关**（文件名由客户端自选并展示给用户）。
- 若同一 channel 的 `/version` 发布了该平台的 `sha256`，客户端会**流式计算 SHA-256 并常量时间比对**；不匹配即拒绝执行安装器。因此**发布摘要后不可再替换产物**。

### 3.3 产物必须通过魔数校验

| 平台 | 校验 |
| --- | --- |
| `mac` | 末 512 字节起必须是 `koly`（真正的 UDIF `.dmg`） |
| `windows` | 偏移 0 为 `MZ`，且 `e_lfanew`（偏移 `0x3C` 的 LE uint32）处为 `PE\0\0` |
| `linux` | 偏移 0 为 `\x7fELF`，**且偏移 8 为 `AI\x02`**（真正的 AppImage） |

`.zip`、`.deb`、`.tar.gz`、裸 ELF 可执行文件、以及任何 HTML 错误页都会被判为无效产物。

### 3.4 失败语义

无效产物或非 200 会让用户看到原生错误信息（"下载的文件不是 UDIF 磁盘映像 / 不是 PE 可执行文件 / 不是 AppImage"），并保持可重试；升级流程不会继续。下载失败不产生后台上报。

## 4. 服务端数据模型

按 channel 分组存一份发布文档（KV / Redis / 数据库均可），一次写入即完成切换：

```json
{
  "stable": {
    "version": "2.0.7",
    "sha256": { "windows": "<64hex>", "mac": "<64hex>", "linux": "<64hex>" },
    "installers": {
      "windows": "/software/ndsh-desktop/downloads/windows/Nonead-DSH-Desktop-2.0.7-x64-Setup.exe",
      "mac":     "/software/ndsh-desktop/downloads/mac/Nonead-DSH-Desktop-2.0.7-mac.dmg",
      "linux":   "/software/ndsh-desktop/downloads/linux/Nonead-DSH-Desktop-2.0.7-linux.AppImage"
    }
  },
  "beta": { "…": "同上结构" },
  "next": { "…": "同上结构" }
}
```

`sha256` 与 `installers` 使用**同一组平台段**（`mac` / `windows` / `linux`），与下载端点的路径段一致，因此服务端不需要任何键名转换。`installers` 的取值可以是 `https://` 开头的绝对地址（指向 CDN 或对象存储），也可以是以 `/` 开头的**同源绝对路径**——后者会在客户端的 https 请求下解析为 https，同样满足"落点必须是 https"的要求。产物放在**含版本号的不可变路径**上，回滚时只需改文档。

### 4.1 参考实现（nonead.com 服务端）

`nonead.com` 仓库中的实现已经落地：

| 项 | 位置 / 行为 |
| --- | --- |
| 发布文档 | `wwwroot/software/ndsh-desktop/releases.json`，每次请求实时读取，**替换后无需重启** |
| 文档模板 | `wwwroot/software/ndsh-desktop/releases.json.example`，填好真实值后重命名为 `releases.json` 即生效 |
| 迁移期回退 | `releases.json` 不存在时回退到旧的单文件 `wwwroot/software/ndsh-desktop/version`（只描述 `stable`，按原文返回）；此时三个 `/downloads/*` 一律 `404` |
| 端点 | `Program.cs` 中的 `GET /software/ndsh-desktop/version` 与 `GET /software/ndsh-desktop/downloads/{platform}` |
| 解析与校验 | `Services/NdsDesktopReleaseService.cs` |

状态码与日志如下。客户端一律按 §2.4 处理这些响应；区分的目的是让**服务端日志与探活**能发现问题（客户端的失败是静默的）。

| 情况 | 状态码 | 日志 |
| --- | --- | --- |
| 正常 | `200` | 文档里有被忽略的字段时记 Warning |
| 未知 channel | `400` | Warning |
| 该 channel 尚未发布 | `404` | Warning |
| 版本形态、`sha256` 或响应体体积违规 | `503` | **Error** |
| 下载：目标版本与当前发布不一致 | `409` | Warning |
| 下载：未配置该平台地址 | `404` | Warning |
| 下载：正常跳转 | `302` | Information（记账） |

`X-DSH-Desktop-Target-Version` 守卫的用意：客户端在下载前会重新校验版本，正常情况下该头必然等于当前发布版本；不一致说明发布刚被轮换，此时宁可让它失败并留下日志，也不要下发与检查结果不符的安装包。

## 5. 发布顺序（不变量）

1. 构建产物（Windows `.exe`、macOS `.dmg`、Linux `.AppImage`）。
2. 计算每个产物的 SHA-256。
3. 上传到不可变路径，并**直接**校验这些地址可访问、魔数正确、摘要与计算结果一致——此时尚未对客户端生效。
4. **写入发布文档**（`version` + `sha256` + `installers`）。这是唯一的"对外生效"动作：一次写入即原子完成"版本宣告 + 安装包指向"，不存在"已宣告新版本却仍在发旧安装包"的中间状态。
5. 按三个 channel 验收 `/version` 与三个下载端点（用第 9 节的脚本）。

**顺序颠倒的后果**：先宣告 `2.0.7` 再换安装包，会让 `/downloads/windows` 继续发 `2.0.4` → 用户下到错版本；若同时已发布 `sha256`，还会被硬闸门拒绝并报"与已发布的摘要不匹配"，极难排查。

**回滚**：把发布文档改回上一版本即可（产物不动，旧版本仍可下载），然后重跑第 5 步。

## 6. 缓存与 CDN

| 对象 | 建议 |
| --- | --- |
| `/version` | `Cache-Control: no-store`（否则发布与回滚都会滞后） |
| `/downloads/*` 的 **302 响应本身** | `Cache-Control: no-store`（跳转被缓存会让回滚滞后；当前客户端每次请求都带 `X-DSH-Desktop-Target-Version`，跳转目标本可随版本变化） |
| 产物文件 | 可长缓存（不可变路径） |

## 7. 可观测性（必需）

因为客户端静默失败，服务端必须自己发现"契约被破坏"：

- **主动探活**：每 5 分钟按三个 channel 各请求一次 `/version`，按第 2.3、2.4 节的规则校验，失败即告警。
- **下载可用性探活**：每小时对三个平台各发一次 `HEAD`/范围请求，校验状态码、落点 https 与魔数（只取首尾少量字节，不要真下 250 MB）。
- **对账**：比较版本文档中的 `sha256` 与产物实际摘要；不一致立即告警（这等价于"用户会下载失败"）。
- **计数**：`/downloads/*` 的记录就是"一次用户确认的下载"，按 `channel` / 平台 / `target-version` 维度统计。
- **容量**：默认节奏为每安装每 6 小时一次（外加启动后 60 秒一次与正负抖动），据此估算 `/version` 的 QPS 与 `Installation-Id` 去重数。

## 8. ASP.NET Core 实现要点

1. **不要让该路由经过会重定向的中间件**：`UseHttpsRedirection`、末尾斜杠规范化、`UseStatusCodePages` 的跳转、错误页跳转都会破坏 `redirect: 'error'`。
2. 用最小 API 或 Controller 固定路由，返回 `Results.File(json, "application/json")` 或 `Json()`，确保状态码就是 200。
3. **不要加 `[Authorize]`**：客户端不携带任何凭据（也不携带 Cookie）。
4. 该端点**不得**依赖 Session/Cookie；可以设置，但客户端不会回传。
5. **必须按 `X-DSH-Desktop-Channel` 真正分流**——把通道忽略、三个通道返回同一份文档是最容易犯且最难发现的错误（见第 9 节当前生产实测）。
6. **兜底页不得返回 200**：现在三个 `/downloads/*` 都落到了站点的 HTML 兜底页（HTTP 200 + `text/html`），客户端会报"不是有效安装包"。未实现的路径应返回 404/503，而不是 200 的 HTML。
7. 响应体要留余量：不要往 JSON 里塞额外大字段（上限 4096 字节）。
8. 对外端口固定 443；跳转目标不要带非 443 端口。

## 9. 验收

服务端改完必须自检——客户端不会报告任何问题。

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE=https://www.nonead.com/software/ndsh-desktop

check_version() { # $1=channel  $2=期望 version 正则
  body=$(curl -sS --max-time 20 -H "Accept: application/json" \
              -H "X-DSH-Desktop-Channel: $1" -H "X-DSH-Desktop-Version: 0.0.0" "$BASE/version")
  [ "$(printf %s "$body" | wc -c)" -le 4096 ] || { echo "$1: 响应超过 4 KiB"; exit 1; }
  printf %s "$body" | grep -Eq "\"version\":\"$2\"" || { echo "$1: 版本不符 -> $body"; exit 1; }
  if [ "$1" != stable ]; then
    printf %s "$body" | grep -Eq "\"channel\":\"$1\"" || { echo "$1: 缺少 channel 字段 -> $body"; exit 1; }
  fi
  echo "$1 OK  $body"
}

check_version stable '2\.0\.3'
check_version beta   '2\.0\.3-beta\.[0-9]+'
check_version next   '2\.0\.3-next'

for p in mac windows linux; do
  out=$(curl -sS -o /tmp/dsh-artifact -w '%{http_code} %{url_effective}' -L --max-time 300 \
        -H "X-DSH-Desktop-Channel: stable" "$BASE/downloads/$p")
  case "$out" in *https://*) ;; *) echo "$p: 落点不是 https -> $out"; exit 1;; esac
  case "$p" in
    mac)     [ "$(tail -c 512 /tmp/dsh-artifact | head -c 4)" = koly ] || { echo "mac: 不是 UDIF"; exit 1;};;
    windows) [ "$(head -c 2 /tmp/dsh-artifact)" = MZ ] || { echo "windows: 不是 PE"; exit 1;};;
    linux)   [ "$(head -c 4 /tmp/dsh-artifact | od -An -tx1 | tr -d ' \n')" = 7f454c46 ] || { echo "linux: 不是 ELF"; exit 1;};;
  esac
  echo "$p OK  $out  $(wc -c < /tmp/dsh-artifact) bytes"
done
```

**当前生产环境实测（2026-10-07，供基线对照）**：

| 检查 | 实测结果 | 判定 |
| --- | --- | --- |
| `stable` | `{"version":"2.0.4","channel":"stable"}` | 版本停留在 2.0.4 |
| `beta` | `{"version":"2.0.4","channel":"stable"}` | ❌ `channel` 不等于 `beta`，客户端丢弃整份响应 |
| `next` | `{"version":"2.0.4","channel":"stable"}` | ❌ 同上 |
| `/downloads/mac` | 200 + `text/html`，128430 字节，尾部 `sch` | ❌ 站点的 HTML 兜底页 |
| `/downloads/windows` | 同上（同一 ETag） | ❌ |
| `/downloads/linux` | 同上（同一 ETag） | ❌ |

即：三个 channel 的版本头被忽略；三个下载端点尚未实现，应用内下载在三个平台都无法成功。

## 10. 参考文献

- 版本检查与 SemVer 规则：`dsh-plugin-desktop/src/update-checker.ts`
- 下载、体积与魔数校验、摘要闸门：`dsh-plugin-desktop/src/update-download.ts`
- 安装标识：`dsh-plugin-desktop/src/desktop-installation-id.ts`
- 架构决策与发布顺序的原始记录：`.agents/notes/implemented/architecture/2026-08-15-desktop-release-discovery-and-terminal.md`
