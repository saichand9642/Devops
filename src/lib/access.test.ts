import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LAST_EMAIL_KEY,
  SESSION_KEY,
  checkEmail,
  clearSession,
  forgetDevice,
  isAllowedEmail,
  isEmailShaped,
  normalizeEmail,
  readLastEmail,
  readSession,
  writeSession,
} from './access'
import type * as AllowedEmailsModule from '../access/allowed-emails'
import { TEST_EMAIL } from '../test/session'

const LIST = ['someone@example.com', 'Other.Person@Example.org', '@tenetic.com']

/**
 * The real `src/access/allowed-emails.ts` is mocked for the rest of the suite
 * (see `src/test/setup.ts`), because editing it is the whole point of it and
 * must never break the build. These two checks are the exception: they read
 * the file as shipped, because a list that is empty or malformed would lock
 * everybody out of the deployed app - which IS worth failing the build for.
 */
describe('the shipped access list', () => {
  const shipped = async (): Promise<readonly string[]> => {
    const actual = await vi.importActual<typeof AllowedEmailsModule>('../access/allowed-emails')
    return actual.allowedEmails
  }

  it('is not empty, which would lock everybody out', async () => {
    expect((await shipped()).length).toBeGreaterThan(0)
  })

  it('contains only entries that can ever match somebody', async () => {
    for (const entry of await shipped()) {
      // Deliberately checked AFTER normalising: stray case and spaces are
      // forgiven at runtime, so they must not fail anyone's build.
      const normalized = normalizeEmail(entry)
      expect(
        normalized.startsWith('@')
          ? isEmailShaped(`someone${normalized}`)
          : isEmailShaped(normalized),
        `"${entry}" is neither an email address nor an @domain rule, so it can never let anybody in`,
      ).toBe(true)
    }
  })
})

describe('the list the suite runs against', () => {
  it('admits the address the tests sign in with', () => {
    expect(isAllowedEmail(TEST_EMAIL)).toBe(true)
  })
})

describe('matching an address against the list', () => {
  it('matches an exact address', () => {
    expect(isAllowedEmail('someone@example.com', LIST)).toBe(true)
  })

  it('ignores case and surrounding spaces on both sides', () => {
    expect(isAllowedEmail('  SomeOne@Example.COM ', LIST)).toBe(true)
    expect(isAllowedEmail('other.person@example.org', LIST)).toBe(true)
  })

  it('rejects an address that is not listed', () => {
    expect(isAllowedEmail('stranger@example.com', LIST)).toBe(false)
  })

  it('treats an @domain entry as everybody on that domain', () => {
    expect(isAllowedEmail('anyone@tenetic.com', LIST)).toBe(true)
    expect(isAllowedEmail('someone.else@tenetic.com', LIST)).toBe(true)
  })

  it('does not let a domain rule match a lookalike domain', () => {
    expect(isAllowedEmail('attacker@nottenetic.com', LIST)).toBe(false)
    expect(isAllowedEmail('attacker@tenetic.com.evil.net', LIST)).toBe(false)
  })

  it('matches the last @ in an address, so a local part cannot fake a domain', () => {
    expect(isAllowedEmail('"a@tenetic.com"@evil.net', LIST)).toBe(false)
  })

  it('rejects everything when the list is empty', () => {
    expect(isAllowedEmail('someone@example.com', [])).toBe(false)
  })
})

describe('checking a typed address', () => {
  it('accepts a listed address and returns it normalised', () => {
    expect(checkEmail('  SomeOne@Example.com ', LIST)).toEqual({
      ok: true,
      email: 'someone@example.com',
    })
  })

  it('asks for an address when the box is empty', () => {
    const result = checkEmail('   ', LIST)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/enter your email/i)
  })

  it('names a typo as a typo rather than as a refusal', () => {
    const result = checkEmail('someone@example', LIST)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/does not look like an email/i)
  })

  it('says who to ask when the address is simply not on the list', () => {
    const result = checkEmail('stranger@example.com', LIST)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/not on the access list/i)
  })
})

describe('the remembered sign-in', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips a sign-in', () => {
    expect(writeSession(TEST_EMAIL)).toBe(true)
    expect(readSession()).toBe(TEST_EMAIL)
  })

  it('normalises what it stores, so the progress key is stable', () => {
    writeSession(`  ${TEST_EMAIL.toUpperCase()} `)
    expect(readSession()).toBe(TEST_EMAIL)
  })

  it('reads nothing when nobody has signed in', () => {
    expect(readSession()).toBeNull()
  })

  it('accepts a bare address written by an older version of the app', () => {
    window.localStorage.setItem(SESSION_KEY, TEST_EMAIL)
    expect(readSession()).toBe(TEST_EMAIL)
  })

  it('revokes a stored sign-in whose address has left the list', () => {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ email: 'removed@example.com', signedInAt: 1 }),
    )

    expect(readSession()).toBeNull()
    // And it clears the record, so the check is not repeated on every read.
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('ignores a session record that is not usable at all', () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email: 42 }))
    expect(readSession()).toBeNull()
  })

  it('keeps the address on sign-out so the form can offer it back', () => {
    writeSession(TEST_EMAIL)
    clearSession()

    expect(readSession()).toBeNull()
    expect(readLastEmail()).toBe(TEST_EMAIL)
  })

  it('forgets the address entirely when asked to', () => {
    writeSession(TEST_EMAIL)
    forgetDevice()

    expect(readSession()).toBeNull()
    expect(readLastEmail()).toBeNull()
    expect(window.localStorage.getItem(LAST_EMAIL_KEY)).toBeNull()
  })

  it('reports failure rather than throwing when storage is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    expect(writeSession(TEST_EMAIL)).toBe(false)
    setItem.mockRestore()
  })
})
