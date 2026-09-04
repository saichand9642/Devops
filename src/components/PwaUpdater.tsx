import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { startUpdatePolling, updateStatus } from '../lib/sw-update'
import { UpdateToast } from './UpdateToast'

/**
 * Wires the generated service-worker registration to the update prompt.
 *
 * Kept as a thin shell: everything worth testing lives in
 * `src/lib/sw-update.ts` and `UpdateToast`.
 */
export function PwaUpdater() {
  const [dismissed, setDismissed] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Cleanup is intentionally not wired up here: the registration lives for
      // the lifetime of the document, and so should the polling.
      startUpdatePolling({ registration })
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed', error)
    },
  })

  // A newly announced update supersedes an earlier dismissal.
  useEffect(() => {
    if (needRefresh) setDismissed(false)
  }, [needRefresh])

  const status = dismissed ? 'idle' : updateStatus(needRefresh, offlineReady)

  return (
    <UpdateToast
      status={status}
      onUpdate={() => {
        // `true` activates the waiting worker and reloads the page. Progress is
        // in localStorage, which is untouched by the swap.
        void updateServiceWorker(true)
      }}
      onDismiss={() => {
        setDismissed(true)
        setNeedRefresh(false)
        setOfflineReady(false)
      }}
    />
  )
}
