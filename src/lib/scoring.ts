import type { Question } from '../content/types'
import type { ExamAnswerRecord } from './storage'

/**
 * Normalises a typed command so learners are not marked wrong for formatting.
 *
 * Collapses whitespace, unifies quote characters, drops a trailing semicolon
 * and lowercases, because `kubectl` sub-commands and flags are lowercase
 * anyway. Resource names stay case-sensitive in spirit but CKAD answers are
 * lowercase by convention, so this is safe and much friendlier.
 */
export function normalizeCommand(input: string): string {
  return input
    .replace(/[‘’“”]/g, "'")
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s*=\s*/g, '=')
    .replace(/;+\s*$/, '')
    .trim()
    .toLowerCase()
}

/** True when the two commands match after normalisation. */
export function commandsMatch(given: string, accepted: string): boolean {
  return normalizeCommand(given) === normalizeCommand(accepted)
}

export interface GradeResult {
  /** null when the question needs the learner to verify it themselves. */
  correct: boolean | null
  earned: number
  total: number
}

/**
 * Grades a single response.
 *
 * `response` is always a list of strings so one shape covers every kind:
 * option ids for choice questions, a single command string for command
 * questions, and confirmed checkpoint ids for performance-based tasks.
 */
export function gradeQuestion(question: Question, response: string[]): GradeResult {
  const total = question.points

  switch (question.kind) {
    case 'mcq':
    case 'multi': {
      if (response.length === 0) return { correct: false, earned: 0, total }
      const given = new Set(response)
      const expected = new Set(question.correct)
      // All-or-nothing: partially selected multi-answers score zero, which is
      // how the real exam treats an incomplete task.
      const correct =
        given.size === expected.size && [...expected].every((option) => given.has(option))
      return { correct, earned: correct ? total : 0, total }
    }
    case 'command': {
      const given = response[0] ?? ''
      if (given.trim() === '') return { correct: false, earned: 0, total }
      const correct = question.acceptedAnswers.some((accepted) => commandsMatch(given, accepted))
      return { correct, earned: correct ? total : 0, total }
    }
    case 'task': {
      const checkpointCount = question.checkpoints.length
      if (checkpointCount === 0) return { correct: null, earned: 0, total }
      const valid = new Set(question.checkpoints.map((checkpoint) => checkpoint.id))
      const confirmed = response.filter((id) => valid.has(id)).length
      // Performance-based tasks award partial credit per verified outcome.
      const earned = Math.round((confirmed / checkpointCount) * total * 100) / 100
      return { correct: confirmed === checkpointCount, earned, total }
    }
  }
}

export interface ScoreSummary {
  earnedPoints: number
  totalPoints: number
  scorePercent: number
  passed: boolean
  byDomain: Record<string, { earned: number; total: number }>
  answers: ExamAnswerRecord[]
}

/**
 * Scores a whole exam attempt, including the per-domain breakdown the CKAD
 * result e-mail gives you.
 */
export function scoreExam(
  questions: Question[],
  responses: Record<string, string[]>,
  passingScore: number,
): ScoreSummary {
  const byDomain: Record<string, { earned: number; total: number }> = {}
  const answers: ExamAnswerRecord[] = []
  let earnedPoints = 0
  let totalPoints = 0

  for (const question of questions) {
    const response = responses[question.id] ?? []
    const grade = gradeQuestion(question, response)
    earnedPoints += grade.earned
    totalPoints += grade.total

    const bucket = byDomain[question.domainId] ?? { earned: 0, total: 0 }
    bucket.earned += grade.earned
    bucket.total += grade.total
    byDomain[question.domainId] = bucket

    answers.push({
      questionId: question.id,
      domainId: question.domainId,
      response,
      earned: grade.earned,
      total: grade.total,
      correct: grade.correct,
    })
  }

  const scorePercent = totalPoints === 0 ? 0 : round1((earnedPoints / totalPoints) * 100)

  return {
    earnedPoints: round2(earnedPoints),
    totalPoints: round2(totalPoints),
    scorePercent,
    passed: scorePercent >= passingScore,
    byDomain,
    answers,
  }
}

export const round1 = (value: number): number => Math.round(value * 10) / 10
export const round2 = (value: number): number => Math.round(value * 100) / 100

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0
  return round1((part / whole) * 100)
}
