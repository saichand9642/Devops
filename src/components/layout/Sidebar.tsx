import { Link, NavLink } from 'react-router-dom'
import { ckadCourse } from '../../content/courses'
import { useProgress } from '../../lib/use-progress'
import { courseCompletion, domainStats } from '../../lib/stats'
import { ProgressBar } from '../ui/ProgressBar'
import { BrandMark } from './BrandMark'
import { primaryNav, secondaryNav } from './navigation'

/** Desktop navigation: primary destinations plus the CKAD domain outline. */
export function Sidebar() {
  const { state } = useProgress()
  const completion = courseCompletion(ckadCourse, state)
  const domains = domainStats(ckadCourse, state)

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
        <p className="sidebar__heading">CKAD progress</p>
        <div className="sidebar__progress">
          <ProgressBar
            value={completion.percent}
            label={`${completion.completed} of ${completion.total} lessons`}
            showValue
          />
        </div>
      </div>

      <div className="sidebar__section">
        <p className="sidebar__heading">Curriculum</p>
        {domains.map((entry) => (
          /*
           * A plain Link, not a NavLink: these point at sections of the CKAD
           * dashboard, so marking them aria-current="page" would flag all five
           * as the current page whenever you are anywhere under /ckad.
           */
          <Link
            key={entry.domain.id}
            to={`/ckad#domain-${entry.domain.id}`}
            className="sidebar__link"
            style={{ display: 'grid', gap: '0.25rem' }}
          >
            <span className="row" style={{ gap: '0.4rem' }}>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>{entry.domain.shortTitle}</span>
              <span className="subtle nowrap">
                {entry.domain.examWeight === null ? 'support' : `${entry.domain.examWeight}%`}
              </span>
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
