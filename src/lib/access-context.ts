import { createContext } from 'react'
import type { SignInCheck } from './access'

export interface AccessApi {
  /** The address signed in on this device, or null when the gate is showing. */
  email: string | null
  /** Validates an address against the access list and signs in on success. */
  signIn: (raw: string) => SignInCheck
  /** Returns to the gate. Progress is kept and comes back on the next sign-in. */
  signOut: () => void
  /** False when local storage rejected the write, so the gate will reappear. */
  sessionPersisted: boolean
}

export const AccessContext = createContext<AccessApi | null>(null)
