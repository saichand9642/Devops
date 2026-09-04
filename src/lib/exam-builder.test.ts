import { describe, expect, it } from 'vitest'
import { buildDomainDrill, buildExam, createRandom, shuffle } from './exam-builder'
import { ckadCourse } from '../content/courses'

describe('createRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = createRandom(42)
    const b = createRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('produces values in [0, 1)', () => {
    const random = createRandom(7)
    for (let i = 0; i < 200; i += 1) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const output = shuffle(input, createRandom(3))
    expect([...output].sort((a, b) => a - b)).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]) // input is not mutated
  })
})

describe('buildExam: domain weighting', () => {
  it('allocates 20 questions as 4/4/3/5/4 to match the official weights', () => {
    const exam = buildExam(ckadCourse, 20, 1)
    expect(exam.questions).toHaveLength(20)
    expect(exam.composition).toEqual({
      'design-build': 4, // 20%
      deployment: 4, // 20%
      observability: 3, // 15%
      'environment-security': 5, // 25%
      'services-networking': 4, // 20%
    })
  })

  it('never selects from unweighted study sections', () => {
    const exam = buildExam(ckadCourse, 20, 9)
    const domains = new Set(exam.questions.map((question) => question.domainId))
    expect(domains.has('foundations')).toBe(false)
    expect(domains.has('exam-prep')).toBe(false)
  })

  it('is reproducible for the same seed and differs across seeds', () => {
    const ids = (seed: number) => buildExam(ckadCourse, 10, seed).questions.map((q) => q.id)
    expect(ids(123)).toEqual(ids(123))
    expect(ids(123)).not.toEqual(ids(456))
  })

  it('never repeats a question within one paper', () => {
    const exam = buildExam(ckadCourse, 20, 77)
    expect(new Set(exam.questions.map((q) => q.id)).size).toBe(exam.questions.length)
  })

  it('handles smaller papers and keeps the weighting sensible', () => {
    const exam = buildExam(ckadCourse, 5, 5)
    expect(exam.questions).toHaveLength(5)
    const total = Object.values(exam.composition).reduce((sum, count) => sum + count, 0)
    expect(total).toBe(5)
    // 25% of the paper is the largest domain, so it must be represented.
    expect(exam.composition['environment-security']).toBeGreaterThanOrEqual(1)
  })

  it('caps the paper at the size of the question pool', () => {
    const exam = buildExam(ckadCourse, 10_000, 2)
    const poolSize = ckadCourse.questions.filter((question) =>
      Object.keys(ckadCourse.examBlueprint.weights).includes(question.domainId),
    ).length
    expect(exam.questions).toHaveLength(poolSize)
  })
})

describe('buildDomainDrill', () => {
  it('returns only questions from the requested domain', () => {
    const drill = buildDomainDrill(ckadCourse, 'services-networking', 5, 1)
    expect(drill.questions).toHaveLength(5)
    expect(drill.questions.every((q) => q.domainId === 'services-networking')).toBe(true)
  })

  it('returns an empty paper for an unknown domain', () => {
    expect(buildDomainDrill(ckadCourse, 'nope', 5, 1).questions).toHaveLength(0)
  })
})
