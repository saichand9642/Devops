import { describe, expect, it } from 'vitest'
import { ckadCourse } from './courses'
import { ckadDomains, weightedDomainIds } from './ckad/domains'
import { ckadTopics } from './ckad/topics'
import { ckadQuestions } from './ckad/questions'

/**
 * Content integrity tests.
 *
 * These are the guard rails that keep 50 hand-written lesson files honest:
 * unique ids, valid cross-references, no placeholder text, and a mock-exam
 * blueprint that actually matches the published curriculum weights.
 */

describe('course definition', () => {
  it('matches the official CKAD weighting exactly', () => {
    const weighted = ckadDomains.filter((domain) => domain.examWeight !== null)
    const total = weighted.reduce((sum, domain) => sum + (domain.examWeight ?? 0), 0)
    expect(total).toBe(100)
    expect(weighted).toHaveLength(5)
  })

  it('uses the published per-domain percentages', () => {
    const byId = new Map(ckadDomains.map((domain) => [domain.id, domain.examWeight]))
    expect(byId.get('design-build')).toBe(20)
    expect(byId.get('deployment')).toBe(20)
    expect(byId.get('observability')).toBe(15)
    expect(byId.get('environment-security')).toBe(25)
    expect(byId.get('services-networking')).toBe(20)
  })

  it('has an exam blueprint consistent with the domain weights', () => {
    const { weights, passingScore, defaultMinutes } = ckadCourse.examBlueprint
    expect(Object.keys(weights).sort()).toEqual([...weightedDomainIds].sort())
    expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBe(100)
    expect(passingScore).toBe(66)
    expect(defaultMinutes).toBe(120)
  })

  it('records its sources so the curriculum can be re-verified', () => {
    expect(ckadCourse.sources.length).toBeGreaterThanOrEqual(3)
    expect(ckadCourse.sources.every((source) => source.url.startsWith('https://'))).toBe(true)
  })

  it('names the Kubernetes version the content targets', () => {
    expect(ckadCourse.targetVersion).toMatch(/^Kubernetes v\d+\.\d+$/)
  })
})

