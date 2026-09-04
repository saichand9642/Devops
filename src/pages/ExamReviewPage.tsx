import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ckadCourse } from '../content/courses'
import { domainById } from '../content/ckad/domains'
import { questionById } from '../content/ckad/questions'
import { useProgress } from '../lib/use-progress'
import { gradeQuestion, percent, round1 } from '../lib/scoring'
import type { ExamAnswerRecord, ExamAttempt } from '../lib/storage'
import { QuestionView } from '../components/QuestionView'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/StateBlock'

type Filter = 'all' | 'incorrect' | 'unverified'

/**
 * Post-submission review.
 *
 * Performance-based tasks are still editable here: confirming a checkpoint
 * re-grades that answer and updates the stored attempt, which is how a
 * self-verified task earns its partial credit.
 */
export function ExamReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const { state, updateExamAttempt, recordAnswer } = useProgress()
  const [filter, setFilter] = useState<Filter>('all')

  const attempt = state.exams.find((candidate) => candidate.id === attemptId)

  const answers = useMemo(() => attempt?.answers ?? [], [attempt])

  if (!attempt) {
    return (
      <div className="page stack">
        <header className="page-header">
          <h1>Exam result</h1>
        </header>
        <EmptyState
          icon="🗂️"
          title="Attempt not found"
          description="This attempt is not stored on this device. Attempt history is local, so it does not transfer between browsers unless you export and import it."
          action={
            <Link className="btn" to={`${ckadCourse.route}/exams`}>
              Back to mock exams
            </Link>
          }
        />
      </div>
    )
  }

  const recalculate = (updated: ExamAnswerRecord[]): ExamAttempt => {
    const byDomain: Record<string, { earned: number; total: number }> = {}
    let earned = 0
    let total = 0
    for (const answer of updated) {
      earned += answer.earned
      total += answer.total
      const bucket = byDomain[answer.domainId] ?? { earned: 0, total: 0 }
      bucket.earned += answer.earned
      bucket.total += answer.total
      byDomain[answer.domainId] = bucket
    }
    const scorePercent = total === 0 ? 0 : percent(earned, total)
    return {
      ...attempt,
      answers: updated,
      byDomain,
      earnedPoints: round1(earned),
      totalPoints: round1(total),
      scorePercent,
      passed: scorePercent >= attempt.passingScore,
    }
  }

  const updateTaskResponse = (answer: ExamAnswerRecord, next: string[]) => {
    const question = questionById.get(answer.questionId)
    if (!question) return
    const grade = gradeQuestion(question, next)
    const updated = answers.map((candidate) =>
      candidate.questionId === answer.questionId
        ? { ...candidate, response: next, earned: grade.earned, correct: grade.correct }
        : candidate,
    )
    updateExamAttempt(attempt.id, recalculate(updated))
    recordAnswer(question.id, grade.correct === true)
  }

  const unverified = answers.filter((answer) => {
    const question = questionById.get(answer.questionId)
    return question?.kind === 'task' && answer.response.length === 0
  })

  const visible = answers.filter((answer) => {
    if (filter === 'all') return true
    const question = questionById.get(answer.questionId)
    if (filter === 'unverified') return question?.kind === 'task' && answer.response.length === 0
    return answer.earned < answer.total
  })

  const domainRows = Object.entries(attempt.byDomain)
    .map(([domainId, value]) => ({
      domainId,
      domain: domainById.get(domainId),
      ...value,
      percent: percent(value.earned, value.total),
    }))
    .sort((a, b) => (a.domain?.order ?? 99) - (b.domain?.order ?? 99))

  const weakest = [...domainRows].sort((a, b) => a.percent - b.percent)[0]

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to={ckadCourse.route}>CKAD</Link>
          <span aria-hidden="true">/</span>
          <Link to={`${ckadCourse.route}/exams`}>Mock exams</Link>
          <span aria-hidden="true">/</span>
          <span>Result</span>
        </nav>
        <h1>
          {attempt.scorePercent}%{' '}
          <Badge tone={attempt.passed ? 'success' : 'danger'}>
            {attempt.passed
              ? `Above the ${attempt.passingScore}% pass mark`
              : `Below ${attempt.passingScore}%`}
          </Badge>
        </h1>
        <p className="muted">
          {attempt.label} · {attempt.earnedPoints} of {attempt.totalPoints} points ·{' '}
          {Math.round(attempt.elapsedSeconds / 60)} of {attempt.minutesAllowed} minutes used ·{' '}
          {new Date(attempt.submittedAt).toLocaleString()}
        </p>
      </header>

      {unverified.length > 0 && (
        <div className="notice notice--warning">
          <span className="notice__icon" aria-hidden="true">
            ✍️
          </span>
          <div>
            <strong>
              {unverified.length} performance-based task
              {unverified.length === 1 ? '' : 's'} still need self-verification.
            </strong>{' '}
            Scroll to them below (or filter to &ldquo;Needs verification&rdquo;) and tick the
            outcomes you actually achieved. Your score updates as you do.
          </div>
        </div>
      )}

      <section className="card stack" aria-labelledby="score-overall">
        <h2 id="score-overall" className="card__title">
          Overall
        </h2>
        <ProgressBar
          value={attempt.scorePercent}
          label={`${attempt.earnedPoints} / ${attempt.totalPoints} points`}
          showValue
          large
          tone={attempt.passed ? 'success' : 'primary'}
        />
      </section>

      <section className="card stack" aria-labelledby="score-domain">
        <h2 id="score-domain" className="card__title">
          Score by domain
        </h2>
        {domainRows.map((row) => (
          <div key={row.domainId} className="stack-sm">
            <div className="meter-row">
              <span>
                {row.domain?.shortTitle ?? row.domainId}
                {row.domain?.examWeight !== null && row.domain
                  ? ` · ${row.domain.examWeight}% of the exam`
                  : ''}
              </span>
              <span className="meter-row__value">
                {row.percent}% ({row.earned}/{row.total})
              </span>
            </div>
            <ProgressBar
              value={row.percent}
              tone={row.percent >= attempt.passingScore ? 'success' : 'primary'}
            />
          </div>
        ))}
        {weakest && weakest.percent < 100 && (
          <p className="subtle" style={{ marginBottom: 0 }}>
            Weakest domain: <strong>{weakest.domain?.shortTitle ?? weakest.domainId}</strong> at{' '}
            {weakest.percent}%.{' '}
            <Link to={`${ckadCourse.route}/practice/${weakest.domainId}`}>Drill that domain →</Link>
          </p>
        )}
      </section>

      <section className="stack" aria-labelledby="answers">
        <div className="row">
          <h2 id="answers" style={{ flex: '1 1 auto' }}>
            Answers and explanations
          </h2>
          <div className="chip-row">
            <button
              type="button"
              className="chip"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All ({answers.length})
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={filter === 'incorrect'}
              onClick={() => setFilter('incorrect')}
            >
              Not full marks ({answers.filter((a) => a.earned < a.total).length})
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={filter === 'unverified'}
              onClick={() => setFilter('unverified')}
            >
              Needs verification ({unverified.length})
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="Nothing to show with this filter"
            description="Switch back to All to see every question."
          />
        ) : (
          <div className="stack">
            {visible.map((answer) => {
              const question = questionById.get(answer.questionId)
              if (!question) return null
              const originalIndex = answers.findIndex((a) => a.questionId === answer.questionId)
              return (
                <div key={answer.questionId} className="stack-sm">
                  <QuestionView
                    question={question}
                    response={answer.response}
                    onChange={(next) => updateTaskResponse(answer, next)}
                    revealed
                    grade={{ correct: answer.correct, earned: answer.earned, total: answer.total }}
                    index={originalIndex + 1}
                    total={answers.length}
                  />
                  <Link className="subtle" to={`${ckadCourse.route}/topics/${question.topicId}`}>
                    Read the lesson for this question →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="lesson-nav">
        <Link className="btn btn--secondary" to={`${ckadCourse.route}/exams`}>
          ← All attempts
        </Link>
        <Link className="btn" to={`${ckadCourse.route}/exams`}>
          Take another exam →
        </Link>
      </div>
    </div>
  )
}
