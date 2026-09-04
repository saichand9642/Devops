import { Link } from 'react-router-dom'
import { useCourseIndex } from '../lib/use-course'
import type { CourseIndex } from '../content/registry'
import { UnknownCourse } from '../components/UnknownCourse'
import { useProgress } from '../lib/use-progress'
import {
  courseCompletion,
  domainStats,
  readinessFor,
  topicStatus,
  difficultyLabel,
} from '../lib/stats'
import type { DomainStats } from '../lib/stats'
import type { Topic } from '../content/types'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'
import type { TopicStatus } from '../lib/storage'

const statusIcon: Record<TopicStatus, string> = {
  completed: '✅',
  'in-progress': '🟡',
  'not-started': '⬜',
}

const statusLabel: Record<TopicStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  'not-started': 'Not started',
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

function TopicRow({ topic, status, route }: { topic: Topic; status: TopicStatus; route: string }) {
  return (
    <li>
      <Link className="topic-row" to={`${route}/topics/${topic.id}`}>
        <span className="topic-row__status" aria-hidden="true">
          {statusIcon[status]}
        </span>
        <span className="topic-row__body">
          <span className="topic-row__title">{topic.title}</span>
          <span className="topic-row__meta">
            {difficultyLabel[topic.difficulty]} · {topic.estimatedMinutes} min ·{' '}
            {statusLabel[status]}
          </span>
        </span>
        <span aria-hidden="true" className="subtle">
          →
        </span>
      </Link>
    </li>
  )
}

function DomainCard({ entry, route }: { entry: DomainStats; route: string }) {
  const { state } = useProgress()
  const { domain } = entry
  return (
    <section
      className="card domain-card stack"
      id={`domain-${domain.id}`}
      style={{ ['--domain-accent' as string]: `var(--accent-${domain.accent})` }}
      aria-labelledby={`domain-heading-${domain.id}`}
    >
      <div className="row">
        <h3 id={`domain-heading-${domain.id}`} className="card__title" style={{ flex: '1 1 auto' }}>
          {domain.title}
        </h3>
        {domain.examWeight === null ? (
          <Badge>{domain.weightLabel ?? 'Support'}</Badge>
        ) : (
          <Badge tone="info" className="badge--weight">
            {domain.examWeight}% of exam
          </Badge>
        )}
      </div>

      <p className="muted" style={{ marginBottom: 0 }}>
        {domain.description}
      </p>

      <ProgressBar
        value={entry.percent}
        label={`${entry.completed} complete · ${entry.inProgress} in progress · ${entry.notStarted} not started`}
        showValue
        tone={entry.percent === 100 ? 'success' : 'primary'}
      />

      <p className="subtle" style={{ marginBottom: 0 }}>
        Estimated study time {formatMinutes(entry.estimatedMinutes)}
        {entry.remainingMinutes > 0 && entry.remainingMinutes !== entry.estimatedMinutes
          ? ` · about ${formatMinutes(entry.remainingMinutes)} remaining`
          : ''}
      </p>

      {domain.officialCompetencies.length > 0 && (
        <details className="reveal">
          <summary className="reveal__summary">
            <span aria-hidden="true">📋</span>
            Official CNCF competencies for this domain
          </summary>
          <div className="reveal__body">
            <ul style={{ marginBottom: 0 }}>
              {domain.officialCompetencies.map((competency) => (
                <li key={competency}>{competency}</li>
              ))}
            </ul>
          </div>
        </details>
      )}

      <ul className="topic-list">
        {entry.topics.map((topic) => (
          <TopicRow
            key={topic.id}
            route={route}
            topic={topic}
            status={topicStatus(state, topic.id)}
          />
        ))}
      </ul>

      <div className="row">
        <Link className="btn btn--secondary btn--sm" to={`${route}/practice/${domain.id}`}>
          Practise this domain
        </Link>
      </div>
    </section>
  )
}

export function CourseDashboardPage() {
  const catalog = useCourseIndex()
  if (!catalog) return <UnknownCourse />
  return <Dashboard catalog={catalog} />
}

