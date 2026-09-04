import { describe, expect, it } from 'vitest'
import { courses, plannedCourses } from './courses'
import { courseIndexes, courseIdForTopic } from './registry'
import type { Course, NestedBox, Question, Topic } from './types'

/**
 * Cross-course integrity tests.
 *
 * These run over EVERY registered course, so a second or third course cannot
 * quietly ship with broken cross-references, duplicate ids or a blueprint that
 * does not add up. Course-specific facts live in each course's own test file.
 */

const allTopics: { course: Course; topic: Topic }[] = courses.flatMap((course) =>
  course.topics.map((topic) => ({ course, topic })),
)

const allQuestions: { course: Course; question: Question }[] = courses.flatMap((course) =>
  course.questions.map((question) => ({ course, question })),
)

describe('course registry', () => {
  it('registers every available course', () => {
    expect(courses.length).toBeGreaterThanOrEqual(2)
    for (const course of courses) {
      expect(course.status).toBe('available')
    }
  })

  it('gives every course a unique id and a matching route', () => {
    const ids = courses.map((course) => course.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const course of courses) {
      // The router resolves a course from the first path segment, so the
      // route must be exactly "/" plus the id or lookups silently fail.
      expect(course.route, course.id).toBe(`/${course.id}`)
    }
  })

  it('does not announce a course that is already built', () => {
    const builtIds = new Set(courses.map((course) => course.id))
    for (const planned of plannedCourses) {
      expect(builtIds.has(planned.id), planned.id).toBe(false)
    }
  })

  it('builds one index per course', () => {
    expect(courseIndexes).toHaveLength(courses.length)
    for (const index of courseIndexes) {
      expect(index.topicById.size).toBe(index.course.topics.length)
      expect(index.questionById.size).toBe(index.course.questions.length)
      expect(index.domainById.size).toBe(index.course.domains.length)
    }
  })

  it('fills in the dashboard copy every course needs', () => {
    for (const course of courses) {
      for (const [key, value] of Object.entries(course.copy)) {
        expect(value.length, `${course.id}.copy.${key}`).toBeGreaterThan(20)
      }
    }
  })

  it('cites at least two sources per course', () => {
    for (const course of courses) {
      expect(course.sources.length, course.id).toBeGreaterThanOrEqual(2)
      for (const source of course.sources) {
        expect(source.url, `${course.id}: ${source.title}`).toMatch(/^https:\/\//)
      }
    }
  })
})

describe('ids are globally unique', () => {
  /*
   * Progress is stored in one flat map keyed by topic and question id, so a
   * collision between two courses would silently share completion state.
   */
  it('across every topic in every course', () => {
    const ids = allTopics.map((entry) => entry.topic.id)
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    expect(duplicates).toEqual([])
  })

  it('across every question in every course', () => {
    const ids = allQuestions.map((entry) => entry.question.id)
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    expect(duplicates).toEqual([])
  })

  it('across every domain in every course', () => {
    const ids = courses.flatMap((course) => course.domains.map((domain) => domain.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('across every command-reference entry', () => {
    const ids = courses.flatMap((course) =>
      course.commandGroups.flatMap((group) => group.entries.map((entry) => entry.id)),
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('so a bare topic id resolves to exactly one course', () => {
    for (const { course, topic } of allTopics) {
      expect(courseIdForTopic(topic.id), topic.id).toBe(course.id)
    }
  })
})

describe('cross-references resolve', () => {
  it('every topic belongs to a domain of its own course', () => {
    for (const { course, topic } of allTopics) {
      const domainIds = new Set(course.domains.map((domain) => domain.id))
      expect(domainIds.has(topic.domainId), `${course.id}/${topic.id}`).toBe(true)
    }
  })

  it('every question points at a real topic and domain in the same course', () => {
    for (const { course, question } of allQuestions) {
      const topic = course.topics.find((candidate) => candidate.id === question.topicId)
      expect(topic, `${question.id} -> ${question.topicId}`).toBeDefined()
      expect(topic?.domainId, question.id).toBe(question.domainId)
    }
  })

  it('every relatedTopicIds entry exists in the same course', () => {
    for (const { course, topic } of allTopics) {
      const ids = new Set(course.topics.map((candidate) => candidate.id))
      for (const related of topic.relatedTopicIds ?? []) {
        expect(ids.has(related), `${topic.id} -> ${related}`).toBe(true)
      }
    }
  })

  it('no topic lists itself as related', () => {
    for (const { topic } of allTopics) {
      expect(topic.relatedTopicIds ?? [], topic.id).not.toContain(topic.id)
    }
  })

  it('orders topics uniquely within each domain', () => {
    for (const course of courses) {
      for (const domain of course.domains) {
        const orders = course.topics
          .filter((topic) => topic.domainId === domain.id)
          .map((topic) => topic.order)
        expect(new Set(orders).size, `${course.id}/${domain.id}`).toBe(orders.length)
      }
    }
  })
})

describe('exam blueprints', () => {
  it('weights sum to 100 and name real domains', () => {
    for (const course of courses) {
      const { weights } = course.examBlueprint
      const total = Object.values(weights).reduce((sum, value) => sum + value, 0)
      expect(total, course.id).toBe(100)

      const domainIds = new Set(course.domains.map((domain) => domain.id))
      for (const domainId of Object.keys(weights)) {
        expect(domainIds.has(domainId), `${course.id}: ${domainId}`).toBe(true)
      }
    }
  })

  it('every weighted domain has enough questions to fill its share', () => {
    for (const course of courses) {
      const { weights, questionCount } = course.examBlueprint
      for (const [domainId, weight] of Object.entries(weights)) {
        const available = course.questions.filter((q) => q.domainId === domainId).length
        const needed = Math.floor((weight / 100) * questionCount)
        expect(available, `${course.id}/${domainId}`).toBeGreaterThanOrEqual(needed)
      }
    }
  })

  it('explains itself whenever the weighting is not official', () => {
    for (const course of courses) {
      const blueprint = course.examBlueprint
      if (blueprint.officialWeights) continue
      /*
       * HashiCorp publishes no weighting or pass mark for the Terraform
       * Associate exam, so presenting these figures without saying they are
       * the app's own would be misleading.
       */
      expect(blueprint.note, course.id).toBeTruthy()
      expect(blueprint.note!.length, course.id).toBeGreaterThan(60)
    }
  })

  it('uses a sensible timer and pass mark', () => {
    for (const course of courses) {
      const { defaultMinutes, passingScore, questionCount } = course.examBlueprint
      expect(defaultMinutes, course.id).toBeGreaterThanOrEqual(30)
      expect(passingScore, course.id).toBeGreaterThan(50)
      expect(passingScore, course.id).toBeLessThanOrEqual(100)
      expect(questionCount, course.id).toBeGreaterThanOrEqual(10)
    }
  })

  it('marks a domain as weighted only when the vendor publishes a weight', () => {
    for (const course of courses) {
      const weighted = course.domains.filter((domain) => domain.examWeight !== null)
      if (course.examBlueprint.officialWeights) {
        expect(weighted.length, course.id).toBeGreaterThan(0)
        const total = weighted.reduce((sum, d) => sum + (d.examWeight ?? 0), 0)
        expect(total, course.id).toBe(100)
      } else {
        // No published weighting means no domain may claim a percentage.
        expect(weighted, course.id).toEqual([])
      }
    }
  })
})

describe('lesson completeness', () => {
  it('fills every required section of every lesson', () => {
    for (const { course, topic } of allTopics) {
      const where = `${course.id}/${topic.id}`
      expect(topic.explanation.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.whyItMatters.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.howItWorks.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.keyObjects.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.realWorldExample.story.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.yamlExamples.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.imperative.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.declarative.code.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.verification.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.troubleshooting.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.commonMistakes.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.examTips.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.summary.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.practice.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.lab.tasks.length, where).toBeGreaterThanOrEqual(4)
      expect(topic.lab.solution.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.lab.verification.length, where).toBeGreaterThanOrEqual(1)
    }
  })

  it('contains no placeholder text anywhere', () => {
    const banned = /\bTODO\b|\bTBD\b|\bFIXME\b|lorem ipsum|coming soon|placeholder text/i
    for (const { course, topic } of allTopics) {
      const serialised = JSON.stringify(topic)
      const match = serialised.match(banned)
      expect(match?.[0], `${course.id}/${topic.id}`).toBeUndefined()
    }
  })

  it('gives every practice question a hidden answer', () => {
    for (const { topic } of allTopics) {
      for (const question of topic.practice) {
        expect(question.answer.length, question.id).toBeGreaterThan(10)
        expect(question.prompt.length, question.id).toBeGreaterThan(15)
      }
    }
  })

  it('covers all three difficulty levels in each course', () => {
    for (const course of courses) {
      const levels = new Set(course.topics.map((topic) => topic.difficulty))
      expect(levels.has('beginner'), course.id).toBe(true)
      expect(levels.has('intermediate'), course.id).toBe(true)
      expect(levels.has('advanced'), course.id).toBe(true)
    }
  })

  it('estimates a plausible study time for every lesson', () => {
    for (const { topic } of allTopics) {
      expect(topic.estimatedMinutes, topic.id).toBeGreaterThanOrEqual(8)
      expect(topic.estimatedMinutes, topic.id).toBeLessThanOrEqual(45)
    }
  })
})

describe('diagrams in every course', () => {
  it('gives every lesson at least one diagram', () => {
    const missing = allTopics
      .filter((entry) => !entry.topic.diagrams?.length)
      .map((entry) => `${entry.course.id}/${entry.topic.id}`)
    expect(missing).toEqual([])
  })

  it('titles and captions every diagram', () => {
    for (const { course, topic } of allTopics) {
      for (const diagram of topic.diagrams ?? []) {
        const where = `${course.id}/${topic.id}: ${diagram.title}`
        expect(diagram.title.length, where).toBeGreaterThan(8)
        expect(diagram.caption, where).toBeTruthy()
      }
    }
  })

  it('only sends sequence messages between declared participants', () => {
    for (const { course, topic } of allTopics) {
      for (const diagram of topic.diagrams ?? []) {
        if (diagram.kind !== 'sequence') continue
        const ids = new Set(diagram.participants.map((p) => p.id))
        for (const message of diagram.messages) {
          expect(ids.has(message.from), `${course.id}/${topic.id}: ${message.from}`).toBe(true)
          expect(ids.has(message.to), `${course.id}/${topic.id}: ${message.to}`).toBe(true)
        }
      }
    }
  })

  it('keeps every diagram within the renderer’s comfortable limits', () => {
    const depthOf = (box: NestedBox): number =>
      1 + Math.max(0, ...(box.children ?? []).map(depthOf))

    for (const { course, topic } of allTopics) {
      for (const diagram of topic.diagrams ?? []) {
        const where = `${course.id}/${topic.id}: ${diagram.title}`
        if (diagram.kind === 'flow') {
          expect(diagram.nodes.length, where).toBeGreaterThanOrEqual(3)
          expect(diagram.nodes.length, where).toBeLessThanOrEqual(7)
        } else if (diagram.kind === 'sequence') {
          expect(diagram.participants.length, where).toBeGreaterThanOrEqual(2)
          expect(diagram.participants.length, where).toBeLessThanOrEqual(4)
        } else if (diagram.kind === 'decision') {
          expect(diagram.branches.length, where).toBeGreaterThanOrEqual(2)
          expect(diagram.question.trim().endsWith('?'), where).toBe(true)
        } else {
          expect(depthOf(diagram.root), where).toBeLessThanOrEqual(4)
        }
      }
    }
  })

  it('uses no markdown markers, since SVG text is rendered literally', () => {
    for (const { course, topic } of allTopics) {
      for (const diagram of topic.diagrams ?? []) {
        const where = `${course.id}/${topic.id}: ${diagram.title}`
        const serialised = JSON.stringify(diagram)
        expect(serialised.includes('**'), where).toBe(false)
        expect(serialised.includes('`'), where).toBe(false)
      }
    }
  })
})

describe('practice questions in every course', () => {
  it('gives choice questions options and at least one correct answer', () => {
    for (const { question } of allQuestions) {
      if (question.kind !== 'mcq' && question.kind !== 'multi') continue
      expect(question.options.length, question.id).toBeGreaterThanOrEqual(2)
      expect(question.correct.length, question.id).toBeGreaterThanOrEqual(1)
      const optionIds = new Set(question.options.map((option) => option.id))
      for (const id of question.correct) {
        expect(optionIds.has(id), `${question.id}: correct ${id}`).toBe(true)
      }
      if (question.kind === 'mcq') {
        expect(question.correct.length, `${question.id} is mcq`).toBe(1)
      } else {
        expect(question.correct.length, `${question.id} is multi`).toBeGreaterThan(1)
      }
    }
  })

  it('gives command questions at least one accepted answer', () => {
    for (const { question } of allQuestions) {
      if (question.kind !== 'command') continue
      expect(question.acceptedAnswers.length, question.id).toBeGreaterThanOrEqual(1)
      for (const answer of question.acceptedAnswers) {
        expect(answer.trim().length, question.id).toBeGreaterThan(4)
      }
    }
  })

  it('gives task questions checkpoints and a solution', () => {
    for (const { question } of allQuestions) {
      if (question.kind !== 'task') continue
      expect(question.checkpoints.length, question.id).toBeGreaterThanOrEqual(2)
      expect(question.solution.length, question.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('explains every question', () => {
    for (const { question } of allQuestions) {
      expect(question.explanation.length, question.id).toBeGreaterThan(30)
      expect(question.points, question.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('avoids fenced code blocks, which the inline renderer cannot handle', () => {
    for (const { course, topic } of allTopics) {
      for (const question of topic.practice) {
        expect(question.answer.includes('```'), `${course.id}/${question.id}`).toBe(false)
        expect(question.explanation?.includes('```') ?? false, question.id).toBe(false)
      }
    }
  })
})
