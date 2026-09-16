/**
 * Whether the app is running as an installed app rather than in a browser tab.
 *
 * This matters for one specific reason. Progress lives in localStorage, which
 * is deliberately per-device - but iOS Safari deletes script-writable storage
 * for a site after **seven days without interaction**. Someone who studies on
 * their phone once a fortnight, in a Safari tab, loses everything in between.
 *
 * Installing to the Home Screen exempts the app from that cap, so on iOS the
 * difference between a tab and an installed app is the difference between
 * progress that survives and progress that does not.
 */

/** True when launched from the Home Screen / as an installed PWA. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false

  // The standard signal, supported everywhere that supports installation.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true

  // iOS Safari predates display-mode and sets this instead.
  return (window.navigator as { standalone?: boolean }).standalone === true
}

/** True on iPhone, iPad or iPod, including iPadOS reporting itself as a Mac. */
export function isIos(): boolean {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true

  // iPadOS 13+ reports a desktop user agent, but a Mac has no touch points.
  return /Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1
}

/**
 * True only when the seven-day eviction genuinely applies: iOS, in a browser
 * tab rather than installed. Everywhere else the browser keeps localStorage
 * until the user clears it, so there is nothing to warn about.
 */
export function storageMayBeEvicted(): boolean {
  return isIos() && !isInstalled()
}