function Dashboard({ catalog }: { catalog: CourseIndex }) {
  const { course } = catalog
  const { state } = useProgress()
  const domains = domainStats(course, state)
  const completion = courseCompletion(course, state)
  const readiness = readinessFor(course, state)

  const weighted = domains.filter((entry) => entry.domain.examWeight !== null)
  const totalWeight = weighted.reduce((sum, entry) => sum + (entry.domain.examWeight ?? 0), 0)
  const supportCount = domains.length - weighted.length
  const totalMinutes = domains.reduce((sum, entry) => sum + entry.estimatedMinutes, 0)

  // The learning path walks the domains in curriculum order, which is
  // deliberately foundations first and exam technique last.
  const path = domains.map((entry) => ({
    domain: entry.domain,
    topics: entry.topics.length,
    minutes: entry.estimatedMinutes,
    percent: entry.percent,
  }))

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{course.examCode}</span>
        </nav>
        <h1>{course.title}</h1>
        <p className="muted">{course.subtitle}</p>
        <div className="page-header__meta">
          <Badge tone="info">{course.targetVersion}</Badge>
          <Badge>{course.examBlueprint.defaultMinutes} minutes</Badge>
          <Badge>
            {course.examBlueprint.passingScore}%{' '}
            {course.examBlueprint.officialWeights ? 'to pass' : 'target (app)'}
          </Badge>
          <Badge>{course.topics.length} lessons</Badge>
          <Badge>{formatMinutes(totalMinutes)} of material</Badge>
        </div>
      </header>

      <section className="card stack" aria-labelledby="course-progress">
        <h2 id="course-progress" className="card__title">
          Your progress
        </h2>
        <ProgressBar
          value={completion.percent}
          label={`${completion.completed} of ${completion.total} lessons complete`}
          showValue
          large
          tone={completion.percent === 100 ? 'success' : 'primary'}
        />
        <div className="row">
          <Badge tone={readiness.level === 'exam-ready' ? 'success' : 'info'}>
            {readiness.label}
          </Badge>
          <span className="subtle">{readiness.nextAction}</span>
        </div>
      </section>

      <section className="stack" aria-labelledby="learning-path">
        <h2 id="learning-path">Beginner-to-exam-ready path</h2>
        <div className="card">
          {path.map((step, index) => (
            <div className="path-step" key={step.domain.id}>
              <span className="path-step__index" aria-hidden="true">
                {index + 1}
              </span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <a href={`#domain-${step.domain.id}`} style={{ fontWeight: 650 }}>
                  {step.domain.shortTitle}
                </a>
                <p className="subtle" style={{ margin: '0.15rem 0 0.35rem' }}>
                  {step.topics} lessons · {formatMinutes(step.minutes)}
                  {step.domain.examWeight !== null
                    ? ` · ${step.domain.examWeight}% of the exam`
                    : step.domain.weightLabel
                      ? ` · ${step.domain.weightLabel}, no published weighting`
                      : ' · no exam weight, but assumed knowledge'}
                </p>
                <ProgressBar value={step.percent} />
              </div>
            </div>
          ))}
        </div>
        <p className="subtle">{course.copy.studyPath}</p>
      </section>

      <section className="stack" aria-labelledby="domains">
        <h2 id="domains">
          Curriculum domains{' '}
          <span className="subtle">
            {course.examBlueprint.officialWeights
              ? `(${totalWeight}% weighted + ${supportCount} support ${
                  supportCount === 1 ? 'section' : 'sections'
                })`
              : `(${course.domains.length} published objectives)`}
          </span>
        </h2>
        {domains.map((entry) => (
          <DomainCard key={entry.domain.id} entry={entry} route={course.route} />
        ))}
      </section>

      <section className="stack" aria-labelledby="next-steps">
        <h2 id="next-steps">Practise and verify</h2>
        <div className="card-grid card-grid--3">
          <Link className="card card--interactive stack-sm" to={`${course.route}/practice`}>
            <strong className="card__title">🎯 Practice questions</strong>
            <p className="subtle" style={{ margin: 0 }}>
              {course.questions.length} original questions by domain, with explanations and retry of
              anything you got wrong.
            </p>
          </Link>
          <Link className="card card--interactive stack-sm" to={`${course.route}/exams`}>
            <strong className="card__title">⏱️ Mock exams</strong>
            <p className="subtle" style={{ margin: 0 }}>
              {course.copy.examWeighting}
            </p>
          </Link>
          <Link className="card card--interactive stack-sm" to={`${course.route}/commands`}>
            <strong className="card__title">⌨️ Command reference</strong>
            <p className="subtle" style={{ margin: 0 }}>
              {course.copy.commandReference}
            </p>
          </Link>
        </div>
      </section>

      <p className="disclaimer">
        {course.copy.provenance} Exam environment: {course.targetVersion}.
        {course.examBlueprint.note ? ` ${course.examBlueprint.note}` : ''} All questions and labs in
        this app are original material, not exam content.
      </p>
    </div>
  )
}
