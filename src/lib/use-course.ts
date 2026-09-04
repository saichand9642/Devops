import { useLocation, useParams } from 'react-router-dom'
import { courseFromPath, courseIndex } from '../content/registry'
import type { CourseIndex } from '../content/registry'

/**
 * The course index for the current route, or `undefined` when the URL names a
 * course that does not exist. Pages render a not-found state in that case.
 */
export function useCourseIndex(): CourseIndex | undefined {
  const { courseId } = useParams<{ courseId: string }>()
  return courseIndex(courseId)
}

/**
 * For chrome shown on every page, including pages with no course in the URL.
 *
 * Reads the path rather than route params: this is called from the layout
 * route, where `useParams` cannot see a child route's `:courseId`.
 */
export function useActiveCourseIndex(): CourseIndex {
  return courseFromPath(useLocation().pathname)
}
