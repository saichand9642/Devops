import '@testing-library/jest-dom/vitest'

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
