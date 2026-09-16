/**
 * The email gate.
 *
 * Opening the app asks for an address and checks it against
 * `src/access/allowed-emails.ts`. A match is remembered on the device so the
 * question is asked once, not on every visit, and it also decides which
 * progress record the app reads and writes - see `progressKeyFor` below.
 *
 * The stored sign-in is re-validated against the list on every load, so
 * deleting somebody from the list locks them out at their next visit rather
 * than only at their next sign-in.
 *
 * This module deliberately knows nothing about React or about the shape of a
 * progress record, so it can be tested on its own.
 */

import { allowedEmails } from '../access/allowed-emails'

export const SESSION_KEY = 'devops-learning-hub.session'
/** The last address used here, so a returning learner only has to confirm it. */
export const LAST_EMAIL_KEY = 'devops-learning-hub.session.last-email'

export interface Session {
  email: string
  signedInAt: number
}

/** Addresses are compared lowercased and trimmed, so typing is forgiving. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * A deliberately loose shape check. The point is to catch a typo before the
 * "not on the list" message appears, not to police what an address may
 * contain - the allow-list is what actually decides.
 */
export function isEmailShaped(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * True when `email` matches an allow-list entry.
 *
 * An entry starting with '@' is a domain rule and matches every address on
 * that domain; anything else must match the whole address.
 */
export function isAllowedEmail(email: string, list: readonly string[] = allowedEmails): boolean {
  const candidate = normalizeEmail(email)
  if (!candidate.includes('@')) return false
  const domain = candidate.slice(candidate.lastIndexOf('@'))

  return list.some((entry) => {
    const rule = normalizeEmail(entry)
    if (rule.length === 0) return false
    return rule.startsWith('@') ? rule === domain : rule === candidate
  })
}

export type SignInCheck = { ok: true; email: string } | { ok: false; error: string }

/** Validates one typed address and returns either its normalised form or why it failed. */
export function checkEmail(raw: string, list: readonly string[] = allowedEmails): SignInCheck {
  const email = normalizeEmail(raw)
  if (email.length === 0) return { ok: false, error: 'Enter your email address to continue.' }
  if (!isEmailShaped(email)) {
    return { ok: false, error: `"${raw.trim()}" does not look like an email address.` }
  }
  if (!isAllowedEmail(email, list)) {
    return {
      ok: false,
      error: `${email} is not on the access list for this app. Ask whoever shared it with you to add your address.`,
    }
  }
  return { ok: true, email }
}

/* localStorage throws in some private-browsing modes, so every access is guarded. */
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* nothing useful to do, and nothing worth telling the learner */
  }
}

/**
 * The address signed in on this device, or null.
 *
 * Returns null - and clears the stored record - if that address is no longer
 * on the list, so access can be revoked by editing the list alone.
 */
export function readSession(): string | null {
  const stored = safeGet(SESSION_KEY)
  if (!stored) return null

  let email: string | null = null
  try {
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed === 'object' && parsed !== null && 'email' in parsed) {
      const value = (parsed as { email: unknown }).email
      if (typeof value === 'string') email = normalizeEmail(value)
    }
  } catch {
    // Tolerate a bare address written by an older version of this app.
    email = normalizeEmail(stored)
  }

  if (!email || !isAllowedEmail(email)) {
    clearSession()
    return null
  }
  return email
}

/** Records a successful sign-in. Returns false if storage rejected the write. */
export function writeSession(email: string): boolean {
  const normalized = normalizeEmail(email)
  const session: Session = { email: normalized, signedInAt: Date.now() }
  safeSet(LAST_EMAIL_KEY, normalized)
  return safeSet(SESSION_KEY, JSON.stringify(session))
}

/**
 * Signs out. The remembered address is kept on purpose so the sign-in form can
 * offer it back; progress is never touched, so signing in again restores it.
 */
export function clearSession(): void {
  safeRemove(SESSION_KEY)
}

/** The address last used on this device, for pre-filling the sign-in form. */
export function readLastEmail(): string | null {
  const stored = safeGet(LAST_EMAIL_KEY)
  return stored ? normalizeEmail(stored) : null
}

/** Forgets the remembered address as well as the sign-in. */
export function forgetDevice(): void {
  clearSession()
  safeRemove(LAST_EMAIL_KEY)
}
