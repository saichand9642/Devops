import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ckadCourse } from '../content/courses'
import { topicById } from '../content/ckad/topics'
import { domainById } from '../content/ckad/domains'
import { questionsForTopic } from '../content/ckad/questions'
import { useProgress } from '../lib/use-progress'
import { difficultyLabel, topicStatus } from '../lib/stats'
import { Collapsible, Reveal } from '../components/ui/Collapsible'
import { CodeBlock } from '../components/ui/CodeBlock'
import { CommandList } from '../components/ui/CommandList'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/StateBlock'
import { RichBlock, RichList, RichParagraphs, RichText } from '../components/ui/RichText'

export function TopicPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const { state, markTopicVisited, toggleTopicCompleted } = useProgress()
  const topic = topicId ? topicById.get(topicId) : undefined

  // Record the visit once per topic so "Continue learning" and the in-progress
  // state work, and so the study streak counts today.
  useEffect(() => {
    if (topic) markTopicVisited(topic.id)
  }, [topic, markTopicVisited])

  const ordered = useMemo(
    () =>
      [...ckadCourse.topics].sort((a, b) => {
        const domainA = domainById.get(a.domainId)?.order ?? 99
        const domainB = domainById.get(b.domainId)?.order ?? 99
        return domainA - domainB || a.order - b.order
      }),
    [],
  )

  if (!topic) {
    return (
      <div className="page stack">
        <header className="page-header">
          <h1>Lesson not found</h1>
        </header>
        <EmptyState
          icon="🔍"
          title="That lesson id does not exist"
          description="It may have been renamed. Use search or the CKAD dashboard to find it."
          action={
            <Link className="btn" to={ckadCourse.route}>
              Back to the CKAD dashboard
            </Link>
          }
        />
      </div>
    )
  }

  const domain = domainById.get(topic.domainId)
  const status = topicStatus(state, topic.id)
  const isComplete = status === 'completed'
  const index = ordered.findIndex((candidate) => candidate.id === topic.id)
  const previous = index > 0 ? ordered[index - 1] : undefined
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined
  const related = (topic.relatedTopicIds ?? [])
    .map((id) => topicById.get(id))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
  const quizQuestions = questionsForTopic(topic.id)

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to={ckadCourse.route}>CKAD</Link>
          <span aria-hidden="true">/</span>
          <a href={`${ckadCourse.route}#domain-${topic.domainId}`}>
            {domain?.shortTitle ?? topic.domainId}
          </a>
        </nav>
        <h1>{topic.title}</h1>
        <p className="muted">
          <RichText text={topic.oneLiner} />
        </p>
        <div className="page-header__meta">
          {domain && (
            <Badge tone="info">
              {domain.shortTitle}
              {domain.examWeight !== null ? ` · ${domain.examWeight}%` : ''}
            </Badge>
          )}
          <Badge>{difficultyLabel[topic.difficulty]}</Badge>
          <Badge>{topic.estimatedMinutes} min</Badge>
          {isComplete && <Badge tone="success">Completed</Badge>}
          {status === 'in-progress' && <Badge tone="warning">In progress</Badge>}
        </div>
      </header>

      <div className="row">
        <button
          type="button"
          className={isComplete ? 'btn btn--secondary' : 'btn'}
          onClick={() => toggleTopicCompleted(topic.id)}
          aria-pressed={isComplete}
        >
          {isComplete ? '✓ Completed — mark as not done' : 'Mark as completed'}
        </button>
        {quizQuestions.length > 0 && (
          <Link
            className="btn btn--secondary"
            to={`${ckadCourse.route}/practice/${topic.domainId}`}
          >
            Practise this domain ({quizQuestions.length} questions on this topic)
          </Link>
        )}
      </div>

      <section className="lesson-hero stack" aria-labelledby="explanation">
        <h2 id="explanation" className="card__title">
          What this is, in plain language
        </h2>
        <RichParagraphs items={topic.explanation} />
      </section>

      <div>
        <Collapsible title="Why you need this" icon="🎯" defaultOpen>
          <RichList items={topic.whyItMatters} />
        </Collapsible>

        <Collapsible title="How it works" icon="⚙️" defaultOpen>
          <RichList items={topic.howItWorks} />
        </Collapsible>

        <Collapsible
          id="key-objects"
          title="Important objects and fields"
          icon="🧱"
          count={`${topic.keyObjects.length} object${topic.keyObjects.length === 1 ? '' : 's'}`}
        >
          {topic.keyObjects.map((object) => (
            <div
              className="stack-sm"
              key={`${object.kind}-${object.apiVersion}`}
              style={{ marginBottom: '1.25rem' }}
            >
              <div className="row">
                <strong>{object.kind}</strong>
                <Badge>{object.apiVersion}</Badge>
              </div>
              <p className="muted" style={{ marginBottom: '0.35rem' }}>
                <RichText text={object.purpose} />
              </p>
              <div className="table-scroll">
                <table className="fields-table">
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">What it does</th>
                    </tr>
                  </thead>
                  <tbody>
                    {object.fields.map((field) => (
                      <tr key={field.path}>
                        <td>
                          {field.path}
                          {field.required && (
                            <>
                              {' '}
                              <Badge tone="warning">required</Badge>
                            </>
                          )}
                        </td>
                        <td>
                          <RichText text={field.meaning} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Collapsible>

        <Collapsible title="Real-world example" icon="🏭">
          <h3 style={{ marginTop: 0 }}>{topic.realWorldExample.title}</h3>
          <RichParagraphs items={topic.realWorldExample.story} />
          {topic.realWorldExample.code?.map((sample) => (
            <CodeBlock
              key={sample.title}
              code={sample.code}
              language={sample.language}
              title={sample.title}
              explanation={sample.explanation}
              placeholders={sample.placeholders}
            />
          ))}
        </Collapsible>

        <Collapsible
          title="YAML examples"
          icon="📄"
          count={`${topic.yamlExamples.length} example${topic.yamlExamples.length === 1 ? '' : 's'}`}
          defaultOpen
        >
          {topic.yamlExamples.map((sample) => (
            <CodeBlock
              key={sample.title}
              code={sample.code}
              language={sample.language}
              title={sample.title}
              explanation={sample.explanation}
              placeholders={sample.placeholders}
            />
          ))}
        </Collapsible>

        <Collapsible
          title="Imperative commands"
          icon="⌨️"
          count={`${topic.imperative.length} command${topic.imperative.length === 1 ? '' : 's'}`}
        >
          <CommandList commands={topic.imperative} />
        </Collapsible>

        <Collapsible title="Declarative method" icon="📝">
          <ol>
            {topic.declarative.steps.map((step, stepIndex) => (
              <li key={stepIndex}>
                <RichText text={step} />
              </li>
            ))}
          </ol>
          {topic.declarative.code.map((sample) => (
            <CodeBlock
              key={sample.title}
              code={sample.code}
              language={sample.language}
              title={sample.title}
              explanation={sample.explanation}
              placeholders={sample.placeholders}
            />
          ))}
        </Collapsible>

        <Collapsible title="Verification commands" icon="✅" count={`${topic.verification.length}`}>
          <CommandList commands={topic.verification} />
        </Collapsible>

        <Collapsible
          title="Troubleshooting commands"
          icon="🔧"
          count={`${topic.troubleshooting.length}`}
        >
          <CommandList commands={topic.troubleshooting} />
        </Collapsible>

        <Collapsible title="Common mistakes" icon="⚠️" count={`${topic.commonMistakes.length}`}>
          <RichList items={topic.commonMistakes} />
        </Collapsible>

        <Collapsible
          title="CKAD exam tips"
          icon="🎓"
          count={`${topic.examTips.length}`}
          defaultOpen
        >
          <RichList items={topic.examTips} />
        </Collapsible>

        <Collapsible title="Summary" icon="📌" defaultOpen>
          <RichList items={topic.summary} />
        </Collapsible>

        <Collapsible
          title="Practice questions"
          icon="❓"
          count={`${topic.practice.length} question${topic.practice.length === 1 ? '' : 's'}`}
          defaultOpen
        >
          {topic.practice.map((question) => (
            <div className="practice-item" key={question.id}>
              <div className="row" style={{ marginBottom: '0.5rem' }}>
                <Badge>{difficultyLabel[question.level]}</Badge>
              </div>
              <p style={{ fontWeight: 600 }}>
                <RichText text={question.prompt} />
              </p>
              {question.code && (
                <CodeBlock
                  code={question.code.code}
                  language={question.code.language}
                  title={question.code.title}
                />
              )}
              <Reveal label="Show answer">
                <div className="answer-block">
                  <RichBlock text={question.answer} />
                </div>
                {question.explanation && <RichBlock text={question.explanation} />}
              </Reveal>
            </div>
          ))}
        </Collapsible>

        <Collapsible title="Hands-on lab" icon="🧪" defaultOpen>
          <h3 style={{ marginTop: 0 }}>{topic.lab.title}</h3>
          <p>
            <RichText text={topic.lab.scenario} />
          </p>

          {topic.lab.prerequisites && topic.lab.prerequisites.length > 0 && (
            <>
              <h4>Prerequisites</h4>
              <RichList items={topic.lab.prerequisites} />
            </>
          )}

          <h4>Tasks</h4>
          <ol>
            {topic.lab.tasks.map((task, taskIndex) => (
              <li key={taskIndex}>
                <RichText text={task.instruction} />
                {task.hint && (
                  <>
                    {' '}
                    <span className="subtle">
                      Hint: <RichText text={task.hint} />
                    </span>
                  </>
                )}
              </li>
            ))}
          </ol>

          <Reveal label="Show lab solution" tone="solution">
            {topic.lab.solution.map((sample) => (
              <CodeBlock
                key={sample.title}
                code={sample.code}
                language={sample.language}
                title={sample.title}
                explanation={sample.explanation}
                placeholders={sample.placeholders}
              />
            ))}
            <h4>Verification</h4>
            <CommandList commands={topic.lab.verification} />
            {topic.lab.cleanup && topic.lab.cleanup.length > 0 && (
              <>
                <h4>Cleanup</h4>
                <CommandList commands={topic.lab.cleanup} />
              </>
            )}
          </Reveal>
        </Collapsible>

        {topic.docs && topic.docs.length > 0 && (
          <Collapsible title="Official documentation" icon="🔗">
            <ul>
              {topic.docs.map((doc) => (
                <li key={doc.url}>
                  <a href={doc.url} target="_blank" rel="noreferrer noopener">
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          </Collapsible>
        )}
      </div>

      {related.length > 0 && (
        <section className="stack" aria-labelledby="related">
          <h2 id="related">Related lessons</h2>
          <ul className="topic-list">
            {related.map((candidate) => (
              <li key={candidate.id}>
                <Link className="topic-row" to={`${ckadCourse.route}/topics/${candidate.id}`}>
                  <span className="topic-row__status" aria-hidden="true">
                    🔗
                  </span>
                  <span className="topic-row__body">
                    <span className="topic-row__title">{candidate.title}</span>
                    <span className="topic-row__meta">{candidate.oneLiner}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="lesson-nav" aria-label="Lesson navigation">
        {previous ? (
          <Link className="btn btn--secondary" to={`${ckadCourse.route}/topics/${previous.id}`}>
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="btn" to={`${ckadCourse.route}/topics/${next.id}`}>
            {next.title} →
          </Link>
        ) : (
          <Link className="btn" to={`${ckadCourse.route}/exams`}>
            Last lesson — try a mock exam →
          </Link>
        )}
      </nav>
    </div>
  )
}
