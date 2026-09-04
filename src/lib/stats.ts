import type { Course, Difficulty, Domain, Topic } from '../content/types'
import type { ProgressState, TopicStatus } from './storage'
import { percent } from './scoring'

export interface CompletionStats {
  total: number
  completed: number
  inProgress: number
  notStarted: number
  percent: number
}

export function topicStatus(state: ProgressState, topicId: string): TopicStatus {
  return state.topics[topicId]?.status ?? 'not-started'
}

export function completionFor(topics: Topic[], state: ProgressState): CompletionStats {
  let completed = 0
  let inProgress = 0
  for (const topic of topics) {
    const status = topicStatus(state, topic.id)
    if (status === 'completed') completed += 1
    else if (status === 'in-progress') inProgress += 1
  }
  return {
    total: topics.length,
    completed,
    inProgress,
    notStarted: topics.length - completed - inProgress,
    percent: percent(completed, topics.length),
  }
}

export interface DomainStats extends CompletionStats {
  domain: Domain
  topics: Topic[]
  estimatedMinutes: number
  remainingMinutes: number
}

export function domainStats(course: Course, state: ProgressState): DomainStats[] {
  return [...course.domains]
    .sort((a, b) => a.order - b.order)
    .map((domain) => {
      const topics = course.topics
        .filter((topic) => topic.domainId === domain.id)
        .sort((a, b) => a.order - b.order)
      const completion = completionFor(topics, state)
      return {
        domain,
        topics,
        ...completion,
        estimatedMinutes: topics.reduce((sum, topic) => sum + topic.estimatedMinutes, 0),
        remainingMinutes: topics
          .filter((topic) => topicStatus(state, topic.id) !== 'completed')
          .reduce((sum, topic) => sum + topic.estimatedMinutes, 0),
      }
    })
}

export interface PracticeStats {
  answered: number
  correct: number
  incorrect: number
  accuracy: number
  /** Question ids whose most recent attempt was wrong. */
  needsReview: string[]
}

export function practiceStats(course: Course, state: ProgressState): PracticeStats {
  const ids = new Set(course.questions.map((question) => question.id))
  let correct = 0
  let incorrect = 0
  const needsReview: string[] = []
  for (const [questionId, record] of Object.entries(state.questions)) {
    if (!ids.has(questionId)) continue
    if (record.lastCorrect) correct += 1
    else {
      incorrect += 1
      needsReview.push(questionId)
    }
  }
  const answered = correct + incorrect
  return { answered, correct, incorrect, accuracy: percent(correct, answered), needsReview }
}

export type ReadinessLevel = 'just-starting' | 'building' | 'consolidating' | 'exam-ready'

export interface Readiness {
  level: ReadinessLevel
  label: string
  /** 0-100 composite indicator, not a predicted exam score. */
  score: number
  headline: string
  signals: { label: string; value: string; met: boolean }[]
  nextAction: string
}

/**
 * Combines three independent signals into a readiness indicator:
 * lesson coverage, practice accuracy, and the best recent mock-exam score.
 *
 * Deliberately conservative: you cannot look ready without having sat a full
 * mock exam, because time pressure is the part of CKAD that catches people out.
 */