describe('topics', () => {
  it('has a substantial number of lessons', () => {
    expect(ckadTopics.length).toBeGreaterThanOrEqual(40)
  })

  it('has unique topic ids', () => {
    const ids = ckadTopics.map((topic) => topic.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('assigns every topic to a real domain', () => {
    const domainIds = new Set(ckadDomains.map((domain) => domain.id))
    for (const topic of ckadTopics) {
      expect(domainIds.has(topic.domainId), `${topic.id} -> ${topic.domainId}`).toBe(true)
    }
  })

  it('covers every domain with at least three lessons', () => {
    for (const domain of ckadDomains) {
      const count = ckadTopics.filter((topic) => topic.domainId === domain.id).length
      expect(count, `domain ${domain.id}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('fills every required section of every lesson', () => {
    for (const topic of ckadTopics) {
      const where = `topic ${topic.id}`
      expect(topic.title.length, where).toBeGreaterThan(3)
      expect(topic.oneLiner.length, where).toBeGreaterThan(20)
      expect(topic.explanation.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.whyItMatters.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.howItWorks.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.keyObjects.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.realWorldExample.story.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.yamlExamples.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.imperative.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.declarative.steps.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.declarative.code.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.verification.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.troubleshooting.length, where).toBeGreaterThanOrEqual(2)
      expect(topic.commonMistakes.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.examTips.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.summary.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.practice.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.lab.tasks.length, where).toBeGreaterThanOrEqual(3)
      expect(topic.lab.solution.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.lab.verification.length, where).toBeGreaterThanOrEqual(1)
      expect(topic.estimatedMinutes, where).toBeGreaterThan(0)
    }
  })

  it('contains no placeholder or TODO text anywhere', () => {
    const banned = /\b(TODO|FIXME|TBD|coming soon|placeholder|lorem ipsum|XXX)\b/i
    for (const topic of ckadTopics) {
      const blob = JSON.stringify(topic)
      expect(banned.test(blob), `topic ${topic.id} contains placeholder text`).toBe(false)
    }
  })

  it('gives every code sample a title, a language and real content', () => {
    for (const topic of ckadTopics) {
      const samples = [
        ...topic.yamlExamples,
        ...topic.declarative.code,
        ...(topic.realWorldExample.code ?? []),
        ...topic.lab.solution,
      ]
      for (const sample of samples) {
        const where = `${topic.id} / ${sample.title}`
        expect(sample.title.length, where).toBeGreaterThan(2)
        expect(sample.code.trim().length, where).toBeGreaterThan(10)
        expect(['yaml', 'bash', 'json', 'dockerfile', 'text'], where).toContain(sample.language)
      }
    }
  })

  it('explains every command it shows', () => {
    for (const topic of ckadTopics) {
      for (const command of [
        ...topic.imperative,
        ...topic.verification,
        ...topic.troubleshooting,
      ]) {
        const where = `${topic.id} / ${command.command}`
        expect(command.command.trim().length, where).toBeGreaterThan(3)
        expect(command.what.length, where).toBeGreaterThan(15)
      }
    }
  })

  it('hides an answer behind every practice question', () => {
    for (const topic of ckadTopics) {
      for (const question of topic.practice) {
        const where = `${topic.id} / ${question.id}`
        expect(question.prompt.length, where).toBeGreaterThan(20)
        expect(question.answer.length, where).toBeGreaterThan(5)
        expect(['beginner', 'intermediate', 'advanced'], where).toContain(question.level)
      }
    }
  })

  it('offers beginner through exam-level practice across the course', () => {
    const levels = new Set(ckadTopics.flatMap((topic) => topic.practice.map((q) => q.level)))
    expect(levels).toEqual(new Set(['beginner', 'intermediate', 'advanced']))
  })

  it('has unique practice question ids within each topic', () => {
    for (const topic of ckadTopics) {
      const ids = topic.practice.map((question) => question.id)
      expect(new Set(ids).size, `topic ${topic.id}`).toBe(ids.length)
    }
  })

  it('only cross-references topics that exist', () => {
    const ids = new Set(ckadTopics.map((topic) => topic.id))
    for (const topic of ckadTopics) {
      for (const related of topic.relatedTopicIds ?? []) {
        expect(ids.has(related), `${topic.id} -> ${related}`).toBe(true)
      }
    }
  })

  it('links only to official Kubernetes, CNCF, Helm or Linux Foundation documentation', () => {
    const allowed =
      /^https:\/\/(kubernetes\.io|kubectl\.docs\.kubernetes\.io|helm\.sh|www\.cncf\.io|github\.com\/cncf|docs\.linuxfoundation\.org|training\.linuxfoundation\.org)\//
    for (const topic of ckadTopics) {
      for (const doc of topic.docs ?? []) {
        expect(allowed.test(doc.url), `${topic.id} -> ${doc.url}`).toBe(true)
      }
    }
  })
})

describe('inline formatting markers are balanced', () => {
  /**
   * Lesson prose uses `code` and **bold** markers that the RichText renderer
   * turns into real elements. An unbalanced marker would reach the learner as
   * literal punctuation, so it is worth failing the build over.
   */
  const proseOf = (topic: (typeof ckadTopics)[number]): string[] => [
    topic.oneLiner,
    ...topic.explanation,
    ...topic.whyItMatters,
    ...topic.howItWorks,
    ...topic.commonMistakes,
    ...topic.examTips,
    ...topic.summary,
    ...topic.realWorldExample.story,
    ...topic.declarative.steps,
    ...topic.keyObjects.flatMap((object) => [
      object.purpose,
      ...object.fields.map((field) => field.meaning),
    ]),
    ...topic.practice.flatMap((question) => [
      question.prompt,
      question.answer,
      question.explanation ?? '',
    ]),
    topic.lab.scenario,
    ...(topic.lab.prerequisites ?? []),
    ...topic.lab.tasks.map((task) => task.instruction),
    ...topic.imperative.map((command) => command.what),
    ...topic.verification.map((command) => command.what),
    ...topic.troubleshooting.map((command) => command.what),
  ]

  it('has an even number of backticks in every prose string', () => {
    for (const topic of ckadTopics) {
      for (const text of proseOf(topic)) {
        const ticks = (text.match(/`/g) ?? []).length
        expect(ticks % 2, `${topic.id}: "${text.slice(0, 70)}"`).toBe(0)
      }
    }
  })

  it('has balanced bold markers in every prose string', () => {
    for (const topic of ckadTopics) {
      for (const text of proseOf(topic)) {
        const markers = (text.match(/\*\*/g) ?? []).length
        expect(markers % 2, `${topic.id}: "${text.slice(0, 70)}"`).toBe(0)
      }
    }
  })

  it('never uses fenced code blocks in prose - the renderer only does inline spans', () => {
    for (const topic of ckadTopics) {
      for (const text of proseOf(topic)) {
        expect(text.includes('```'), `${topic.id}: "${text.slice(0, 60)}"`).toBe(false)
      }
    }
    for (const question of ckadQuestions) {
      expect(question.explanation.includes('```'), question.id).toBe(false)
      expect(question.prompt.includes('```'), question.id).toBe(false)
    }
  })

  it('has balanced markers throughout the question bank', () => {
    for (const question of ckadQuestions) {
      const strings = [
        question.prompt,
        question.explanation,
        ...(question.kind === 'mcq' || question.kind === 'multi'
          ? question.options.map((option) => option.text)
          : []),
        ...(question.kind === 'task' ? question.checkpoints.map((c) => c.text) : []),
      ]
      for (const text of strings) {
        expect((text.match(/`/g) ?? []).length % 2, `${question.id}`).toBe(0)
        expect((text.match(/\*\*/g) ?? []).length % 2, `${question.id}`).toBe(0)
      }
    }
  })

  it('has balanced markers in the command reference', () => {
    for (const group of ckadCourse.commandGroups) {
      for (const entry of group.entries) {
        for (const text of [entry.description, entry.notes ?? '']) {
          expect((text.match(/`/g) ?? []).length % 2, entry.id).toBe(0)
          expect((text.match(/\*\*/g) ?? []).length % 2, entry.id).toBe(0)
        }
      }
    }
  })
})

