import { Link } from 'react-router-dom'
import { courseIndexes } from '../content/registry'
import { EmptyState } from '../components/ui/StateBlock'

export function NotFoundPage() {
  return (
    <div className="page stack">
      <header className="page-header">
        <h1>Page not found</h1>
      </header>
      <EmptyState
        icon="🧭"
        title="Nothing lives at this address"
        description="The link may be out of date, or the address may have a typo. Search the course, or start from the dashboard."
        action={
          <div className="row">
            <Link className="btn" to="/">
              Home
            </Link>
            <Link className="btn btn--secondary" to={courseIndexes[0].course.route}>
              CKAD dashboard
            </Link>
            <Link className="btn btn--secondary" to={`${courseIndexes[0].course.route}/search`}>
              Search
            </Link>
          </div>
        }
      />
    </div>
  )
}
