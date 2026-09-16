import { describe, expect, it } from 'vitest'
import { countInterview, levelBreakdown, levelLabel, suggestTopic } from './interview-stats'
import { createEmptyState } from './storage'
import type { ProgressState } from './storage'
import type { InterviewLevel, InterviewQuestion, InterviewTopic } from '../content/types'

const question = (id: string, level: InterviewLevel = 'basic'): InterviewQuestion => ({
  id,
  level,
  kind: 'open',
  prompt: `Question ${id}?`,
  probing: 'Whether they understand the thing.',
  answer: ['Because of the reason.'],
  tags: ['t'],
})

const topic = (id: string, order: number, questions: InterviewQuestion[]): InterviewTopic => ({
  id,
  title: id,
  shortTitle: id,
  icon: '*',
  order,
  oneLiner: 'A topic.',
  headlines: ['a', 'b', 'c'],
  questions,
})

const withStatuses = (entries: Record<string, 'known' | 'review'>): ProgressState => {
  const state = createEmptyState()
  for (const [id, status] of Object.entries(entries)) {
    state.interview[id] = { status, updatedAt: 1 }
  }
  return state
}

describe('countInterview', () => {
  const topics = [topic('a', 1, [question('q1'), question('q2'), question('q3'), question('q4')])]

  it('reports zero on a fresh install without dividing by zero', () => {
    expect(countInterview(topics, createEmptyState())).toEqual({
      total: 4,
      known: 0,
      review: 0,
      untouched: 4,
      percent: 0,
    })
    expect(countInterview([], createEmptyState()).percent).toBe(0)
  })

  it('counts known, review and untouched separately', () => {
    const counts = countInterview(topics, withStatuses({ q1: 'known', q2: 'review' }))
    expect(counts).toEqual({ total: 4, known: 1, review: 1, untouched: 2, percent: 25 })
  })

  it('counts only "known" towards the bar, because review is not readiness', () => {
    const allReview = withStatuses({ q1: 'review', q2: 'review', q3: 'review', q4: 'review' })
    expect(countInterview(topics, allReview).percent).toBe(0)
    expect(countInterview(topics, allReview).untouched).toBe(0)
  })

  it('reaches 100% only when every question is known', () => {
    const almost = withStatuses({ q1: 'known', q2: 'known', q3: 'known', q4: 'review' })
    expect(countInterview(topics, almost).percent).toBe(75)

    const all = withStatuses({ q1: 'known', q2: 'known', q3: 'known', q4: 'known' })
    expect(countInterview(topics, all).percent).toBe(100)
  })

  it('ignores recorded ids that are not in the topics passed in', () => {
    const counts = countInterview(
      topics,
      withStatuses({ q1: 'known', 'from-another-topic': 'known' }),
    )
    expect(counts.known).toBe(1)
    expect(counts.total).toBe(4)
  })

  it('spans every topic it is given', () => {
    const many = [topic('a', 1, [question('q1')]), topic('b', 2, [question('q2'), question('q3')])]
    expect(countInterview(many, withStatuses({ q1: 'known', q3: 'known' })).known).toBe(2)
    expect(countInterview(many, createEmptyState()).total).toBe(3)
  })
})

describe('levelBreakdown', () => {
  it('counts each level and returns zeros for levels not present', () => {
    const counted = levelBreakdown(
      topic('a', 1, [question('q1', 'basic'), question('q2', 'basic'), question('q3', 'advanced')]),
    )
    expect(counted).toEqual({ basic: 2, intermediate: 0, advanced: 1 })
  })

  it('labels advanced as senior, which is what the interview round is called', () => {
    expect(levelLabel.advanced).toBe('Senior')
    expect(levelLabel.basic).toBe('Basic')
    expect(levelLabel.intermediate).toBe('Intermediate')
  })
})

describe('suggestTopic', () => {
  const topics = [
    topic('small', 1, [question('s1')]),
    topic('large', 2, [question('l1'), question('l2'), question('l3')]),
  ]

  it('points at the topic with the most unanswered questions', () => {
    expect(suggestTopic(topics, createEmptyState())?.id).toBe('large')
  })

  it('moves on as questions get answered', () => {
    const worked = withStatuses({ l1: 'known', l2: 'known', l3: 'review' })
    expect(suggestTopic(topics, worked)?.id).toBe('small')
  })

  it('breaks a tie by topic order, so the suggestion is stable', () => {
    const tied = [topic('first', 1, [question('a1')]), topic('second', 2, [question('b1')])]
    expect(suggestTopic(tied, createEmptyState())?.id).toBe('first')
  })

  it('suggests nothing once every question has been assessed', () => {
    const done = withStatuses({ s1: 'known', l1: 'known', l2: 'review', l3: 'known' })
    expect(suggestTopic(topics, done)).toBeUndefined()
    expect(suggestTopic([], createEmptyState())).toBeUndefined()
  })
})
