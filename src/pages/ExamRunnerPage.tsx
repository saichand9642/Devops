import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ckadCourse } from '../content/courses'
import { buildExam } from '../lib/exam-builder'
import { scoreExam } from '../lib/scoring'
import { useProgress } from '../lib/use-progress'
import type { ExamAttempt } from '../lib/storage'
import { QuestionView } from '../components/QuestionView'
import { Timer } from '../components/Timer'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/StateBlock'

/**
 * Timed exam runner.
 *
 * Nothing about correctness is shown until submission, matching the brief.
 * The paper is generated from a seed carried in the URL so a reload does not
 * silently produce a different exam.
 */
export function ExamRunnerPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { saveExamAttempt } = useProgress()

  const minutes = Math.max(
    1,
    Number(params.get('minutes')) || ckadCourse.examBlueprint.defaultMinutes,
  )
  const count = Math.max(1, Number(params.get('count')) || ckadCourse.examBlueprint.questionCount)
  const seed = Number(params.get('seed')) || 1

  const paper = useMemo(() => buildExam(ckadCourse, count, seed), [count, seed])
  // Wall-clock start, fixed for the life of this component instance.
  const startedAt = useRef(Date.now()).current

  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(
    (reason: 'manual' | 'expired') => {
      if (submitting) return
      setSubmitting(true)
      const summary = scoreExam(paper.questions, responses, ckadCourse.examBlueprint.passingScore)
      const attempt: ExamAttempt = {
        id: `attempt-${startedAt}-${seed}`,
        courseId: ckadCourse.id,
        label: `${paper.questions.length}-question paper · ${minutes} min${reason === 'expired' ? ' · time expired' : ''}`,
        startedAt,
        submittedAt: Date.now(),
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
        minutesAllowed: minutes,
        earnedPoints: summary.earnedPoints,
        totalPoints: summary.totalPoints,
        scorePercent: summary.scorePercent,
        passingScore: ckadCourse.examBlueprint.passingScore,
        passed: summary.passed,
        byDomain: summary.byDomain,
        answers: summary.answers,
      }
      saveExamAttempt(attempt)
      navigate(`${ckadCourse.route}/exams/attempts/${attempt.id}`, { replace: true })
    },
    [minutes, navigate, paper.questions, responses, saveExamAttempt, seed, startedAt, submitting],
  )

  const onExpire = useCallback(() => submit('expired'), [submit])

  if (paper.questions.length === 0) {
    return (
      <div className="page stack">
        <header className="page-header">
          <h1>Mock exam</h1>
        </header>
        <EmptyState
          icon="⏱️"
          title="Could not build a paper"
          description="No questions were available for the weighted domains."
          action={
            <Link className="btn" to={`${ckadCourse.route}/exams`}>
              Back to mock exams
            </Link>
          }
        />
      </div>
    )
  }

  const current = paper.questions[index]
  const answeredCount = paper.questions.filter(
    (question) => (responses[question.id]?.length ?? 0) > 0,
  ).length

  const go = (nextIndex: number) => {
    setIndex(Math.max(0, Math.min(paper.questions.length - 1, nextIndex)))
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <h1>Mock exam in progress</h1>
        <p className="muted">
          Answers stay hidden until you submit. You can move freely between questions.
        </p>
      </header>

      <div className="quiz-toolbar">
        <Timer startedAt={startedAt} minutesAllowed={minutes} onExpire={onExpire} />
        <Badge>
          {answeredCount}/{paper.questions.length} answered
        </Badge>
        <span className="top-bar__spacer" />
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            const unanswered = paper.questions.length - answeredCount
            const message =
              unanswered > 0
                ? `Submit now? ${unanswered} question${unanswered === 1 ? '' : 's'} left unanswered.`
                : 'Submit your exam for scoring?'
            if (window.confirm(message)) submit('manual')
          }}
        >
          Submit exam
        </button>
      </div>

      <ol className="question-dots" aria-label="Question navigation">
        {paper.questions.map((question, dotIndex) => {
          const className = [
            'question-dot',
            dotIndex === index ? 'question-dot--current' : '',
            (responses[question.id]?.length ?? 0) > 0 ? 'question-dot--answered' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <li key={question.id}>
              <button
                type="button"
                className={className}
                onClick={() => go(dotIndex)}
                aria-label={`Go to question ${dotIndex + 1}`}
                aria-current={dotIndex === index ? 'true' : undefined}
              >
                {dotIndex + 1}
              </button>
            </li>
          )
        })}
      </ol>

      <QuestionView
        question={current}
        response={responses[current.id] ?? []}
        onChange={(next) => setResponses((previous) => ({ ...previous, [current.id]: next }))}
        revealed={false}
        index={index + 1}
        total={paper.questions.length}
      />

      <div className="lesson-nav">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => go(index - 1)}
          disabled={index === 0}
        >
          ← Previous
        </button>
        {index < paper.questions.length - 1 ? (
          <button type="button" className="btn" onClick={() => go(index + 1)}>
            Next →
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => submit('manual')}>
            Submit exam
          </button>
        )}
      </div>

      <p className="disclaimer">
        Original practice questions written for this app. Not actual CKAD exam content.
      </p>
    </div>
  )
}
