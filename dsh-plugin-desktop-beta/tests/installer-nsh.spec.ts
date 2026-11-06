import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESKTOP_INSTALLER_QUIT_FLAG } from '../src/desktop-installer-quit.ts'

const source = (): string => readFileSync(join(process.cwd(), 'build', 'dsh-installer-hooks.nsh'), 'utf8')

/** 去掉 `;` 注释，只对真正参与编译的指令断言。 */
const code = (): string => source()
  .split('\n')
  .filter(line => !line.trimStart().startsWith(';'))
  .join('\n')

describe('Windows NSIS running-app handoff', () => {
  it('按进程名探测，不使用需要提升权限的进程路径查询', () => {
    const script = code()
    expect(script).toContain('!macro customCheckAppRunning')
    expect(script).toContain('nsProcess::_FindProcess')
    // 读取进程路径要求 Win32_Process 的权限；普通用户权限的安装器会收到
    // “拒绝访问”，再被误判为“应用没有运行”，从而跳过关闭。
    expect(script).not.toContain('Win32_Process')
    expect(script).not.toContain('Get-CimInstance')
    expect(script).not.toContain('IS_POWERSHELL_AVAILABLE')
  })

  it('先请求旧实例自行退出，且不阻塞等待子进程', () => {
    const script = code()
    const probe = script.indexOf('nsProcess::_FindProcess')
    const request = script.indexOf(DESKTOP_INSTALLER_QUIT_FLAG)

    expect(probe).toBeGreaterThanOrEqual(0)
    expect(request).toBeGreaterThan(probe)
    expect(script).toContain('StrCpy $dshTargetExe "${APP_EXECUTABLE_FILENAME}"')
    expect(script).toContain('$INSTDIR\\$dshTargetExe')
    // ExecWait 会一直等子进程退出；旧版本忽略该参数时会打开新窗口并常驻，
    // 安装器就永久卡住。
    expect(script).not.toContain('ExecWait')
    expect(script).toContain('Exec \'"$INSTDIR\\$dshTargetExe"')
  })

  it('超时后强制结束，仍失败则明确报错而不是继续覆盖被占用的文件', () => {
    const script = code()
    const request = script.indexOf(DESKTOP_INSTALLER_QUIT_FLAG)
    const wait = script.indexOf('dsh_close_wait_graceful:')
    const force = script.indexOf('nsProcess::_KillProcess')
    const retry = script.indexOf('dsh_close_wait_kill:')
    const fail = script.indexOf('$(appCannotBeClosed)')

    expect(wait).toBeGreaterThan(request)
    expect(force).toBeGreaterThan(wait)
    expect(retry).toBeGreaterThan(force)
    expect(fail).toBeGreaterThan(retry)
    expect(script).toContain('Quit')
  })

  it('卸载器构建保持空操作，并为提升安装补一次关停', () => {
    const script = source()

    expect(script).toContain('!ifndef BUILD_UNINSTALLER')
    expect(script).toContain('!macro customInit')
    expect(script).toContain('UAC_IsInnerInstance')
  })
})
