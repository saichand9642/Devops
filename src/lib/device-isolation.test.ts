import { beforeEach, describe, expect, it, vi } from 'vitest'
import { progressKey, createEmptyState, loadState, saveState, type ProgressState } from './storage'
import { SESSION_KEY } from './access'
import { signInForTest } from '../test/session'
import { isInstalled, isIos, storageMayBeEvicted } from './install-state'

/**
 * The device model, pinned down.
 *
 * Progress is deliberately per-device: it must survive everything that happens
 * on the device it was made on, and must never appear on another one. The
 * email gate picks WHICH record on this device is in use (see
 * multi-user.test.ts) and changes nothing here - there is still no server, so
 * these properties come entirely from using localStorage and from nothing in
 * the app syncing it anywhere. These tests
 * exist so that stays true - a future sync feature, or a stray fetch, breaks
 * them loudly rather than quietly leaking one learner's progress to another.
 */

const populated = (): ProgressState => {
  const state = createEmptyState(1000)
  state.topics['pods'] = { status: 'completed', completedAt: 2000, lastVisitedAt: 2000 }
  state.questions['fnd-q01'] = {
    lastCorrect: true,
    attempts: 3,
    correctCount: 2,
    incorrectCount: 1,
    lastAnsweredAt: 2500,
  }
  state.interview['itv-docker-1'] = { status: 'known', updatedAt: 3000 }
  state.exams = [{ id: 'x1', courseId: 'ckad', submittedAt: 4000, scorePercent: 72 } as never]
  state.studyDays = ['2026-09-15', '2026-09-16']
  return state
}

describe('progress stays on the device that made it', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInForTest()
  })

  it('survives reloading the page', () => {
    saveState(populated())

    // A reload is a fresh read of the same storage - nothing in memory carries over.
    const afterReload = loadState()

    expect(afterReload.topics['pods'].status).toBe('completed')
    expect(afterReload.questions['fnd-q01'].attempts).toBe(3)
    expect(afterReload.interview['itv-docker-1'].status).toBe('known')
    expect(afterReload.exams).toHaveLength(1)
    expect(afterReload.studyDays).toEqual(['2026-09-15', '2026-09-16'])
  })

  it('survives repeated saves and loads, as a study session would produce', () => {
    const state = populated()
    for (let i = 0; i < 25; i += 1) {
      state.interview[`itv-generated-${i}`] = { status: 'known', updatedAt: 5000 + i }
      expect(saveState(state)).toBe(true)
      expect(Object.keys(loadState().interview)).toHaveLength(i + 2)
    }
  })

  it('writes progress only under its own key, so nothing else can pick it up', () => {
    saveState(populated())

    // The sign-in record and this learner's progress, and nothing else.
    const keys = Object.keys(window.localStorage).sort()
    expect(keys).toEqual([SESSION_KEY, progressKey()].sort())
  })

  it('a different device - separate storage - starts completely fresh', () => {
    saveState(populated())
    expect(loadState().interview['itv-docker-1']).toBeDefined()

    // A second device has its own empty localStorage. Nothing is shared: no
    // server and no cookie, so there is nothing to carry across - signing in
    // with the same address there starts from scratch.
    window.localStorage.clear()
    signInForTest()

    const otherDevice = loadState()
    expect(otherDevice.topics).toEqual({})
    expect(otherDevice.questions).toEqual({})
    expect(otherDevice.interview).toEqual({})
    expect(otherDevice.exams).toEqual([])
    expect(otherDevice.studyDays).toEqual([])
  })

  it('makes no network request when saving or loading progress', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never)

    saveState(populated())
    loadState()

    // Nothing leaves the device. If a sync feature is ever added, this fails
    // and forces a deliberate decision rather than a silent change.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('keeps progress when storage writes fail, rather than wiping what is there', () => {
    saveState(populated())

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    // A failed write reports failure and leaves the stored record untouched.
    expect(saveState(createEmptyState())).toBe(false)
    setItem.mockRestore()

    expect(loadState().interview['itv-docker-1'].status).toBe('known')
  })
})

describe('storage eviction warning applies only where the risk is real', () => {
  // jsdom's navigator has no maxTouchPoints to spy on, so define both directly.
  const setAgent = (userAgent: string, maxTouchPoints = 0) => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: userAgent,
      configurable: true,
    })
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: maxTouchPoints,
      configurable: true,
    })
  }

  const setDisplayMode = (standalone: boolean) => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: standalone && query === '(display-mode: standalone)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
  }

  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
  const ANDROID =
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
  const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
  const IPAD_DESKTOP_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'

  it('warns on an iPhone in a Safari tab, where iOS clears storage after ~7 days', () => {
    setAgent(IPHONE)
    setDisplayMode(false)

    expect(isIos()).toBe(true)
    expect(isInstalled()).toBe(false)
    expect(storageMayBeEvicted()).toBe(true)
  })

  it('does not warn once the app is installed to the Home Screen', () => {
    setAgent(IPHONE)
    setDisplayMode(true)

    expect(isInstalled()).toBe(true)
    expect(storageMayBeEvicted()).toBe(false)
  })

  it('detects iPadOS even though it reports a desktop user agent', () => {
    setAgent(IPAD_DESKTOP_UA, 5)
    setDisplayMode(false)

    expect(isIos()).toBe(true)
    expect(storageMayBeEvicted()).toBe(true)
  })

  it('does not mistake a real Mac for an iPad', () => {
    setAgent(IPAD_DESKTOP_UA, 0)
    setDisplayMode(false)

    expect(isIos()).toBe(false)
    expect(storageMayBeEvicted()).toBe(false)
  })

  it('does not warn on Android or desktop, where storage is not time-limited', () => {
    setDisplayMode(false)

    setAgent(ANDROID)
    expect(storageMayBeEvicted()).toBe(false)

    setAgent(DESKTOP)
    expect(storageMayBeEvicted()).toBe(false)
  })
})
