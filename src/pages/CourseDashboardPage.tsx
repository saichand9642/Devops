import { Link } from 'react-router-dom'
import { ckadCourse } from '../content/courses'
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

function TopicRow({ topic, status }: { topic: Topic; status: TopicStatus }) {
  return (
    <li>
      <Link className="topic-row" to={`${ckadCourse.route}/topics/${topic.id}`}>
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

function DomainCard({ entry }: { entry: DomainStats }) {
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
          <Badge>Support</Badge>
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
          <TopicRow key={topic.id} topic={topic} status={topicStatus(state, topic.id)} />
        ))}
      </ul>

      <div className="row">
        <Link
          className="btn btn--secondary btn--sm"
          to={`${ckadCourse.route}/practice/${domain.id}`}
        >
          Practise this domain
        </Link>
      </div>
    </section>
  )
}

export function CourseDashboardPage() {
  const { state } = useProgress()
  const domains = domainStats(ckadCourse, state)
  const completion = courseCompletion(ckadCourse, state)
  const readiness = readinessFor(ckadCourse, state)

  const weighted = domains.filter((entry) => entry.domain.examWeight !== null)
  const totalWeight = weighted.reduce((sum, entry) => sum + (entry.domain.examWeight ?? 0), 0)
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
          <span>CKAD</span>
        </nav>
        <h1>{ckadCourse.title}</h1>
        <p className="muted">{ckadCourse.subtitle}</p>
        <div className="page-header__meta">
          <Badge tone="info">{ckadCourse.targetVersion}</Badge>
          <Badge>{ckadCourse.examBlueprint.defaultMinutes} minutes</Badge>
          <Badge>{ckadCourse.examBlueprint.passingScore}% to pass</Badge>
          <Badge>{ckadCourse.topics.length} lessons</Badge>
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
                    : ' · no exam weight, but assumed knowledge'}
                </p>
                <ProgressBar value={step.percent} />
              </div>
            </div>
          ))}
        </div>
        <p className="subtle">
          Work top to bottom the first time through. Foundations and Exam Technique carry no
          official weight, but the five weighted domains assume the first and are much easier to
          finish in time with the last.
        </p>
      </section>

      <section className="stack" aria-labelledby="domains">
        <h2 id="domains">
          Curriculum domains{' '}
          <span className="subtle">({totalWeight}% weighted + 2 support sections)</span>
        </h2>
        {domains.map((entry) => (
          <DomainCard key={entry.domain.id} entry={entry} />
        ))}
      </section>

      <section className="stack" aria-labelledby="next-steps">
        <h2 id="next-steps">Practise and verify</h2>
        <div className="card-grid card-grid--3">
          <Link className="card card--interactive stack-sm" to={`${ckadCourse.route}/practice`}>
            <strong className="card__title">🎯 Practice questions</strong>
            <p className="subtle" style={{ margin: 0 }}>
              {ckadCourse.questions.length} original questions by domain, with explanations and
              retry of anything you got wrong.
            </p>
          </Link>
          <Link className="card card--interactive stack-sm" to={`${ckadCourse.route}/exams`}>
            <strong className="card__title">⏱️ Mock exams</strong>
            <p className="subtle" style={{ margin: 0 }}>
              Timed papers weighted to the official domain percentages, scored per domain.
            </p>
          </Link>
          <Link className="card card--interactive stack-sm" to={`${ckadCourse.route}/commands`}>
            <strong className="card__title">⌨️ Command reference</strong>
            <p className="subtle" style={{ margin: 0 }}>
              Searchable kubectl, Helm and Kustomize cheat sheet with copy buttons and YAML
              templates.
            </p>
          </Link>
        </div>
      </section>

      <p className="disclaimer">
        Domain names and weights are taken from the official CNCF/Linux Foundation CKAD curriculum
        (verified 2026-09-03 against CKAD_Curriculum_v1.35, exam environment{' '}
        {ckadCourse.targetVersion}). All questions and labs in this app are original material, not
        exam content.
      </p>
    </div>
  )
}
