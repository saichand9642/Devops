import { useState } from 'react'
import type { InterviewQuestion } from '../content/types'
import type { InterviewStatus } from '../lib/storage'
import { levelLabel } from '../lib/interview-stats'
import { Badge } from './ui/Badge'
import type { BadgeTone } from './ui/Badge'
import { CodeBlock } from './ui/CodeBlock'
import { DiagramList } from './ui/Diagram'
import { RichList, RichParagraphs, RichText } from './ui/RichText'

const levelTone: Record<InterviewQuestion['level'], BadgeTone> = {
  basic: 'success',
  intermediate: 'info',
  advanced: 'warning',
}

const kindLabel: Record<InterviewQuestion['kind'], string> = {
  open: 'Open question',
  mcq: 'Multiple choice',
  multi: 'Select all that apply',
  scenario: 'Scenario',
}

/**
 * One interview question, with its answer hidden until asked for.
 *
 * The hiding is the point: reading an answer you have not attempted feels
 * like learning and is not. Choice questions make you commit to an option
 * first; open and scenario questions make you click "Show the answer", which
 * is the moment to have said it out loud.
 */
export function InterviewQuestionCard({
  question,
  index,
  status,
  onStatusChange,
}: {
  question: InterviewQuestion
  index: number
  status: InterviewStatus | undefined
  onStatusChange: (status: InterviewStatus | null) => void
}) {
  const isChoice = question.kind === 'mcq' || question.kind === 'multi'
  const [selected, setSelected] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)

  const correct = question.correct ?? []
  const graded = revealed && isChoice
  const gotItRight =
    graded && selected.length === correct.length && selected.every((id) => correct.includes(id))

  const toggleOption = (optionId: string) => {
    if (revealed) return
    setSelected((previous) =>
      question.kind === 'mcq'
        ? [optionId]
        : previous.includes(optionId)
          ? previous.filter((id) => id !== optionId)
          : [...previous, optionId],
    )
  }

  return (
    <article className="itv-card" aria-labelledby={`${question.id}-prompt`}>
      <header className="itv-card__head">
        <span className="itv-card__number" aria-hidden="true">
          {index}
        </span>
        <div className="itv-card__badges">
          <Badge tone={levelTone[question.level]}>{levelLabel[question.level]}</Badge>
          <Badge>{kindLabel[question.kind]}</Badge>
          {status === 'known' && <Badge tone="success">✓ Known</Badge>}
          {status === 'review' && <Badge tone="warning">↻ Review</Badge>}
        </div>
      </header>

      <h3 className="itv-card__prompt" id={`${question.id}-prompt`}>
        <RichText text={question.prompt} />
      </h3>

      <p className="itv-card__probing">
        <strong>What they are testing:</strong> <RichText text={question.probing} />
      </p>

      {question.promptCode?.map((sample, sampleIndex) => (
        <CodeBlock
          key={`prompt-${sampleIndex}`}
          title={sample.title}
          language={sample.language}
          code={sample.code}
          explanation={sample.explanation}
        />
      ))}

      {isChoice && question.options && (
        <ul className="itv-options">
          {question.options.map((option) => {
            const isSelected = selected.includes(option.id)
            const isCorrect = correct.includes(option.id)
            const state = !revealed
              ? isSelected
                ? 'selected'
                : 'idle'
              : isCorrect
                ? 'correct'
                : isSelected
                  ? 'wrong'
                  : 'idle'
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className={`itv-option itv-option--${state}`}
                  onClick={() => toggleOption(option.id)}
                  aria-pressed={isSelected}
                  disabled={revealed}
                >
                  <span className="itv-option__marker" aria-hidden="true">
                    {revealed ? (isCorrect ? '✓' : isSelected ? '✗' : '') : isSelected ? '●' : '○'}
                  </span>
                  {/*
                    The button is a flex container, so RichText's text nodes
                    and <code> elements would each become a separate flex item
                    and lay out side by side. Wrapping them keeps normal
                    inline flow inside one item.
                  */}
                  <span className="itv-option__text">
                    <RichText text={option.text} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {!revealed && (
        <div className="button-row">
          <button
            type="button"
            className="btn"
            onClick={() => setRevealed(true)}
            disabled={isChoice && selected.length === 0}
          >
            {isChoice ? 'Check my answer' : 'Show the answer'}
          </button>
          {isChoice && selected.length === 0 && (
            <span className="subtle">Pick an option first.</span>
          )}
        </div>
      )}

      {revealed && (
        <div className="itv-card__answer">
          {graded && (
            <p className={`itv-verdict itv-verdict--${gotItRight ? 'right' : 'wrong'}`}>
              {gotItRight ? '✓ Correct.' : '✗ Not quite.'} The answer is{' '}
              {/*
                Rendered through RichText rather than joined into a string:
                option text uses the same `code` convention as the rest of the
                content, and a plain join would print the backticks.
              */}
              {correct.map((id, position) => {
                const text = question.options?.find((option) => option.id === id)?.text ?? id
                return (
                  <span key={id}>
                    {position > 0 && '; '}
                    <RichText text={text} />
                  </span>
                )
              })}
              .
            </p>
          )}

          <h4 className="itv-heading">How to answer</h4>
          <RichParagraphs items={question.answer} />

          {question.code?.map((sample, sampleIndex) => (
            <CodeBlock
              key={sampleIndex}
              title={sample.title}
              language={sample.language}
              code={sample.code}
              explanation={sample.explanation}
            />
          ))}

          {question.diagrams?.length ? <DiagramList diagrams={question.diagrams} /> : null}

          {question.deeper?.length ? (
            <>
              <h4 className="itv-heading">What makes it a senior answer</h4>
              <RichList items={question.deeper} />
            </>
          ) : null}

          {question.traps?.length ? (
            <>
              <h4 className="itv-heading itv-heading--warn">Traps to avoid</h4>
              <RichList items={question.traps} />
            </>
          ) : null}

          {question.followUps?.length ? (
            <>
              <h4 className="itv-heading">Likely follow-ups</h4>
              <RichList items={question.followUps} />
            </>
          ) : null}
        </div>
      )}

      <footer className="itv-card__foot">
        <span className="subtle">Could you answer this out loud?</span>
        <div className="button-row">
          <button
            type="button"
            className={`btn btn--sm ${status === 'known' ? 'btn--success' : 'btn--secondary'}`}
            onClick={() => onStatusChange(status === 'known' ? null : 'known')}
            aria-pressed={status === 'known'}
          >
            ✓ I know this
          </button>
          <button
            type="button"
            className={`btn btn--sm ${status === 'review' ? 'btn--warning' : 'btn--secondary'}`}
            onClick={() => onStatusChange(status === 'review' ? null : 'review')}
            aria-pressed={status === 'review'}
          >
            ↻ Needs review
          </button>
        </div>
      </footer>
    </article>
  )
}
