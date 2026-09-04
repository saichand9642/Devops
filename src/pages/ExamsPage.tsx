import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ckadCourse } from '../content/courses'
import { domainById, weightedDomainIds } from '../content/ckad/domains'
import { questionsForDomain } from '../content/ckad/questions'
import { useProgress } from '../lib/use-progress'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/StateBlock'

const presets = [
  { id: 'full', label: 'Full length', minutes: 120, count: 20 },
  { id: 'half', label: 'Half length', minutes: 60, count: 10 },
  { id: 'sprint', label: 'Quick sprint', minutes: 20, count: 5 },
] as const

export function ExamsPage() {
  const navigate = useNavigate()
  const { state, deleteExamAttempt } = useProgress()
  const blueprint = ckadCourse.examBlueprint

  const [minutes, setMinutes] = useState(blueprint.defaultMinutes)
  const [count, setCount] = useState(blueprint.questionCount)

  const attempts = state.exams.filter((attempt) => attempt.courseId === ckadCourse.id)
  const best = attempts.reduce((max, attempt) => Math.max(max, attempt.scorePercent), 0)

  const available = weightedDomainIds.map((id) => ({
    domain: domainById.get(id),
    count: questionsForDomain(id).length,
    weight: blueprint.weights[id],
  }))
  const poolSize = available.reduce((sum, entry) => sum + entry.count, 0)

  const start = () => {
    const seed = Date.now() % 2147483647
    navigate(`${ckadCourse.route}/exams/run?minutes=${minutes}&count=${count}&seed=${seed}`)
  }

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to={ckadCourse.route}>CKAD</Link>
          <span aria-hidden="true">/</span>
          <span>Mock exams</span>
        </nav>
        <h1>Mock exams</h1>
        <p className="muted">
          Timed papers whose question mix follows the official domain weights. Nothing is revealed
          until you submit, and the result is broken down per domain against the{' '}
          {blueprint.passingScore}% pass mark.
        </p>
      </header>

      <div className="notice notice--warning">
        <span className="notice__icon" aria-hidden="true">
          ⚠️
        </span>
        <div>
          <strong>These are original practice questions, not actual exam questions.</strong> The
          real CKAD is entirely performance-based in a live cluster. This paper mixes auto-scored
          multiple-choice and command questions with performance-based tasks you verify yourself
          against a checkpoint list. Treat the score as a study signal, not a prediction.
        </div>
      </div>

      <section className="card stack" aria-labelledby="configure">
        <h2 id="configure" className="card__title">
          Configure your paper
        </h2>

        <div className="field">
          <span className="field__label">Preset</span>
          <div className="chip-row">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="chip"
                aria-pressed={minutes === preset.minutes && count === preset.count}
                onClick={() => {
                  setMinutes(preset.minutes)
                  setCount(preset.count)
                }}
              >
                {preset.label} · {preset.count} questions · {preset.minutes} min
              </button>
            ))}
          </div>
        </div>

        <div className="filter-bar filter-bar--inline">
          <div className="field">
            <label className="field__label" htmlFor="exam-minutes">
              Timer (minutes)
            </label>
            <input
              id="exam-minutes"
              className="search-input"
              type="number"
              min={5}
              max={240}
              step={5}
              value={minutes}
              onChange={(event) =>
                setMinutes(Number(event.target.value) || blueprint.defaultMinutes)
              }
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="exam-count">
              Questions
            </label>
            <input
              id="exam-count"
              className="search-input"
              type="number"
              min={5}
              max={poolSize}
              step={1}
              value={count}
              onChange={(event) => setCount(Number(event.target.value) || blueprint.questionCount)}
            />
          </div>
          <div className="field">
            <span className="field__label">Realistic setting</span>
            <p className="subtle" style={{ margin: 0 }}>
              The real exam is {blueprint.defaultMinutes} minutes with roughly 15-20 tasks and a{' '}
              {blueprint.passingScore}% pass mark.
            </p>
          </div>
        </div>

        <div>
          <span className="field__label">Domain weighting for this paper</span>
          <div className="table-scroll">
            <table className="fields-table">
              <thead>
                <tr>
                  <th scope="col">Domain</th>
                  <th scope="col">Official weight</th>
                  <th scope="col">Questions available</th>
                </tr>
              </thead>
              <tbody>
                {available.map((entry) => (
                  <tr key={entry.domain?.id}>
                    <td style={{ fontFamily: 'inherit' }}>{entry.domain?.shortTitle}</td>
                    <td>{entry.weight}%</td>
                    <td>{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="subtle">
            Seats are allocated by largest remainder, so a 20-question paper gets exactly 4 / 4 / 3
            / 5 / 4 questions. Foundations and Exam Technique questions are excluded because they
            carry no official weight.
          </p>
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={start}>
            Start {count}-question exam ({minutes} min)
          </button>
        </div>
      </section>

      <section className="stack" aria-labelledby="history">
        <h2 id="history">Attempt history</h2>
        {attempts.length === 0 ? (
          <EmptyState
            icon="⏱️"
            title="No attempts yet"
            description="Your attempts are saved locally on this device, including the per-domain breakdown, so you can compare over time."
          />
        ) : (
          <div className="card stack">
            <div className="stat-grid">
              <div className="stat">
                <div className="stat__value">{attempts.length}</div>
                <div className="stat__label">Attempts</div>
              </div>
              <div className="stat">
                <div className="stat__value">{best}%</div>
                <div className="stat__label">Best score</div>
              </div>
              <div className="stat">
                <div className="stat__value">
                  {attempts.filter((attempt) => attempt.passed).length}
                </div>
                <div className="stat__label">Above {blueprint.passingScore}%</div>
              </div>
              <div className="stat">
                <div className="stat__value">
                  {
                    attempts.filter((attempt) => attempt.minutesAllowed >= blueprint.defaultMinutes)
                      .length
                  }
                </div>
                <div className="stat__label">Full-length attempts</div>
              </div>
            </div>

            {attempts.map((attempt) => (
              <div className="attempt-row" key={attempt.id}>
                <span className="attempt-row__score">{attempt.scorePercent}%</span>
                <Badge tone={attempt.passed ? 'success' : 'danger'}>
                  {attempt.passed ? 'Pass' : 'Below pass mark'}
                </Badge>
                <span style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <strong>{attempt.label}</strong>
                  <br />
                  <span className="subtle">
                    {new Date(attempt.submittedAt).toLocaleString()} ·{' '}
                    {Math.round(attempt.elapsedSeconds / 60)} of {attempt.minutesAllowed} min used ·{' '}
                    {attempt.earnedPoints}/{attempt.totalPoints} points
                  </span>
                </span>
                <Link
                  className="btn btn--secondary btn--sm"
                  to={`${ckadCourse.route}/exams/attempts/${attempt.id}`}
                >
                  Review
                </Link>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Delete this attempt permanently? Your lesson and practice progress are not affected.',
                      )
                    ) {
                      deleteExamAttempt(attempt.id)
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="how-scored">
        <h2 id="how-scored" className="card__title">
          How scoring works
        </h2>
        <ul style={{ marginBottom: 0 }}>
          <li>
            <strong>Multiple choice</strong> is auto-scored. Multi-answer questions are
            all-or-nothing, which is how the real exam treats an incomplete task.
          </li>
          <li>
            <strong>Command questions</strong> are auto-scored against a list of accepted answers,
            normalised for whitespace and quote style so formatting never costs you a mark.
          </li>
          <li>
            <strong>Performance-based tasks</strong> cannot be auto-graded without a cluster. After
            submission you confirm which required outcomes you actually achieved, and the task
            awards partial credit for the fraction confirmed. Be honest with yourself - the score is
            only useful if it is.
          </li>
          <li>
            The final score is earned points over total points, weighted by each question&apos;s
            point value, and is broken down per domain so you can see where to study next.
          </li>
        </ul>
      </section>
    </div>
  )
}
