import { useProgress } from '../lib/use-progress'
import type { ThemePreference } from '../lib/storage'

const order: ThemePreference[] = ['system', 'light', 'dark']

const meta: Record<ThemePreference, { icon: string; label: string }> = {
  system: { icon: '🌗', label: 'Theme: follow device' },
  light: { icon: '☀️', label: 'Theme: light' },
  dark: { icon: '🌙', label: 'Theme: dark' },
}

/** Cycles device → light → dark. The choice is stored with the learner's progress. */
export function ThemeToggle() {
  const { state, setTheme } = useProgress()
  const current = state.theme
  const next = order[(order.indexOf(current) + 1) % order.length]

  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon"
      onClick={() => setTheme(next)}
      aria-label={`${meta[current].label}. Activate to switch to ${meta[next].label.toLowerCase()}.`}
      title={meta[current].label}
    >
      <span aria-hidden="true">{meta[current].icon}</span>
    </button>
  )
}
