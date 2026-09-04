import { Link } from 'react-router-dom'
import { ckadCourse, plannedCourses } from '../content/courses'
import { useProgress } from '../lib/use-progress'
import {
  courseCompletion,
  dailySuggestion,
  readinessFor,
  studyStreak,
  practiceStats,
} from '../lib/stats'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import type { ReadinessLevel } from '../lib/stats'

const readinessTone: Record<ReadinessLevel, BadgeTone> = {
  'just-starting': 'neutral',
  building: 'info',
  consolidating: 'warning',
  'exam-ready': 'success',
}

export function HomePage() {
  const { state } = useProgress()
  const completion = courseCompletion(ckadCourse, state)
  const readiness = readinessFor(ckadCourse, state)
  const suggestion = dailySuggestion(ckadCourse, state)
  const streak = studyStreak(state)
  const practice = practiceStats(ckadCourse, state)
  const attempts = state.exams.filter((attempt) => attempt.courseId === ckadCourse.id)
  const bestScore = attempts.reduce((best, attempt) => Math.max(best, attempt.scorePercent), 0)

  const continueTo = state.lastVisitedTopicId
    ? `${ckadCourse.route}/topics/${state.lastVisitedTopicId}`
    : suggestion.topic
      ? `${ckadCourse.route}/topics/${suggestion.topic.id}`
      : ckadCourse.route

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <h1>DevOps Learning Hub</h1>
        <p className="muted">
          A study app for DevOps certifications, built to work offline on a phone. Course one is
          CKAD.
        </p>
      </header>

      <section aria-labelledby="overall-progress" className="card stack">
        <div className="row">
          <h2 id="overall-progress" className="card__title" style={{ flex: '1 1 auto' }}>
            Overall progress
          </h2>
          <Badge tone={readinessTone[readiness.level]}>{readiness.label}</Badge>
        </div>
        <ProgressBar
          value={completion.percent}
          label={`${completion.completed} of ${completion.total} lessons complete`}
          showValue
          large
          tone={completion.percent === 100 ? 'success' : 'primary'}
        />
        <div className="stat-grid">
          <div className="stat">
            <div className="stat__value">{completion.percent}%</div>
            <div className="stat__label">Lessons complete</div>
          </div>
          <div className="stat">
            <div className="stat__value">{practice.answered}</div>
            <div className="stat__label">
              Practice answered{practice.answered > 0 ? ` · ${practice.accuracy}% correct` : ''}
            </div>
          </div>
          <div className="stat">
            <div className="stat__value">{attempts.length === 0 ? '—' : `${bestScore}%`}</div>
            <div className="stat__label">Best mock exam</div>
          </div>
          <div className="stat">
            <div className="stat__value">{streak}</div>
            <div className="stat__label">Day study streak</div>
          </div>
        </div>
        <div className="row">
          <Link className="btn" to={continueTo}>
            {state.lastVisitedTopicId || completion.completed > 0
              ? 'Continue learning'
              : 'Start learning'}
          </Link>
          <Link className="btn btn--secondary" to={`${ckadCourse.route}`}>
            CKAD dashboard
          </Link>
        </div>
      </section>

      <section aria-labelledby="readiness" className="card stack">
        <h2 id="readiness" className="card__title">
          Exam readiness
        </h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          {readiness.headline}
        </p>
        <ProgressBar
          value={readiness.score}
          label="Readiness indicator"
          showValue
          tone={readiness.level === 'exam-ready' ? 'success' : 'primary'}
        />
        <ul className="stack-sm" style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
          {readiness.signals.map((signal) => (
            <li key={signal.label} className="row" style={{ gap: '0.5rem' }}>
              <span aria-hidden="true">{signal.met ? '✅' : '⬜'}</span>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>{signal.label}</span>
              <span className="subtle nowrap">{signal.value}</span>
            </li>
          ))}
        </ul>
        <p className="subtle" style={{ marginBottom: 0 }}>
          <strong>Next:</strong> {readiness.nextAction}
        </p>
        <p className="subtle" style={{ marginBottom: 0 }}>
          This indicator is a study aid computed from your own activity in this app. It is not a
          prediction of your exam result.
        </p>
      </section>

      <section aria-labelledby="today" className="card stack">
        <h2 id="today" className="card__title">
          Daily practice suggestion
        </h2>
        {suggestion.topic ? (
          <>
            <p className="muted" style={{ marginBottom: 0 }}>
              {suggestion.reason}
            </p>
            <Link
              className="card card--interactive"
              to={`${ckadCourse.route}/topics/${suggestion.topic.id}`}
            >
              <strong>{suggestion.topic.title}</strong>
              <p className="subtle" style={{ margin: '0.25rem 0 0' }}>
                {suggestion.topic.oneLiner}
              </p>
              <p className="subtle" style={{ margin: '0.4rem 0 0' }}>
                About {suggestion.minutes} minutes
              </p>
            </Link>
          </>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>
            {suggestion.reason}
          </p>
        )}
        <div className="row">
          {suggestion.drillDomainId ? (
            <Link
              className="btn btn--secondary"
              to={`${ckadCourse.route}/practice/${suggestion.drillDomainId}`}
            >
              {suggestion.drillLabel}
            </Link>
          ) : (
            <Link className="btn btn--secondary" to={`${ckadCourse.route}/practice`}>
              {suggestion.drillLabel}
            </Link>
          )}
          <Link className="btn btn--secondary" to={`${ckadCourse.route}/exams`}>
            Mock exams
          </Link>
        </div>
      </section>

      <section aria-labelledby="courses" className="stack">
        <h2 id="courses">Courses</h2>
        <div className="card-grid card-grid--2">
          <Link className="card card--interactive stack-sm" to={ckadCourse.route}>
            <div className="row">
              <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
                {ckadCourse.icon}
              </span>
              <Badge tone="success">Available</Badge>
              <Badge>{ckadCourse.targetVersion}</Badge>
            </div>
            <strong className="card__title">{ckadCourse.title}</strong>
            <p className="subtle" style={{ margin: 0 }}>
              {ckadCourse.subtitle}
            </p>
            <ProgressBar value={completion.percent} showValue />
            <p className="subtle" style={{ margin: 0 }}>
              {ckadCourse.topics.length} lessons · {ckadCourse.questions.length} practice questions
              · {ckadCourse.commandGroups.reduce((sum, group) => sum + group.entries.length, 0)}{' '}
              reference commands
            </p>
          </Link>

          {plannedCourses.map((course) => (
            <div className="card stack-sm" key={course.id} aria-label={`${course.title} (planned)`}>
              <div className="row">
                <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
                  {course.icon}
                </span>
                <Badge>Planned</Badge>
              </div>
              <strong className="card__title">{course.title}</strong>
              <p className="subtle" style={{ margin: 0 }}>
                {course.subtitle}
              </p>
              <p className="subtle" style={{ margin: 0 }}>
                {course.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="disclaimer" className="stack">
        <h2 id="disclaimer" className="visually-hidden">
          Disclaimer
        </h2>
        <p className="disclaimer">
          <strong>Independent learning tool.</strong> This app is not affiliated with, endorsed by
          or sponsored by the Cloud Native Computing Foundation or the Linux Foundation. CKAD is
          their certification; this is a study aid built around the publicly published curriculum.
          All practice questions, labs and mock exams here are original material written for this
          app - none are actual exam questions. Always check the official curriculum before your
          exam:{' '}
          {ckadCourse.sources.map((source, index) => (
            <span key={source.url}>
              {index > 0 && ' · '}
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
              </a>
            </span>
          ))}
          .
        </p>
      </section>
    </div>
  )
}
