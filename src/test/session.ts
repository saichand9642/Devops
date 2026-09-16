import { SESSION_KEY } from '../lib/access'

/**
 * The email gate stands in front of every route, so tests that render <App />
 * have to get past it first. This address is on the real access list in
 * `src/access/allowed-emails.ts`, which is what the gate checks against.
 */
export const TEST_EMAIL = 'saichand.kanimeraka@tenetic.com'

/** Puts a signed-in session in storage, as a previous visit would have left. */
export function signInForTest(email: string = TEST_EMAIL): string {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email, signedInAt: Date.now() }))
  return email
}
