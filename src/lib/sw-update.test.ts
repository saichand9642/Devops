import { describe, expect, it, vi } from 'vitest'
import { UPDATE_CHECK_INTERVAL_MS, startUpdatePolling, updateStatus } from './sw-update'

describe('updateStatus', () => {
  it('prioritises an available update over the offline-ready notice', () => {
    expect(updateStatus(true, true)).toBe('update-available')
    expect(updateStatus(true, false)).toBe('update-available')
  })

  it('reports offline readiness when there is no update', () => {
    expect(updateStatus(false, true)).toBe('offline-ready')
  })

  it('reports nothing when neither applies', () => {
    expect(updateStatus(false, false)).toBe('idle')
  })
})

describe('startUpdatePolling', () => {
  const harness = () => {
    const update = vi.fn().mockResolvedValue(undefined)
    let intervalHandler: (() => void) | undefined
    let visibilityHandler: (() => void) | undefined
    const clearInterval = vi.fn()
    const removeVisibility = vi.fn()
    return {
      update,
      clearInterval,
      removeVisibility,
      fireInterval: () => intervalHandler?.(),
      fireVisibility: () => visibilityHandler?.(),
      options: (overrides: Partial<Parameters<typeof startUpdatePolling>[0]> = {}) => ({
        registration: { update },
        setInterval: (handler: () => void) => {
          intervalHandler = handler
          return 1
        },
        clearInterval,
        addVisibilityListener: (handler: () => void) => {
          visibilityHandler = handler
          return removeVisibility
        },
        isVisible: () => true,
        isOnline: () => true,
        ...overrides,
      }),
    }
  }

  it('checks immediately when polling starts', () => {
    const h = harness()
    startUpdatePolling(h.options())
    h.fireInterval()
    expect(h.update).toHaveBeenCalled()
  })

  it('checks again on the interval', () => {
    const h = harness()
    startUpdatePolling(h.options())
    const before = h.update.mock.calls.length
    h.fireInterval()
    h.fireInterval()
    expect(h.update.mock.calls.length).toBe(before + 2)
  })

  it('checks when the tab becomes visible again', () => {
    const h = harness()
    startUpdatePolling(h.options())
    const before = h.update.mock.calls.length
    h.fireVisibility()
    expect(h.update.mock.calls.length).toBe(before + 1)
  })

  it('skips the check while the tab is hidden', () => {
    const h = harness()
    startUpdatePolling(h.options({ isVisible: () => false }))
    h.fireInterval()
    h.fireVisibility()
    expect(h.update).not.toHaveBeenCalled()
  })

  it('skips the check while offline', () => {
    const h = harness()
    startUpdatePolling(h.options({ isOnline: () => false }))
    h.fireInterval()
    expect(h.update).not.toHaveBeenCalled()
  })

  it('cleans up its interval and listener', () => {
    const h = harness()
    const stop = startUpdatePolling(h.options())
    stop()
    expect(h.clearInterval).toHaveBeenCalledWith(1)
    expect(h.removeVisibility).toHaveBeenCalled()
  })

  it('reports a failed check instead of throwing', async () => {
    const onError = vi.fn()
    const failing = vi.fn().mockRejectedValue(new Error('offline'))
    let handler: (() => void) | undefined
    startUpdatePolling({
      registration: { update: failing },
      setInterval: (fn) => {
        handler = fn
        return 1
      },
      clearInterval: () => {},
      addVisibilityListener: () => () => {},
      isVisible: () => true,
      isOnline: () => true,
      onError,
    })
    handler?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(onError).toHaveBeenCalled()
  })

  it('defaults to an hourly check', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(60 * 60 * 1000)
  })
})
