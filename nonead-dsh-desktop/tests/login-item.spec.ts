import { expect, it } from 'vitest'
import { readOpenAtLogin, writeOpenAtLogin } from '../src/login-item.ts'

function application(openAtLogin = false) {
  const state = { openAtLogin }
  const calls: { openAtLogin: boolean }[] = []
  return {
    calls,
    state,
    setLoginItemSettings: (settings: { openAtLogin: boolean }) => { calls.push(settings); state.openAtLogin = settings.openAtLogin },
    getLoginItemSettings: () => ({ openAtLogin: state.openAtLogin }),
  }
}

it('reads the effective OS login-item state', () => {
  expect(readOpenAtLogin(application(false))).toBe(false)
  expect(readOpenAtLogin(application(true))).toBe(true)
})

it('reports disabled when the platform cannot answer instead of claiming a startup entry', () => {
  expect(readOpenAtLogin({ getLoginItemSettings: () => { throw new Error('unsupported') }, setLoginItemSettings: () => {} })).toBe(false)
})

it('writes the switch once and returns the state the OS kept', () => {
  const app = application(false)
  expect(writeOpenAtLogin(app, true)).toBe(true)
  expect(app.calls).toEqual([{ openAtLogin: true }])
  expect(app.state.openAtLogin).toBe(true)
  expect(writeOpenAtLogin(app, false)).toBe(false)
  expect(app.calls).toEqual([{ openAtLogin: true }, { openAtLogin: false }])
})
