import { Navigate, useParams } from 'react-router-dom'

/**
 * Redirects `/<course>/dashboard` to `/<course>`.
 *
 * Kept as a component rather than an inline `<Navigate>` because the target
 * depends on the matched `:courseId`, which a static `to` cannot express.
 */
export function CourseDashboardRedirect() {
  const { courseId } = useParams<{ courseId: string }>()
  return <Navigate to={courseId ? `/${courseId}` : '/'} replace />
}
