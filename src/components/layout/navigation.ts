import type { Course } from '../../content/types'

export interface NavItem {
  to: string
  label: string
  shortLabel: string
  icon: string
  /** Also highlight this item for nested routes under `to`. */
  matchPrefix?: boolean
}

/**
 * The app has two things in it: interview preparation and certification
 * courses. Everything else - search, practice, mock exams, the command
 * reference - is a tool inside one of those, not a destination of its own.
 *
 * The navigation is built to say that. `mainNav` is what the sidebar
 * emphasises; `courseToolsFor` and `utilityNav` are deliberately quieter.
 */
export function mainNav(): NavItem[] {
  return [
    { to: '/', label: 'Home', shortLabel: 'Home', icon: '🏠' },
    {
      to: '/interview',
      label: 'Interview preparation',
      shortLabel: 'Interview',
      icon: '💬',
      matchPrefix: true,
    },
  ]
}

/** Course-scoped tools. Only meaningful once you are inside a course. */
export function courseToolsFor(course: Course): NavItem[] {
  return [
    { to: `${course.route}/search`, label: 'Search', shortLabel: 'Search', icon: '🔎' },
    {
      to: `${course.route}/practice`,
      label: 'Practice questions',
      shortLabel: 'Practice',
      icon: '🎯',
      matchPrefix: true,
    },
    {
      to: `${course.route}/exams`,
      label: 'Mock exams',
      shortLabel: 'Exams',
      icon: '⏱️',
      matchPrefix: true,
    },
    {
      to: `${course.route}/commands`,
      label: 'Command reference',
      shortLabel: 'Commands',
      icon: '⌨️',
    },
  ]
}

export function utilityNav(): NavItem[] {
  return [{ to: '/progress', label: 'Progress & data', shortLabel: 'Progress', icon: '💾' }]
}

/**
 * The mobile tab bar, which has exactly five fixed slots and so cannot use
 * the sidebar's nested shape. It carries the same priority order: the two
 * main sections first, then the course tools people reach for most.
 *
 * Search is deliberately absent - it has its own button in the top bar on
 * every screen, so spending a scarce tab slot on it would push out Exams.
 */
export function primaryNavFor(course: Course): NavItem[] {
  return [
    { to: '/', label: 'Home', shortLabel: 'Home', icon: '🏠' },
    {
      to: '/interview',
      label: 'Interview preparation',
      shortLabel: 'Interview',
      icon: '💬',
      matchPrefix: true,
    },
    {
      to: course.route,
      label: `${course.examCode} course`,
      shortLabel: 'Course',
      icon: '📚',
      matchPrefix: false,
    },
    {
      to: `${course.route}/practice`,
      label: 'Practice questions',
      shortLabel: 'Practice',
      icon: '🎯',
      matchPrefix: true,
    },
    {
      to: `${course.route}/exams`,
      label: 'Mock exams',
      shortLabel: 'Exams',
      icon: '⏱️',
      matchPrefix: true,
    },
  ]
}
