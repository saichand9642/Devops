import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { interviewTopicById, interviewTopics } from '../content/interview'
import type { InterviewLevel, InterviewQuestionKind } from '../content/types'
import { useProgress } from '../lib/use-progress'
import { countInterview, levelLabel } from '../lib/interview-stats'
import { InterviewQuestionCard } from '../components/InterviewQuestionCard'
import { Collapsible } from '../components/ui/Collapsible'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/StateBlock'
import { RichList, RichText } from '../components/ui/RichText'

type LevelFilter = InterviewLevel | 'all'
type KindFilter = InterviewQuestionKind | 'all'
type StatusFilter = 'all' | 'untouched' | 'known' | 'review'

const levelFilters: { id: LevelFilter; label: string }[] = [
  { id: 'all', label: 'All levels' },
  { id: 'basic', label: 'Basic' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Senior' },
]

const kindFilters: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'open', label: 'Open' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'mcq', label: 'Multiple choice' },
  { id: 'multi', label: 'Select all' },
]

const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'untouched', label: 'Not yet marked' },
  { id: 'review', label: 'Needs review' },
  { id: 'known', label: 'Known' },
]

export function InterviewTopicPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const { state, setInterviewStatus } = useProgress()
  const topic = topicId ? interviewTopicById.get(topicId) : undefined

  const [level, setLevel] = useState<LevelFilter>('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')

  const visible = useMemo(() => {
    if (!topic) return []
    return topic.questions.filter((question) => {
      if (level !== 'all' && question.level !== level) return false
      if (kind !== 'all' && question.kind !== kind) return false
      if (status === 'all') return true
      const current = state.interview[question.id]?.status
      if (status === 'untouched') return current === undefined
      return current === status
    })
  }, [topic, level, kind, status, state.interview])

  if (!topic) {
    return (
      <div className="page stack">
        <header className="page-header">
          <h1>Topic not found</h1>
        </header>
        <EmptyState
          icon="🧭"
          title="No such interview topic"
          description="The address does not match any topic in this app."
        />
        <div className="button-row">
          <Link className="btn" to="/interview">
            All interview topics
          </Link>
        </div>
      </div>
    )
  }

  const counts = countInterview([topic], state)
  const position = interviewTopics.findIndex((candidate) => candidate.id === topic.id)
  const previous = interviewTopics[position - 1]
  const next = interviewTopics[position + 1]

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/interview">Interview prep</Link>
          <span aria-hidden="true">/</span>
          <span>{topic.shortTitle}</span>
        </nav>
        <h1>
          <span aria-hidden="true">{topic.icon} </span>
          {topic.title}
        </h1>
        <p className="muted">
          <RichText text={topic.oneLiner} />
        </p>
        <div className="page-header__meta">
          <Badge>{counts.total} questions</Badge>
          <Badge tone="success">{counts.known} known</Badge>
          {counts.review > 0 && <Badge tone="warning">{counts.review} to review</Badge>}
        </div>
        <ProgressBar value={counts.percent} showValue />
      </header>

      <Collapsible title="Revise these first" icon="⚡" defaultOpen>
        <RichList items={topic.headlines} />
      </Collapsible>

      <section className="stack-sm" aria-label="Filters">
        <div className="filter-bar" role="group" aria-label="Filter by level">
          {levelFilters.map((option) => (
            <button
              key={option.id}
              type="button"
              className="chip"
              aria-pressed={level === option.id}
              onClick={() => setLevel(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="filter-bar" role="group" aria-label="Filter by question type">
          {kindFilters.map((option) => (
            <button
              key={option.id}
              type="button"
              className="chip"
              aria-pressed={kind === option.id}
              onClick={() => setKind(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="filter-bar" role="group" aria-label="Filter by your progress">
          {statusFilters.map((option) => (
            <button
              key={option.id}
              type="button"
              className="chip"
              aria-pressed={status === option.id}
              onClick={() => setStatus(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="stack" aria-label="Questions">
        <p className="subtle" style={{ margin: 0 }}>
          Showing {visible.length} of {counts.total} questions.
        </p>

        {visible.length === 0 ? (
          <EmptyState
            icon="🔎"
            title="Nothing matches those filters"
            description="Widen a filter to see more questions."
          />
        ) : (
          <div className="itv-question-list">
            {visible.map((question, index) => (
              <InterviewQuestionCard
                key={question.id}
                question={question}
                index={index + 1}
                status={state.interview[question.id]?.status}
                onStatusChange={(next) => setInterviewStatus(question.id, next)}
              />
            ))}
          </div>
        )}
      </section>

      <nav className="button-row" aria-label="Other topics">
        {previous && (
          <Link className="btn btn--secondary" to={`/interview/${previous.id}`}>
            ← {previous.shortTitle}
          </Link>
        )}
        <Link className="btn btn--secondary" to="/interview">
          All topics
        </Link>
        {next && (
          <Link className="btn" to={`/interview/${next.id}`}>
            {next.shortTitle} →
          </Link>
        )}
      </nav>

      <p className="subtle">
        Levels in this topic: {levelLabel.basic}, {levelLabel.intermediate} and{' '}
        {levelLabel.advanced}. Senior questions assume you can already answer the basics.
      </p>
    </div>
  )
}
