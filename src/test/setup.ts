import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

/*
 * The suite uses its own access list, not the one the app ships with.
 *
 * `src/access/allowed-emails.ts` is meant to be edited - adding and removing
 * people is the whole point of it - so no test may depend on what is in it.
 * Mocking it here, once, keeps every test that signs in working whoever is on
 * the real list. The real file is still checked for being usable, by
 * `src/lib/access.test.ts`, which reads it with `importActual`.
 */
vi.mock('../access/allowed-emails', () => ({
  allowedEmails: ['learner@example.test', 'second.learner@example.test', '@team.example.test'],
}))

// jsdom does not implement scrollTo, and the app shell calls it on every route
// change. Stub it so route-change effects do not throw during tests.
window.scrollTo = (() => {}) as typeof window.scrollTo

// Nor does it implement matchMedia, which the theme handling touches indirectly.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
