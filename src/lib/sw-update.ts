/**
 * Service-worker update policy, kept free of React and of the
 * `virtual:pwa-register` module so it can be unit tested directly.
 *
 * The app registers with `registerType: 'prompt'`, so a new deployment waits
 * instead of swapping content underneath a learner who is mid-lesson. Two
 * things make sure nobody gets stranded on a stale build:
 *
 * 1. We poll for a new service worker on an interval and whenever the tab
 *    becomes visible again (iOS Safari keeps standalone PWAs suspended for
 *    days, so a visibility check is the one that usually fires).
 * 2. Applying the update only ever activates the waiting worker and reloads.
 *    Caches are keyed per build and old ones are cleaned up by Workbox, and
 *    progress lives in localStorage, which a worker update never touches.
 */

export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** The subset of ServiceWorkerRegistration this module needs. */
export interface UpdatableRegistration {
  update: () => Promise<unknown>
}

export interface UpdatePollingOptions {
  registration: UpdatableRegistration
  intervalMs?: number
  /** Injected in tests; defaults to the real timer and document APIs. */
  setInterval?: (handler: () => void, timeout: number) => number
  clearInterval?: (handle: number) => void
  addVisibilityListener?: (handler: () => void) => () => void
  isVisible?: () => boolean
  isOnline?: () => boolean
  onError?: (error: unknown) => void
}

const defaultVisibilityListener = (handler: () => void): (() => void) => {
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}

/**
 * Starts checking for a newer service worker. Returns a cleanup function.
 *
 * Checks are skipped while the tab is hidden or the device is offline, so a
 * backgrounded PWA does not burn battery on requests that cannot succeed.
 */
export function startUpdatePolling(options: UpdatePollingOptions): () => void {
  const {
    registration,
    intervalMs = UPDATE_CHECK_INTERVAL_MS,
    setInterval: setIntervalFn = ((handler: () => void, timeout: number) =>
      window.setInterval(handler, timeout)) as NonNullable<UpdatePollingOptions['setInterval']>,
    clearInterval: clearIntervalFn = (handle: number) => window.clearInterval(handle),
    addVisibilityListener = defaultVisibilityListener,
    isVisible = () => document.visibilityState === 'visible',
    isOnline = () => navigator.onLine !== false,
    onError,
  } = options

  const check = () => {
    if (!isVisible() || !isOnline()) return
    void Promise.resolve(registration.update()).catch((error: unknown) => onError?.(error))
  }

  const handle = setIntervalFn(check, intervalMs)
  const removeVisibilityListener = addVisibilityListener(() => {
    if (isVisible()) check()
  })

  return () => {
    clearIntervalFn(handle)
    removeVisibilityListener()
  }
}

export type UpdateStatus = 'idle' | 'offline-ready' | 'update-available'

/**
 * Decides what, if anything, to tell the learner.
 *
 * An available update always outranks the one-off "ready to work offline"
 * confirmation, because it is the only message that needs an action.
 */
export function updateStatus(needRefresh: boolean, offlineReady: boolean): UpdateStatus {
  if (needRefresh) return 'update-available'
  if (offlineReady) return 'offline-ready'
  return 'idle'
}
