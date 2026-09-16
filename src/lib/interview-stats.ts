import type { InterviewLevel, InterviewTopic } from '../content/types'
import type { ProgressState } from './storage'

export interface InterviewCounts {
  total: number
  known: number
  review: number
  /** Neither marked known nor flagged for review. */
  untouched: number
  percent: number
}

/** Self-assessed coverage for one set of questions. */
export function countInterview(topics: InterviewTopic[], state: ProgressState): InterviewCounts {
  let total = 0
  let known = 0
  let review = 0

  for (const topic of topics) {
    for (const question of topic.questions) {
      total += 1
      const status = state.interview[question.id]?.status
      if (status === 'known') known += 1
      else if (status === 'review') review += 1
    }
  }

  return {
    total,
    known,
    review,
    untouched: total - known - review,
    // Only "known" counts towards the bar: flagging something for review is
    // progress in understanding but not in readiness.
    percent: total === 0 ? 0 : Math.round((known / total) * 100),
  }
}

export const levelLabel: Record<InterviewLevel, string> = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Senior',
}

/** How many questions of each level a topic holds. */
export function levelBreakdown(topic: InterviewTopic): Record<InterviewLevel, number> {
  const counts: Record<InterviewLevel, number> = { basic: 0, intermediate: 0, advanced: 0 }
  for (const question of topic.questions) counts[question.level] += 1
  return counts
}

/**
 * The next topic worth opening: the one with the most unanswered questions,
 * so the suggestion moves on as the learner works through the bank.
 */
export function suggestTopic(
  topics: InterviewTopic[],
  state: ProgressState,
): InterviewTopic | undefined {
  return [...topics]
    .map((topic) => ({ topic, counts: countInterview([topic], state) }))
    .filter((entry) => entry.counts.untouched > 0)
    .sort((a, b) => b.counts.untouched - a.counts.untouched || a.topic.order - b.topic.order)[0]
    ?.topic
}