describe('YAML examples are plausibly valid Kubernetes manifests', () => {
  const yamlSamples = ckadTopics.flatMap((topic) =>
    [...topic.yamlExamples, ...topic.lab.solution]
      .filter((sample) => sample.language === 'yaml')
      .map((sample) => ({ topicId: topic.id, ...sample })),
  )

  it('has plenty of YAML to check', () => {
    expect(yamlSamples.length).toBeGreaterThan(60)
  })

  it('never uses a literal tab character', () => {
    for (const sample of yamlSamples) {
      expect(sample.code.includes('\t'), `${sample.topicId} / ${sample.title}`).toBe(false)
    }
  })

  it('indents in multiples of two spaces', () => {
    for (const sample of yamlSamples) {
      for (const line of sample.code.split('\n')) {
        if (line.trim() === '' || line.trimStart().startsWith('#')) continue
        const indent = line.length - line.trimStart().length
        expect(indent % 2, `${sample.topicId} / ${sample.title}: "${line}"`).toBe(0)
      }
    }
  })

  it('uses only apiVersions this content targets', () => {
    const allowed = new Set([
      'v1',
      'apps/v1',
      'batch/v1',
      'networking.k8s.io/v1',
      'rbac.authorization.k8s.io/v1',
      'autoscaling/v2',
      'policy/v1',
      'discovery.k8s.io/v1',
      'apiextensions.k8s.io/v1',
      'storage.k8s.io/v1',
      'kustomize.config.k8s.io/v1beta1',
      'admissionregistration.k8s.io/v1',
      'shop.example.com/v1',
      'v2',
    ])
    // Deliberate counter-examples are always introduced by a comment saying so.
    const deprecatedOnPurpose = new Set([
      'extensions/v1beta1',
      'apps/v1beta1',
      'apps/v1beta2',
      'batch/v1beta1',
      'apiextensions.k8s.io/v1beta1',
      'policy/v1beta1',
    ])
    for (const sample of yamlSamples) {
      for (const match of sample.code.matchAll(/^\s*apiVersion:\s*(\S+)/gm)) {
        const version = match[1]
        const known = allowed.has(version) || deprecatedOnPurpose.has(version)
        expect(known, `${sample.topicId} / ${sample.title}: ${version}`).toBe(true)
      }
    }
  })

  it('pairs every apiVersion with a kind', () => {
    for (const sample of yamlSamples) {
      const versions = [...sample.code.matchAll(/^\s*apiVersion:/gm)].length
      const kinds = [...sample.code.matchAll(/^\s*kind:\s*[A-Z]/gm)].length
      // Some samples are fragments (spec-only) with neither; those are fine.
      if (versions > 0) {
        expect(kinds, `${sample.topicId} / ${sample.title}`).toBeGreaterThanOrEqual(versions)
      }
    }
  })

  it('never pins a :latest image tag', () => {
    for (const sample of yamlSamples) {
      expect(/image:\s*\S+:latest/.test(sample.code), `${sample.topicId} / ${sample.title}`).toBe(
        false,
      )
    }
  })
})

