import { Link } from 'react-router-dom'
import { plannedCourses } from '../content/courses'
import { interviewTopics } from '../content/interview'
import { countInterview } from '../lib/interview-stats'
import { courseIdForTopic, courseIndex, courseIndexes } from '../content/registry'
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
import { RichText } from '../components/ui/RichText'
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

  /*
   * Home belongs to no single course, so the focused sections (readiness,
   * today's suggestion) follow whichever course you last opened a lesson in.
   * Falling back to the first course keeps a brand-new install sensible.
   */
  const lastCourseId = state.lastVisitedTopicId
    ? courseIdForTopic(state.lastVisitedTopicId)
    : undefined
  const active = courseIndex(lastCourseId) ?? courseIndexes[0]
  const activeCourse = active.course

  /* Overall progress spans every installed course, not just the active one. */
  const perCourse = courseIndexes.map((entry) => ({
    entry,
    completion: courseCompletion(entry.course, state),
    practice: practiceStats(entry.course, state),
  }))
  const lessonsDone = perCourse.reduce((sum, item) => sum + item.completion.completed, 0)
  const lessonsTotal = perCourse.reduce((sum, item) => sum + item.completion.total, 0)
  const overallPercent = lessonsTotal === 0 ? 0 : Math.round((lessonsDone / lessonsTotal) * 100)
  const answered = perCourse.reduce((sum, item) => sum + item.practice.answered, 0)
  const correct = perCourse.reduce(
    (sum, item) => sum + Math.round((item.practice.accuracy / 100) * item.practice.answered),
    0,
  )
  const overallAccuracy = answered === 0 ? 0 : Math.round((correct / answered) * 100)

  const interview = countInterview(interviewTopics, state)
  const readiness = readinessFor(activeCourse, state)
  const suggestion = dailySuggestion(activeCourse, state)
  const streak = studyStreak(state)
  const bestScore = state.exams.reduce((best, attempt) => Math.max(best, attempt.scorePercent), 0)

  const continueTo = state.lastVisitedTopicId
    ? `${activeCourse.route}/topics/${state.lastVisitedTopicId}`
    : suggestion.topic
      ? `${activeCourse.route}/topics/${suggestion.topic.id}`
      : activeCourse.route

  const courseWord = courseIndexes.length === 1 ? 'course' : 'courses'

  /* Built from the registry so adding a topic cannot leave this list stale. */
  const topicNames = interviewTopics.map((topic) => topic.shortTitle).join(', ')

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <h1>DevOps Learning Hub</h1>
        <p className="muted">
          A study app for DevOps, built to work offline on a phone. Two sections:{' '}
          <strong>interview preparation</strong> ({interviewTopics.length} topics, {interview.total}{' '}
          questions) and <strong>certification courses</strong> ({courseIndexes.length} {courseWord}{' '}
          - {courseIndexes.map((entry) => entry.course.examCode).join(' and ')}).
        </p>
      </header>

      {/*
       * One card covering BOTH sections, because the app has two of them and a
       * summary that only counted lessons would understate half the work.
       */}
      <section aria-labelledby="overall-progress" className="card stack">
        <div className="row">
          <h2 id="overall-progress" className="card__title" style={{ flex: '1 1 auto' }}>
            Your progress
          </h2>
          <Badge tone={readinessTone[readiness.level]}>{readiness.label}</Badge>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat__value">{interview.percent}%</div>
            <div className="stat__label">
              Interview recall · {interview.known} of {interview.total}
            </div>
          </div>
          <div className="stat">
            <div className="stat__value">{overallPercent}%</div>
            <div className="stat__label">
              Lessons complete · {lessonsDone} of {lessonsTotal}
            </div>
          </div>
          <div className="stat">
            <div className="stat__value">{answered}</div>
            <div className="stat__label">
              Practice answered{answered > 0 ? ` · ${overallAccuracy}% correct` : ''}
            </div>
          </div>
          <div className="stat">
            <div className="stat__value">{state.exams.length === 0 ? '—' : `${bestScore}%`}</div>
            <div className="stat__label">Best mock exam</div>
          </div>
          <div className="stat">
            <div className="stat__value">{streak}</div>
            <div className="stat__label">Day study streak</div>
          </div>
        </div>
        <div className="row">
          <Link className="btn" to="/interview">
            {interview.known > 0 ? 'Continue interview prep' : 'Start interview prep'}
          </Link>
          <Link className="btn btn--secondary" to={continueTo}>
            {state.lastVisitedTopicId || lessonsDone > 0 ? 'Continue learning' : 'Start learning'}
          </Link>
          <Link className="btn btn--secondary" to={activeCourse.route}>
            {activeCourse.examCode} dashboard
          </Link>
        </div>
      </section>

      <section aria-labelledby="interview" className="stack">
        <h2 id="interview">Interview preparation</h2>
        <Link className="card card--interactive stack-sm" to="/interview">
          <div className="row">
            <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
              💬
            </span>
            <Badge tone="info">{interviewTopics.length} topics</Badge>
            <Badge>{interview.total} questions</Badge>
            {interview.review > 0 && <Badge tone="warning">{interview.review} to review</Badge>}
          </div>
          <strong className="card__title">DevOps interview questions</strong>
          <p className="subtle" style={{ margin: 0 }}>
            {topicNames} - from first-round basics to senior scenario rounds.
          </p>
          <ProgressBar value={interview.percent} showValue />
          <p className="subtle" style={{ margin: 0 }}>
            {interview.known} of {interview.total} you can answer out loud
          </p>
        </Link>
      </section>

      <section aria-labelledby="courses" className="stack">
        <h2 id="courses">Certification courses</h2>
        <div className="card-grid card-grid--2">
          {perCourse.map(({ entry, completion }) => (
            <Link
              className="card card--interactive stack-sm"
              key={entry.course.id}
              to={entry.course.route}
            >
              <div className="row">
                <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
                  {entry.course.icon}
                </span>
                <Badge tone="success">Available</Badge>
                <Badge>{entry.course.targetVersion}</Badge>
              </div>
              <strong className="card__title">{entry.course.title}</strong>
              <p className="subtle" style={{ margin: 0 }}>
                {entry.course.subtitle}
              </p>
              <ProgressBar value={completion.percent} showValue />
              <p className="subtle" style={{ margin: 0 }}>
                {entry.course.topics.length} lessons · {entry.course.questions.length} practice
                questions ·{' '}
                {entry.course.commandGroups.reduce((sum, group) => sum + group.entries.length, 0)}{' '}
                reference commands
              </p>
            </Link>
          ))}

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

      <section aria-labelledby="readiness" className="card stack">
        <h2 id="readiness" className="card__title">
          {activeCourse.examCode} exam readiness
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
              to={`${activeCourse.route}/topics/${suggestion.topic.id}`}
            >
              <strong>{suggestion.topic.title}</strong>
              <p className="subtle" style={{ margin: '0.25rem 0 0' }}>
                <RichText text={suggestion.topic.oneLiner} />
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
              to={`${activeCourse.route}/practice/${suggestion.drillDomainId}`}
            >
              {suggestion.drillLabel}
            </Link>
          ) : (
            <Link className="btn btn--secondary" to={`${activeCourse.route}/practice`}>
              {suggestion.drillLabel}
            </Link>
          )}
          <Link className="btn btn--secondary" to={`${activeCourse.route}/exams`}>
            Mock exams
          </Link>
        </div>
      </section>

      <section aria-labelledby="disclaimer" className="stack">
        <h2 id="disclaimer" className="visually-hidden">
          Disclaimer
        </h2>
        <p className="disclaimer">
          <strong>Independent learning tool.</strong> This app is not affiliated with, endorsed by
          or sponsored by any certification body, including the Cloud Native Computing Foundation,
          the Linux Foundation and HashiCorp. The certifications are theirs; this is a study aid
          built around their publicly published curricula. All practice questions, labs and mock
          exams here are original material written for this app - none are actual exam questions.
          Always check the official curriculum before your exam:{' '}
          {courseIndexes
            .flatMap((entry) =>
              entry.course.sources.slice(0, 2).map((source) => ({
                key: `${entry.course.id}-${source.url}`,
                label: `${entry.course.examCode}: ${source.title}`,
                url: source.url,
              })),
            )
            .map((source, index) => (
              <span key={source.key}>
                {index > 0 && ' · '}
                <a href={source.url} target="_blank" rel="noreferrer noopener">
                  {source.label}
                </a>
              </span>
            ))}
          .
        </p>
      </section>
    </div>
  )
}
