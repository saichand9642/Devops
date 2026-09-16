import { useEffect, useState, type FormEvent } from 'react'
import { useAccess } from '../lib/use-access'
import { readLastEmail } from '../lib/access'
import { applyTheme, readSharedTheme, writeSharedTheme, type ThemePreference } from '../lib/storage'
import { BrandMark } from '../components/layout/BrandMark'

const themeOrder: ThemePreference[] = ['system', 'light', 'dark']
const themeMeta: Record<ThemePreference, { icon: string; label: string }> = {
  system: { icon: '🌗', label: 'Theme: follow device' },
  light: { icon: '☀️', label: 'Theme: light' },
  dark: { icon: '🌙', label: 'Theme: dark' },
}

/**
 * The door.
 *
 * Nothing else in the app renders until an address on the access list is
 * entered, because the address is also what decides whose progress record is
 * loaded. It is checked entirely in the browser - see
 * `src/access/allowed-emails.ts` for what that does and does not guarantee.
 *
 * This screen sits outside `ProgressProvider` (there is no learner yet, so
 * there is no record to read), which is why it manages the theme itself
 * instead of using the usual toggle.
 */
export function SignInPage() {
  const { signIn, sessionPersisted } = useAccess()
  const [email, setEmail] = useState(() => readLastEmail() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [theme, setThemeState] = useState<ThemePreference>(() => readSharedTheme())

  useEffect(() => {
    applyTheme(theme)
    writeSharedTheme(theme)
  }, [theme])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = signIn(email)
    // On success this component unmounts, so only the failure needs handling.
    if (!result.ok) setError(result.error)
  }

  const nextTheme = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length]

  return (
    <div className="gate">
      <div className="gate__theme">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => setThemeState(nextTheme)}
          aria-label={`${themeMeta[theme].label}. Activate to switch to ${themeMeta[
            nextTheme
          ].label.toLowerCase()}.`}
          title={themeMeta[theme].label}
        >
          <span aria-hidden="true">{themeMeta[theme].icon}</span>
        </button>
      </div>

      <main className="gate__card card stack" id="main-content">
        <div className="gate__brand">
          <BrandMark size={44} />
          <div>
            <h1 className="gate__title">DevOps Learning Hub</h1>
            <p className="subtle">Independent study app — CKAD, Terraform and interview prep</p>
          </div>
        </div>

        <p className="muted">
          This app is shared with a specific group. Enter the email address it was shared with to
          continue. Your lessons, practice answers and exam attempts are then kept separately under
          that address, so several people can use the same browser without mixing up their progress.
        </p>

        <form className="stack" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="gate-email">
              Email address
            </label>
            <input
              id="gate-email"
              className="search-input"
              type="email"
              name="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                if (error) setError(null)
              }}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              aria-describedby={error ? 'gate-error' : undefined}
              aria-invalid={error ? true : undefined}
            />
          </div>

          {error && (
            <div className="notice notice--danger" id="gate-error" role="alert">
              <span className="notice__icon" aria-hidden="true">
                ⚠️
              </span>
              <div>{error}</div>
            </div>
          )}

          {!sessionPersisted && (
            <div className="notice notice--warning" role="status">
              <span className="notice__icon" aria-hidden="true">
                ⚠️
              </span>
              <div>
                This browser refused to remember the sign-in — private browsing is the usual cause.
                You can continue, but you will be asked again next time.
              </div>
            </div>
          )}

          <button type="submit" className="btn btn--block">
            Continue
          </button>
        </form>

        <p className="subtle">
          Checked in this browser only: nothing is sent anywhere, and there is no password. If your
          address is not accepted, ask whoever shared the app to add it to the access list.
        </p>
      </main>
    </div>
  )
}
