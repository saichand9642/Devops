export interface NavItem {
  to: string
  label: string
  shortLabel: string
  icon: string
  /** Also highlight this item for nested routes under `to`. */
  matchPrefix?: boolean
}

/** Primary destinations, shared by the desktop sidebar and the mobile tab bar. */
export const primaryNav: NavItem[] = [
  { to: '/', label: 'Home', shortLabel: 'Home', icon: '🏠' },
  { to: '/ckad', label: 'CKAD course', shortLabel: 'Learn', icon: '📚', matchPrefix: false },
  { to: '/ckad/search', label: 'Search', shortLabel: 'Search', icon: '🔎' },
  {
    to: '/ckad/practice',
    label: 'Practice',
    shortLabel: 'Practice',
    icon: '🎯',
    matchPrefix: true,
  },
  { to: '/ckad/exams', label: 'Mock exams', shortLabel: 'Exams', icon: '⏱️', matchPrefix: true },
]

export const secondaryNav: NavItem[] = [
  { to: '/ckad/commands', label: 'Command reference', shortLabel: 'Commands', icon: '⌨️' },
  { to: '/progress', label: 'Progress & data', shortLabel: 'Progress', icon: '💾' },
]