export function readinessFor(course: Course, state: ProgressState): Readiness {
  const weighted = course.topics.filter((topic) => {
    const domain = course.domains.find((candidate) => candidate.id === topic.domainId)
    return domain?.examWeight !== null
  })
  const coverage = completionFor(weighted.length > 0 ? weighted : course.topics, state)
  const practice = practiceStats(course, state)
  const attempts = state.exams.filter((attempt) => attempt.courseId === course.id)
  const bestMock = attempts.reduce((best, attempt) => Math.max(best, attempt.scorePercent), 0)
  const fullLengthAttempts = attempts.filter(
    (attempt) => attempt.minutesAllowed >= course.examBlueprint.defaultMinutes,
  )

  const score = Math.round(
    coverage.percent * 0.45 +
      Math.min(practice.accuracy, 100) *
        0.2 *
        (practice.answered >= 25 ? 1 : practice.answered / 25) +
      bestMock * 0.35,
  )

  const signals = [
    {
      label: 'Weighted-domain lessons completed',
      value: `${coverage.completed}/${coverage.total} (${coverage.percent}%)`,
      met: coverage.percent >= 90,
    },
    {
      label: 'Practice questions answered',
      value: `${practice.answered} answered, ${practice.accuracy}% correct`,
      met: practice.answered >= 60 && practice.accuracy >= 80,
    },
    {
      label: 'Best mock exam score',
      value: attempts.length === 0 ? 'No attempts yet' : `${bestMock}%`,
      met: bestMock >= course.examBlueprint.passingScore + 14,
    },
    {
      label: 'Full-length timed attempt',
      value:
        fullLengthAttempts.length === 0
          ? 'Not attempted'
          : `${fullLengthAttempts.length} completed`,
      met: fullLengthAttempts.length >= 1,
    },
  ]

  const metCount = signals.filter((signal) => signal.met).length

  // "Just starting" should mean genuinely nothing done, so it is measured
  // against ALL lessons - completing the unweighted Foundations section is
  // real progress even though it contributes no exam weight.
  const anyLessonDone = completionFor(course.topics, state).completed > 0

  if (!anyLessonDone && practice.answered === 0) {
    return {
      level: 'just-starting',
      label: 'Just starting',
      score,
      headline: 'Nothing completed yet - start with the Foundations path.',
      signals,
      nextAction: 'Open the first Foundations lesson and mark it complete when you can explain it.',
    }
  }
  if (metCount >= 4) {
    return {
      level: 'exam-ready',
      label: 'Exam ready',
      score,
      headline: `All readiness signals met. You are consistently clearing the ${course.examBlueprint.passingScore}% pass mark with room to spare.`,
      signals,
      nextAction:
        'Do a final timed mock, then re-read the Exam Technique checklist the day before.',
    }
  }
  if (metCount >= 2) {
    return {
      level: 'consolidating',
      label: 'Consolidating',
      score,
      headline: 'Good coverage. Now convert knowledge into speed under a timer.',
      signals,
      nextAction:
        fullLengthAttempts.length === 0
          ? 'Sit a full-length timed mock exam - it is the signal you are missing.'
          : 'Retry the questions you got wrong, then repeat a timed mock exam.',
    }
  }
  return {
    level: 'building',
    label: 'Building knowledge',
    score,
    headline: 'You are moving. Keep completing lessons before you chase mock-exam scores.',
    signals,
    nextAction: 'Finish the domain you are furthest through, then drill its practice questions.',
  }
}

/** Whole-course completion including the unweighted study sections. */
export function courseCompletion(course: Course, state: ProgressState): CompletionStats {
  return completionFor(course.topics, state)
}

export interface DailySuggestion {
  topic: Topic | null
  reason: string
  minutes: number
  drillDomainId: string | null
  drillLabel: string
}

/**
 * Picks today's suggestion: continue an unfinished lesson, otherwise start the
 * next one in curriculum order, otherwise send the learner to review.
 */
export function dailySuggestion(course: Course, state: ProgressState): DailySuggestion {
  const ordered = [...course.topics].sort((a, b) => {
    const domainA = course.domains.find((domain) => domain.id === a.domainId)?.order ?? 99
    const domainB = course.domains.find((domain) => domain.id === b.domainId)?.order ?? 99
    return domainA - domainB || a.order - b.order
  })

  const inProgress = ordered.find((topic) => topicStatus(state, topic.id) === 'in-progress')
  const notStarted = ordered.find((topic) => topicStatus(state, topic.id) === 'not-started')
  const practice = practiceStats(course, state)

  const weakestDomain = domainStats(course, state)
    .filter((entry) => entry.domain.examWeight !== null && entry.percent < 100)
    .sort((a, b) => a.percent - b.percent)[0]

  if (inProgress) {
    return {
      topic: inProgress,
      reason: 'You opened this lesson but have not marked it complete yet.',
      minutes: inProgress.estimatedMinutes,
      drillDomainId: inProgress.domainId,
      drillLabel: `Drill ${course.domains.find((d) => d.id === inProgress.domainId)?.shortTitle ?? 'this domain'}`,
    }
  }
  if (notStarted) {
    return {
      topic: notStarted,
      reason: 'Next lesson in the beginner-to-exam-ready path.',
      minutes: notStarted.estimatedMinutes,
      drillDomainId: weakestDomain?.domain.id ?? notStarted.domainId,
      drillLabel: `Drill ${weakestDomain?.domain.shortTitle ?? 'the next domain'}`,
    }
  }
  return {
    topic: null,
    reason:
      practice.needsReview.length > 0
        ? `Every lesson is complete. ${practice.needsReview.length} practice question(s) are still marked incorrect.`
        : 'Every lesson is complete. Keep the timer pressure up with a full mock exam.',
    minutes: 30,
    drillDomainId: null,
    drillLabel: 'Retry incorrect questions',
  }
}

/** Consecutive days up to today on which at least one lesson was opened. */
export function studyStreak(state: ProgressState, today = new Date()): number {
  if (state.studyDays.length === 0) return 0
  const days = new Set(state.studyDays)
  const cursor = new Date(today)
  let streak = 0
  // Allow the streak to survive until the end of today: if nothing has been
  // studied today yet but yesterday counts, the streak is still alive.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export const difficultyOrder: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
}

export const difficultyLabel: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Exam level',
}
