import { useId } from 'react'
import type { Question } from '../content/types'
import type { GradeResult } from '../lib/scoring'
import { CodeBlock } from './ui/CodeBlock'
import { Badge } from './ui/Badge'
import { difficultyLabel } from '../lib/stats'
import { RichBlock, RichText } from './ui/RichText'

const categoryLabel: Record<Question['category'], string> = {
  concept: 'Concept',
  command: 'Command',
  yaml: 'YAML',
  troubleshoot: 'Troubleshooting',
  lab: 'Hands-on lab',
}

interface QuestionViewProps {
  question: Question
  response: string[]
  onChange: (response: string[]) => void
  /** true once the answer is revealed (practice) or the exam is submitted. */
  revealed: boolean
  /** Present once graded; drives the correct/incorrect styling. */
  grade?: GradeResult
  index?: number
  total?: number
}

/**
 * Renders one question in any of its four shapes.
 *
 * The same component is used for practice, for a live exam and for a review
 * screen. `revealed` is the only thing that changes: before it, nothing about
 * correctness is shown; after it, options are marked and the explanation
 * appears. For performance-based `task` questions the checkpoints stay
 * editable after reveal, because that is how the learner self-verifies.
 */
export function QuestionView({
  question,
  response,
  onChange,
  revealed,
  grade,
  index,
  total,
}: QuestionViewProps) {
  const groupName = useId()

  const toggleChoice = (optionId: string) => {
    if (revealed) return
    if (question.kind === 'mcq') {
      onChange([optionId])
      return
    }
    onChange(
      response.includes(optionId)
        ? response.filter((id) => id !== optionId)
        : [...response, optionId],
    )
  }

  const toggleCheckpoint = (checkpointId: string) => {
    onChange(
      response.includes(checkpointId)
        ? response.filter((id) => id !== checkpointId)
        : [...response, checkpointId],
    )
  }

  return (
    <article className="question-card" aria-label={`Question ${index ?? ''}`}>
      <div className="row" style={{ marginBottom: '0.6rem' }}>
        {typeof index === 'number' && typeof total === 'number' && (
          <Badge>
            {index} of {total}
          </Badge>
        )}
        <Badge tone="info">{categoryLabel[question.category]}</Badge>
        <Badge>{difficultyLabel[question.difficulty]}</Badge>
        <Badge>
          {question.points} {question.points === 1 ? 'point' : 'points'}
        </Badge>
        {revealed && grade?.correct === true && <Badge tone="success">✓ Correct</Badge>}
        {revealed && grade?.correct === false && <Badge tone="danger">✗ Incorrect</Badge>}
        {revealed && grade?.correct === null && <Badge tone="warning">Self-verified</Badge>}
      </div>

      <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
        <RichText text={question.prompt} />
      </p>

      {question.kind === 'task' && question.context && (
        <p className="subtle">
          <strong>Context:</strong> <RichText text={question.context} />
        </p>
      )}

      {question.code && (
        <CodeBlock
          code={question.code.code}
          language={question.code.language}
          title={question.code.title}
          explanation={question.code.explanation}
        />
      )}

      {(question.kind === 'mcq' || question.kind === 'multi') && (
        <>
          {question.kind === 'multi' && (
            <p className="subtle">Select all that apply - partial selections score zero.</p>
          )}
          <ul className="option-list">
            {question.options.map((option) => {
              const selected = response.includes(option.id)
              const isCorrect = question.correct.includes(option.id)
              const className = [
                'option',
                selected && !revealed ? 'option--selected' : '',
                revealed && isCorrect ? 'option--correct' : '',
                revealed && selected && !isCorrect ? 'option--incorrect' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <li key={option.id}>
                  <label className={className}>
                    <input
                      type={question.kind === 'mcq' ? 'radio' : 'checkbox'}
                      name={groupName}
                      checked={selected}
                      disabled={revealed}
                      onChange={() => toggleChoice(option.id)}
                    />
                    <span className="option__text">
                      <RichText text={option.text} />
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {question.kind === 'command' && (
        <div className="field" style={{ marginBottom: '0.9rem' }}>
          <label className="field__label" htmlFor={`${groupName}-cmd`}>
            Your command
          </label>
          <input
            id={`${groupName}-cmd`}
            className="answer-input"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={question.answerHint ?? 'kubectl ...'}
            value={response[0] ?? ''}
            disabled={revealed}
            onChange={(event) => onChange([event.target.value])}
          />
          <p className="subtle">
            Whitespace and quote style are ignored, so formatting will not cost you the mark.
          </p>
        </div>
      )}

      {question.kind === 'task' && (
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 0.9rem' }} disabled={!revealed}>
          <legend className="field__label" style={{ padding: 0 }}>
            {revealed
              ? 'Tick each outcome you actually achieved - this is what scores the task'
              : 'Required outcomes (you will confirm these after submitting)'}
          </legend>
          {question.checkpoints.map((checkpoint) => (
            <label className="checkpoint" key={checkpoint.id}>
              <input
                type="checkbox"
                checked={response.includes(checkpoint.id)}
                onChange={() => toggleCheckpoint(checkpoint.id)}
                disabled={!revealed}
              />
              <span>
                <RichText text={checkpoint.text} />
              </span>
            </label>
          ))}
          {revealed && (
            <p className="subtle">
              Performance-based tasks award partial credit: {response.length} of{' '}
              {question.checkpoints.length} outcomes confirmed.
            </p>
          )}
        </fieldset>
      )}

      {revealed && (
        <div className="stack">
          {question.kind === 'command' && (
            <div className="notice notice--info">
              <span className="notice__icon" aria-hidden="true">
                ✓
              </span>
              <div>
                <strong>Accepted answer{question.acceptedAnswers.length > 1 ? 's' : ''}:</strong>
                {question.acceptedAnswers.map((answer) => (
                  <pre
                    key={answer}
                    className="mono"
                    style={{ margin: '0.3rem 0 0', whiteSpace: 'pre-wrap' }}
                  >
                    {answer}
                  </pre>
                ))}
              </div>
            </div>
          )}
          <div className="notice">
            <span className="notice__icon" aria-hidden="true">
              💡
            </span>
            <div>
              <RichBlock text={question.explanation} />
            </div>
          </div>
          {question.kind === 'task' &&
            question.solution.map((sample) => (
              <CodeBlock
                key={sample.title}
                code={sample.code}
                language={sample.language}
                title={sample.title}
                explanation={sample.explanation}
              />
            ))}
        </div>
      )}
    </article>
  )
}
