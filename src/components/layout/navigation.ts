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
 * Primary destinations, shared by the desktop sidebar and the mobile tab bar.
 *
 * Built from the active course rather than hard-coded, so the same five tabs
 * point at whichever course you are currently studying.
 */
export function primaryNavFor(course: Course): NavItem[] {
  return [
    { to: '/', label: 'Home', shortLabel: 'Home', icon: '🏠' },
    {
      to: course.route,
      label: `${course.examCode} course`,
      shortLabel: 'Learn',
      icon: '📚',
      matchPrefix: false,
    },
    {
      to: `${course.route}/search`,
      label: 'Search',
      shortLabel: 'Search',
      icon: '🔎',
    },
    {
      to: `${course.route}/practice`,
      label: 'Practice',
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

export function secondaryNavFor(course: Course): NavItem[] {
  return [
    {
      to: `${course.route}/commands`,
      label: 'Command reference',
      shortLabel: 'Commands',
      icon: '⌨️',
    },
    { to: '/progress', label: 'Progress & data', shortLabel: 'Progress', icon: '💾' },
  ]
}
