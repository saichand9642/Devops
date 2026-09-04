import { Link } from 'react-router-dom'
import { courseIndexes } from '../content/registry'
import { EmptyState } from './ui/StateBlock'

/**
 * Shown when the `:courseId` segment names a course that does not exist -
 * a stale bookmark, a typo, or a course that has been renamed. Every
 * course-scoped page renders this instead of throwing on an undefined lookup.
 *
 * The heading matches NotFoundPage on purpose: to the reader both are simply
 * "this address does not exist", and a single-segment typo such as /proggress
 * lands here rather than there. The body explains the specific cause and the
 * buttons offer the recovery.
 */
export function UnknownCourse() {
  return (
    <div className="stack">
      <header className="page-header">
        <h1>Page not found</h1>
      </header>
      <EmptyState
        icon="🧭"
        title="No such course in this app"
        description="The address names a course that is not installed. Pick one of the courses below."
      />
      <div className="button-row">
        {courseIndexes.map((index) => (
          <Link className="btn btn--secondary" key={index.course.id} to={index.course.route}>
            {index.course.icon} {index.course.examCode}
          </Link>
        ))}
        <Link className="btn" to="/">
          Home
        </Link>
      </div>
    </div>
  )
}
