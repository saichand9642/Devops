import { describe, expect, it } from 'vitest'
import { buildExam, buildDomainDrill } from './lib/exam-builder'
import { scoreExam } from './lib/scoring'
import { courses } from './content/courses'

/*
 * Driven by the registry rather than a hard-coded list, so a newly added
 * course is covered by these checks the moment it is registered.
 */
describe('exam generation for every course', () => {
  for (const course of courses) {
    it(`builds a full-length ${course.id} paper honouring the blueprint`, () => {
      const paper = buildExam(course, course.examBlueprint.questionCount, 42)
      expect(paper.questions.length).toBe(course.examBlueprint.questionCount)
      expect(new Set(paper.questions.map((q) => q.id)).size).toBe(paper.questions.length)

      // Every question must come from a weighted domain.
      const weighted = new Set(Object.keys(course.examBlueprint.weights))
      for (const q of paper.questions) expect(weighted.has(q.domainId), q.id).toBe(true)

      // The mix should roughly track the weights.
      for (const [domainId, weight] of Object.entries(course.examBlueprint.weights)) {
        const got = paper.questions.filter((q) => q.domainId === domainId).length
        const ideal = (weight / 100) * course.examBlueprint.questionCount
        expect(Math.abs(got - ideal), `${course.id}/${domainId}`).toBeLessThanOrEqual(1.5)
      }
    })

    it(`is deterministic for a given ${course.id} seed`, () => {
      const a = buildExam(course, 12, 7).questions.map((q) => q.id)
      const b = buildExam(course, 12, 7).questions.map((q) => q.id)
      const c = buildExam(course, 12, 8).questions.map((q) => q.id)
      expect(a).toEqual(b)
      expect(a).not.toEqual(c)
    })

    it(`scores a perfect ${course.id} paper as 100% and passing`, () => {
      const paper = buildExam(course, 10, 3)
      const responses: Record<string, string[]> = {}
      for (const q of paper.questions) {
        if (q.kind === 'mcq' || q.kind === 'multi') responses[q.id] = q.correct
        else if (q.kind === 'command') responses[q.id] = [q.acceptedAnswers[0]]
        else if (q.kind === 'task')
          responses[q.id] = q.checkpoints.map((checkpoint) => checkpoint.id)
      }
      const summary = scoreExam(paper.questions, responses, course.examBlueprint.passingScore)
      expect(summary.scorePercent).toBe(100)
      expect(summary.passed).toBe(true)
    })

    it(`scores an empty ${course.id} paper as 0% and failing`, () => {
      const paper = buildExam(course, 10, 3)
      const summary = scoreExam(paper.questions, {}, course.examBlueprint.passingScore)
      expect(summary.scorePercent).toBe(0)
      expect(summary.passed).toBe(false)
    })

    it(`drills every ${course.id} domain that has questions`, () => {
      for (const domain of course.domains) {
        const available = course.questions.filter((q) => q.domainId === domain.id)
        if (available.length === 0) continue
        const drill = buildDomainDrill(course, domain.id, 5, 1)
        expect(drill.questions.length, `${course.id}/${domain.id}`).toBeGreaterThan(0)
        expect(drill.questions.length).toBeLessThanOrEqual(5)
        for (const q of drill.questions) expect(q.domainId).toBe(domain.id)
      }
    })
  }
})
