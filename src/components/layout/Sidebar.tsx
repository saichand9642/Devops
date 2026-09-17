import { Link, NavLink } from 'react-router-dom'
import { courseIndexes } from '../../content/registry'
import { interviewTopics } from '../../content/interview'
import { countInterview } from '../../lib/interview-stats'
import { weightBadge } from '../../lib/domain-label'
import { useActiveCourseIndex } from '../../lib/use-course'
import { useProgress } from '../../lib/use-progress'
import { courseCompletion, domainStats } from '../../lib/stats'
import { ProgressBar } from '../ui/ProgressBar'
import { BrandMark } from './BrandMark'
import { courseToolsFor, mainNav, utilityNav } from './navigation'

/**
 * Desktop navigation.
 *
 * Deliberately two-tier. The app is for two things - interview preparation
 * and certification courses - so those sit at the top in a visually heavier
 * block, and everything that is a tool *inside* a course (search, practice,
 * exams, the command reference) sits below in the quieter style. A learner
 * should be able to tell what this app is for from the sidebar alone.
 */
export function Sidebar() {
  const { state } = useProgress()
  const { course } = useActiveCourseIndex()
  const [home, interview] = mainNav()
  const courseTools = courseToolsFor(course)
  const completion = courseCompletion(course, state)
  const domains = domainStats(course, state)
  const interviewCounts = countInterview(interviewTopics, state)
  /* The Courses header summarises EVERY course, not just the active one. */
  const allLessons = courseIndexes.reduce(
    (sum, entry) => sum + courseCompletion(entry.course, state).total,
    0,
  )

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
        <NavLink to={home.to} end className="sidebar__link">
          <span className="sidebar__link-icon" aria-hidden="true">
            {home.icon}
          </span>
          {home.label}
        </NavLink>
      </div>

      {/*
       * The two main sections. Same visual weight as each other, heavier than
       * anything below, because these are the only two places you START from.
       */}
      <div className="sidebar__section sidebar__section--main">
        <NavLink to={interview.to} className="nav-primary">
          <span className="nav-primary__icon" aria-hidden="true">
            {interview.icon}
          </span>
          <span className="nav-primary__body">
            <span className="nav-primary__label">{interview.label}</span>
            <span className="nav-primary__meta">
              {interviewTopics.length} topics · {interviewCounts.total} questions
            </span>
          </span>
        </NavLink>
        <div className="nav-primary__bar">
          <ProgressBar
            value={interviewCounts.percent}
            label={`${interviewCounts.known} of ${interviewCounts.total} recalled`}
            showValue
          />
        </div>

        <p className="nav-primary nav-primary--static">
          <span className="nav-primary__icon" aria-hidden="true">
            📚
          </span>
          <span className="nav-primary__body">
            <span className="nav-primary__label">Courses</span>
            <span className="nav-primary__meta">
              {courseIndexes.length} available · {allLessons} lessons
            </span>
          </span>
        </p>
        <div className="nav-primary__children">
          {courseIndexes.map((entry) => {
            const entryCompletion = courseCompletion(entry.course, state)
            return (
              /*
               * aria-current="location", not the NavLink default of "page":
               * this marks which COURSE you are inside, which is true on every
               * page under /ckad or /terraform - whereas "page" would falsely
               * claim the dashboard is the page you are looking at.
               */
              <NavLink
                key={entry.course.id}
                to={entry.course.route}
                className="sidebar__link sidebar__link--course"
                aria-current="location"
                end={false}
              >
                <span className="sidebar__link-icon" aria-hidden="true">
                  {entry.course.icon}
                </span>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}>{entry.course.examCode}</span>
                <span className="subtle nowrap">{entryCompletion.percent}%</span>
              </NavLink>
            )
          })}
        </div>
      </div>

      <div className="sidebar__section">
        <p className="sidebar__heading">In {course.examCode}</p>
        {courseTools.map((item) => (
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
        <div className="sidebar__progress">
          <ProgressBar
            value={completion.percent}
            label={`${completion.completed} of ${completion.total} lessons`}
            showValue
          />
        </div>
      </div>

      <div className="sidebar__section">
        <p className="sidebar__heading">{course.examCode} curriculum</p>
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

      <div className="sidebar__section">
        {utilityNav().map((item) => (
          <NavLink key={item.to} to={item.to} className="sidebar__link">
            <span className="sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </aside>
  )
}
