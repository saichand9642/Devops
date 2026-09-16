import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { checkEmail, clearSession, readSession, writeSession, type SignInCheck } from './access'
import { adoptSharedProgress } from './storage'
import { AccessContext, type AccessApi } from './access-context'

/**
 * Holds who is signed in on this device.
 *
 * Kept separate from `ProgressProvider` because it has to answer the question
 * that decides which progress record exists at all: the provider below is
 * mounted per address and re-created when it changes.
 */
export function AccessProvider({ children }: { children: ReactNode }) {
  // Validated against the access list on read, so an address removed from the
  // list is signed out the next time the app starts.
  const [email, setEmail] = useState<string | null>(() => readSession())
  const [sessionPersisted, setSessionPersisted] = useState(true)

  const signIn = useCallback((raw: string): SignInCheck => {
    const result = checkEmail(raw)
    if (!result.ok) return result

    // Do this before the state change so the provider's first read already
    // sees any record inherited from before the gate existed.
    adoptSharedProgress(result.email)

    setSessionPersisted(writeSession(result.email))
    setEmail(result.email)
    return result
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    setEmail(null)
    setSessionPersisted(true)
  }, [])

  const api = useMemo<AccessApi>(
    () => ({ email, signIn, signOut, sessionPersisted }),
    [email, signIn, signOut, sessionPersisted],
  )

  return <AccessContext.Provider value={api}>{children}</AccessContext.Provider>
}
