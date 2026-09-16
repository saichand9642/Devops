import { Link } from 'react-router-dom'
import { allInterviewQuestions, interviewTopics } from '../content/interview'
import { useProgress } from '../lib/use-progress'
import { countInterview } from '../lib/interview-stats'
import { InterviewQuestionCard } from '../components/InterviewQuestionCard'
import { EmptyState } from '../components/ui/StateBlock'
import { Badge } from '../components/ui/Badge'

/**
 * Everything flagged "needs review", across every topic.
 *
 * This is the page to open the night before an interview: it is the list you
 * built yourself of the things you could not say out loud.
 */
export function InterviewReviewPage() {
  const { state, setInterviewStatus } = useProgress()
  const overall = countInterview(interviewTopics, state)

  const queue = allInterviewQuestions.filter(
    (entry) => state.interview[entry.question.id]?.status === 'review',
  )

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/interview">Interview prep</Link>
          <span aria-hidden="true">/</span>
          <span>Revision queue</span>
        </nav>
        <h1>Revision queue</h1>
        <p className="muted">
          Every question you flagged as needing review, from every topic. Clear one by marking it
          known once you can answer it without reading.
        </p>
        <div className="page-header__meta">
          <Badge tone="warning">{queue.length} to review</Badge>
          <Badge tone="success">{overall.known} known</Badge>
        </div>
      </header>

      {queue.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Nothing flagged for review"
          description="Flag a question with “Needs review” while working through a topic and it will collect here."
          action={
            <Link className="btn" to="/interview">
              Browse topics
            </Link>
          }
        />
      ) : (
        <div className="itv-question-list">
          {queue.map((entry, index) => (
            <div key={entry.question.id} className="stack-sm">
              <p className="subtle" style={{ margin: 0 }}>
                <span aria-hidden="true">{entry.topic.icon} </span>
                <Link to={`/interview/${entry.topic.id}`}>{entry.topic.title}</Link>
              </p>
              <InterviewQuestionCard
                question={entry.question}
                index={index + 1}
                status={state.interview[entry.question.id]?.status}
                onStatusChange={(next) => setInterviewStatus(entry.question.id, next)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
