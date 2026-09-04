/**
 * Stand-in for `virtual:pwa-register/react`, which vite-plugin-pwa only
 * generates during a real build. The update behaviour that matters is tested
 * directly against src/lib/sw-update.ts and the UpdateToast component.
 */
import { useState } from 'react'

interface RegisterOptions {
  onRegisteredSW?: (url: string, registration?: ServiceWorkerRegistration) => void
  onRegisterError?: (error: unknown) => void
}

export function useRegisterSW(_options: RegisterOptions = {}) {
  const needRefresh = useState(false)
  const offlineReady = useState(false)
  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async (_reload?: boolean) => {},
  }
}
