import { Link, NavLink } from 'react-router-dom'
import { courseIndexes } from '../../content/registry'
import { weightBadge } from '../../lib/domain-label'
import { useActiveCourseIndex } from '../../lib/use-course'
import { useProgress } from '../../lib/use-progress'
import { courseCompletion, domainStats } from '../../lib/stats'
import { ProgressBar } from '../ui/ProgressBar'
import { BrandMark } from './BrandMark'
import { primaryNavFor, secondaryNavFor } from './navigation'

/**
 * Desktop navigation: primary destinations, the active course's domain
 * outline, and a switcher when more than one course is installed.
 */
export function Sidebar() {
  const { state } = useProgress()
  const { course } = useActiveCourseIndex()
  const primaryNav = primaryNavFor(course)
  const secondaryNav = secondaryNavFor(course)
  const completion = courseCompletion(course, state)
  const domains = domainStats(course, state)

  return (
    <aside className="sidebar">
      <NavLink to="/" className="sidebar__brand">
        <BrandMark size={34} />
        <span>
          <strong>DevOps Learning Hub</strong>
          <span className="subtle">Independent study app</span>
        </span>
      </NavLink>

      <div className="sidebar__section">
        <p className="sidebar__heading">Navigate</p>
        {primaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.matchPrefix !== true}
            className="sidebar__link"
          >
            <span className="sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
        {secondaryNav.map((item) => (
          <NavLink key={item.to} to={item.to} className="sidebar__link">
            <span className="sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="sidebar__section">
        <p className="sidebar__heading">{course.examCode} progress</p>
        <div className="sidebar__progress">
          <ProgressBar
            value={completion.percent}
            label={`${completion.completed} of ${completion.total} lessons`}
            showValue
          />
        </div>
      </div>

      {courseIndexes.length > 1 && (
        <div className="sidebar__section">
          <p className="sidebar__heading">Courses</p>
          {courseIndexes.map((entry) => (
            /*
             * aria-current="location", not the NavLink default of "page":
             * this marks which COURSE you are inside, which is true on every
             * page under /ckad or /terraform - whereas "page" would falsely
             * claim the dashboard is the page you are looking at.
             */
            <NavLink
              key={entry.course.id}
              to={entry.course.route}
              className="sidebar__link"
              aria-current="location"
              end={false}
            >
              <span className="sidebar__link-icon" aria-hidden="true">
                {entry.course.icon}
              </span>
              {entry.course.examCode}
            </NavLink>
          ))}
        </div>
      )}

      <div className="sidebar__section">
        <p className="sidebar__heading">Curriculum</p>
        {domains.map((entry) => (
          /*
           * A plain Link, not a NavLink: these point at sections of the
           * course dashboard, so marking them aria-current="page" would flag
           * every one as the current page whenever you are inside the course.
           */
          <Link
            key={entry.domain.id}
            to={`${course.route}#domain-${entry.domain.id}`}
            className="sidebar__link"
            style={{ display: 'grid', gap: '0.25rem' }}
          >
            <span className="row" style={{ gap: '0.4rem' }}>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>{entry.domain.shortTitle}</span>
              <span className="subtle nowrap">{weightBadge(entry.domain)}</span>
            </span>
            <span className="subtle">
              {entry.completed}/{entry.total} lessons
            </span>
          </Link>
        ))}
      </div>
    </aside>
  )
}
