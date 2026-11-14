# Windows NSIS 卸载器 stub 运行失败与规避

## 现象

`corepack yarn workspace nonead-dsh-desktop dist:win` 在 2.2.12、2.2.10 等版本上，均能通过运行时准备、payload 装配、载荷校验与 fuses，随后停在 NSIS 阶段：

```
• building        target=nsis file=dist\Nonead-DSH-Desktop-2.2.12-x64-Setup.exe archs=x64 oneClick=false perMachine=false
⨯ ...\Nonead-DSH-Desktop-2.2.12-x64-Setup.exe  process failed 2
```

退出码固定为 2，`Output:` 为空，安装包本体只有约 0.5 MB（PE 头完整），同目录留下一个 424 MB 的 `nonead-dsh-desktop-2.2.12-x64.nsis.7z` 载荷。用 PowerShell 直接执行该 0.5 MB 文件时，另有「超过 120 秒不返回」的表现。

## electron-builder 的两遍编译

`app-builder-lib` 的 `out/targets/nsis/NsisTarget.js` 中，`computeScriptAndSignUninstaller()` 在**没有自定义 `installer.nsi`** 时会走两遍：

1. 定义 `BUILD_UNINSTALLER` 与 `UNINSTALLER_OUT_FILE`，把 `templates/nsis/installer.nsi` 编译成那个约 558 KB 的 stub。该 stub 的 `.onInit` 只做 `WriteUninstaller` 再 `quitSuccess`，**这就是正常产物，不是坏包**。
2. 执行 stub 让它把卸载器写到 `UNINSTALLER_OUT_FILE`，然后去掉 `BUILD_UNINSTALLER` 重编真正的安装包。

所以「process failed 2」发生在第 2 步：stub 运行失败，卸载器没生成，整条流水线中止。

## 根因

stub 从**它刚被 makensis 写出的那个路径**启动时，自解压需要临时文件而失败，弹出一个标题为 `NSIS Error` 的模态框。用 `EnumChildWindows` + `GetWindowTextW` 读到的正文是：

```
Error writing temporary file. Make sure your temp folder is valid.
```

无人应答的模态框同时解释了两种表现：以子进程方式运行时等待超时后被杀 → 退出码 2；用 `Start-Process -Wait` 时整条命令挂住。

排除项（均已实测）：

- `%TEMP%` 可写，ACL 含当前用户 FullControl，磁盘剩余空间充足；把 `TEMP`/`TMP` 指向全新空目录仍报同一错误。
- 与本机 NSIS 版本无关：同一份脚本文本用 `nsis-bundle-3.12` 自行编译后运行 exit 0 且正常写出卸载器。
- 与脚本内容无关：脚本里 `.onInit` 打点可完整走到 `after-writeuninstaller`；`SetErrorLevel 7` 探针能得到 7，说明执行路径正常。
- 与目录 ACL 无关：`icacls <outDir> /reset` 后行为不变。
- 与目标架构无关：arm64 的 stub 也是 `0x014C`，失败表现一致。

决定性对照：把同一个 stub 文件复制到另一个路径再运行 → **exit 0**，且真的在**编译期烧死的绝对路径**下写出了 `...__uninstaller.exe`（约 438 KB）。即「刚写出的那个文件」不可执行，副本可执行。

## 规避

在 `computeScriptAndSignUninstaller()` 里把 stock 的 `wineVm.exec(installerPath, ...)` 换成：先把 `installerPath` 复制到 `os.tmpdir()/dsh-nsis-stub-*/stub-N.exe`，再 spawn 该副本，轮询 `uninstallerPath` 大小（连续两次 >4096 且稳定即成功，实测 2–4 秒），失败重试 2 次，结束后删除临时目录并 `taskkill` 残留 stub 进程。

补丁只改本机 `node_modules` 下的 `app-builder-lib`，**尚未并入 `patches/app-builder-lib@26.15.7.patch`**：把 hunk 合进该补丁会改变 patch 校验和，需要同时重算 `yarn.lock`，否则其他机器 `yarn install` 会报校验不匹配。后续正式化时应一次性完成「补丁 + 锁文件重算 + 干净环境复验」。

## 复验

规避后同一套 2.2.12 源码产出两份安装包，均通过项目自带 `nonead-dsh-desktop/scripts/verify-win-installer.ts`：

| 目标 | 产物 | 体积 | 说明 |
| --- | --- | --- | --- |
| x64 | `nonead-dsh-desktop/dist-nsis/Nonead-DSH-Desktop-2.2.12-x64-Setup.exe` | 446626721 B | `resources/runtime` 只含 `x64`，`node.exe` PE `0x8664` |
| arm64 | `nonead-dsh-desktop/dist-nsis-arm64/Nonead-DSH-Desktop-2.2.12-arm64-Setup.exe` | 430516669 B | `resources/runtime` 只含 `arm64`，`node.exe` PE `0xAA64` |

两份都没有残留的 `*__uninstaller.exe`（已嵌入安装包），`ProductVersion`/`FileVersion` 为 `2.2.12`，未签名。

## 另一个坑：输出目录必须是相对路径

`DSH_PACKAGE_OUTPUT_DIR` 传绝对路径时，`scripts/verify-win-installer.ts` 会把 `join(desktopRoot, outputDir, file)` 拼成 `nonead-dsh-desktop\D:\...`，触发 `ENOENT ... stat`。该变量应传相对 `nonead-dsh-desktop` 的目录名，例如 `dist-nsis`、`dist-nsis-arm64`。
