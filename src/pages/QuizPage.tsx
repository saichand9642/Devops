import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ckadCourse } from '../content/courses'
import { domainById } from '../content/ckad/domains'
import { questionById, questionsForDomain } from '../content/ckad/questions'
import type { Question } from '../content/types'
import { useProgress } from '../lib/use-progress'
import { gradeQuestion } from '../lib/scoring'
import type { GradeResult } from '../lib/scoring'
import { QuestionView } from '../components/QuestionView'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/StateBlock'
import { ProgressBar } from '../components/ui/ProgressBar'

/**
 * Untimed practice runner.
 *
 * The route id is either a domain id or the literal `review`, which drills
 * every question whose most recent attempt was wrong.
 */
export function QuizPage() {
  const { domainId } = useParams<{ domainId: string }>()
  const [params] = useSearchParams()
  const { state, recordAnswer, clearAnswer } = useProgress()

  const isReview = domainId === 'review'
  const domain = domainId ? domainById.get(domainId) : undefined

  const questions = useMemo<Question[]>(() => {
    if (isReview) {
      return Object.entries(state.questions)
        .filter(([, record]) => !record.lastCorrect)
        .map(([id]) => questionById.get(id))
        .filter((question): question is Question => Boolean(question))
    }
    return domainId ? questionsForDomain(domainId) : []
    // The review list is captured when the drill starts so answering a
    // question does not remove it from under the learner mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId, isReview])

  const initialIndex = useMemo(() => {
    const wanted = params.get('q')
    if (!wanted) return 0
    const found = questions.findIndex((question) => question.id === wanted)
    return found >= 0 ? found : 0
  }, [params, questions])

  const [index, setIndex] = useState(initialIndex)
  const [responses, setResponses] = useState<Record<string, string[]>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [grades, setGrades] = useState<Record<string, GradeResult>>({})

  if (!isReview && !domain) {
    return (
      <div className="page stack">
        <header className="page-header">
          <h1>Unknown practice set</h1>
        </header>
        <EmptyState
          icon="🎯"
          title="That practice set does not exist"
          description="Pick a domain from the practice hub instead."
          action={
            <Link className="btn" to={`${ckadCourse.route}/practice`}>
              Back to practice
            </Link>
          }
        />
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="page stack-lg">
        <header className="page-header">
          <h1>{isReview ? 'Retry incorrect questions' : `Practise: ${domain?.shortTitle}`}</h1>
        </header>
        <EmptyState
          icon={isReview ? '🎉' : '📭'}
          title={isReview ? 'Nothing to retry' : 'No questions in this set yet'}
          description={
            isReview
              ? 'Every question you have answered was correct on your most recent attempt.'
              : 'This domain has no questions yet.'
          }
          action={
            <Link className="btn" to={`${ckadCourse.route}/practice`}>
              Back to practice
            </Link>
          }
        />
      </div>
    )
  }

  const current = questions[Math.min(index, questions.length - 1)]
  const response = responses[current.id] ?? []
  const isRevealed = revealed[current.id] === true
  const grade = grades[current.id]
  const answeredCount = Object.keys(revealed).length

  const canReveal =
    current.kind === 'task' ||
    (current.kind === 'command' ? (response[0] ?? '').trim().length > 0 : response.length > 0)

  const reveal = () => {
    const result = gradeQuestion(current, response)
    setGrades((previous) => ({ ...previous, [current.id]: result }))
    setRevealed((previous) => ({ ...previous, [current.id]: true }))
    // Task questions are self-verified after reveal, so their result is
    // recorded when the learner confirms checkpoints, not now.
    if (result.correct !== null) recordAnswer(current.id, result.correct)
  }

  const updateResponse = (next: string[]) => {
    setResponses((previous) => ({ ...previous, [current.id]: next }))
    if (isRevealed && current.kind === 'task') {
      const result = gradeQuestion(current, next)
      setGrades((previous) => ({ ...previous, [current.id]: result }))
      recordAnswer(current.id, result.correct === true)
    }
  }

  const go = (nextIndex: number) => {
    setIndex(Math.max(0, Math.min(questions.length - 1, nextIndex)))
    window.scrollTo({ top: 0 })
  }

  const record = state.questions[current.id]

  return (
    <div className="page stack">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to={ckadCourse.route}>CKAD</Link>
          <span aria-hidden="true">/</span>
          <Link to={`${ckadCourse.route}/practice`}>Practice</Link>
          <span aria-hidden="true">/</span>
          <span>{isReview ? 'Retry incorrect' : (domain?.shortTitle ?? '')}</span>
        </nav>
        <h1>{isReview ? 'Retry incorrect questions' : `Practise: ${domain?.title}`}</h1>
        {!isReview && domain?.examWeight !== null && domain && (
          <p className="muted">
            {domain.examWeight}% of the exam · {questions.length} questions · answers reveal
            immediately
          </p>
        )}
      </header>

      <div className="quiz-toolbar">
        <span className="subtle">
          {answeredCount} of {questions.length} attempted
        </span>
        <span className="top-bar__spacer" />
        {record && (
          <Badge tone={record.lastCorrect ? 'success' : 'danger'}>
            Last attempt: {record.lastCorrect ? 'correct' : 'incorrect'}
          </Badge>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setResponses((previous) => ({ ...previous, [current.id]: [] }))
            setRevealed((previous) => {
              const next = { ...previous }
              delete next[current.id]
              return next
            })
            setGrades((previous) => {
              const next = { ...previous }
              delete next[current.id]
              return next
            })
            clearAnswer(current.id)
          }}
        >
          Reset this question
        </button>
      </div>

      <ProgressBar value={(answeredCount / questions.length) * 100} />

      <ol className="question-dots" aria-label="Question navigation">
        {questions.map((question, dotIndex) => {
          const dotGrade = grades[question.id]
          const className = [
            'question-dot',
            dotIndex === index ? 'question-dot--current' : '',
            revealed[question.id] && dotGrade?.correct === true ? 'question-dot--correct' : '',
            revealed[question.id] && dotGrade?.correct === false ? 'question-dot--incorrect' : '',
            !revealed[question.id] && (responses[question.id]?.length ?? 0) > 0
              ? 'question-dot--answered'
              : '',
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
        response={response}
        onChange={updateResponse}
        revealed={isRevealed}
        grade={grade}
        index={index + 1}
        total={questions.length}
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
        {!isRevealed ? (
          <button type="button" className="btn" onClick={reveal} disabled={!canReveal}>
            {current.kind === 'task' ? 'Show solution and checkpoints' : 'Check answer'}
          </button>
        ) : index < questions.length - 1 ? (
          <button type="button" className="btn" onClick={() => go(index + 1)}>
            Next question →
          </button>
        ) : (
          <Link className="btn" to={`${ckadCourse.route}/practice`}>
            Finish set →
          </Link>
        )}
      </div>

      <Link
        className="subtle"
        to={`${ckadCourse.route}/topics/${current.topicId}`}
        style={{ display: 'inline-block' }}
      >
        Read the lesson for this question →
      </Link>
    </div>
  )
}
