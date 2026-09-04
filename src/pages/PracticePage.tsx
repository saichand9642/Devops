import { Link } from 'react-router-dom'
import { useCourseIndex } from '../lib/use-course'
import type { CourseIndex } from '../content/registry'
import { UnknownCourse } from '../components/UnknownCourse'
import { useProgress } from '../lib/use-progress'
import { practiceStats } from '../lib/stats'
import { percent } from '../lib/scoring'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'

export function PracticePage() {
  const catalog = useCourseIndex()
  if (!catalog) return <UnknownCourse />
  return <PracticeView catalog={catalog} />
}

function PracticeView({ catalog }: { catalog: CourseIndex }) {
  const { course } = catalog
  const { state } = useProgress()
  const overall = practiceStats(course, state)

  const perDomain = course.domains.map((domain) => {
    const questions = catalog.questionsForDomain(domain.id)
    let correct = 0
    let incorrect = 0
    for (const question of questions) {
      const record = state.questions[question.id]
      if (!record) continue
      if (record.lastCorrect) correct += 1
      else incorrect += 1
    }
    const answered = correct + incorrect
    return {
      domain,
      total: questions.length,
      answered,
      correct,
      incorrect,
      accuracy: percent(correct, answered),
      coverage: percent(answered, questions.length),
    }
  })

  const categories = ['concept', 'command', 'yaml', 'troubleshoot', 'lab'] as const
  const categoryCounts = categories.map((category) => ({
    category,
    count: course.questions.filter((question) => question.category === category).length,
  }))

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to={course.route}>{course.examCode}</Link>
          <span aria-hidden="true">/</span>
          <span>Practice</span>
        </nav>
        <h1>Practice questions</h1>
        <p className="muted">
          {course.questions.length} original questions across five question types: concepts,
          commands, YAML correction, troubleshooting scenarios and hands-on labs. Answers reveal
          immediately with an explanation, and anything you get wrong is queued for retry.
        </p>
        <div className="page-header__meta">
          {categoryCounts.map((entry) => (
            <Badge key={entry.category}>
              {entry.count} {entry.category}
            </Badge>
          ))}
        </div>
      </header>

      <section className="card stack" aria-labelledby="practice-overall">
        <h2 id="practice-overall" className="card__title">
          Your practice record
        </h2>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat__value">{overall.answered}</div>
            <div className="stat__label">Answered</div>
          </div>
          <div className="stat">
            <div className="stat__value">{overall.correct}</div>
            <div className="stat__label">Correct</div>
          </div>
          <div className="stat">
            <div className="stat__value">{overall.incorrect}</div>
            <div className="stat__label">To retry</div>
          </div>
          <div className="stat">
            <div className="stat__value">
              {overall.answered === 0 ? '—' : `${overall.accuracy}%`}
            </div>
            <div className="stat__label">Accuracy</div>
          </div>
        </div>
        {overall.needsReview.length > 0 && (
          <div className="row">
            <Link className="btn" to={`${course.route}/practice/review`}>
              Retry {overall.needsReview.length} incorrect question
              {overall.needsReview.length === 1 ? '' : 's'}
            </Link>
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="by-domain">
        <h2 id="by-domain">Practise by domain</h2>
        <div className="card-grid card-grid--2">
          {perDomain.map((entry) => (
            <Link
              className="card card--interactive domain-card stack-sm"
              key={entry.domain.id}
              to={`${course.route}/practice/${entry.domain.id}`}
              style={{ ['--domain-accent' as string]: `var(--accent-${entry.domain.accent})` }}
            >
              <div className="row">
                <strong className="card__title" style={{ flex: '1 1 auto' }}>
                  {entry.domain.shortTitle}
                </strong>
                {entry.domain.examWeight === null ? (
                  <Badge>Support</Badge>
                ) : (
                  <Badge tone="info">{entry.domain.examWeight}%</Badge>
                )}
              </div>
              <p className="subtle" style={{ margin: 0 }}>
                {entry.total} question{entry.total === 1 ? '' : 's'} ·{' '}
                {entry.answered === 0
                  ? 'not attempted yet'
                  : `${entry.answered} answered, ${entry.accuracy}% correct`}
              </p>
              <ProgressBar
                value={entry.coverage}
                tone={entry.coverage === 100 && entry.incorrect === 0 ? 'success' : 'primary'}
              />
              {entry.incorrect > 0 && (
                <span className="subtle">{entry.incorrect} to retry in this domain</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section className="stack" aria-labelledby="also">
        <h2 id="also">Also useful</h2>
        <div className="card-grid card-grid--2">
          <Link className="card card--interactive stack-sm" to={`${course.route}/exams`}>
            <strong className="card__title">⏱️ Mock exams</strong>
            <p className="subtle" style={{ margin: 0 }}>
              Practice is untimed and reveals answers immediately. A mock exam hides everything
              until you submit and weights the questions to the official domain percentages.
            </p>
          </Link>
          <Link className="card card--interactive stack-sm" to={`${course.route}/commands`}>
            <strong className="card__title">⌨️ Command reference</strong>
            <p className="subtle" style={{ margin: 0 }}>
              Look up the command a question expects, with copy buttons.
            </p>
          </Link>
        </div>
      </section>

      <p className="disclaimer">
        All questions in this app are original material written to assess the published CKAD
        objectives. They are not real exam questions, and no leaked or recalled exam content is
        used.
      </p>
    </div>
  )
}
