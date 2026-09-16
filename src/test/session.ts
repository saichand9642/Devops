import { SESSION_KEY } from '../lib/access'

/**
 * The email gate stands in front of every route, so tests that render <App />
 * have to get past it first.
 *
 * These addresses come from the access list mocked in `setup.ts`, never from
 * the one the app ships with - editing the real list must not break the suite.
 */
export const TEST_EMAIL = 'learner@example.test'
/** A second person, for checking that two learners stay separate. */
export const OTHER_TEST_EMAIL = 'second.learner@example.test'
/** On the mocked list only via its @domain rule. */
export const TEST_DOMAIN_EMAIL = 'anyone@team.example.test'
/** Not on the mocked list at all. */
export const BLOCKED_TEST_EMAIL = 'stranger@example.com'

/** Puts a signed-in session in storage, as a previous visit would have left. */
export function signInForTest(email: string = TEST_EMAIL): string {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email, signedInAt: Date.now() }))
  return email
}
