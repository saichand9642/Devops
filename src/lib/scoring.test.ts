import { describe, expect, it } from 'vitest'
import { commandsMatch, gradeQuestion, normalizeCommand, percent, scoreExam } from './scoring'
import type { ChoiceQuestion, CommandQuestion, Question, TaskQuestion } from '../content/types'

const base = {
  domainId: 'design-build',
  topicId: 'pods',
  category: 'concept' as const,
  difficulty: 'beginner' as const,
  explanation: 'because',
}

const mcq: ChoiceQuestion = {
  ...base,
  id: 'mcq1',
  kind: 'mcq',
  points: 1,
  prompt: 'Pick one',
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ],
  correct: ['b'],
}

const multi: ChoiceQuestion = {
  ...base,
  id: 'multi1',
  kind: 'multi',
  points: 2,
  prompt: 'Pick several',
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
  ],
  correct: ['a', 'c'],
}

const command: CommandQuestion = {
  ...base,
  id: 'cmd1',
  kind: 'command',
  points: 1,
  prompt: 'Write it',
  acceptedAnswers: ['kubectl get pods -n shop', 'kubectl get po -n shop'],
}

const task: TaskQuestion = {
  ...base,
  id: 'task1',
  kind: 'task',
  points: 4,
  prompt: 'Do it',
  checkpoints: [
    { id: 'c1', text: 'one' },
    { id: 'c2', text: 'two' },
    { id: 'c3', text: 'three' },
    { id: 'c4', text: 'four' },
  ],
  solution: [],
}

describe('normalizeCommand', () => {
  it('collapses whitespace and unifies quotes and case', () => {
    expect(normalizeCommand('  KUBECTL   get   pods  ')).toBe('kubectl get pods')
    expect(normalizeCommand('kubectl get pods -o "yaml"')).toBe("kubectl get pods -o 'yaml'")
    expect(normalizeCommand('kubectl get pods;')).toBe('kubectl get pods')
    expect(normalizeCommand('kubectl get pods -n = shop')).toBe('kubectl get pods -n=shop')
  })

  it('treats formatting differences as equal', () => {
    expect(commandsMatch('kubectl   get pods  -n shop', 'kubectl get pods -n shop')).toBe(true)
    expect(commandsMatch("kubectl get pods -l 'app=web'", 'kubectl get pods -l "app=web"')).toBe(
      true,
    )
    expect(commandsMatch('kubectl delete pods', 'kubectl get pods')).toBe(false)
  })
})

describe('gradeQuestion: single answer', () => {
  it('awards full points for the correct option', () => {
    expect(gradeQuestion(mcq, ['b'])).toEqual({ correct: true, earned: 1, total: 1 })
  })

  it('awards nothing for a wrong option or no answer', () => {
    expect(gradeQuestion(mcq, ['a'])).toEqual({ correct: false, earned: 0, total: 1 })
    expect(gradeQuestion(mcq, [])).toEqual({ correct: false, earned: 0, total: 1 })
  })
})

describe('gradeQuestion: multiple answers are all-or-nothing', () => {
  it('awards full points only for the exact set', () => {
    expect(gradeQuestion(multi, ['a', 'c']).correct).toBe(true)
    expect(gradeQuestion(multi, ['c', 'a']).earned).toBe(2)
  })

  it('scores zero for a partial or over-broad selection', () => {
    expect(gradeQuestion(multi, ['a'])).toEqual({ correct: false, earned: 0, total: 2 })
    expect(gradeQuestion(multi, ['a', 'b', 'c'])).toEqual({ correct: false, earned: 0, total: 2 })
  })
})

describe('gradeQuestion: command answers', () => {
  it('accepts any listed answer, ignoring formatting', () => {
    expect(gradeQuestion(command, ['kubectl get pods -n shop']).correct).toBe(true)
    expect(gradeQuestion(command, ['  KUBECTL  get   po  -n shop ']).correct).toBe(true)
  })

  it('rejects a different command and an empty answer', () => {
    expect(gradeQuestion(command, ['kubectl get svc -n shop']).correct).toBe(false)
    expect(gradeQuestion(command, ['   ']).correct).toBe(false)
    expect(gradeQuestion(command, []).correct).toBe(false)
  })
})

describe('gradeQuestion: performance-based tasks award partial credit', () => {
  it('scores the fraction of confirmed checkpoints', () => {
    expect(gradeQuestion(task, [])).toEqual({ correct: false, earned: 0, total: 4 })
    expect(gradeQuestion(task, ['c1', 'c2'])).toEqual({ correct: false, earned: 2, total: 4 })
    expect(gradeQuestion(task, ['c1', 'c2', 'c3', 'c4'])).toEqual({
      correct: true,
      earned: 4,
      total: 4,
    })
  })

  it('ignores checkpoint ids that do not belong to the question', () => {
    expect(gradeQuestion(task, ['c1', 'made-up']).earned).toBe(1)
  })
})

describe('scoreExam', () => {
  const questions: Question[] = [
    mcq,
    { ...multi, domainId: 'deployment' },
    { ...command, domainId: 'observability' },
    { ...task, domainId: 'design-build' },
  ]

  it('sums points, computes a percentage and applies the pass mark', () => {
    const summary = scoreExam(
      questions,
      {
        mcq1: ['b'], // 1/1
        multi1: ['a'], // 0/2
        cmd1: ['kubectl get pods -n shop'], // 1/1
        task1: ['c1', 'c2', 'c3'], // 3/4
      },
      66,
    )
    expect(summary.totalPoints).toBe(8)
    expect(summary.earnedPoints).toBe(5)
    expect(summary.scorePercent).toBe(62.5)
    expect(summary.passed).toBe(false)
  })

  it('breaks the score down per domain', () => {
    const summary = scoreExam(
      questions,
      { mcq1: ['b'], multi1: ['a', 'c'], cmd1: [], task1: ['c1', 'c2', 'c3', 'c4'] },
      66,
    )
    expect(summary.byDomain['design-build']).toEqual({ earned: 5, total: 5 })
    expect(summary.byDomain['deployment']).toEqual({ earned: 2, total: 2 })
    expect(summary.byDomain['observability']).toEqual({ earned: 0, total: 1 })
    expect(summary.passed).toBe(true)
  })

  it('records one answer per question, including unanswered ones', () => {
    const summary = scoreExam(questions, {}, 66)
    expect(summary.answers).toHaveLength(4)
    expect(summary.earnedPoints).toBe(0)
    expect(summary.scorePercent).toBe(0)
  })

  it('does not divide by zero for an empty paper', () => {
    const summary = scoreExam([], {}, 66)
    expect(summary.scorePercent).toBe(0)
    expect(summary.passed).toBe(false)
  })
})

describe('percent', () => {
  it('rounds to one decimal and guards against a zero denominator', () => {
    expect(percent(1, 3)).toBe(33.3)
    expect(percent(2, 2)).toBe(100)
    expect(percent(1, 0)).toBe(0)
  })
})
