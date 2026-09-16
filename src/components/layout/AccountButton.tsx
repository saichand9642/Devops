import { useAccess } from '../../lib/use-access'

/** The part before the @, which is short enough to sit in a toolbar. */
const shortName = (email: string): string => email.slice(0, email.indexOf('@'))

/**
 * Who is signed in, and a way out.
 *
 * The full address is in the accessible name rather than on screen, because
 * the visible chip has to survive a narrow toolbar - and on a shared laptop
 * "am I still signed in as somebody else?" is the question this answers.
 */
export function AccountButton() {
  const { email, signOut } = useAccess()
  if (!email) return null

  return (
    <span className="account">
      <span className="account__name" title={email} aria-hidden="true">
        {shortName(email)}
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        onClick={signOut}
        aria-label={`Signed in as ${email}. Activate to sign out.`}
        title={`Signed in as ${email} — sign out`}
      >
        <span aria-hidden="true">🚪</span>
      </button>
    </span>
  )
}