describe('question bank', () => {
  it('has unique question ids', () => {
    const ids = ckadQuestions.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('references only real domains and topics', () => {
    const domainIds = new Set(ckadDomains.map((domain) => domain.id))
    const topicIds = new Set(ckadTopics.map((topic) => topic.id))
    for (const question of ckadQuestions) {
      expect(domainIds.has(question.domainId), `${question.id} domain`).toBe(true)
      expect(topicIds.has(question.topicId), `${question.id} topic ${question.topicId}`).toBe(true)
    }
  })

  it('provides enough questions per weighted domain for a full paper', () => {
    for (const domainId of weightedDomainIds) {
      const count = ckadQuestions.filter((question) => question.domainId === domainId).length
      // A 20-question paper needs at most 5 from one domain; 12 allows variety
      // across repeated attempts.
      expect(count, `domain ${domainId}`).toBeGreaterThanOrEqual(12)
    }
  })

  it('explains every question and gives it a positive point value', () => {
    for (const question of ckadQuestions) {
      expect(question.prompt.length, question.id).toBeGreaterThan(20)
      expect(question.explanation.length, question.id).toBeGreaterThan(40)
      expect(question.points, question.id).toBeGreaterThan(0)
    }
  })

  it('gives choice questions at least two options and a valid answer key', () => {
    for (const question of ckadQuestions) {
      if (question.kind !== 'mcq' && question.kind !== 'multi') continue
      const optionIds = new Set(question.options.map((option) => option.id))
      expect(question.options.length, question.id).toBeGreaterThanOrEqual(2)
      expect(new Set(question.options.map((o) => o.id)).size, question.id).toBe(
        question.options.length,
      )
      expect(question.correct.length, question.id).toBeGreaterThanOrEqual(1)
      for (const correct of question.correct) {
        expect(optionIds.has(correct), `${question.id} answer ${correct}`).toBe(true)
      }
      if (question.kind === 'mcq') {
        expect(question.correct.length, `${question.id} is single-answer`).toBe(1)
      } else {
        expect(question.correct.length, `${question.id} is multi-answer`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('gives command questions at least one accepted answer that looks like a command', () => {
    for (const question of ckadQuestions) {
      if (question.kind !== 'command') continue
      expect(question.acceptedAnswers.length, question.id).toBeGreaterThanOrEqual(1)
      for (const answer of question.acceptedAnswers) {
        expect(
          /^(kubectl|helm|docker|export|alias|cat|source|printf)\b/.test(answer),
          `${question.id}: ${answer}`,
        ).toBe(true)
      }
    }
  })

  it('gives task questions checkpoints and a solution', () => {
    const tasks = ckadQuestions.filter((question) => question.kind === 'task')
    expect(tasks.length).toBeGreaterThanOrEqual(5)
    for (const question of tasks) {
      if (question.kind !== 'task') continue
      expect(question.checkpoints.length, question.id).toBeGreaterThanOrEqual(3)
      expect(new Set(question.checkpoints.map((c) => c.id)).size, question.id).toBe(
        question.checkpoints.length,
      )
      expect(question.solution.length, question.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('covers all five question categories', () => {
    const categories = new Set(ckadQuestions.map((question) => question.category))
    expect(categories).toEqual(new Set(['concept', 'command', 'yaml', 'troubleshoot', 'lab']))
  })

  it('covers all four question kinds', () => {
    const kinds = new Set(ckadQuestions.map((question) => question.kind))
    expect(kinds).toEqual(new Set(['mcq', 'multi', 'command', 'task']))
  })

  it('covers all three difficulty levels', () => {
    const levels = new Set(ckadQuestions.map((question) => question.difficulty))
    expect(levels).toEqual(new Set(['beginner', 'intermediate', 'advanced']))
  })

  it('contains no placeholder text', () => {
    const banned = /\b(TODO|FIXME|TBD|placeholder|lorem ipsum)\b/i
    for (const question of ckadQuestions) {
      expect(banned.test(JSON.stringify(question)), question.id).toBe(false)
    }
  })
})

describe('command reference', () => {
  const entries = ckadCourse.commandGroups.flatMap((group) => group.entries)

  it('has a substantial, well-grouped reference', () => {
    expect(ckadCourse.commandGroups.length).toBeGreaterThanOrEqual(8)
    expect(entries.length).toBeGreaterThanOrEqual(100)
  })

  it('has unique entry ids', () => {
    const ids = entries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('describes and tags every entry', () => {
    for (const entry of entries) {
      expect(entry.command.trim().length, entry.id).toBeGreaterThan(3)
      expect(entry.description.length, entry.id).toBeGreaterThan(15)
      expect(entry.tags.length, entry.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('covers the tools named in the curriculum', () => {
    const blob = entries.map((entry) => entry.command).join('\n')
    expect(blob).toMatch(/kubectl /)
    expect(blob).toMatch(/helm /)
    expect(blob).toMatch(/kubectl kustomize|apply -k/)
  })

  it('includes the high-value exam commands', () => {
    const blob = entries.map((entry) => entry.command).join('\n')
    for (const needle of [
      'kubectl get endpoints',
      'kubectl rollout status',
      'kubectl auth can-i',
      'kubectl explain',
      '--dry-run=client -o yaml',
      'kubectl logs',
      'kubectl config set-context',
      'kubectl replace --force',
    ]) {
      expect(blob, needle).toContain(needle)
    }
  })
})
